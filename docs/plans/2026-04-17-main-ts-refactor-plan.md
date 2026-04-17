# main.ts Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the monolithic `main.ts` into an extensible multi-pet architecture supporting new actions, skin styles, and dynamic per-task windows.

**Architecture:** Split frontend into `PetRuntime` (event bus), `Pet` (state machine + window movement), `Action` classes (per-state behavior), and `PetRenderer` + `StyleConfig` (config-driven pixel drawing). Backend introduces `PetManager` to map `task_id` to dynamic Tauri windows, keeping a permanent `default_pet` when idle.

**Tech Stack:** Tauri v2, Rust, TypeScript, Canvas 2D, Axum, Vitest (for frontend unit tests)

---

## Pre-requisites

- Read `docs/plans/2026-04-17-main-ts-refactor-design.md` for full design context.
- Read `CLAUDE.md` for build commands and project conventions.
- This project has no existing test framework; we will add Vitest for Action / Renderer tests.

---

### Task 1: Add Vitest testing infrastructure

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/pet/__tests__/renderer.test.ts` (failing first)

**Step 1: Install Vitest**

Run:
```bash
npm install -D vitest jsdom @vitest/ui
```
Expected: `package.json` devDependencies now include `vitest`, `jsdom`, `@vitest/ui`.

**Step 2: Add test script and vitest config**

Modify `package.json` test script:
```json
"scripts": {
  "test": "vitest run",
  "test:ui": "vitest --ui"
}
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

**Step 3: Write a failing renderer test**

Create `src/pet/__tests__/renderer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('PetRenderer placeholder', () => {
  it('should have a PetRenderer class', () => {
    expect(typeof PetRenderer).toBe('function');
  });
});
```

Run:
```bash
npm test
```
Expected: FAIL with `PetRenderer is not defined`.

**Step 4: Commit**

```bash
git add package.json vitest.config.ts src/pet/__tests__/renderer.test.ts
npm install  # to update package-lock.json
git add package-lock.json
git commit -m "chore: add vitest for frontend unit tests"
```

---

### Task 2: Extract StyleConfig types and default style

**Files:**
- Create: `src/pet/styles/types.ts`
- Create: `src/pet/styles/default.ts`
- Create: `src/pet/styles/index.ts`
- Modify: `src/pet/__tests__/renderer.test.ts`

**Step 1: Define StyleConfig types**

Create `src/pet/styles/types.ts`:
```ts
export interface PixelRect { x: number; y: number; w: number; h: number; }
export interface PixelPoint { x: number; y: number; }

export interface StyleColors {
  primary: string;
  work: string;
  success: string;
  fail: string;
  sleep: string;
}

export interface StyleConfig {
  name: string;
  colors: StyleColors;
  body: {
    head: PixelRect;
    ears: PixelPoint[];
    bodyRect: PixelRect;
    tail: PixelPoint[];
  };
  face: {
    eyeLeft: PixelRect;
    eyeRight: PixelRect;
    mouth: {
      smile: PixelPoint[];
      neutral: PixelPoint[];
      frown: PixelPoint[];
    };
  };
  legs: {
    left: PixelPoint[];
    right: PixelPoint[];
  };
}
```

**Step 2: Create default cat style**

