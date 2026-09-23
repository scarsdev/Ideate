import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('gather', {
  info: () => ipcRenderer.invoke('app:info'),
  pickFiles: () => ipcRenderer.invoke('dialog:pickFiles'),
  pickDirectory: () => ipcRenderer.invoke('dialog:pickDirectory'),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  saveFile: (name, dataUrl, reveal = true) =>
    ipcRenderer.invoke('files:save', { name, dataUrl, reveal }),
  downloadFile: (name, dataUrl) => ipcRenderer.invoke('files:download', { name, dataUrl }),
  downloadUrl: (name, url) => ipcRenderer.invoke('files:download-url', { name, url }),
  openLibraryDir: () => ipcRenderer.invoke('files:libraryDir'),
  exportZip: ({ name, files }) => ipcRenderer.invoke('files:exportZip', { name, files }),
  capture: {
    configure: (patch) => ipcRenderer.invoke('capture:configure', patch),
    now: () => ipcRenderer.invoke('capture:now')
  },
  ai: {
    status: () => ipcRenderer.invoke('ai:status'),
    setKey: (provider, key) => ipcRenderer.invoke('ai:set-key', { provider, key }),
    evaluate: ({ state, questions }) => ipcRenderer.invoke('ai:evaluate', { state, questions }),
    deepseek: ({ system, user, maxTokens }) =>
      ipcRenderer.invoke('ai:deepseek', { system, user, maxTokens }),
    vision: ({ urls, prompt }) => ipcRenderer.invoke('ai:vision', { urls, prompt })
  },
  boards: {
    create: (name) => ipcRenderer.invoke('boards:create', { name }),
    rename: (id, name) => ipcRenderer.invoke('boards:rename', { id, name }),
    remove: (id) => ipcRenderer.invoke('boards:delete', { id }),
    save: (id, items) => ipcRenderer.invoke('boards:save', { id, items }),
    reorder: (ids) => ipcRenderer.invoke('boards:reorder', { ids })
  },
  sync: {
    snapshot: () => ipcRenderer.invoke('sync:snapshot'),
    setCollections: (collections) => ipcRenderer.invoke('sync:set-collections', { collections }),
    categorize: (id, collectionId) => ipcRenderer.invoke('sync:categorize', { id, collectionId }),
    categorizeBulk: (entries) => ipcRenderer.invoke('sync:categorize-bulk', { entries }),
    annotate: (id, patch) => ipcRenderer.invoke('sync:annotate', { id, patch }),
    annotateBulk: (entries) => ipcRenderer.invoke('sync:annotate-bulk', { entries }),
    remove: (id) => ipcRenderer.invoke('sync:remove', { id }),
    clear: () => ipcRenderer.invoke('sync:clear'),
    meta: () => ipcRenderer.invoke('sync:meta'),
    revealExtension: () => ipcRenderer.invoke('sync:reveal-extension'),
    setSourceEnabled: (source, enabled) =>
      ipcRenderer.invoke('sync:set-source-enabled', { source, enabled }),
    pinBoards: {
      get: () => ipcRenderer.invoke('sync:pin-boards:get'),
      set: (patch) => ipcRenderer.invoke('sync:pin-boards:set', patch)
    },
    onItem: (cb) => {
      const listener = (_e, row) => cb(row)
      ipcRenderer.on('sync:item', listener)
      return () => ipcRenderer.removeListener('sync:item', listener)
    }
  }
})
