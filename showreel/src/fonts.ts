import { loadFont } from '@remotion/fonts'
import manrope from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2'
import newsreader from '@fontsource-variable/newsreader/files/newsreader-latin-wght-normal.woff2'
import newsreaderItalic from '@fontsource-variable/newsreader/files/newsreader-latin-wght-italic.woff2'

// The game's own type: Newsreader Variable for display, Manrope Variable for UI.
export const DISPLAY = "'Newsreader Variable', Georgia, serif"
export const UI = "'Manrope Variable', 'Avenir Next', sans-serif"

void Promise.all([
  loadFont({ family: 'Newsreader Variable', url: newsreader, weight: '200 800' }),
  loadFont({ family: 'Newsreader Variable', url: newsreaderItalic, weight: '200 800', style: 'italic' }),
  loadFont({ family: 'Manrope Variable', url: manrope, weight: '200 800' }),
])
