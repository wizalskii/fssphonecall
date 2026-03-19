// Generate a simple ringing tone using Web Audio API
let audioCtx: AudioContext | null = null;
let ringInterval: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playRingBurst() {
  const ctx = getCtx();

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(440, ctx.currentTime);
  osc.frequency.setValueAtTime(480, ctx.currentTime + 0.15);

  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };

  osc.start();
  osc.stop(ctx.currentTime + 0.3);
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
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
}
