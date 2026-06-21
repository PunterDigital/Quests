// Generates PWA icons from inline SVG. Run: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "public", "icons");
mkdirSync(OUT, { recursive: true });

// A quest banner/flag glyph with a checkmark, on a purple gradient.
const glyph = `
  <g>
    <!-- flag pole -->
    <rect x="170" y="150" width="20" height="230" rx="10" fill="#ffffff"/>
    <!-- pennant -->
    <path d="M190 160 L350 195 L300 235 L350 275 L190 240 Z" fill="#ffffff"/>
    <!-- checkmark on the pennant -->
    <path d="M232 210 l16 18 l34 -34" fill="none" stroke="#a060ff"
          stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  </g>`;

function svg({ maskable }) {
  const grad = `
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#a060ff"/>
        <stop offset="1" stop-color="#6a3acc"/>
      </linearGradient>
    </defs>`;
  if (maskable) {
    // Full-bleed background so launchers can crop into any shape.
    return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      ${grad}
      <rect width="512" height="512" fill="url(#g)"/>
      ${glyph}
    </svg>`;
  }
  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    ${grad}
    <rect width="512" height="512" rx="112" fill="#0c0c14"/>
    <rect x="36" y="36" width="440" height="440" rx="96" fill="url(#g)"/>
    ${glyph}
  </svg>`;
}

async function render(name, size, maskable) {
  await sharp(Buffer.from(svg({ maskable })))
    .resize(size, size)
    .png()
    .toFile(join(OUT, name));
  console.log("wrote", name);
}

await render("icon-192.png", 192, false);
await render("icon-512.png", 512, false);
await render("icon-maskable-512.png", 512, true);
// Also a favicon-sized PNG referenced by some browsers.
await render("apple-touch-icon.png", 180, false);
