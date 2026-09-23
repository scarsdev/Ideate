const DEFAULTS = { serverUrl: 'http://127.0.0.1:47821', token: '', watchMinutes: 15 }

let diagUserSet = false

let diag = { at: Date.now(), text: 'Idle' }

const diagLoaded = chrome.storage.local
  .get('diag')
  .then(({ diag: saved }) => {
    if (!diagUserSet && saved?.text) diag = saved
  })
  .catch(() => {})

function setDiag(text) {
  diagUserSet = true
  diag = { at: Date.now(), text }
  chrome.storage.local.set({ diag }).catch(() => {})
  return diag
}

async function getConfig() {
  const stored = await chrome.storage.local.get([
    'serverUrl',
    'token',
    'igUser',
    'watchMinutes'
  ])
  return { ...DEFAULTS, ...stored }
}

async function api(path, body) {
  const { serverUrl, token } = await getConfig()
  if (!token) return { ok: false, error: 'not-configured' }
  try {
    const res = await fetch(`${serverUrl.replace(/\/+$/, '')}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'Content-Type': 'application/json', 'X-Gather-Token': token },
      body: body ? JSON.stringify(body) : undefined
    })
    return await res.json()
  } catch (err) {
    setDiag('Gather server unreachable — is the app running?')
    return { ok: false, error: 'offline', detail: String(err) }
  }
}

const PENDING_KEY = 'pendingIngest'

async function queuePending(items) {
  try {
    const { [PENDING_KEY]: pending = [] } = await chrome.storage.local.get(PENDING_KEY)
    await chrome.storage.local.set({ [PENDING_KEY]: [...pending, ...items].slice(-1000) })
  } catch {
    /* storage unavailable */
  }
}

async function flushPending() {
  try {
    const { [PENDING_KEY]: pending = [] } = await chrome.storage.local.get(PENDING_KEY)
    if (!pending.length) return
    const out = await api('/ingest', { items: pending })
    if (out?.ok) {
      await chrome.storage.local.set({ [PENDING_KEY]: [] })
      const state = out.inbox ? ` · ${out.inbox} in inbox` : ''
      setDiag(`Flushed ${pending.length} queued save${pending.length === 1 ? '' : 's'}${state}`)
    }
  } catch {
    /* retry on next alarm */
  }
}

chrome.alarms.get('gather-flush').then((alarm) => {
  if (!alarm) chrome.alarms.create('gather-flush', { periodInMinutes: 1 })
})
chrome.alarms.get('gather-enrich').then((alarm) => {
  if (!alarm) chrome.alarms.create('gather-enrich', { periodInMinutes: 1 })
})
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'gather-flush') flushPending()
  if (alarm.name === 'gather-watch') watchTick()
  if (alarm.name === 'ig-continue') igContinueTick()
  if (alarm.name === 'gather-enrich') processIgQueue()
})
flushPending()

async function updateBadge() {
  const state = await api('/state')
  if (!state?.ok) {
    await chrome.action.setBadgeText({ text: '' })
    return
  }
  await chrome.action.setBadgeBackgroundColor({ color: '#18181b' })
  await chrome.action.setBadgeText({ text: state.inbox ? String(state.inbox) : '' })
}

const SYNDICATION = 'https://cdn.syndication.twimg.com/tweet-result'

const syndicationToken = (id) =>
  ((Number(id) / 1e15) * Math.PI).toFixed(9).replace('.', '').replace(/0+$/, '')

async function tweetMeta(id) {
  try {
    const res = await fetch(`${SYNDICATION}?id=${id}&lang=en&token=${syndicationToken(id)}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function bestMp4(meta) {
  const media = (meta?.mediaDetails || []).find((m) => m.type === 'video' && m.video_info)
  const variants = (media?.video_info?.variants || []).filter(
    (v) => v.content_type === 'video/mp4' && v.url
  )
  if (!variants.length) return ''
  variants.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
  return variants[0].url
}

async function enrichVideos(items) {
  const targets = items.filter(
    (i) =>
      i.source === 'x_bookmark' &&
      ((i.mediaType === 'video' && !i.mediaUrl) ||
        !Array.isArray(i.images) ||
        i.images.length < 2)
  )
  if (!targets.length) return items

  let cursor = 0
  let resolved = 0
  const worker = async () => {
    while (cursor < targets.length) {
      const item = targets[cursor++]
      const meta = await tweetMeta(item.externalId)
      if (!meta) continue
      const url = bestMp4(meta)
      if (url && !item.mediaUrl) {
        item.mediaUrl = url
        resolved++
      }
      const media = (meta.mediaDetails || []).find((m) => m.media_url_https)
      if (!item.thumb && media?.media_url_https) item.thumb = media.media_url_https
      const photos = (meta.mediaDetails || [])
        .filter((m) => m.type === 'photo' && m.media_url_https)
        .map((m) => m.media_url_https)
      if (photos.length && (!Array.isArray(item.images) || photos.length > item.images.length)) {
        item.images = photos.slice(0, 10)
        if (!item.thumb) item.thumb = photos[0]
        resolved++
      }
      const user = meta.user || {}
      if (!item.avatar && user.profile_image_url_https) {
        item.avatar = user.profile_image_url_https.replace('_normal', '_400x400')
      }
      if (!item.authorName && user.name) item.authorName = user.name
    }
  }

  await Promise.all(Array.from({ length: 5 }, worker))
  if (resolved) setDiag(`Enriched ${resolved} X item${resolved === 1 ? '' : 's'} (media links/photos)`)
  return items
}

const IG_POST_PAGE = 'https://www.instagram.com/p/'

function igPostProbeFn() {
  const uniq = (arr) => [...new Set(arr.filter(Boolean))]
  const imgs = uniq(
    [...document.querySelectorAll('img')]
      .map((i) => i.currentSrc || i.src || '')
      .filter((u) => /cdninstagram|fbcdn/.test(u) && !/profile|150x150|s150x150/.test(u))
  )
  const vids = uniq(
    [...document.querySelectorAll('video')]
      .map((v) => v.currentSrc || v.src || '')
      .filter((u) => /^https?:/.test(u))
  )
  const metas = {}
  for (const m of document.querySelectorAll('meta[property^="og:"]')) {
    metas[m.getAttribute('property')] = m.getAttribute('content')
  }
  return JSON.stringify({
    imgs: imgs.slice(0, 12),
    vids: vids.slice(0, 3),
    ogImage: metas['og:image'] || '',
    ogVideo: metas['og:video'] || metas['og:video:secure_url'] || ''
  })
}

function igEmbedProbeFn() {
  const html = document.documentElement.innerHTML
  const i = html.indexOf('contextJSON')
  if (i < 0) return JSON.stringify({})
  const win = html.slice(i, i + 400000).replace(/&amp;/g, '&')
  const s = win.replace(/\\u002F/gi, '/').replace(/\\u0026/gi, '&').replace(/\\+/g, '')
  const video = (s.match(/"video_url":"(https:[^"]+?)"/) || [])[1] || ''
  const imgs = []
  const re = /"display_url":"(https:[^"]+?)"/g
  let m
  while ((m = re.exec(s)) && imgs.length < 12) imgs.push(m[1])
  const isVideo = /"is_video":true/.test(s)
  return JSON.stringify({ imgs, video, isVideo })
}

function buildIgPatch(entry, imgs, video) {
  if (!imgs.length && !video) return null
  const patch = {
    source: 'instagram_save',
    externalId: entry.id,
    url: `${IG_POST_PAGE}${entry.id}/`,
    title: 'Instagram save'
  }
  if (entry.carousel && imgs.length > 1) {
    patch.images = imgs.slice(0, 12)
    patch.thumb = imgs[0]
  } else if (imgs.length) {
    patch.thumb = imgs[0]
  }
  if (entry.video && video) {
    patch.mediaUrl = video
    patch.mediaType = 'video'
  }
  return patch
}

const IG_QUEUE_KEY = 'igEnrichQueue'
const IG_COOLDOWN_KEY = 'igCooldownUntil'
const IG_PAUSE_NO_KEY = 'igPauseNo'
const IG_VIDEO_REOPEN_KEY = 'igVideoReopen'
const IG_DONE_KEY = 'igEnrichedIds'

async function queueIgTargets(items) {
  const store = await chrome.storage.local.get([IG_QUEUE_KEY, IG_DONE_KEY, IG_VIDEO_REOPEN_KEY])
  const queue = Array.isArray(store[IG_QUEUE_KEY]) ? store[IG_QUEUE_KEY] : []
  const done = new Set(Array.isArray(store[IG_DONE_KEY]) ? store[IG_DONE_KEY] : [])
  const have = new Set(queue.map((q) => q.id))
  const reopen = !store[IG_VIDEO_REOPEN_KEY]
  let added = 0
  let reopened = false
  for (const i of items) {
    const isVideo = i.mediaType === 'video'
    if (!i.externalId || have.has(i.externalId)) continue
    const wasDone = done.has(i.externalId)
    if (wasDone && !(isVideo && reopen)) continue
    queue.push({ id: i.externalId, carousel: !!i.carousel, video: isVideo, tries: 0 })
    have.add(i.externalId)
    if (wasDone) reopened = true
    added++
  }
  if (added) {
    const patch = { [IG_QUEUE_KEY]: queue.slice(0, 12000) }
    if (reopened) patch[IG_VIDEO_REOPEN_KEY] = true
    await chrome.storage.local.set(patch)
    setDiag(`IG backfill: ${added} queued (${queue.length} pending)`)
  }
}

async function probeIgPost(entry) {
  let tab = null
  try {
    tab = await chrome.tabs.create({
      url: `${IG_POST_PAGE}${entry.id}/embed/captioned/`,
      active: false
    })
    const tabId = tab.id
    const loaded = await waitForTab(tabId, 15000)
    if (loaded) {
      let embed = null
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId },
            func: igEmbedProbeFn
          })
          embed = JSON.parse(result || '{}')
        } catch {
          embed = null
        }
        if (embed && (embed.video || (embed.imgs && embed.imgs.length))) break
        await sleep(900)
      }
      if (embed && (embed.video || (embed.imgs && embed.imgs.length))) {
        const imgsE = (embed.imgs || []).filter((u) => /^https?:/.test(u))
        const videoE = /^https?:/.test(embed.video || '') ? embed.video : ''
        const patch = buildIgPatch(entry, imgsE, videoE)
        if (patch) return patch
      }
    }

    await chrome.tabs.update(tabId, { url: `${IG_POST_PAGE}${entry.id}/` })
    const loaded2 = await waitForTab(tabId, 15000)
    if (!loaded2) return 'fail: load-timeout'
    let data = null
    let lastErr = ''
    for (let attempt = 0; attempt < 8; attempt++) {
      await sleep(1100)
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: igPostProbeFn
        })
        data = JSON.parse(result || '{}')
        lastErr = ''
      } catch (err) {
        data = null
        lastErr = String(err?.message || err).slice(0, 90)
      }
      if (data && ((data.imgs && data.imgs.length) || (data.vids && data.vids.length))) break
    }
    if (!data) return `fail: ${lastErr || 'no-data'}`
    const imgs = (data.imgs || []).filter((u) => /^https?:/.test(u))
    const vids = (data.vids || []).filter((u) => /^https?:/.test(u))
    const video = vids[0] || (/\.mp4/i.test(data.ogVideo || '') ? data.ogVideo : '')
    return buildIgPatch(entry, imgs, video) || null
  } catch (err) {
    let detail = String(err?.message || err).slice(0, 90)
    if (/error page/i.test(detail) && tab?.id) {
      const t = await chrome.tabs.get(tab.id).catch(() => null)
      if (t?.title) detail = `${t.title.slice(0, 70)}`
    }
    return `fail: ${detail}`
  } finally {
    if (tab?.id) chrome.tabs.remove(tab.id).catch(() => {})
  }
}

