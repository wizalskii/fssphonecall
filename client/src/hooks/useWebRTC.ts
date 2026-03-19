import { useEffect, useRef, useState, useCallback } from 'react';
import type { WebRTCSignal, ICECandidateData } from '@fssphone/shared';
import socketService from '../services/socketService';

const PEER_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: 'turn:turn.cloudflare.com:3478?transport=udp',
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
    },
    {
      urls: 'turns:turn.cloudflare.com:5349?transport=tcp',
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || '',
    },
  ],
  iceCandidatePoolSize: 10,
};

interface UseWebRTCProps {
  callId: string | null;
  isInitiator: boolean;
}

export function useWebRTC({ callId, isInitiator }: UseWebRTCProps) {
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const remoteConnectionId = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

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

  const initializePeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(PEER_CONFIG);

    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    pc.onicecandidate = (event) => {
      if (event.candidate && callId && remoteConnectionId.current) {
        const data: ICECandidateData = {
          callId,
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
    return pc;
  }, [callId]);

  const createOffer = useCallback(async (remoteId: string) => {
    if (!callId || !peerConnection.current) return;

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
  }, [callId]);

  const handleOffer = useCallback(async (payload: unknown) => {
    const data = payload as WebRTCSignal;
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
  }, []);

  const handleAnswer = useCallback(async (payload: unknown) => {
    const data = payload as WebRTCSignal;
    if (!peerConnection.current) return;

    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.sdp as RTCSessionDescriptionInit));
    } catch (err) {
      console.error('Error handling answer:', err);
      setError('Failed to handle WebRTC answer');
    }
  }, []);

  const handleICECandidate = useCallback(async (payload: unknown) => {
    const data = payload as ICECandidateData;
    if (!peerConnection.current) return;

    try {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate as RTCIceCandidateInit));
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  }, []);

  const setupWebRTC = useCallback(async (remoteId: string) => {
    try {
      const stream = await startLocalStream();
      initializePeerConnection(stream);
      if (isInitiator) {
        await createOffer(remoteId);
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
  }, [localStream]);

  // Push-to-talk
  const setTransmitting = useCallback((transmit: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => { track.enabled = transmit; });
      setIsTransmitting(transmit);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && localStreamRef.current) {
        e.preventDefault();
        setTransmitting(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && localStreamRef.current) {
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
