import { describe, it, expect, beforeEach } from 'vitest';
import { defaultStyle } from '../styles';
import { PetRenderer } from '../renderer/PetRenderer';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    fillRect: () => {},
    clearRect: () => {},
    canvas: { width: 128, height: 128 } as HTMLCanvasElement,
  } as unknown as CanvasRenderingContext2D;
}

describe('PetRenderer', () => {
  let ctx: CanvasRenderingContext2D;
  let renderer: PetRenderer;

  beforeEach(() => {
    ctx = createMockCtx();
    renderer = new PetRenderer(ctx, 4);
  });

  it('draws body without throwing', () => {
    expect(() => renderer.drawBody(defaultStyle, '#6b8cff', 0)).not.toThrow();
  });

  it('draws face without throwing', () => {
    expect(() => renderer.drawFace(defaultStyle, 0, true, 'neutral', '#111')).not.toThrow();
  });

  it('draws long tail with dynamic offset without throwing', () => {
    const dog = {
      ...defaultStyle,
      name: 'dog',
      body: { ...defaultStyle.body, tail: [{ x: 22, y: 17 }, { x: 23, y: 16 }, { x: 24, y: 15 }, { x: 25, y: 14 }] },
    };
    expect(() => renderer.drawBody(dog, '#d4a574', 0)).not.toThrow();
  });

  it('draws tongue only on smile', () => {
    const dog = {
      ...defaultStyle,
      name: 'dog',
      face: { ...defaultStyle.face, tongue: [{ x: 15, y: 14 }] },
    };
    const pixels: Array<{ x: number; y: number; color: string }> = [];
    (renderer as any)['pixel'] = (x: number, y: number, color: string) => {
      pixels.push({ x, y, color });
    };

    renderer.drawFace(dog, 0, true, 'smile', '#111');
    expect(pixels.some((p) => p.color === '#e67a7a')).toBe(true);

    pixels.length = 0;
    renderer.drawFace(dog, 0, true, 'neutral', '#111');
    expect(pixels.some((p) => p.color === '#e67a7a')).toBe(false);
  });

  it('short tail animates only the tip', () => {
    const shortTail = {
      ...defaultStyle,
      body: { ...defaultStyle.body, tail: [{ x: 22, y: 18 }, { x: 23, y: 17 }] },
    };
    const pixelsA: Array<{ x: number; y: number }> = [];
    const pixelsB: Array<{ x: number; y: number }> = [];
    const r1 = new PetRenderer({
      fillStyle: '',
      fillRect: () => {},
      clearRect: () => {},
      canvas: { width: 128, height: 128 },
    } as unknown as CanvasRenderingContext2D, 4);
    (r1 as any)['pixel'] = (x: number, y: number) => pixelsA.push({ x, y });
    r1.setFrame(0);
    r1.drawBody(shortTail, '#111', 0);

    const r2 = new PetRenderer({
      fillStyle: '',
      fillRect: () => {},
      clearRect: () => {},
      canvas: { width: 128, height: 128 },
    } as unknown as CanvasRenderingContext2D, 4);
    (r2 as any)['pixel'] = (x: number, y: number) => pixelsB.push({ x, y });
    r2.setFrame(15);
    r2.drawBody(shortTail, '#111', 0);

    // base pixel (first tail point) should stay same, tip (last) should move
    expect(pixelsA[0]).toEqual(pixelsB[0]);
    expect(pixelsA[pixelsA.length - 1]).not.toEqual(pixelsB[pixelsB.length - 1]);
  });
});
