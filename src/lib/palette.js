export async function extractPalette(src, count = 7) {
  if (!src) return null
  try {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.referrerPolicy = 'no-referrer'
    img.src = src
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) return null

    const size = 32
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, size, size)
    const { data } = ctx.getImageData(0, 0, size, size)

    const buckets = new Map()
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 200) continue
      const key = `${data[i] >> 5}-${data[i + 1] >> 5}-${data[i + 2] >> 5}`
      const bucket = buckets.get(key) || { r: 0, g: 0, b: 0, n: 0 }
      bucket.r += data[i]
      bucket.g += data[i + 1]
      bucket.b += data[i + 2]
      bucket.n += 1
      buckets.set(key, bucket)
    }

    const colors = [...buckets.values()]
      .map((b) => ({ r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n), n: b.n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, count)
      .map((c) => ({ r: c.r, g: c.g, b: c.b }))

    return colors.length ? colors : null
  } catch {
    return null
  }
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))

const scale = (c, amount) => ({ r: clamp(c.r * amount), g: clamp(c.g * amount), b: clamp(c.b * amount) })

const mix = (a, b, t) => ({
  r: clamp(a.r + (b.r - a.r) * t),
  g: clamp(a.g + (b.g - a.g) * t),
  b: clamp(a.b + (b.b - a.b) * t)
})

export const css = (c) => `rgb(${c.r} ${c.g} ${c.b})`

export function shellTheme(palette, dark) {
  if (!palette?.length) return null
  const base = palette[0]
  const second = palette[1] || palette[0]
  const third = palette[2] || second

  const deep = dark ? scale(base, 0.28) : scale(base, 0.52)
  const mid = dark ? scale(second, 0.2) : scale(second, 0.42)
  const floor = dark
    ? mix(scale(third, 0.12), { r: 8, g: 8, b: 10 }, 0.55)
    : mix(scale(third, 0.24), { r: 12, g: 12, b: 14 }, 0.4)

  return { '--shell-1': css(deep), '--shell-2': css(mid), '--shell-3': css(floor) }
}
