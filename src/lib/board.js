export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export const uid = (prefix = 'bi') =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`

export const STICKY_COLORS = {
  yellow: { top: '#FFF6BC', bottom: '#FFE988', swatch: '#FFE988' },
  pink: { top: '#FFE0EA', bottom: '#FFC2D1', swatch: '#FFC2D1' },
  green: { top: '#DCF1E0', bottom: '#B8E0BF', swatch: '#B8E0BF' },
  blue: { top: '#DCEAF8', bottom: '#B8D2EE', swatch: '#B8D2EE' },
  orange: { top: '#FFE0CB', bottom: '#FFC59E', swatch: '#FFC59E' },
  purple: { top: '#EFD9FF', bottom: '#DCB4FA', swatch: '#DCB4FA' }
}

export const STICKY_ORDER = ['yellow', 'pink', 'green', 'blue', 'orange', 'purple']

export const SHAPE_FILLS = [
  '#FFFFFF',
  '#F2F2F2',
  '#FFE7A8',
  '#D8EFFE',
  '#DDF6E0',
  '#FBD9CE',
  '#EFD8FE',
  '#FFD6E5',
  'transparent'
]

export const SHAPE_STROKES = [
  '#0a0a0a',
  '#5a5a5a',
  '#9a9a9a',
  '#0a84ff',
  '#34c759',
  '#ff9500',
  '#ff3b30',
  '#af52de',
  'transparent'
]

export const TEXT_COLORS = [
  '#0a0a0a',
  '#5a5a5a',
  '#9a9a9a',
  '#0a84ff',
  '#34c759',
  '#ff9500',
  '#ff3b30',
  '#af52de',
  '#ff2d55',
  '#ffd60a',
  '#5ac8fa',
  '#bf5af2'
]

export const FONTS = [
  { label: 'Sans', value: 'inherit' },
  { label: 'Serif', value: '"Iowan Old Style", "Apple Garamond", Georgia, serif' },
  { label: 'Mono', value: 'Menlo, "SF Mono", ui-monospace, SFMono-Regular, monospace' }
]

export const STROKE_WIDTHS = [1, 2, 3, 5, 8]

export const DEFAULT_SIZE = {
  sticky: { width: 180, height: 180 },
  text: { width: 220, height: 44 },
  shape: { width: 180, height: 120 },
  frame: { width: 600, height: 400 },
  image: { width: 260, height: 325 },
  line: { width: 1, height: 1 }
}

export function createItem(type, x, y, extra = {}) {
  const base = { id: uid(type), type, x, y, rotation: 0, ...extra }
  if (type === 'sticky') {
    base.width = extra.width ?? DEFAULT_SIZE.sticky.width
    base.height = extra.height ?? DEFAULT_SIZE.sticky.height
    base.data = { text: '', color: 'yellow', fontSize: 16, ...extra.data }
  } else if (type === 'text') {
    base.width = extra.width ?? DEFAULT_SIZE.text.width
    base.height = extra.height ?? DEFAULT_SIZE.text.height
    base.data = { text: '', fontSize: 18, fontFamily: 'inherit', color: '#0a0a0a', align: 'left', ...extra.data }
  } else if (type === 'shape') {
    base.width = extra.width ?? DEFAULT_SIZE.shape.width
    base.height = extra.height ?? DEFAULT_SIZE.shape.height
    base.data = {
      kind: 'rect',
      text: '',
      fontSize: 14,
      align: 'center',
      fill: 'transparent',
      stroke: 'rgba(0, 0, 0, 0.85)',
      strokeWidth: 1.5,
      ...extra.data
    }
  } else if (type === 'frame') {
    base.width = extra.width ?? DEFAULT_SIZE.frame.width
    base.height = extra.height ?? DEFAULT_SIZE.frame.height
    base.data = { title: extra.title || 'Frame', fill: '#FFFFFF', ...extra.data }
  } else if (type === 'line' || type === 'arrow') {
    base.width = extra.width ?? 200
    base.height = extra.height ?? 0
    base.data = { kind: type, points: extra.points || [], stroke: '#0a0a0a', strokeWidth: 2, ...extra.data }
  } else if (type === 'image') {
    base.width = extra.width ?? DEFAULT_SIZE.image.width
    base.height = extra.height ?? DEFAULT_SIZE.image.height
    base.data = { itemId: '', naturalWidth: 0, naturalHeight: 0, ...extra.data }
  } else {
    base.width = extra.width ?? 100
    base.height = extra.height ?? 100
    base.data = { ...extra.data }
  }
  return base
}

export function itemBounds(item) {
  if (item.type === 'line' || item.type === 'arrow') {
    const pts = item.data?.points || []
    if (!pts.length) return { x: item.x, y: item.y, w: 0, h: 0 }
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const [px, py] of pts) {
      minX = Math.min(minX, px)
      minY = Math.min(minY, py)
      maxX = Math.max(maxX, px)
      maxY = Math.max(maxY, py)
    }
    return { x: item.x + minX, y: item.y + minY, w: maxX - minX, h: maxY - minY }
  }
  return { x: item.x, y: item.y, w: item.width, h: item.height }
}

export function itemsBounds(items) {
  if (!items.length) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const it of items) {
    const b = itemBounds(it)
    minX = Math.min(minX, b.x)
    minY = Math.min(minY, b.y)
    maxX = Math.max(maxX, b.x + b.w)
    maxY = Math.max(maxY, b.y + b.h)
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY }
}

export function rotatePoint(x, y, cx, cy, deg) {
  if (!deg) return [x, y]
  const rad = (deg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const dx = x - cx
  const dy = y - cy
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos]
}

export function pointInItem(item, wx, wy) {
  if (item.type === 'line' || item.type === 'arrow') {
    const pts = item.data?.points || []
    const b = itemBounds(item)
    return wx >= b.x - 8 && wx <= b.x + b.w + 8 && wy >= b.y - 8 && wy <= b.y + b.h + 8 && pts.length > 0
  }
  const cx = item.x + item.width / 2
  const cy = item.y + item.height / 2
  const [lx, ly] = rotatePoint(wx, wy, cx, cy, -(item.rotation || 0))
  return lx >= item.x && lx <= item.x + item.width && ly >= item.y && ly <= item.y + item.height
}

export function rectsIntersect(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)
}

export function frameContains(frame, item) {
  const b = itemBounds(item)
  const cx = b.x + b.w / 2
  const cy = b.y + b.h / 2
  return (
    cx >= frame.x &&
    cx <= frame.x + frame.width &&
    cy >= frame.y &&
    cy <= frame.y + frame.height
  )
}

export function elbowPoints(dx, dy) {
  if (Math.abs(dx) >= Math.abs(dy)) {
    const mx = dx / 2
    return [
      [0, 0],
      [mx, 0],
      [mx, dy],
      [dx, dy]
    ]
  }
  const my = dy / 2
  return [
    [0, 0],
    [0, my],
    [dx, my],
    [dx, dy]
  ]
}
