import { describe, it, expect } from 'vitest';
import { IdleAction, WalkAction, WorkAction, SuccessAction, FailAction, SleepAction, ReturningAction } from '../actions';

describe('Actions registry', () => {
  it('each action has a unique name', () => {
    const actions = [
      new IdleAction(),
      new WalkAction(),
      new WorkAction(),
      new SuccessAction(),
      new FailAction(),
      new SleepAction(),
      new ReturningAction(),
    ];
    const names = actions.map(a => a.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
