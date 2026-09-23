import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { SyncStore } from '../electron/sync/store.mjs'
import { makeThumb } from '../src/lib/thumbs.js'

const HOME = os.homedir()
const GOS_DB =
  process.env.GATHEROS_DB ||
  path.join(HOME, 'Library/Application Support/GatherOS/libraries/library_default/moodmark.db')
const STORE_DIR = path.join(HOME, 'Library/Application Support/gatheros-clone')
const STORE_FILE = path.join(STORE_DIR, 'sync-library.json')

const tweetIdOf = (url) => {
  const m = String(url || '').match(/\/status\/(\d+)/)
  return m ? m[1] : ''
}

function sql(query) {
  const out = execFileSync('sqlite3', ['-json', `file:${GOS_DB}?mode=ro`, query], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
  return out.trim() ? JSON.parse(out) : []
}

async function main() {
  if (!fs.existsSync(GOS_DB)) throw new Error(`GatherOS database not found: ${GOS_DB}`)

  const gosCollections = sql(
    'SELECT id, name, color, order_index, created_at FROM collections ORDER BY order_index'
  )
  const memberships = sql(`
    SELECT ci.collection_id AS cid, ci.save_id AS sid, ci.added_at AS added,
           s.source AS source, s.source_url AS url
    FROM collection_items ci
    JOIN saves s ON s.id = ci.save_id
    JOIN collections c ON c.id = ci.collection_id
    WHERE s.deleted_at IS NULL
    ORDER BY c.order_index, ci.added_at
  `)

  const store = await new SyncStore(STORE_DIR).load()
  const byExternalId = new Map(store.rows.map((r) => [String(r.externalId), r]))

  const stats = new Map(gosCollections.map((c) => [c.id, { name: c.name, total: 0, matched: 0 }]))
  const unmatched = {}
  let assigned = 0
  let multi = 0
  let alreadyAssigned = 0

  for (const m of memberships) {
    const st = stats.get(m.cid)
    if (st) st.total++

    const row = byExternalId.get(tweetIdOf(m.url))
    if (!row) {
      const src = m.source || 'unknown'
      unmatched[src] = (unmatched[src] || 0) + 1
      continue
    }

    if (row.collectionId) {
      if (row.collectionId === m.cid) alreadyAssigned++
      else multi++
      continue
    }

    row.collectionId = m.cid
    row.status = 'categorized'
    row.categorizedAt = Number(m.added) || Date.now()
    assigned++
    if (st) st.matched++
  }

  const collections = gosCollections.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color || '',
    createdAt: Number(c.created_at) || Date.now(),
    order: Number(c.order_index) || 0,
    itemIds: [],
    cover: makeThumb(`cover-${c.name}`, 1.6, c.name, 'photo')
  }))

  // --- boards ---
  const boards = sql('SELECT id, name, created_at, updated_at, order_index FROM boards ORDER BY order_index')
  let boardCount = 0
  if (boards.length) {
    const boardItems = sql(
      'SELECT id, board_id, type, x, y, width, height, rotation, z_index, data FROM board_items ORDER BY z_index'
    )
    const saveRows = sql('SELECT id, file_path, thumb_path, kind, title, source_url FROM saves WHERE deleted_at IS NULL')
    const savesById = new Map(saveRows.map((r) => [r.id, r]))
    const localPayloads = []
    const itemsByBoard = new Map()

    for (const bi of boardItems) {
      let data = {}
      try {
        data = JSON.parse(bi.data || '{}')
      } catch {
        data = {}
      }
      if (bi.type === 'image' && data.saveId) {
        const save = savesById.get(data.saveId)
        let ourId = null
        if (save) {
          const tweetId = tweetIdOf(save.source_url)
          const row = tweetId ? byExternalId.get(tweetId) : null
          if (row) {
            ourId = row.id
          } else {
            const file =
              (save.thumb_path && fs.existsSync(save.thumb_path) && save.thumb_path) ||
              (save.file_path && fs.existsSync(save.file_path) && save.file_path) ||
              ''
            if (file) {
              const key = `gather_local:${save.id}`
              if (!store.keys.has(key)) {
                localPayloads.push({
                  source: 'gather_local',
                  externalId: save.id,
                  url: '',
                  title: save.title || '',
                  thumb: `gather-file://local/${encodeURIComponent(file)}`,
                  mediaType: save.kind === 'video' ? 'video' : '',
                  savedAt: Number(save.created_at) || Date.now()
                })
              }
              ourId = `sync_gather_local_${save.id.replace(/[^\w.-]/g, '_')}`
            }
          }
        }
        if (ourId) data.itemId = ourId
      }
      const list = itemsByBoard.get(bi.board_id) || []
      list.push({
        id: bi.id,
        type: bi.type,
        x: bi.x,
        y: bi.y,
        width: bi.width,
        height: bi.height,
        rotation: bi.rotation,
        z: bi.z_index,
        data
      })
      itemsByBoard.set(bi.board_id, list)
    }

    if (localPayloads.length) store.insert(localPayloads)

    const boardPayload = boards.map((b, i) => ({
      id: b.id,
      name: b.name,
      createdAt: Number(b.created_at) || Date.now(),
      updatedAt: Number(b.updated_at) || Date.now(),
      order: Number(b.order_index) || i,
      items: itemsByBoard.get(b.id) || []
    }))
    store.setBoards(boardPayload)
    boardCount = boardPayload.length
    console.log(`spaces      ${boardCount} imported (${localPayloads.length} local images added to the library)`)
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  if (fs.existsSync(STORE_FILE)) {
    const backup = path.join(STORE_DIR, `sync-library.backup-${stamp}.json`)
    fs.copyFileSync(STORE_FILE, backup)
    console.log(`backup      ${backup}`)
  }

  store.setCollections(collections)
  await store.persist()

  console.log(`\ncollections ${collections.length} imported`)
  console.log('')
  console.log('  gatheros  matched  collection')
  for (const [id, st] of stats) {
    console.log(`  ${String(st.total).padStart(8)}  ${String(st.matched).padStart(7)}  ${st.name}`)
  }
  console.log('')
  console.log(`items categorized   ${assigned}`)
  console.log(`extra memberships   ${multi} (item already in another collection; first collection by order kept)`)
  console.log(`already assigned    ${alreadyAssigned}`)
  const unmatchedTotal = Object.values(unmatched).reduce((a, b) => a + b, 0)
  if (unmatchedTotal) {
    console.log(
      `unmatched           ${unmatchedTotal} (${Object.entries(unmatched)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')} - saves not present in your synced X bookmarks)`
    )
  }
  const inbox = store.rows.filter((r) => r.status === 'inbox').length
  console.log(`remaining unsorted  ${inbox}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exitCode = 1
})
