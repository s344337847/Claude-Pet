# 添加狗狗宠物样式 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use @superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 新增一种「狗狗」像素艺术宠物样式，并在后端使用均衡随机算法在创建窗口时分配样式。

**Architecture:** 扩展现有 `StyleConfig` 类型增加 `tongue` 等可选字段；新增 `dog.ts` 样式配置；`PetRenderer` 增加舌头绘制和基于尾巴长度的摇摆幅度；Rust 后端 `PetManager` 维护内存中的创建计数器，用「最少优先+并列随机」算法决定样式名，通过 `pet_style_init` Tauri event 告知前端。

**Tech Stack:** TypeScript, Canvas 2D, Rust, Tauri v2, Vitest

---

### Task 1: 扩展 StyleConfig 类型支持舌头

**Files:**
- Modify: `src/pet/styles/types.ts`

**Step 1: 添加可选字段**

在 `StyleConfig` 的 `face` 内增加 `tongue?: PixelPoint[]`。

```ts
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
    tongue?: PixelPoint[];
  };
  legs: {
    left: PixelPoint[];
    right: PixelPoint[];
  };
}
```

**Step 2: Commit**

```bash
git add src/pet/styles/types.ts
git commit -m "feat(styles): add optional tongue field to StyleConfig"
```

---

### Task 2: 创建狗狗样式配置

**Files:**
- Create: `src/pet/styles/dog.ts`
- Modify: `src/pet/styles/index.ts`

**Step 1: 编写 dog.ts**

```ts
import type { StyleConfig } from './types';

export const dogStyle: StyleConfig = {
  name: 'dog',
  colors: {
    primary: '#d4a574',
    work: '#ffaa44',
    success: '#6b8cff',
    fail: '#889999',
    sleep: '#d4a574',
  },
  body: {
    head: { x: 9, y: 6, w: 14, h: 10 },
    ears: [
      { x: 8, y: 6 }, { x: 8, y: 7 }, { x: 8, y: 8 },
      { x: 23, y: 6 }, { x: 23, y: 7 }, { x: 23, y: 8 },
    ],
    bodyRect: { x: 10, y: 16, w: 12, h: 9 },
    tail: [
      { x: 22, y: 17 },
      { x: 23, y: 16 },
      { x: 24, y: 15 },
      { x: 25, y: 14 },
    ],
  },
  face: {
    eyeLeft: { x: 11, y: 10, w: 2, h: 1 },
    eyeRight: { x: 19, y: 10, w: 2, h: 1 },
    mouth: {
      smile: [{ x: 14, y: 13 }, { x: 15, y: 13 }, { x: 16, y: 13 }, { x: 17, y: 13 }, { x: 13, y: 12 }, { x: 18, y: 12 }],
      neutral: [{ x: 14, y: 13 }, { x: 15, y: 13 }, { x: 16, y: 13 }, { x: 17, y: 13 }],
      frown: [{ x: 14, y: 12 }, { x: 15, y: 12 }, { x: 16, y: 12 }, { x: 17, y: 12 }, { x: 13, y: 13 }, { x: 18, y: 13 }],
    },
    tongue: [{ x: 15, y: 14 }, { x: 16, y: 14 }],
  },
  legs: {
    left: [{ x: 10, y: 25 }, { x: 11, y: 25 }],
    right: [{ x: 20, y: 25 }, { x: 21, y: 25 }],
  },
};
```

**Step 2: 修改 index.ts 导出 STYLES**

```ts
export * from './types';
export { defaultStyle } from './default';
export { dogStyle } from './dog';

export const STYLES = [defaultStyle, dogStyle];
```

**Step 3: Commit**

```bash
git add src/pet/styles/dog.ts src/pet/styles/index.ts
git commit -m "feat(styles): add dog pixel art style"
```

---

### Task 3: PetRenderer 支持舌头与动态摇尾

**Files:**
- Modify: `src/pet/renderer/PetRenderer.ts`
- Modify: `src/pet/__tests__/renderer.test.ts`

**Step 1: 修改 PetRenderer.ts**

在 `drawFace` 方法末尾（`mouth` 绘制之后）添加舌头绘制：