let igQueueRunning = false

async function seedRefreshTasks() {
  const out = await api('/tasks')
  const tasks = Array.isArray(out?.refresh) ? out.refresh : []
  if (!tasks.length) return 0
  const store = await chrome.storage.local.get([IG_QUEUE_KEY])
  const queue = Array.isArray(store[IG_QUEUE_KEY]) ? store[IG_QUEUE_KEY] : []
  const have = new Set(queue.map((q) => q.id))
  let added = 0
  for (const t of tasks) {
    if (!t?.id || have.has(t.id)) continue
    queue.push({ id: t.id, carousel: false, video: !!t.video, tries: 0 })
    have.add(t.id)
    added++
  }
  if (added) {
    await chrome.storage.local.set({ [IG_QUEUE_KEY]: queue.slice(0, 12000) })
    setDiag(`IG backfill: refreshing ${added} expiring video links`)
  }
  return added
}

async function processIgQueue(max = 24) {
  if (igQueueRunning) return
  igQueueRunning = true
  try {
    const store = await chrome.storage.local.get([
      IG_QUEUE_KEY,
      IG_DONE_KEY,
      IG_COOLDOWN_KEY,
      IG_PAUSE_NO_KEY
    ])
    const queue = Array.isArray(store[IG_QUEUE_KEY]) ? store[IG_QUEUE_KEY] : []
    const cooldownUntil = Number(store[IG_COOLDOWN_KEY]) || 0
    if (!queue.length) {
      if (Date.now() < cooldownUntil) return
      await seedRefreshTasks()
      return
    }
    if (Date.now() < cooldownUntil) {
      const mins = Math.max(1, Math.round((cooldownUntil - Date.now()) / 60000))
      setDiag(`IG backfill: paused ${mins}m (IG throttling) · ${queue.length} queued`)
      return
    }
    const doneIds = Array.isArray(store[IG_DONE_KEY]) ? store[IG_DONE_KEY] : []
    const batch = queue.slice(0, max)
    const rest = queue.slice(max)
    const succeeded = []
    const failed = []
    let cursor = 0
    const worker = async () => {
      while (cursor < batch.length) {
        const entry = batch[cursor++]
        const out = await probeIgPost(entry)
        if (out && typeof out === 'object') succeeded.push({ entry, patch: out })
        else {
          const reason = typeof out === 'string' ? out : 'no-data'
          const isEnv = /error page|load-timeout/i.test(reason)
          failed.push({
            ...entry,
            tries: (entry.tries || 0) + (isEnv ? 0 : 1),
            err: reason
          })
        }
      }
    }
    await Promise.all([worker(), worker(), worker()])

    let delivered = 0
    if (succeeded.length) {
      const out = await api('/ingest', { items: succeeded.map((s) => s.patch) })
      if (out?.ok) {
        delivered = succeeded.length
        for (const s of succeeded) {
          if (s.entry.video && !s.patch.mediaUrl) {
            failed.push({ ...s.entry, tries: (s.entry.tries || 0) + 1, err: 'no-video-url' })
          } else if (!doneIds.includes(s.entry.id)) {
            doneIds.push(s.entry.id)
          }
        }
      } else {
        for (const s of succeeded) failed.push({ ...s.entry, tries: (s.entry.tries || 0) + 1 })
      }
    }
    const keep = [...rest, ...failed.filter((f) => f.tries < 4)]
    for (const f of failed.filter((f) => f.tries >= 4)) {
      if (!doneIds.includes(f.id)) doneIds.push(f.id)
    }
    const pause = !delivered && failed.length >= Math.ceil(batch.length / 2)
    const patch = { [IG_QUEUE_KEY]: keep, [IG_DONE_KEY]: doneIds.slice(-20000) }
    let pauseMins = 0
    if (pause) {
      const pauseNo = (Number(store[IG_PAUSE_NO_KEY]) || 0) + 1
      pauseMins = Math.min(120, 30 * pauseNo)
      patch[IG_COOLDOWN_KEY] = Date.now() + pauseMins * 60 * 1000
      patch[IG_PAUSE_NO_KEY] = pauseNo
    } else if (delivered) {
      patch[IG_PAUSE_NO_KEY] = 0
    }
    await chrome.storage.local.set(patch)
    if (pause) {
      setDiag(`IG backfill: paused ${pauseMins}m (IG throttling) · ${keep.length} queued`)
    } else if (delivered) {
      setDiag(`IG backfill: ${delivered} updated · ${keep.length} queued`)
    } else if (keep.length) {
      const firstErr = failed.find((f) => f.err)?.err || ''
      setDiag(
        `IG backfill: ${failed.length} failed${firstErr ? ` (${firstErr})` : ''} · ${keep.length} queued`
      )
    } else {
      setDiag('IG backfill: complete')
    }
  } finally {
    igQueueRunning = false
  }
}

