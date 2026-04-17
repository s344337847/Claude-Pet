# SessionStart / SessionEnd 事件与入场/退场动作设计

## 背景
Claude Pet 目前通过 HTTP hook 接收 `work`、`success`、`fail`、`sleep` 等事件来驱动宠物状态。为了增强桌面宠物在 Claude Code 会话开始和结束时的表现力，需要新增 `session_start` 和 `session_end` 事件，并配以专门的入场（Enter）和退场（Exit）动画。

## 设计目标
- 会话开始时，宠物从屏幕底部滑入并播放开心的入场动作。
- 会话结束时，宠物播放告别动作并向下滑出屏幕，随后销毁窗口。
- 改动尽量集中在现有架构内，不引入跨语言动画同步的复杂度。

## 架构决策
采用 **方案 B：窗口位移动画 + 画布动画**。理由：
- 窗口滑入/滑出提供了清晰的空间叙事（宠物“出现”和“离开”）。
- 前端 tick  already 负责 `success` 状态和 `returning` 状态的窗口移动，扩展成本低。
- 后端只需在合适时机触发状态，无需直接控制逐帧动画。

## 后端变更

### 1. 新增状态
`src-tauri/src/state.rs` 中的 `PetState` 增加两个变体：
- `Enter`
- `Exit`

### 2. 事件路由
`src-tauri/src/pet_manager.rs` 的 `handle_event` 增加匹配：
- `session_start` → `PetState::Enter`
  - 若该 `session_id` 尚无宠物，调用 `create_pet(session_id)` 创建窗口。
  - 发送 `pet_state_change` 事件，payload.state = `Enter`。
- `session_end` → `PetState::Exit`
  - 查找对应 `session_id` 的宠物，发送 `pet_state_change` 事件，payload.state = `Exit`。
  - 启动定时器（约 1.5s，对应前端动画时长），之后调用 `destroy_pet(session_id)` 关闭窗口。

## 前端状态机

### 1. TypeScript 类型
`src/types.ts` 扩展为：
```ts
export type PetState = 'idle' | 'walk' | 'work' | 'success' | 'fail' | 'sleep' | 'returning' | 'enter' | 'exit';
```

### 2. 新增 Action
- `src/pet/actions/EnterAction.ts`
  - 动画时长约 40 帧（~0.67s @ 60fps）。
  - 渲染：宠物小跳（offsetY 正弦波动）+ 挥手（临时抬起一只脚/手），表情 `smile`。
  - `update` 中计时，结束后自动 `transitionTo('idle')`。
- `src/pet/actions/ExitAction.ts`
  - 动画时长约 45 帧（~0.75s @ 60fps）。
  - 渲染：宠物缓慢下蹲（offsetY 逐渐增大）+ 眨眼，表情 `neutral` 或 `smile`。
  - `update` 中计时，结束后保持在 `exit` 状态，等待后端关闭窗口。

### 3. 窗口位移动画（`src/pet/index.ts`）
在 `updateWalk()`（或等价的 tick 处理函数）中增加：
- **`enter` 状态**：
  - 目标 Y = `screenH - physSize - BOTTOM_OFFSET`（底部停靠位）。
  - 起始 Y = `screenH`（刚好在屏幕底部外）。
  - 每帧以固定速度或缓动公式向目标移动，到达后自动 `pet.setState('idle')`。
- **`exit` 状态**：
  - 目标 Y = `screenH`（滑出屏幕底部外）。
  - 每帧以固定速度向下移动，到达后停止更新位置。

### 4. `Pet.ts` 注册
`ACTIONS` 映射表增加：
```ts
const ACTIONS: Record<PetState, new () => Action> = {
  // ... existing
  enter: EnterAction,
  exit: ExitAction,
};
```

## 动画参数
| 参数 | 值 | 说明 |
|------|-----|------|
| Enter 动画时长 | 40 帧 | 约 0.67s |
| Exit 动画时长 | 45 帧 | 约 0.75s |
| 窗口滑入/滑出速度 | 8~12 px/帧 | 根据屏幕高度动态感觉良好 |
| Enter 初始位置 | `screenH` | 窗口顶部刚好贴屏幕底边 |
| Enter 目标位置 | `screenH - physSize - BOTTOM_OFFSET` | 与 idle 停靠位一致 |

## 错误处理
- 若收到 `session_end` 但对应 `session_id` 的宠物已不存在，`pet_manager` 静默忽略。
- 若 `EnterAction` 因窗口位置计算失败未能滑入，到达目标 Y 后仍会切到 `idle`，保证不卡死。

## 测试方式
1. 运行 `node test-events.js`（需扩展脚本支持 `session_start` / `session_end`）。
2. 或临时修改 `settings.json` 的 hook，在 Claude Code 会话启停时观察宠物行为。
