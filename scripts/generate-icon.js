import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CANVAS_SIZE = 1024;
const GRID_SIZE = 32;
const PIXEL_SIZE = CANVAS_SIZE / GRID_SIZE;

// Colors matching the live renderer (PetRenderer.ts + IdleAction.ts)
const COLORS = {
  pet: '#d77757',
  face: '#111',
  mouth: '#334',
};

// Geometry copied exactly from src/pet/styles/default.ts
const style = {
  head: { x: 10, y: 6, w: 12, h: 10 },
  ears: [{ x: 10, y: 4 }, { x: 11, y: 4 }, { x: 20, y: 4 }, { x: 21, y: 4 }],
  bodyRect: { x: 11, y: 16, w: 10, h: 10 },
  tail: [{ x: 22, y: 18 }, { x: 23, y: 17 }],
  eyeLeft: { x: 12, y: 10, w: 2, h: 1 },
  eyeRight: { x: 18, y: 10, w: 2, h: 1 },
  mouth: [{ x: 14, y: 13 }, { x: 15, y: 13 }, { x: 16, y: 13 }, { x: 17, y: 13 }, { x: 13, y: 12 }, { x: 18, y: 12 }],
  legsLeft: [{ x: 11, y: 26 }, { x: 12, y: 26 }],
  legsRight: [{ x: 19, y: 26 }, { x: 20, y: 26 }],
};

function rect(x, y, w, h, color) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
}

function pixelRect(x, y, color) {
  const px = x * PIXEL_SIZE;
  const py = y * PIXEL_SIZE;
  return rect(px, py, PIXEL_SIZE, PIXEL_SIZE, color);
}

function pixelRects(x, y, w, h, color) {
  const px = x * PIXEL_SIZE;
  const py = y * PIXEL_SIZE;
  return rect(px, py, w * PIXEL_SIZE, h * PIXEL_SIZE, color);
}

const shapes = [];

// Body layer (matches PetRenderer.drawBody exactly)
shapes.push(pixelRects(style.head.x, style.head.y, style.head.w, style.head.h, COLORS.pet));
for (const p of style.ears) shapes.push(pixelRect(p.x, p.y, COLORS.pet));
shapes.push(pixelRects(style.bodyRect.x, style.bodyRect.y, style.bodyRect.w, style.bodyRect.h, COLORS.pet));
for (const p of style.tail) shapes.push(pixelRect(p.x, p.y, COLORS.pet));
for (const p of style.legsLeft) shapes.push(pixelRect(p.x, p.y, COLORS.pet));
for (const p of style.legsRight) shapes.push(pixelRect(p.x, p.y, COLORS.pet));

// Face layer (neutral idle expression, matches PetRenderer.drawFace)
shapes.push(pixelRects(style.eyeLeft.x, style.eyeLeft.y, style.eyeLeft.w, style.eyeLeft.h, COLORS.face));
shapes.push(pixelRects(style.eyeRight.x, style.eyeRight.y, style.eyeRight.w, style.eyeRight.h, COLORS.face));
for (const p of style.mouth) shapes.push(pixelRect(p.x, p.y, COLORS.mouth));

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" viewBox="0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
${shapes.join('\n')}
</svg>`;

const outputPath = path.join(__dirname, '..', 'src-tauri', 'icons', 'icon-source.png');

sharp(Buffer.from(svg))
  .png()
  .toFile(outputPath)
  .then(() => {
    console.log(`Icon source generated: ${outputPath}`);
  })
  .catch((err) => {
    console.error('Failed to generate icon:', err);
    process.exit(1);
  });
