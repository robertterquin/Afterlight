// Synthesizes the reel's sound stems as WAV files into public/audio/ and copies the game's stone
// landings next to them. The recipes follow src/sound.ts (glass bell, plunk, gong) so the reel
// sounds like the game. Output is deterministic: noise comes from a seeded generator.
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const RATE = 48000
const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '../public/audio')
mkdirSync(out, { recursive: true })

let seed = 7
const random = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}

const buffer = (seconds) => new Float32Array(Math.ceil(seconds * RATE))

/** Exponential attack/decay like the Web Audio envelope in sound.ts. */
const envelope = (t, attack, decay) =>
  t < 0 ? 0 : t < attack ? t / attack : Math.exp((-(t - attack) / decay) * 6.9)

function tone(data, start, frequency, peak, decay, wave = Math.sin) {
  let phase = 0
  for (let index = Math.floor(start * RATE); index < data.length; index += 1) {
    const t = index / RATE - start
    if (t > decay + 0.05) break
    const f = typeof frequency === 'function' ? frequency(t) : frequency
    phase += (2 * Math.PI * f) / RATE
    data[index] += wave(phase) * peak * envelope(t, 0.004, decay)
  }
}

function glassBell(data, start, frequency, volume) {
  for (const [ratio, amplitude, decay] of [[1, 1, 1.5], [2.32, 0.45, 0.8], [4.25, 0.2, 0.45], [6.63, 0.1, 0.25]]) {
    tone(data, start, frequency * ratio, amplitude * volume, decay)
  }
}

/** Filtered noise; `cutoff(t)` in Hz drives a two-pole state-variable filter. */
function noise(data, start, seconds, gain, cutoff, mode = 'low', q = 0.8) {
  let low = 0
  let band = 0
  for (let index = Math.floor(start * RATE); index < Math.min(data.length, (start + seconds) * RATE); index += 1) {
    const t = index / RATE - start
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff(t), RATE / 6)) / RATE)
    const input = random() * 2 - 1
    low += f * band
    const high = input - low - band / q
    band += f * high
    data[index] += (mode === 'low' ? low : band) * gain(t)
  }
}

const note = (base, semitones) => base * 2 ** (semitones / 12)

function write(name, data) {
  let peak = 0
  for (const value of data) peak = Math.max(peak, Math.abs(value))
  const scale = peak > 0.98 ? 0.98 / peak : 1
  const bytes = Buffer.alloc(44 + data.length * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(36 + data.length * 2, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(RATE, 24)
  bytes.writeUInt32LE(RATE * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(data.length * 2, 40)
  data.forEach((value, index) => bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, value * scale)) * 32767), 44 + index * 2))
  writeFileSync(join(out, `${name}.wav`), bytes)
}

// Perfect drops 1 to 5 climb the same major steps as the game.
;[0, 2, 4, 5, 7].forEach((step, index) => {
  const data = buffer(1.8)
  glassBell(data, 0, note(880, step), 0.5)
  write(`bell-${index + 1}`, data)
})

// The fifth perfect: the game's rising arpeggio.
{
  const data = buffer(2.4)
  ;[0, 4, 7, 12].forEach((step, index) => glassBell(data, index * 0.11, note(880, step), 0.42))
  write('celebration', data)
}

// Sub hit: a pitch-dropping sine with a short click on top, for impacts and cuts.
{
  const data = buffer(1.2)
  tone(data, 0, (t) => 38 + 70 * Math.exp(-t * 18), 0.95, 0.9)
  noise(data, 0, 0.03, (t) => 0.5 * (1 - t / 0.03), () => 5000)
  write('sub', data)
}

// Offcut into the sea: falling bubble note and a short wash.
{
  const data = buffer(0.6)
  tone(data, 0, (t) => 810 * (240 / 810) ** Math.min(1, t / 0.07), 0.5, 0.09)
  noise(data, 0.02, 0.45, (t) => 0.9 * envelope(t, 0.01, 0.34), () => 1600, 'band', 0.8)
  write('plunk', data)
}

// Whoosh for whip pans: band-passed noise sweeping up then down.
{
  const data = buffer(0.7)
  noise(data, 0, 0.7, (t) => Math.sin(Math.PI * Math.min(1, t / 0.6)) ** 2 * 2.2, (t) => 400 + 3800 * Math.sin(Math.PI * Math.min(1, t / 0.6)), 'band', 1.4)
  write('whoosh', data)
}

// Riser into the climb and into the title: noise and a tone gliding up, cut off at the peak.
{
  const seconds = 1.6
  const data = buffer(seconds)
  noise(data, 0, seconds, (t) => 0.9 * (t / seconds) ** 2.2, (t) => 300 + 6000 * (t / seconds) ** 2, 'band', 1.1)
  let phase = 0
  for (let index = 0; index < data.length; index += 1) {
    const t = index / RATE
    phase += (2 * Math.PI * 220 * 2 ** ((2 * t) / seconds)) / RATE
    data[index] += Math.sin(phase) * 0.18 * (t / seconds) ** 2
  }
  write('riser', data)
}

// Soft wooden tick for kinetic type.
{
  const data = buffer(0.15)
  tone(data, 0, (t) => 1400 * 0.6 ** Math.min(1, t / 0.05), 0.45, 0.07, (p) => (2 / Math.PI) * Math.asin(Math.sin(p)))
  write('click', data)
}

// Title gong: the game's slow beating low bell, a fifth higher, with a glass bell on top.
{
  const data = buffer(4)
  for (const [ratio, amplitude, decay] of [[1, 1, 2.6], [1.006, 0.7, 2.4], [2.76, 0.25, 1.2], [5.4, 0.08, 0.5]]) {
    tone(data, 0, 220 * ratio, amplitude * 0.5, decay)
  }
  glassBell(data, 0.02, note(880, 12), 0.25)
  write('gong', data)
}

// Ambient bed: a slow open-fifth drone over a sea wash, 16 seconds.
{
  const seconds = 16
  const data = buffer(seconds)
  const voices = [[55, 0.22], [82.4, 0.14], [110.3, 0.1], [164.8, 0.05], [220.6, 0.03]]
  for (const [frequency, amplitude] of voices) {
    let phase = random() * 6
    for (let index = 0; index < data.length; index += 1) {
      const t = index / RATE
      phase += (2 * Math.PI * frequency * (1 + 0.002 * Math.sin(t * 0.7 + frequency))) / RATE
      data[index] += Math.sin(phase) * amplitude * (0.75 + 0.25 * Math.sin(t * 0.5 + frequency))
    }
  }
  noise(data, 0, seconds, (t) => 0.22 * (0.6 + 0.4 * Math.sin(t * 0.9) ** 2), (t) => 500 + 300 * Math.sin(t * 0.4), 'low', 0.7)
  write('bed', data)
}

for (const name of ['stone-1', 'stone-2', 'stone-3']) {
  copyFileSync(join(here, `../../public/sfx/${name}.m4a`), join(out, `${name}.m4a`))
}
console.log(`Audio stems written to ${out}`)