async function enrichInstagram(items) {
  const targets = items.filter(
    (i) =>
      i.source === 'instagram_save' &&
      ((i.mediaType === 'video' && !i.mediaUrl) ||
        !i.thumb ||
        (i.carousel && (!Array.isArray(i.images) || i.images.length < 2)))
  )
  if (targets.length) await queueIgTargets(targets)
  return items
}

async function ingest(rawItems, options = {}) {
  if (!rawItems?.length) return null
  const items = await enrichVideos(await enrichInstagram(rawItems))
  const out = await api('/ingest', { items })
  if (out?.ok) {
    const inserted = out.inserted || 0
    if (!options.quiet || inserted > 0) {
      const state = out.inbox ? ` · ${out.inbox} in inbox` : ''
      setDiag(`Sent ${inserted} new item${inserted === 1 ? '' : 's'}${state}`)
    }
  } else if (out?.rejected?.length) {
    setDiag(`Rejected: ${out.rejected[0].reason}`)
  } else if (out?.error === 'offline') {
    await queuePending(items)
    setDiag(
      `Gather app offline — queued ${items.length} save${items.length === 1 ? '' : 's'} for retry`
    )
  }
  updateBadge()
  return out
}

async function backfillBookmarks() {
  const tree = await chrome.bookmarks.getTree()
  const items = []
  const walk = (nodes, folder) => {
    for (const node of nodes) {
      if (node.url) {
        items.push({
          source: 'bookmark',
          externalId: node.id,
          url: node.url,
          title: node.title || node.url,
          folder,
          savedAt: node.dateAdded
        })
      } else {
        const next = node.title ? (folder ? `${folder}/${node.title}` : node.title) : folder
        walk(node.children || [], next)
      }
    }
  }
  walk(tree, '')

  let inserted = 0
  for (let i = 0; i < items.length; i += 50) {
    const out = await ingest(items.slice(i, i + 50))
    inserted += out?.inserted || 0
  }
  await api('/sync-state', {
    source: 'bookmark',
    initialBackfillDone: true,
    lastSyncedAt: Date.now()
  })
  setDiag(
    items.length
      ? `Bookmarks: ${inserted} new of ${items.length} scanned`
      : 'Bookmarks: Chrome profile has no bookmarks to import'
  )
  updateBadge()
  return { total: items.length, inserted }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const isReady = (tab) => !!tab && tab.status === 'complete' && /^https?:/.test(tab.url || '')

const waitForTab = (tabId, timeout = 30000) =>
  new Promise((resolve) => {
    let done = false
    const finish = (tab) => {
      if (done) return
      done = true
      chrome.tabs.onUpdated.removeListener(onUpdated)
      clearInterval(poll)
      clearTimeout(timer)
      resolve(tab)
    }
    const check = async () => {
      try {
        const tab = await chrome.tabs.get(tabId)
        if (isReady(tab)) finish(tab)
      } catch {
        finish(null)
      }
    }
    const onUpdated = (id, info) => {
      if (id === tabId && info.status === 'complete') check()
    }
    const timer = setTimeout(() => finish(null), timeout)
    const poll = setInterval(check, 900)
    chrome.tabs.onUpdated.addListener(onUpdated)
    check()
  })

async function settledTab(tabId, fallback, delay = 2000) {
  await sleep(delay)
  try {
    return await chrome.tabs.get(tabId)
  } catch {
    return fallback
  }
}

const X_SAVED_PAGES = [
  'https://x.com/i/bookmarks*',
  'https://x.com/i/history*',
  'https://twitter.com/i/bookmarks*',
  'https://twitter.com/i/history*'
]

const isXSavedPage = (url) => /\/i\/(bookmarks|history)/.test(url || '')

const pathOf = (url) => {
  try {
    return new URL(url).pathname
  } catch {
    return url || 'unknown'
  }
}

async function rescanTab(tabId, file) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'rescan' })
  } catch {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: [file] })
    } catch (err) {
      setDiag('Chrome is blocking access to this site — set Site access to "On all sites"')
      throw err
    }
    return await chrome.tabs.sendMessage(tabId, { type: 'rescan' })
  }
}

