# main.ts 重构设计文档

## 目标

将现有的单宠物、硬编码绘制架构，重构为可扩展的多宠物桌面宠物系统，支持：

1. **新增动作**：通过独立的 Action 类快速添加新状态（如 eating、dancing）。
2. **宠物样式**：通过配置化的 `StyleConfig` 切换皮肤（猫、狗、机器人等），保留代码绘制像素的方式。
3. **多个宠物**：支持按 `task_id` 动态创建/销毁独立的宠物窗口，每个窗口独立运动、独立渲染。

## 架构总览

```
Claude Code hook (POST /v1/event/:event)
       ↓
Rust PetManager ──按 task_id 路由──→ PetInstance (若干)
       ↓                                    ↓
发射 tauri 事件 (pet_state_change:{label})  每个实例一个窗口
       ↓                                    ↓
前端 PetRuntime 监听事件              每个窗口加载 pet/index.ts
       ↓                                    ↓
创建/销毁 Pet 对象                    Pet 对象驱动自己的画布+窗口
```

- **前端**：`main.ts` 升级为 `PetRuntime`，负责监听全局事件并管理 `Pet` 生命周期。每个宠物窗口加载独立的 `pet/index.ts`，内部初始化一个 `Pet` 实例，驱动自己的画布和窗口运动。
- **后端**：新增 `PetManager`，维护 `task_id → pet_window_id` 映射，负责动态创建和销毁 Tauri 窗口，并始终保留一个 `default_pet`。

## 前端设计

### PetRuntime（src/main.ts）

`PetRuntime` 是宠物系统的总入口，职责：

1. 监听 `pet_state_change:{label}` 事件。
2. 如果收到未知宠物的状态事件，调用 Rust 命令 `create_pet_window(label, style)` 创建新窗口。
3. 如果收到销毁指令（如 `destroy_pet` 事件），关闭对应窗口。
4. 始终确保 `default_pet` 窗口存在。

> 注：为了简化，也可以让 `PetRuntime` 直接内嵌在默认宠物的窗口里运行，或者作为一个隐藏的后台窗口运行。最终采用后台窗口（可选隐藏）方案，以统一接收事件。

### Pet 类（src/pet/Pet.ts）

`Pet` 是每个窗口内的核心对象，职责：

- 持有自己的 `canvas` 和 `ctx`。
- 持有 `StateMachine`，当前 `Action` 实例。
- 持有 `StyleConfig`（外观配置）。
- 在 `tick()` 中：
  1. 调用 `currentAction.update()` 更新状态和窗口位置。
  2. 调用 `PetRenderer.render(ctx, currentAction, style)` 绘制当前帧。
- 提供 `setState(newState)` 方法，负责 Action 切换（调用旧 Action 的 `onExit()` 和新 Action 的 `onEnter()`）。

### Action 系统（src/pet/actions/*.ts）

每个状态对应一个 `Action` 类，实现统一接口：

```ts
interface Action {
  name: string;
  onEnter(pet: Pet): void;
  update(pet: Pet): void;
  render(renderer: PetRenderer, pet: Pet): void;
  onExit(pet: Pet): void;
  shouldExit(pet: Pet): boolean; // 返回 true 时 Pet 自动切回 idle 或下一个状态
}
```

已有的 Action：

- `IdleAction`：呼吸动画，随机触发眨眼，定时切到 Walk。
- `WalkAction`：左右边缘走动，随机切回 Idle。
- `WorkAction`：敲击键盘动画，头顶代码气泡。
- `SuccessAction`：跳跃到屏幕中央，播放 confetti，结束后切到 `ReturningAction`。
- `FailAction`：流汗、皱眉，结束后切回 Idle。
- `SleepAction`：闭眼呼吸，Zzz 飘起。
- `ReturningAction`：抛物线返回底部边缘，落地后切回 Idle。

新增动作只需新建一个 Action 文件并在 `ActionRegistry` 中注册即可。

### 渲染器（src/pet/renderer/PetRenderer.ts）

`PetRenderer` 是统一的绘制器，职责：

- 接收 `CanvasRenderingContext2D`、`StyleConfig`、当前 `Action`。
- 根据 `StyleConfig` 中的形状定义绘制像素。
- 提供基础绘制原语：`pixel()`、`rect()`。

`StyleConfig` 示例结构：