Create `src/pet/styles/default.ts` matching current hard-coded body layout:
```ts
import type { StyleConfig } from './types';

export const defaultStyle: StyleConfig = {
  name: 'default-cat',
  colors: {
    primary: '#6b8cff',
    work: '#ffaa44',
    success: '#6b8cff',
    fail: '#889999',
    sleep: '#6b8cff',
  },
  body: {
    head: { x: 10, y: 6, w: 12, h: 10 },
    ears: [{ x: 10, y: 4 }, { x: 11, y: 4 }, { x: 20, y: 4 }, { x: 21, y: 4 }],
    bodyRect: { x: 11, y: 16, w: 10, h: 10 },
    tail: [{ x: 22, y: 18 }, { x: 23, y: 17 }],
  },
  face: {
    eyeLeft: { x: 12, y: 10, w: 2, h: 1 },
    eyeRight: { x: 18, y: 10, w: 2, h: 1 },
    mouth: {
      smile: [{ x: 14, y: 13 }, { x: 15, y: 13 }, { x: 16, y: 13 }, { x: 17, y: 13 }, { x: 13, y: 12 }, { x: 18, y: 12 }],
      neutral: [{ x: 14, y: 13 }, { x: 15, y: 13 }, { x: 16, y: 13 }, { x: 17, y: 13 }],
      frown: [{ x: 14, y: 12 }, { x: 15, y: 12 }, { x: 16, y: 12 }, { x: 17, y: 12 }, { x: 13, y: 13 }, { x: 18, y: 13 }],
    },
  },
  legs: {
    left: [{ x: 11, y: 26 }, { x: 12, y: 26 }],
    right: [{ x: 19, y: 26 }, { x: 20, y: 26 }],
  },
};
```

Create `src/pet/styles/index.ts`:
```ts
export * from './types';
export { defaultStyle } from './default';
```

**Step 3: Write a test that imports the style**

Modify `src/pet/__tests__/renderer.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defaultStyle } from '../styles';

describe('StyleConfig', () => {
  it('defaultStyle has required body parts', () => {
    expect(defaultStyle.body.head.w).toBe(12);
    expect(defaultStyle.body.ears.length).toBe(4);
    expect(defaultStyle.legs.left.length).toBe(2);
  });
});
```

Run:
```bash
npm test
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/pet/styles/ src/pet/__tests__/renderer.test.ts
git commit -m "feat(styles): add StyleConfig types and default cat style"
```

---

### Task 3: Build PetRenderer with config-driven drawing

**Files:**
- Create: `src/pet/renderer/PetRenderer.ts`
- Modify: `src/pet/__tests__/renderer.test.ts`
- Modify: `src/pet/styles/types.ts` (add eyeClosed offset if needed)

**Step 1: Write failing PetRenderer test**

Modify `src/pet/__tests__/renderer.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { defaultStyle } from '../styles';
import { PetRenderer } from '../renderer/PetRenderer';

describe('PetRenderer', () => {
  let canvas: HTMLCanvasElement;
  let ctx: CanvasRenderingContext2D;
  let renderer: PetRenderer;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    ctx = canvas.getContext('2d')!;
    renderer = new PetRenderer(ctx, 4);
  });

  it('draws body without throwing', () => {
    expect(() => renderer.drawBody(defaultStyle, '#6b8cff', 0)).not.toThrow();
  });

  it('draws face without throwing', () => {
    expect(() => renderer.drawFace(defaultStyle, 0, true, 'neutral', '#111')).not.toThrow();
  });
});
```

Run:
```bash
npm test
```
Expected: FAIL `Cannot find module '../renderer/PetRenderer'`.

**Step 2: Implement PetRenderer**

Create `src/pet/renderer/PetRenderer.ts`:
```ts
import type { StyleConfig, PixelPoint, PixelRect } from '../styles/types';

export class PetRenderer {
  constructor(private ctx: CanvasRenderingContext2D, private scale: number) {}

  setScale(scale: number) {
    this.scale = scale;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  private pixel(x: number, y: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x * this.scale, y * this.scale, this.scale, this.scale);
  }

  private rect(r: PixelRect, color: string) {
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
    this.points(style.body.tail, color, offsetY);
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
```

Run:
```bash
npm test
```
Expected: PASS.

**Step 3: Commit**

```bash
git add src/pet/renderer/ src/pet/__tests__/renderer.test.ts
git commit -m "feat(renderer): add config-driven PetRenderer"
```

---

### Task 4: Define Action interface and IdleAction

**Files:**
- Create: `src/pet/actions/types.ts`
- Create: `src/pet/actions/IdleAction.ts`
- Create: `src/pet/__tests__/idle-action.test.ts`

**Step 1: Write Action types**