async function importX() {
  const tabs = await chrome.tabs.query({ url: X_SAVED_PAGES })
  let tabId = tabs[0]?.id
  if (tabId) {
    await chrome.tabs.update(tabId, { active: true })
  } else {
    setDiag('Opening x.com/i/bookmarks\u2026')
    const tab = await chrome.tabs.create({ url: 'https://x.com/i/bookmarks', active: true })
    tabId = tab.id
  }
  const loaded = await waitForTab(tabId)
  if (!loaded) {
    setDiag('The X tab did not finish loading — try again')
    return { ok: true, counted: 0, blocked: 'timeout' }
  }
  const settled = await settledTab(tabId, loaded)
  const url = settled?.url || loaded.url || ''
  if (!isXSavedPage(url)) {
    const landed = pathOf(url)
    const isLogin = /login|flow/.test(url)
    setDiag(
      isLogin
        ? `X is not signed in (landed on ${landed}) — sign in to x.com, then click Import bookmarks`
        : `X tab landed on ${landed} — open your X bookmarks page and retry`
    )
    return { ok: true, counted: 0, blocked: isLogin ? 'login' : 'other', landed }
  }
  try {
    const out = await rescanTab(tabId, 'content/x.js')
    if (!out?.ok) {
      setDiag(`X page not ready (${out?.error || 'unknown'}) — reload the tab and retry`)
      return { ok: true, counted: 0 }
    }
    return { ok: true, counted: out.count ?? 0 }
  } catch {
    return { ok: false, error: 'site-access' }
  }
}

