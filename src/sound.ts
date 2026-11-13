// Stone landings are CC0 recordings from Kenney's "Impact Sounds" (kenney.nl). Every other cue is
// generated here with Web Audio, so the set stays one family: glass for the beacon's light, stone for
// the tower and water for the tide.
const STONES = ['stone-1', 'stone-2', 'stone-3'] as const

/** Semitone steps for perfect drops 1 to 5 of a streak: a major-scale climb toward the stone growing. */
const STREAK_STEPS = [0, 2, 4, 5, 7] as const
const note = (base: number, semitones: number) => base * Math.pow(2, semitones / 12)

export type Cue =
  | { kind: 'stone' }
  | { kind: 'perfect'; streak: number }
  | { kind: 'celebration' }
  | { kind: 'plunk'; volume: number }
  | { kind: 'miss'; intoCloud: boolean; volume: number }
  | { kind: 'cloud' }
  | { kind: 'start' }
  | { kind: 'end' }
  | { kind: 'tap'; high: boolean }
  | { kind: 'best' }

/**
 * Plays the game's cues. Call prepare() when the page is idle and unlock() from input handlers before
 * the first cue.
 */
export function createSoundBoard() {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  const stones: AudioBuffer[] = []

  /**
   * Builds the audio engine ahead of time. Creating it is slow (up to a few hundred ms), so the page
   * does this while idle; the engine starts suspended and unlock() only has to resume it.
   */
  function prepare() {
    if (typeof window === 'undefined' || !window.AudioContext) return
    if (!context) {
      const audio = new window.AudioContext()
      context = audio
      master = audio.createGain()
      master.gain.value = 0.8
      master.connect(audio.destination)
      for (const name of STONES) {
        fetch(`${import.meta.env.BASE_URL}sfx/${name}.m4a`)
          .then((response) => response.arrayBuffer())
          .then((data) => audio.decodeAudioData(data))
          .then((buffer) => { stones.push(buffer) })
          .catch(() => undefined)
      }
    }
  }

  /** Call from input handlers: browsers only let audio play after a user gesture. */
  function unlock() {
    prepare()
    if (context?.state === 'suspended') void context.resume().catch(() => undefined)
  }

  // ---------- building blocks ----------

  function envelope(gain: GainNode, start: number, attack: number, peak: number, decay: number) {
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), start + attack)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + attack + decay)
  }

  function tone(audio: AudioContext, out: AudioNode, frequency: number, peak: number, decay: number, start: number, type: OscillatorType = 'sine') {
    const oscillator = audio.createOscillator()
    oscillator.type = type
    oscillator.frequency.value = frequency
    const gain = audio.createGain()
    envelope(gain, start, 0.004, peak, decay)
    oscillator.connect(gain)
    gain.connect(out)
    oscillator.start(start)
    oscillator.stop(start + decay + 0.05)
  }

  function noise(audio: AudioContext, seconds: number) {
    const buffer = audio.createBuffer(1, Math.ceil(audio.sampleRate * seconds), audio.sampleRate)
    const data = buffer.getChannelData(0)
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1
    const source = audio.createBufferSource()
    source.buffer = buffer
    return source
  }

  /** Struck glass: inharmonic partials that ring and fade, like the light in the tower's lenses. */
  function glassBell(audio: AudioContext, out: AudioNode, frequency: number, volume: number, start: number) {
    const partials = [[1, 1, 1.5], [2.32, 0.45, 0.8], [4.25, 0.2, 0.45], [6.63, 0.1, 0.25]] as const
    for (const [ratio, amplitude, decay] of partials) tone(audio, out, frequency * ratio, amplitude * volume, decay, start)
  }

  /** A small stone dropping into deep water: a falling bubble note and a short wash. */
  function plunk(audio: AudioContext, out: AudioNode, volume: number, start: number) {
    const bubble = audio.createOscillator()
    bubble.frequency.setValueAtTime(810, start)
    bubble.frequency.exponentialRampToValueAtTime(240, start + 0.07)
    const bubbleGain = audio.createGain()
    envelope(bubbleGain, start, 0.003, volume, 0.09)
    bubble.connect(bubbleGain)
    bubbleGain.connect(out)
    bubble.start(start)
    bubble.stop(start + 0.15)

    const wash = noise(audio, 0.45)
    const filter = audio.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1600
    filter.Q.value = 0.8
    const washGain = audio.createGain()
    envelope(washGain, start + 0.02, 0.01, volume * 0.55, 0.34)
    wash.connect(filter)
    filter.connect(washGain)
    washGain.connect(out)
    wash.start(start + 0.02)
  }

  /** A whole stone hitting the sea: a low thump and a wash of water that settles. */
  function sploosh(audio: AudioContext, out: AudioNode, volume: number, start: number) {
    const thump = audio.createOscillator()
    thump.frequency.setValueAtTime(110, start)
    thump.frequency.exponentialRampToValueAtTime(45, start + 0.3)
    const thumpGain = audio.createGain()
    envelope(thumpGain, start, 0.005, volume * 0.8, 0.32)
    thump.connect(thumpGain)
    thumpGain.connect(out)
    thump.start(start)
    thump.stop(start + 0.4)

    const wash = noise(audio, 1.4)
    const filter = audio.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(2400, start)
    filter.frequency.exponentialRampToValueAtTime(500, start + 1.1)
    const washGain = audio.createGain()
    envelope(washGain, start, 0.015, volume * 0.55, 1.1)
    wash.connect(filter)
    filter.connect(washGain)
    washGain.connect(out)
    wash.start(start)
  }

  /** Air through cloud: a faint, falling breath. */
  function puff(audio: AudioContext, out: AudioNode, volume: number, start: number) {
    const air = noise(audio, 0.5)
    const filter = audio.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 0.9
    filter.frequency.setValueAtTime(800, start)
    filter.frequency.exponentialRampToValueAtTime(500, start + 0.3)
    const gain = audio.createGain()
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.13)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
    air.connect(filter)
    filter.connect(gain)
    gain.connect(out)
    air.start(start)
  }

  /** A slow, slightly beating low bell for a run coming to rest. */
  function gong(audio: AudioContext, out: AudioNode, frequency: number, volume: number, start: number) {
    const partials = [[1, 1, 2.6], [1.006, 0.7, 2.4], [2.76, 0.25, 1.2], [5.4, 0.08, 0.5]] as const
    for (const [ratio, amplitude, decay] of partials) tone(audio, out, frequency * ratio, amplitude * volume, decay, start)
  }

  /** A soft wooden knock for menus. */
  function tap(audio: AudioContext, out: AudioNode, frequency: number, volume: number, start: number) {
    const knock = audio.createOscillator()
    knock.type = 'triangle'
    knock.frequency.setValueAtTime(frequency, start)
    knock.frequency.exponentialRampToValueAtTime(frequency * 0.6, start + 0.05)
    const gain = audio.createGain()
    envelope(gain, start, 0.002, volume, 0.07)
    knock.connect(gain)
    gain.connect(out)
    knock.start(start)
    knock.stop(start + 0.1)
  }

  function stone(audio: AudioContext, out: AudioNode, start: number) {
    if (stones.length === 0) return
    const source = audio.createBufferSource()
    source.buffer = stones[Math.floor(Math.random() * stones.length)]
    source.playbackRate.value = 0.92 + Math.random() * 0.14
    const gain = audio.createGain()
    gain.gain.value = 0.7
    source.connect(gain)
    gain.connect(out)
    source.start(start)
  }

  /** Plays a cue, optionally after a delay in seconds (for example when a falling piece reaches the sea). */
  function play(cue: Cue, delay = 0) {
    if (!context || !master) return
    const audio = context
    const out = master
    const start = audio.currentTime + delay
    try {
      switch (cue.kind) {
        case 'stone':
          stone(audio, out, start)
          break
        case 'perfect':
          glassBell(audio, out, note(880, STREAK_STEPS[(cue.streak - 1) % STREAK_STEPS.length]), 0.32, start)
          break
        case 'celebration':
          ;[0, 4, 7, 12].forEach((step, index) => glassBell(audio, out, note(880, step), 0.26, start + index * 0.11))
          break
        case 'plunk':
          plunk(audio, out, cue.volume, start)
          break
        case 'miss':
          if (cue.intoCloud) puff(audio, out, 0.3, start)
          else sploosh(audio, out, cue.volume, start)
          gong(audio, out, 147, 0.26, start + 0.55)
          break
        case 'cloud':
          puff(audio, out, 0.16, start)
          break
        case 'start':
          glassBell(audio, out, 440, 0.26, start)
          break
        case 'end':
          gong(audio, out, 147, 0.24, start)
          break
        case 'tap':
          tap(audio, out, cue.high ? 1000 : 700, 0.22, start)
          break
        case 'best':
          glassBell(audio, out, 880, 0.28, start)
          glassBell(audio, out, 1320, 0.28, start + 0.18)
          break
      }
    } catch {
      // Audio is optional; gameplay continues if the browser refuses.
    }
  }

  return { prepare, unlock, play }
}

export type SoundBoard = ReturnType<typeof createSoundBoard>
