// Generate a simple ringing tone using Web Audio API
let audioCtx: AudioContext | null = null;
let ringInterval: ReturnType<typeof setInterval> | null = null;

function playRingBurst() {
  if (!audioCtx) audioCtx = new AudioContext();

  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, audioCtx.currentTime);
  osc.frequency.setValueAtTime(480, audioCtx.currentTime + 0.15);

  gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start();
  osc.stop(audioCtx.currentTime + 0.3);
}

export function startRinging() {
  stopRinging();
  playRingBurst();
  ringInterval = setInterval(playRingBurst, 2000);
}

export function stopRinging() {
  if (ringInterval) {
    clearInterval(ringInterval);
    ringInterval = null;
  }
}
