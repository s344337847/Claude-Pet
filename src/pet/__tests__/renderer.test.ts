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
});
