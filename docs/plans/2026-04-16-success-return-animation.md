# Success 状态抛物线返回动画 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 `success` 状态结束后的窗口移动增加抛物线跳跃过渡效果，新增 `returning` 状态替代原来的瞬间回底部。

**Architecture:** 在 `src/main.ts` 中新增 `returning` 状态，修改状态机和主循环逻辑。`success` 持续 2 秒后进入 `returning`，通过物理模拟（水平匀速 + 垂直重力上抛 + 落地反弹）让宠物自然落回屏幕底部，最终切回 `idle`。

**Tech Stack:** TypeScript, Tauri API (`@tauri-apps/api/window`), Canvas 2D

---

### Task 1: 更新类型定义，新增 `returning` 状态

**Files:**
- Modify: `src/main.ts:5`

**Step 1: 修改 PetState 类型定义**

在 `src/main.ts` 第 5 行将 `PetState` 扩展为包含 `returning`：

```ts
type PetState = "idle" | "walk" | "work" | "success" | "fail" | "sleep" | "returning";
```

**Step 2: 验证编译无报错**

运行: `npm run build`
Expected: 构建成功，无类型错误

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(animation): add returning state to PetState type"
```

---

### Task 2: 新增物理运动状态变量

**Files:**
- Modify: `src/main.ts:39-55`

**Step 1: 在全局状态区新增 `returning` 物理变量**

在 `src/main.ts` 第 53 行左右（`const BOTTOM_OFFSET = 50;` 之后）添加：

```ts
let returnVelocityX = 0;
let returnVelocityY = 0;
const RETURN_GRAVITY = 0.6;
const RETURN_JUMP_VELOCITY = -15;
```

**Step 2: 验证编译无报错**

运行: `npm run build`
Expected: 构建成功

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(animation): add physics variables for returning state"
```

---

### Task 3: 修改 `transitionTo` 支持 `returning` 并保护 `fail` 逻辑

**Files:**
- Modify: `src/main.ts:308-334`

**Step 1: 修改 `transitionTo` 函数**

将 `transitionTo` 修改为以下代码：

```ts
function transitionTo(newState: PetState) {
  if (newState === currentState) return;

  if (newState === "success") {
    stateTimer = 0;
    currentState = "success";
    return;
  }

  if (newState === "fail") {
    stateTimer = 0;
    currentState = "fail";
    return;
  }

  if (newState === "work") {
    currentState = "work";
    return;
  }

  if (newState === "idle" || newState === "sleep") {
    currentState = "idle";
    idleTimer = 0;
    return;
  }

  if (newState === "returning") {
    currentState = "returning";
    return;
  }
}
```

**Step 2: 验证编译无报错**

运行: `npm run build`
Expected: 构建成功

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(animation): handle returning state in transitionTo"
```

---

### Task 4: 修改 `tick` 让 `success` 结束后进入 `returning`

**Files:**
- Modify: `src/main.ts:369-387`

**Step 1: 修改 `tick` 函数中的计时器逻辑**

将 `tick` 函数替换为：

```ts
function tick() {
  frame++;

  if (currentState === "success" || currentState === "fail") {
    stateTimer++;
    if (stateTimer > 120) {
      stateTimer = 0;
      if (currentState === "success") {
        // Start parabolic jump back
        const physSize = logicalToPhysical(32 * scale);
        const targetX = MARGIN + Math.random() * (screenW - physSize - MARGIN * 2);
        const distanceX = targetX - winX;
        const framesToTarget = 45 + Math.random() * 15; // 45~60 frames
        returnVelocityX = distanceX / framesToTarget;
        returnVelocityY = RETURN_JUMP_VELOCITY;
        currentState = "returning";
      } else {
        // fail still snaps back instantly for now
        currentState = "idle";
        idleTimer = 0;
        winY = screenH - logicalToPhysical(32 * scale) - BOTTOM_OFFSET;
      }
    }
  }

  updateWalk();
  render();
  requestAnimationFrame(tick);
}
```

**Step 2: 验证编译无报错**

运行: `npm run build`
Expected: 构建成功

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(animation): transition success to returning after 2 seconds"
```

---

### Task 5: 在 `updateWalk` 中实现 `returning` 物理跳跃逻辑

**Files:**
- Modify: `src/main.ts:261-306`

