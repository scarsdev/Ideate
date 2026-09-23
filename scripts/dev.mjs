import { createServer } from 'vite'
import { spawn } from 'node:child_process'
import electronPath from 'electron'

const server = await createServer({ configFile: 'vite.config.js' })
await server.listen()
const info = server.resolvedUrls?.local?.[0] ?? `http://localhost:${server.config.server.port}`
server.printUrls()

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: { ...process.env, VITE_DEV_SERVER_URL: info }
})

child.on('close', async () => {
  await server.close()
  process.exit(0)
})

process.on('SIGINT', () => {
  child.kill()
})
