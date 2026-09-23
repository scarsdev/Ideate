export function timeAgo(ts) {
  const diff = Date.now() - ts
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${Math.max(1, mins)}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.round(months / 12)}y ago`
}

export function safeText(value) {
  const s = String(value ?? '')
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = s.charCodeAt(i + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += s[i] + s[i + 1]
        i++
      } else {
        out += '\ufffd'
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      out += '\ufffd'
    } else {
      out += s[i]
    }
  }
  return out
}

export function truncate(value, max) {
  const chars = Array.from(String(value ?? ''))
  return safeText(chars.length <= max ? chars.join('') : chars.slice(0, max).join(''))
}

export function domainOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export const SOURCE_LABEL = {
  'x.com': 'X',
  'youtube.com': 'YouTube',
  'dribbble.com': 'Dribbble',
  'medium.com': 'Medium',
  'github.com': 'GitHub',
  'are.na': 'Are.na',
  'instagram.com': 'Instagram',
  'tiktok.com': 'TikTok'
}

export function sourceLabel(source) {
  if (SOURCE_LABEL[source]) return SOURCE_LABEL[source]
  const name = String(source || '').split('.')[0]
  if (!name || name === 'link') return 'link'
  return name.charAt(0).toUpperCase() + name.slice(1)
}

export function itemUrl(item) {
  if (item?.url) return item.url
  if (item?.syncSource === 'x_bookmark' && item.externalId) {
    return `https://x.com/i/status/${item.externalId}`
  }
  return ''
}

export async function toPngDataUrl(src) {
  const img = new Image()
  img.src = src
  if (img.decode) await img.decode()
  else await new Promise((res, rej) => ((img.onload = res), (img.onerror = rej)))
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || 480
  canvas.height = img.naturalHeight || 480
  canvas.getContext('2d').drawImage(img, 0, 0)
  return canvas.toDataURL('image/png')
}

function dataUrlToBlob(dataUrl) {
  const [head, b64] = dataUrl.split(',')
  const mime = head.match(/:(.*?);/)?.[1] || 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

export async function copyImageToClipboard(src) {
  const png = await toPngDataUrl(src)
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': dataUrlToBlob(png) })])
}
