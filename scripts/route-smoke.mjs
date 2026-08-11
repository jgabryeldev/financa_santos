/**
 * Smoke de rotas sem autenticação.
 * - /login deve responder 200
 * - rotas do dashboard devem redirecionar para /login
 *
 * Uso: node scripts/route-smoke.mjs [baseUrl]
 * Default: http://127.0.0.1:3000
 */

const BASE = process.argv[2] || process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000'

const PROTECTED = ['/', '/cards', '/fixed', '/reports', '/profile']

async function fetchNoFollow(path) {
  return fetch(new URL(path, BASE), {
    redirect: 'manual',
    headers: { Accept: 'text/html' },
  })
}

function isRedirectToLogin(res) {
  if (![301, 302, 303, 307, 308].includes(res.status)) return false
  const loc = res.headers.get('location') || ''
  return loc.includes('/login')
}

async function main() {
  const failures = []

  try {
    const login = await fetchNoFollow('/login')
    if (login.status !== 200) {
      failures.push(`/login esperava 200, obteve ${login.status}`)
    } else {
      console.log('OK  /login → 200')
    }
  } catch (err) {
    failures.push(`/login falhou: ${err instanceof Error ? err.message : err}`)
    console.error('\nServidor não está acessível em', BASE)
    console.error('Suba com `npm run dev` ou `npm run start` antes do smoke, ou use test:smoke:build-only.\n')
    process.exit(1)
  }

  for (const path of PROTECTED) {
    try {
      const res = await fetchNoFollow(path)
      if (isRedirectToLogin(res)) {
        console.log(`OK  ${path} → redirect /login (${res.status})`)
      } else {
        failures.push(`${path} esperava redirect /login, obteve ${res.status}`)
      }
    } catch (err) {
      failures.push(`${path} falhou: ${err instanceof Error ? err.message : err}`)
    }
  }

  if (failures.length) {
    console.error('\nFalhas:')
    for (const f of failures) console.error(' -', f)
    process.exit(1)
  }

  console.log('\nSmoke de rotas OK')
}

main()