async function importInstagram() {
  const { igUser } = await getConfig()
  const tabs = await chrome.tabs.query({ url: ['https://www.instagram.com/*saved*'] })
  let tabId = tabs[0]?.id
  if (tabId) {
    await chrome.tabs.update(tabId, { active: true })
  } else {
    const url = igUser
      ? `https://www.instagram.com/${encodeURIComponent(igUser)}/saved/all-posts/`
      : 'https://www.instagram.com/'
    setDiag(igUser ? 'Opening your Instagram Saved page…' : 'Set your Instagram username in Options')
    const tab = await chrome.tabs.create({ url, active: true })
    tabId = tab.id
    if (!igUser) return { ok: true, counted: 0, needsUser: true }
  }
  const loaded = await waitForTab(tabId)
  if (!loaded) {
    setDiag('The Instagram tab did not finish loading — try again')
    return { ok: true, counted: 0, blocked: 'timeout' }
  }
  const settled = await settledTab(tabId, loaded)
  const url = settled?.url || loaded.url || ''
  if (!url.includes('saved')) {
    setDiag(`Instagram landed on ${pathOf(url)} — open your Saved page and click Import saved`)
    return { ok: true, counted: 0, blocked: 'not-saved', landed: pathOf(url) }
  }
  try {
    const out = await rescanTab(tabId, 'content/instagram.js')
    return { ok: true, counted: out?.count ?? 0 }
  } catch {
    return { ok: false, error: 'site-access' }
  }
}

