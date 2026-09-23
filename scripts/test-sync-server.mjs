import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs/promises'
import { SyncStore } from '../electron/sync/store.mjs'
import { startSyncServer } from '../electron/sync/server.mjs'

let pass = 0
let fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) {
    pass++
    console.log(`  ok   ${name}${extra ? ` — ${extra}` : ''}`)
  } else {
    fail++
    console.log(`  FAIL ${name}${extra ? ` — ${extra}` : ''}`)
  }
}

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gather-sync-'))
const token = 'test-token-123'
let store = await new SyncStore(dir).load()
let openCalls = 0
let { server, port } = await startSyncServer({
  store,
  token,
  onOpen: () => {
    openCalls++
    return true
  }
})
let base = `http://127.0.0.1:${port}`

const post = (p, body, headers = {}) =>
  fetch(`${base}${p}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-gather-token': token, ...headers },
    body: JSON.stringify(body)
  })

const rawGet = (p, headers = {}) =>
  fetch(`${base}${p}`, { headers: { 'x-gather-token': token, ...headers } })

const get = async (p, headers = {}) => {
  let last
  for (let i = 0; i < 4; i++) {
    try {
      return await rawGet(p, headers)
    } catch (err) {
      last = err
      await new Promise((r) => setTimeout(r, 150))
    }
  }
  throw last
}

console.log('\nAuth + health')
{
  const health = await (await fetch(`${base}/health`)).json()
  ok('health is public', health.ok === true)
  const noAuth = await fetch(`${base}/state`)
  ok('state requires token', noAuth.status === 401)
  const withAuth = await get('/state')
  ok('state accepts token', withAuth.status === 200)
}

console.log('\nIngest + idempotent dedupe')
{
  const items = [
    { source: 'bookmark', externalId: 'b1', url: 'https://example.com/a', title: 'Boomkarked page', folder: 'Work/Refs', savedAt: 1700000000000 },
    { source: 'x_bookmark', externalId: '1900000000000000001', url: 'https://x.com/a/status/1900000000000000001', title: 'X bookmark', text: 'hello world', author: '@a' },
    { source: 'instagram_save', externalId: 'Cxyz123', url: 'https://www.instagram.com/p/Cxyz123/', title: 'IG save', thumb: 'https://cdn.example.com/p.jpg' }
  ]
  const first = await (await post('/ingest', { items })).json()
  ok('first ingest inserts 3', first.inserted === 3 && first.duplicates === 0, JSON.stringify({ i: first.inserted, d: first.duplicates }))
  ok('inbox count is 3', first.inbox === 3)

  const again = await (await post('/ingest', { items })).json()
  ok('re-ingest is idempotent', again.inserted === 0 && again.duplicates === 3, JSON.stringify({ i: again.inserted, d: again.duplicates }))

  const single = await (await post('/ingest', items[1])).json()
  ok('single-object ingest also dedupes', single.inserted === 0 && single.duplicates === 1)

  const bad = await (await post('/ingest', { items: [{ source: 'bookmark', title: 'no id' }] })).json()
  ok('missing external_id rejected', bad.rejected?.[0]?.reason === 'missing-key')
}

console.log('\nPer-source enable gate')
{
  store.setEnabled('x_bookmark', false)
  await store.persist()
  const res = await (
    await post('/ingest', {
      items: [{ source: 'x_bookmark', externalId: '999', url: 'https://x.com/z/status/999', title: 'blocked' }]
    })
  ).json()
  ok('disabled source rejected', res.rejected?.[0]?.reason === 'source-disabled')
  store.setEnabled('x_bookmark', true)
  await store.persist()
  const res2 = await (
    await post('/ingest', {
      items: [{ source: 'x_bookmark', externalId: '999', url: 'https://x.com/z/status/999', title: 'allowed' }]
    })
  ).json()
  ok('re-enabled source accepted', res2.inserted === 1)
}

console.log('\nsync_state')
{
  await post('/sync-state', { source: 'bookmark', initialBackfillDone: true, lastSyncedAt: 1700000001000 })
  const state = await (await get('/state')).json()
  ok('backfill flag stored', state.sources.bookmark.initialBackfillDone === true)
  ok('last sync time stored', state.sources.bookmark.lastSyncedAt === 1700000001000)
  ok('summary totals', state.total === 4 && state.inbox === 4, `total ${state.total}, inbox ${state.inbox}`)
}

console.log('\ncategorize + persistence')
{
  const snap = store.snapshot()
  const row = snap.rows.find((r) => r.source === 'bookmark' && r.externalId === 'b1')
  ok('row has stable id', row.id === 'sync_bookmark_b1', row.id)
  ok('row starts in inbox', row.status === 'inbox')
  store.categorize(row.id, 'col_3')
  await store.persist()

  store = await new SyncStore(dir).load()
  const reloaded = store.rows.find((r) => r.id === 'sync_bookmark_b1')
  ok('categorized status persisted', reloaded.status === 'categorized')
  ok('collection persisted', reloaded.collectionId === 'col_3')
  ok('inbox count drops', store.summary().inbox === 3, `inbox ${store.summary().inbox}`)
}

console.log('\nrestart (fresh server on same data)')
{
  await new Promise((r) => server.close(r))
  const next = await startSyncServer({
    store,
    token,
    onOpen: () => {
      openCalls++
      return true
    }
  })
  port = next.port
  base = `http://127.0.0.1:${port}`
  server = next.server
  const state = await (await get('/state')).json()
  ok('rows survive restart', state.total === 4 && state.inbox === 3, `total ${state.total}, inbox ${state.inbox}`)
  ok('sync_state survives restart', state.sources.bookmark.initialBackfillDone === true)
}

