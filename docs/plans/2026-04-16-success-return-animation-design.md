# Success 状态跳跃返回动画设计

## 问题
当前 `success` 状态结束后，窗口的 `winY` 会瞬间重置到屏幕底部，视觉上非常突兀。需要增加一个抛物线跳跃过渡效果，让宠物从屏幕中心自然落回底部。

## 状态机改动

新增 `returning` 状态：

```
success ──(2秒后)──► returning ──(落地后)──► idle
```

- `success` 不再在 2 秒后切回 `idle`，而是进入 `returning` 状态开始物理跳跃。
- 落地并稳定后切回 `idle`。
- `work`、`fail` 保持原逻辑不变（`fail` 仍然直接回 `idle`）。

## 物理参数

当 `success` → `returning` 时，从当前屏幕中心位置给窗口一个初始速度：

- **水平方向**：朝屏幕底部一个随机 X 位置飞去
  - 目标 X 范围：`[MARGIN, screenW - physSize - MARGIN]`
  - 根据水平距离计算固定水平速度，保证在 45~60 帧内到达
- **垂直方向**：向上的初速度（约 -15 像素/帧）
- **重力**：每帧垂直速度 `+0.6`

每帧更新：
```ts
winX += velocityX;
winY += velocityY;
velocityY += gravity;
```

## 落地与反弹

- 当 `winY >= screenH - physSize - BOTTOM_OFFSET` 时视为落地。
- 第一次落地后执行小反弹：
  - `velocityY = -velocityY * 0.4`
  - `velocityX *= 0.8`
- 第二次落地后，若弹跳速度绝对值 `< 1`，直接吸附到底部并切回 `idle`。

## 边界情况

- **屏幕缩放/窗口大小变化**：如果在 `returning` 过程中用户调整了宠物尺寸，直接中断跳跃、重置 `winY` 到底部并切回 `idle`，避免物理状态和新窗口尺寸错位。
- **快速连续 success 事件**：如果 `returning` 过程中又收到 `success`，直接重新进入 `success` 状态，重置回中心缓动。
- **底部吸附精度**：弹跳速度绝对值 `< 1` 时直接吸附到底部并切 `idle`，避免无限微幅抖动。

## 改动文件

- `src/main.ts`：新增 `returning` 状态、修改 `tick()` 和 `updateWalk()`、增加物理速度状态变量。
