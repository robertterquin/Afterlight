// The 100-stone reward: the zodiac constellation of the current season. Star patterns are simplified from the
// real constellations to read at game size. Positions are in a 100×100 box, brightness is the star's real
// magnitude (lower is brighter), and colours follow the real stars (blue-white, white, yellow, orange, red).
export type ZodiacStar = readonly [x: number, y: number, magnitude: number, color: string]

export type Zodiac = {
  name: string
  /** The brightest star, which lights up at 100 stones. */
  brightest: string
  /** First day of the sign's season, as [month 1–12, day]. */
  from: readonly [number, number]
  stars: readonly ZodiacStar[]
  lines: ReadonlyArray<readonly [number, number]>
}

const BLUE = '#e3ebff'
const WHITE = '#f6f6ff'
const YELLOW = '#fff1cf'
const ORANGE = '#ffd09a'
const RED = '#ffab86'

export const ZODIAC: readonly Zodiac[] = [
  { name: 'Capricorn', brightest: 'Deneb Algedi', from: [12, 22], stars: [[14, 24, 3.6, YELLOW], [22, 32, 3.0, WHITE], [44, 68, 4.1, WHITE], [68, 72, 3.7, WHITE], [86, 58, 2.9, WHITE], [88, 40, 3.7, YELLOW], [56, 32, 4.1, WHITE]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0]] },
  { name: 'Aquarius', brightest: 'Sadalsuud', from: [1, 20], stars: [[14, 42, 3.8, WHITE], [30, 30, 2.95, YELLOW], [48, 22, 2.9, YELLOW], [42, 46, 3.8, WHITE], [56, 60, 3.3, WHITE], [72, 72, 4.0, WHITE], [60, 86, 3.7, ORANGE], [82, 54, 4.0, WHITE]], lines: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [4, 7]] },
  { name: 'Pisces', brightest: 'Alpherg', from: [2, 19], stars: [[24, 10, 4.0, WHITE], [30, 30, 4.5, WHITE], [35, 52, 4.3, WHITE], [42, 86, 3.8, WHITE], [60, 76, 4.3, WHITE], [78, 64, 4.0, YELLOW], [86, 48, 3.6, ORANGE], [95, 56, 4.3, WHITE], [90, 70, 4.5, WHITE]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 5]] },
  { name: 'Aries', brightest: 'Hamal', from: [3, 21], stars: [[18, 40, 3.9, WHITE], [40, 35, 2.6, WHITE], [62, 28, 2.0, ORANGE], [76, 62, 3.6, WHITE]], lines: [[0, 1], [1, 2], [2, 3]] },
  { name: 'Taurus', brightest: 'Aldebaran', from: [4, 20], stars: [[12, 14, 1.7, BLUE], [22, 42, 3.0, BLUE], [46, 48, 0.9, ORANGE], [56, 54, 3.4, YELLOW], [64, 60, 3.6, YELLOW], [52, 38, 3.5, ORANGE], [80, 74, 3.4, BLUE]], lines: [[0, 5], [5, 4], [1, 2], [2, 3], [3, 4], [4, 6]] },
  { name: 'Gemini', brightest: 'Pollux', from: [5, 21], stars: [[30, 14, 1.6, WHITE], [48, 20, 1.1, ORANGE], [28, 36, 3.6, WHITE], [50, 40, 3.5, YELLOW], [22, 58, 3.0, WHITE], [54, 62, 3.0, WHITE], [18, 82, 2.9, YELLOW], [60, 84, 1.9, WHITE]], lines: [[0, 1], [0, 2], [2, 4], [4, 6], [1, 3], [3, 5], [5, 7], [2, 3]] },
  { name: 'Cancer', brightest: 'Al Tarf', from: [6, 21], stars: [[50, 46, 4.7, WHITE], [48, 14, 4.0, WHITE], [26, 82, 3.5, ORANGE], [72, 76, 4.2, WHITE]], lines: [[0, 1], [0, 2], [0, 3]] },
  { name: 'Leo', brightest: 'Regulus', from: [7, 23], stars: [[24, 62, 1.4, BLUE], [20, 44, 3.5, WHITE], [28, 26, 2.0, ORANGE], [40, 16, 3.4, WHITE], [50, 24, 3.9, WHITE], [58, 40, 2.6, WHITE], [56, 58, 3.3, WHITE], [82, 52, 2.1, WHITE]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [0, 6], [5, 6], [5, 7], [6, 7]] },
  { name: 'Virgo', brightest: 'Spica', from: [8, 23], stars: [[40, 86, 1.0, BLUE], [46, 60, 2.7, WHITE], [30, 42, 3.4, WHITE], [18, 22, 3.6, WHITE], [62, 40, 2.8, YELLOW], [76, 24, 3.4, WHITE], [64, 64, 3.4, WHITE]], lines: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [1, 6]] },
  { name: 'Libra', brightest: 'Zubeneschamali', from: [9, 23], stars: [[62, 20, 2.6, BLUE], [30, 36, 2.7, WHITE], [46, 64, 3.3, ORANGE], [76, 58, 3.9, ORANGE], [42, 88, 4.0, WHITE]], lines: [[0, 1], [1, 2], [2, 3], [3, 0], [2, 4]] },
  { name: 'Scorpio', brightest: 'Antares', from: [10, 23], stars: [[80, 10, 2.6, BLUE], [84, 26, 2.3, BLUE], [80, 40, 2.9, BLUE], [64, 38, 1.0, RED], [56, 50, 2.8, BLUE], [50, 62, 2.3, ORANGE], [48, 76, 3.0, BLUE], [52, 88, 3.6, ORANGE], [66, 95, 3.3, WHITE], [79, 90, 1.9, YELLOW], [87, 78, 1.6, BLUE]], lines: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 10]] },
  { name: 'Sagittarius', brightest: 'Kaus Australis', from: [11, 22], stars: [[32, 40, 2.8, ORANGE], [20, 56, 2.7, ORANGE], [26, 76, 1.8, BLUE], [46, 76, 2.6, WHITE], [58, 54, 2.05, BLUE], [46, 44, 3.2, BLUE], [42, 24, 3.5, ORANGE], [74, 40, 3.3, WHITE]], lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 6], [6, 5], [4, 7]] },
]

/** The sign whose season contains this UTC date (YYYY-MM-DD). */
export function zodiacForDate(utcDate: string): Zodiac {
  const month = Number(utcDate.slice(5, 7))
  const day = Number(utcDate.slice(8, 10))
  // The latest sign that has started by this date; before Jan 20 it is still Capricorn from December.
  let current = ZODIAC[0]
  for (const sign of ZODIAC) {
    const [fromMonth, fromDay] = sign.from
    if (fromMonth < month || (fromMonth === month && fromDay <= day)) current = sign
  }
  if (month === 12 && day >= 22) current = ZODIAC[0]
  return current
}

/** The index of the brightest star (the lowest magnitude). */
export const brightestStar = (sign: Zodiac) =>
  sign.stars.reduce((best, star, index) => (star[2] < sign.stars[best][2] ? index : best), 0)
