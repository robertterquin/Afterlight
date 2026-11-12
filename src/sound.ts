// Sound effects from CC0 packs: Kenney "Impact Sounds" and "Interface Sounds" (kenney.nl),
// "pleasing bell sound effect" by Spring Spring and "6 short water splashes" (opengameart.org).
const SOUNDS = [
  'stone-1', 'stone-2', 'stone-3', 'bell', 'tick', 'splash-small', 'splash-big', 'cloud',
  'open', 'close', 'pause', 'resume', 'toggle', 'confirm', 'select',
] as const

export type SoundName = typeof SOUNDS[number]

export type PlayOptions = {
  volume?: number
  /** Playback rate: 1 is the recorded pitch, 2 is an octave up. */
  rate?: number
  /** Seconds from now. */
  delay?: number
}

/**
 * Loads every effect once into Web Audio buffers and plays them on demand. The audio context is only
 * created on a user gesture (browsers block it otherwise), so call unlock() from input handlers.
 */
export function createSoundBoard() {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  const buffers = new Map<SoundName, AudioBuffer>()

  async function load(audio: AudioContext) {
    await Promise.all(SOUNDS.map(async (name) => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}sfx/${name}.m4a`)
        buffers.set(name, await audio.decodeAudioData(await response.arrayBuffer()))
      } catch {
        // A missing effect only means that action stays silent.
      }
    }))
  }

  function unlock() {
    if (typeof window === 'undefined' || !window.AudioContext) return
    if (!context) {
      context = new window.AudioContext()
      master = context.createGain()
      master.gain.value = 0.8
      master.connect(context.destination)
      void load(context)
    }
    if (context.state === 'suspended') void context.resume().catch(() => undefined)
  }

  function play(name: SoundName, { volume = 1, rate = 1, delay = 0 }: PlayOptions = {}) {
    if (!context || !master) return
    const buffer = buffers.get(name)
    if (!buffer) return
    try {
      const source = context.createBufferSource()
      const gain = context.createGain()
      source.buffer = buffer
      source.playbackRate.value = rate
      gain.gain.value = volume
      source.connect(gain)
      gain.connect(master)
      source.start(context.currentTime + delay)
    } catch {
      // Audio is optional; gameplay continues if the browser refuses.
    }
  }

  return { unlock, play }
}

export type SoundBoard = ReturnType<typeof createSoundBoard>

/** Pitches for perfect drops 1 to 5 of a streak: a major-scale climb toward the stone growing. */
export const STREAK_PITCHES = [1, 1.122, 1.26, 1.335, 1.498] as const
