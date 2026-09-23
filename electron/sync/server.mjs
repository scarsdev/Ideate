import http from 'node:http'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-gather-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
}

function send(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    ...CORS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text)
  })
  res.end(text)
}

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('payload too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8') || '{}'))
    req.on('error', reject)
  })
}

export function startSyncServer({ store, token, port = 47821, host = '127.0.0.1', onInsert, onStateChange, onOpen }) {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${host}`)

    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS)
      res.end()
      return
    }

    if (url.pathname === '/health') {
      send(res, 200, { ok: true, app: 'gather', port: server.address()?.port })
      return
    }

    if (req.headers['x-gather-token'] !== token) {
      send(res, 401, { ok: false, error: 'unauthorized' })
      return
    }

    try {
      if (req.method === 'POST' && url.pathname === '/ingest') {
        const body = JSON.parse(await readBody(req))
        const items = Array.isArray(body.items) ? body.items : [body]
        const { inserted, duplicates, enriched, rejected } = store.insert(items)
        if (inserted.length || duplicates.length || rejected.length || items.length) {
          await store.persist()
          onInsert?.([...inserted, ...enriched])
        }
        send(res, 200, {
          ok: true,
          inserted: inserted.length,
          duplicates: duplicates.length,
          enriched: enriched.length,
          rejected,
          inbox: store.summary().inbox
        })
        return
      }

      if (req.method === 'POST' && url.pathname === '/sync-state') {
        const body = JSON.parse(await readBody(req))
        if (!body.source) {
          send(res, 400, { ok: false, error: 'source required' })
          return
        }
        const state = store.setState(body.source, body)
        await store.persist()
        onStateChange?.(body.source, state)
        send(res, 200, { ok: true, state })
        return
      }

      if (req.method === 'GET' && url.pathname === '/tasks') {
        const now = Date.now() / 1000
        const soon = now + 6 * 3600
        const refresh = []
        for (const r of store.rows) {
          if (r.source !== 'instagram_save' || r.hidden) continue
          if (!/^https?:/.test(r.mediaUrl || '')) continue
          const m = String(r.mediaUrl).match(/[?&]oe=([0-9A-Fa-f]+)/)
          if (!m) continue
          const exp = parseInt(m[1], 16)
          if (!exp || exp > soon) continue
          refresh.push({ id: r.externalId, video: true, exp: Math.round(exp) })
        }
        refresh.sort((a, b) => a.exp - b.exp)
        send(res, 200, { ok: true, refresh: refresh.slice(0, 200) })
        return
      }

      if (req.method === 'GET' && url.pathname === '/state') {
        send(res, 200, { ok: true, port: server.address()?.port, ...store.summary() })
        return
      }

      if (req.method === 'POST' && url.pathname === '/open') {
        const focused = await onOpen?.()
        send(res, 200, { ok: !!focused })
        return
      }

      send(res, 404, { ok: false, error: 'not found' })
    } catch (err) {
      send(res, 400, { ok: false, error: String(err.message || err) })
    }
  })

  return new Promise((resolve, reject) => {
    let attempt = port
    const tryBind = () => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempt < port + 24) {
          attempt++
          tryBind()
          return
        }
        reject(err)
      })
      server.listen(attempt, host, () => resolve({ server, port: attempt }))
    }
    tryBind()
  })
}