```ts
drawFace(style: StyleConfig, offsetY: number, eyeOpen: boolean, mouth: 'smile' | 'neutral' | 'frown', eyeColorHex: string) {
  const eyeColor = eyeOpen ? eyeColorHex : '#88a';
  if (eyeOpen) {
    this.rect({ ...style.face.eyeLeft, y: style.face.eyeLeft.y + offsetY }, eyeColor);
    this.rect({ ...style.face.eyeRight, y: style.face.eyeRight.y + offsetY }, eyeColor);
  } else {
    this.rect({ ...style.face.eyeLeft, y: style.face.eyeLeft.y + offsetY + 1 }, eyeColor);
    this.rect({ ...style.face.eyeRight, y: style.face.eyeRight.y + offsetY + 1 }, eyeColor);
  }
  this.points(style.face.mouth[mouth], '#334', offsetY);
  if (mouth === 'smile' && style.face.tongue) {
    this.points(style.face.tongue, '#e67a7a', offsetY);
  }
}
```

修改 `drawBody` 中尾巴的摇摆逻辑，基于 `tail.length` 决定幅度：

```ts
drawBody(style: StyleConfig, color: string, offsetY: number, frameNum: number) {
  this.rect({ ...style.body.head, y: style.body.head.y + offsetY }, color);
  this.points(style.body.ears, color, offsetY);
  this.rect({ ...style.body.bodyRect, y: style.body.bodyRect.y + offsetY }, color);

  const isLongTail = style.body.tail.length >= 4;
  const tailOffset = isLongTail
    ? Math.floor(Math.sin(frameNum * 0.2) * 2)
    : (frameNum % 20 < 10 ? 0 : 1);
  for (const p of style.body.tail) {
    this.pixel(p.x + tailOffset, p.y + offsetY, color);
  }
}
```

同时更新 `drawBody` 的调用签名，在 actions 中传入 `frameNum`。

等一下——当前 `drawBody` 的签名是 `(style, color, offsetY)`，而调用方在 action 里。需要所有 action 的 `render` 方法更新调用。

更简洁的做法：保持 `drawBody` 不接收 `frameNum`，而是在 `PetRenderer` 内部保存一个 `frameNum`，或者由 action 直接调用新增的 `drawTail` 方法。

**建议修改：** 将 `drawBody` 拆成两部分，`drawBody` 不画尾巴，新增 `drawTail(style, color, offsetY, frameNum)`，由各个 action 在 `render` 时调用。

但由于这会改动大量 action 文件，**更简单的做法是**：在 `PetRenderer` 中增加 `setFrame(frame: number)` 方法，由 `Pet.tick()` 在 `action.render` 前调用。这样 `drawBody` 可以直接内部读取 `this.frame`。

```ts
export class PetRenderer {
  private frame = 0;
  // ... constructor ...
  setFrame(f: number) { this.frame = f; }
  // ...
  drawBody(style: StyleConfig, color: string, offsetY: number) {
    this.rect({ ...style.body.head, y: style.body.head.y + offsetY }, color);
    this.points(style.body.ears, color, offsetY);
    this.rect({ ...style.body.bodyRect, y: style.body.bodyRect.y + offsetY }, color);

    const isLongTail = style.body.tail.length >= 4;
    const tailOffset = isLongTail
      ? Math.round(Math.sin(this.frame * 0.3) * 2)
      : (this.frame % 20 < 10 ? 0 : 1);
    for (const p of style.body.tail) {
      this.pixel(p.x + tailOffset, p.y + offsetY, color);
    }
  }
}
```

然后在 `Pet.tick()` 中加入 `this.renderer.setFrame(this.frame);`。

**Step 2: 更新 Pet.ts**

```ts
  tick() {
    this.frame++;
    this.renderer.setFrame(this.frame);
    this.action.update(this);
    this.renderer.clear();
    this.action.render(this.renderer, this);
  }
```

**Step 3: 更新测试**

在 `src/pet/__tests__/renderer.test.ts` 中添加：

