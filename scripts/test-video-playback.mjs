import { app, BrowserWindow, ipcMain } from 'electron'
import http from 'node:http'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
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

const mp4 = fs.readFileSync('/tmp/gather-test.mp4')

const startVideoServer = () =>
  new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url.startsWith('/clip.mp4')) {
        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': mp4.length })
        res.end(mp4)
        return
      }
      res.writeHead(404)
      res.end()
    })
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })

app.whenReady().then(async () => {
  const { server, port } = await startVideoServer()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gather-video-'))
  const win = new BrowserWindow({
    width: 1512,
    height: 950,
    show: false,
    webPreferences: {
      preload: path.join(root, 'electron/preload.mjs'),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
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

  await fetch(`http://127.0.0.1:${service.port}/ingest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-gather-token': service.token },
    body: JSON.stringify({
      items: [
        {
          source: 'x_bookmark',
          externalId: 'vid-1',
          url: 'https://x.com/a/status/vid-1',
          title: 'Video post with a clip',
          author: '@ada',
          authorName: 'Ada',
          thumb: 'https://pbs.twimg.com/amplify_video_thumb/x.jpg',
          mediaType: 'video',
          mediaUrl: `data:video/mp4;base64,${mp4.toString('base64')}`
        }
      ]
    })
  })
  await sleep(900)

  console.log('\nGrid tile')
  ok('video tile rendered', await js(`!!document.querySelector('[data-item-id="sync_x_bookmark_vid-1"] video')`))
  await js(`(() => {
    const v = document.querySelector('[data-item-id="sync_x_bookmark_vid-1"] video')
    v.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    v.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }))
  })()`)
  await sleep(1200)
  const hover = await js(`(() => {
    const v = document.querySelector('[data-item-id="sync_x_bookmark_vid-1"] video')
    return JSON.stringify({ paused: v.paused, muted: v.muted, t: +v.currentTime.toFixed(2), ready: v.readyState })
  })()`)
  const h = JSON.parse(hover)
  ok('hover plays muted', h.paused === false && h.muted === true, hover)
  ok('playback advanced', h.t > 0 && h.ready >= 2, `t=${h.t}s ready=${h.ready}`)

  await js(`(() => {
    const v = document.querySelector('[data-item-id="sync_x_bookmark_vid-1"] video')
    v.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }))
    v.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }))
  })()`)
  await sleep(300)
  const left = await js(`(() => {
    const v = document.querySelector('[data-item-id="sync_x_bookmark_vid-1"] video')
    return JSON.stringify({ paused: v.paused, t: v.currentTime })
  })()`)
  ok('leaving pauses and rewinds', JSON.parse(left).paused === true && JSON.parse(left).t === 0, left)

  console.log('\nDetail view')
  await js(`document.querySelector('[data-item-id="sync_x_bookmark_vid-1"]').click()`)
  await sleep(1500)
  const detail = await js(`(() => {
    const v = document.querySelector('.lb-video')
    return v ? JSON.stringify({ muted: v.muted, paused: v.paused, t: +v.currentTime.toFixed(2), controls: v.controls }) : null
  })()`)
  ok('detail renders player', !!detail, detail || 'no .lb-video')
  if (detail) {
    const d = JSON.parse(detail)
    ok('detail plays unmuted', d.muted === false && d.paused === false, detail)
    ok('detail has controls', d.controls === true)
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  server.close()
  fs.rmSync(dir, { recursive: true, force: true })
  app.exit(fail ? 1 : 0)
}).catch((err) => {
  console.error('harness error:', err)
  app.exit(1)
})
