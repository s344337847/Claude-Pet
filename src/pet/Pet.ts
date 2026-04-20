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

export const CANVAS_LOGICAL_SIZE = 32;

function getStyleMaxY(style: StyleConfig): number {
  let maxY = 0;
  const body = style.body;
  maxY = Math.max(maxY, body.head.y + body.head.h);
  for (const p of body.ears) maxY = Math.max(maxY, p.y + 1);
  maxY = Math.max(maxY, body.bodyRect.y + body.bodyRect.h);
  for (const p of body.tail) maxY = Math.max(maxY, p.y + 1);

  const face = style.face;
  maxY = Math.max(maxY, face.eyeLeft.y + face.eyeLeft.h);
  maxY = Math.max(maxY, face.eyeRight.y + face.eyeRight.h);
  for (const pts of Object.values(face.mouth)) {
    for (const p of pts) maxY = Math.max(maxY, p.y + 1);
  }
  if (face.tongue) {
    for (const p of face.tongue) maxY = Math.max(maxY, p.y + 1);
  }

  for (const p of style.legs.left) maxY = Math.max(maxY, p.y + 1);
  for (const p of style.legs.right) maxY = Math.max(maxY, p.y + 1);

  return maxY;
}

function calculateBaseOffsetY(style: StyleConfig): number {
  const maxY = getStyleMaxY(style);
  // Reserve 1px for walk leg animation (leg1/leg2 alternate +1)
  return Math.max(0, CANVAS_LOGICAL_SIZE - maxY - 1);
}

export class Pet {
  private frame = 0;
  private currentState: PetState = 'idle';
  private action: Action;
  private renderer: PetRenderer;
  /** Global frame counter when the current state started */
  private stateEnterFrame = 0;
  private facing = 1; // 1 = right, -1 = left

  constructor(
    private style: StyleConfig,
    private scale: number,
    private ctx: CanvasRenderingContext2D,
  ) {
    this.renderer = new PetRenderer(ctx, scale);
    this.renderer.setBaseOffsetY(calculateBaseOffsetY(this.style));
    this.action = new IdleAction();
    this.action.onEnter(this);
    // Preload sprite sheet if the initial style has one
    if (this.style.spriteSheet) {
      this.renderer.loadSpriteSheet(this.style.spriteSheet.imageSrc);
    }
  }

  setScale(s: number) {
    this.scale = s;
    this.renderer.setScale(this.scale);
    const pixelSize = this.getCanvasPixelSize();
    this.ctx.canvas.width = pixelSize;
    this.ctx.canvas.height = pixelSize;
  }

  getFrame() { return this.frame; }
  getStyle() { return this.style; }
  getCurrentState() { return this.currentState; }

  getCanvasPixelSize(): number {
    if (this.style.spriteSheet) {
      return this.style.spriteSheet.frameSize;
    }
    return CANVAS_LOGICAL_SIZE * this.scale;
  }

  getDisplaySize(): number {
    if (this.style.spriteSheet) {
      const baseScale = this.style.spriteSheet.frameSize / CANVAS_LOGICAL_SIZE;
      return Math.round(this.style.spriteSheet.frameSize * this.scale / baseScale);
    }
    return CANVAS_LOGICAL_SIZE * this.scale;
  }

  setFacing(f: number) {
    this.facing = f >= 0 ? 1 : -1;
  }

  getFacing() { return this.facing; }

  setColors(colors: StyleColors) {
    this.style = { ...this.style, colors };
  }

  setStyle(style: StyleConfig) {
    // Preserve user-configured colors; only swap pixel geometry
    this.style = { ...style, colors: this.style.colors };
    this.renderer.setBaseOffsetY(calculateBaseOffsetY(this.style));
    // Preload sprite sheet if available
    if (this.style.spriteSheet) {
      this.renderer.loadSpriteSheet(this.style.spriteSheet.imageSrc);
    }
    // Re-apply canvas size since different styles may have different pixel size needs
    const pixelSize = this.getCanvasPixelSize();
    this.ctx.canvas.width = pixelSize;
    this.ctx.canvas.height = pixelSize;
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
    this.stateEnterFrame = this.frame;
    this.action.onEnter(this);
  }

  /**
   * Get the current animation frame index for a given state.
   * Uses the sprite sheet config if available, otherwise returns 0.
   */
  getAnimFrameForState(stateName: string, defaultFrameRate: number = 6): number {
    const sheet = this.style.spriteSheet;
    if (!sheet) return 0;
    const stateConfig = sheet.states[stateName];
    if (!stateConfig) return 0;
    const frameRate = stateConfig.frameRate ?? defaultFrameRate;
    const elapsed = this.frame - this.stateEnterFrame;
    return Math.floor(elapsed / frameRate) % Math.max(1, stateConfig.frameCount);
  }

  tick() {
    this.frame++;
    this.renderer.setFrame(this.frame);
    this.renderer.setFacing(this.facing);
    this.action.update(this);
    this.renderer.clear();
    this.action.render(this.renderer, this);
  }
}
