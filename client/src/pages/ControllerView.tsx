import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Call } from '@fssphone/shared';
import { isValidFrequency, normalizeFrequency } from '../utils/frequency';
import { startRinging, stopRinging } from '../utils/ringSound';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useVatsimStatus } from '../hooks/useVatsimStatus';

export default function ControllerView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isConnected, send, on, off } = useSocket();
  const { status } = useVatsimStatus();

  const [isOnline, setIsOnline] = useState(false);
  const isOnlineRef = useRef(false);
  isOnlineRef.current = isOnline;
  const [callsign, setCallsign] = useState('');
  const [frequency, setFrequency] = useState('');
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const currentCallRef = useRef<Call | null>(null);
  const incomingCallRef = useRef<Call | null>(null);
  currentCallRef.current = currentCall;
  incomingCallRef.current = incomingCall;

  const { remoteStream, error: webrtcError, isTransmitting, setupWebRTC, cleanup } = useWebRTC({
    isInitiator: false,
  });

  useEffect(() => {
    const onCallIncoming = (payload: unknown) => {
      const call = payload as Call;
      setIncomingCall(call);
      startRinging();
    };
    const onCallEstablished = async (payload: unknown) => {
      const call = payload as Call;
      setCurrentCall(call);
      setIncomingCall(null);
      if (call.pilotConnectionId) {
        await setupWebRTC(call.pilotConnectionId, call.id);
      }
    };
    const onCallEnded = (payload: unknown) => {
      const { callId, reason } = payload as { callId: string; reason?: string };
      if (currentCallRef.current?.id === callId || incomingCallRef.current?.id === callId) {
        stopRinging();
        cleanup();
        setCurrentCall(null);
        setIncomingCall(null);
        if (reason) {
          setError(reason);
          setTimeout(() => setError(null), 5000);
        }
      }
    };
    const onError = (payload: unknown) => {
      setError((payload as { message: string }).message);
      setTimeout(() => setError(null), 5000);
    };

    on('call:incoming', onCallIncoming);
    on('call:established', onCallEstablished);
    on('call:ended', onCallEnded);
    on('error', onError);

    return () => {
      off('call:incoming', onCallIncoming);
      off('call:established', onCallEstablished);
      off('call:ended', onCallEnded);
      off('error', onError);
    };
  }, [on, off, setupWebRTC, cleanup]);

  useEffect(() => {
    if (remoteStream && remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
      remoteAudioRef.current.play().catch(err => console.error('Error playing remote audio:', err));
    }
  }, [remoteStream]);

  // Re-register controller and reset call state on reconnect
  const wasConnected = useRef(false);
  useEffect(() => {
    if (isConnected && !wasConnected.current) {
      // Reset any active call (server already cleaned up the old connection)
      if (currentCallRef.current || incomingCallRef.current) {
        cleanup();
        setCurrentCall(null);
        setIncomingCall(null);
      }
      // Re-register if we were online
      if (isOnline && callsign && frequency) {
        send({ type: 'controller:register', payload: { callsign: callsign.trim(), frequency: frequency.trim() } });
      }
    }
    wasConnected.current = isConnected;
  }, [isConnected, isOnline, callsign, frequency, send, cleanup]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      if (isOnlineRef.current) send({ type: 'controller:unregister' });
      stopRinging();
      cleanup();
    };
  }, []);

  // Auto-populate callsign and frequency from VATSIM network status
  useEffect(() => {
    if (status?.online && status.type === 'controller') {
      if (status.callsign && !callsign) {
        setCallsign(status.callsign);
      }
      if (status.frequency && !frequency) {
        setFrequency(status.frequency);
      }
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGoOnline = () => {
    if (!callsign.trim() || !frequency.trim()) {
      setError('Please enter both callsign and frequency');
      setTimeout(() => setError(null), 3000);
      return;
    }
    if (!isValidFrequency(frequency)) {
      setError('Invalid frequency. Must be 118.000-136.975 MHz (25 or 8.33 kHz spacing).');
      setTimeout(() => setError(null), 5000);
      return;
    }
    send({ type: 'controller:register', payload: { callsign: callsign.trim(), frequency: normalizeFrequency(frequency.trim()) } });
    setIsOnline(true);
  };

  const handleGoOffline = () => {
    send({ type: 'controller:unregister' });
    setIsOnline(false);
  };

  const handleAnswerCall = () => {
    if (incomingCall) {
      stopRinging();
      send({ type: 'call:answer', payload: { callId: incomingCall.id } });
    }
  };

  const handleRejectCall = () => {
    if (incomingCall) {
      stopRinging();
      send({ type: 'call:reject', payload: { callId: incomingCall.id } });
      setIncomingCall(null);
    }
  };

  const handleHangup = () => {
    if (currentCall) send({ type: 'call:hangup', payload: { callId: currentCall.id } });
  };

  // Phone line state
  const lineCallsign = currentCall?.pilotCallsign ?? incomingCall?.pilotCallsign ?? null;
  const lineStatus: 'active' | 'ringing' | 'idle' =
    currentCall ? 'active' : incomingCall ? 'ringing' : 'idle';
  const lineLedClass =
    lineStatus === 'active' ? 'led-on-green' :
    lineStatus === 'ringing' ? 'led-on-amber' : 'led-off';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--console-bg)' }}>
      <div className="w-full" style={{ maxWidth: 500 }}>
        <div className="panel" style={{ border: '2px solid var(--panel-edge)' }}>

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '2px solid var(--panel-edge)' }}>
            <div className="flex items-center gap-3">
              <div className="screw" />
              <span className="lcd-text lcd-amber text-sm tracking-widest">ZLC vFSS CONSOLE</span>
            </div>
            <div className="flex items-center gap-3">
              {isOnline && (
                <div className="flex items-center gap-3 mr-2">
                  <div className="flex items-center gap-1">
                    <div className="led led-on-green" />
                    <span className="panel-label">PWR</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`led ${isConnected ? 'led-on-green' : 'led-off'}`} />
                    <span className="panel-label">NET</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`led ${currentCall ? 'led-on-red' : 'led-off'}`} />
                    <span className="panel-label">REC</span>
                  </div>
                </div>
              )}
              <button
                className="hw-btn px-2 py-1 text-xs"
                style={{ color: '#aaa' }}
                onClick={() => navigate('/')}
              >
                EXIT
              </button>
              <div className="screw" />
            </div>
          </div>

          {/* ── Body ── */}
          <div className="px-5 py-4 space-y-4">

            {!isOnline ? (
              /* ──────── OFFLINE STATE ──────── */
              <>
                {status?.requireConnection && !status?.online && (
                  <div className="lcd-display px-3 py-2">
                    <span className="lcd-text lcd-red text-xs" style={{ textAlign: 'center', display: 'block' }}>
                      NOT CONNECTED TO VATSIM NETWORK
                    </span>
                  </div>
                )}

                <div className="lcd-display p-3">
                  <span className="panel-label block mb-1">POSITION</span>
                  <input
                    type="text"
                    placeholder="e.g. Seattle Radio"
                    value={callsign}
                    onChange={(e) => setCallsign(e.target.value)}
                    className="panel-input w-full px-3 py-2 text-sm"
                    style={{ color: 'var(--lcd-amber)', caretColor: 'var(--lcd-amber)' }}
                  />
                </div>
                <div className="lcd-display p-3">
                  <span className="panel-label block mb-1">FREQUENCY</span>
                  <input
                    type="text"
                    placeholder="e.g. 122.200"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                    className="panel-input w-full px-3 py-2 text-sm"
                    style={{ color: 'var(--lcd-amber)', caretColor: 'var(--lcd-amber)' }}
                  />
                </div>

                {(error || webrtcError) && (
                  <div className="lcd-display px-3 py-2">
                    <span className="lcd-text lcd-red text-xs">{error || webrtcError}</span>
                  </div>
                )}

                <button
                  className="hw-btn hw-btn-green w-full py-3 text-sm font-semibold tracking-wider"
                  style={{ color: '#aaffaa' }}
                  onClick={handleGoOnline}
                  disabled={!isConnected}
                >
                  GO ONLINE
                </button>

                {user && (
                  <div className="text-center">
                    <span className="panel-label">{user.name} (CID {user.cid})</span>
                  </div>
                )}
              </>
            ) : (
              /* ──────── ONLINE STATE ──────── */
              <>
                {/* Position / Frequency bar */}
                <div className="lcd-display flex">
                  <div className="flex-1 px-3 py-2" style={{ borderRight: '1px solid #222' }}>
                    <span className="panel-label block mb-0.5">POSITION</span>
                    <span className="lcd-text lcd-amber text-sm">{callsign}</span>
                  </div>
                  <div className="flex-1 px-3 py-2">
                    <span className="panel-label block mb-0.5">FREQ</span>
                    <span className="lcd-text lcd-amber text-sm">{frequency}</span>
                  </div>
                </div>

                {/* Phone Lines */}
                <div style={{ borderTop: '1px solid var(--panel-edge)' }}>
                  <span className="panel-label block pt-3 pb-1 px-1">PHONE LINES</span>
                  <div className="lcd-display">
                    {/* Line 1 */}
                    <div className="flex items-center gap-3 px-3 py-2" style={{ borderBottom: '1px solid #181818' }}>
                      <div className={`led ${lineLedClass}`} />
                      <span className="panel-label w-12 shrink-0">LINE 1</span>
                      <span
                        className="lcd-text text-sm flex-1"
                        style={{
                          color: lineStatus === 'active' ? 'var(--lcd-green)' :
                                 lineStatus === 'ringing' ? 'var(--lcd-amber)' : 'var(--lcd-dim)',
                        }}
                      >
                        {lineCallsign ?? '\u2014'}
                      </span>
                      <span
                        className={`lcd-text text-xs ${lineStatus === 'ringing' ? 'ring-pulse' : ''}`}
                        style={{
                          color: lineStatus === 'active' ? 'var(--lcd-green)' :
                                 lineStatus === 'ringing' ? 'var(--lcd-amber)' : 'var(--lcd-dim)',
                        }}
                      >
                        {lineStatus === 'active' ? 'ACTIVE' : lineStatus === 'ringing' ? 'RINGING' : 'IDLE'}
                      </span>
                    </div>
                    {/* Line 2 (always idle placeholder) */}
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="led led-off" />
                      <span className="panel-label w-12 shrink-0">LINE 2</span>
                      <span className="lcd-text text-sm flex-1" style={{ color: 'var(--lcd-dim)' }}>{'\u2014'}</span>
                      <span className="lcd-text text-xs" style={{ color: 'var(--lcd-dim)' }}>IDLE</span>
                    </div>
                  </div>
                </div>

                {/* PTT bar */}
                {currentCall && (
                  <div
                    className={`text-center py-3 font-semibold text-sm tracking-wider ${isTransmitting ? 'ptt-active' : ''}`}
                    style={{
                      background: isTransmitting ? 'var(--lcd-red)' : 'var(--btn-face)',
                      color: isTransmitting ? '#fff' : '#888',
                      border: '1px solid #222',
                    }}
                  >
                    {isTransmitting ? 'TRANSMITTING' : 'HOLD [SPACE] TO TRANSMIT'}
                  </div>
                )}

                {/* Errors */}
                {(error || webrtcError) && (
                  <div className="lcd-display px-3 py-2">
                    <span className="lcd-text lcd-red text-xs">{error || webrtcError}</span>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    className="hw-btn hw-btn-green flex-1 py-2.5 text-xs font-semibold tracking-wider"
                    style={{ color: '#aaffaa' }}
                    disabled={!incomingCall}
                    onClick={handleAnswerCall}
                  >
                    ANSWER
                  </button>
                  <button
                    className="hw-btn hw-btn-red flex-1 py-2.5 text-xs font-semibold tracking-wider"
                    style={{ color: '#ffaaaa' }}
                    disabled={!incomingCall}
                    onClick={handleRejectCall}
                  >
                    REJECT
                  </button>
                  <button
                    className="hw-btn hw-btn-red flex-1 py-2.5 text-xs font-semibold tracking-wider"
                    style={{ color: '#ffaaaa' }}
                    disabled={!currentCall}
                    onClick={handleHangup}
                  >
                    HANGUP
                  </button>
                  <button
                    className="hw-btn flex-1 py-2.5 text-xs font-semibold tracking-wider"
                    style={{ color: '#aaa' }}
                    onClick={handleGoOffline}
                  >
                    OFF
                  </button>
                </div>
                <div className="text-center mt-3" style={{ fontSize: '7px', color: '#555', letterSpacing: '0.05em' }}>
                  DESIGNED AND IMPROVED BY @MIGUELLINI37 AND THE ZLC (SALT LAKE ARTCC) TEAM
                </div>
              </>
            )}
          </div>

          {/* ── Footer screws ── */}
          <div className="flex justify-between px-4 py-2">
            <div className="screw" />
            <div className="screw" />
          </div>
        </div>

        {/* Hidden audio element for WebRTC */}
        <audio ref={remoteAudioRef} autoPlay />
      </div>
    </div>
  );
}
