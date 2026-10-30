// Synthesises a tiny SFX kit as 16-bit mono WAVs into public/sfx/.
import { writeFileSync, mkdirSync } from "node:fs";
const RATE = 44100;
mkdirSync("public/sfx", { recursive: true });
function wav(name, samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.max(-1, Math.min(1, s)) * 32767, 44 + i * 2));
  writeFileSync(`public/sfx/${name}.wav`, buf);
}
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
// whoosh: band-limited noise with a swell
{ const n = RATE * 0.45, out = []; let lp = 0;
  for (let i = 0; i < n; i++) { const t = i / n; const env = Math.sin(Math.PI * t) ** 2; const k = 0.04 + 0.25 * t; lp += k * (rnd() - lp); out.push(lp * env * 0.9); }
  wav("whoosh", out); }
// pop: pitch-dropping sine
{ const n = RATE * 0.16, out = []; let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / RATE; const f = 900 * Math.exp(-t * 28) + 180; ph += (2 * Math.PI * f) / RATE; out.push(Math.sin(ph) * Math.exp(-t * 30) * 0.6); }
  wav("pop", out); }
// tick: short click
{ const n = RATE * 0.05, out = [];
  for (let i = 0; i < n; i++) { const t = i / RATE; out.push(Math.sin(2 * Math.PI * 2400 * t) * Math.exp(-t * 160) * 0.35); }
  wav("tick", out); }
// thump: soft kick for the reveal
{ const n = RATE * 0.5, out = []; let ph = 0;
  for (let i = 0; i < n; i++) { const t = i / RATE; const f = 120 * Math.exp(-t * 9) + 45; ph += (2 * Math.PI * f) / RATE; out.push(Math.sin(ph) * Math.exp(-t * 7) * 0.8); }
  wav("thump", out); }
// pad: warm detuned chord bed, 46 s, slow swell
{ const n = RATE * 49, out = []; const notes = [146.83, 220.0, 277.18, 329.63];
  for (let i = 0; i < n; i++) { const t = i / RATE; let s = 0;
    for (const f of notes) s += Math.sin(2 * Math.PI * f * t) + 0.6 * Math.sin(2 * Math.PI * f * 1.003 * t);
    const env = Math.min(1, t / 3) * Math.min(1, (49 - t) / 3) * (0.85 + 0.15 * Math.sin(t * 0.7));
    out.push((s / 8) * env * 0.35); }
  wav("pad", out); }
console.log("sfx written");
