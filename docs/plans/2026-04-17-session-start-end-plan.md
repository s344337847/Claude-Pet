# SessionStart/SessionEnd Events and Enter/Exit Animations Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `session_start` and `session_end` HTTP events that trigger dedicated window slide-in/slide-out animations with corresponding canvas enter/exit actions.

**Architecture:** Extend `PetState` on both Rust and TypeScript sides with `Enter` and `Exit` variants. `pet_manager.rs` maps `session_start` to window creation + `Enter` state, and `session_end` to `Exit` state followed by a timed window destruction. The frontend `index.ts` tick loop drives window position changes for `enter` (slide up from bottom) and `exit` (slide down off screen), while two new `EnterAction` and `ExitAction` classes handle canvas rendering.

**Tech Stack:** Rust (Tauri, Axum), TypeScript (Canvas 2D), vanilla JS frontend.

---

### Task 1: Add `Enter` and `Exit` to Rust `PetState`

**Files:**
- Modify: `src-tauri/src/state.rs:5-13`

**Step 1: Add enum variants**

Modify `PetState` to include `Enter` and `Exit`:

```rust
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
    Enter,
    Exit,
}
```

**Step 2: Build to verify compilation**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS (no errors)

**Step 3: Commit**

```bash
git add src-tauri/src/state.rs
git commit -m "feat(backend): add Enter and Exit to PetState"
```

---

### Task 2: Route `session_start` and `session_end` events in PetManager

**Files:**
- Modify: `src-tauri/src/pet_manager.rs:26-65`

**Step 1: Extend event matching logic**

In `handle_event`, expand the `match event.as_str()` block:

```rust
let new_state = match event.as_str() {
    "work" => PetState::Work,
    "success" => PetState::Success,
    "fail" => PetState::Fail,
    "sleep" => PetState::Sleep,
    "session_start" => PetState::Enter,
    "session_end" => PetState::Exit,
    _ => PetState::Idle,
};
```

**Step 2: Ensure pet creation on `session_start` without existing session_id**

The existing code already creates a pet if the `session_id` is not found in the map. For `session_start` with a `session_id`, this is sufficient. No additional changes needed.

**Step 3: Add timed destruction after `session_end` (`Exit` state)**

After emitting the event, add a new condition for `Exit` that schedules pet destruction:

```rust
if matches!(new_state, PetState::Success | PetState::Fail | PetState::Exit) {
    if let Some(ref sid) = session_id {
        let manager = self.clone();
        let sid = sid.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            manager.destroy_pet(sid);
        });
    }
}
```

Replace the existing `matches!` block at lines 55-64 with the above.

