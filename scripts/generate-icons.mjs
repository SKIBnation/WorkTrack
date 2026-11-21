import { writeFile } from 'node:fs/promises'
import sharp from 'sharp'

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#000000"/>
  <circle cx="256" cy="256" r="176" fill="none" stroke="#30D158" stroke-width="36"/>
  <path d="M256 256 V132" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round"/>
  <path d="M256 256 L352 318" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round"/>
  <circle cx="256" cy="256" r="14" fill="#30D158"/>
</svg>`

const maskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#000000"/>
  <g transform="translate(256 256) scale(0.68) translate(-256 -256)">
    <circle cx="256" cy="256" r="176" fill="none" stroke="#30D158" stroke-width="36"/>
    <path d="M256 256 V132" stroke="#FFFFFF" stroke-width="22" stroke-linecap="round"/>
    <path d="M256 256 L352 318" stroke="#FFFFFF" stroke-width="16" stroke-linecap="round"/>
    <circle cx="256" cy="256" r="14" fill="#30D158"/>
  </g>
</svg>`

async function png(svg, size, file) {
  const buffer = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  await writeFile(file, buffer)
}

await png(icon, 192, 'public/pwa-192x192.png')
await png(icon, 512, 'public/pwa-512x512.png')
await png(icon, 180, 'public/apple-touch-icon.png')
await png(maskable, 512, 'public/pwa-maskable-512x512.png')
