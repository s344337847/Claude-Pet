# 添加狗狗宠物样式设计文档

## 目标

在 Claude Pet 中新增一种「狗狗」像素艺术宠物样式，并在创建宠物窗口时通过均衡随机算法分配样式，避免总是出现同一种宠物。

## 方案概述

采用**方案 B：扩展 StyleConfig + 渲染器增强**。在现有配置驱动渲染系统上增加狗狗特有的视觉元素，同时不重构整个架构。

## 前端样式系统

### 1. 新增 `src/pet/styles/dog.ts`

定义狗狗的像素布局：
- **下垂耳朵**：覆盖头顶两侧的两个像素块
- **稍长身体**：身体矩形比猫咪略长
- **长尾巴**：四格长度的尾巴点阵
- **舌头**：伸出嘴外的两个像素点（仅在微笑时绘制）

### 2. 扩展 `StyleConfig` 类型 (`src/pet/styles/types.ts`)

新增可选字段：
- `tongue?: PixelPoint[]` — 舌头像素点坐标
- `tail?: PixelPoint[]` 已有，利用其长度控制摇尾幅度

### 3. 渲染器增强 (`src/pet/renderer/PetRenderer.ts`)

- 新增 `drawTongue(style, offsetY)` 方法
- 在 `mouth === 'smile'` 时调用 `drawTongue()`
- `drawBody()` 中尾巴摇摆幅度根据 `style.body.tail.length` 动态调整：
  - 猫咪（短尾）：小幅摆动
  - 狗狗（长尾）：较大幅度左右摇摆

## 后端样式分配

### 均衡随机算法

Rust 后端在内存中维护一个轻量计数器 `HashMap<String, u32>`，记录每种样式被创建的窗口数量。

创建新窗口时：
1. 找出当前计数最少的样式（或样式们）
2. 如果只有一个最少，直接选择它
3. 如果多个并列最少，从中随机选一个
4. 选中样式的计数 +1

该计数器**不持久化**，应用重启后归零，但在运行期间保证均衡。

### 集成点

- `src-tauri/src/pet_manager.rs` 的 `create_pet()` 中：
  1. 调用均衡算法决定样式名（如 `"default-cat"` 或 `"dog"`）
  2. 创建窗口后通过 Tauri event `pet_style_init` 将样式名发送给前端
- 前端 `index.ts` 监听 `pet_style_init`，从注册表 `STYLES` 中找到对应配置并初始化 `Pet`

## 样式注册表

前端 `src/pet/styles/index.ts` 导出：

```ts
export const STYLES: StyleConfig[] = [defaultStyle, dogStyle];
```

这样后端只需要知道样式名字列表（硬编码或前端启动时传给后端即可），无需感知像素数据。

## 数据流

```
用户触发/HTTP 创建窗口 → pet_manager::create_pet()
                               ↓
                        均衡算法选择样式名
                               ↓
                        创建窗口并 emit "pet_style_init"
                               ↓
                        前端监听 event → 查找 STYLES → new Pet(style, ...)
```

## 错误处理

- 如果前端收到的样式名在 `STYLES` 中不存在，回退到 `defaultStyle`
- 如果 `dogStyle` 的 `tongue` 字段缺失，渲染器安全跳过

## 测试验证

- 手动多次触发 `session_start` 事件，观察两种宠物大致均衡出现
- 确认狗狗样式的所有状态（idle/walk/work/success/fail/sleep）视觉正确
