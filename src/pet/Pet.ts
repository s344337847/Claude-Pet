import type { StyleConfig, StyleColors } from './styles/types';
import type { PetState } from '../types';
import type { Action } from './actions/types';
import { IdleAction, WalkAction, WorkAction, SuccessAction, FailAction, SleepAction, EnterAction, ExitAction } from './actions';
import { PetRenderer } from './renderer/PetRenderer';

const ACTIONS: Record<PetState, new () => Action> = {
  idle: IdleAction,
  walk: WalkAction,
  work: WorkAction,
  success: SuccessAction,
  fail: FailAction,
  sleep: SleepAction,
  enter: EnterAction,
  exit: ExitAction,
};

export class Pet {
  private frame = 0;
  private currentState: PetState = 'idle';
  private action: Action;
  private renderer: PetRenderer;

  constructor(
    private style: StyleConfig,
    private scale: number,
    private ctx: CanvasRenderingContext2D,
  ) {
    this.renderer = new PetRenderer(ctx, scale);
    this.action = new IdleAction();
    this.action.onEnter(this);
  }

  setScale(s: number) {
    this.scale = s;
    this.renderer.setScale(this.scale);
    const logicalSize = 32 * this.scale;
    this.ctx.canvas.width = logicalSize;
    this.ctx.canvas.height = logicalSize;
  }

  getFrame() { return this.frame; }
  getStyle() { return this.style; }
  getCurrentState() { return this.currentState; }

  setColors(colors: StyleColors) {
    this.style = { ...this.style, colors };
  }

  setStyle(style: StyleConfig) {
    // Preserve user-configured colors; only swap pixel geometry
    this.style = { ...style, colors: this.style.colors };
  }

  transitionTo(state: PetState) {
    this.setState(state);
  }

  setState(state: PetState) {
    if (state === this.currentState) return;
    this.action.onExit(this);
    const ActionCtor = ACTIONS[state];
    this.action = new ActionCtor();
    this.currentState = state;
    this.action.onEnter(this);
  }

  tick() {
    this.frame++;
    this.renderer.setFrame(this.frame);
    this.action.update(this);
    this.renderer.clear();
    this.action.render(this.renderer, this);
  }
}
