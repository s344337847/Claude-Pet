import type { StyleConfig, PixelPoint, PixelRect } from '../styles/types';

export class PetRenderer {
  private frame = 0;

  constructor(private ctx: CanvasRenderingContext2D, private scale: number) {}

  setScale(scale: number) {
    this.scale = scale;
  }

  setFrame(f: number) {
    this.frame = f;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  pixel(x: number, y: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
  }

  rect(r: PixelRect, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(r.x * this.scale, r.y * this.scale, r.w * this.scale, r.h * this.scale);
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
