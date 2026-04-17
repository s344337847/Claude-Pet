import { describe, it, expect } from 'vitest';
import { defaultStyle } from '../styles';

describe('StyleConfig', () => {
  it('defaultStyle has required body parts', () => {
    expect(defaultStyle.body.head.w).toBe(12);
    expect(defaultStyle.body.ears.length).toBe(4);
    expect(defaultStyle.legs.left.length).toBe(2);
  });
});
