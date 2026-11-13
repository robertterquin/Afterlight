import { Composition } from 'remotion'
import { DURATION, FPS } from './layout.ts'
import { Showreel } from './Showreel.tsx'

export const RemotionRoot = () => (
  <>
    <Composition id="ShowreelLandscape" component={Showreel} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} defaultProps={{ format: 'landscape' as const }} />
    <Composition id="ShowreelPortrait" component={Showreel} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ format: 'portrait' as const }} />
  </>
)
