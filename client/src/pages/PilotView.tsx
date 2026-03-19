import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Controller, Call } from '@fssphone/shared';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import StatusIndicator from '../components/common/StatusIndicator';

export default function PilotView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isConnected, send, on, off } = useSocket();

  const [controllers, setControllers] = useState<Controller[]>([]);
  const [pilotCallsign, setPilotCallsign] = useState('');
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'active'>('idle');
  const [error, setError] = useState<string | null>(null);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const currentCallRef = useRef<Call | null>(null);
  currentCallRef.current = currentCall;

  const { connectionState, remoteStream, error: webrtcError, isTransmitting, setupWebRTC, cleanup } = useWebRTC({
    isInitiator: true,
  });

  useEffect(() => {
    const onControllersList = (payload: unknown) => setControllers(payload as Controller[]);
    const onControllerUpdated = (payload: unknown) => {
      const controller = payload as Controller;
      setControllers(prev => {
        const idx = prev.findIndex(c => c.id === controller.id);
        if (idx >= 0) { const n = [...prev]; n[idx] = controller; return n; }
        return [...prev, controller];
      });
    };
    const onControllerRemoved = (payload: unknown) => {
      const { controllerId } = payload as { controllerId: string };
      setControllers(prev => prev.filter(c => c.id !== controllerId));
    };
    const onCallRinging = (payload: unknown) => {
      setCurrentCall(payload as Call);
      setCallStatus('ringing');
    };
    const onCallEstablished = async (payload: unknown) => {
      const call = payload as Call;
      setCurrentCall(call);
      setCallStatus('active');
      if (call.controllerConnectionId) {
        await setupWebRTC(call.controllerConnectionId, call.id);
      }
    };
    const onCallEnded = (payload: unknown) => {
      const { callId } = payload as { callId: string };
      if (currentCallRef.current?.id === callId) {
        cleanup();
        setCurrentCall(null);
        setCallStatus('idle');
      }
    };
    const onError = (payload: unknown) => {
      setError((payload as { message: string }).message);
      setTimeout(() => setError(null), 5000);
    };

    on('controllers:list', onControllersList);
    on('controller:updated', onControllerUpdated);
    on('controller:removed', onControllerRemoved);
    on('call:ringing', onCallRinging);
    on('call:established', onCallEstablished);
    on('call:ended', onCallEnded);
    on('error', onError);

    return () => {
      off('controllers:list', onControllersList);
      off('controller:updated', onControllerUpdated);
      off('controller:removed', onControllerRemoved);
      off('call:ringing', onCallRinging);
      off('call:established', onCallEstablished);
      off('call:ended', onCallEnded);
      off('error', onError);
    };
  }, [on, off, setupWebRTC, cleanup]);

  // Reset call state on reconnect (server already cleaned up the old call)
  const wasConnected = useRef(false);
  useEffect(() => {
    if (isConnected && !wasConnected.current && currentCallRef.current) {
      cleanup();
      setCurrentCall(null);
      setCallStatus('idle');
    }
    wasConnected.current = isConnected;
  }, [isConnected, cleanup]);

  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(err => console.error('Error playing remote audio:', err));
    }
  }, [remoteStream]);

  const handleCall = (controller: Controller) => {
    if (!pilotCallsign.trim()) {
      setError('Please enter your callsign');
      setTimeout(() => setError(null), 3000);
      return;
    }
    send({ type: 'call:initiate', payload: { controllerId: controller.id, pilotCallsign: pilotCallsign.trim() } });
  };

  const handleHangup = () => {
    if (currentCall) {
      send({ type: 'call:hangup', payload: { callId: currentCall.id } });
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
              <Button variant="secondary" onClick={() => navigate('/')}>Exit</Button>
            </div>
          </div>
        </div>

        {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}
        {webrtcError && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{webrtcError}</div>}

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
              <h2 className="text-xl font-semibold mb-4">Available Controllers ({availableControllers.length})</h2>
              {availableControllers.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No controllers online. Waiting for controllers...</p>
              ) : (
                <div className="space-y-3">
                  {availableControllers.map((controller) => (
                    <div key={controller.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-blue-400 transition-colors">
                      <div>
                        <h3 className="font-semibold text-lg">{controller.callsign}</h3>
                        <p className="text-gray-600">{controller.frequency}</p>
                      </div>
                      <Button variant="primary" onClick={() => handleCall(controller)} disabled={!pilotCallsign.trim()}>Call</Button>
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
            <p className="text-gray-600 mb-4">{controllers.find(c => c.id === currentCall.controllerId)?.callsign}</p>
            <Button variant="danger" onClick={handleHangup}>Cancel Call</Button>
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
              <p className="text-gray-600 mb-2">Connected with {controllers.find(c => c.id === currentCall.controllerId)?.callsign}</p>
              <p className="text-sm text-gray-500">Connection: {connectionState}</p>
            </div>
            <div className={`mb-4 px-4 py-3 rounded-lg text-center font-semibold ${isTransmitting ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-600'}`}>
              {isTransmitting ? 'TRANSMITTING' : 'Hold SPACE to talk'}
            </div>
            <Button variant="danger" size="lg" onClick={handleHangup}>Hang Up</Button>
            <audio ref={remoteAudioRef} autoPlay />
          </Card>
        )}
      </div>
    </div>
  );
}