Create `src/pet/actions/types.ts`:
```ts
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export interface Action {
  readonly name: string;
  onEnter(pet: Pet): void;
  update(pet: Pet): void;
  render(renderer: PetRenderer, pet: Pet): void;
  onExit(pet: Pet): void;
  shouldExit(pet: Pet): boolean;
}
```

**Step 2: Write failing IdleAction test**

Create `src/pet/__tests__/idle-action.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { IdleAction } from '../actions/IdleAction';

describe('IdleAction', () => {
  it('has name idle', () => {
    const action = new IdleAction();
    expect(action.name).toBe('idle');
  });
});
```

Run:
```bash
npm test
```
Expected: FAIL `Cannot find module '../actions/IdleAction'`.

**Step 3: Implement IdleAction**

Create `src/pet/actions/IdleAction.ts`:
```ts
import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class IdleAction implements Action {
  readonly name = 'idle';
  private idleTimer = 0;

  onEnter(pet: Pet) {
    this.idleTimer = 0;
  }

  update(pet: Pet) {
    this.idleTimer++;
    if (this.idleTimer > 180) {
      pet.transitionTo('walk');
    }
  }

  render(renderer: PetRenderer, pet: Pet) {
    const frame = pet.getFrame();
    const blink = Math.random() < 0.02;
    const offsetY = Math.sin(frame * 0.05) * 0.5;
    const style = pet.getStyle();
    const color = style.colors.primary;
    renderer.drawBody(style, color, offsetY);
    renderer.drawFace(style, offsetY, !blink, 'neutral', '#111');
    renderer.drawLegs(style, color, offsetY, 0);
  }

  onExit() {}
  shouldExit() { return false; }
}
```

> Note: `Pet` stub methods (`getFrame`, `getStyle`, `transitionTo`) will be defined in the next task. The test only checks `name`, so compilation errors are acceptable at this stage if tests pass. To avoid TS errors in CI, we may need a minimal `Pet` stub file first.

Create a minimal `src/pet/Pet.ts` stub to satisfy TS:
```ts
import type { StyleConfig } from './styles/types';

export class Pet {
  getFrame() { return 0; }
  getStyle(): StyleConfig { return {} as StyleConfig; }
  transitionTo(_state: string) {}
}
```

Run:
```bash
npm test
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/pet/actions/ src/pet/Pet.ts src/pet/__tests__/idle-action.test.ts
git commit -m "feat(actions): add Action interface and IdleAction"
```

---

### Task 5: Implement remaining Actions

**Files:**
- Create: `src/pet/actions/WalkAction.ts`
- Create: `src/pet/actions/WorkAction.ts`
- Create: `src/pet/actions/SuccessAction.ts`
- Create: `src/pet/actions/FailAction.ts`
- Create: `src/pet/actions/SleepAction.ts`
- Create: `src/pet/actions/ReturningAction.ts`
- Create: `src/pet/actions/index.ts`
- Modify: `src/pet/Pet.ts` (add required methods used by actions)
- Modify: `src/pet/__tests__/actions.test.ts`

**Step 1: Expand Pet stub with methods actions need**

Modify `src/pet/Pet.ts` stub:
```ts
import type { StyleConfig } from './styles/types';

export class Pet {
  private frame = 0;
  private style: StyleConfig;

  constructor(style: StyleConfig) {
    this.style = style;
  }

  getFrame() { return this.frame; }
  tickFrame() { this.frame++; }
  getStyle() { return this.style; }
  transitionTo(_state: string) {}
  setWindowPosition(_x: number, _y: number) {}
  getWindowPosition() { return { x: 0, y: 0 }; }
}
```

**Step 2: Implement WalkAction**

Create `src/pet/actions/WalkAction.ts`:
```ts
import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class WalkAction implements Action {
  readonly name = 'walk';

  onEnter() {}
  update(pet: Pet) {
    if (Math.random() < 0.005) {
      pet.transitionTo('idle');
    }
  }
  render(renderer: PetRenderer, pet: Pet) {
    const frame = pet.getFrame();
    const bounce = Math.abs(Math.sin(frame * 0.2)) * 1.5;
    const style = pet.getStyle();
    const color = style.colors.primary;
    renderer.drawBody(style, color, bounce);
    renderer.drawFace(style, bounce, true, 'neutral', '#111');
    renderer.drawLegs(style, color, bounce, frame);
  }
  onExit() {}
  shouldExit() { return false; }
}
```

