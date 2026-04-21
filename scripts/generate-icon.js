import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CANVAS_SIZE = 1024;
const GRID_SIZE = 32;
const PIXEL_SIZE = CANVAS_SIZE / GRID_SIZE;
const SCALE = 2;

// Colors matching the live renderer (PetRenderer.ts + IdleAction.ts)
const COLORS = {
  pet: '#d77757',
  face: '#111',
  mouth: '#334',
};

// Original pixel-art cat head in the 32x32 grid (icon style, no body)
const style = {
  head: { x: 10, y: 12, w: 12, h: 10 },
  ears: [{ x: 10, y: 10 }, { x: 11, y: 10 }, { x: 20, y: 10 }, { x: 21, y: 10 }],
  eyeLeft: { x: 12, y: 16, w: 2, h: 1 },
  eyeRight: { x: 18, y: 16, w: 2, h: 1 },
  mouth: [{ x: 14, y: 19 }, { x: 15, y: 19 }, { x: 16, y: 19 }, { x: 17, y: 19 }],
};

// Bounding box of the original icon shape
const BOUNDS = { minX: 10, minY: 10, width: 13, height: 13 };

// Center the scaled shape in the grid
const OFFSET_X = Math.floor((GRID_SIZE - BOUNDS.width * SCALE) / 2);
const OFFSET_Y = Math.floor((GRID_SIZE - BOUNDS.height * SCALE) / 2);

function mapX(x) {
  return OFFSET_X + (x - BOUNDS.minX) * SCALE;
}

function mapY(y) {
  return OFFSET_Y + (y - BOUNDS.minY) * SCALE;
}

function rect(x, y, w, h, color) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}"/>`;
}

function pixelRects(x, y, w, h, color) {
  const px = x * PIXEL_SIZE;
  const py = y * PIXEL_SIZE;
  return rect(px, py, w * PIXEL_SIZE, h * PIXEL_SIZE, color);
}

const shapes = [];

// Head layer
shapes.push(
  pixelRects(
    mapX(style.head.x),
    mapY(style.head.y),
    style.head.w * SCALE,
    style.head.h * SCALE,
    COLORS.pet
  )
);
for (const p of style.ears)
  shapes.push(pixelRects(mapX(p.x), mapY(p.y), SCALE, SCALE, COLORS.pet));

// Face layer (neutral expression)
shapes.push(
  pixelRects(
    mapX(style.eyeLeft.x),
    mapY(style.eyeLeft.y),
    style.eyeLeft.w * SCALE,
    style.eyeLeft.h * SCALE,
    COLORS.face
  )
);
shapes.push(
  pixelRects(
    mapX(style.eyeRight.x),
    mapY(style.eyeRight.y),
    style.eyeRight.w * SCALE,
    style.eyeRight.h * SCALE,
    COLORS.face
  )
);
for (const p of style.mouth)
  shapes.push(pixelRects(mapX(p.x), mapY(p.y), SCALE, SCALE, COLORS.mouth));

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
