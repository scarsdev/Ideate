import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createSyncService } from '../electron/sync/service.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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

app.whenReady().then(async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gather-ui-sync-'))
  const win = new BrowserWindow({
    width: 1512,
    height: 950,
    show: false,
    webPreferences: {
      preload: path.join(root, 'electron/preload.mjs'),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  const service = await createSyncService({
    dir,
    ipcMain,
    onChange: (row) => win.webContents.send('sync:item', row),
    openPath: () => {}
  })

  await win.loadFile(path.join(root, 'dist/index.html'))
  await sleep(900)
  await win.webContents.executeJavaScript('localStorage.clear()')
  await win.webContents.reload()
  await sleep(1500)

  const js = (code) => win.webContents.executeJavaScript(code)
  const base = `http://127.0.0.1:${service.port}`
  const post = async (p, body) => {
    const res = await fetch(`${base}${p}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-gather-token': service.token },
      body: JSON.stringify(body)
    })
    return res.json()
  }

  console.log('\nLive ingest → UI')
  const badgeBefore = await js(`+(document.querySelector('.fs-count')?.textContent || 0)`)
  const res = await post('/ingest', {
    items: [
      { source: 'bookmark', externalId: 'ui-1', url: 'https://example.com/design', title: 'Design systems reference', folder: 'Work/Refs', savedAt: Date.now() },
      { source: 'x_bookmark', externalId: 'ui-2', url: 'https://x.com/a/status/2', title: 'X synced post', text: 'synced from the extension', author: '@ada' },
      { source: 'instagram_save', externalId: 'ui-3', url: 'https://www.instagram.com/p/ui3/', title: 'IG synced save' },
      {
        source: 'x_bookmark',
        externalId: 'ui-4',
        url: 'https://x.com/v/status/4',
        title: 'Video bookmark',
        mediaType: 'video',
        mediaUrl: 'https://video.twimg.com/tweet_video/ui4.mp4',
        thumb: 'https://pbs.twimg.com/amplify_video_thumb/ui4.jpg'
      }
    ]
  })
  ok('server accepted live items', res.inserted === 4, JSON.stringify(res))
  await sleep(800)
  const badgeAfter = await js(`+(document.querySelector('.fs-count')?.textContent || 0)`)
  ok('Focused sort badge grew by 4', badgeAfter === badgeBefore + 4, `${badgeBefore} -> ${badgeAfter}`)
  const locate = `document.querySelector('[data-item-id="sync_bookmark_ui-1"]')`
  ok('synced card renders in library', await js(`!!${locate}`))
  const cardTitle = await js(`(${locate}?.querySelector('.tw-body')?.textContent || '').slice(0, 40)`)
  ok('media-less item renders as a text card', cardTitle.includes('Design systems reference'), cardTitle)
  const videoOk = await js(`(() => {
    const v = document.querySelector('[data-item-id="sync_x_bookmark_ui-4"] video')
    return v ? JSON.stringify({ muted: v.muted, loop: v.loop, poster: v.getAttribute('poster') }) : null
  })()`)
  ok('video tile renders muted with poster', !!videoOk && JSON.parse(videoOk).muted === true, videoOk)

  console.log('\nCategorize through the UI')
  await js(`(${locate}).click()`)
  await sleep(600)
  await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}))`)
  await sleep(500)
  await js(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}))`)
  await sleep(500)
  const row = service.store.rows.find((r) => r.externalId === 'ui-1')
  ok('store row flipped to categorized', row?.status === 'categorized', row?.status)
  ok('collection assigned in store', row?.collectionId === 'col_0', row?.collectionId)
  const badgeAfterAssign = await js(`+(document.querySelector('.fs-count')?.textContent || 0)`)
  ok('badge drops after categorizing', badgeAfterAssign === badgeAfter - 1, `${badgeAfter} -> ${badgeAfterAssign}`)

  console.log('\nDedupe on re-sync')
  const again = await post('/ingest', {
    items: [{ source: 'bookmark', externalId: 'ui-1', url: 'https://example.com/design', title: 'Design systems reference' }]
  })
  ok('re-sync is idempotent', again.inserted === 0 && again.duplicates === 1, JSON.stringify(again))
  const categorizedKept = service.store.rows.find((r) => r.externalId === 'ui-1')?.status
  ok('categorization is not clobbered by re-sync', categorizedKept === 'categorized')

  console.log('\nSettings → Syncing panel')
  await js(`document.querySelector('.topbar-right .icon-btn[title="Settings"]').click()`)
  await sleep(350)
  await js(`document.querySelector('.set-nav-item[data-section="syncing"]').click()`)
  await sleep(900)
  const pane = await js(`document.querySelector('.set-content').innerText.replace(/\\n/g,' ')`)
  ok('panel shows live server url', pane.includes(`127.0.0.1:${service.port}`))
  ok('panel shows source counts', /Browser bookmarks 1 item/.test(pane) && /X bookmarks 2 items/.test(pane) && /Instagram saves 1 item/.test(pane), pane.slice(60, 320))
  ok('panel shows access token', pane.includes(service.token.slice(0, 8)))

  console.log('\nPer-source toggle gates ingest')
  await js(`document.querySelectorAll('.set-rows .sw')[0].click()`)
  await sleep(400)
  const blocked = await post('/ingest', {
    items: [{ source: 'bookmark', externalId: 'ui-9', url: 'https://example.com/9', title: 'should be blocked' }]
  })
  ok('bookmarks toggle disables ingest', blocked.rejected?.[0]?.reason === 'source-disabled', JSON.stringify(blocked.rejected))
  await js(`document.querySelectorAll('.set-rows .sw')[0].click()`)
  await sleep(400)
  const allowed = await post('/ingest', {
    items: [{ source: 'bookmark', externalId: 'ui-9', url: 'https://example.com/9', title: 'allowed again' }]
  })
  ok('re-enable restores ingest', allowed.inserted === 1)

  console.log('\nDelete removes from store')
  await js(`document.querySelector('.set-close').click()`)
  await sleep(300)
  await js(`(() => {
    const c = document.querySelector('[data-item-id="sync_bookmark_ui-9"]');
    const r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + 30, clientY: r.top + 30 }));
  })()`)
  await sleep(350)
  await js(`(() => { const d = [...document.querySelectorAll('.ctx-item')].find(x => x.textContent.includes('Delete')); d.click(); })()`)
  await sleep(400)
  ok('delete removes synced row from store', !service.store.rows.some((r) => r.externalId === 'ui-9'))

  console.log(`\n${pass} passed, ${fail} failed`)
  await fs.rm(dir, { recursive: true, force: true })
  app.exit(fail ? 1 : 0)
}).catch((err) => {
  console.error('harness error:', err)
  app.exit(1)
})
