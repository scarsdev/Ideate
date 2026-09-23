(() => {
  const EXT_VERSION = chrome.runtime.getManifest().version
  if (window.__gatherCaptureIG === EXT_VERSION) return
  window.__gatherCaptureIG = EXT_VERSION

  const SEL = {
    save: 'svg[aria-label="Save"], svg[aria-label="Remove"]',
    post: 'a[href*="/p/"], a[href*="/reel/"]',
    caption: 'h1',
    time: 'time[datetime]'
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

  const report = (payload) =>
    chrome.runtime.sendMessage({ type: 'scan-result', source: 'instagram_save', ...payload })

  const isSaved = () => location.pathname.includes('saved')

  function isPostLink(el) {
    return el?.matches?.(SEL.post) ? el : el?.querySelector?.(SEL.post)
  }

  function postData(root) {
    const link = isPostLink(root)
    if (!link) return null
    const href = link.getAttribute('href') || ''
    const code = (href.match(/\/(?:p|reel)\/([\w-]+)/) || [])[1]
    if (!code) return null

    const caption = root?.querySelector?.(SEL.caption)?.innerText || ''
    const img = [...(root?.querySelectorAll?.('img[src^="https"]') || [])].find(
      (i) => !/s150x150|150x150|profile/.test(i.getAttribute('src') || '')
    )
    const datetime = root?.querySelector?.(SEL.time)?.getAttribute('datetime') || ''
    const videoEl = root?.querySelector?.('video')
    const isCarousel = !!root?.querySelector?.('[aria-label="Carousel"]')
    const isClip = !!root?.querySelector?.('[aria-label="Clip"]')
    let mediaUrl = ''
    let mediaType = ''
    let thumb = img?.getAttribute('src') || ''
    if (videoEl || isClip) {
      mediaType = 'video'
    }
    if (videoEl) {
      const src = videoEl.currentSrc || videoEl.getAttribute('src') || ''
      if (/^https?:\/\//.test(src)) mediaUrl = src
      if (!thumb) {
        const poster = videoEl.getAttribute('poster') || ''
        if (/^https?:\/\//.test(poster)) thumb = poster
      }
    }

    return {
      source: 'instagram_save',
      externalId: code,
      url: `https://www.instagram.com/p/${code}/`,
      title: clip(caption.split('\n')[0], 140) || 'Instagram save',
      text: caption,
      author: '',
      thumb,
      mediaUrl,
      mediaType,
      carousel: isCarousel,
      savedAt: datetime ? Date.parse(datetime) : Date.now()
    }
  }

  const saveLabel = (el) =>
    el?.getAttribute?.('aria-label') ||
    el?.closest?.('[aria-label]')?.getAttribute?.('aria-label') ||
    ''

  document.addEventListener(
    'click',
    (e) => {
      const svg = e.target?.closest?.(SEL.save)
      if (!svg) return
      if (/remove|saved/i.test(saveLabel(svg))) return // already saved: this click removes it
      const root = svg.closest('article') || document
      const href = root.querySelector?.(SEL.post)?.getAttribute('href') || ''
      const code = (href.match(/\/(?:p|reel)\/([\w-]+)/) || [])[1]
      setTimeout(() => {
        const fresh =
          (code &&
            [...document.querySelectorAll(SEL.post)]
              .find((a) => (a.getAttribute('href') || '').includes(`/${code}/`))
              ?.closest('article')) ||
          (document.contains(root) ? root : null)
        const freshBtn = fresh ? fresh.querySelector(SEL.save) : null
        if (!freshBtn || !/remove|saved/i.test(saveLabel(freshBtn))) return
        const data = postData(fresh || root)
        if (!data) return
        send([data])
        report({ count: 1, live: true })
      }, 800)
    },
    true
  )

  async function waitForTimeline(timeout = 25000) {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (document.querySelector(SEL.post)) return true
      await wait(400)
    }
    return false
  }

  let scanning = false
  let scannedPath = ''
  let probed = false

  function probeTiles() {
    const anchors = [...document.querySelectorAll(SEL.post)].slice(0, 12)
    return JSON.stringify(
      anchors.map((a, i) => ({
        i,
        href: (a.getAttribute('href') || '').slice(0, 24),
        imgs: a.querySelectorAll('img').length,
        vids: a.querySelectorAll('video').length,
        labels: [...a.querySelectorAll('[aria-label]')]
          .map((e) => e.getAttribute('aria-label'))
          .filter(Boolean)
          .slice(0, 5),
        svgTitles: [...a.querySelectorAll('svg title')]
          .map((t) => t.textContent)
          .filter(Boolean)
          .slice(0, 3),
        roles: [...a.querySelectorAll('[role="img"]')]
          .map((e) => e.getAttribute('aria-label') || '')
          .filter(Boolean)
          .slice(0, 3)
      }))
    )
  }

  async function scan() {
    if (scanning || !isSaved()) return 0
    scanning = true
    try {
      if (!(await waitForTimeline())) {
        const cleaned = location.pathname.replace(/\/+$/, '')
        if (/\/saved$/.test(cleaned)) {
          report({ count: 0, reason: 'collections-view' })
          location.assign(`${cleaned}/all-posts/`)
          return 0
        }
        report({ count: 0, reason: 'no-timeline' })
        return 0
      }

      if (!probed) {
        probed = true
        report({ probe: probeTiles() })
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

      for (let round = 0; round < 4000 && idle < 48 && seen.size < LIMIT; round++) {
        const before = seen.size
        document.querySelectorAll(SEL.post).forEach((link) => {
          const data = postData(link)
          if (data && !seen.has(data.externalId)) {
            seen.set(data.externalId, data)
            pending.push(data)
          }
        })
        if (pending.length >= 50) flush()
        idle = seen.size === before ? idle + 1 : 0
        const links = document.querySelectorAll(SEL.post)
        const tail = links[links.length - 1]
        if (tail?.scrollIntoView) tail.scrollIntoView({ block: 'end' })
        window.scrollBy(0, window.innerHeight * 0.6)
        await wait(idle > 12 ? 1200 : idle > 6 ? 900 : 450)
      }
      flush()
      window.scrollTo(0, 0)

      const items = [...seen.values()]
      console.log(`[gather] Instagram scan: ${items.length} saves found (${sent} sent) on ${location.pathname}`)
      report({ count: items.length, sent, done: true })
      return items.length
    } finally {
      scanning = false
    }
  }

  async function quickScan() {
    if (!isSaved()) return 0
    if (!(await waitForTimeline(8000))) {
      const cleaned = location.pathname.replace(/\/+$/, '')
      if (/\/saved$/.test(cleaned)) location.assign(`${cleaned}/all-posts/`)
      return 0
    }
    const seen = new Map()
    document.querySelectorAll('article').forEach((article) => {
      const data = postData(article)
      if (data && !seen.has(data.externalId)) seen.set(data.externalId, data)
    })
    const items = [...seen.values()].filter(usable)
    if (items.length) chrome.runtime.sendMessage({ type: 'ingest', items, quiet: true })
    return items.length
  }

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg?.type === 'quick-scan') {
      if (!isSaved()) {
        respond({ ok: false, error: 'not-on-saved' })
        return true
      }
      quickScan().then((count) => respond({ ok: true, count }))
      return true
    }
    if (msg?.type !== 'rescan') return false
    if (!isSaved()) {
      respond({ ok: false, error: 'not-on-saved' })
      return true
    }
    scan().then((count) => respond({ ok: true, count }))
    return true
  })

  setInterval(() => {
    if (!isSaved()) {
      scannedPath = ''
      return
    }
    if (scannedPath) return
    scannedPath = location.pathname
    scan()
  }, 2000)
})()
