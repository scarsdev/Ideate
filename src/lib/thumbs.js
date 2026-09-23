import { safeText, truncate } from './format.js'

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rng(seed) {
  return mulberry32(typeof seed === 'string' ? hash(seed) : seed)
}

export function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const PALETTES = [
  ['#0b1220', '#1e293b', ['#38bdf8', '#818cf8', '#f472b6', '#22d3ee']],
  ['#1a0b2e', '#3b0764', ['#c084fc', '#f0abfc', '#7c3aed', '#fca5a5']],
  ['#f8fafc', '#e2e8f0', ['#0ea5e9', '#6366f1', '#0f172a', '#f97316']],
  ['#0f0f0f', '#1c1c1c', ['#f59e0b', '#ef4444', '#fbbf24', '#dc2626']],
  ['#042f2e', '#064e3b', ['#34d399', '#a7f3d0', '#facc15', '#fb7185']],
  ['#450a0a', '#7f1d1d', ['#fca5a5', '#f87171', '#fbbf24', '#fde68a']],
  ['#0c4a6e', '#075985', ['#7dd3fc', '#e0f2fe', '#38bdf8', '#f472b6']],
  ['#f5f5f4', '#e7e5e4', ['#292524', '#78716c', '#f59e0b', '#0ea5e9']],
  ['#18181b', '#27272a', ['#a1a1aa', '#f4f4f5', '#71717a', '#e4e4e7']],
  ['#3b0764', '#5b21b6', ['#ddd6fe', '#a78bfa', '#f472b6', '#fb923c']],
  ['#052e16', '#14532d', ['#86efac', '#4ade80', '#facc15', '#22d3ee']],
  ['#1e1b4b', '#312e81', ['#a5b4fc', '#818cf8', '#f0abfc', '#67e8f9']],
  ['#431407', '#7c2d12', ['#fdba74', '#fb923c', '#fef3c7', '#f87171']],
  ['#0b1120', '#111827', ['#60a5fa', '#34d399', '#fbbf24', '#f472b6']]
]

const WORDS = [
  'FIREFLIES', 'HALO', 'ATLANTIS', 'PEPTIDES', 'EXPOSED', 'SWORDSMAN',
  'ACCESS', 'HUMAN', 'POTENTIAL', 'VISION', 'MODEL', 'SIGNAL', 'WAVE',
  'CANCEL', 'HIGGSFIELD', 'LATENT', 'SPACE', 'FUTURE', 'DESIGN', 'SYSTEM'
]

function pick(r, arr) {
  return arr[Math.floor(r() * arr.length)]
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function makeThumb(seed, ratio = 1, label = '', kind = 'photo') {
  const r = rng(seed)
  label = safeText(label)
  const [c1, c2, accents] = pick(r, PALETTES)
  const W = 480
  const H = Math.max(160, Math.round(W / ratio))
  const id = Math.floor(r() * 1e6)

  const blobs = Array.from({ length: 3 + Math.floor(r() * 3) }, () => {
    const cx = Math.round(r() * W)
    const cy = Math.round(r() * H)
    const rr = Math.round((0.18 + r() * 0.5) * W)
    const fill = pick(r, accents)
    const op = (0.28 + r() * 0.5).toFixed(2)
    return `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="${fill}" opacity="${op}"/>`
  }).join('')

  let art = ''
  const dark = isDark(c1)
  if (kind === 'poster' || kind === 'text') {
    const word = esc(label || pick(r, WORDS)).toUpperCase()
    const fs = Math.max(16, Math.min((W * 0.86) / (word.length * 0.66), H * 0.17))
    const est = word.length * 0.66 * fs
    const fit =
      est > W * 0.88
        ? ` textLength="${Math.round(W * 0.88)}" lengthAdjust="spacingAndGlyphs"`
        : ''
    art = `
      <line x1="${W * 0.2}" y1="${H * 0.28}" x2="${W * 0.8}" y2="${H * 0.28}" stroke="${pick(r, accents)}" stroke-width="3"/>
      <text x="50%" y="${H * 0.36}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="${Math.round(fs * 0.34)}" letter-spacing="6" fill="#ffffff" opacity="0.85">${truncate(word, 9)}</text>
      <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle"${fit}
        font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="${Math.round(fs)}" letter-spacing="1"
        fill="#ffffff">${word}</text>`
  } else if (kind === 'ui') {
    const px = W * 0.12
    const pw = W * 0.76
    art = `
      <rect x="${px}" y="${H * 0.14}" width="${pw}" height="${H * 0.72}" rx="14" fill="#ffffff" opacity="0.94"/>
      <rect x="${px + 16}" y="${H * 0.14 + 16}" width="${pw * 0.4}" height="10" rx="5" fill="#cbd5e1"/>
      <rect x="${px + 16}" y="${H * 0.14 + 38}" width="${pw * 0.62}" height="8" rx="4" fill="#e2e8f0"/>
      <rect x="${px + 16}" y="${H * 0.14 + 54}" width="${pw * 0.52}" height="8" rx="4" fill="#e2e8f0"/>
      <rect x="${px + 16}" y="${H * 0.58}" width="${pw - 32}" height="${H * 0.2}" rx="12" fill="${pick(r, accents)}" opacity="0.85"/>`
  } else if (kind === 'chart') {
    const bars = Array.from({ length: 7 }, (_, i) => {
      const bh = (0.15 + r() * 0.55) * H
      return `<rect x="${W * 0.12 + i * (W * 0.11)}" y="${H * 0.82 - bh}" width="${W * 0.07}" height="${bh}" rx="6" fill="${pick(r, accents)}"/>`
    }).join('')
    art = `<rect x="0" y="${H * 0.72}" width="${W}" height="${H * 0.28}" fill="#ffffff" opacity="0.08"/>${bars}`
    art = `<rect x="${W * 0.1}" y="${H * 0.1}" width="${W * 0.8}" height="${H * 0.8}" rx="18" fill="#ffffff" opacity="0.9"/>${bars
      .replaceAll(`fill="${accents[0]}"`, 'fill="#0ea5e9"')
      .replaceAll(`fill="${accents[1]}"`, 'fill="#6366f1"')
      .replaceAll(`fill="${accents[2]}"`, 'fill="#f472b6"')
      .replaceAll(`fill="${accents[3]}"`, 'fill="#22c55e"')}`
  } else {
    const grid = Array.from({ length: 5 }, (_, i) => {
      const y = (H / 5) * (i + 1)
      return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#ffffff" stroke-width="1" opacity="0.06"/>`
    }).join('')
    art = grid
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${c1}"/>
        <stop offset="100%" stop-color="${c2}"/>
      </linearGradient>
      <filter id="b${id}" x="-40%" y="-40%" width="180%" height="180%">
        <feGaussianBlur stdDeviation="${Math.round(W * 0.06)}"/>
      </filter>
      <radialGradient id="v${id}" cx="50%" cy="42%" r="72%">
        <stop offset="55%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000" stop-opacity="${dark ? 0.5 : 0.22}"/>
      </radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g${id})"/>
    <g filter="url(#b${id})">${blobs}</g>
    <rect width="${W}" height="${H}" fill="url(#v${id})"/>
    ${art}
  </svg>`

  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function isDark(hex) {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55
}

export function paletteFrom(seed) {
  const r = rng(seed)
  const [, , accents] = pick(r, PALETTES)
  return accents
}
