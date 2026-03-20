// VSCS-style override / incoming call tone
// Two-tone warble: alternating 853Hz and 960Hz (similar to VSCS alert tone)
// Pattern: 250ms high, 250ms low, 250ms high, 250ms low, then 1.5s silence

let audioCtx: AudioContext | null = null;
let ringTimeout: ReturnType<typeof setTimeout> | null = null;
let isRinging = false;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playWarbleCycle() {
  if (!isRinging) return;
  const ctx = getCtx();
  const now = ctx.currentTime;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0.18, now);
  master.connect(ctx.destination);

  const tones = [
    { freq: 853, start: 0, dur: 0.25 },
    { freq: 960, start: 0.3, dur: 0.25 },
    { freq: 853, start: 0.6, dur: 0.25 },
    { freq: 960, start: 0.9, dur: 0.25 },
  ];

  for (const tone of tones) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = tone.freq;

    env.gain.setValueAtTime(0, now + tone.start);
    env.gain.linearRampToValueAtTime(1, now + tone.start + 0.01);
    env.gain.setValueAtTime(1, now + tone.start + tone.dur - 0.01);
    env.gain.linearRampToValueAtTime(0, now + tone.start + tone.dur);

    osc.connect(env);
    env.connect(master);

    osc.start(now + tone.start);
    osc.stop(now + tone.start + tone.dur + 0.01);

    osc.onended = () => { osc.disconnect(); env.disconnect(); };
  }

  ringTimeout = setTimeout(() => {
    if (isRinging) playWarbleCycle();
  }, 2800);
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
}
