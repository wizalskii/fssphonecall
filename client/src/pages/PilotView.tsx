import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Controller, Call } from '@fssphone/shared';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useVatsimStatus } from '../hooks/useVatsimStatus';

export default function PilotView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isConnected, send, on, off } = useSocket();
  const { status } = useVatsimStatus();

  const [controllers, setControllers] = useState<Controller[]>([]);
  const [pilotCallsign, setPilotCallsign] = useState('');
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [callStatus, setCallStatus] = useState<'idle' | 'ringing' | 'active'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

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

  useEffect(() => { setSelectedIdx(0); }, [controllers.length]);

  // Auto-populate callsign from VATSIM network status
  useEffect(() => {
    if (status?.online && status.callsign && !pilotCallsign) {
      setPilotCallsign(status.callsign);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const selectedController = availableControllers[selectedIdx] ?? null;
  const ringTarget = currentCall ? controllers.find(c => c.id === currentCall.controllerId) : null;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--console-bg)' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <div className="panel" style={{ border: '3px solid var(--panel-edge)', borderRadius: '4px', padding: '16px' }}>

          {/* ── Header row: screws + label + exit ── */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="screw" />
              <span className="panel-label" style={{ fontSize: '11px', letterSpacing: '0.2em' }}>vFSS COMM 1</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                className="hw-btn"
                style={{ padding: '2px 8px', fontSize: '9px', color: 'var(--label-color)' }}
                onClick={() => navigate('/')}
              >
                EXIT
              </button>
              <div className="screw" />
            </div>
          </div>

          {/* ── User info ── */}
          {user && (
            <div className="panel-label mb-3" style={{ textAlign: 'center' }}>
              {user.name} &middot; CID {user.cid}
            </div>
          )}

          {/* ── VATSIM connection warning ── */}
          {status?.requireConnection && !status?.online && (
            <div className="lcd-display mb-3" style={{ padding: '6px 8px', borderRadius: '2px' }}>
              <div className="lcd-text lcd-red" style={{ fontSize: '10px', textAlign: 'center' }}>
                NOT CONNECTED TO VATSIM NETWORK
              </div>
            </div>
          )}

          {/* ── Callsign input (idle only) ── */}
          {callStatus === 'idle' && (
            <div className="lcd-display mb-3" style={{ padding: '8px', borderRadius: '2px' }}>
              <input
                type="text"
                placeholder="ENTER CALLSIGN"
                value={pilotCallsign}
                onChange={(e) => setPilotCallsign(e.target.value.toUpperCase())}
                className="panel-input w-full"
                style={{ padding: '6px 8px', fontSize: '14px', borderRadius: '2px' }}
              />
            </div>
          )}

          {/* ── Main LCD frequency display ── */}
          <div className="lcd-display mb-3" style={{ padding: '12px', borderRadius: '2px', textAlign: 'center' }}>
            {callStatus === 'idle' && (
              <>
                <div className={`lcd-text ${selectedController ? 'lcd-green' : 'lcd-dim'}`} style={{ fontSize: '28px', lineHeight: 1.2 }}>
                  {selectedController ? selectedController.frequency : '----.---'}
                </div>
                <div className={`lcd-text ${selectedController ? 'lcd-green' : 'lcd-dim'}`} style={{ fontSize: '12px', marginTop: '4px' }}>
                  {selectedController ? selectedController.callsign : 'NO SIGNAL'}
                </div>
              </>
            )}
            {callStatus === 'ringing' && ringTarget && (
              <div className="ring-pulse">
                <div className="lcd-text lcd-amber" style={{ fontSize: '28px', lineHeight: 1.2 }}>
                  {ringTarget.frequency}
                </div>
                <div className="lcd-text lcd-amber" style={{ fontSize: '12px', marginTop: '4px' }}>
                  CALLING...
                </div>
              </div>
            )}
            {callStatus === 'active' && ringTarget && (
              <>
                <div className="lcd-text lcd-green" style={{ fontSize: '28px', lineHeight: 1.2 }}>
                  {ringTarget.frequency}
                </div>
                <div className="lcd-text lcd-green" style={{ fontSize: '12px', marginTop: '4px' }}>
                  {ringTarget.callsign}
                </div>
                <div className="lcd-text lcd-green" style={{ fontSize: '10px', marginTop: '2px', opacity: 0.7 }}>
                  ON CALL
                </div>
              </>
            )}
          </div>

          {/* ── Station list (idle only) ── */}
          {callStatus === 'idle' && (
            <div className="lcd-display mb-3" style={{ padding: '8px', borderRadius: '2px' }}>
              {availableControllers.length === 0 ? (
                <div className="lcd-text lcd-dim" style={{ fontSize: '11px', textAlign: 'center', padding: '8px 0' }}>
                  NO STATIONS ONLINE
                </div>
              ) : (
                <>
                  {selectedIdx > 0 && (
                    <div className="lcd-text lcd-dim" style={{ fontSize: '9px', textAlign: 'center', marginBottom: '2px' }}>
                      ▲
                    </div>
                  )}
                  <div className="panel-label" style={{ fontSize: '8px', textAlign: 'center', marginBottom: '4px' }}>
                    STATIONS ONLINE
                  </div>
                  {availableControllers.map((ctrl, i) => (
                    <div
                      key={ctrl.id}
                      className={`lcd-text ${i === selectedIdx ? 'lcd-green' : 'lcd-dim'}`}
                      style={{
                        fontSize: '12px',
                        padding: '2px 4px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedIdx(i)}
                    >
                      <span>{i === selectedIdx ? '►' : '\u00A0'} {ctrl.callsign}</span>
                      <span>{ctrl.frequency}</span>
                    </div>
                  ))}
                  {selectedIdx < availableControllers.length - 1 && (
                    <div className="lcd-text lcd-dim" style={{ fontSize: '9px', textAlign: 'center', marginTop: '2px' }}>
                      ▼
                    </div>
                  )}
                  <div className="lcd-text lcd-dim" style={{ fontSize: '9px', textAlign: 'center', marginTop: '4px' }}>
                    {availableControllers.length} STATION{availableControllers.length !== 1 ? 'S' : ''}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Signal bars + connection LED ── */}
          <div className="flex items-end gap-1 mb-3" style={{ padding: '4px 0' }}>
            {[6, 10, 14, 18, 22].map((h, i) => (
              <div
                key={i}
                className={isConnected && i < 3 ? 'signal-bar' : 'signal-bar-off'}
                style={{ height: `${h}px`, width: '3px', borderRadius: '1px' }}
              />
            ))}
            <div className="flex items-center gap-2 ml-2">
              <div
                className="led"
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isConnected ? 'var(--led-green)' : 'var(--led-off)',
                  boxShadow: isConnected ? '0 0 6px var(--led-green)' : 'none',
                }}
              />
              <span className="panel-label" style={{ fontSize: '9px' }}>
                {isConnected ? (connectionState === 'connected' ? 'CONNECTED' : connectionState.toUpperCase()) : 'OFFLINE'}
              </span>
            </div>
          </div>

          {/* ── Error line ── */}
          {(error || webrtcError) && (
            <div className="lcd-display mb-3" style={{ padding: '6px 8px', borderRadius: '2px' }}>
              <div className="lcd-text lcd-red" style={{ fontSize: '10px' }}>
                {error || webrtcError}
              </div>
            </div>
          )}

          {/* ── Control buttons ── */}
          <div className="flex gap-2 mb-3">
            {callStatus === 'idle' && (
              <>
                <button
                  className="hw-btn flex-1"
                  style={{ padding: '8px', fontSize: '11px', color: 'var(--label-color)' }}
                  disabled={availableControllers.length === 0}
                  onClick={() => setSelectedIdx(i => (i > 0 ? i - 1 : i))}
                >
                  ▲
                </button>
                <button
                  className="hw-btn flex-1"
                  style={{ padding: '8px', fontSize: '11px', color: 'var(--label-color)' }}
                  disabled={availableControllers.length === 0}
                  onClick={() => setSelectedIdx(i => (i < availableControllers.length - 1 ? i + 1 : i))}
                >
                  ▼
                </button>
                <button
                  className="hw-btn hw-btn-green flex-1"
                  style={{ padding: '8px', fontSize: '11px', color: '#ccc' }}
                  disabled={!pilotCallsign.trim() || !selectedController}
                  onClick={() => selectedController && handleCall(selectedController)}
                >
                  CALL
                </button>
                <button
                  className="hw-btn hw-btn-red flex-1"
                  style={{ padding: '8px', fontSize: '11px', color: '#ccc' }}
                  disabled
                >
                  END
                </button>
              </>
            )}
            {callStatus === 'ringing' && (
              <button
                className="hw-btn hw-btn-red flex-1"
                style={{ padding: '8px', fontSize: '11px', color: '#ccc' }}
                onClick={handleHangup}
              >
                CANCEL
              </button>
            )}
            {callStatus === 'active' && (
              <button
                className="hw-btn hw-btn-red flex-1"
                style={{ padding: '8px', fontSize: '11px', color: '#ccc' }}
                onClick={handleHangup}
              >
                HANGUP
              </button>
            )}
          </div>

          {/* ── PTT bar (active call only) ── */}
          {callStatus === 'active' && (
            <div
              className={`lcd-display lcd-text mb-3 ${isTransmitting ? 'ptt-active lcd-red' : 'lcd-dim'}`}
              style={{
                padding: '10px',
                borderRadius: '2px',
                textAlign: 'center',
                fontSize: '12px',
                letterSpacing: '0.1em',
              }}
            >
              {isTransmitting ? 'TRANSMITTING' : 'HOLD [SPACE] TO TRANSMIT'}
            </div>
          )}

          {/* ── Bottom screws ── */}
          <div className="flex justify-between mt-2">
            <div className="screw" />
            <div className="screw" />
          </div>

        </div>
      </div>

      {/* Hidden audio element */}
      <audio ref={remoteAudioRef} autoPlay style={{ display: 'none' }} />
    </div>
  );
}
