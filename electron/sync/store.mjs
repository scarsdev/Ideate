import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'

const FILE = 'sync-library.json'

function safeText(value) {
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

const STRING_FIELDS = ['url', 'title', 'text', 'author', 'authorName', 'avatar', 'thumb', 'folder', 'mediaUrl', 'mediaType', 'aiPrompt', 'board', 'boardUrl']

function cleanRow(row) {
  for (const field of STRING_FIELDS) {
    if (typeof row[field] === 'string') row[field] = safeText(row[field])
  }
  return row
}

function cleanCollection(col) {
  return {
    id: safeText(col?.id),
    name: safeText(col?.name).slice(0, 120),
    color: String(col?.color || ''),
    createdAt: Number(col?.createdAt) || Date.now(),
    order: Number(col?.order) || 0,
    itemIds: [],
    cover: String(col?.cover || '')
  }
}

function cleanBoardItem(it) {
  const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d)
  let data = {}
  if (it?.data && typeof it.data === 'object') {
    data = { ...it.data }
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string') data[k] = safeText(v).slice(0, 4000)
    }
  }
  return {
    id: safeText(it?.id),
    type: safeText(it?.type),
    x: num(it?.x),
    y: num(it?.y),
    width: num(it?.width, 100),
    height: num(it?.height, 100),
    rotation: num(it?.rotation),
    z: num(it?.z),
    data
  }
}

function cleanBoard(b) {
  return {
    id: safeText(b?.id),
    name: safeText(b?.name || 'Untitled board').slice(0, 120),
    createdAt: Number(b?.createdAt) || Date.now(),
    updatedAt: Number(b?.updatedAt) || Date.now(),
    order: Number(b?.order) || 0,
    items: Array.isArray(b?.items) ? b.items.map(cleanBoardItem) : []
  }
}

export const SYNC_SOURCES = ['bookmark', 'instagram_save', 'x_bookmark', 'pinterest_save']

export class SyncStore {
  constructor(dir) {
    this.dir = dir
    this.file = path.join(dir, FILE)
    this.rows = []
    this.collections = []
    this.boards = []
    this.pinBoards = { order: [], names: {}, hidden: [] }
    this.state = {}
    this.prefs = { disabled: [] }
    this.keys = new Map()
  }

  async load() {
    try {
      const raw = JSON.parse(await fs.readFile(this.file, 'utf8'))
      this.rows = Array.isArray(raw.rows) ? raw.rows.map(cleanRow) : []
      this.collections = Array.isArray(raw.collections) ? raw.collections.map(cleanCollection) : []
      this.boards = Array.isArray(raw.boards) ? raw.boards.map(cleanBoard) : []
      this.state = raw.state && typeof raw.state === 'object' ? raw.state : {}
      this.pinBoards = {
        order: [],
        names: {},
        hidden: [],
        ...(raw.pinBoards && typeof raw.pinBoards === 'object' ? raw.pinBoards : {})
      }
      this.prefs = { disabled: [], ...(raw.prefs || {}) }
    } catch {
      this.rows = []
      this.collections = []
      this.boards = []
      this.pinBoards = { order: [], names: {}, hidden: [] }
      this.state = {}
      this.prefs = { disabled: [] }
    }
    this.reindex()
    return this
  }

  reindex() {
    this.keys = new Map(this.rows.map((r) => [r.key, r]))
  }

  async persist() {
    this.writing = (this.writing || Promise.resolve())
      .catch(() => {})
      .then(() => this.writeNow())
    return this.writing
  }

  async writeNow() {
    await fs.mkdir(this.dir, { recursive: true })
    this.writeSeq = (this.writeSeq || 0) + 1
    const tmp = `${this.file}.${process.pid}.${this.writeSeq}.tmp`
    await fs.writeFile(
      tmp,
      JSON.stringify(
        {
          version: 1,
          rows: this.rows,
          collections: this.collections,
          boards: this.boards,
          pinBoards: this.pinBoards,
          state: this.state,
          prefs: this.prefs
        },
        null,
        2
      )
    )
    await fs.rename(tmp, this.file)
  }

  isEnabled(source) {
    return !this.prefs.disabled.includes(source)
  }

  setEnabled(source, enabled) {
    const set = new Set(this.prefs.disabled)
    if (enabled) set.delete(source)
    else set.add(source)
    this.prefs.disabled = [...set]
  }

