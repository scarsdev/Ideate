(() => {
  const EXT_VERSION = chrome.runtime.getManifest().version
  if (window.__gatherCaptureX === EXT_VERSION) return
  window.__gatherCaptureX = EXT_VERSION

  const SEL = {
    tweet: 'article[data-testid="tweet"]',
    text: '[data-testid="tweetText"]',
    user: '[data-testid="User-Name"]',
    bookmark: '[data-testid="bookmark"]',
    time: 'time[datetime]',
    photo: 'img[src*="twimg.com/media"], img[src*="amplify_video_thumb"]'
  }

  const safeText = (v) => {
    const s = String(v ?? '')
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

  const clip = (v, max) => {
    const chars = Array.from(String(v ?? ''))
    return safeText(chars.length <= max ? chars.join('') : chars.slice(0, max).join(''))
  }

  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  const usable = (d) => d && (d.thumb || d.text || d.mediaUrl)

  const send = (items) => {
    const list = items.filter(usable)
    if (list.length) chrome.runtime.sendMessage({ type: 'ingest', items: list })
  }

  const report = (payload) => chrome.runtime.sendMessage({ type: 'scan-result', source: 'x_bookmark', ...payload })

  const isBookmarks = () => /^\/i\/(bookmarks|history)/.test(location.pathname)

  function tweetData(article) {
    if (!article) return null
    const link = article.querySelector('a[href*="/status/"]')
    if (!link) return null
    const id = (link.getAttribute('href').match(/status\/(\d+)/) || [])[1]
    if (!id) return null

    const text = article.querySelector(SEL.text)?.innerText || ''
    const userBlock = article.querySelector(SEL.user)
    const hrefs = [...(userBlock?.querySelectorAll('a[href^="/"]') || [])].map((a) =>
      a.getAttribute('href')
    )
    const handle = hrefs.find((h) => /^\/[A-Za-z0-9_]{2,}$/.test(h)) || ''
    const name = userBlock?.innerText?.split('\n')[0] || handle.replace('/', '')
    const seenMedia = new Set()
    const photos = []
    for (const el of article.querySelectorAll(SEL.photo)) {
      const src = el.getAttribute('src') || ''
      if (!/^https?:/.test(src)) continue
      const base = src.split('?')[0]
      if (seenMedia.has(base)) continue
      seenMedia.add(base)
      photos.push(src)
    }
    const media = photos[0] || ''
    const avatar = article.querySelector('img[src*="profile_images"]')?.getAttribute('src') || ''
    const videoEl = article.querySelector('video')
    let mediaUrl = ''
    let mediaType = ''
    if (videoEl) {
      mediaType = 'video'
      const src =
        videoEl.currentSrc ||
        videoEl.getAttribute('src') ||
        videoEl.querySelector('source')?.getAttribute('src') ||
        ''
      if (/^https?:\/\//.test(src)) mediaUrl = src
    }
    const datetime = article.querySelector(SEL.time)?.getAttribute('datetime') || ''

    return {
      source: 'x_bookmark',
      externalId: id,
      url: `https://x.com${link.getAttribute('href').split('?')[0]}`,
      title: clip(text.split('\n')[0], 140) || `Bookmark by ${name}`,
      text,
      author: handle ? `@${handle.slice(1)}` : name,
      authorName: name,
      avatar,
      mediaUrl,
      mediaType,
      thumb: media,
      images: photos.slice(0, 10),
      savedAt: datetime ? Date.parse(datetime) : Date.now()
    }
  }

  const bookmarkLabel = (btn) =>
    btn.getAttribute('aria-label') ||
    btn.closest('[aria-label]')?.getAttribute('aria-label') ||
    ''

  const toastText = () =>
    [...document.querySelectorAll('[data-testid="toast"]')]
      .map((n) => n.innerText || '')
      .join(' ')

  document.addEventListener(
    'click',
    (e) => {
      const btn = e.target?.closest?.(SEL.bookmark)
      if (!btn) return
      const article = btn.closest(SEL.tweet)
      if (!article) return
      if (/remove/i.test(bookmarkLabel(btn))) return // already bookmarked: this click removes it
      const id = (article.querySelector('a[href*="/status/"]')?.href || '').match(
        /status\/(\d+)/
      )?.[1]
      setTimeout(() => {
        const fresh =
          (id && document.querySelector(`a[href*="/status/${id}"]`)?.closest(SEL.tweet)) ||
          (document.contains(article) ? article : null)
        const freshBtn = fresh ? fresh.querySelector(SEL.bookmark) : null
        const confirmed =
          (freshBtn && /remove/i.test(bookmarkLabel(freshBtn))) ||
          /added to your bookmarks/i.test(toastText())
        if (!confirmed) return
        const data = tweetData(fresh || article)
        if (!data) return
        send([data])
        report({ count: 1, live: true })
      }, 700)
    },
    true
  )

  async function waitForTimeline(timeout = 25000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (document.querySelector(SEL.tweet)) return true
      await wait(400)
    }
    return false
  }

  let scanning = false
  let scannedPath = ''

  async function scan() {
    if (scanning || !isBookmarks()) return 0
    scanning = true
    try {
      if (!(await waitForTimeline())) {
        report({ count: 0, reason: 'no-timeline' })
        return 0
      }

      const seen = new Map()
      const pending = []
      let idle = 0
      let sent = 0
      const flush = () => {
        if (!pending.length) return
        const batch = pending.splice(0, pending.length)
        send(batch)
        sent += batch.length
        report({ count: seen.size, sent })
      }
      const LIMIT = 20000

      for (let round = 0; round < 4000 && idle < 12 && seen.size < LIMIT; round++) {
        const before = seen.size
        document.querySelectorAll(SEL.tweet).forEach((article) => {
          const data = tweetData(article)
          if (data && !seen.has(data.externalId)) {
            seen.set(data.externalId, data)
            pending.push(data)
          }
        })
        if (pending.length >= 50) flush()
        idle = seen.size === before ? idle + 1 : 0
        window.scrollBy(0, window.innerHeight * 0.9)
        await wait(450)
      }
      flush()
      window.scrollTo(0, 0)

      const items = [...seen.values()]
      console.log(`[gather] X scan: ${items.length} bookmarks found (${sent} sent) on ${location.pathname}`)
      report({ count: items.length, sent, done: true })
      return items.length
    } finally {
      scanning = false
    }
  }

  async function quickScan() {
    if (!isBookmarks()) return 0
    if (!(await waitForTimeline(8000))) return 0
    const seen = new Map()
    document.querySelectorAll(SEL.tweet).forEach((article) => {
      const data = tweetData(article)
      if (data && !seen.has(data.externalId)) seen.set(data.externalId, data)
    })
    const items = [...seen.values()].filter(usable)
    if (items.length) chrome.runtime.sendMessage({ type: 'ingest', items, quiet: true })
    return items.length
  }

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg?.type === 'quick-scan') {
      if (!isBookmarks()) {
        respond({ ok: false, error: 'not-on-bookmarks' })
        return true
      }
      quickScan().then((count) => respond({ ok: true, count }))
      return true
    }
    if (msg?.type !== 'rescan') return false
    if (!isBookmarks()) {
      respond({ ok: false, error: 'not-on-bookmarks' })
      return true
    }
    scan().then((count) => respond({ ok: true, count }))
    return true
  })

  setInterval(() => {
    if (!isBookmarks()) {
      scannedPath = ''
      return
    }
    if (scannedPath) return
    scannedPath = location.pathname
    scan()
  }, 2000)
})()
