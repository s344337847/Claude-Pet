# Resize / Position Fix Design

## Problem Statement

1. **改变大小后，位置重置** — `save_config` 每次保存配置都会调用 `position_window_bottom_right()`，导致窗口被强制拽回右下角。
2. **改变大小后，移动渲染位置不正确** — 前端 `winX`/`winY` 只在启动时初始化一次，`scale_change` 后未同步窗口最新位置，导致边界计算和实际渲染错位。

## Success Criteria

- 调整大小时，宠物不会瞬移回右下角。
- 大小变化以窗口底部为锚点，水平位置保持不变。
- 行走、成功、失败等动画的边界计算与实际窗口位置完全同步。

## Design

### Rust Backend (`src-tauri/src/lib.rs`)

在 `save_config` 中，保存配置后执行以下步骤：

1. 读取窗口当前的 `outer_size`（旧物理高度）。
2. 调用 `set_size` 设置新的逻辑尺寸。
3. 读取当前 `outer_position`。
4. 计算新位置：
   - `new_x = current_x`（保持不变）
   - `new_y = current_y + old_height - new_height`（底部对齐）
5. 调用 `set_position` 应用新位置。
6. 移除原有的 `position_window_bottom_right` 调用。

启动时的初始化逻辑保持不变，仍使用 `position_window_bottom_right` 将窗口定位到初始右下角位置。

### Frontend (`src/main.ts`)

在监听 `scale_change` 事件时：

1. 执行现有的 `applyScale(event.payload)` 调整 Canvas 大小。
2. 异步调用 `win.outerPosition()` 同步最新的 `winX` 和 `winY`，确保后续动画逻辑使用正确的坐标。

### Error Handling

- 若读取当前位置或尺寸失败（窗口被隐藏/销毁），静默跳过位置调整，不 panic。
- `initScreenSize` 与 `scale_change` 均使用 `outerPosition()`，保证单位一致。

## Expected Behavior

- 用户调整宠物大小时，窗口在原地以底部为锚点缩放。
- 成功后跳回的位置、行走边界等计算与实际窗口位置一致。
