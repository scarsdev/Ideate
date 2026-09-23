import fs from 'node:fs'
import path from 'node:path'

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
const MODEL = 'jev-latest'

const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-flash'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export function createAiService({ dir }) {
  const configPath = path.join(dir, 'ai.json')

  const read = () => {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'))
      return typeof raw === 'object' && raw ? raw : {}
    } catch {
      return {}
    }
  }

  const config = read()

  const jevKey = () => (typeof config.apiKey === 'string' ? config.apiKey.trim() : '')
  const deepseekKey = () =>
    typeof config.deepseekKey === 'string' ? config.deepseekKey.trim() : ''

  const save = () => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 })
  }

  async function evaluate({ state, questions }) {
    const key = jevKey()
    if (!key) return { ok: false, error: 'no-key' }
    if (!state || !questions || !Object.keys(questions).length) {
      return { ok: false, error: 'empty-request' }
    }

    const body = JSON.stringify({ state, model: MODEL, questions })
    let lastError = 'request-failed'

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`
          },
          body
        })
        if (res.ok) {
          const data = await res.json()
          return { ok: true, answers: data.answers || {}, usage: data.usage || null }
        }
        if (res.status === 401) return { ok: false, error: 'invalid-key' }
        if (res.status === 429 || res.status === 529) {
          lastError = 'overloaded'
          await sleep(1200 * (attempt + 1) * 2)
          continue
        }
        let detail = ''
        try {
          const j = await res.json()
          detail = j?.error?.message || j?.message || JSON.stringify(j).slice(0, 240)
        } catch {
          /* body not json */
        }
        return { ok: false, error: `http-${res.status}`, detail }
      } catch {
        lastError = 'offline'
        await sleep(800 * (attempt + 1))
      }
    }
    return { ok: false, error: lastError }
  }

  async function deepseek({ system, user, maxTokens = 3000 }) {
    const key = deepseekKey()
    if (!key) return { ok: false, error: 'no-key' }
    if (!user) return { ok: false, error: 'empty-request' }

    const body = JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        { role: 'user', content: user }
      ],
      response_format: { type: 'json_object' },
      max_tokens: maxTokens
    })
    let lastError = 'request-failed'

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(DEEPSEEK_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`
          },
          body
        })
        if (res.ok) {
          const data = await res.json()
          const text = data?.choices?.[0]?.message?.content || ''
          return { ok: true, text, usage: data?.usage || null }
        }
        if (res.status === 401) return { ok: false, error: 'invalid-key' }
        if (res.status === 429 || res.status === 503) {
          lastError = 'overloaded'
          await sleep(1500 * (attempt + 1) * 2)
          continue
        }
        let detail = ''
        try {
          const j = await res.json()
          detail = j?.error?.message || JSON.stringify(j).slice(0, 240)
        } catch {
          /* body not json */
        }
        return { ok: false, error: `http-${res.status}`, detail }
      } catch {
        lastError = 'offline'
        await sleep(800 * (attempt + 1))
      }
    }
    return { ok: false, error: lastError }
  }

  async function deepseekVision({ urls = [], prompt = '' }) {
    const key = deepseekKey()
    if (!key) return { ok: false, error: 'no-key' }
    if (!urls.length || !prompt) return { ok: false, error: 'empty-request' }

    const content = [{ type: 'text', text: prompt }]
    let attached = 0
    for (let i = 0; i < urls.length && attached < 8; i++) {
      try {
        const res = await fetch(urls[i])
        if (!res.ok) continue
        const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0]
        const buf = Buffer.from(await res.arrayBuffer())
        content.push({ type: 'text', text: `Image ${i + 1}:` })
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${mime.startsWith('image/') ? mime : 'image/jpeg'};base64,${buf.toString('base64')}`
          }
        })
        attached++
      } catch {
        /* skip unreadable image */
      }
    }
    if (!attached) return { ok: false, error: 'no-images' }

    const body = JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages: [{ role: 'user', content }],
      response_format: { type: 'json_object' },
      max_tokens: 1500
    })
    let lastError = 'request-failed'

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(DEEPSEEK_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`
          },
          body
        })
        if (res.ok) {
          const data = await res.json()
          const text = data?.choices?.[0]?.message?.content || ''
          return { ok: true, text, images: attached }
        }
        if (res.status === 401) return { ok: false, error: 'invalid-key' }
        if (res.status === 429 || res.status === 503) {
          lastError = 'overloaded'
          await sleep(1500 * (attempt + 1) * 2)
          continue
        }
        let detail = ''
        try {
          const j = await res.json()
          detail = j?.error?.message || JSON.stringify(j).slice(0, 240)
        } catch {
          /* body not json */
        }
        return { ok: false, error: `http-${res.status}`, detail }
      } catch {
        lastError = 'offline'
        await sleep(800 * (attempt + 1))
      }
    }
    return { ok: false, error: lastError }
  }

  return {
    status: () => ({
      ok: true,
      hasKey: jevKey().length > 0,
      hasDeepseek: deepseekKey().length > 0
    }),
    setKey: (provider, key) => {
      const value = String(key || '').trim()
      if (provider === 'deepseek') config.deepseekKey = value
      else config.apiKey = value
      save()
      return {
        ok: true,
        hasKey: jevKey().length > 0,
        hasDeepseek: deepseekKey().length > 0
      }
    },
    evaluate,
    deepseek,
    deepseekVision
  }
}