async function importPinterest() {
  try {
    setDiag('Pinterest: looking for a tab…')
    const all = await chrome.tabs.query({})
    const existing = all.filter((t) => /^https:\/\/[a-z0-9-]*\.?pinterest\./.test(t.url || ''))
    let tabId = existing[0]?.id
    if (tabId) {
      setDiag('Pinterest: using your open tab…')
      await chrome.tabs.update(tabId, { active: true })
    } else {
      setDiag('Pinterest: opening your boards…')
      const tab = await chrome.tabs.create({
        url: 'https://www.pinterest.com/me/boards/',
        active: true
      })
      tabId = tab.id
    }
    const loaded = await waitForTab(tabId)
    if (!loaded) {
      setDiag('Pinterest: the boards page did not finish loading — try again')
      return { ok: false, error: 'timeout' }
    }
    setDiag('Pinterest: starting the board scan…')
    try {
      const out = await chrome.tabs.sendMessage(tabId, { type: 'pin-start' })
      if (out?.ok) return { ok: true }
    } catch {
      /* content script not present yet */
    }
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content/pinterest.js'] })
    } catch (err) {
      const t = await chrome.tabs.get(tabId).catch(() => null)
      const where = String(t?.url || 'unknown').replace(/^https?:\/\//, '').slice(0, 60)
      setDiag(`Pinterest: Chrome blocked the page script at ${where} — check sign-in and "On all sites" access`)
      return { ok: false, error: 'site-access', detail: String(err?.message || err) }
    }
    const out = await chrome.tabs.sendMessage(tabId, { type: 'pin-start' }).catch(() => null)
    if (out?.ok) return { ok: true }
    setDiag('Pinterest: could not reach the page script — reload pinterest.com and retry')
    return { ok: false, error: 'no-content' }
  } catch (err) {
    setDiag(`Pinterest: failed — ${String(err?.message || err).slice(0, 80)}`)
    return { ok: false, error: String(err?.message || err) }
  }
}

