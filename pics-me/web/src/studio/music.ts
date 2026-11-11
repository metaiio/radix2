// Soundtracks synthesised on the device with Web Audio. Nothing is sampled or
// downloaded, so there is no music licensing to worry about.

export const SOUNDTRACKS = {
  none: "No music",
  calm: "Calm",
  lofi: "Lo-fi",
  upbeat: "Upbeat",
} as const;
export type Soundtrack = keyof typeof SOUNDTRACKS;

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

interface Kit {
  ctx: AudioContext;
  out: AudioNode;
  noise: AudioBuffer;
}

function tone(k: Kit, type: OscillatorType, midi: number, t: number, dur: number, gain: number, attack = 0.01, cutoff = 0) {
  const osc = k.ctx.createOscillator();
  const g = k.ctx.createGain();
  osc.type = type;
  osc.frequency.value = hz(midi);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, t + Math.max(dur - 0.08, attack));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
  let node: AudioNode = osc;
  if (cutoff) {
    const f = k.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = cutoff;
    osc.connect(f);
    node = f;
  }
  node.connect(g).connect(k.out);
  osc.start(t);
  osc.stop(t + dur + 0.3);
}

function kick(k: Kit, t: number, gain: number) {
  const osc = k.ctx.createOscillator();
  const g = k.ctx.createGain();
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  osc.connect(g).connect(k.out);
  osc.start(t);
  osc.stop(t + 0.3);
}

function hiss(k: Kit, t: number, dur: number, gain: number, freq: number, type: BiquadFilterType = "highpass") {
  const src = k.ctx.createBufferSource();
  const f = k.ctx.createBiquadFilter();
  const g = k.ctx.createGain();
  src.buffer = k.noise;
  f.type = type;
  f.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(k.out);
  src.start(t, Math.random() * 0.5, dur + 0.02);
}

// Four-bar loops; each chord is a list of MIDI notes.
const CHORDS: Record<Exclude<Soundtrack, "none">, number[][]> = {
  calm: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 64]],
  lofi: [[62, 65, 69, 72], [55, 59, 62, 65], [60, 64, 67, 71], [57, 60, 64, 67]],
  upbeat: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]],
};

/** Schedules `seconds` of music into `dest`, starting now. */
export function scheduleMusic(ctx: AudioContext, dest: AudioNode, style: Exclude<Soundtrack, "none">, seconds: number) {
  const master = ctx.createGain();
  const t0 = ctx.currentTime + 0.05;
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(0.5, t0 + 0.3);
  master.gain.setValueAtTime(0.5, t0 + Math.max(seconds - 0.9, 0.3));
  master.gain.linearRampToValueAtTime(0, t0 + seconds);
  master.connect(dest);

  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const k: Kit = { ctx, out: master, noise };
  const chords = CHORDS[style];

  if (style === "calm") {
    const bar = 3.4;
    for (let b = 0; b * bar < seconds; b++) {
      const t = t0 + b * bar, chord = chords[b % 4]!;
      chord.forEach((n) => tone(k, "triangle", n, t, bar, 0.09, 0.9, 1400));
      tone(k, "sine", chord[0]! - 12, t, bar, 0.16, 0.5);
      // A slow bell line picked from the chord.
      [0, 2, 1, 3].forEach((i, step) => tone(k, "sine", chord[i % chord.length]! + 12, t + step * (bar / 4) + 0.02, 0.5, 0.07, 0.005));
    }
    return;
  }

  const bpm = style === "upbeat" ? 122 : 82;
  const beat = 60 / bpm;
  for (let i = 0; i * beat < seconds; i++) {
    const t = t0 + i * beat, chord = chords[Math.floor(i / 4) % 4]!;
    if (style === "upbeat") {
      kick(k, t, 0.9);
      hiss(k, t + beat / 2, 0.05, 0.16, 7000);
      if (i % 2) hiss(k, t, 0.12, 0.22, 1800, "bandpass");
      tone(k, "sawtooth", chord[0]! - 24, t, beat * 0.45, 0.2, 0.005, 420);
      tone(k, "sawtooth", chord[0]! - 24, t + beat / 2, beat * 0.4, 0.16, 0.005, 420);
      for (let s = 0; s < 4; s++) tone(k, "triangle", chord[(i + s) % chord.length]! + 12, t + (s * beat) / 4, beat / 5, 0.07, 0.004);
      if (i % 4 === 0) chord.forEach((n) => tone(k, "triangle", n, t, beat * 3.8, 0.05, 0.05, 2000));
    } else {
      const swing = beat * 0.58;
      if (i % 4 === 0 || i % 4 === 2) kick(k, t, 0.7);
      if (i % 4 === 2 && i % 8 === 6) kick(k, t + swing, 0.4);
      if (i % 2) hiss(k, t, 0.16, 0.2, 1500, "bandpass");
      hiss(k, t, 0.04, 0.07, 6000);
      hiss(k, t + swing, 0.04, 0.05, 6000);
      if (i % 4 === 0) {
        chord.forEach((n, j) => tone(k, "triangle", n + (j % 2 ? 0.06 : -0.06), t + j * 0.02, beat * 3.7, 0.1, 0.03, 900));
        tone(k, "sine", chord[0]! - 24, t, beat * 1.6, 0.26, 0.01);
      }
      if (i % 4 === 2) tone(k, "sine", chord[0]! - 24, t + swing, beat * 1.2, 0.2, 0.01);
    }
  }
}
