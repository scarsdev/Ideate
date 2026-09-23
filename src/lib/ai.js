const STOP = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'was', 'were',
  'have', 'has', 'had', 'not', 'but', 'what', 'when', 'where', 'which', 'who', 'how', 'why',
  'all', 'any', 'can', 'will', 'just', 'like', 'get', 'got', 'out', 'one', 'two', 'new', 'now',
  'use', 'using', 'make', 'made', 'into', 'than', 'then', 'them', 'they', 'their', 'there',
  'here', 'about', 'over', 'under', 'more', 'most', 'some', 'such', 'only', 'also', 'very',
  'via', 'com', 'www', 'https', 'http', 't.co', 'its', "it's", 'our', 'his', 'her', 'she',
  'him', 'did', 'does', 'been', 'being', 'would', 'could', 'should', 'these', 'those', 'than'
])

export function keywords(text, limit = 4) {
  const words = String(text || '').toLowerCase().match(/[a-z][a-z0-9'-]{2,}/g) || []
  const freq = new Map()
  for (const w of words) {
    if (STOP.has(w) || w.length < 4) continue
    freq.set(w, (freq.get(w) || 0) + 1)
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([w]) => w)
}

export function autoTags(item) {
  const src =
    item?.syncSource === 'instagram_save'
      ? 'instagram'
      : item?.syncSource === 'x_bookmark'
        ? 'x'
        : item?.syncSource === 'bookmark'
          ? 'bookmark'
          : ''
  const tags = keywords(`${item?.title || ''} ${item?.text || ''}`, 3)
  return [...new Set([...tags, src].filter(Boolean))]
}

export function autoTitle(item) {
  const line = String(item?.title || item?.text || '').split(/\n/)[0].trim()
  if (!line) return ''
  const first = line.split(/(?<=[.!?])\s/)[0]
  return first.length > 72 ? `${first.slice(0, 69).trimEnd()}\u2026` : first
}

export function buildPrompt(item) {
  const kw = keywords(`${item?.title || ''} ${item?.text || ''}`, 5)
  const subject = String(item?.title || autoTitle(item) || 'a saved reference image')
    .replace(/\s+/g, ' ')
    .trim()
  const handle = String(item?.author || '').replace(/^@/, '')
  const byline = handle ? `, inspired by @${handle}` : ''
  const palette = item?.syncSource === 'instagram_save' ? 'warm editorial palette' : 'muted contemporary palette'
  return `\u201c${subject}\u201d${byline}. Keywords: ${kw.join(', ') || 'reference'}. High detail, balanced composition, generous negative space, soft studio lighting, ${palette}.`
}

export function annotatePatch(item, { tags = true, title = true } = {}) {
  const patch = { aiTagged: true }
  if (tags) {
    const t = autoTags(item)
    if (t.length) patch.aiTags = t
  }
  if (title && !String(item.title || '').trim()) {
    const t = autoTitle(item)
    if (t) patch.title = t
  }
  return patch
}

export function tagCandidates(item, limit = 8) {
  return keywords(`${item?.title || ''} ${item?.text || ''}`, limit)
}

export function nameCandidates(item) {
  const out = []
  const push = (value) => {
    const t = String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 64)
    if (t.length >= 3 && !out.includes(t)) out.push(t)
  }
  const existing = String(item?.title || '').trim()
  if (existing) push(existing)
  const text = String(item?.text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (text) {
    push(text.split(/(?<=[.!?])\s/)[0])
    const words = tagCandidates(item, 3)
    if (words.length >= 2) {
      push(words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' '))
    }
  }
  return out
}
