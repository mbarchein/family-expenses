/**
 * Generates the PWA icons. No dependencies: a PNG is a handful of chunks and a
 * deflate stream, and adding an image library to a project that needs three
 * flat-colour squares would be the wrong trade.
 *
 * The mark is the app: one round shape split down the middle. Run `npm run
 * icons` after changing the palette in src/index.css.
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons')
const ACCENT = [12, 111, 99]
const LIGHT = [255, 255, 255]
const SOFT = [148, 205, 196]

const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'icon-192.png'), icon(192, 0.68))
writeFileSync(join(OUT, 'icon-512.png'), icon(512, 0.68))
// Maskable icons get cropped to whatever shape the launcher likes, so the mark
// shrinks into the safe zone and the background carries the rest.
writeFileSync(join(OUT, 'icon-512-maskable.png'), icon(512, 0.5))
console.log('icons written to', OUT)

function icon(size, markRatio) {
  const pixels = Buffer.alloc(size * size * 3)
  const centre = (size - 1) / 2
  const radius = (size * markRatio) / 2
  const gap = Math.max(1, size * 0.035)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside = Math.hypot(x - centre, y - centre) <= radius
      const colour = !inside ? ACCENT
        : Math.abs(x - centre) < gap / 2 ? ACCENT
        : x < centre ? LIGHT
        : SOFT
      pixels.set(colour, (y * size + x) * 3)
    }
  }
  return png(size, pixels)
}

function png(size, rgb) {
  // Each scanline is prefixed with its filter type; 0 means "store as is",
  // which is plenty for flat colour once deflate has had a look.
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8    // bit depth
  ihdr[9] = 2    // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function chunk(type, data) {
  const head = Buffer.alloc(4)
  head.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0, 0)
  return Buffer.concat([head, body, crc])
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) crc = TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return crc ^ 0xffffffff
}