**Step 3: Implement WorkAction**

Create `src/pet/actions/WorkAction.ts`:
```ts
import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class WorkAction implements Action {
  readonly name = 'work';

  onEnter() {}
  update() {}
  render(renderer: PetRenderer, pet: Pet) {
    const frame = pet.getFrame();
    const typeOffset = (frame % 10) < 5 ? 0 : 1;
    const style = pet.getStyle();
    const color = style.colors.work;
    renderer.drawBody(style, color, 0);
    renderer.drawFace(style, 0, true, 'neutral', '#111');
    renderer.drawLegs(style, color, 0, 0);
    // typing hands / keyboard
    const ctx = (renderer as any).ctx; // avoid; instead add helper on renderer later if needed
    // For now, keep inline using a private ctx access or extend renderer later.
    // We'll use a temporary inline approach in Pet.ts render loop for non-body effects.
  }
  onExit() {}
  shouldExit() { return false; }
}
```

> Because some actions draw arbitrary rects/pixels outside the body (work keyboard, success confetti, sleep Zzz), `PetRenderer` needs generic `pixel`/`rect` helpers exposed.

Modify `src/pet/renderer/PetRenderer.ts` to expose `pixel` and `rect` publicly:
```ts
export class PetRenderer {
  constructor(private ctx: CanvasRenderingContext2D, private scale: number) {}
  // ... existing methods ...
  pixel(x: number, y: number, color: string) { ... }
  rect(r: PixelRect, color: string) { ... }
}
```

Then update `WorkAction.render`:
```ts
render(renderer: PetRenderer, pet: Pet) {
  const frame = pet.getFrame();
  const typeOffset = (frame % 10) < 5 ? 0 : 1;
  const style = pet.getStyle();
  const color = style.colors.work;
  renderer.drawBody(style, color, 0);
  renderer.drawFace(style, 0, true, 'neutral', '#111');
  renderer.drawLegs(style, color, 0, 0);
  renderer.rect({ x: 8 + typeOffset, y: 22, w: 4, h: 2 }, '#334');
  renderer.rect({ x: 20 - typeOffset, y: 22, w: 4, h: 2 }, '#334');
  renderer.rect({ x: 24, y: 4, w: 6, h: 4 }, '#fff');
  renderer.pixel(25, 3, '#fff');
  renderer.pixel(26, 2, '#fff');
  renderer.rect({ x: 26, y: 5, w: 2, h: 2 }, '#0f0');
}
```

Similarly implement:
- `SuccessAction` with confetti particles.
- `FailAction` with sweat drop.
- `SleepAction` with Zzz particles.
- `ReturningAction` with bounce walk.

For brevity, the plan references the exact current `main.ts` render logic and ports it 1:1.

Create `src/pet/actions/SuccessAction.ts`, `FailAction.ts`, `SleepAction.ts`, `ReturningAction.ts` following the same pattern.

Create `src/pet/actions/index.ts`:
```ts
export type { Action } from './types';
export { IdleAction } from './IdleAction';
export { WalkAction } from './WalkAction';
export { WorkAction } from './WorkAction';
export { SuccessAction } from './SuccessAction';
export { FailAction } from './FailAction';
export { SleepAction } from './SleepAction';
export { ReturningAction } from './ReturningAction';
```

**Step 4: Write a test verifying all action names**

Create `src/pet/__tests__/actions.test.ts`:
```ts
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
```

Run:
```bash
npm test
```
Expected: PASS.

**Step 5: Commit**

```bash
git add src/pet/actions/ src/pet/__tests__/actions.test.ts src/pet/renderer/PetRenderer.ts
git commit -m "feat(actions): implement all pet actions"
```

---

### Task 6: Build the Pet class with state machine and window movement

