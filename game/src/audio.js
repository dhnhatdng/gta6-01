// Procedural WebAudio sound for Solara Bay: no audio files, everything is
// synthesised — engine hum that follows speed, a two-tone police siren,
// pickup blips, crash thuds and gunshots. M toggles mute.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let sirenOn = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      // Engine: low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: two-tone square wave, toggled by a timer in update().
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'square';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ensure() || muted) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol || 0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      o.connect(g); g.connect(master);
      o.start(); o.stop(ctx.currentTime + dur + 0.02);
    } catch { /* audio is best-effort */ }
  }

  function thud(vol) {
    if (!ensure() || muted) return;
    try {
      if (ctx.state === 'suspended') ctx.resume();
      const len = Math.floor(ctx.sampleRate * 0.18);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 220;
      const g = ctx.createGain();
      g.gain.value = vol || 0.5;
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch { /* ignore */ }
  }

  let sirenPhase = 0;
  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    setEngine(speedKmh, driving) {
      if (!ctx || muted) return;
      const target = driving ? 0.05 + Math.min(speedKmh / 160, 1) * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(50 + speedKmh * 1.1, ctx.currentTime, 0.08);
    },
    setSiren(on) {
      sirenOn = on;
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(on && !muted ? 0.045 : 0, ctx.currentTime, 0.1);
    },
    update(dt) {
      if (!ctx || !sirenOn || muted) return;
      sirenPhase += dt;
      const hi = Math.floor(sirenPhase / 0.45) % 2 === 0;
      sirenOsc.frequency.setTargetAtTime(hi ? 780 : 580, ctx.currentTime, 0.05);
    },
    pickup() { blip(660, 0.12, 'sine', 0.3, 990); setTimeout(() => blip(990, 0.16, 'sine', 0.25, 1320), 90); },
    missionComplete() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.3), i * 110)); },
    crash() { thud(0.6); },
    punch() { thud(0.25); },
    gunshot() { thud(0.7); blip(180, 0.08, 'square', 0.2, 60); },
    sirenBlip() { blip(880, 0.15, 'square', 0.12, 660); },
    denied() { blip(160, 0.2, 'square', 0.2, 120); },
  };
}
