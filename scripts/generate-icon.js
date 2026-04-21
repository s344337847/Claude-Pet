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

// Pixel-art cat head centered in the 32x32 grid (icon style, no body)
const style = {
  head: { x: 10, y: 12, w: 12, h: 10 },
  ears: [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 20, y: 10 }, { x: 21, y: 10 }],
  eyeLeft: { x: 12, y: 16, w: 2, h: 1 },
  eyeRight: { x: 18, y: 16, w: 2, h: 1 },
  mouth: [{ x: 14, y: 19 }, { x: 15, y: 19 }, { x: 16, y: 19 }, { x: 17, y: 19 }],
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

// Head layer
shapes.push(pixelRects(style.head.x, style.head.y, style.head.w, style.head.h, COLORS.pet));
for (const p of style.ears) shapes.push(pixelRect(p.x, p.y, COLORS.pet));

// Face layer (neutral expression)
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
