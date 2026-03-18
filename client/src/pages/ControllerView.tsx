import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Call } from '@fssphone/shared';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import StatusIndicator from '../components/common/StatusIndicator';

export default function ControllerView() {
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();

  const [isOnline, setIsOnline] = useState(false);
  const [callsign, setCallsign] = useState('');
  const [frequency, setFrequency] = useState('');
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const pilotSocketIdRef = useRef<string | null>(null);

  const { connectionState, remoteStream, error: webrtcError, setupWebRTC, cleanup } = useWebRTC({
    socket,
    callId: currentCall?.id || null,
    isInitiator: false
  });

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('call:incoming', (call) => {
      setIncomingCall(call);
      pilotSocketIdRef.current = call.pilotId;
      // Play ringing sound
      playRingingSound();
    });

    socket.on('call:established', async (call) => {
      setCurrentCall(call);
      setIncomingCall(null);
      stopRingingSound();

      // Set up WebRTC with pilot
      if (pilotSocketIdRef.current) {
        await setupWebRTC(pilotSocketIdRef.current);
      }
    });

    socket.on('call:ended', (callId, reason) => {
      if (currentCall?.id === callId || incomingCall?.id === callId) {
        cleanup();
        setCurrentCall(null);
        setIncomingCall(null);
        pilotSocketIdRef.current = null;
        stopRingingSound();
        if (reason) {
          setError(reason);
          setTimeout(() => setError(null), 5000);
        }
      }
    });

    socket.on('error', (message) => {
      setError(message);
      setTimeout(() => setError(null), 5000);
    });

    return () => {
      socket.off('call:incoming');
      socket.off('call:established');
      socket.off('call:ended');
      socket.off('error');
    };
  }, [socket, currentCall, incomingCall, setupWebRTC, cleanup]);

  // Play remote audio
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(err => {
        console.error('Error playing remote audio:', err);
      });
    }
  }, [remoteStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isOnline && socket) {
        socket.emit('controller:unregister');
      }
      cleanup();
    };
  }, [isOnline, socket, cleanup]);

  const playRingingSound = () => {
    // TODO: Add actual ringing sound
    console.log('Playing ringing sound');
  };

  const stopRingingSound = () => {
    // TODO: Stop ringing sound
    console.log('Stopping ringing sound');
  };

  const handleGoOnline = () => {
    if (!callsign.trim() || !frequency.trim()) {
      setError('Please enter both callsign and frequency');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!socket) {
      setError('Not connected to server');
      return;
    }

    socket.emit('controller:register', {
      callsign: callsign.trim(),
      frequency: frequency.trim()
    });

    setIsOnline(true);
  };

  const handleGoOffline = () => {
    if (socket) {
      socket.emit('controller:unregister');
    }
    setIsOnline(false);
  };

  const handleAnswerCall = () => {
    if (socket && incomingCall) {
      socket.emit('call:answer', incomingCall.id);
    }
  };

  const handleRejectCall = () => {
    if (socket && incomingCall) {
      socket.emit('call:reject', incomingCall.id);
      setIncomingCall(null);
      pilotSocketIdRef.current = null;
      stopRingingSound();
    }
  };

  const handleHangup = () => {
    if (socket && currentCall) {
      socket.emit('call:hangup', currentCall.id);
    }
  };

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-green-50 to-gray-100">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm text-blue-600 font-semibold mb-1">
                <span>VATSIM</span>
                <span>•</span>
                <span>ZLC ARTCC</span>
                <span>•</span>
                <span className="text-red-600">BETA</span>
              </div>
              <h1 className="text-3xl font-bold">Controller - FSS Phone</h1>
            </div>
            <div className="flex items-center gap-4">
              <StatusIndicator status={isConnected ? (isOnline ? 'online' : 'offline') : 'offline'} />
              <Button variant="secondary" onClick={() => navigate('/')}>
                Exit
              </Button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {webrtcError && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {webrtcError}
          </div>
        )}

        {!isOnline ? (
          <Card>
            <h2 className="text-xl font-semibold mb-4">Go Online</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Callsign
                </label>
                <input
                  type="text"
                  placeholder="e.g., Seattle Radio"
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frequency
                </label>
                <input
                  type="text"
                  placeholder="e.g., 122.200"
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <Button
                variant="success"
                size="lg"
                className="w-full"
                onClick={handleGoOnline}
                disabled={!isConnected}
              >
                Go Online
              </Button>
            </div>
          </Card>
        ) : (
          <>
            <Card className="mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{callsign}</h2>
                  <p className="text-gray-600">{frequency}</p>
                </div>
                <div className="flex items-center gap-4">
                  <StatusIndicator status={currentCall ? 'busy' : 'online'} />
                  <Button variant="danger" onClick={handleGoOffline}>
                    Go Offline
                  </Button>
                </div>
              </div>
            </Card>

            {incomingCall && (
              <Card className="border-4 border-yellow-400 animate-pulse">
                <div className="text-center">
                  <div className="w-20 h-20 bg-yellow-500 rounded-full mx-auto flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Incoming Call</h2>
                  <p className="text-gray-600 mb-6">{incomingCall.pilotCallsign}</p>

                  <div className="flex gap-4 justify-center">
                    <Button variant="success" size="lg" onClick={handleAnswerCall}>
                      Answer
                    </Button>
                    <Button variant="danger" size="lg" onClick={handleRejectCall}>
                      Reject
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {currentCall && (
              <Card className="text-center">
                <div className="mb-4">
                  <div className="w-20 h-20 bg-green-500 rounded-full mx-auto flex items-center justify-center mb-4">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Call Active</h2>
                  <p className="text-gray-600 mb-2">
                    Connected with {currentCall.pilotCallsign}
                  </p>
                  <p className="text-sm text-gray-500">
                    Connection: {connectionState}
                  </p>
                </div>

                <Button variant="danger" size="lg" onClick={handleHangup}>
                  Hang Up
                </Button>

                <audio ref={remoteAudioRef} autoPlay />
              </Card>
            )}

            {!incomingCall && !currentCall && (
              <Card className="text-center py-12">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                  </svg>
                </div>
                <p className="text-gray-500">Waiting for calls...</p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
