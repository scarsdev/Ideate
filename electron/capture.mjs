import { app, globalShortcut } from 'electron'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

const MODE_FLAGS = { region: ['-i'], window: ['-w'], screen: [] }

export function createCaptureService({ onCaptured }) {
  let cfg = { shortcut: 'CommandOrControl+Shift+S', folder: '', mode: 'region' }
  let busy = false

  const register = () => {
    globalShortcut.unregisterAll()
    if (!cfg.shortcut) return false
    try {
      return globalShortcut.register(cfg.shortcut, () => {
        run()
      })
    } catch {
      return false
    }
  }

  const run = async () => {
    if (busy) return { ok: false, reason: 'busy' }
    busy = true
    try {
      const dir = cfg.folder ? String(cfg.folder) : app.getPath('pictures')
      await fs.mkdir(dir, { recursive: true })
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const file = path.join(dir, `Gather ${stamp}.png`)
      const flags = ['-x', ...(MODE_FLAGS[cfg.mode] || MODE_FLAGS.region)]
      await new Promise((resolve, reject) => {
        execFile('/usr/sbin/screencapture', [...flags, file], (err) => (err ? reject(err) : resolve()))
      })
      const stat = await fs.stat(file).catch(() => null)
      if (!stat || !stat.size) {
        await fs.unlink(file).catch(() => {})
        return { ok: false, reason: 'cancelled' }
      }
      onCaptured?.(file)
      return { ok: true, file }
    } catch (err) {
      return { ok: false, reason: err.message }
    } finally {
      busy = false
    }
  }

  register()

  return {
    configure(next = {}) {
      cfg = { ...cfg, ...next }
      const registered = register()
      return { ok: true, registered }
    },
    run,
    dispose() {
      globalShortcut.unregisterAll()
    }
  }
}
