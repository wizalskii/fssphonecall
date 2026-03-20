import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

function getSettingSync(key: string): string | null {
  return localStorage.getItem(key);
}

function saveSetting(key: string, value: string) {
  localStorage.setItem(key, value);
  if (window.electronAPI) {
    window.electronAPI.setSetting(key, value);
  }
}

export default function Settings() {
  const navigate = useNavigate();

  // PTT key binding
  const [, setPttKey] = useState(() => getSettingSync('pttKey') || 'num0');
  const [pttLabel, setPttLabel] = useState(() => getSettingSync('pttKeyLabel') || 'Numpad 0');
  const [listeningForKey, setListeningForKey] = useState(false);

  // Audio devices
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedInput, setSelectedInput] = useState(() => getSettingSync('audioInput') || '');
  const [selectedOutput, setSelectedOutput] = useState(() => getSettingSync('audioOutput') || '');

  // Mic test state
  const [micTesting, setMicTesting] = useState(false);
  const [micTestPhase, setMicTestPhase] = useState<'idle' | 'recording' | 'playing'>('idle');
  const micTestRef = useRef<{ stream?: MediaStream; recorder?: MediaRecorder; chunks: Blob[] }>({ chunks: [] });

  // Speaker test state
  const [speakerTesting, setSpeakerTesting] = useState(false);
  const speakerTestRef = useRef<AudioContext | null>(null);

  // Version & update check
  const [version, setVersion] = useState('Web');
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getVersion().then((v: string) => setVersion(v));
    }
  }, []);

  // Enumerate audio devices
  useEffect(() => {
    async function loadDevices() {
      try {
        // Need to request permission first to get labels
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());

        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioInputs(devices.filter(d => d.kind === 'audioinput'));
        setAudioOutputs(devices.filter(d => d.kind === 'audiooutput'));
      } catch {
        // Permission denied or no devices
      }
    }
    loadDevices();
  }, []);

  // PTT key listener
  useEffect(() => {
    if (!listeningForKey) return;

    function handleKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      const key = e.code;
      const label = e.key === ' ' ? 'Space' : e.code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Numpad ');
      setPttKey(key);
      setPttLabel(label);
      saveSetting('pttKey', key);
      saveSetting('pttKeyLabel', label);
      setListeningForKey(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [listeningForKey]);

  // Handle input device change
  const handleInputChange = useCallback((deviceId: string) => {
    setSelectedInput(deviceId);
    saveSetting('audioInput', deviceId);
  }, []);

  // Handle output device change
  const handleOutputChange = useCallback((deviceId: string) => {
    setSelectedOutput(deviceId);
    saveSetting('audioOutput', deviceId);
  }, []);

  // Test microphone: record 3s then play back
  const testMic = useCallback(async () => {
    if (micTesting) return;
    setMicTesting(true);
    setMicTestPhase('recording');

    try {
      const constraints: MediaStreamConstraints = {
        audio: selectedInput ? { deviceId: { exact: selectedInput } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      micTestRef.current = { stream, recorder, chunks };

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        setMicTestPhase('playing');

        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);

        // Set output device if supported
        if (selectedOutput && 'setSinkId' in audio) {
          (audio as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> })
            .setSinkId(selectedOutput).catch(() => {});
        }

        audio.onended = () => {
          URL.revokeObjectURL(url);
          setMicTesting(false);
          setMicTestPhase('idle');
        };
        audio.play().catch(() => {
          setMicTesting(false);
          setMicTestPhase('idle');
        });
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, 3000);
    } catch {
      setMicTesting(false);
      setMicTestPhase('idle');
    }
  }, [micTesting, selectedInput, selectedOutput]);

  // Test speakers: play 440Hz tone for 0.5s
  const testSpeakers = useCallback(async () => {
    if (speakerTesting) return;
    setSpeakerTesting(true);

    try {
      const ctx = new AudioContext();
      speakerTestRef.current = ctx;

      // If output device selection is supported, try to set it
      if (selectedOutput && 'setSinkId' in ctx) {
        await (ctx as AudioContext & { setSinkId: (id: string) => Promise<void> })
          .setSinkId(selectedOutput).catch(() => {});
      }

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440;
      gain.gain.value = 0.3;
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 1);
      osc.onended = () => {
        ctx.close();
        setSpeakerTesting(false);
      };
    } catch {
      setSpeakerTesting(false);
    }
  }, [speakerTesting, selectedOutput]);

  // Check for updates
  const checkForUpdate = useCallback(async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    setUpdateStatus(null);

    try {
      if (window.electronAPI?.checkForUpdates) {
        const result = await window.electronAPI.checkForUpdates();
        setUpdateStatus(result || 'UP TO DATE');
      } else {
        setUpdateStatus('UPDATES N/A IN BROWSER');
      }
    } catch {
      setUpdateStatus('CHECK FAILED');
    } finally {
      setCheckingUpdate(false);
    }
  }, [checkingUpdate]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--console-bg)' }}>
      <div className="w-full max-w-lg">
        <div className="panel" style={{ border: '3px solid var(--panel-edge)', borderRadius: '4px', padding: '20px' }}>
          {/* Header */}
          <div className="flex justify-between items-center mb-4">
            <div className="screw" />
            <span className="panel-label">Settings</span>
            <div className="screw" />
          </div>

          {/* PTT Key Binding */}
          <div className="mb-5">
            <div className="panel-label mb-2">Push-to-Talk Key</div>
            <div className="lcd-display p-3 flex items-center justify-between">
              <span className="lcd-text lcd-amber text-sm">
                {listeningForKey ? 'PRESS A KEY...' : pttLabel.toUpperCase()}
              </span>
              <button
                onClick={() => setListeningForKey(!listeningForKey)}
                className="hw-btn px-3 py-1 text-xs text-gray-400"
              >
                {listeningForKey ? 'CANCEL' : 'CHANGE'}
              </button>
            </div>
          </div>

          {/* Audio Input */}
          <div className="mb-5">
            <div className="panel-label mb-2">Audio Input</div>
            <select
              value={selectedInput}
              onChange={(e) => handleInputChange(e.target.value)}
              className="panel-input w-full px-3 py-2 text-sm mb-2"
              style={{ borderRadius: '2px', appearance: 'auto' }}
            >
              <option value="">DEFAULT DEVICE</option>
              {audioInputs.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
            <button
              onClick={testMic}
              disabled={micTesting}
              className="hw-btn px-3 py-1 text-xs text-gray-400 w-full"
            >
              {micTestPhase === 'recording'
                ? 'RECORDING (3s)...'
                : micTestPhase === 'playing'
                  ? 'PLAYING BACK...'
                  : 'TEST MIC'}
            </button>
          </div>

          {/* Audio Output */}
          <div className="mb-5">
            <div className="panel-label mb-2">Audio Output</div>
            <select
              value={selectedOutput}
              onChange={(e) => handleOutputChange(e.target.value)}
              className="panel-input w-full px-3 py-2 text-sm mb-2"
              style={{ borderRadius: '2px', appearance: 'auto' }}
            >
              <option value="">DEFAULT DEVICE</option>
              {audioOutputs.map(d => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
            <button
              onClick={testSpeakers}
              disabled={speakerTesting}
              className="hw-btn px-3 py-1 text-xs text-gray-400 w-full"
            >
              {speakerTesting ? 'PLAYING TONE...' : 'TEST SPEAKERS'}
            </button>
          </div>

          {/* About */}
          <div className="mb-5">
            <div className="panel-label mb-2">About</div>
            <div className="lcd-display p-3">
              <div className="flex justify-between items-center mb-1">
                <span className="panel-label">Version</span>
                <span className="lcd-text lcd-green text-xs">{version}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="panel-label">Platform</span>
                <span className="lcd-text lcd-dim text-xs">
                  {window.electronAPI ? 'ELECTRON' : 'BROWSER'}
                </span>
              </div>
            </div>
            <button
              onClick={checkForUpdate}
              disabled={checkingUpdate}
              className="hw-btn px-3 py-1 text-xs text-gray-400 w-full mt-2"
            >
              {checkingUpdate ? 'CHECKING...' : 'CHECK FOR UPDATES'}
            </button>
            {updateStatus && (
              <div className="lcd-display p-2 mt-2 text-center">
                <span className="lcd-text lcd-dim text-xs">{updateStatus}</span>
              </div>
            )}
          </div>

          {/* Back button */}
          <button
            onClick={() => navigate('/')}
            className="hw-btn w-full p-3 text-sm text-gray-400 tracking-wider"
          >
            BACK
          </button>

          <div className="flex justify-between mt-4">
            <div className="screw" />
            <div className="screw" />
          </div>
        </div>
      </div>
    </div>
  );
}
