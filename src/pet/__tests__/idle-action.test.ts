import { describe, it, expect } from 'vitest';
import { IdleAction } from '../actions/IdleAction';

describe('IdleAction', () => {
  it('has name idle', () => {
    const action = new IdleAction();
    expect(action.name).toBe('idle');
  });
});