async function watchSavedPage({ match, url, delay = 2000, accept, deep = false, active = false }) {
  const tabs = await chrome.tabs.query({ url: match })
  let tabId = tabs[0]?.id
  let created = false
  if (!tabId) {
    const tab = await chrome.tabs.create({ url, active })
    tabId = tab.id
    created = true
  }
  try {
    const loaded = await waitForTab(tabId)
    if (!loaded) return null
    const settled = await settledTab(tabId, loaded, delay)
    const finalUrl = settled?.url || loaded.url || ''
    if (!accept(finalUrl)) return null
    return await chrome.tabs
      .sendMessage(tabId, { type: deep ? 'rescan' : 'quick-scan' })
      .catch(() => null)
  } finally {
    if (created && tabId !== undefined) chrome.tabs.remove(tabId).catch(() => {})
  }
}

let watching = false

async function watchTick() {
  if (watching) return
  watching = true
  try {
    const { token, watchMinutes, igUser } = await getConfig()
    if (!token || !watchMinutes) return
    const state = await api('/state')
    if (!state?.ok) return
    const sources = state.sources || {}
    const x = sources.x_bookmark
    if (x?.enabled !== false && x?.initialBackfillDone) {
      try {
        await watchSavedPage({
          match: X_SAVED_PAGES,
          url: 'https://x.com/i/bookmarks',
          accept: isXSavedPage
        })
      } catch {
        /* retry on next tick */
      }
    }
    const ig = sources.instagram_save
    if (igUser && ig?.enabled !== false && ig?.initialBackfillDone) {
      try {
        await watchSavedPage({
          match: ['https://www.instagram.com/*saved*'],
          url: `https://www.instagram.com/${encodeURIComponent(igUser)}/saved/all-posts/`,
          delay: 4000,
          accept: (u) => u.includes('saved')
        })
      } catch {
        /* retry on next tick */
      }
    }
  } finally {
    watching = false
  }
}

async function syncWatchAlarm() {
  const { watchMinutes } = await getConfig()
  await chrome.alarms.clear('gather-watch')
  if (watchMinutes > 0) {
    chrome.alarms.create('gather-watch', {
      delayInMinutes: 2,
      periodInMinutes: watchMinutes
    })
  }
}

syncWatchAlarm()
chrome.storage.onChanged.addListener((changes) => {
  if (changes.watchMinutes) syncWatchAlarm()
})

async function igContinuePass() {
  const { igUser } = await getConfig()
  if (!igUser) return -1
  const idleState = await chrome.idle.queryState(180)
  if (idleState !== 'idle') return -1
  const out = await watchSavedPage({
    match: ['https://www.instagram.com/*saved*'],
    url: `https://www.instagram.com/${encodeURIComponent(igUser)}/saved/all-posts/`,
    delay: 4000,
    accept: (u) => u.includes('saved'),
    deep: true,
    active: true
  })
  return out?.count ?? 0
}

let igPassing = false

async function igContinueTick() {
  chrome.alarms.create('ig-continue', { delayInMinutes: 10 })
  if (igPassing) return
  igPassing = true
  try {
    const counted = await igContinuePass()
    if (counted === -1) return
    const { igScanCount = 0, igQuiet = 0 } = await chrome.storage.local.get([
      'igScanCount',
      'igQuiet'
    ])
    if (counted > igScanCount) {
      await chrome.storage.local.set({ igScanCount: counted, igQuiet: 0 })
      setDiag(`Instagram: ${counted} saves imported so far — still catching up…`)
    } else {
      const quiet = igQuiet + 1
      await chrome.storage.local.set({ igQuiet: quiet })
      if (quiet >= 3) {
        chrome.alarms.clear('ig-continue')
        if (counted > 0) setDiag(`Instagram: backfill complete — ${counted} saves in your library`)
      }
    }
  } finally {
    igPassing = false
  }
}