```ts
  it('draws dog body without throwing', () => {
    const dog = { ...defaultStyle, name: 'dog', body: { ...defaultStyle.body, tail: [{ x: 22, y: 17 }, { x: 23, y: 16 }, { x: 24, y: 15 }, { x: 25, y: 14 }] } };
    expect(() => renderer.drawBody(dog, '#d4a574', 0)).not.toThrow();
  });

  it('draws tongue on smile without throwing', () => {
    const dog = { ...defaultStyle, name: 'dog', face: { ...defaultStyle.face, tongue: [{ x: 15, y: 14 }] } };
    expect(() => renderer.drawFace(dog, 0, true, 'smile', '#111')).not.toThrow();
  });
```

**Step 4: 运行测试**

```bash
npx vitest run src/pet/__tests__/renderer.test.ts
```

Expected: all pass.

**Step 5: Commit**

```bash
git add src/pet/renderer/PetRenderer.ts src/pet/Pet.ts src/pet/__tests__/renderer.test.ts
git commit -m "feat(renderer): add tongue drawing and dynamic tail wag"
```

---

### Task 4: Pet 支持运行时切换样式

**Files:**
- Modify: `src/pet/Pet.ts`

**Step 1: 添加 setStyle 方法**

```ts
  setStyle(style: StyleConfig) {
    this.style = style;
  }
```

**Step 2: 运行 pet 测试**

```bash
npx vitest run src/pet/__tests__/pet.test.ts
```

Expected: pass.

**Step 3: Commit**

```bash
git add src/pet/Pet.ts
git commit -m "feat(pet): add setStyle method for runtime style switching"
```

---

### Task 5: 前端监听 pet_style_init 并切换样式

**Files:**
- Modify: `src/pet/index.ts`

**Step 1: 导入 STYLES**

把 `import { defaultStyle } from './styles';` 改成：

```ts
import { defaultStyle, STYLES } from './styles';
```

**Step 2: 添加 pet_style_init 监听器**

在 `listen<{ label: string; state: PetState }>('pet_state_change', ...)` 附近添加：

```ts
listen<{ label: string; style_name: string }>('pet_style_init', (event) => {
  if (event.payload.label === label) {
    const style = STYLES.find((s) => s.name === event.payload.style_name) || defaultStyle;
    pet.setStyle(style);
  }
});
```

**Step 3: Commit**

```bash
git add src/pet/index.ts
git commit -m "feat(frontend): listen to pet_style_init and switch style"
```

---

### Task 6: Rust 后端均衡随机算法

**Files:**
- Modify: `src-tauri/src/pet_manager.rs`

**Step 1: 修改 PetManager 结构**

添加样式计数器和可用样式列表：

```rust
const STYLE_NAMES: &[&str] = &["default-cat", "dog"];

pub struct PetManager {
    pets: Mutex<HashMap<String, PetInstance>>,
    style_counts: Mutex<HashMap<String, u32>>,
    app_handle: tauri::AppHandle,
}
```

**Step 2: 修改 new()**

```rust
    pub fn new(app_handle: tauri::AppHandle) -> Arc<Self> {
        let manager = Arc::new(Self {
            pets: Mutex::new(HashMap::new()),
            style_counts: Mutex::new(HashMap::new()),
            app_handle: app_handle.clone(),
        });
        manager.create_pet(None);
        manager
    }
```

**Step 3: 添加选择样式的私有方法**

```rust
    fn pick_style(&self) -> String {
        let mut counts = self.style_counts.lock().unwrap();
        let mut min_count = u32::MAX;
        let mut candidates = Vec::new();
        for name in STYLE_NAMES {
            let count = counts.get(*name).copied().unwrap_or(0);
            if count < min_count {
                min_count = count;
                candidates.clear();
                candidates.push(*name);
            } else if count == min_count {
                candidates.push(*name);
            }
        }
        let picked = candidates[rand::random::<usize>() % candidates.len()].to_string();
        *counts.entry(picked.clone()).or_insert(0) += 1;
        picked
    }
```

注意：这使用了 `rand` crate 的 `random` 函数。Tauri v2 可能已经依赖了 `rand`，如果没有，需要添加到 `Cargo.toml`。

检查 `Cargo.toml` 是否已有 `rand`。如果没有，需要在 Task 6 中先添加依赖再写代码。我们先假设可能需要添加。实际上 `rand` 是 Rust 生态常用库，可以通过 `fastrand`（更轻量）或检查已有依赖。

让我查看 `Cargo.toml`。

