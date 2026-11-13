import { Audio } from '@remotion/media'
import { AbsoluteFill, interpolate, staticFile, useCurrentFrame } from 'remotion'
import { cameraAt } from './camera.ts'
import { DAILY_EDITIONS } from './editions.ts'
import './fonts.ts'
import { carouselSwitches, CELEBRATIONS, clamp, DURATION, editionIndexAt, LAYOUTS, MATCH_CUT, type Format } from './layout.ts'
import { Overlay } from './Overlay.tsx'
import { DROPS } from './run.ts'
import { Stage } from './Stage.tsx'

const sfx = (name: string) => staticFile(`audio/${name}`)

/** Every cue sits on a frame from the same beat data the picture uses, so hits land on transients. */
function Soundtrack() {
  const final = DROPS.at(-1)!
  return (
    <>
      {/* Bed: in hard at the cold open, lifts for the climb and the title, out over the last half second. */}
      <Audio
        src={sfx('bed.wav')}
        durationInFrames={DURATION}
        volume={(f) => interpolate(f, [0, 4, 390, 420, 700, MATCH_CUT, 860, DURATION], [0, 0.42, 0.42, 0.55, 0.55, 0.7, 0.6, 0], clamp)}
      />
      {DROPS.map((drop, index) => (
        <Audio key={`stone-${drop.frame}`} from={drop.frame} durationInFrames={60} src={sfx(`stone-${(index % 3) + 1}.m4a`)} volume={drop.quick ? 0.26 : 0.62} />
      ))}
      {DROPS.filter((drop) => drop.after.lastDropWasPerfect && drop.after.perfectStreak % 5 !== 0).map((drop) => (
        <Audio
          key={`bell-${drop.frame}`}
          from={drop.frame}
          durationInFrames={drop.quick ? 40 : 100}
          src={sfx(`bell-${((drop.after.perfectStreak - 1) % 5) + 1}.wav`)}
          volume={drop.quick ? 0.22 : 0.55}
        />
      ))}
      {DROPS.filter((drop) => !drop.quick && drop.after.fallingPieces.length > 0).map((drop) => (
        // Offcuts reach the water about 26 frames after the drop.
        <Audio key={`plunk-${drop.frame}`} from={drop.frame + 26} durationInFrames={36} src={sfx('plunk.wav')} volume={0.7} />
      ))}
      {CELEBRATIONS.map((drop) => (
        <Audio key={`celebration-${drop.frame}`} from={drop.frame} durationInFrames={140} src={sfx('celebration.wav')} volume={drop.quick ? 0.26 : 0.55} />
      ))}
      {[8, 60, 298, final.frame, MATCH_CUT].map((at) => (
        <Audio key={`sub-${at}`} from={at} durationInFrames={70} src={sfx('sub.wav')} volume={at === 8 || at === MATCH_CUT ? 0.62 : 0.4} />
      ))}
      {/* Risers resolve exactly on the growth drop and on the match-cut. */}
      <Audio from={298 - 96} durationInFrames={96} src={sfx('riser.wav')} volume={(f) => interpolate(f, [0, 90, 96], [0, 0.55, 0.55], clamp)} />
      <Audio from={MATCH_CUT - 96} durationInFrames={96} src={sfx('riser.wav')} volume={0.6} />
      {[70, 386, ...carouselSwitches.map((at) => at - 6)].map((at) => (
        <Audio key={`whoosh-${at}`} from={at} durationInFrames={42} src={sfx('whoosh.wav')} volume={at >= 600 ? 0.32 : 0.6} />
      ))}
      {[...carouselSwitches, 806, 830].map((at) => (
        <Audio key={`click-${at}`} from={at} durationInFrames={9} src={sfx('click.wav')} volume={0.35} />
      ))}
      <Audio from={MATCH_CUT} durationInFrames={DURATION - MATCH_CUT} src={sfx('gong.wav')} volume={(f) => interpolate(f, [0, 120, DURATION - MATCH_CUT], [0.55, 0.45, 0], clamp)} />
    </>
  )
}

export function Showreel({ format }: { format: Format }) {
  const frame = useCurrentFrame()
  const layout = LAYOUTS[format]
  const camera = cameraAt(frame, layout)
  const previous = cameraAt(frame - 1, layout)
  // Motion blur from camera speed: whip pans, zoom whips and sweeps smear for a few frames.
  const vx = camera.whipX - previous.whipX
  const vy = camera.whipY - previous.whipY
  const blur = Math.min(14, (Math.abs(vx) + Math.abs(vy)) * 0.06 + Math.abs(Math.log(camera.zoom / previous.zoom)) * 70 + Math.abs(camera.rotY - previous.rotY) * 1.2)
  const edition = DAILY_EDITIONS[editionIndexAt(frame)]!
  return (
    <AbsoluteFill style={{ background: '#0a1926', overflow: 'hidden' }}>
      <Stage layout={layout} camera={camera} edition={edition} frame={frame} blur={blur} />
      <Overlay frame={frame} layout={layout} vx={vx} vy={vy} />
      <Soundtrack />
    </AbsoluteFill>
  )
}
