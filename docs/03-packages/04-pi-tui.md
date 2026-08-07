# @earendil-works/pi-tui 包详解

> 第 3 层：局部深入（第四篇）。按 **局部 → 提升到全局 → 再看局部 → 细节** 的节奏组织。

## 0. 局部：这个包是什么

**pi-tui = 终端 UI 库（仪表盘）**。定位原文："Terminal User Interface library with differential rendering for efficient text-based applications"。它只提供**组件与渲染能力**，本身不包含任何业务逻辑。

解决的问题：**在终端里画出好看、流畅、不闪屏的界面**。它是一套"终端世界的 React"——声明组件、声明布局、渲染器负责把差异最小化地画到屏幕上。

## 1. 提升到全局：它在整条链路中的位置

在全局链路中，pi-tui 只在**交互模式**这一条路径里被用到：

```
coding-agent
   ├─ 交互模式 → 【pi-tui】渲染：输入框、消息列表、工具执行面板、选择器
   ├─ 打印模式 → 不涉及（纯文本）
   └─ RPC 模式 → 不涉及（JSONL）
```

**上下游关系**（全局视角）：

| 方向 | 谁 | 关系 |
|---|---|---|
| 上游 | coding-agent 的 `interactive-mode.ts` | **装配者**：创建 `ProcessTerminal` + `TuiAltScreen`/`TuiMainScreen`，编写 30+ 交互组件 |
| 依赖 | 无内部包依赖 | 极轻量（仅 `get-east-asian-width`、`marked`） |

**关键边界契约**：pi-tui **不做 UI 决策**——用哪个组件、长什么样，全是 coding-agent 说了算；pi-tui 只回答"怎么渲染、怎么处理按键"。扩展 API 也允许扩展直接用 tui 组件，所以它其实是一个"可被插件化使用的 UI 框架"。

带着这个视角，回到包内部。

## 2. 渲染模型

### 差分渲染

`TuiMainScreen`（`src/TuiMainScreen.ts`）有三种更新策略：

1. **首次渲染**：直接输出全部行。
2. **全量重绘**：终端宽度变化或视口上方内容变化时，清屏后重绘。
3. **常规更新**：把光标移到首个变化行 → 清到行尾 → 只渲染发生变化的行。

### 同步输出（无闪烁）

每次更新包裹在 CSI 2026 同步序列（`\x1b[?2026h` … `\x1b[?2026l`）中，实现原子、无闪烁的终端刷新。

### 双渲染器

| 渲染器 | 用途 |
|---|---|
| `TuiAltScreen` | 备用缓冲区渲染固定高度视口，应用自主滚动（`setLayoutRoot()` + `VStack/HStack/ScrollView`），支持鼠标滚轮/拖选 |
| `TuiMainScreen` | 主缓冲区渲染，保留终端回滚历史 |

`isViewportTUI()` 用于区分。coding-agent 默认用 `TuiAltScreen`（`--no-alt-screen` 时用 `TuiMainScreen`）。

## 3. 组件模型

```ts
interface Component {
  render(width: number): string[];        // 每行不得超宽
  handleInput?(data: Uint8Array): void;   // 原始输入
  invalidate(): void;                     // 标记需重绘
}
```

- `Focusable` 接口（IME 支持）：通过零宽 APC 序列 `CURSOR_MARKER` 定位硬件光标。
- 浮层（Overlay）系统：`src/tui.ts` 中的 `TUI` 接口、`Container`、`CURSOR_MARKER`。

## 4. 内置组件（`src/components/*`）

| 组件 | 说明 |
|---|---|
| `text` / `truncated-text` | 文本与截断文本 |
| `input` | 单行输入 |
| `editor` | 多行编辑器（自动补全、粘贴折叠标记） |
| `markdown` | Markdown 渲染 |
| `loader` / `cancellable-loader` | 加载指示 |
| `select-list` / `settings-list` | 选择列表（可搜索） |
| `spacer` / `box` / `stack`/`h-stack`/`v-stack` / `scroll-view` | 布局 |
| `image` | 终端内联图片（Kitty/iTerm2） |

## 5. 输入与按键

- `Terminal.start(onInput, onResize)`（`src/terminal.ts`）提供原始输入流；`ProcessTerminal` 处理 stdin/stdout、Kitty 键盘协议协商、Apple Terminal Shift+Enter 兼容。
- `src/keys.ts`：`matchesKey(data, Key.ctrl("c"))` 按键检测，支持 Kitty 键盘协议。
- `src/keybindings.ts`：可配置快捷键系统（`TUI_KEYBINDINGS`、`setKeybindings`）。
- `src/autocomplete.ts`：`CombinedAutocompleteProvider`（斜杠命令 + 文件路径补全）。
- 支持括号粘贴模式、IME、鼠标滚轮/拖选（备用屏）。

## 6. 其他能力

- `src/terminal-image.ts`：Kitty/iTerm2 内联图片。
- `src/terminal-colors.ts`：OSC 11 背景色探测。
- `src/undo-stack.ts` / `src/kill-ring.ts` / `src/stdin-buffer.ts`：编辑器辅助。
- `src/utils.ts`：`visibleWidth` / `truncateToWidth` / `wrapTextWithAnsi`。
- `src/fuzzy.ts`：模糊匹配（列表搜索）。

## 7. coding-agent 如何使用它

- **UI 装配点**：`packages/coding-agent/src/modes/interactive/interactive-mode.ts` 创建 `ProcessTerminal` + `TuiAltScreen`/`TuiMainScreen`。
- **CLI 辅助界面**：`src/cli/startup-ui.ts`、`config-selector.ts`、`session-picker.ts`、`list-models.ts`。
- **交互组件**：`src/modes/interactive/components/*`（header、messages、editor、footer、tool-execution、tree-selector 等 30+ 组件）全部基于 pi-tui 构建。
- 扩展 API 允许扩展直接用 tui 组件。

## 8. 关键文件

| 文件 | 职责 |
|---|---|
| `src/tui.ts` | 核心：TUI 接口、Component、Container、Overlay、CURSOR_MARKER |
| `src/TuiMainScreen.ts` | 主屏渲染器（差分渲染 + 同步输出） |
| `src/TuiAltScreen.ts` | 备用屏渲染器（视口滚动） |
| `src/terminal.ts` | Terminal 接口 + ProcessTerminal |
| `src/keys.ts` / `src/keybindings.ts` | 按键系统 |
| `src/components/*` | 内置组件 |
| `src/terminal-image.ts` | 内联图片 |
| `src/autocomplete.ts` | 自动补全 |

> 权威细节：`packages/tui/README.md`（含渲染策略细节）、`packages/tui/CHANGELOG.md`。下一篇：[其他包](05-other-packages.md)。
