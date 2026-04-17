import { describe, it, expect, beforeEach } from 'vitest';
import { Pet } from '../Pet';
import { defaultStyle } from '../styles';

function createMockCtx(): CanvasRenderingContext2D {
  return {
    fillStyle: '',
    fillRect: () => {},
    clearRect: () => {},
    canvas: { width: 128, height: 128 } as HTMLCanvasElement,
  } as unknown as CanvasRenderingContext2D;
}

describe('Pet state machine', () => {
  let pet: Pet;

  beforeEach(() => {
    pet = new Pet(defaultStyle, 4, createMockCtx());
  });

  it('starts in idle state', () => {
    expect(pet.getCurrentState()).toBe('idle');
  });

  it('can transition to work', () => {
    pet.setState('work');
    expect(pet.getCurrentState()).toBe('work');
  });
});
