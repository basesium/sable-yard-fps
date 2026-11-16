// Synthesised sound only: no audio files, no network. Every sound is built
// from oscillators and filtered noise in a WebAudio context created on the
// first user gesture, so the game stays silent until play starts.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let unlocked = false;

  function ensure() {
    if (!unlocked) return false;
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      return false;
    }
    return true;
  }

  function noise(dur, freq, gain, type = 'lowpass') {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  function tone(freq, dur, gain, type = 'sine', slideTo = 0) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + dur);
  }

  return {
    unlock() { unlocked = true; ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    shot(kind) {
      if (kind === 'shotgun') noise(0.22, 900, 0.9);
      else if (kind === 'sniper') { noise(0.3, 1400, 0.9); tone(180, 0.18, 0.25, 'sawtooth', 60); }
      else if (kind === 'smg') noise(0.09, 1800, 0.55);
      else if (kind === 'pistol') noise(0.12, 1600, 0.6);
      else noise(0.14, 1200, 0.75);
    },
    distantShot() { noise(0.18, 500, 0.25); },
    reload() { tone(520, 0.07, 0.2, 'square'); setTimeout(() => tone(380, 0.07, 0.2, 'square'), 160); },
    hit() { tone(880, 0.06, 0.3, 'sine'); },
    kill() { tone(660, 0.09, 0.3, 'sine'); setTimeout(() => tone(990, 0.12, 0.3, 'sine'), 90); },
    hurt() { tone(140, 0.15, 0.35, 'sawtooth', 70); },
    grenade() { noise(0.5, 300, 1.0); tone(90, 0.5, 0.5, 'sine', 35); },
    beep() { tone(1200, 0.08, 0.25, 'square'); },
    plant() { tone(980, 0.1, 0.25, 'square'); setTimeout(() => tone(980, 0.1, 0.25, 'square'), 140); },
    roundWin() { [523, 659, 784].forEach((f, i) => setTimeout(() => tone(f, 0.18, 0.25, 'sine'), i * 130)); },
    roundLose() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.2, 0.22, 'sine'), i * 140)); },
    buy() { tone(740, 0.08, 0.22, 'sine'); },
    step() { noise(0.05, 300, 0.08); },
  };
}
