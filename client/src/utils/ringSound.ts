// VSCS-style override / incoming call tone
// Two-tone warble: alternating 853Hz and 960Hz (similar to VSCS alert tone)
// Pattern: 300ms high, 300ms low, 300ms high, 300ms low, then 1.5s silence

let audioCtx: AudioContext | null = null;
let ringTimeout: ReturnType<typeof setTimeout> | null = null;
let isRinging = false;

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
  isRinging = true;
  playWarbleCycle();
}

export function stopRinging() {
  isRinging = false;
  if (ringTimeout) {
    clearTimeout(ringTimeout);
    ringTimeout = null;
  }
  if (audioCtx) {
    audioCtx.close();
    audioCtx = null;
  }
}
