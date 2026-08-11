/**
 * Sobe o servidor de produção, roda smoke de rotas e encerra.
 * Pré-requisito: `npm run build` já executado.
 */
import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const PORT = process.env.SMOKE_PORT || '3010'
const BASE = `http://127.0.0.1:${PORT}`

async function waitForServer(maxMs = 60000) {
  const start = Date.now()
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(BASE + '/login', { redirect: 'manual' })
      if (res.status === 200 || (res.status >= 300 && res.status < 400)) return
    } catch {
      // ainda subindo
    }
    await delay(500)
  }
  throw new Error(`Servidor não respondeu em ${BASE} após ${maxMs}ms`)
}

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['next', 'start', '-p', PORT],
  {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PORT },
  }
)

let killed = false
function cleanup() {
  if (killed) return
  killed = true
  child.kill('SIGTERM')
}

process.on('exit', cleanup)
process.on('SIGINT', () => {
  cleanup()
  process.exit(1)
})

try {
  await waitForServer()
  const smoke = spawn(process.execPath, ['scripts/route-smoke.mjs', BASE], {
    cwd: process.cwd(),
    stdio: 'inherit',
  })

  const code = await new Promise((resolve) => {
    smoke.on('close', resolve)
  })

  cleanup()
  process.exit(code ?? 1)
} catch (err) {
  console.error(err)
  cleanup()
  process.exit(1)
}