**Files:**
- Modify: `src/pet/Pet.ts` (full implementation)
- Create: `src/pet/__tests__/pet.test.ts`
- Modify: `src/types.ts` (add `PetState` union)

**Step 1: Define global PetState type**

Modify `src/types.ts`:
```ts
export type PetState = 'idle' | 'walk' | 'work' | 'success' | 'fail' | 'sleep' | 'returning';
```

**Step 2: Write failing Pet class test**

Create `src/pet/__tests__/pet.test.ts`:
```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { Pet } from '../Pet';
import { defaultStyle } from '../styles';

describe('Pet state machine', () => {
  let pet: Pet;

  beforeEach(() => {
    pet = new Pet(defaultStyle, 4);
  });

  it('starts in idle state', () => {
    expect(pet.getCurrentState()).toBe('idle');
  });

  it('can transition to work', () => {
    pet.setState('work');
    expect(pet.getCurrentState()).toBe('work');
  });
});
```

Run:
```bash
npm test
```
Expected: FAIL because `Pet` constructor signature changed and methods missing.

**Step 3: Implement Pet class**

Rewrite `src/pet/Pet.ts`:
```ts
import type { StyleConfig } from './styles/types';
import type { PetState } from '../types';
import type { Action } from './actions/types';
import { IdleAction, WalkAction, WorkAction, SuccessAction, FailAction, SleepAction, ReturningAction } from './actions';
import { PetRenderer } from './renderer/PetRenderer';

const ACTIONS: Record<PetState, new () => Action> = {
  idle: IdleAction,
  walk: WalkAction,
  work: WorkAction,
  success: SuccessAction,
  fail: FailAction,
  sleep: SleepAction,
  returning: ReturningAction,
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
    this.renderer.setScale(s);
    const logicalSize = 32 * s;
    this.ctx.canvas.width = logicalSize;
    this.ctx.canvas.height = logicalSize;
  }

  getFrame() { return this.frame; }
  getStyle() { return this.style; }
  getCurrentState() { return this.currentState; }

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
    this.action.update(this);
    this.renderer.clear();
    this.action.render(this.renderer, this);
  }
}
```

Run:
```bash
npm test
```
Expected: PASS.

**Step 4: Commit**

```bash
git add src/pet/Pet.ts src/pet/__tests__/pet.test.ts src/types.ts
git commit -m "feat(pet): add Pet class with state machine and renderer"
```

---

### Task 7: Add pet-window entry and split from main.ts

**Files:**
- Create: `src/pet/index.ts`
- Modify: `src/main.ts` (becomes PetRuntime)
- Modify: `index.html` (or create `pet.html` if needed)
- Check: `vite.config.ts`

**Step 1: Create pet window entry**

Create `src/pet/index.ts`:
```ts
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Pet } from './Pet';
import { defaultStyle } from './styles';

const canvas = document.getElementById('pet-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const win = getCurrentWindow();
const label = win.label;

const pet = new Pet(defaultStyle, 4, ctx);

listen<{ state: import('../types').PetState }>(`pet_state_change:${label}`, (event) => {
  pet.setState(event.payload.state);
});

function tick() {
  pet.tick();
  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
```

> Note: `pet_state_change:${label}` event naming must be agreed with backend. We emit event per label.

**Step 2: Rewrite main.ts as PetRuntime**

Modify `src/main.ts`:
```ts
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { PetState } from './types';

interface StatePayload {
  state: PetState;
  task_count: number;
  in_progress_count: number;
}

// Track known pet windows to avoid duplicate creation
const knownPets = new Set<string>();

async function ensurePetWindow(label: string) {
  if (knownPets.has(label)) return;
  // Ask Rust to create the window if it doesn't exist
  await invoke('create_pet_window', { label });
  knownPets.add(label);
}

listen<StatePayload & { label: string }>('pet_state_change', async (event) => {
  const { label, state } = event.payload;
  await ensurePetWindow(label);
  // Forward event to the specific window via its own channel
  // Actually Rust should emit per-label events. Frontend just ensures window exists.
});

// Ensure default pet exists on startup
ensurePetWindow('default_pet');
```

