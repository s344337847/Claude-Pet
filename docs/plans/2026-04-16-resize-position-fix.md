# Resize / Position Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix two bugs: (1) changing pet size resets window position to bottom-right, and (2) after resize, walking/success animations use stale coordinates causing visual misalignment.

**Architecture:** Adjust `save_config` in Rust to preserve current X and bottom-align Y when resizing. Update the frontend `scale_change` listener to re-sync `winX`/`winY` from the actual window position after scale changes.

**Tech Stack:** Tauri v2, Rust, TypeScript, Canvas 2D

---

### Task 1: Rust — remove forced reposition in `save_config`

**Files:**
- Modify: `src-tauri/src/lib.rs:36-49`

**Step 1: Inspect current `save_config` implementation**

Read lines 36-49 of `src-tauri/src/lib.rs`. Note that `position_window_bottom_right(&main, size)` is called unconditionally after `set_size`.

**Step 2: Replace the reposition logic with bottom-alignment logic**

Replace the body of `save_config` (lines 41-48) with:

```rust
    if let Some(main) = app.get_webview_window("main") {
        let old_size = main.outer_size().unwrap_or(tauri::Size::Physical(tauri::PhysicalSize::new(128, 128)));
        let old_height = match old_size {
            tauri::Size::Physical(s) => s.height as i32,
            tauri::Size::Logical(s) => (s.height * main.scale_factor().unwrap_or(1.0)) as i32,
        };

        let size = (32.0 * config.scale as f64) as u32;
        let _ = main.set_size(tauri::Size::Logical(tauri::LogicalSize::new(size as f64, size as f64)));

        let new_size = main.outer_size().unwrap_or(tauri::Size::Physical(tauri::PhysicalSize::new(size, size)));
        let new_height = match new_size {
            tauri::Size::Physical(s) => s.height as i32,
            tauri::Size::Logical(s) => (s.height * main.scale_factor().unwrap_or(1.0)) as i32,
        };

        if let Ok(tauri::Position::Physical(pos)) = main.outer_position() {
            let new_x = pos.x;
            let new_y = pos.y + old_height - new_height;
            let _ = main.set_position(tauri::Position::Physical(tauri::PhysicalPosition::new(new_x, new_y)));
        }

        let _ = main.emit("scale_change", config.scale);
        let _ = main.emit("colors_change", config.colors);
    }
```

**Step 3: Verify compilation**

Run: `cd src-tauri && cargo check`
Expected: no errors

**Step 4: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "fix(rust): preserve window position and bottom-align on resize

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Frontend — sync window position after scale change

**Files:**
- Modify: `src/main.ts:344-346`

**Step 1: Inspect current `scale_change` listener**

Read lines 344-346 of `src/main.ts`. Currently it only calls `applyScale(event.payload)`.

**Step 2: Add position re-sync after scale change**

Replace lines 344-346 with:

```typescript
listen<number>("scale_change", async (event) => {
  applyScale(event.payload);
  const pos = await win.outerPosition();
  winX = pos.x;
  winY = pos.y;
});
```

**Step 3: Verify TypeScript compiles**

Run: `npm run build`
Expected: build succeeds without TypeScript errors

**Step 4: Commit**

```bash
git add src/main.ts
git commit -m "fix(frontend): sync winX/winY after scale change

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: End-to-end manual test

**Files:**
- Run: `npm run tauri dev`

**Step 1: Start the app**

Run: `npm run tauri dev`
Wait for the pet window to appear in the bottom-right corner.

**Step 2: Open settings and change size**

Click the tray icon → Settings.
Change scale from 4× to 6× (or click Large), then Save.

**Expected:**
- The pet window should NOT jump back to the bottom-right corner.
- It should grow from the bottom edge, keeping the same X coordinate.

**Step 3: Trigger a success animation**

In a separate terminal, run:
```bash
node test-events.js
```
(or send a POST to `http://127.0.0.1:9876/v1/event` with a `"completed"` status to trigger success.)

**Expected:**
- The pet jumps to the center of the screen (based on its current position, not an old cached position).
- After ~2 seconds it returns to the bottom edge at the correct X coordinate.

**Step 4: Verify walking boundaries**

Wait for the pet to enter walk state and reach a screen edge.

**Expected:**
- The pet turns around exactly at the screen margin, with no gap or overflow caused by stale size/position data.

**Step 5: Commit test notes (optional)**

If any issue is found, fix it before this commit. If all pass:

```bash
git commit --allow-empty -m "test: manual e2e passed for resize/position fix

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Update design doc status (optional)

If desired, append a line to `docs/plans/2026-04-16-resize-position-fix-design.md`:

```markdown
## Status

Implemented on 2026-04-16.
```

No additional commit required for documentation updates.
