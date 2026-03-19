import { useEffect, useRef, useState, useCallback } from 'react';
import type { WebRTCSignal, ICECandidateData } from '@fssphone/shared';
import socketService from '../services/socketService';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

interface UseWebRTCProps {
  isInitiator: boolean;
}

export function useWebRTC({ isInitiator }: UseWebRTCProps) {
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const remoteConnectionId = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const activeCallId = useRef<string | null>(null);
  const pendingSignals = useRef<Array<{ type: string; payload: unknown }>>([]);

  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      stream.getAudioTracks().forEach(track => { track.enabled = false; });
      setLocalStream(stream);
      localStreamRef.current = stream;
      return stream;
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Failed to access microphone. Please grant permission.');
      throw err;
    }
  }, []);

  const initializePeerConnection = useCallback(async (stream: MediaStream) => {
    // Fetch TURN credentials from the worker
    let iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.cloudflare.com:3478' },
    ];
    try {
      const res = await fetch(`${SERVER_URL}/turn-credentials`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('fssphone_token')}` },
      });
      if (res.ok) {
        const creds = await res.json() as { username: string; credential: string };
        iceServers.push(
          { urls: 'turn:turn.cloudflare.com:3478?transport=udp', username: creds.username, credential: creds.credential },
          { urls: 'turns:turn.cloudflare.com:5349?transport=tcp', username: creds.username, credential: creds.credential },
        );
      }
    } catch {
      // STUN-only fallback
    }

    const pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 10 });

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && activeCallId.current && remoteConnectionId.current) {
        const data: ICECandidateData = {
          callId: activeCallId.current,
          from: socketService.connectionId!,
          to: remoteConnectionId.current,
          candidate: event.candidate.toJSON(),
        };
        socketService.send({ type: 'webrtc:ice-candidate', payload: data });
      }
    };

    pc.onconnectionstatechange = () => {
      setConnectionState(pc.connectionState);
    };

    peerConnection.current = pc;

    // Process any signals that arrived before the peer connection was ready
    const queued = pendingSignals.current.splice(0);
    for (const signal of queued) {
      if (signal.type === 'offer') {
        await processOffer(signal.payload as WebRTCSignal);
      } else if (signal.type === 'answer') {
        await processAnswer(signal.payload as WebRTCSignal);
      } else if (signal.type === 'ice-candidate') {
        await processICECandidate(signal.payload as ICECandidateData);
      }
    }

    return pc;
  }, []);

  const createOffer = useCallback(async (remoteId: string, callId: string) => {
    if (!peerConnection.current) return;

    remoteConnectionId.current = remoteId;

    try {
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      const data: WebRTCSignal = {
        callId,
        from: socketService.connectionId!,
        to: remoteId,
        sdp: offer,
      };
      socketService.send({ type: 'webrtc:offer', payload: data });
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Failed to create WebRTC offer');
    }
  }, []);

  const processOffer = async (data: WebRTCSignal) => {
    if (!peerConnection.current) return;

    remoteConnectionId.current = data.from;

    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.sdp as RTCSessionDescriptionInit));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      const response: WebRTCSignal = {
        callId: data.callId,
        from: socketService.connectionId!,
        to: data.from,
        sdp: answer,
      };
      socketService.send({ type: 'webrtc:answer', payload: response });
    } catch (err) {
      console.error('Error handling offer:', err);
      setError('Failed to handle WebRTC offer');
    }
  };

  const processAnswer = async (data: WebRTCSignal) => {
    if (!peerConnection.current) return;
    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.sdp as RTCSessionDescriptionInit));
    } catch (err) {
      console.error('Error handling answer:', err);
      setError('Failed to handle WebRTC answer');
    }
  };

  const processICECandidate = async (data: ICECandidateData) => {
    if (!peerConnection.current) return;
    try {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit));
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  };

  const handleOffer = useCallback(async (payload: unknown) => {
    if (!peerConnection.current) {
      pendingSignals.current.push({ type: 'offer', payload });
      return;
    }
    await processOffer(payload as WebRTCSignal);
  }, []);

  const handleAnswer = useCallback(async (payload: unknown) => {
    if (!peerConnection.current) {
      pendingSignals.current.push({ type: 'answer', payload });
      return;
    }
    await processAnswer(payload as WebRTCSignal);
  }, []);

  const handleICECandidate = useCallback(async (payload: unknown) => {
    if (!peerConnection.current) {
      pendingSignals.current.push({ type: 'ice-candidate', payload });
      return;
    }
    await processICECandidate(payload as ICECandidateData);
  }, []);

  const setupWebRTC = useCallback(async (remoteId: string, callId: string) => {
    activeCallId.current = callId;
    try {
      const stream = await startLocalStream();
      await initializePeerConnection(stream);
      if (isInitiator) {
        await createOffer(remoteId, callId);
      }
    } catch (err) {
      console.error('Error setting up WebRTC:', err);
    }
  }, [startLocalStream, initializePeerConnection, createOffer, isInitiator]);

  const cleanup = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    setLocalStream(null);
    localStreamRef.current = null;
    setRemoteStream(null);
    setConnectionState('closed');
    setIsTransmitting(false);
    remoteConnectionId.current = null;
    activeCallId.current = null;
    pendingSignals.current = [];
  }, [localStream]);

  // Push-to-talk
  const setTransmitting = useCallback((transmit: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = transmit; });
      setIsTransmitting(transmit);
    }
  }, []);

  useEffect(() => {
    const isInputFocused = () => {
      const tag = document.activeElement?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && localStreamRef.current && !isInputFocused()) {
        e.preventDefault();
        setTransmitting(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isInputFocused()) {
        e.preventDefault();
        setTransmitting(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [setTransmitting]);

  // Listen for WebRTC signals
  useEffect(() => {
    socketService.on('webrtc:offer', handleOffer);
    socketService.on('webrtc:answer', handleAnswer);
    socketService.on('webrtc:ice-candidate', handleICECandidate);

    return () => {
      socketService.off('webrtc:offer', handleOffer);
      socketService.off('webrtc:answer', handleAnswer);
      socketService.off('webrtc:ice-candidate', handleICECandidate);
    };
  }, [handleOffer, handleAnswer, handleICECandidate]);

  return {
    connectionState,
    localStream,
    remoteStream,
    error,
    isTransmitting,
    setTransmitting,
    setupWebRTC,
    cleanup,
  };
}
