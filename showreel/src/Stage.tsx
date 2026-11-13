import type { ReactNode } from 'react'
import { AbsoluteFill } from 'remotion'
import type { Camera } from './camera.ts'
import type { DailyEdition } from './editions.ts'
import { MATCH_CUT, OVERSCAN, smoothFloors, smoothstep, type Layout } from './layout.ts'
import { BLOCK_HEIGHT } from './run.ts'
import { CloudBankLayer, IsletsLayer, SkyLayer, TowerLayer } from './World.tsx'

const PERSPECTIVE = 2600

/**
 * One parallax plane: an overscanned SVG that follows the camera by `depth` (0 still, 1 locked to
 * the tower), pushed back `z` px in 3D and scaled up so it lines up again when the stage is flat.
 */
function Plane({ layout, camera, depth, z, children }: { layout: Layout; camera: Camera; depth: number; z: number; children: ReactNode }) {
  const zoom = 1 + (camera.zoom - 1) * depth
  const fx = camera.ax + (camera.fx - camera.ax) * depth
  const fy = camera.ay + (camera.fy - camera.ay) * depth
  const scale = (PERSPECTIVE - z) / PERSPECTIVE
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translateZ(${z}px) scale(${scale})` }}>
      <svg
        viewBox={`${layout.x0 - OVERSCAN * layout.Vw} ${-OVERSCAN * layout.Vh} ${layout.Vw * (1 + 2 * OVERSCAN)} ${layout.Vh * (1 + 2 * OVERSCAN)}`}
        style={{ position: 'absolute', left: -OVERSCAN * layout.W, top: -OVERSCAN * layout.H, width: layout.W * (1 + 2 * OVERSCAN), height: layout.H * (1 + 2 * OVERSCAN) }}
      >
        <g transform={`translate(${camera.ax} ${camera.ay + camera.tilt * depth}) scale(${zoom}) translate(${-fx} ${-fy})`}>{children}</g>
      </svg>
    </div>
  )
}

export function Stage({ layout, camera, edition, frame, blur }: { layout: Layout; camera: Camera; edition: DailyEdition; frame: number; blur: number }) {
  const height = smoothFloors(frame) - 1
  // As in the game: dawn over the first 36 floors, the cloud sea from floor 14, the high sky from 26.
  const dawnStage = Math.min(height / 36, 1)
  const dawn = dawnStage * dawnStage * (3 - 2 * dawnStage)
  const cloudRise = smoothstep(14, 22, height)
  const highSky = smoothstep(26, 36, height)
  const climb = height * BLOCK_HEIGHT * (layout.format === 'portrait' ? 0.7 : 1)
  return (
    <AbsoluteFill style={{ perspective: PERSPECTIVE, filter: blur > 0.3 ? `blur(${blur.toFixed(2)}px)` : undefined }}>
      <AbsoluteFill
        style={{
          transformStyle: 'preserve-3d',
          transform: `translate(${camera.shakeX + camera.whipX}px, ${camera.shakeY + camera.whipY}px) rotateX(${camera.rotX}deg) rotateY(${camera.rotY}deg)`,
        }}
      >
        <Plane layout={layout} camera={camera} depth={0.18} z={-1400}>
          <SkyLayer edition={edition} layout={layout} frame={frame} dawn={dawn} highSky={highSky} />
        </Plane>
        <Plane layout={layout} camera={camera} depth={0.4} z={-700}>
          <IsletsLayer edition={edition} layout={layout} frame={frame} dawn={dawn} climb={climb} />
        </Plane>
        <Plane layout={layout} camera={camera} depth={0.55} z={-350}>
          <CloudBankLayer layout={layout} frame={frame} rise={cloudRise} />
        </Plane>
        <Plane layout={layout} camera={camera} depth={1} z={0}>
          <TowerLayer edition={edition} layout={layout} frame={frame} shift={camera.shift} dawn={dawn} hideTop={frame >= MATCH_CUT ? 3 : 0} />
        </Plane>
      </AbsoluteFill>
    </AbsoluteFill>
  )
}