```bash
cat src-tauri/Cargo.toml
```

等一下，计划文档里不应该包含「让我查看」这类内容。应该直接给出明确的指令。我可以检查现有依赖后写入计划，或者在计划中包含一个条件步骤。

查看现有的 `Cargo.toml`：

```toml
[package]
name = "claude-pet"
version = "0.1.0"
description = "A Tauri App"
authors = ["you"]
edition = "2021"

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-opener = "2"
tauri-plugin-store = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
axum = "0.7"
tower-http = { version = "0.5", features = ["cors"] }
lru = "0.12"
```

没有 `rand`。计划应该添加 `fastrand = "2"` 到 `Cargo.toml`（更轻量，无需初始化）。或者使用 `std` 的随机能力（没有）。

**使用 `fastrand`：** `fastrand::usize(..)`。

修改步骤：

**Step 1: 添加依赖**

在 `src-tauri/Cargo.toml` `[dependencies]` 下添加：

```toml
fastrand = "2"
```

**Step 2: 修改 pet_manager.rs**

顶部添加 `use fastrand;`

然后把 pick_style 改成：

```rust
    fn pick_style(&self) -> String {
        let mut counts = self.style_counts.lock().unwrap();
        let mut min_count = u32::MAX;
        let mut candidates = Vec::new();
        for name in STYLE_NAMES {
            let count = counts.get(*name).copied().unwrap_or(0);
            if count < min_count {
                min_count = count;
                candidates.clear();
                candidates.push(*name);
            } else if count == min_count {
                candidates.push(*name);
            }
        }
        let picked = candidates[fastrand::usize(..candidates.len())].to_string();
        *counts.entry(picked.clone()).or_insert(0) += 1;
        picked
    }
```

**Step 3: 修改 create_pet 发射 event**

```rust
    pub fn create_pet(self: &Arc<Self>, session_id: Option<String>) -> String {
        let label = session_id.clone().unwrap_or_else(|| "default_pet".to_string());
        let style_name = self.pick_style();
        {
            let mut pets = self.pets.lock().unwrap();
            if pets.contains_key(&label) {
                return label;
            }
            pets.insert(
                label.clone(),
                PetInstance {
                    label: label.clone(),
                    session_id,
                },
            );
        }

        let app_handle = self.app_handle.clone();
        let window_label = label.clone();
        let style_for_event = style_name.clone();
        tauri::async_runtime::spawn(async move {
            if let Ok(window) = tauri::WebviewWindowBuilder::new(
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
            .shadow(false)
            .build()
            {
                let _ = window.set_ignore_cursor_events(true);
                crate::position_window_bottom_right(&window, 128);
                let _ = app_handle.emit("pet_style_init", serde_json::json!({
                    "label": window_label,
                    "style_name": style_for_event,
                }));
            }
        });

        label
    }
```

**Step 4: 编译验证**

```bash
cd src-tauri && cargo check
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/src/pet_manager.rs
git commit -m "feat(backend): add balanced random style selection and pet_style_init event"
```

---

### Task 7: 端到端手动测试

**Step 1: 启动应用**

```bash
npm run tauri dev
```

**Step 2: 多次触发 session_start**

在另一个终端运行：

```bash
node test-events.js
```

或者手动 curl：

```bash
curl -X POST http://127.0.0.1:9876/v1/event/session_start -H "Content-Type: application/json" -d '{"session_id":"s1"}'
curl -X POST http://127.0.0.1:9876/v1/event/session_end -H "Content-Type: application/json" -d '{"session_id":"s1"}'
curl -X POST http://127.0.0.1:9876/v1/event/session_start -H "Content-Type: application/json" -d '{"session_id":"s2"}'
```

Expected: 新弹出的宠物窗口中，猫咪和狗狗样式大致均衡出现（因为计数器机制，前两个窗口必定一个是猫一个是狗）。

**Step 3: Commit（仅当需要记录测试脚本时，否则无需提交）**

---

### Task 8: 最终验证与清理

**Step 1: 运行前端测试**

```bash
npx vitest run
```

Expected: all pass.

**Step 2: Rust 编译检查**

```bash
cd src-tauri && cargo check
```

Expected: clean.

**Step 3: 提交最终整合（如果有未提交的修改）**