async function igNoteProgress(counted) {
  if (!counted) return
  const { igScanCount = 0 } = await chrome.storage.local.get('igScanCount')
  if (counted > igScanCount) {
    await chrome.storage.local.set({ igScanCount: counted, igQuiet: 0 })
    chrome.alarms.create('ig-continue', { delayInMinutes: 10 })
  }
}

async function scanActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id) return { ok: false, error: 'no-tab' }
  try {
    const out = await chrome.tabs.sendMessage(tab.id, { type: 'rescan' })
    return { ok: true, ...(out || {}) }
  } catch {
    return { ok: false, error: 'no-scraper-on-page' }
  }
}

async function rescanOpenTabs() {
  const tabs = await chrome.tabs.query({
    url: [...X_SAVED_PAGES, 'https://www.instagram.com/*saved*']
  })
  for (const tab of tabs) {
    if (tab.id) chrome.tabs.sendMessage(tab.id, { type: 'rescan' }, () => void chrome.runtime.lastError)
  }
  updateBadge()
}

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg?.type === 'ingest') {
    ingest(msg.items, { quiet: msg.quiet === true }).then((result) => respond({ ok: true, result }))
    return true
  }
  if (msg?.type === 'backfill-bookmarks') {
    backfillBookmarks().then(
      (result) => respond({ ok: true, ...result }),
      (err) => respond({ ok: false, error: String(err) })
    )
    return true
  }
  if (msg?.type === 'scan-active-tab') {
    scanActiveTab().then((result) => respond(result))
    return true
  }
  if (msg?.type === 'import-x') {
    importX().then((result) => respond(result), (err) => respond({ ok: false, error: String(err) }))
    return true
  }
  if (msg?.type === 'import-pinterest') {
    importPinterest().then(
      (result) => respond(result),
      (err) => respond({ ok: false, error: String(err) })
    )
    return true
  }
  if (msg?.type === 'import-ig') {
    importInstagram().then(
      async (result) => {
        if (result?.counted > 0) await igNoteProgress(result.counted)
        respond(result)
      },
      (err) => respond({ ok: false, error: String(err) })
    )
    return true
  }
  if (msg?.type === 'state') {
    api('/state').then((state) => respond(state))
    return true
  }
  if (msg?.type === 'diag') {
    diagLoaded.then(() => respond(diag))
    return true
  }
  if (msg?.type === 'scan-result') {
    if (msg.probe) {
      chrome.storage.local.set({ igProbe: String(msg.probe).slice(0, 4000) })
      setDiag('Instagram: captured tile DOM probe')
      return false
    }
    const label =
      msg.source === 'instagram_save'
        ? 'Instagram'
        : msg.source === 'pinterest_save'
          ? 'Pinterest'
          : 'X'
    if (msg.live) setDiag(`${label}: saved item captured`)
    else if (msg.reason === 'no-timeline') setDiag(`${label}: no timeline found — reload the page or sign in`)
    else if (msg.done) {
      setDiag(`${label}: import complete — ${msg.count} items found`)
      api('/sync-state', { source: msg.source, initialBackfillDone: true, lastSyncedAt: Date.now() })
      if (msg.source === 'instagram_save') processIgQueue()
    }
    else setDiag(`${label}: importing… ${msg.count} found so far`)
    updateBadge()
    return false
  }
  return false
})

chrome.bookmarks.onCreated.addListener((_id, node) => {
  if (!node?.url) return
  ingest([
    {
      source: 'bookmark',
      externalId: node.id,
      url: node.url,
      title: node.title || node.url,
      folder: '',
      savedAt: node.dateAdded || Date.now()
    }
  ])
})

chrome.alarms.create('gather-rescan', { periodInMinutes: 1440 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'gather-rescan') rescanOpenTabs()
})

chrome.runtime.onInstalled.addListener(async () => {
  const { token } = await getConfig()
  setDiag(token ? 'Extension updated — backfilling bookmarks\u2026' : 'Add your token in Options')
  if (token) backfillBookmarks()
  updateBadge()
})

chrome.runtime.onStartup.addListener(async () => {
  const { token } = await getConfig()
  if (token) backfillBookmarks()
  updateBadge()
})

setTimeout(() => {
  processIgQueue().catch(() => {})
}, 4000)