```ts
interface StyleConfig {
  name: string;
  colors: {
    primary: string;
    work: string;
    success: string;
    fail: string;
    sleep: string;
  };
  body: {
    head: { x: number; y: number; w: number; h: number };
    ears: Array<{ x: number; y: number }>;
    bodyRect: { x: number; y: number; w: number; h: number };
    tail: Array<{ x: number; y: number }>;
  };
  face: {
    eyeLeft: { x: number; y: number; w: number; h: number };
    eyeRight: { x: number; y: number; w: number; h: number };
    mouth: {
      smile: Array<{ x: number; y: number }>;
      neutral: Array<{ x: number; y: number }>;
      frown: Array<{ x: number; y: number }>;
    };
  };
  legs: {
    left: Array<{ x: number; y: number }>;
    right: Array<{ x: number; y: number }>;
  };
}
```

`default.ts` 提供默认猫咪样式，和当前硬编码的像素布局完全一致。

## 后端设计

### PetManager（src-tauri/src/pet_manager.rs）

`PetManager` 是 Rust 侧新增的核心模块，职责：

- 维护 `pets: HashMap<String, PetInstance>`，key 为 `window_label`。
- 维护 `task_bindings: HashMap<String, String>`，key 为 `task_id`，value 为 `window_label`。
- 提供 `handle_event(event: String, task_id: Option<String>)`：
  1. 如果有 `task_id`，查找或创建对应宠物窗口，将事件转发给它。
  2. 如果没有 `task_id`，转发给 `default_pet`。
- 提供 `create_pet(task_id: Option<String>) -> String`：
  1. 生成唯一 `window_label`（如 `pet_work_1` 或 `default_pet`）。
  2. 调用 Tauri API 创建新窗口（128×128，透明，无边框，置顶）。
  3. 将窗口初始位置设为屏幕底部边缘随机位置。
  4. 发射 `pet_state_change:{label}` 事件，通知前端初始化。
- 提供 `destroy_pet(label: String)`：
  1. 关闭对应 Tauri 窗口。
  2. 清理 `pets` 和 `task_bindings`。
  3. 如果销毁后没有活跃任务宠物，确保 `default_pet` 存在。

### 状态精简（src-tauri/src/state.rs）

`state.rs` 不再负责状态管理逻辑，只保留：

- `PetState` 枚举定义。
- `StatePayload` 结构体（用于向前端发射事件）。

### Server（src-tauri/src/server.rs）

`server.rs` 的 `handle_event` 修改为：

1. 解析请求路径或 JSON body 中的 `event` 和可选的 `task_id`。
2. 调用 `pet_manager.handle_event(event, task_id)`。

HTTP API 格式示例：

```
POST /v1/event/:event
Body (optional JSON): { "task_id": "abc-123" }
```

## 多窗口行为规则

1. **动态创建**：收到新的 `task_id` 的 `work` 事件时，如果该任务没有绑定宠物，则创建一个新窗口。
2. **延迟销毁**：任务变为 `success` 或 `fail` 后，延迟 2 秒再销毁对应宠物窗口，保留视觉反馈。
3. **默认宠物**：始终保留一个 `default_pet` 窗口。没有任务时，它在屏幕底部 idle/walk。
4. **事件隔离**：每个宠物窗口只监听以自己 `label` 为后缀的事件（如 `pet_state_change:pet_work_1`）。

## 文件结构

```
src/
  main.ts              → PetRuntime（事件总线、窗口生命周期管理）
  pet/
    index.ts           → 宠物窗口入口，初始化 Pet 实例
    Pet.ts             → Pet 类（状态机、样式、窗口运动）
    actions/
      IdleAction.ts
      WalkAction.ts
      WorkAction.ts
      SuccessAction.ts
      FailAction.ts
      SleepAction.ts
      ReturningAction.ts
      index.ts         → ActionRegistry
    renderer/
      PetRenderer.ts
    styles/
      default.ts
      types.ts
  types.ts             → 全局类型（PetState、Config 等）

src-tauri/src/
  lib.rs
  server.rs
  pet_manager.rs       → 新增
  state.rs             → 精简
```

## 迁移策略

1. **先拆分前端**：把 `main.ts` 中的绘制逻辑和动画逻辑迁移到 `Pet` + `Action` + `Renderer`，但暂时保持单窗口运行，验证行为一致。
2. **再重构后端**：引入 `PetManager`，但先只维护一个 `default_pet`，确认事件通路正常。
3. **最后启用多窗口**：让后端支持动态创建/销毁窗口，前端 `PetRuntime` 响应多窗口事件。

## 决策记录

- **不采用 ECS**：对于 128×128 像素、每帧几十个 rect 的场景，ECS 的收益无法抵消其带来的复杂度和可读性成本。
- **保留代码绘制像素**：不引入图片 sprite，而是通过 `StyleConfig` 参数化像素坐标，保持项目轻量、无需资源管理。
- **按 task_id 路由**：Claude Code hook 中传入 `task_id`，后端精确将事件派发给负责该任务的宠物，最符合"任务宠物"的语义。
