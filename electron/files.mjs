import { net, protocol } from 'electron'
import { pathToFileURL } from 'node:url'

export function registerGatherFileScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'gather-file',
      privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true }
    }
  ])
}

export function handleGatherFileProtocol() {
  protocol.handle('gather-file', (request) => {
    const encoded = new URL(request.url).pathname.replace(/^\/+/, '')
    return net.fetch(pathToFileURL(decodeURIComponent(encoded)).toString())
  })
}