  insert(payloads = []) {
    const inserted = []
    const duplicates = []
    const enriched = []
    const rejected = []

    for (const payload of payloads) {
      const source = String(payload?.source || '').trim()
      const externalId = String(payload?.externalId ?? payload?.external_id ?? '').trim()

      if (!source || !externalId) {
        rejected.push({ reason: 'missing-key', payload })
        continue
      }
      if (!this.isEnabled(source)) {
        rejected.push({ reason: 'source-disabled', source, externalId })
        continue
      }

      const key = `${source}:${externalId}`
      if (this.keys.has(key)) {
        const row = this.keys.get(key)
        let changed = false
        const upgrades = {
          thumb: payload.thumb,
          mediaUrl: payload.mediaUrl,
          mediaType: payload.mediaType,
          avatar: payload.avatar,
          authorName: payload.authorName,
          text: payload.text,
          board: payload.board,
          boardUrl: payload.boardUrl
        }
        for (const [field, raw] of Object.entries(upgrades)) {
          const value = String(raw || '')
          if (!value || row[field] === value) continue
          if (field === 'thumb' && row.thumb) continue
          if ((field === 'board' || field === 'boardUrl') && row[field]) {
            const generic = String(row.boardUrl || '')
              .split('/')
              .some((seg) => seg.startsWith('_'))
            const dirty = /,\s*\d+\s*Pins?\b/.test(String(row.board || ''))
            if (!generic && !dirty) continue
          }
          if (field === 'text' && row.text && row.text.length >= value.length) continue
          row[field] = STRING_FIELDS.includes(field) ? safeText(value) : value
          changed = true
        }
        if (
          Array.isArray(payload.images) &&
          payload.images.length &&
          (!Array.isArray(row.images) || payload.images.length > row.images.length)
        ) {
          row.images = payload.images.filter((u) => typeof u === 'string' && /^https?:/.test(u)).slice(0, 10)
          if (!row.thumb && row.images.length) row.thumb = row.images[0]
          changed = true
        }
        duplicates.push(row)
        if (changed) enriched.push(row)
        continue
      }

      const row = cleanRow({
        key,
        id: `sync_${source}_${externalId.replace(/[^\w.-]/g, '_')}`,
        source,
        externalId: safeText(externalId),
        url: String(payload.url || ''),
        title: String(payload.title || '').slice(0, 300),
        text: String(payload.text || '').slice(0, 4000),
        author: String(payload.author || '').slice(0, 120),
        authorName: String(payload.authorName || '').slice(0, 120),
        avatar: String(payload.avatar || ''),
        thumb: String(payload.thumb || ''),
        mediaUrl: String(payload.mediaUrl || ''),
        mediaType: String(payload.mediaType || ''),
        images: Array.isArray(payload.images)
          ? payload.images.filter((u) => typeof u === 'string' && /^https?:/.test(u)).slice(0, 10)
          : [],
        folder: String(payload.folder || ''),
        board: String(payload.board || '').slice(0, 200),
        boardUrl: String(payload.boardUrl || ''),
        savedAt: Number(payload.savedAt) || Date.now(),
        status: 'inbox',
        collectionId: null,
        receivedAt: Date.now()
      })

      this.rows.unshift(row)
      this.keys.set(key, row)
      inserted.push(row)

      const st = (this.state[source] ||= { initialBackfillDone: false })
      st.lastSyncedAt = Date.now()
    }

    return { inserted, duplicates, enriched, rejected }
  }

  setPinBoards(patch = {}) {
    const cur = this.pinBoards || { order: [], names: {}, hidden: [] }
    const next = { ...cur }
    if (Array.isArray(patch.order)) next.order = patch.order.map(String)
    if (patch.names && typeof patch.names === 'object') {
      next.names = { ...(cur.names || {}), ...patch.names }
    }
    let hidden = Array.isArray(cur.hidden) ? [...cur.hidden] : []
    if (Array.isArray(patch.hidden)) hidden = [...new Set([...hidden, ...patch.hidden.map(String)])]
    if (Array.isArray(patch.unhide)) hidden = hidden.filter((k) => !patch.unhide.includes(k))
    next.hidden = hidden
    this.pinBoards = next
    return next
  }

  setState(source, patch = {}) {
    const st = (this.state[source] ||= { initialBackfillDone: false })
    if (patch.lastSyncedAt) st.lastSyncedAt = Number(patch.lastSyncedAt)
    if (patch.initialBackfillDone != null) st.initialBackfillDone = !!patch.initialBackfillDone
    st.updatedAt = Date.now()
    return st
  }

  setCollections(list) {
    this.collections = (Array.isArray(list) ? list : []).map(cleanCollection)
    return this.collections
  }