console.log('\nScreenshots + open-app')
{
  const shot = await (
    await post('/ingest', {
      items: [
        {
          source: 'screenshot',
          externalId: `shot_${Date.now()}`,
          url: 'https://example.com/page',
          title: 'Screenshot — Example',
          thumb: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          savedAt: Date.now()
        }
      ]
    })
  ).json()
  ok('screenshot item accepted', shot.inserted === 1 && shot.rejected.length === 0, JSON.stringify(shot))

  const open = await (await post('/open', {})).json()
  ok('open endpoint focuses app', open.ok === true && openCalls === 1, JSON.stringify({ open, openCalls }))

  const noAuth = await fetch(`${base}/open`, { method: 'POST' })
  ok('open requires token', noAuth.status === 401)
}

console.log('\nEnrichment on re-sync')
{
  const before = store.snapshot().rows.find((r) => r.externalId === 'b1')
  ok('row starts without media', !before.mediaUrl && !before.mediaType)
  const res = await (
    await post('/ingest', {
      items: [
        {
          source: 'bookmark',
          externalId: 'b1',
          title: 'Boomkarked page',
          thumb: 'https://cdn.example.com/poster.jpg',
          mediaUrl: 'https://cdn.example.com/clip.mp4',
          mediaType: 'video'
        }
      ]
    })
  ).json()
  ok('duplicate is enriched, not duplicated', res.inserted === 0 && res.enriched === 1, JSON.stringify(res))
  const after = store.snapshot().rows.find((r) => r.externalId === 'b1')
  ok('media fields upgraded', after.mediaUrl === 'https://cdn.example.com/clip.mp4' && after.mediaType === 'video', JSON.stringify({ u: after.mediaUrl, t: after.mediaType }))
  ok('existing fields kept', after.title === 'Boomkarked page' && after.status === 'categorized')
}

console.log('\nboards')
{
  const b1 = store.createBoard({ name: 'Mood board' })
  ok('create board', !!b1.id && b1.name === 'Mood board' && b1.items.length === 0, b1.id)
  const saved = store.saveBoard(b1.id, [
    { id: 'bi_1', type: 'sticky', x: 10, y: 20, width: 180, height: 180, rotation: 0, z: 1, data: { text: 'hi', color: 'pink' } },
    { id: 'bi_2', type: 'image', x: 0, y: 0, width: 200, height: 200, z: 2, data: { itemId: 'sync_bookmark_b1', naturalWidth: 800 } }
  ])
  ok('save board items', saved.items.length === 2 && saved.items[0].data.color === 'pink')
  store.renameBoard(b1.id, 'Renamed')
  ok('rename board', store.boards[0].name === 'Renamed')
  const b2 = store.createBoard({ name: 'Second' })
  store.reorderBoards([b2.id, b1.id])
  ok('reorder boards', store.boards[0].id === b2.id && store.boards[0].order === 0)
  await store.persist()
  const reloaded = await new SyncStore(dir).load()
  ok('boards persist across reload', reloaded.boards.length === 2 && reloaded.boards[1].items.length === 2, JSON.stringify(reloaded.boards.map((b) => b.name)))
  ok('board item sanitized', typeof reloaded.boards[1].items[0].data.text === 'string')
  store.deleteBoard(b2.id)
  ok('delete board', store.boards.length === 1)
}

console.log('\nremove + clear')
{
  store.remove('sync_bookmark_b1')
  await store.persist()
  ok('remove drops row', store.summary().total === 4, `total ${store.summary().total}`)
  store.clear()
  await store.persist()
  const after = await (await get('/state')).json()
  ok('clear empties store', after.total === 0 && Object.keys(after.sources).length === 0)
}

await new Promise((r) => server.close(r))
await fs.rm(dir, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