Wait — Tauri events are global. If Rust emits `pet_state_change:default_pet`, only the `default_pet` window needs to listen. So `main.ts` doesn't need to forward. It only needs to call `create_pet_window` when a new label appears.

Simplify `src/main.ts`:
```ts
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { PetState } from './types';

interface PetStateEvent {
  label: string;
  state: PetState;
}

const knownPets = new Set<string>();

async function ensurePetWindow(label: string) {
  if (knownPets.has(label)) return;
  await invoke('create_pet_window', { label });
  knownPets.add(label);
}

listen<PetStateEvent>('pet_state_change', async (event) => {
  await ensurePetWindow(event.payload.label);
});

ensurePetWindow('default_pet');
```

But we also need `pet.html` for pet windows if they differ from `index.html`. For now, all windows can load `index.html` and the JS decides whether it's runtime or pet based on window label. Simpler: `index.html` stays as-is, but `src/main.ts` checks window label — if it's `main` or `default_pet`, act as runtime; otherwise act as pet.

Actually, a cleaner approach for Tauri is to use a separate HTML entry. But Vite multi-page setup is extra config. Let's keep it simple: use `index.html` for everything, and at runtime detect label.

Update `src/main.ts` to dual-mode:
```ts
import { getCurrentWindow } from '@tauri-apps/api/window';

const label = getCurrentWindow().label;

if (label === 'main') {
  // PetRuntime mode
  await import('./runtime');
} else {
  // Pet window mode
  await import('./pet/index');
}
```

Create `src/runtime.ts` with the runtime logic above.

For this task, implement this dual-entry approach. If Vite/Tauri bundling complains about circular deps, switch to inline checks.

**Step 3: Verify build passes**

Run:
```bash
npm run build
```
Expected: no TypeScript errors.

**Step 4: Manual test**

Run:
```bash
npm run tauri dev
```
Expected: single `default_pet` window appears and animates in idle/walk. Because backend still emits `pet_state_change` without labels, the pet window won't react yet — we fix that in Task 8.

**Step 5: Commit**

```bash
git add src/pet/index.ts src/runtime.ts src/main.ts
git commit -m "feat(frontend): split main.ts into runtime and pet window entry"
```

---

### Task 8: Refactor Rust backend — simplify state.rs and add PetManager (single pet)

**Files:**
- Modify: `src-tauri/src/state.rs`
- Create: `src-tauri/src/pet_manager.rs`
- Modify: `src-tauri/src/server.rs`
- Modify: `src-tauri/src/lib.rs`

**Step 1: Simplify state.rs**

Modify `src-tauri/src/state.rs`:
```rust
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum PetState {
    Idle,
    Walk,
    Work,
    Success,
    Fail,
    Sleep,
    Returning,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatePayload {
    pub state: PetState,
    pub label: String,
    pub task_count: usize,
    pub in_progress_count: usize,
}
```

**Step 2: Add PetManager**