**Step 1: 在 `updateWalk` 中添加 `returning` 分支**

在 `updateWalk` 中 `success` 分支之后、`idle` 分支之前插入以下代码：

```ts
  if (currentState === "returning") {
    winX += returnVelocityX;
    winY += returnVelocityY;
    returnVelocityY += RETURN_GRAVITY;

    const floorY = screenH - physSize - BOTTOM_OFFSET;

    if (winY >= floorY) {
      winY = floorY;
      if (returnVelocityY > 0 && Math.abs(returnVelocityY) > 2) {
        // Small bounce
        returnVelocityY = -returnVelocityY * 0.4;
        returnVelocityX *= 0.8;
      } else {
        // Landed, snap to idle
        winX = Math.round(winX);
        winY = Math.round(winY);
        currentState = "idle";
        idleTimer = 0;
        returnVelocityX = 0;
        returnVelocityY = 0;
      }
    }

    win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
    return;
  }
```

**Step 2: 验证编译无报错**

运行: `npm run build`
Expected: 构建成功

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(animation): implement parabolic physics for returning state"
```

---

### Task 6: 处理边界情况（scale_change 中断 returning）

**Files:**
- Modify: `src/main.ts:346-366`

**Step 1: 在 `scale_change` 事件监听器中中断 returning**

找到 `scale_change` 监听器，在 `applyScale(newScale);` 之后添加：

```ts
  // Interrupt returning animation if scale changes to avoid physics mismatch
  if (currentState === "returning") {
    currentState = "idle";
    idleTimer = 0;
    returnVelocityX = 0;
    returnVelocityY = 0;
  }
```

完整监听器应如下：

```ts
listen<number>("scale_change", async (event) => {
  const oldScale = scale;
  const newScale = event.payload;

  const monitor = await currentMonitor();
  if (monitor) {
    scaleFactor = monitor.scaleFactor;
  }

  const pos = await win.outerPosition();

  applyScale(newScale);

  // Interrupt returning animation if scale changes to avoid physics mismatch
  if (currentState === "returning") {
    currentState = "idle";
    idleTimer = 0;
    returnVelocityX = 0;
    returnVelocityY = 0;
  }

  const oldPhysSize = Math.round(32 * oldScale * scaleFactor);
  const newPhysSize = Math.round(32 * newScale * scaleFactor);

  winX = pos.x;
  winY = pos.y + oldPhysSize - newPhysSize;

  await win.setPosition(new PhysicalPosition(Math.round(winX), Math.round(winY)));
});
```

**Step 2: 验证编译无报错**

运行: `npm run build`
Expected: 构建成功

**Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(animation): interrupt returning on scale change"
```

---

### Task 7: 手动测试返回动画

**Files:**
- Test: `test-events.js`

**Step 1: 启动应用**

运行: `npm run tauri dev`
Expected: 应用启动，宠物出现在屏幕底部边缘

**Step 2: 发送测试事件**

在另一个终端运行:

```bash
node test-events.js
```

或者手动发送:

```bash
curl -X POST http://127.0.0.1:9876/v1/event/success
```

**Step 3: 观察行为并验证**

Expected:
1. 收到 `success` 后，宠物缓动移动到屏幕中心，播放 confetti 动画
2. 约 2 秒后，宠物开始向屏幕底部某个随机位置抛物线跳跃
3. 跳跃过程中有明显的上抛和下落重力感
4. 落地时有一次轻微反弹
5. 反弹停止后稳定在屏幕底部，恢复 `idle` 状态

如果动画感觉太快/太慢，调整 `RETURN_JUMP_VELOCITY`（默认 -15）或 `RETURN_GRAVITY`（默认 0.6）。

**Step 4: Commit（如有微调）**

```bash
git add src/main.ts
git commit -m "feat(animation): adjust returning physics parameters after testing"
```

---

### Task 8: 代码审查与收尾

**Step 1: 运行最终构建**

运行: `npm run build`
Expected: 构建成功，无错误

**Step 2: 检查 diff**

运行: `git diff HEAD~7 --stat`
Expected: 只修改了 `src/main.ts`

**Step 3: 最终 Commit（如需要）**

如有剩余未提交改动：

```bash
git add src/main.ts
git commit -m "feat(animation): complete parabolic return for success state"
```