  setBoards(list) {
    this.boards = (Array.isArray(list) ? list : []).map(cleanBoard)
    return this.boards
  }

  createBoard({ name = 'Untitled board' } = {}) {
    const now = Date.now()
    const board = {
      id: `board_${crypto.randomUUID()}`,
      name: String(name || 'Untitled board').slice(0, 120),
      createdAt: now,
      updatedAt: now,
      order: this.boards.length,
      items: []
    }
    this.boards.push(board)
    return board
  }

  renameBoard(id, name) {
    const board = this.boards.find((b) => b.id === id)
    if (!board) return null
    board.name = safeText(name || board.name).slice(0, 120)
    board.updatedAt = Date.now()
    return board
  }

  deleteBoard(id) {
    const before = this.boards.length
    this.boards = this.boards.filter((b) => b.id !== id)
    return this.boards.length !== before
  }

  saveBoard(id, items) {
    const board = this.boards.find((b) => b.id === id)
    if (!board) return null
    if (Array.isArray(items)) board.items = items.map(cleanBoardItem)
    board.updatedAt = Date.now()
    return board
  }

  reorderBoards(ids = []) {
    const byId = new Map(this.boards.map((b) => [b.id, b]))
    const next = []
    for (const id of ids) {
      const board = byId.get(id)
      if (board) {
        next.push(board)
        byId.delete(id)
      }
    }
    for (const board of byId.values()) next.push(board)
    next.forEach((b, i) => (b.order = i))
    this.boards = next
    return this.boards
  }

  annotate(id, patch = {}) {
    const row = this.rows.find((r) => r.id === id)
    if (!row) return null
    for (const key of ['title', 'text', 'aiPrompt', 'authorName', 'board', 'boardUrl']) {
      if (typeof patch[key] === 'string') row[key] = safeText(patch[key]).slice(0, 4000)
    }
    if (Array.isArray(patch.aiTags)) {
      row.aiTags = patch.aiTags.map((t) => safeText(String(t)).slice(0, 40)).slice(0, 8)
    }
    if (typeof patch.aiTagged === 'boolean') row.aiTagged = patch.aiTagged
    if (typeof patch.jevTagged === 'boolean') row.jevTagged = patch.jevTagged
    return row
  }

  annotateMany(entries = []) {
    const updated = []
    for (const [id, patch] of entries) {
      const row = this.annotate(id, patch)
      if (row) updated.push(row)
    }
    return updated
  }

  categorize(id, collectionId) {
    const row = this.rows.find((r) => r.id === id)
    if (!row) return null
    row.status = 'categorized'
    row.collectionId = collectionId || row.collectionId || null
    row.categorizedAt = Date.now()
    return row
  }

  categorizeMany(entries = []) {
    const updated = []
    for (const entry of entries) {
      const id = Array.isArray(entry) ? entry[0] : entry?.id
      const collectionId = Array.isArray(entry) ? entry[1] : entry?.collectionId
      const row = this.categorize(id, collectionId)
      if (row) updated.push(row)
    }
    return updated
  }

  remove(id) {
    const before = this.rows.length
    this.rows = this.rows.filter((r) => r.id !== id)
    this.reindex()
    return this.rows.length !== before
  }

  clear() {
    this.rows = []
    this.collections = []
    this.boards = []
    this.state = {}
    this.reindex()
  }

  summary() {
    const sources = {}
    for (const row of this.rows) {
      const s = (sources[row.source] ||= {
        total: 0,
        inbox: 0,
        categorized: 0,
        lastSyncedAt: null,
        initialBackfillDone: false,
        enabled: this.isEnabled(row.source)
      })
      s.total++
      if (row.status === 'inbox') s.inbox++
      else s.categorized++
    }
    for (const source of Object.keys(this.state)) {
      const s = (sources[source] ||= {
        total: 0,
        inbox: 0,
        categorized: 0,
        lastSyncedAt: null,
        initialBackfillDone: false,
        enabled: this.isEnabled(source)
      })
      s.lastSyncedAt = this.state[source].lastSyncedAt || null
      s.initialBackfillDone = !!this.state[source].initialBackfillDone
    }
    return {
      total: this.rows.length,
      inbox: this.rows.filter((r) => r.status === 'inbox').length,
      sources
    }
  }

  snapshot() {
    return {
      rows: this.rows,
      collections: this.collections,
      boards: this.boards,
      pinBoards: this.pinBoards,
      state: this.state,
      summary: this.summary()
    }
  }
}