Create `src-tauri/src/pet_manager.rs`:
```rust
use crate::state::{PetState, StatePayload};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{Emitter, Manager};

pub struct PetInstance {
    pub label: String,
    pub task_id: Option<String>,
}

pub struct PetManager {
    pets: Mutex<HashMap<String, PetInstance>>,
    app_handle: tauri::AppHandle,
}

impl PetManager {
    pub fn new(app_handle: tauri::AppHandle) -> Arc<Self> {
        let manager = Arc::new(Self {
            pets: Mutex::new(HashMap::new()),
            app_handle: app_handle.clone(),
        });
        // Create default pet immediately
        manager.create_pet(None);
        manager
    }

    pub fn handle_event(self: &Arc<Self>, event: String, task_id: Option<String>) {
        let new_state = match event.as_str() {
            "work" => PetState::Work,
            "success" => PetState::Success,
            "fail" => PetState::Fail,
            "sleep" => PetState::Sleep,
            _ => PetState::Idle,
        };

        let label = if let Some(ref tid) = task_id {
            // For now, always route to default_pet until multi-window is enabled
            "default_pet".to_string()
        } else {
            "default_pet".to_string()
        };

        let payload = StatePayload {
            state: new_state,
            label: label.clone(),
            task_count: 0,
            in_progress_count: 0,
        };

        let _ = self.app_handle.emit("pet_state_change", payload);
    }

    pub fn create_pet(self: &Arc<Self>, task_id: Option<String>) -> String {
        let label = task_id.clone().unwrap_or_else(|| "default_pet".to_string());
        {
            let mut pets = self.pets.lock().unwrap();
            if pets.contains_key(&label) {
                return label;
            }
            pets.insert(
                label.clone(),
                PetInstance {
                    label: label.clone(),
                    task_id,
                },
            );
        }

        // Create Tauri window
        let window_label = label.clone();
        let app_handle = self.app_handle.clone();
        tauri::async_runtime::spawn(async move {
            let _ = tauri::WebviewWindowBuilder::new(
                &app_handle,
                window_label,
                tauri::WebviewUrl::App("index.html".into()),
            )
            .title("Claude Pet")
            .inner_size(128.0, 128.0)
            .decorations(false)
            .transparent(true)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .build();
        });

        label
    }
}
```

> Note: `WebviewWindowBuilder` path and API must match Tauri v2. Verify exact import names if compiler complains.

**Step 3: Add Tauri command for create_pet_window**

In `src-tauri/src/lib.rs` or a new `commands.rs`, expose:

```rust
#[tauri::command]
fn create_pet_window(label: String, state: tauri::State<Arc<PetManager>>) {
    state.create_pet(Some(label));
}
```

**Step 4: Wire PetManager into lib.rs and server.rs**

Modify `src-tauri/src/lib.rs`:
- Replace `StateManager` usage with `PetManager`.
- Register `create_pet_window` command.

Modify `src-tauri/src/server.rs`:
- Replace `StateManager` with `PetManager`.
- Update `handle_event` to accept optional JSON body with `task_id`.

Because exact Rust code depends on current `lib.rs`, this task requires reading `src-tauri/src/lib.rs` first and adapting.

**Step 5: Compile Rust**

Run:
```bash
cd src-tauri && cargo check
```
Expected: no errors. Fix any import/path issues.

**Step 6: Integration test**

Run:
```bash
npm run tauri dev
```
In another terminal:
```bash
node test-events.js
```
Expected: single pet window reacts to events correctly (work → success → idle).

**Step 7: Commit**

```bash
git add src-tauri/src/
git commit -m "feat(backend): add PetManager and simplify state module"
```

---

### Task 9: Enable multi-window dynamic creation by task_id

**Files:**
- Modify: `src-tauri/src/pet_manager.rs`
- Modify: `src-tauri/src/server.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src/runtime.ts`
- Modify: `src/pet/index.ts`

**Step 1: Update server to parse task_id from JSON body**

Modify `src-tauri/src/server.rs` `handle_event`:

```rust
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use serde::Deserialize;

#[derive(Deserialize)]
struct EventBody {
    task_id: Option<String>,
}

async fn handle_event(
    State(state): State<Arc<ServerState>>,
    Path(event): Path<String>,
    Json(body): Json<EventBody>,
) -> impl IntoResponse {
    state.pet_manager.handle_event(event, body.task_id);
    StatusCode::OK
}
```

Update `ServerState` to hold `PetManager`.

**Step 2: Update PetManager routing logic**

Modify `src-tauri/src/pet_manager.rs` `handle_event`:

```rust
pub fn handle_event(self: &Arc<Self>, event: String, task_id: Option<String>) {
    let new_state = match event.as_str() {
        "work" => PetState::Work,
        "success" => PetState::Success,
        "fail" => PetState::Fail,
        "sleep" => PetState::Sleep,
        _ => PetState::Idle,
    };

    let label = match task_id {
        Some(ref tid) => {
            let mut pets = self.pets.lock().unwrap();
            if !pets.contains_key(tid) {
                drop(pets);
                self.create_pet(Some(tid.clone()));
            }
            tid.clone()
        }
        None => "default_pet".to_string(),
    };

    let payload = StatePayload {
        state: new_state,
        label: label.clone(),
        task_count: 0,
        in_progress_count: 0,
    };

    let _ = self.app_handle.emit("pet_state_change", payload);
}
```