**Step 4: Build to verify compilation**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/pet_manager.rs
git commit -m "feat(backend): route session_start and session_end events"
```

---

### Task 3: Add `enter` and `exit` to TypeScript `PetState`

**Files:**
- Modify: `src/types.ts`

**Step 1: Update the union type**

```typescript
export type PetState = 'idle' | 'walk' | 'work' | 'success' | 'fail' | 'sleep' | 'returning' | 'enter' | 'exit';
```

**Step 2: Commit**

```bash
git add src/types.ts
git commit -m "feat(frontend): add enter and exit to PetState type"
```

---

### Task 4: Create `EnterAction` Canvas Action

**Files:**
- Create: `src/pet/actions/EnterAction.ts`
- Modify: `src/pet/actions/index.ts`

**Step 1: Write `EnterAction.ts`**

```typescript
import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class EnterAction implements Action {
  readonly name = 'enter';
  private timer = 0;
  private readonly DURATION = 40;

  onEnter() {
    this.timer = 0;
  }

  update(pet: Pet) {
    this.timer++;
    if (this.timer >= this.DURATION) {
      pet.transitionTo('idle');
    }
  }

  render(renderer: PetRenderer, pet: Pet) {
    const frame = pet.getFrame();
    const wave = Math.sin(frame * 0.3); // quick wave for excitement
    const offsetY = Math.sin(frame * 0.15) * 1.5 - 1; // little hop
    const style = pet.getStyle();
    const color = style.colors.primary;

    renderer.drawBody(style, color, offsetY);
    renderer.drawFace(style, offsetY, true, 'smile', '#111');

    // Waving leg: alternate left/right leg height
    const leg1 = wave > 0 ? 1 : 0;
    const leg2 = wave > 0 ? 0 : 0;
    for (const p of style.legs.left) {
      renderer.pixel(p.x, p.y + offsetY - leg1, color);
    }
    for (const p of style.legs.right) {
      renderer.pixel(p.x, p.y + offsetY - leg2, color);
    }
  }

  onExit() {}
  shouldExit() { return false; }
}
```

**Step 2: Export from `actions/index.ts`**

Add to `src/pet/actions/index.ts`:

```typescript
export { EnterAction } from './EnterAction';
export { ExitAction } from './ExitAction';
```

(Keep all existing exports.)

**Step 3: Commit**

```bash
git add src/pet/actions/EnterAction.ts src/pet/actions/index.ts
git commit -m "feat(frontend): add EnterAction with hop and wave animation"
```

---

### Task 5: Create `ExitAction` Canvas Action

**Files:**
- Create: `src/pet/actions/ExitAction.ts`
- Modify: `src/pet/actions/index.ts`

**Step 1: Write `ExitAction.ts`**

```typescript
import type { Action } from './types';
import type { Pet } from '../Pet';
import type { PetRenderer } from '../renderer/PetRenderer';

export class ExitAction implements Action {
  readonly name = 'exit';
  private timer = 0;
  private readonly DURATION = 45;

  onEnter() {
    this.timer = 0;
  }

  update(pet: Pet) {
    this.timer++;
    // No auto-transition; backend destroys window after delay
  }

