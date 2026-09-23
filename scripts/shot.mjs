import { app, BrowserWindow, ipcMain } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { createSyncService } from '../electron/sync/service.mjs'
import { handleGatherFileProtocol, registerGatherFileScheme } from '../electron/files.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mode = process.argv[2] || 'library'
const out = process.argv[3] || `/tmp/shot-${mode}.png`

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'))
app.setPath('userData', path.join(app.getPath('appData'), pkg.name))
registerGatherFileScheme()

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function shot(win, name) {
  await win.webContents.executeJavaScript(`(() => {
    const el = document.querySelector('.toolbar') || document.body
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })()`)
  await sleep(250)
  const img = await win.webContents.capturePage()
  fs.writeFileSync(name, img.toPNG())
  console.log('saved', name)
}

app.whenReady().then(async () => {
  handleGatherFileProtocol()
  await createSyncService({
    dir: app.getPath('userData'),
    ipcMain,
    onChange: () => {},
    openPath: () => {}
  })

  const win = new BrowserWindow({
    width: 1512,
    height: 950,
    show: false,
    backgroundColor: '#f2f2f3',
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.mjs'),
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  await win.loadFile(path.join(__dirname, '../dist/index.html'))
  await sleep(1400)

  const js = (code) => win.webContents.executeJavaScript(code)

  const waitForCards = async (timeout = 9000) => {
    const started = Date.now()
    while (Date.now() - started < timeout) {
      if (await js(`document.querySelectorAll('.card').length > 0`)) return true
      await sleep(300)
    }
    return false
  }

  const hoverEl = async (target, sel, yf) => {
    const box = await js(`(() => {
      const r = document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect()
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height * ${yf}) }
    })()`)
    target.show()
    target.focus()
    app.focus({ steal: true })
    await sleep(600)
    target.webContents.sendInputEvent({ type: 'mouseMove', x: 4, y: 4 })
    await sleep(100)
    target.webContents.sendInputEvent({ type: 'mouseMove', x: box.x, y: box.y })
    await sleep(900)
    const under = await js(`(document.elementFromPoint(${box.x}, ${box.y})?.className) || ''`)
    console.log('under', under)
    const ok = await js(`document.querySelector(${JSON.stringify(sel)}).matches(':hover')`)
    const tf = await js(
      `getComputedStyle(document.querySelector(${JSON.stringify(sel)}).closest('.collection-card,.strip-card').querySelector('.stack-card-1')).transform`
    )
    console.log('hover', sel, ok, tf)
  }

  if (mode === 'library') {
    // default state
  } else if (mode === 'collections') {
    await js(`document.querySelectorAll('.seg')[1].click()`)
  } else if (mode === 'collections-grid') {
    await js(`document.querySelectorAll('.seg')[1].click()`)
    await sleep(400)
    await js(`document.querySelector('.cf-foot .icon-btn').click()`)
  } else if (mode === 'collections-grid-hover') {
    await js(`document.querySelectorAll('.seg')[1].click()`)
    await sleep(400)
    await js(`document.querySelector('.cf-foot .icon-btn').click()`)
    await sleep(500)
    await hoverEl(win, '.collection-card', 0.45)
  } else if (mode === 'collections-hover') {
    await js(`document.querySelectorAll('.seg')[1].click()`)
    await sleep(600)
    const box = await js(`(() => {
      const els = document.querySelectorAll('.cf-slide')
      const el = els[Math.min(els.length - 1, 12)]
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height * 0.25) }
    })()`)
    win.show()
    win.focus()
    app.focus({ steal: true })
    await sleep(600)
    win.webContents.sendInputEvent({ type: 'mouseMove', x: 4, y: 4 })
    await sleep(100)
    win.webContents.sendInputEvent({ type: 'mouseMove', x: box.x, y: box.y })
    await sleep(900)
    console.log('under', await js(`(document.elementFromPoint(${box.x}, ${box.y})?.className) || ''`))
  } else if (mode === 'strip-hover') {
    await hoverEl(win, '.strip-card:nth-child(2) .strip-preview', 0.5)
  } else if (mode === 'collection-detail') {
    await js(`document.querySelectorAll('.seg')[1].click()`)
    await sleep(300)
    await js(`document.querySelector('.cf-foot .cf-new').click()`)
  } else if (mode === 'spaces') {
    await js(`document.querySelectorAll('.seg')[2].click()`)
  } else if (mode === 'board') {
    await js(`document.querySelectorAll('.seg')[2].click()`)
    await sleep(700)
    await js(`document.querySelector('.space-card .collection-cover')?.click()`)
    await sleep(1600)
  } else if (mode === 'board-select') {
    await js(`document.querySelectorAll('.seg')[2].click()`)
    await sleep(700)
    await js(`document.querySelector('.space-card .collection-cover')?.click()`)
    await sleep(1600)
    const box = await js(`(() => {
      const el = document.querySelector('.bi-image')
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
    })()`)
    if (box) {
      win.show()
      win.focus()
      app.focus({ steal: true })
      await sleep(400)
      win.webContents.sendInputEvent({ type: 'mouseMove', x: box.x, y: box.y })
      await sleep(120)
      win.webContents.sendInputEvent({ type: 'mouseDown', x: box.x, y: box.y, button: 'left', clickCount: 1 })
      win.webContents.sendInputEvent({ type: 'mouseUp', x: box.x, y: box.y, button: 'left', clickCount: 1 })
      await sleep(700)
    }
  } else if (mode === 'detail') {
    await waitForCards()
    await js(`document.querySelectorAll('.card')[0].click()`)
  } else if (mode === 'assign') {
    await waitForCards()
    await js(`document.querySelectorAll('.card')[0].click()`)
    await sleep(500)
    await js(
      `window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',bubbles:true}))`
    )
  } else if (mode === 'detail-video') {
    await waitForCards()
    await js(`(() => {
      const v = document.querySelector('[data-item-id] video')
      if (v) v.closest('.card').click()
    })()`)
  } else if (mode === 'video') {
    await sleep(200)
    await js(`document.querySelectorAll('.card')[4].click()`)
  } else if (mode === 'menu' || mode === 'menu-sub') {
    await sleep(200)
    await js(`(() => {
      const card = document.querySelectorAll('.card')[0];
      const r = card.getBoundingClientRect();
      card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: r.left + r.width * 0.62, clientY: r.top + r.height * 0.42 }));
      return 0;
    })()`)
    await sleep(350)
    if (mode === 'menu-sub') {
      await js(`(() => {
        const row = [...document.querySelectorAll('.ctx > .ctx-item')].find(e => e.querySelector('.ctx-label')?.textContent === 'Add to collection');
        row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        return 0;
      })()`)
    }
  } else if (mode === 'palette') {
    await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))`)
    await sleep(500)
    await js(`(() => {
      const input = document.querySelector('.cmdk input')
      if (!input) return 0
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, 'design')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return 0
    })()`)
    await sleep(500)
  } else if (mode === 'detail-boarditem') {
    await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))`)
    await sleep(500)
    await js(`(() => {
      const input = document.querySelector('.cmdk input')
      if (!input) return 0
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, 'Bold Typography')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return 0
    })()`)
    await sleep(600)
    await js(`document.querySelector('.cmdk-row')?.click()`)
    await sleep(1500)
  } else if (mode === 'collections-settings') {
    await js(`document.querySelectorAll('.seg')[1].click()`)
    await sleep(600)
    await js(`document.querySelector('.topbar-right .icon-btn[title="Settings"]').click()`)
  } else if (mode === 'settings' || mode.startsWith('settings-')) {
    await js(`document.querySelector('.topbar-right .icon-btn[title="Settings"]').click()`)
    await sleep(450)
    if (mode !== 'settings') {
      const sec = mode.slice('settings-'.length)
      await js(`document.querySelector('.set-nav-item[data-section="${sec}"]').click()`)
    }
  } else if (mode.startsWith('panel-')) {
    const pos = mode.split('-')[1]
    await sleep(200)
    await js(`(() => {
      const card = document.querySelectorAll('.card')[0];
      const r = card.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + 80;
      const pt = (t, cx, cy, el) => (el || window).dispatchEvent(new PointerEvent(t, { bubbles: true, cancelable: true, clientX: cx, clientY: cy, button: 0, buttons: 1 }));
      pt('pointerdown', x, y, card);
      pt('pointermove', x + 40, y + 20);
      return 0;
    })()`)
    await sleep(500)
    await js(`document.querySelectorAll('.cat-pos button')[${pos === 'left' ? 0 : pos === 'right' ? 1 : 2}].click()`)
    await sleep(400)
    await js(`(() => {
      const rows = document.querySelectorAll('.cat-row');
      const r = rows[3].getBoundingClientRect();
      window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, buttons: 1 }));
      return 0;
    })()`)
  }

  await sleep(1200)
  await shot(win, out)
  app.quit()
})
