import { app, BrowserWindow, shell, ipcMain, dialog, nativeTheme, net } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import { buildZip } from './zip.mjs'
import { createSyncService } from './sync/service.mjs'
import { handleGatherFileProtocol, registerGatherFileScheme } from './files.mjs'
import { createCaptureService } from './capture.mjs'
import { createAiService } from './ai.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const isDev = !!process.env.VITE_DEV_SERVER_URL

registerGatherFileScheme()

let mainWindow = null
let syncService = null
let captureService = null
let aiService = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#f4f4f5',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 17 },
    roundedCorners: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required'
    }
  })

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.on('render-process-gone', () => {
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.reload()
    }, 400)
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(async () => {
  handleGatherFileProtocol()

  createWindow()
  syncService = await createSyncService({
    dir: app.getPath('userData'),
    extensionDir: app.isPackaged
      ? path.join(process.resourcesPath, 'sync-extension')
      : undefined,
    ipcMain,
    onChange: (row) => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('sync:item', row)
    },
    openPath: (p) => shell.openPath(p),
    onOpen: () => {
      if (!mainWindow || mainWindow.isDestroyed()) return false
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
      app.focus({ steal: true })
      return true
    }
  })
  captureService = createCaptureService({
    onCaptured: async (file) => {
      const externalId = path.basename(file, path.extname(file))
      const { inserted } = syncService.store.insert([
        {
          source: 'screenshot',
          externalId,
          url: '',
          title: path.basename(file),
          thumb: `gather-file://local/${encodeURIComponent(file)}`,
          savedAt: Date.now()
        }
      ])
      if (inserted.length) {
        await syncService.store.persist()
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('sync:item', inserted[0])
      }
    }
  })

  ipcMain.handle('capture:configure', (_e, patch) => captureService.configure(patch || {}))
  ipcMain.handle('capture:now', () => captureService.run())

  aiService = createAiService({ dir: app.getPath('userData') })
  ipcMain.handle('ai:status', () => aiService.status())
  ipcMain.handle('ai:set-key', (_e, { provider, key } = {}) => aiService.setKey(provider, key))
  ipcMain.handle('ai:evaluate', (_e, payload = {}) => aiService.evaluate(payload))
  ipcMain.handle('ai:deepseek', (_e, payload = {}) => aiService.deepseek(payload))
  ipcMain.handle('ai:vision', (_e, payload = {}) => aiService.deepseekVision(payload))

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('will-quit', () => {
  captureService?.dispose()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

ipcMain.handle('app:info', () => ({
  platform: process.platform,
  version: app.getVersion(),
  dark: nativeTheme.shouldUseDarkColors
}))

ipcMain.handle('dialog:pickFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Media', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'mp4', 'mov', 'webm'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('dialog:pickDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  })
  return result.canceled ? '' : result.filePaths[0]
})

ipcMain.handle('shell:openExternal', (_e, url) => shell.openExternal(url))

ipcMain.handle('files:save', async (_e, { name, dataUrl, reveal }) => {
  const dir = path.join(app.getPath('userData'), 'Library')
  await fs.mkdir(dir, { recursive: true })
  const file = path.join(dir, sanitize(name))
  await fs.writeFile(file, toBuffer(dataUrl))
  if (reveal) shell.showItemInFolder(file)
  return file
})

ipcMain.handle('files:download', async (_e, { name, dataUrl }) => {
  const dir = app.getPath('downloads')
  const file = path.join(dir, sanitize(name))
  await fs.writeFile(file, toBuffer(dataUrl))
  shell.showItemInFolder(file)
  return file
})

ipcMain.handle('files:download-url', async (_e, { name, url }) => {
  const dir = app.getPath('downloads')
  const file = path.join(dir, sanitize(name))
  const res = await net.fetch(url)
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  await fs.writeFile(file, buf)
  shell.showItemInFolder(file)
  return file
})

ipcMain.handle('files:libraryDir', async () => {
  const dir = path.join(app.getPath('userData'), 'Library')
  await fs.mkdir(dir, { recursive: true })
  shell.openPath(dir)
  return dir
})

ipcMain.handle('files:exportZip', async (_e, { name, files }) => {
  const dir = app.getPath('downloads')
  const file = path.join(dir, `${sanitize(name)}.zip`)
  const archive = buildZip([
    ...files,
    {
      name: 'README.txt',
      text: `Gather library backup\n\nlibrary.json contains every save, collection, tag, and thumbnail in this library.\nTo restore, replace the contents of the app's data folder with the contents of this archive.\nExported ${new Date().toISOString()}\n`
    }
  ])
  await fs.writeFile(file, archive)
  shell.showItemInFolder(file)
  return file
})

function sanitize(name) {
  return String(name).replace(/[^\w.\-]+/g, '_')
}

function toBuffer(dataUrl) {
  const base64 = String(dataUrl).split(',')[1] ?? ''
  return Buffer.from(base64, 'base64')
}
