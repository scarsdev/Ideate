const $ = (id) => document.getElementById(id)
const DEFAULTS = { serverUrl: 'http://127.0.0.1:47821', token: '', igUser: '', watchMinutes: 15 }

async function load() {
  const stored = await chrome.storage.local.get(['serverUrl', 'token', 'igUser', 'watchMinutes'])
  $('serverUrl').value = stored.serverUrl || DEFAULTS.serverUrl
  $('token').value = stored.token || ''
  $('igUser').value = stored.igUser || ''
  $('watchMinutes').value = String(stored.watchMinutes ?? DEFAULTS.watchMinutes)
}

async function save() {
  const serverUrl = $('serverUrl').value.trim() || DEFAULTS.serverUrl
  const token = $('token').value.trim()
  const igUser = $('igUser').value.trim().replace(/^@/, '')
  const watchMinutes = Number($('watchMinutes').value) || 0
  await chrome.storage.local.set({ serverUrl, token, igUser, watchMinutes })
  $('status').textContent = 'Saved.'
  test()
}

async function test() {
  const serverUrl = $('serverUrl').value.trim() || DEFAULTS.serverUrl
  const token = $('token').value.trim()
  if (!token) {
    $('status').textContent = 'Add the access token from Gather → Settings → Syncing.'
    return
  }
  try {
    const res = await fetch(`${serverUrl.replace(/\/+$/, '')}/state`, {
      headers: { 'X-Gather-Token': token }
    })
    if (res.status === 401) {
      $('status').textContent = 'Token rejected \u2014 copy it again from Settings → Syncing.'
      return
    }
    const state = await res.json()
    $('status').textContent = `Connected \u00b7 ${state.inbox} in inbox \u00b7 ${state.total} synced items.`
  } catch {
    $('status').textContent = 'Gather is offline \u2014 open the app and retry.'
  }
}

$('save').addEventListener('click', save)
$('test').addEventListener('click', test)
load()