**Step 3: Ensure default_pet persists after task pets are destroyed**

Add `destroy_pet` method in `pet_manager.rs`:

```rust
pub fn destroy_pet(self: &Arc<Self>, label: String) {
    if label == "default_pet" {
        return;
    }
    {
        let mut pets = self.pets.lock().unwrap();
        pets.remove(&label);
    }
    if let Some(window) = self.app_handle.get_webview_window(&label) {
        let _ = window.close();
    }
}
```

Wire `destroy_pet` as a Tauri command in `lib.rs`:

```rust
#[tauri::command]
fn destroy_pet(label: String, state: tauri::State<Arc<PetManager>>) {
    state.destroy_pet(label);
}
```

**Step 4: Auto-destroy on success/fail after delay**

In `PetManager::handle_event`, when state is `Success` or `Fail` and `task_id` is Some, spawn a delayed cleanup:

```rust
if matches!(new_state, PetState::Success | PetState::Fail) {
    if let Some(ref tid) = task_id {
        let manager = self.clone();
        let tid = tid.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            manager.destroy_pet(tid);
        });
    }
}
```

**Step 5: Frontend runtime listens to destroy events**

Modify `src/runtime.ts` to also listen for `destroy_pet` events and remove from `knownPets`:

```ts
listen<string>('destroy_pet', (event) => {
  knownPets.delete(event.payload);
});
```

**Step 6: Pet window filters events by label**

Modify `src/pet/index.ts`:

```ts
listen<{ label: string; state: PetState }>('pet_state_change', (event) => {
  if (event.payload.label === label) {
    pet.setState(event.payload.state);
  }
});
```

**Step 7: Test multi-window**

Run:
```bash
npm run tauri dev
```

Send work events with different task IDs:
```bash
curl -X POST http://127.0.0.1:9876/v1/event/work -H "Content-Type: application/json" -d '{"task_id":"task-1"}'
curl -X POST http://127.0.0.1:9876/v1/event/work -H "Content-Type: application/json" -d '{"task_id":"task-2"}'
```

Expected: two new pet windows appear and show work animation.

Send success:
```bash
curl -X POST http://127.0.0.1:9876/v1/event/success -H "Content-Type: application/json" -d '{"task_id":"task-1"}'
```

Expected: task-1 pet jumps to center, celebrates, then closes after ~2s.

**Step 8: Commit**

```bash
git add src-tauri/src/ src/runtime.ts src/pet/index.ts
git commit -m "feat(multi-pet): enable dynamic window creation per task_id"
```

---

### Task 10: Final cleanup and regression verification

**Files:**
- All modified files
- `test-events.js` (update to support optional task_id)

**Step 1: Run all frontend tests**

```bash
npm test
```
Expected: ALL PASS.

**Step 2: Run Rust check**

```bash
cd src-tauri && cargo check
```
Expected: no errors.

**Step 3: Update test-events.js to exercise multi-pet**

Add example `task_id` payloads in comments or as optional CLI args.

**Step 4: Full manual smoke test**

```bash
npm run tauri dev
node test-events.js
```

Verify:
- Default pet idle/walks when no events.
- Work event triggers work animation.
- Success triggers jump and confetti.
- Fail triggers frown and sweat.
- Scale change from settings still resizes correctly.

**Step 5: Final commit**

```bash
git add test-events.js
git commit -m "chore: update test-events.js for multi-pet testing"
```

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-04-17-main-ts-refactor-plan.md`.

**Two execution options:**

**1. Subagent-Driven (this session)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Parallel Session (separate)** — Open a new session with `superpowers:executing-plans`, batch execution with checkpoints.

Which approach would you like?
