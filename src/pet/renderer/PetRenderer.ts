import type { StyleConfig, PixelPoint, PixelRect } from '../styles/types';

const CANVAS_LOGICAL_SIZE = 32;

export class PetRenderer {
  private frame = 0;
  private baseOffsetY = 0;
  private spriteSheetCache = new Map<string, HTMLImageElement>();
  private facing = 1; // 1 = right, -1 = left

  constructor(private ctx: CanvasRenderingContext2D, private scale: number) {}

  setScale(scale: number) {
    this.scale = scale;
  }

  setFrame(f: number) {
    this.frame = f;
  }

  setBaseOffsetY(y: number) {
    this.baseOffsetY = y;
  }

  setFacing(f: number) {
    this.facing = f >= 0 ? 1 : -1;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  /** Track already-reported errors to avoid console spam */
  private reportedErrors = new Set<string>();

  private reportOnce(msg: string) {
    if (!this.reportedErrors.has(msg)) {
      console.error(`[PetRenderer] ${msg}`);
      this.reportedErrors.add(msg);
    }
  }

  /** Load a sprite sheet image into the cache. Returns true on success, false on failure (error is logged). */
  async loadSpriteSheet(src: string): Promise<boolean> {
    if (this.spriteSheetCache.has(src)) return true;
    const img = new Image();
    img.src = src;
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load sprite sheet: ${src}`));
      });
      this.spriteSheetCache.set(src, img);
      return true;
    } catch (err) {
      console.error(`[PetRenderer] Sprite sheet load failed: ${src}`, err);
      return false;
    }
  }

  /** Check if a sprite sheet has been loaded and is ready */
  hasSpriteSheetLoaded(src: string): boolean {
    const img = this.spriteSheetCache.get(src);
    return img?.complete === true;
  }

  /**
   * Renders a frame from a sprite sheet.
   * Returns true if rendered, false if no sprite sheet config or not loaded yet.
   */
  renderSpriteSheet(style: StyleConfig, stateName: string, animFrameIndex: number): boolean {
    const sheet = style.spriteSheet;
    if (!sheet) return false;

    if (!sheet.imageSrc || sheet.imageSrc.trim() === '') {
      this.reportOnce(`spriteSheet imageSrc is empty (style: ${style.name})`);
      return false;
    }
    if (sheet.frameSize <= 0) {
      this.reportOnce(`spriteSheet frameSize must be > 0, got ${sheet.frameSize} (style: ${style.name})`);
      return false;
    }

    const stateConfig = sheet.states[stateName];
    if (!stateConfig) return false;

    if (stateConfig.frameCount <= 0) {
      this.reportOnce(`spriteSheet state "${stateName}" has invalid frameCount: ${stateConfig.frameCount} (style: ${style.name})`);
      return false;
    }
    if (stateConfig.row < 0) {
      this.reportOnce(`spriteSheet state "${stateName}" has invalid row: ${stateConfig.row} (style: ${style.name})`);
      return false;
    }

    const img = this.spriteSheetCache.get(sheet.imageSrc);
    if (!img) {
      this.reportOnce(`spriteSheet image not loaded yet: ${sheet.imageSrc} (style: ${style.name})`);
      return false;
    }
    if (!img.complete) {
      // Image is still loading; silently skip to avoid spam
      return false;
    }

    const actualFrame = animFrameIndex % stateConfig.frameCount;
    const frameSize = sheet.frameSize;

    const sx = actualFrame * frameSize;
    const sy = stateConfig.row * frameSize;

    const canvasW = this.ctx.canvas.width;
    const canvasH = this.ctx.canvas.height;

    // Use nearest-neighbor for crisp pixel art scaling
    const prevSmoothing = this.ctx.imageSmoothingEnabled;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.save();
    if (this.facing === -1) {
      this.ctx.translate(canvasW, 0);
      this.ctx.scale(-1, 1);
    }
    this.ctx.drawImage(img, sx, sy, frameSize, frameSize, 0, 0, canvasW, canvasH);
    this.ctx.restore();
    this.ctx.imageSmoothingEnabled = prevSmoothing;

    return true;
  }

  pixel(x: number, y: number, color: string) {
    const drawX = this.facing === -1 ? CANVAS_LOGICAL_SIZE - 1 - x : x;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(drawX * this.scale, (y + this.baseOffsetY) * this.scale, this.scale, this.scale);
  }

  rect(r: PixelRect, color: string) {
    const drawX = this.facing === -1 ? CANVAS_LOGICAL_SIZE - r.x - r.w : r.x;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(drawX * this.scale, (r.y + this.baseOffsetY) * this.scale, r.w * this.scale, r.h * this.scale);
  }

  private points(pts: PixelPoint[], color: string, offsetY: number) {
    for (const p of pts) {
      this.pixel(p.x, p.y + offsetY, color);
    }
  }

  drawBody(style: StyleConfig, color: string, offsetY: number) {
    this.rect({ ...style.body.head, y: style.body.head.y + offsetY }, color);
    this.points(style.body.ears, color, offsetY);
    this.rect({ ...style.body.bodyRect, y: style.body.bodyRect.y + offsetY }, color);

    const isLongTail = style.body.tail.length >= 4;
    const tailLen = style.body.tail.length;
    const tailOffset = isLongTail
      ? Math.round(Math.sin(this.frame * 0.3) * 2)
      : 0;
    for (let i = 0; i < tailLen; i++) {
      const p = style.body.tail[i];
      let xOff = 0;
      if (isLongTail) {
        xOff = tailOffset;
      } else if (i === tailLen - 1) {
        xOff = (this.frame % 20 < 10 ? 0 : 1);
      }
      this.pixel(p.x + xOff, p.y + offsetY, color);
    }
  }

  drawFace(style: StyleConfig, offsetY: number, eyeOpen: boolean, mouth: 'smile' | 'neutral' | 'frown', eyeColorHex: string) {
    const eyeColor = eyeOpen ? eyeColorHex : '#88a';
    if (eyeOpen) {
      this.rect({ ...style.face.eyeLeft, y: style.face.eyeLeft.y + offsetY }, eyeColor);
      this.rect({ ...style.face.eyeRight, y: style.face.eyeRight.y + offsetY }, eyeColor);
    } else {
      // closed eyes drop down 1 pixel
      this.rect({ ...style.face.eyeLeft, y: style.face.eyeLeft.y + offsetY + 1 }, eyeColor);
      this.rect({ ...style.face.eyeRight, y: style.face.eyeRight.y + offsetY + 1 }, eyeColor);
    }
    this.points(style.face.mouth[mouth], '#334', offsetY);
    if (mouth === 'smile' && style.face.tongue) {
      this.points(style.face.tongue, '#e67a7a', offsetY);
    }
  }

  drawLegs(style: StyleConfig, color: string, offsetY: number, frameNum: number) {
    const leg1 = (frameNum % 20) < 10 ? 0 : 1;
    const leg2 = (frameNum % 20) < 10 ? 1 : 0;
    for (const p of style.legs.left) {
      this.pixel(p.x, p.y + offsetY + leg1, color);
    }
    for (const p of style.legs.right) {
      this.pixel(p.x, p.y + offsetY + leg2, color);
    }
  }
}
