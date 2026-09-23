const $ = (id) => document.getElementById(id)
const DEFAULTS = { serverUrl: 'http://127.0.0.1:47821', token: '', igUser: '' }

const getConfig = async () => ({ ...DEFAULTS, ...(await chrome.storage.local.get(['serverUrl', 'token', 'igUser'])) })

async function api(path, body) {
  const { serverUrl, token } = await getConfig()
  if (!token) throw new Error('not-configured')
  const res = await fetch(`${serverUrl.replace(/\/+$/, '')}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Gather-Token': token },
    body: body ? JSON.stringify(body) : undefined
  })
  return res.json()
}

function note(text) {
  $('note').textContent = text
}

function setStatus(text, on) {
  $('status').textContent = text
  $('dot').classList.toggle('on', !!on)
}

async function busy(id, fn) {
  const row = $(id)
  row.classList.add('busy')
  try {
    return await fn()
  } finally {
    row.classList.remove('busy')
  }
}

async function refreshStatus() {
  try {
    const { serverUrl } = await getConfig()
    const res = await fetch(`${serverUrl.replace(/\/+$/, '')}/health`)
    const health = await res.json()
    setStatus(health.ok ? 'Gather is open' : 'Gather is offline', health.ok)
    return health.ok
  } catch {
    setStatus('Gather is offline', false)
    return false
  }
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

function snapshotTitle(tab, prefix) {
  const name = tab?.title?.trim() || 'Untitled page'
  return `${prefix} — ${name}`.slice(0, 180)
}

async function shrink(dataUrl, maxWidth = 1280, quality = 0.82) {
  const img = new Image()
  img.src = dataUrl
  await img.decode()
  const scale = Math.min(1, maxWidth / (img.naturalWidth || maxWidth))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', quality)
}

async function send(items) {
  const out = await api('/ingest', { items })
  if (out?.rejected?.length) {
    note(`Rejected: ${out.rejected[0].reason}`)
    return null
  }
  return out
}

async function capturePage() {
  const tab = await activeTab()
  const raw = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
  const thumb = await shrink(raw)
  await send([
    {
      source: 'screenshot',
      externalId: `shot_${Date.now()}`,
      url: tab.url || '',
      title: snapshotTitle(tab, 'Screenshot'),
      thumb,
      savedAt: Date.now()
    }
  ])
  note('Page captured \u00b7 filed to your inbox')
}

function regionOverlay() {
  const overlay = document.createElement('div')
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,.28)'
  const box = document.createElement('div')
  box.style.cssText =
    'position:fixed;display:none;border:1.5px solid #fff;background:rgba(255,255,255,.14);border-radius:2px;box-shadow:0 0 0 9999px rgba(0,0,0,.28)'
  overlay.appendChild(box)
  document.documentElement.appendChild(overlay)

  let start = null
  const draw = (e) => {
    const x = Math.min(start.x, e.clientX)
    const y = Math.min(start.y, e.clientY)
    const w = Math.abs(e.clientX - start.x)
    const h = Math.abs(e.clientY - start.y)
    Object.assign(box.style, {
      display: 'block',
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      height: `${h}px`
    })
    return { x, y, w, h }
  }
  const finish = (rect) => {
    overlay.remove()
    window.removeEventListener('keydown', onKey, true)
    chrome.runtime.sendMessage({ type: 'gather-region', rect })
  }
  const onKey = (e) => {
    if (e.key === 'Escape') finish(null)
  }
  overlay.addEventListener('pointerdown', (e) => {
    start = { x: e.clientX, y: e.clientY }
    draw(e)
  })
  overlay.addEventListener('pointermove', (e) => {
    if (start) draw(e)
  })
  overlay.addEventListener('pointerup', (e) => {
    if (!start) return
    const rect = draw(e)
    const dpr = window.devicePixelRatio || 1
    finish(rect.w < 6 || rect.h < 6 ? null : { ...rect, dpr })
  })
  window.addEventListener('keydown', onKey, true)
}

function pickRegion(tabId) {
  return new Promise((resolve) => {
    const onMsg = (msg, sender) => {
      if (msg?.type !== 'gather-region' || sender.tab?.id !== tabId) return
      chrome.runtime.onMessage.removeListener(onMsg)
      clearTimeout(timer)
      resolve(msg.rect)
    }
    const timer = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(onMsg)
      resolve(null)
    }, 60000)
    chrome.runtime.onMessage.addListener(onMsg)
    chrome.scripting.executeScript({ target: { tabId }, func: regionOverlay }).catch(() => {
      clearTimeout(timer)
      chrome.runtime.onMessage.removeListener(onMsg)
      resolve(null)
    })
  })
}

async function captureArea() {
  const tab = await activeTab()
  const raw = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
  const result = await pickRegion(tab.id)

  if (!result) {
    note('Selection cancelled')
    return
  }
  const img = new Image()
  img.src = raw
  await img.decode()
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(result.w * result.dpr))
  canvas.height = Math.max(1, Math.round(result.h * result.dpr))
  canvas
    .getContext('2d')
    .drawImage(
      img,
      result.x * result.dpr,
      result.y * result.dpr,
      canvas.width,
      canvas.height,
      0,
      0,
      canvas.width,
      canvas.height
    )
  const thumb = await shrink(canvas.toDataURL('image/jpeg', 0.9))
  await send([
    {
      source: 'screenshot',
      externalId: `shot_${Date.now()}`,
      url: tab.url || '',
      title: snapshotTitle(tab, 'Region'),
      thumb,
      savedAt: Date.now()
    }
  ])
  note('Region captured \u00b7 filed to your inbox')
}

async function saveUrl() {
  const tab = await activeTab()
  if (!tab?.url) {
    note('No page to save')
    return
  }
  await send([
    {
      source: 'bookmark',
      externalId: tab.url,
      url: tab.url,
      title: tab.title || tab.url,
      folder: 'Saved from browser',
      savedAt: Date.now()
    }
  ])
  note('Link saved \u00b7 filed to your inbox')
}

function startImport(kind) {
  return new Promise((resolve) => chrome.runtime.sendMessage({ type: kind }, resolve))
}

const lastDiag = () => new Promise((resolve) => chrome.runtime.sendMessage({ type: 'diag' }, resolve))

async function trackImport(label, source) {
  const started = Date.now()
  let last = 0
  let stable = 0
  while (Date.now() - started < 600000) {
    await new Promise((r) => setTimeout(r, 1500))
    let state = null
    try {
      state = await api('/state')
    } catch {
      continue
    }
    const total = state?.sources?.[source]?.total || 0
    if (total !== last) {
      last = total
      stable = 0
      note(`${label}: ${total} synced \u00b7 ${state.inbox} in inbox`)
    } else {
      stable++
    }
    const d = await lastDiag()
    if (d && /import complete/.test(d.text)) {
      note(`${label}: import complete \u2014 ${last.toLocaleString()} items in your library`)
      return
    }
    if (stable >= 6) break
  }
  if (last) {
    note(`${label}: ${last.toLocaleString()} items synced`)
    return
  }
  const d = await lastDiag()
  note(d?.text || `${label}: nothing found yet`)
}

async function importX() {
  note('Checking your X bookmarks tab\u2026')
  const out = await startImport('import-x')
  if (!out?.ok) {
    note('Could not read the X tab \u2014 open your bookmarks page and retry')
    return
  }
  if (out.counted) note(`Scanning X bookmarks (${out.counted} on page)\u2026`)
  else if (out.blocked === 'login') note(`X is not signed in (${out.landed}) \u2014 sign in to x.com, then retry`)
  else if (out.landed) note(`X landed on ${out.landed} \u2014 open x.com/i/bookmarks, then retry`)
  else note('Scanning X bookmarks\u2026')
  trackImport('X bookmarks', 'x_bookmark')
}

async function importIG() {
  note('Checking your Instagram Saved tab\u2026')
  const out = await startImport('import-ig')
  if (!out?.ok) {
    note('Could not read the Instagram tab \u2014 open your Saved page and retry')
    return
  }
  if (out.needsUser) {
    note('Set your Instagram username in Options first')
    return
  }
  if (out.blocked === 'timeout') {
    note('Instagram took too long to load \u2014 try again')
    return
  }
  if (out.blocked && out.landed) {
    note(`Instagram landed on ${out.landed} \u2014 open your Saved page and retry`)
    return
  }
  note('Scanning Instagram saves\u2026')
  trackImport('Instagram saves', 'instagram_save')
}

async function importPin() {
  note('Opening your Pinterest boards…')
  const out = await startImport('import-pinterest')
  if (!out?.ok) {
    note('Could not read the Pinterest tab — open pinterest.com and retry')
    return
  }
  note('Scanning your boards… this can take a while')
  trackImport('Pinterest saves', 'pinterest_save')
}

function importCosmos() {
  note('Cosmos sync is not connected yet.')
}

async function openApp() {
  try {
    const out = await api('/open', {})
    if (out?.ok) {
      note('Gather is coming to the front')
      setTimeout(() => window.close(), 600)
    } else {
      note('Gather is not running')
    }
  } catch {
    note('Set the server URL and token in Options first')
  }
}

function guard(fn) {
  return (e) =>
    busy(e.currentTarget.id, fn).catch((err) => {
      if (String(err?.message) === 'not-configured') note('Add your token in Options to enable syncing')
      else note('Something went wrong \u2014 is Gather running?')
    })
}

$('version').textContent = `v${chrome.runtime.getManifest().version}`
$('close').addEventListener('click', () => window.close())
$('capturePage').addEventListener('click', guard(capturePage))
$('captureArea').addEventListener('click', guard(captureArea))
$('saveUrl').addEventListener('click', guard(saveUrl))
$('importX').addEventListener('click', guard(importX))
$('importIG').addEventListener('click', guard(importIG))
$('importPin').addEventListener('click', guard(importPin))
$('importCosmos').addEventListener('click', guard(importCosmos))
$('openApp').addEventListener('click', guard(openApp))

refreshStatus()
setInterval(refreshStatus, 3000)
lastDiag().then((d) => {
  if (d && Date.now() - d.at < 120000 && !$('note').textContent) note(d.text)
})
