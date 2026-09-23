import { domainOf, safeText, truncate } from './format.js'
import { makeThumb } from './thumbs.js'

export const SYNC_SOURCE_LABEL = {
  bookmark: 'Browser bookmarks',
  instagram_save: 'Instagram saves',
  x_bookmark: 'X bookmarks',
  pinterest_save: 'Pinterest saves',
  gather_local: 'Local images',
  screenshot: 'Screenshots'
}

const SOURCE_DOMAIN = {
  instagram_save: 'instagram.com',
  x_bookmark: 'x.com',
  pinterest_save: 'pinterest.com',
  gather_local: 'local',
  screenshot: 'screenshot'
}

const SOURCE_KIND = {
  bookmark: 'ui',
  instagram_save: 'photo',
  x_bookmark: 'text',
  pinterest_save: 'photo',
  gather_local: 'photo',
  screenshot: 'photo'
}

export function syncedRowToItem(row) {
  const domain = SOURCE_DOMAIN[row.source] || (row.url ? domainOf(row.url) : '')
  const kind = SOURCE_KIND[row.source] || 'photo'
  const title = safeText(row.title || truncate(row.text || '', 90) || row.url || 'Untitled save')
  const word = title.split(' ')[0] || 'SAVE'
  const hasImage = !!row.thumb
  return {
    id: row.id,
    type: row.mediaType === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(row.thumb) ? 'video' : 'image',
    kind,
    ratio: 1,
    collectionId: row.collectionId || null,
    title,
    text: safeText(row.text || ''),
    author: safeText(row.author || ''),
    authorName: safeText(row.authorName || ''),
    avatar: safeText(row.avatar || ''),
    source: domain || 'link',
    handle: row.author || row.folder || '',
    duration: null,
    createdAt: row.savedAt || row.receivedAt || Date.now(),
    addedAt: row.receivedAt || row.savedAt || Date.now(),
    saved: true,
    unsorted: (row.status || 'inbox') === 'inbox',
    status: row.status || 'inbox',
    externalId: row.externalId,
    syncSource: row.source,
    folder: row.folder,
    board: safeText(row.board || ''),
    boardUrl: row.boardUrl || '',
    url: row.url,
    tags: ['bookmark', ...(Array.isArray(row.aiTags) ? row.aiTags : [])],
    autoTag: true,
    aiPrompt: safeText(row.aiPrompt || ''),
    aiTagged: !!row.aiTagged,
    textCard: !hasImage,
    video: safeText(row.mediaUrl || ''),
    thumb: row.thumb || '',
    thumbTall: row.thumb || '',
    images: Array.isArray(row.images)
      ? row.images.filter((u) => typeof u === 'string' && /^https?:/.test(u)).slice(0, 10)
      : [],
    synced: true
  }
}

export function mergeSyncedItems(prev, rows) {
  const mapped = new Map(rows.map((r) => [r.id, syncedRowToItem(r)]))
  let changed = false
  const next = prev.map((item) => {
    const replacement = mapped.get(item.id)
    if (!replacement) return item
    changed = true
    mapped.delete(item.id)
    return replacement
  })
  const added = [...mapped.values()]
  return added.length || changed ? [...added, ...next] : prev
}
