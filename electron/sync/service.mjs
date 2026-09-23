import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SyncStore } from './store.mjs'
import { startSyncServer } from './server.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const EXTENSION_DIR = path.resolve(__dirname, '../../sync-extension')

async function ensureToken(dir) {
  const file = path.join(dir, 'sync-token.txt')
  try {
    const existing = (await fs.readFile(file, 'utf8')).trim()
    if (existing) return existing
  } catch {
    /* generate below */
  }
  const token = crypto.randomBytes(16).toString('hex')
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(file, token)
  return token
}

async function extensionDir(preferred) {
  const candidates = [preferred, EXTENSION_DIR].filter(Boolean)
  for (const dir of candidates) {
    try {
      await fs.access(path.join(dir, 'manifest.json'))
      return dir
    } catch {
      /* try next */
    }
  }
  return ''
}

export async function createSyncService({ dir, extensionDir: preferred, ipcMain, onChange, openPath, onOpen }) {
  const store = await new SyncStore(dir).load()
  const token = await ensureToken(dir)
  const { server, port } = await startSyncServer({
    store,
    token,
    onInsert: (rows) => rows.forEach((row) => onChange?.(row)),
    onOpen
  })
  const dirPath = await extensionDir(preferred)

  ipcMain.handle('sync:snapshot', () => store.snapshot())

  ipcMain.handle('sync:set-collections', async (_e, { collections } = {}) => {
    store.setCollections(collections)
    await store.persist()
    return { ok: true, collections: store.collections }
  })

  ipcMain.handle('boards:create', async (_e, { name } = {}) => {
    const board = store.createBoard({ name })
    await store.persist()
    return { ok: true, board }
  })

  ipcMain.handle('boards:rename', async (_e, { id, name } = {}) => {
    const board = store.renameBoard(id, name)
    if (board) await store.persist()
    return { ok: !!board, board }
  })

  ipcMain.handle('boards:delete', async (_e, { id } = {}) => {
    const removed = store.deleteBoard(id)
    if (removed) await store.persist()
    return { ok: removed }
  })

  ipcMain.handle('boards:save', async (_e, { id, items } = {}) => {
    const board = store.saveBoard(id, items)
    if (board) await store.persist()
    return { ok: !!board, board }
  })

  ipcMain.handle('boards:reorder', async (_e, { ids } = {}) => {
    store.reorderBoards(ids)
    await store.persist()
    return { ok: true, boards: store.boards }
  })

  ipcMain.handle('sync:pin-boards:get', () => store.pinBoards)

  ipcMain.handle('sync:pin-boards:set', async (_e, patch = {}) => {
    const next = store.setPinBoards(patch || {})
    await store.persist()
    return { ok: true, pinBoards: next }
  })

  ipcMain.handle('sync:categorize', async (_e, { id, collectionId }) => {
    const row = store.categorize(id, collectionId)
    if (row) await store.persist()
    return { ok: !!row, row }
  })

  ipcMain.handle('sync:remove', async (_e, { id }) => {
    const removed = store.remove(id)
    if (removed) await store.persist()
    return { ok: removed }
  })

  ipcMain.handle('sync:clear', async () => {
    store.clear()
    await store.persist()
    return { ok: true }
  })

  ipcMain.handle('sync:annotate', async (_e, { id, patch } = {}) => {
    const row = store.annotate(id, patch)
    if (row) await store.persist()
    return { ok: !!row, row }
  })

  ipcMain.handle('sync:annotate-bulk', async (_e, { entries } = {}) => {
    const updated = store.annotateMany(entries || [])
    if (updated.length) await store.persist()
    return { ok: true, count: updated.length, rows: updated }
  })

  ipcMain.handle('sync:categorize-bulk', async (_e, { entries } = {}) => {
    const updated = store.categorizeMany(entries || [])
    if (updated.length) await store.persist()
    return { ok: true, count: updated.length, rows: updated }
  })

  ipcMain.handle('sync:set-source-enabled', async (_e, { source, enabled }) => {
    store.setEnabled(source, !!enabled)
    await store.persist()
    return { ok: true, sources: store.summary().sources }
  })

  ipcMain.handle('sync:meta', () => ({
    ok: true,
    running: true,
    host: '127.0.0.1',
    port,
    token,
    url: `http://127.0.0.1:${port}`,
    extensionDir: dirPath
  }))

  ipcMain.handle('sync:reveal-extension', async () => {
    if (!dirPath) return { ok: false }
    await openPath?.(dirPath)
    return { ok: true, dir: dirPath }
  })

  return { store, server, port, token }
}
