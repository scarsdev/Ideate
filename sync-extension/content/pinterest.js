;(() => {
  const VERSION = chrome.runtime.getManifest().version
  if (window.__gatherPinterest === VERSION) return
  window.__gatherPinterest = VERSION

  const STATE_KEY = 'pinImport'
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

  const RESERVED = new Set([
    'pin',
    'ideas',
    'search',
    'resource',
    'login',
    'signup',
    'business',
    'settings',
    'me',
    'today',
    'explore',
    'notifications',
    'messages'
  ])

  const SKIP_SLUGS = new Set([
    'saved',
    '_saved',
    '_boards',
    'pins',
    'boards',
    'followers',
    'following',
    'activity',
    'tried',
    'created',
    'interests'
  ])

  const isTabSlug = (s) => typeof s === 'string' && (s.startsWith('_') || SKIP_SLUGS.has(s))

  const cleanBoardName = (raw) => {
    const line = String(raw || '').split('\n')[0]
    const cut = line.split(/,\s*\d+\s*Pins?\b|\s+\d+\s*Pins?\b/)[0]
    const name = cut.replace(/[,\s]+$/, '').trim()
    return (name || line.split(',')[0].trim()).slice(0, 80)
  }

  const boardFromPath = () => {
    const parts = location.pathname.split('/').filter(Boolean)
    if (parts.length >= 2 && !RESERVED.has(parts[0]) && !isTabSlug(parts[1])) {
      return {
        user: parts[0],
        slug: parts[1],
        name: decodeURIComponent(parts[1]).replace(/-/g, ' ')
      }
    }
    return null
  }

  const isBoardsPage = () => /\/_?boards\/?$/.test(location.pathname)
  const isSavedPage = () => /\/_?saved\/?$/.test(location.pathname)
  const isPinPage = () => /\/pin\//.test(location.pathname)

  const getState = () =>
    new Promise((res) => chrome.storage.local.get(STATE_KEY, (o) => res(o[STATE_KEY] || null)))
  const setState = (s) => new Promise((res) => chrome.storage.local.set({ [STATE_KEY]: s }, res))
  const clearState = () => new Promise((res) => chrome.storage.local.remove(STATE_KEY, res))

  const tell = (payload) => {
    try {
      chrome.runtime.sendMessage(payload).catch(() => {})
    } catch {
      /* ignore */
    }
  }

  const sampleHrefs = () =>
    [...document.querySelectorAll('a[href]')].slice(0, 80).map((a) => a.getAttribute('href'))

  function boardLinkFrom(node) {
    for (const la of node.querySelectorAll('a[href]')) {
      const lh = la.getAttribute('href') || ''
      if (!lh.startsWith('/') || lh.includes('/pin/')) continue
      const bm = lh.match(/^\/([^/?#]+)\/([^/?#]+)\/?(?:[?#]|$)/)
      if (!bm || RESERVED.has(bm[1]) || isTabSlug(bm[2])) continue
      const name =
        cleanBoardName(la.textContent) || decodeURIComponent(bm[2]).replace(/-/g, ' ')
      return {
        boardUrl: `https://${location.hostname}${lh.split(/[?#]/)[0]}`,
        boardName: name
      }
    }
    return null
  }

  function scanPins() {
    const out = []
    const seen = new Set()
    for (const a of document.querySelectorAll('a[href*="/pin/"]')) {
      const m = (a.getAttribute('href') || '').match(/\/pin\/(\d+)/)
      if (!m) continue
      const id = m[1]
      if (seen.has(id)) continue
      const holder = a.querySelector('img[src*="pinimg.com"]') ? a : a.parentElement
      const img = holder?.querySelector?.('img[src*="pinimg.com"]')
      if (!img) continue
      seen.add(id)
      const raw = img.currentSrc || img.src || ''
      const thumb = raw.replace(/\/(236x|474x|564x|736x|originals)\//, '/564x/')
      const pin = {
        id,
        url: `https://www.pinterest.com/pin/${id}/`,
        title: (img.alt || '').slice(0, 200),
        thumb
      }
      let node = a
      for (let d = 0; d < 7 && node; d++) {
        node = node.parentElement
        if (!node) break
        const bl = boardLinkFrom(node)
        if (bl) {
          pin.boardUrl = bl.boardUrl
          pin.boardName = bl.boardName
          break
        }
      }
      out.push(pin)
    }
    return out
  }

  function scanBoards() {
    const out = []
    const seen = new Set()
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') || ''
      if (!href.startsWith('/') || href.includes('/pin/')) continue
      const m = href.match(/^\/([^/?#]+)\/([^/?#]+)\/?(?:[?#]|$)/)
      if (!m || RESERVED.has(m[1]) || isTabSlug(m[2])) continue
      const url = `https://${location.hostname}${href.split(/[?#]/)[0]}`
      if (seen.has(url)) continue
      seen.add(url)
      const text = cleanBoardName(a.textContent)
      out.push({ url, name: text || decodeURIComponent(m[2]).replace(/-/g, ' ') })
    }
    return out
  }

  function ingestItems(pins, fallbackBoard, fallbackUrl) {
    if (!pins.length) return
    tell({
      type: 'ingest',
      quiet: true,
      items: pins.map((p) => ({
        source: 'pinterest_save',
        externalId: p.id,
        url: p.url,
        title: p.title,
        thumb: p.thumb,
        board: p.boardName || fallbackBoard,
        boardUrl: p.boardUrl || fallbackUrl
      }))
    })
  }

  async function debugOut(why, state) {
    await new Promise((res) =>
      chrome.storage.local.set(
        {
          pinDebug: {
            at: Date.now(),
            why,
            url: location.href,
            hops: state?.hops || [],
            sample: sampleHrefs()
          }
        },
        res
      )
    )
  }

  async function finish(count, state) {
    if (!count) await debugOut('finish-0', state)
    await clearState()
    tell({ type: 'scan-result', source: 'pinterest_save', done: true, count })
  }

  async function crawlPins(state, fallbackBoard, fallbackUrl) {
    const seen = new Set(Array.isArray(state.seen) ? state.seen : [])
    let stagnant = 0
    let total = state.count || 0
    for (let round = 0; round < 90 && stagnant < 6; round++) {
      const pins = scanPins().filter((p) => !seen.has(p.id))
      if (pins.length) {
        pins.forEach((p) => seen.add(p.id))
        ingestItems(pins, fallbackBoard, fallbackUrl)
        total += pins.length
        state.count = total
        state.seen = [...seen].slice(-30000)
        await setState(state)
        tell({
          type: 'scan-result',
          source: 'pinterest_save',
          importing: true,
          count: total,
          boards: state.queue?.length || 0
        })
        stagnant = 0
      } else {
        stagnant++
      }
      window.scrollTo(0, document.body.scrollHeight)
      await sleep(1300)
    }
    return total
  }

  async function scanBoardsPhase(state) {
    await sleep(1800)
    const seenB = new Set()
    const boards = []
    let stagnant = 0
    for (let r = 0; r < 60 && stagnant < 5; r++) {
      const found = scanBoards().filter((b) => !seenB.has(b.url))
      found.forEach((b) => seenB.add(b.url))
      if (found.length) {
        boards.push(...found)
        stagnant = 0
      } else {
        stagnant++
      }
      window.scrollTo(0, document.body.scrollHeight)
      await sleep(1100)
    }
    const queue = boards.slice(0, 80)
    if (!queue.length) return finish(0, state)
    tell({
      type: 'scan-result',
      source: 'pinterest_save',
      importing: true,
      count: state.count || 0,
      boards: queue.length
    })
    state.queue = queue
    state.phase = 'scan'
    state.count = state.count || 0
    state.seen = state.seen || []
    await setState(state)
    location.href = queue[0].url
  }

  async function runWalker() {
    const state = await getState()
    if (!state?.active) return
    state.hops = state.hops || []
    state.hops.push(location.href)
    if (state.hops.length > 14) state.hops = state.hops.slice(-14)

    if (state.phase === 'saved') {
      await crawlPins(state, 'Pinterest saves', location.href)
      return finish(state.count || 0, state)
    }

    if (state.phase === 'boards' || isBoardsPage()) {
      if (!isBoardsPage()) {
        state.loop = (state.loop || 0) + 1
        await setState(state)
        if (isSavedPage() && state.loop >= 2) {
          state.phase = 'saved'
          await setState(state)
          await crawlPins(state, 'Pinterest saves', location.href)
          return finish(state.count || 0, state)
        }
        if (state.loop > 4) return finish(state.count || 0, state)
        const tabLink = [...document.querySelectorAll('a[href]')].find((el) =>
          /\/(_?boards)\/?$/.test(el.getAttribute('href') || '')
        )
        if (tabLink) {
          tabLink.click()
          await sleep(1800)
          if (isBoardsPage()) {
            await scanBoardsPhase(state)
            return
          }
        }
        const parts = location.pathname.split('/').filter(Boolean)
        const user = parts[0] && !RESERVED.has(parts[0]) ? parts[0] : null
        const host = /pinterest\./.test(location.hostname)
          ? location.hostname
          : 'www.pinterest.com'
        location.href = user
          ? `https://${host}/${user}/boards/`
          : `https://${host}/me/boards/`
        return
      }

      await scanBoardsPhase(state)
      return
    }

    const here = boardFromPath()
    if (state.queue?.length && here && state.queue[0].url.includes(`/${here.user}/${here.slug}/`)) {
      await crawlPins(state, state.queue[0].name, state.queue[0].url)
      state.queue.shift()
      if (state.queue.length) {
        await setState(state)
        location.href = state.queue[0].url
        return
      }
      return finish(state.count || 0, state)
    }

    if (isSavedPage()) {
      state.phase = 'saved'
      await setState(state)
      await crawlPins(state, 'Pinterest saves', location.href)
      return finish(state.count || 0, state)
    }

    location.href = state.queue?.[0]?.url || `https://${location.hostname}/me/boards/`
  }

  chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
    if (msg?.type === 'pin-start') {
      clearState()
        .then(() =>
          setState({ active: true, phase: 'boards', queue: [], count: 0, seen: [], loop: 0 })
        )
        .then(() => {
          respond?.({ ok: true })
          runWalker()
        })
      return true
    }
    if (msg?.type === 'rescan' || msg?.type === 'quick-scan') {
      const here = boardFromPath()
      if (!here) {
        respond?.({ ok: true, count: 0 })
        return true
      }
      const pins = scanPins()
      ingestItems(pins, here.name, location.href)
      respond?.({ ok: true, count: pins.length })
      return true
    }
    return false
  })

  const liveSeen = new Set()
  if (!isPinPage()) {
    setInterval(() => {
      if (document.hidden) return
      getState().then((s) => {
        if (s?.active) return
        const here = boardFromPath()
        if (!here) return
        const fresh = scanPins().filter((p) => !liveSeen.has(p.id))
        if (!fresh.length) return
        fresh.forEach((p) => liveSeen.add(p.id))
        ingestItems(fresh, here.name, location.href)
      })
    }, 15000)
  }

  runWalker()
})()
