import { app, BrowserWindow } from 'electron'
import http from 'node:http'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

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

const tweet = (id, handle, name, text, media, time) => `
  <article data-testid="tweet">
    <div data-testid="User-Name">
      <a href="/${handle}"><span>${name}</span></a>
      <a href="/${handle}"><span>@${handle}</span></a>
      <span>·</span>
      <a href="/${handle}/status/${id}"><time datetime="${time}">Sep 12</time></a>
    </div>
    <div data-testid="tweetText">${text}</div>
    ${media ? `<img src="${media}" />` : ''}
    <div role="button" data-testid="bookmark" aria-label="Bookmark" tabindex="0">
      <svg viewBox="0 0 24 24"><path d="M7 4h10v16l-5-3-5 3z" /></svg>
    </div>
  </article>
`

const HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>Bookmarks / X</title></head>
<body style="font-family: system-ui; padding: 20px">
  <h1>Bookmarks</h1>
  <div id="timeline">
    ${tweet('111', 'alice', 'Alice', 'First bookmark tweet about design systems', 'https://pbs.twimg.com/media/AAA111.jpg', '2026-09-12T10:00:00.000Z')}
    ${tweet('222', 'bob', 'Bob', 'Second bookmark about three.js shaders', 'https://pbs.twimg.com/media/BBB222.jpg', '2026-09-13T08:30:00.000Z')}
    <article data-testid="tweet">
      <div data-testid="User-Name">
        <a href="/carol"><span>Carol</span></a>
        <a href="/carol"><span>@carol</span></a>
        <span>·</span>
        <a href="/carol/status/333"><time datetime="2026-09-14T09:00:00.000Z">Sep 14</time></a>
      </div>
      <div data-testid="tweetText">Video bookmark about shader tricks</div>
      <img src="https://pbs.twimg.com/amplify_video_thumb/CCC333.jpg" />
      <video src="https://video.twimg.com/tweet_video/CCC333.mp4" poster="https://pbs.twimg.com/amplify_video_thumb/CCC333.jpg"></video>
      <div role="button" data-testid="bookmark" aria-label="Bookmark" tabindex="0"></div>
    </article>
  </div>
</body></html>`

const PRELOAD = `window.__sent = []
window.__listeners = []
window.chrome = {
  runtime: {
    sendMessage: (msg, cb) => {
      window.__sent.push(msg)
      if (cb) cb({ ok: true })
      return Promise.resolve({ ok: true })
    },
    onMessage: { addListener: (fn) => window.__listeners.push(fn) }
  }
}`

const preloadPath = path.join(os.tmpdir(), `gather-x-preload-${process.pid}.js`)
fs.writeFileSync(preloadPath, PRELOAD)

const startPageServer = () =>
  new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      const saved = /^\/i\/(bookmarks|history)/.test(req.url)
      res.end(saved ? HTML : '<!doctype html><title>home</title>')
    })
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }))
  })

app.whenReady().then(async () => {
  const { server, port } = await startPageServer()
  const win = new BrowserWindow({
    show: false,
    width: 900,
    height: 700,
    webPreferences: { preload: preloadPath, contextIsolation: false, sandbox: false }
  })

  const script = fs.readFileSync(path.join(root, 'sync-extension/content/x.js'), 'utf8')
  const js = (code) => win.webContents.executeJavaScript(code)

  await win.loadURL(`http://127.0.0.1:${port}/i/history`)
  await sleep(600)
  await win.webContents.executeJavaScript(script)
  await sleep(9000)

  console.log('\nPassive auto-scan on /i/history (renamed bookmarks page)')
  const historyItems = (await js(`window.__sent`))
    .filter((m) => m.type === 'ingest')
    .flatMap((m) => m.items)
  ok('history path scans', historyItems.length === 3, `${historyItems.length} items`)

  await win.loadURL(`http://127.0.0.1:${port}/i/bookmarks`)
  await sleep(600)
  await win.webContents.executeJavaScript(script)
  await sleep(9000)

  console.log('\nPassive auto-scan on legacy /i/bookmarks')
  const sent = await js(`window.__sent`)
  const items = sent.filter((m) => m.type === 'ingest').flatMap((m) => m.items)
  ok('items were sent', items.length === 3, `${items.length} items`)
  const first = items.find((i) => i.externalId === '111')
  ok('tweet id extracted', !!first)
  ok('url extracted', first?.url === 'https://x.com/alice/status/111', first?.url)
  ok('author extracted', first?.author === '@alice', first?.author)
  ok('text extracted', first?.text === 'First bookmark tweet about design systems', first?.text)
  ok('media extracted', first?.thumb?.includes('twimg.com/media'), first?.thumb)
  ok('timestamp parsed', first?.savedAt === Date.parse('2026-09-12T10:00:00.000Z'))
  ok('scan reported result', sent.some((m) => m.type === 'scan-result' && m.count === 3))

  const videoItem = items.find((i) => i.externalId === '333')
  ok('video media detected', videoItem?.mediaType === 'video', videoItem?.mediaType)
  ok('video url captured', videoItem?.mediaUrl === 'https://video.twimg.com/tweet_video/CCC333.mp4', videoItem?.mediaUrl)
  ok('video poster used as thumb', (videoItem?.thumb || '').includes('amplify_video_thumb'), videoItem?.thumb)

  console.log('\nReal-time capture on bookmark click')
  const beforeLive = await js(`window.__sent.length`)
  await js(`(() => {
    const btn = document.querySelectorAll('[data-testid="bookmark"]')[1];
    btn.setAttribute('aria-label', 'Remove Bookmark');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  })()`)
  await sleep(900)
  const live = (await js(`window.__sent`))
    .slice(beforeLive)
    .filter((m) => m.type === 'ingest')
    .flatMap((m) => m.items)
  ok('live capture fired', live.length === 1, `${live.length} items`)
  ok('live item is the clicked tweet', live[0]?.externalId === '222', live[0]?.externalId)

  console.log('\nUnsave click is ignored')
  const beforeUnsave = await js(`window.__sent.length`)
  await js(`(() => {
    const btn = document.querySelectorAll('[data-testid="bookmark"]')[0];
    btn.setAttribute('aria-label', 'Bookmark');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  })()`)
  await sleep(900)
  const extra = (await js(`window.__sent`)).slice(beforeUnsave).filter((m) => m.type === 'ingest')
  ok('unsave click sends nothing', extra.length === 0, `${extra.length} ingests`)

  console.log(`\n${pass} passed, ${fail} failed`)
  server.close()
  fs.rmSync(preloadPath, { force: true })
  app.exit(fail ? 1 : 0)
}).catch((err) => {
  console.error('harness error:', err)
  fs.rmSync(preloadPath, { force: true })
  app.exit(1)
})
