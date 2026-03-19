import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, Call } from '@fssphone/shared';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import StatusIndicator from '../components/common/StatusIndicator';

export default function PilotView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [controllers, setControllers] = useState<Controller[]>([]);
  const [pilotCallsign, setPilotCallsign] = useState('');
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'active'>('idle');
  const [error, setError] = useState<string | null>(null);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const controllerSocketIdRef = useRef<string | null>(null);

  const { connectionState, remoteStream, error: webrtcError, setupWebRTC, cleanup } = useWebRTC({
    socket,
    callId: currentCall?.id || null,
    isInitiator: true
  });

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('controllers:list', (list) => {
      setControllers(list);
    });

    socket.on('controller:updated', (controller) => {
      setControllers(prev => {
        const index = prev.findIndex(c => c.id === controller.id);
        if (index >= 0) {
          const newList = [...prev];
          newList[index] = controller;
          return newList;
        }
        return [...prev, controller];
      });
    });

    socket.on('controller:removed', (controllerId) => {
      setControllers(prev => prev.filter(c => c.id !== controllerId));
    });

    socket.on('call:ringing', (call) => {
      setCurrentCall(call);
      setCallStatus('ringing');

      // Find controller socket ID
      const controller = controllers.find(c => c.id === call.controllerId);
      if (controller) {
        controllerSocketIdRef.current = controller.socketId;
      }
    });

    socket.on('call:established', async (call) => {
      setCurrentCall(call);
      setCallStatus('active');

      // Set up WebRTC with controller
      if (controllerSocketIdRef.current) {
        await setupWebRTC(controllerSocketIdRef.current);
      }
    });

    socket.on('call:ended', (callId, reason) => {
      if (currentCall?.id === callId) {
        cleanup();
        setCurrentCall(null);
        setCallStatus('idle');
        controllerSocketIdRef.current = null;
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
      socket.off('controllers:list');
      socket.off('controller:updated');
      socket.off('controller:removed');
      socket.off('call:ringing');
      socket.off('call:established');
      socket.off('call:ended');
      socket.off('error');
    };
  }, [socket, controllers, currentCall, setupWebRTC, cleanup]);

  // Play remote audio
  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(err => {
        console.error('Error playing remote audio:', err);
      });
    }
  }, [remoteStream]);

  const handleCall = (controller: Controller) => {
    if (!pilotCallsign.trim()) {
      setError('Please enter your callsign');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!socket) {
      setError('Not connected to server');
      return;
    }

    socket.emit('call:initiate', {
      controllerId: controller.id,
      pilotCallsign: pilotCallsign.trim()
    });
  };

  const handleHangup = () => {
    if (socket && currentCall) {
      socket.emit('call:hangup', currentCall.id);
    }
  };

  const availableControllers = controllers.filter(c => c.status === 'online');

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-blue-50 to-gray-100">
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
              <h1 className="text-3xl font-bold">Pilot - FSS Phone</h1>
              {user && <p className="text-sm text-gray-500">{user.name} (CID {user.cid})</p>}
            </div>
            <div className="flex items-center gap-4">
              <StatusIndicator status={isConnected ? 'online' : 'offline'} />
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

        {callStatus === 'idle' && (
          <>
            <Card className="mb-6">
              <h2 className="text-xl font-semibold mb-4">Your Callsign</h2>
              <input
                type="text"
                placeholder="e.g., N12345"
                value={pilotCallsign}
                onChange={(e) => setPilotCallsign(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </Card>

            <Card>
              <h2 className="text-xl font-semibold mb-4">
                Available Controllers ({availableControllers.length})
              </h2>

              {availableControllers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  No controllers online. Waiting for controllers...
                </p>
              ) : (
                <div className="space-y-3">
                  {availableControllers.map((controller) => (
                    <div
                      key={controller.id}
                      className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-400 transition-colors"
                    >
                      <div>
                        <h3 className="font-semibold text-lg">{controller.callsign}</h3>
                        <p className="text-gray-600">{controller.frequency}</p>
                      </div>
                      <Button
                        variant="primary"
                        onClick={() => handleCall(controller)}
                        disabled={!pilotCallsign.trim()}
                      >
                        Call
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}

        {callStatus === 'ringing' && currentCall && (
          <Card className="text-center">
            <div className="animate-pulse mb-4">
              <div className="w-20 h-20 bg-blue-500 rounded-full mx-auto flex items-center justify-center">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold mb-2">Calling...</h2>
            <p className="text-gray-600 mb-4">
              {controllers.find(c => c.id === currentCall.controllerId)?.callsign}
            </p>
            <Button variant="danger" onClick={handleHangup}>
              Cancel Call
            </Button>
          </Card>
        )}

        {callStatus === 'active' && currentCall && (
          <Card className="text-center">
            <div className="mb-4">
              <div className="w-20 h-20 bg-green-500 rounded-full mx-auto flex items-center justify-center mb-4">
                <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold mb-2">Call Active</h2>
              <p className="text-gray-600 mb-2">
                Connected with {controllers.find(c => c.id === currentCall.controllerId)?.callsign}
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
      </div>
    </div>
  );
}
