/**
 * Gera ícones PWA a partir de public/icons/logo-source.png
 * Uso: node scripts/generate-pwa-icons.mjs
 */
import { mkdir, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const iconsDir = path.join(root, 'public', 'icons')
const source = path.join(iconsDir, 'logo-source.png')

const outputs = [
  { name: 'icon-192x192.png', size: 192, paddingRatio: 0 },
  { name: 'icon-512x512.png', size: 512, paddingRatio: 0 },
  { name: 'icon-512x512-maskable.png', size: 512, paddingRatio: 0.2 },
  { name: 'apple-touch-icon.png', size: 180, paddingRatio: 0 },
]

async function ensureSource() {
  try {
    await access(source)
  } catch {
    console.error(
      [
        'Arquivo não encontrado:',
        source,
        '',
        'Salve a logo oficial como:',
        '  public/icons/logo-source.png',
        'Depois rode: node scripts/generate-pwa-icons.mjs',
      ].join('\n')
    )
    process.exit(1)
  }
}

async function render({ name, size, paddingRatio }) {
  const pad = Math.round(size * paddingRatio)
  const inner = size - pad * 2
  const bg = { r: 9, g: 9, b: 11, alpha: 1 } // #09090b

  const logo = await sharp(source)
    .resize(inner, inner, {
      fit: 'contain',
      background: bg,
    })
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: bg,
    },
  })
    .composite([{ input: logo, left: pad, top: pad }])
    .png()
    .toFile(path.join(iconsDir, name))

  console.log(`OK  ${name} (${size}x${size})`)
}

await mkdir(iconsDir, { recursive: true })
await ensureSource()
for (const out of outputs) {
  await render(out)
}
console.log('\nÍcones gerados em public/icons/')
