import { useEffect, useRef, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents, WebRTCSignal, ICECandidateData } from '@fssphone/shared';

const PEER_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: 'turn:turn.cloudflare.com:3478?transport=udp',
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || ''
    },
    {
      urls: 'turns:turn.cloudflare.com:5349?transport=tcp',
      username: import.meta.env.VITE_TURN_USERNAME || '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || ''
    }
  ],
  iceCandidatePoolSize: 10
};

interface UseWebRTCProps {
  socket: Socket<ServerToClientEvents, ClientToServerEvents> | null;
  callId: string | null;
  isInitiator: boolean;
}

export function useWebRTC({ socket, callId, isInitiator }: UseWebRTCProps) {
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);

  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const remoteSocketId = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // Get microphone access
  const startLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      // Start muted (PTT off)
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

  // Initialize peer connection
  const initializePeerConnection = useCallback((stream: MediaStream) => {
    const pc = new RTCPeerConnection(PEER_CONFIG);

    // Add local tracks to peer connection
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track');
      setRemoteStream(event.streams[0]);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket && callId && remoteSocketId.current) {
        const data: ICECandidateData = {
          callId,
          from: socket.id!,
          to: remoteSocketId.current,
          candidate: event.candidate.toJSON()
        };
        socket.emit('webrtc:ice-candidate', data);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state:', pc.connectionState);
      setConnectionState(pc.connectionState);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', pc.iceConnectionState);
    };

    peerConnection.current = pc;
    return pc;
  }, [socket, callId]);

  // Create and send offer (initiator/pilot)
  const createOffer = useCallback(async (remoteId: string) => {
    if (!socket || !callId || !peerConnection.current) return;

    remoteSocketId.current = remoteId;

    try {
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      const data: WebRTCSignal = {
        callId,
        from: socket.id!,
        to: remoteId,
        sdp: offer
      };
      socket.emit('webrtc:offer', data);
    } catch (err) {
      console.error('Error creating offer:', err);
      setError('Failed to create WebRTC offer');
    }
  }, [socket, callId]);

  // Handle received offer and create answer (controller)
  const handleOffer = useCallback(async (data: WebRTCSignal) => {
    if (!socket || !peerConnection.current) return;

    remoteSocketId.current = data.from;

    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      const responseData: WebRTCSignal = {
        callId: data.callId,
        from: socket.id!,
        to: data.from,
        sdp: answer
      };
      socket.emit('webrtc:answer', responseData);
    } catch (err) {
      console.error('Error handling offer:', err);
      setError('Failed to handle WebRTC offer');
    }
  }, [socket]);

  // Handle received answer (pilot)
  const handleAnswer = useCallback(async (data: WebRTCSignal) => {
    if (!peerConnection.current) return;

    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(data.sdp));
    } catch (err) {
      console.error('Error handling answer:', err);
      setError('Failed to handle WebRTC answer');
    }
  }, []);

  // Handle ICE candidate
  const handleICECandidate = useCallback(async (data: ICECandidateData) => {
    if (!peerConnection.current) return;

    try {
      await peerConnection.current.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (err) {
      console.error('Error adding ICE candidate:', err);
    }
  }, []);

  // Setup WebRTC (called when call is established)
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

  // Cleanup
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
    remoteSocketId.current = null;
  }, [localStream]);

  // Push-to-talk: spacebar
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

  // Listen for WebRTC signals from socket
  useEffect(() => {
    if (!socket) return;

    socket.on('webrtc:offer', handleOffer);
    socket.on('webrtc:answer', handleAnswer);
    socket.on('webrtc:ice-candidate', handleICECandidate);

    return () => {
      socket.off('webrtc:offer', handleOffer);
      socket.off('webrtc:answer', handleAnswer);
      socket.off('webrtc:ice-candidate', handleICECandidate);
    };
  }, [socket, handleOffer, handleAnswer, handleICECandidate]);

  return {
    connectionState,
    localStream,
    remoteStream,
    error,
    isTransmitting,
    setTransmitting,
    setupWebRTC,
    cleanup
  };
}