  render(renderer: PetRenderer, pet: Pet) {
    const progress = Math.min(this.timer / this.DURATION, 1);
    const offsetY = progress * 3; // slowly sink down
    const blink = Math.random() < 0.03;
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

**Step 2: Ensure `ExitAction` is exported in `actions/index.ts`**

Already added in Task 4. Verify the file contains:

```typescript
export { ExitAction } from './ExitAction';
```

**Step 3: Commit**

```bash
git add src/pet/actions/ExitAction.ts src/pet/actions/index.ts
git commit -m "feat(frontend): add ExitAction with sinking goodbye animation"
```

---

### Task 6: Register `EnterAction` and `ExitAction` in `Pet.ts`

**Files:**
- Modify: `src/pet/Pet.ts`

**Step 1: Update imports and `ACTIONS` map**

Change the import to include `EnterAction` and `ExitAction`:

```typescript
import { IdleAction, WalkAction, WorkAction, SuccessAction, FailAction, SleepAction, ReturningAction, EnterAction, ExitAction } from './actions';
```

Update `ACTIONS`:

```typescript
const ACTIONS: Record<PetState, new () => Action> = {
  idle: IdleAction,
  walk: WalkAction,
  work: WorkAction,
  success: SuccessAction,
  fail: FailAction,
  sleep: SleepAction,
  returning: ReturningAction,
  enter: EnterAction,
  exit: ExitAction,
};
```

**Step 2: Commit**

```bash
git add src/pet/Pet.ts
git commit -m "feat(frontend): wire EnterAction and ExitAction into Pet state machine"
```

---

### Task 7: Add Window Slide Animations for `enter` and `exit` in Frontend Tick

**Files:**
- Modify: `src/pet/index.ts`

**Step 1: Add constants for slide speed**

Near the top with other constants, add:

```typescript
const SLIDE_SPEED = 10; // physical pixels per frame
```

**Step 2: Extend `updateWalk()` with `enter` handling**

Inside `updateWalk()`, before the `returning` block, add an `enter` block:

```typescript
  if (state === 'enter') {
    const targetY = screenH - physSize - BOTTOM_OFFSET;
    if (winY < targetY) {
      winY += SLIDE_SPEED;
      if (winY > targetY) winY = targetY;
    } else if (winY > targetY) {
      winY -= SLIDE_SPEED;
      if (winY < targetY) winY = targetY;
    }
    win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
    if (winY === targetY) {
      pet.setState('idle');
    }
    return;
  }
```

**Step 3: Extend `updateWalk()` with `exit` handling**

Add an `exit` block after the `success` block (or before `returning`):

```typescript
  if (state === 'exit') {
    const targetY = screenH;
    if (winY < targetY) {
      winY += SLIDE_SPEED;
      if (winY > targetY) winY = targetY;
    }
    win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
    return;
  }
```

**Step 4: Initialize `winY` for new windows to screen bottom**

Currently `winY` is initialized to `0`. For `enter` to visually slide up, the window should start below the screen. However, `winY` is set from `initScreenSize()` via `win.outerPosition()`. Since the Rust backend already positions the window bottom-right in `create_pet`, we need to override `winY` when the state becomes `enter`.

A simple approach: set `winY = screenH` inside the `pet_state_change` listener when the state is `enter`:

Find the listener:

```typescript
listen<{ label: string; state: PetState }>('pet_state_change', (event) => {
  if (event.payload.label === label) {
    pet.setState(event.payload.state);
  }
});
```

Modify it to:

```typescript
listen<{ label: string; state: PetState }>('pet_state_change', (event) => {
  if (event.payload.label === label) {
    if (event.payload.state === 'enter') {
      winY = screenH; // start just below visible area
    }
    pet.setState(event.payload.state);
  }
});
```

**Step 5: Build frontend to verify TypeScript compilation**

Run: `npm run build`
Expected: PASS (no TS errors)

**Step 6: Commit**

```bash
git add src/pet/index.ts
git commit -m "feat(frontend): add window slide animations for enter and exit states"
```

---

### Task 8: Update `test-events.js` to Support `session_start` and `session_end`

**Files:**
- Modify: `test-events.js`

**Step 1: Add new event calls**

Append to the script (or integrate into the existing sequence) calls for:

```javascript
// Session lifecycle test
fetch('http://127.0.0.1:9876/v1/event/session_start', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ session_id: 'test-session' })
});

setTimeout(() => {
  fetch('http://127.0.0.1:9876/v1/event/session_end', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: 'test-session' })
  });
}, 5000);
```

**Step 2: Commit**

```bash
git add test-events.js
git commit -m "chore(tests): add session_start and session_end to test-events.js"
```

---

### Task 9: Manual End-to-End Test

**Files:**
- None (manual verification)

**Step 1: Start the Tauri app**

Run: `npm run tauri dev`
Expected: App launches, default pet appears bottom-right in `idle` state.

**Step 2: Trigger session_start**

In a separate terminal, run: `node test-events.js`
Expected: A new 128×128 pet window slides up from the bottom of the screen, plays a happy hop/wave animation for ~0.7s, then switches to `idle`.

**Step 3: Trigger session_end**

If `test-events.js` does not auto-fire `session_end`, run a quick Node snippet:

```bash
node -e "fetch('http://127.0.0.1:9876/v1/event/session_end', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({session_id:'test-session'}) })"
```

Expected: The test-session pet plays a sinking animation for ~0.75s while sliding down off-screen. After ~2 seconds total, the window closes.

**Step 4: Regression check**

Trigger existing events (`work`, `success`, `fail`, `sleep`) and verify:
- `work` → pet stays in place, work animation plays.
- `success` → pet moves to screen center, stays 2s, then jumps back to bottom.
- `fail` → pet stays in place, sad animation, then back to idle.
- `sleep` → pet stays in place, sleep animation.

**Step 5: Commit**

No code changes if all passes. If fixes are needed, commit them separately.

---

### Task 10: Final Integration Commit (if any fixes applied)

If manual testing required any small fixes, commit them with a descriptive message such as:

```bash
git commit -m "fix(enter-exit): adjust slide speed and timer durations after manual test"
```

Otherwise, skip this task.
