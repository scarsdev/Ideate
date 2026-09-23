const KEY = 'gather.settings'

const DAY = 86400000

export const TRASH_RETENTION = [
  { value: 'never', label: 'Never' },
  { value: '24h', label: 'After 24 hours' },
  { value: '7d', label: 'After 7 days' },
  { value: '30d', label: 'After 30 days' }
]

export const DEFAULT_SETTINGS = {
  theme: 'light',
  signedIn: false,
  aiAutoName: false,
  aiAutoTag: false,
  aiPrompts: true,
  aiVisualSearch: false,
  aiEngine: 'auto',
  captureMode: 'region',
  syncX: true,
  syncInstagram: true,
  syncCosmos: false,
  syncBookmarks: true,
  autoUpdate: true,
  keepOriginals: false,
  autoEmptyTrash: 'never',
  captureShortcut: { meta: true, shift: true, alt: false, ctrl: false, key: 'S' },
  dropFolder: '',
  libraries: [{ id: 'lib_1', name: 'Library', saves: null }],
  activeLibrary: 'lib_1',
  snapshots: [
    { id: 'snap_3', at: Date.now() - DAY, size: '254.2 MB' },
    { id: 'snap_2', at: Date.now() - DAY * 2, size: '251.8 MB' },
    { id: 'snap_1', at: Date.now() - DAY * 3, size: '249.4 MB' }
  ],
  reclaimed: null
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw)
    const merged = { ...DEFAULT_SETTINGS, ...parsed }
    if (!Array.isArray(merged.libraries) || !merged.libraries.length) {
      merged.libraries = [{ ...DEFAULT_SETTINGS.libraries[0] }]
    }
    if (!merged.libraries.some((l) => l.id === merged.activeLibrary)) {
      merged.activeLibrary = merged.libraries[0].id
    }
    if (!Array.isArray(merged.snapshots)) merged.snapshots = [...DEFAULT_SETTINGS.snapshots]
    merged.captureShortcut = { ...DEFAULT_SETTINGS.captureShortcut, ...parsed.captureShortcut }
    return merged
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

export function shortcutKeys(sc) {
  if (!sc) return []
  const out = []
  if (sc.meta) out.push('\u2318')
  if (sc.shift) out.push('\u21e7')
  if (sc.alt) out.push('\u2325')
  if (sc.ctrl) out.push('\u2303')
  if (sc.key) out.push(sc.key.length === 1 ? sc.key.toUpperCase() : sc.key)
  return out
}

export function formatMB(mb) {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  if (mb >= 10) return `${Math.round(mb)} MB`
  return `${mb.toFixed(1)} MB`
}

export function libraryStats(items) {
  let images = 0
  let thumbs = 0
  for (const item of items) {
    const n = parseInt(String(item.id).replace(/\D+/g, ''), 10) || 0
    images += 0.85 + (n % 9) * 0.31
    thumbs += 0.042
  }
  return { images, thumbs, total: images + thumbs }
}

export function tagStats(items) {
  const m = new Map()
  for (const item of items) {
    for (const t of item.tags || []) m.set(t, (m.get(t) || 0) + 1)
  }
  return [...m.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function formatSnapshotDate(at) {
  const d = new Date(at)
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return `${date} \u00b7 ${time}`
}
