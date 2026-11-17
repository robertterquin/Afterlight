export type StonePalette = {
  top: string
  front: string
  side: string
  joint: string
  roughCut: string
  roughCutHighlight: string
  activeTop: string
  activeFront: string
  activeSide: string
  activeJoint: string
}

export type DailyEdition = {
  name: string
  sky: readonly [string, string, string, string]
  dawnSky: readonly [string, string, string, string]
  sea: readonly [string, string]
  dawnSea: readonly [string, string]
  moon: {
    x: number
    y: number
    radius: number
    light: string
    body: string
    shade: string
    phase?: number
  }
  mountains: readonly [string, string]
  islands: {
    deep: string
    leftTop: string
    rightTop: string
    leftOffsetX: number
    leftOffsetY: number
    rightOffsetX: number
    rightOffsetY: number
  }
  tower: {
    shadow: string
    deep: string
    top: string
    shore: string
    trees: string
  }
  reflection: readonly [string, string]
  stone: StonePalette
  clouds: { lit: readonly [string, string]; shade: readonly [string, string]; belt: readonly [string, string] }
  night: { sky: readonly [string, string, string]; cloudLit: string; cloudShade: string; rim: string; line: string }
}

export const DAILY_EDITIONS: readonly DailyEdition[] = [
  {
    name: 'Ember tide',
    clouds: { lit: ['#f7e0d4', '#c8a0a2'], shade: ['#e8c3b8', '#a7798a'], belt: ['#f0d6cf', '#f9e8e0'] },
    night: { sky: ['#0d0814', '#2a1530', '#55304c'], cloudLit: '#7f5c78', cloudShade: '#3a2238', rim: '#ffb48a', line: '#f2c58f' },
    sky: ['#252b43', '#60516b', '#b77876', '#4f7477'],
    dawnSky: ['#9b7d8c', '#c77b74', '#eea16e', '#f4c794'],
    sea: ['#5b7379', '#243a4a'],
    dawnSea: ['#d19485', '#607b7d'],
    moon: { x: 204, y: 0.23, radius: 38, light: '#ffd6aa', body: '#f4c999', shade: '#b87b70' },
    mountains: ['#694e62', '#485062'],
    islands: {
      deep: '#493d4c', leftTop: '#b8a483', rightTop: '#c0a98a',
      leftOffsetX: 56, leftOffsetY: 18, rightOffsetX: -72, rightOffsetY: -10,
    },
    tower: { shadow: '#352f41', deep: '#4b3f4b', top: '#bda88a', shore: '#8d8076', trees: '#483f4e' },
    reflection: ['#d6b5a2', '#f1c28e'],
    stone: {
      top: '#ead5b7', front: '#a68970', side: '#765e5b', joint: '#806b61',
      roughCut: '#5d4c49', roughCutHighlight: '#b8987b',
      activeTop: '#ffe3bc', activeFront: '#cd9870', activeSide: '#99665d', activeJoint: '#b77b60',
    },
  },
  {
    name: 'Frost tide',
    clouds: { lit: ['#f3f7fb', '#b9c9db'], shade: ['#d9e4ef', '#8aa1bb'], belt: ['#e6edf5', '#f6f9fc'] },
    night: { sky: ['#030a16', '#10243c', '#2a4c72'], cloudLit: '#7290b4', cloudShade: '#1f3552', rim: '#d6ecff', line: '#e4eef7' },
    sky: ['#1a2a44', '#3f5f86', '#9fb9d0', '#6f93ae'],
    dawnSky: ['#a9bfd4', '#cdd4e0', '#f0d6c4', '#fbe7d6'],
    sea: ['#5f87a3', '#1b3550'],
    dawnSea: ['#c9cfd8', '#628aa5'],
    moon: { x: 780, y: 0.22, radius: 40, light: '#f4fbff', body: '#eef6fb', shade: '#a9c0d2' },
    mountains: ['#4f6d8f', '#34506f'],
    islands: {
      deep: '#2c4762', leftTop: '#e3eaf0', rightTop: '#e8eef3',
      leftOffsetX: -40, leftOffsetY: 6, rightOffsetX: 44, rightOffsetY: -8,
    },
    tower: { shadow: '#1d3550', deep: '#2c4762', top: '#e8eef3', shore: '#9fb5c6', trees: '#2a4660' },
    reflection: ['#cfe0ec', '#fbe2cc'],
    stone: {
      top: '#f2f6f8', front: '#a9c0cf', side: '#6d8aa1', joint: '#87a0b2',
      roughCut: '#4f6b82', roughCutHighlight: '#b9cbd7',
      activeTop: '#fff6e0', activeFront: '#d8b088', activeSide: '#a07e6a', activeJoint: '#c09878',
    },
  },
  {
    name: 'First light',
    clouds: { lit: ['#eff2e7', '#b3c3b6'], shade: ['#d4ddd0', '#869d93'], belt: ['#e2e8dd', '#f3f5ee'] },
    night: { sky: ['#04100f', '#12302d', '#2c544e'], cloudLit: '#6d9086', cloudShade: '#1e3b37', rim: '#ffd2a2', line: '#f2d9b0' },
    sky: ['#26394c', '#5b7180', '#a6a9a5', '#5d8581'],
    dawnSky: ['#91a3aa', '#c4a797', '#e8ae86', '#f3ca9d'],
    sea: ['#527d80', '#1f4651'],
    dawnSea: ['#c9aa97', '#568184'],
    moon: { x: 300, y: 0.36, radius: 34, light: '#f7d5ad', body: '#f1d3ad', shade: '#bc927e' },
    mountains: ['#627783', '#41616e'],
    islands: {
      deep: '#315363', leftTop: '#a9bcad', rightTop: '#b3c2b1',
      leftOffsetX: -30, leftOffsetY: -4, rightOffsetX: 28, rightOffsetY: 12,
    },
    tower: { shadow: '#234656', deep: '#315765', top: '#b4c5b3', shore: '#789d96', trees: '#315664' },
    reflection: ['#bdd2cf', '#f2caa4'],
    stone: {
      top: '#dce8d9', front: '#7c9f90', side: '#50767a', joint: '#64857e',
      roughCut: '#345c63', roughCutHighlight: '#86a795',
      activeTop: '#fff2ce', activeFront: '#c99e76', activeSide: '#8a6c60', activeJoint: '#ad7e61',
    },
  },
  {
    name: 'Violet hour',
    clouds: { lit: ['#f0e3f2', '#b8a3cd'], shade: ['#d9c4e3', '#8d78ad'], belt: ['#e6d7ea', '#f5ecf6'] },
    night: { sky: ['#0a0718', '#22173f', '#433070'], cloudLit: '#7d6caa', cloudShade: '#2a2250', rim: '#f8b9cb', line: '#f2c58f' },
    sky: ['#231d3d', '#4e3d6b', '#9a7aa6', '#5b6b8a'],
    dawnSky: ['#8a7fa6', '#c48fae', '#eab0a0', '#f6d3b0'],
    sea: ['#5a6688', '#1f2440'],
    dawnSea: ['#c79aac', '#5d6a8c'],
    moon: { x: 740, y: 0.25, radius: 32, light: '#f3e6ff', body: '#ece0f4', shade: '#ad97c2', phase: 0.55 },
    mountains: ['#4d3e64', '#353357'],
    islands: {
      deep: '#332c4c', leftTop: '#83739a', rightTop: '#8b7ba2',
      leftOffsetX: 36, leftOffsetY: 10, rightOffsetX: -48, rightOffsetY: 4,
    },
    tower: { shadow: '#241f3a', deep: '#332c4c', top: '#83739a', shore: '#685c80', trees: '#2f2846' },
    reflection: ['#c9b6d6', '#f4c9b0'],
    stone: {
      top: '#e6dcef', front: '#9f88b4', side: '#6b5a84', joint: '#7f6c96',
      roughCut: '#4b3f62', roughCutHighlight: '#b19fc2',
      activeTop: '#fff0d6', activeFront: '#d9a07a', activeSide: '#a26e66', activeJoint: '#bf8a6c',
    },
  },
  {
    name: 'Salt moon',
    clouds: { lit: ['#f3e2df', '#b9a0b1'], shade: ['#d9c3c9', '#83748f'], belt: ['#efdfe1', '#f6eaea'] },
    night: { sky: ['#03060f', '#0b1030', '#1b1f48'], cloudLit: '#6a6596', cloudShade: '#2a2a52', rim: '#ffcf9e', line: '#e9cfa2' },
    sky: ['#17263a', '#4b526d', '#bb8c8c', '#365f6c'],
    dawnSky: ['#a9909a', '#d18e83', '#e9a678', '#f0c18f'],
    sea: ['#4b7780', '#142e42'],
    dawnSea: ['#cf9c91', '#4a7780'],
    moon: { x: 820, y: 0.27, radius: 42, light: '#f6d9b6', body: '#f1d9ba', shade: '#d1aa99' },
    mountains: ['#53536c', '#344b61'],
    islands: {
      deep: '#294354', leftTop: '#91a89b', rightTop: '#9db19f',
      leftOffsetX: 0, leftOffsetY: 0, rightOffsetX: 0, rightOffsetY: 0,
    },
    tower: { shadow: '#132a3e', deep: '#294354', top: '#9fb29d', shore: '#718f88', trees: '#294657' },
    reflection: ['#a5c5c6', '#efd0a4'],
    stone: {
      top: '#d8e1d5', front: '#71988c', side: '#416a70', joint: '#5d817b',
      roughCut: '#2f5661', roughCutHighlight: '#77978e',
      activeTop: '#fff0c9', activeFront: '#d79d6f', activeSide: '#a86858', activeJoint: '#bb7d5e',
    },
  },
  {
    name: 'Basalt night',
    clouds: { lit: ['#e4e3e4', '#a2a3aa'], shade: ['#c3c2c7', '#6f727d'], belt: ['#d9d8db', '#eceaec'] },
    night: { sky: ['#020306', '#0b0e16', '#1d2230'], cloudLit: '#4c525e', cloudShade: '#151a22', rim: '#f1c58e', line: '#f2c58f' },
    sky: ['#0b0f1a', '#1b2233', '#3a3f55', '#22303d'],
    dawnSky: ['#4a4d63', '#8a6f78', '#d29a78', '#f1c58e'],
    sea: ['#2a3a48', '#070c14'],
    dawnSea: ['#a07d78', '#2f4250'],
    moon: { x: 170, y: 0.2, radius: 46, light: '#fffbe8', body: '#fbf4dc', shade: '#cfc6ac' },
    mountains: ['#232838', '#171c29'],
    islands: {
      deep: '#151a24', leftTop: '#434b55', rightTop: '#4a525c',
      leftOffsetX: 0, leftOffsetY: 10, rightOffsetX: 0, rightOffsetY: -6,
    },
    tower: { shadow: '#0c1018', deep: '#1b212c', top: '#434b55', shore: '#363e48', trees: '#1a202a' },
    reflection: ['#c9c3b0', '#f1c58e'],
    stone: {
      top: '#8a919a', front: '#4a515b', side: '#2c313a', joint: '#3a404a',
      roughCut: '#22262e', roughCutHighlight: '#6f7680',
      activeTop: '#ffe2a4', activeFront: '#e3a35c', activeSide: '#a8683e', activeJoint: '#c7844a',
    },
  },
  {
    name: 'Storm glass',
    clouds: { lit: ['#eaeeeb', '#a9b6b3'], shade: ['#c9d2cf', '#7a8b89'], belt: ['#dde3e0', '#f0f3f1'] },
    night: { sky: ['#04080b', '#131e24', '#2c3d44'], cloudLit: '#6c7d82', cloudShade: '#1c2b31', rim: '#e8eef0', line: '#dfe6e6' },
    sky: ['#1c2328', '#3d4a52', '#7f8b8c', '#4b5c60'],
    dawnSky: ['#8c9796', '#b0aa98', '#dcc28e', '#efd9a8'],
    sea: ['#4a5c62', '#151f25'],
    dawnSea: ['#a8a58e', '#4c5f63'],
    moon: { x: 290, y: 0.3, radius: 26, light: '#e8eef0', body: '#dfe5e6', shade: '#8d999c' },
    mountains: ['#3a454c', '#2a353b'],
    islands: {
      deep: '#26313a', leftTop: '#8f9a93', rightTop: '#98a29a',
      leftOffsetX: -20, leftOffsetY: 14, rightOffsetX: 30, rightOffsetY: 0,
    },
    tower: { shadow: '#1a2229', deep: '#28333b', top: '#959f97', shore: '#6f7b78', trees: '#25313a' },
    reflection: ['#b9c2c2', '#efd9a8'],
    stone: {
      top: '#d3d8d4', front: '#86918e', side: '#566164', joint: '#6b7674',
      roughCut: '#3c464b', roughCutHighlight: '#a2aba6',
      activeTop: '#fff1cf', activeFront: '#c8a26e', activeSide: '#8d7258', activeJoint: '#a98a62',
    },
  },
]

export function blendColor(from: string, to: string, amount: number) {
  const mix = Math.min(1, Math.max(0, amount))
  const channel = (offset: number) => Math.round(
    Number.parseInt(from.slice(offset, offset + 2), 16) * (1 - mix)
    + Number.parseInt(to.slice(offset, offset + 2), 16) * mix,
  )

  return `#${[channel(1), channel(3), channel(5)].map((value) => value.toString(16).padStart(2, '0')).join('')}`
}
