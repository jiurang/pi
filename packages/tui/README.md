# @earendil-works/pi-tui

Minimal terminal UI framework with differential rendering and synchronized output for flicker-free interactive CLI applications.
极简的终端 UI（TUI）框架，采用差分渲染（differential rendering）与同步输出（synchronized output），用于构建无闪烁的交互式命令行应用。

## Features 特性

- **Interchangeable Renderers**: Shared `TUI` interface with main-screen and alternate-screen implementations
  - **可互换的渲染器（Renderers）**：统一的 `TUI` 接口，提供主屏（main-screen）与备用屏（alternate-screen）两种实现
- **Differential Rendering**: Updates only changed lines or viewport rows
  - **差分渲染**：仅更新发生变化的行或视口（viewport）中的行
- **Application-owned Scrolling**: Alternate-screen viewport supports mouse, trackpad, and keyboard navigation
  - **应用自主滚动**：备用屏视口支持鼠标、触控板和键盘导航
- **Synchronized Output**: Uses CSI 2026 for atomic screen updates (no flicker)
  - **同步输出**：使用 CSI 2026 实现原子性的屏幕更新（无闪烁）
- **Bracketed Paste Mode**: Handles large pastes correctly with markers for >10 line pastes
  - **括号粘贴模式（Bracketed Paste Mode）**：正确处理大段粘贴，超过 10 行的粘贴内容会以标记（marker）形式呈现
- **Component-based**: Simple Component interface with render() method
  - **基于组件（Component）**：简洁的 Component 接口，只需实现 render() 方法
- **Theme Support**: Components accept theme interfaces for customizable styling
  - **主题支持**：组件接受主题（theme）接口，样式可自由定制
- **Built-in Components**: Text, TruncatedText, Input, Editor, Markdown, Loader, SelectList, SettingsList, Spacer, Image, Box, Container, VStack, HStack, ScrollView
  - **内置组件**：Text、TruncatedText、Input、Editor、Markdown、Loader、SelectList、SettingsList、Spacer、Image、Box、Container、VStack、HStack、ScrollView
- **Inline Images**: Renders images in terminals that support Kitty or iTerm2 graphics protocols
  - **内联图片**：在支持 Kitty 或 iTerm2 图形协议的终端中直接渲染图片
- **Autocomplete Support**: File paths and slash commands
  - **自动补全支持**：支持文件路径与斜杠命令（slash commands）

## Quick Start 快速开始

```typescript
import { type TUI, Text, Editor, ProcessTerminal, TuiMainScreen, matchesKey } from "@earendil-works/pi-tui";

// Create terminal
const terminal = new ProcessTerminal();

// Create the default main-screen renderer through the shared TUI interface
const tui: TUI = new TuiMainScreen(terminal);

// Add components
tui.addChild(new Text("Welcome to my app!"));

import { defaultEditorTheme as editorTheme } from './test/test-themes.ts';
const editor = new Editor(tui, editorTheme);
editor.onSubmit = (text) => {
  console.log("Submitted:", text);
  tui.addChild(new Text(`You said: ${text}`));
};
tui.addChild(editor);

// Focus the editor so it receives keyboard input
tui.setFocus(editor);

// In raw mode Ctrl+C doesn't send SIGINT — intercept it here to allow exit
tui.addInputListener((data) => {
  if (matchesKey(data, 'ctrl+c')) {
    tui.stop();
    process.exit(0);
  }
});

// Start
tui.start();
```

## Core API 核心 API

### TUI interface and renderers TUI 接口与渲染器

`TUI` is the shared interface for component management, focus, overlays, input, lifecycle, terminal queries, and rendering. Choose a concrete renderer only when constructing the application:
`TUI` 是统一的接口，负责组件管理、焦点、浮层（overlays）、输入、生命周期、终端查询以及渲染。只需在构建应用时选择一个具体的渲染器实现：

- `TuiMainScreen` renders into the main terminal buffer and preserves terminal scrollback.
  - `TuiMainScreen` 渲染到终端主缓冲区，并保留终端的回滚历史（scrollback）。
- `TuiAltScreen` renders a fixed-height viewport in the alternate terminal buffer with application-owned scrolling. When stopped, it restores the main buffer and prints the complete final document.
  - `TuiAltScreen` 在终端备用缓冲区中渲染一个固定高度的视口，并由应用自主控制滚动。停止时会恢复主缓冲区，并输出完整的最终文档。

```typescript
import { type TUI, TuiAltScreen, TuiMainScreen } from "@earendil-works/pi-tui";

const tui: TUI = new TuiMainScreen(terminal);
// To use an application-owned viewport in the alternate terminal buffer instead:
// const tui: TUI = new TuiAltScreen(terminal);

tui.addChild(component);
tui.removeChild(component);
tui.start();
tui.stop();
tui.requestRender(); // Request a re-render

// Global debug key handler (Shift+Ctrl+D)
tui.onDebug = () => console.log("Debug triggered");
```

### Alternate-screen viewport layouts 备用屏视口布局

`TuiAltScreen` can render an explicit terminal-height layout. `VStack` and `HStack` allocate constrained regions, while `ScrollView` owns scrolling for one region. These semantics are intentionally unavailable on `TuiMainScreen`, where the terminal owns scrollback.
`TuiAltScreen` 可以渲染一个明确按终端高度组织的布局。`VStack` 与 `HStack` 负责分配受约束的区域，而 `ScrollView` 则负责某一区域内的滚动。这些语义在 `TuiMainScreen` 上有意不予提供，因为在主屏模式下回滚历史由终端自身掌控。

```typescript
import {
  Container,
  isViewportTUI,
  ScrollView,
  Text,
  VStack,
} from "@earendil-works/pi-tui";

const transcript = new Container();
transcript.addChild(new Text("History"));

const editorAndFooter = new VStack([
  editor,
  new Text("status"),
]);

if (isViewportTUI(tui)) {
  tui.setLayoutRoot(new VStack([
    {
      component: new ScrollView(transcript, {
        follow: "end",
        primary: true,
        overscroll: "chain",
      }),
      basis: 0,
      grow: 1,
      minSize: 1,
    },
    {
      component: editorAndFooter,
      basis: "auto",
      shrink: 1,
      minSize: 1,
    },
  ]));
}
```

Stack entries support `basis`, `grow`, `shrink`, `minSize`, `maxSize`, and responsive `visible` callbacks. Mouse-wheel input targets the scroll view under the pointer and unused delta chains to outer scroll views by default. The primary scroll view receives the alternate-screen keyboard navigation actions and wheel input over non-scrollable regions.
栈（Stack）条目支持 `basis`、`grow`、`shrink`、`minSize`、`maxSize` 以及响应式的 `visible` 回调。鼠标滚轮输入会作用于指针所在的滚动视图，未消耗的滚动增量默认会向外层滚动视图链式传递。主滚动视图（primary scroll view）会接收备用屏的键盘导航操作，以及发生在不可滚动区域上的滚轮输入。

Layout geometry is rebuilt for each requested frame. Stateful components are retained, and their existing rendered-line caches remain effective. Calling `render(width)` directly on these layout components produces an unbounded document, which is also used when alt mode restores the main screen.
布局几何信息会在每次请求的帧中重新构建。有状态的组件会被保留，其已有的渲染行缓存依然有效。直接对这些布局组件调用 `render(width)` 会生成一份不受高度限制的完整文档，该文档同样用于备用屏模式恢复主屏时的输出。

### Overlays 浮层

Overlays render components on top of existing content without replacing it. Useful for dialogs, menus, and modal UI.
浮层（Overlay）将组件渲染在已有内容之上，而不会替换原有内容。适用于对话框、菜单和模态 UI。

```typescript
// Show overlay with default options (centered, max 80 cols)
const handle = tui.showOverlay(component);

// Show overlay with custom positioning and sizing
// Values can be numbers (absolute) or percentage strings (e.g., "50%")
const handle = tui.showOverlay(component, {
  // Sizing
  width: 60,              // Fixed width in columns
  width: "80%",           // Width as percentage of terminal
  minWidth: 40,           // Minimum width floor
  maxHeight: 20,          // Maximum height in rows
  maxHeight: "50%",       // Maximum height as percentage of terminal

  // Anchor-based positioning (default: 'center')
  anchor: 'bottom-right', // Position relative to anchor point
  offsetX: 2,             // Horizontal offset from anchor
  offsetY: -1,            // Vertical offset from anchor

  // Percentage-based positioning (alternative to anchor)
  row: "25%",             // Vertical position (0%=top, 100%=bottom)
  col: "50%",             // Horizontal position (0%=left, 100%=right)

  // Absolute positioning (overrides anchor/percent)
  row: 5,                 // Exact row position
  col: 10,                // Exact column position

  // Margin from terminal edges
  margin: 2,              // All sides
  margin: { top: 1, right: 2, bottom: 1, left: 2 },

  // Responsive visibility
  visible: (termWidth, termHeight) => termWidth >= 100  // Hide on narrow terminals

  // Focus behavior
  nonCapturing: true       // Don't auto-focus when shown
});

// OverlayHandle methods
handle.hide();              // Permanently remove the overlay
handle.setHidden(true);     // Temporarily hide (can show again)
handle.setHidden(false);    // Show again after hiding
handle.isHidden();          // Check if temporarily hidden
handle.focus();             // Focus and bring to visual front
handle.unfocus();           // Release focus to normal fallback
handle.unfocus({ target: baseComponent }); // Release this overlay to a specific component
handle.unfocus({ target: null });   // Release this overlay and leave focus empty
handle.isFocused();         // Check if overlay has focus

handle.unfocus();
// Overlay loses focus; TUI falls back to another visible capturing overlay or the previous focus target.

handle.unfocus({ target: null });
// Overlay loses focus; no component receives input until focus is set again.

// A focused visible overlay reclaims keyboard input after temporary replacement UI
// releases focus. If you want a specific component to receive input while overlays remain
// visible, call handle.unfocus({ target: component }).

// Hide topmost overlay
tui.hideOverlay();

// Check if any visible overlay is active
tui.hasOverlay();
```

**Anchor values**: `'center'`, `'top-left'`, `'top-right'`, `'bottom-left'`, `'bottom-right'`, `'top-center'`, `'bottom-center'`, `'left-center'`, `'right-center'`
**锚点（Anchor）取值**：`'center'`、`'top-left'`、`'top-right'`、`'bottom-left'`、`'bottom-right'`、`'top-center'`、`'bottom-center'`、`'left-center'`、`'right-center'`

**Resolution order**:
**解析顺序**：
1. `minWidth` is applied as a floor after width calculation
   1. 宽度计算完成后，将 `minWidth` 作为下限应用
2. For position: absolute `row`/`col` > percentage `row`/`col` > `anchor`
   2. 位置优先级：绝对值 `row`/`col` > 百分比 `row`/`col` > `anchor`
3. `margin` clamps final position to stay within terminal bounds
   3. `margin` 会对最终位置进行钳制，确保浮层不超出终端边界
4. `visible` callback controls whether overlay renders (called each frame)
   4. `visible` 回调决定浮层是否渲染（每帧都会调用）

### Component Interface 组件接口

All components implement:
所有组件都需实现：

```typescript
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  invalidate?(): void;
}
```

| Method<br>方法 | Description<br>说明 |
|--------|-------------|
| `render(width)` | Returns an array of strings, one per line. Each line **must not exceed `width`** or the TUI will error. Use `truncateToWidth()` or manual wrapping to ensure this.<br>返回一个字符串数组，每个元素对应一行。每一行**都不得超过 `width`**，否则 TUI 会报错。可使用 `truncateToWidth()` 或手动换行来确保这一点。 |
| `handleInput?(data)` | Called when the component has focus and receives keyboard input. The `data` string contains raw terminal input (may include ANSI escape sequences).<br>当组件获得焦点并接收到键盘输入时调用。`data` 字符串包含原始终端输入（可能含有 ANSI 转义序列）。 |
| `invalidate?()` | Called to clear any cached render state. Components should re-render from scratch on the next `render()` call.<br>用于清除组件缓存的渲染状态。组件应在下一次 `render()` 调用时完全重新渲染。 |

The TUI appends a full SGR reset and OSC 8 reset at the end of each rendered line. Styles do not carry across lines. If you emit multi-line text with styling, reapply styles per line or use `wrapTextWithAnsi()` so styles are preserved for each wrapped line.
TUI 会在每一行渲染结果末尾追加完整的 SGR 重置与 OSC 8 重置，因此样式不会跨行延续。如果你输出带样式的多行文本，需要为每一行重新应用样式，或使用 `wrapTextWithAnsi()`，以便每个换行后的行都能保留样式。

### Focusable Interface (IME Support) Focusable 接口（输入法/IME 支持）

Components that display a text cursor and need IME (Input Method Editor) support should implement the `Focusable` interface:
需要显示文本光标并支持输入法（IME，Input Method Editor）的组件应实现 `Focusable` 接口：

```typescript
import { CURSOR_MARKER, type Component, type Focusable } from "@earendil-works/pi-tui";

class MyInput implements Component, Focusable {
  focused: boolean = false;  // Set by TUI when focus changes
  
  render(width: number): string[] {
    const marker = this.focused ? CURSOR_MARKER : "";
    // Emit marker right before the fake cursor
    return [`> ${beforeCursor}${marker}\x1b[7m${atCursor}\x1b[27m${afterCursor}`];
  }
}
```

When a `Focusable` component has focus, TUI:
当某个 `Focusable` 组件获得焦点时，TUI 会：
1. Sets `focused = true` on the component
   1. 将该组件的 `focused` 设为 `true`
2. Scans rendered output for `CURSOR_MARKER` (a zero-width APC escape sequence)
   2. 在渲染输出中扫描 `CURSOR_MARKER`（一个零宽度的 APC 转义序列）
3. Positions the hardware terminal cursor at that location
   3. 将终端的硬件光标定位到该位置
4. Shows the hardware cursor only when `showHardwareCursor` is enabled
   4. 仅在启用 `showHardwareCursor` 时显示硬件光标

The cursor remains hidden by default. This keeps the fake cursor rendering, while still positioning the hardware cursor for terminals that track IME candidate windows with hidden cursors. Some terminals require a visible hardware cursor for IME positioning; enable it with the renderer constructor's `showHardwareCursor` argument, `setShowHardwareCursor(true)`, or `PI_HARDWARE_CURSOR=1`. The `Editor` and `Input` built-in components already implement this interface.
光标默认保持隐藏。这样既保留了模拟光标（fake cursor）的渲染效果，又能为那些在光标隐藏时仍会跟踪输入法候选窗口的终端正确定位硬件光标。部分终端要求硬件光标可见才能正确定位输入法候选框；可通过渲染器构造函数的 `showHardwareCursor` 参数、`setShowHardwareCursor(true)` 或环境变量 `PI_HARDWARE_CURSOR=1` 来启用。内置组件 `Editor` 与 `Input` 已实现该接口。

**Container components with embedded inputs:** When a container component (dialog, selector, etc.) contains an `Input` or `Editor` child, the container must implement `Focusable` and propagate the focus state to the child:
**内嵌输入控件的容器组件：** 当某个容器组件（对话框、选择器等）包含 `Input` 或 `Editor` 子组件时，该容器必须实现 `Focusable` 并将焦点状态向下传递给子组件：

```typescript
import { Container, type Focusable, Input } from "@earendil-works/pi-tui";

class SearchDialog extends Container implements Focusable {
  private searchInput: Input;

  // Propagate focus to child input for IME cursor positioning
  private _focused = false;
  get focused(): boolean { return this._focused; }
  set focused(value: boolean) {
    this._focused = value;
    this.searchInput.focused = value;
  }

  constructor() {
    super();
    this.searchInput = new Input();
    this.addChild(this.searchInput);
  }
}
```

Without this propagation, typing with an IME (Chinese, Japanese, Korean, etc.) will show the candidate window in the wrong position.
如果不做这种传递，使用输入法（中文、日文、韩文等）输入时，候选窗口会出现在错误的位置。

## Built-in Components 内置组件

### Container 容器

Groups child components.
用于组合（分组）子组件。

```typescript
const container = new Container();
container.addChild(component);
container.removeChild(component);
```

### Box 盒子容器

Container that applies padding and background color to all children.
一种容器，会对其所有子组件统一应用内边距（padding）和背景色。

```typescript
const box = new Box(
  1,                              // paddingX (default: 1)
  1,                              // paddingY (default: 1)
  (text) => chalk.bgGray(text)   // optional background function
);
box.addChild(new Text("Content"));
box.setBgFn((text) => chalk.bgBlue(text));  // Change background dynamically
```

### Text 文本

Displays multi-line text with word wrapping and padding.
显示多行文本，支持按单词自动换行和内边距。

```typescript
const text = new Text(
  "Hello World",                  // text content
  1,                              // paddingX (default: 1)
  1,                              // paddingY (default: 1)
  (text) => chalk.bgGray(text)   // optional background function
);
text.setText("Updated text");
text.setCustomBgFn((text) => chalk.bgBlue(text));
```

### TruncatedText 截断文本

Single-line text that truncates to fit viewport width. Useful for status lines and headers.
单行文本，会自动截断以适应视口宽度。适用于状态栏和标题行。

```typescript
const truncated = new TruncatedText(
  "This is a very long line that will be truncated...",
  0,  // paddingX (default: 0)
  0   // paddingY (default: 0)
);
```

### Input 单行输入框

Single-line text input with horizontal scrolling.
单行文本输入框，支持水平滚动。

```typescript
const input = new Input();
input.onSubmit = (value) => console.log(value);
input.setValue("initial");
input.getValue();
```

**Key Bindings:**
**快捷键：**
- `Enter` - Submit
  - `Enter` - 提交
- `Ctrl+A` / `Ctrl+E` - Line start/end
  - `Ctrl+A` / `Ctrl+E` - 移动到行首 / 行尾
- `Ctrl+W` or `Alt+Backspace` - Delete word backwards
  - `Ctrl+W` 或 `Alt+Backspace` - 向前删除一个单词
- `Ctrl+U` - Delete to start of line
  - `Ctrl+U` - 删除到行首
- `Ctrl+K` - Delete to end of line
  - `Ctrl+K` - 删除到行尾
- `Ctrl+Left` / `Ctrl+Right` - Word navigation
  - `Ctrl+Left` / `Ctrl+Right` - 按单词移动光标
- `Alt+Left` / `Alt+Right` - Word navigation
  - `Alt+Left` / `Alt+Right` - 按单词移动光标
- Arrow keys, Backspace, Delete work as expected
  - 方向键、Backspace、Delete 行为符合常规预期

### Editor 编辑器

Multi-line text editor with autocomplete, file completion, paste handling, and vertical scrolling when content exceeds terminal height.
多行文本编辑器，支持自动补全、文件路径补全、粘贴处理，并在内容超出终端高度时支持垂直滚动。

```typescript
interface EditorTheme {
  borderColor: (str: string) => string;
  selectList: SelectListTheme;
}

interface EditorOptions {
  paddingX?: number;  // Horizontal padding (default: 0)
}

const editor = new Editor(tui, theme, options?);  // tui is required for height-aware scrolling
editor.onSubmit = (text) => console.log(text);
editor.onChange = (text) => console.log("Changed:", text);
editor.disableSubmit = true; // Disable submit temporarily
editor.setAutocompleteProvider(provider);
editor.borderColor = (s) => chalk.blue(s); // Change border dynamically
editor.setPaddingX(1); // Update horizontal padding dynamically
editor.getPaddingX();  // Get current padding
```

**Features:**
**特性：**
- Multi-line editing with word wrap
  - 多行编辑，支持按单词自动换行
- Slash command autocomplete (type `/`)
  - 斜杠命令自动补全（输入 `/` 触发）
- File path autocomplete (press `Tab`)
  - 文件路径自动补全（按 `Tab` 触发）
- Large paste handling (>10 lines creates `[paste #1 +50 lines]` marker)
  - 大段粘贴处理（超过 10 行时会生成 `[paste #1 +50 lines]` 形式的标记）
- Horizontal lines above/below editor
  - 编辑器上下方的水平分隔线
- Fake cursor rendering (hidden real cursor)
  - 模拟光标渲染（真实光标隐藏）

**Key Bindings:**
**快捷键：**
- `Enter` - Submit
  - `Enter` - 提交
- `Shift+Enter`, `Ctrl+Enter`, or `Alt+Enter` - New line (terminal-dependent, Alt+Enter most reliable)
  - `Shift+Enter`、`Ctrl+Enter` 或 `Alt+Enter` - 换行（取决于终端支持，Alt+Enter 最为可靠）
- `Tab` - Autocomplete
  - `Tab` - 自动补全
- `Ctrl+K` - Delete to end of line
  - `Ctrl+K` - 删除到行尾
- `Ctrl+U` - Delete to start of line
  - `Ctrl+U` - 删除到行首
- `Ctrl+W` or `Alt+Backspace` - Delete word backwards
  - `Ctrl+W` 或 `Alt+Backspace` - 向前删除一个单词
- `Alt+D` or `Alt+Delete` - Delete word forwards
  - `Alt+D` 或 `Alt+Delete` - 向后删除一个单词
- `Ctrl+A` / `Ctrl+E` - Line start/end
  - `Ctrl+A` / `Ctrl+E` - 移动到行首 / 行尾
- `Ctrl+]` - Jump forward to character (awaits next keypress, then moves cursor to first occurrence)
  - `Ctrl+]` - 向后跳转到指定字符（等待下一次按键，然后将光标移动到该字符首次出现处）
- `Ctrl+Alt+]` - Jump backward to character
  - `Ctrl+Alt+]` - 向前跳转到指定字符
- Arrow keys, Backspace, Delete work as expected
  - 方向键、Backspace、Delete 行为符合常规预期

### Markdown 富文本渲染

Renders markdown with syntax highlighting and theming support.
渲染 markdown 内容，支持语法高亮与主题定制。

```typescript
interface MarkdownTheme {
  heading: (text: string) => string;
  link: (text: string) => string;
  linkUrl: (text: string) => string;
  code: (text: string) => string;
  codeBlock: (text: string) => string;
  codeBlockBorder: (text: string) => string;
  quote: (text: string) => string;
  quoteBorder: (text: string) => string;
  hr: (text: string) => string;
  listBullet: (text: string) => string;
  bold: (text: string) => string;
  italic: (text: string) => string;
  strikethrough: (text: string) => string;
  underline: (text: string) => string;
  highlightCode?: (code: string, lang?: string) => string[];
}

interface DefaultTextStyle {
  color?: (text: string) => string;
  bgColor?: (text: string) => string;
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
}

const md = new Markdown(
  "# Hello\n\nSome **bold** text",
  1,              // paddingX
  1,              // paddingY
  theme,          // MarkdownTheme
  defaultStyle    // optional DefaultTextStyle
);
md.setText("Updated markdown");
```

**Features:**
**特性：**
- Headings, bold, italic, code blocks, lists, links, blockquotes
  - 支持标题、粗体、斜体、代码块、列表、链接、引用块
- HTML tags rendered as plain text
  - HTML 标签按纯文本渲染
- Optional syntax highlighting via `highlightCode`
  - 可通过 `highlightCode` 选配语法高亮
- Padding support
  - 支持内边距
- Render caching for performance
  - 渲染结果缓存以提升性能

### Loader 加载指示器

Animated loading spinner.
带动画的加载旋转指示器（spinner）。

```typescript
const loader = new Loader(
  tui,                              // TUI instance for render updates
  (s) => chalk.cyan(s),            // spinner color function
  (s) => chalk.gray(s),            // message color function
  "Loading..."                      // message (default: "Loading...")
);
loader.start();
loader.setMessage("Still loading...");
loader.stop();
```

### CancellableLoader 可取消的加载指示器

Extends Loader with Escape key handling and an AbortSignal for cancelling async operations.
在 Loader 基础上扩展，增加 Escape 按键处理和一个用于取消异步操作的 AbortSignal。

```typescript
const loader = new CancellableLoader(
  tui,                              // TUI instance for render updates
  (s) => chalk.cyan(s),            // spinner color function
  (s) => chalk.gray(s),            // message color function
  "Working..."                      // message
);
loader.onAbort = () => done(null); // Called when user presses Escape
doAsyncWork(loader.signal).then(done);
```

**Properties:**
**属性：**
- `signal: AbortSignal` - Aborted when user presses Escape
  - `signal: AbortSignal` - 用户按下 Escape 时被中止
- `aborted: boolean` - Whether the loader was aborted
  - `aborted: boolean` - 该加载指示器是否已被中止
- `onAbort?: () => void` - Callback when user presses Escape
  - `onAbort?: () => void` - 用户按下 Escape 时触发的回调

### SelectList 选择列表

Interactive selection list with keyboard navigation.
交互式选择列表，支持键盘导航。

```typescript
interface SelectItem {
  value: string;
  label: string;
  description?: string;
}

interface SelectListTheme {
  selectedPrefix: (text: string) => string;
  selectedText: (text: string) => string;
  description: (text: string) => string;
  scrollInfo: (text: string) => string;
  noMatch: (text: string) => string;
}

const list = new SelectList(
  [
    { value: "opt1", label: "Option 1", description: "First option" },
    { value: "opt2", label: "Option 2", description: "Second option" },
  ],
  5,      // maxVisible
  theme   // SelectListTheme
);

list.onSelect = (item) => console.log("Selected:", item);
list.onCancel = () => console.log("Cancelled");
list.onSelectionChange = (item) => console.log("Highlighted:", item);
list.setFilter("opt"); // Filter items
```

**Controls:**
**操作方式：**
- Arrow keys: Navigate
  - 方向键：移动选择项
- Enter: Select
  - Enter：确认选择
- Escape: Cancel
  - Escape：取消

### SettingsList 设置列表

Settings panel with value cycling and submenus.
设置面板，支持在多个取值间循环切换以及打开子菜单。

```typescript
interface SettingItem {
  id: string;
  label: string;
  description?: string;
  currentValue: string;
  values?: string[];  // If provided, Enter/Space cycles through these
  submenu?: (currentValue: string, done: (selectedValue?: string) => void) => Component;
}

interface SettingsListTheme {
  label: (text: string, selected: boolean) => string;
  value: (text: string, selected: boolean) => string;
  description: (text: string) => string;
  cursor: string;
  hint: (text: string) => string;
}

const settings = new SettingsList(
  [
    { id: "theme", label: "Theme", currentValue: "dark", values: ["dark", "light"] },
    { id: "model", label: "Model", currentValue: "gpt-4", submenu: (val, done) => modelSelector },
  ],
  10,      // maxVisible
  theme,   // SettingsListTheme
  (id, newValue) => console.log(`${id} changed to ${newValue}`),
  () => console.log("Cancelled")
);
settings.updateValue("theme", "light");
```

**Controls:**
**操作方式：**
- Arrow keys: Navigate
  - 方向键：移动选择项
- Enter/Space: Activate (cycle value or open submenu)
  - Enter/Space：激活当前项（循环切换取值或打开子菜单）
- Escape: Cancel
  - Escape：取消

### Spacer 间隔

Empty lines for vertical spacing.
用空行实现垂直间距。

```typescript
const spacer = new Spacer(2); // 2 empty lines (default: 1)
```

### Image 图片

Renders images inline for terminals that support the Kitty graphics protocol (Kitty, Ghostty, WezTerm) or iTerm2 inline images. Falls back to a text placeholder on unsupported terminals.
在支持 Kitty 图形协议的终端（Kitty、Ghostty、WezTerm）或支持 iTerm2 内联图片的终端中直接渲染图片。在不支持的终端上会退化为文本占位符。

```typescript
interface ImageTheme {
  fallbackColor: (str: string) => string;
}

interface ImageOptions {
  maxWidthCells?: number;
  maxHeightCells?: number;
  filename?: string;
}

const image = new Image(
  base64Data,       // base64-encoded image data
  "image/png",      // MIME type
  theme,            // ImageTheme
  options           // optional ImageOptions
);
tui.addChild(image);
```

Supported formats: PNG, JPEG, GIF, WebP. Dimensions are parsed from the image headers automatically.
支持的格式：PNG、JPEG、GIF、WebP。图片尺寸会自动从图像文件头中解析得出。

#### Alternate-screen image compatibility 备用屏图片兼容性

`TuiAltScreen` supports inline images and partial viewport cropping in terminals that implement the Kitty graphics protocol, including Kitty and Ghostty. iTerm2's inline-image protocol does not provide operations to delete an existing placement or crop its source while scrolling. To prevent stale images from remaining over repainted content, `TuiAltScreen` renders image components as text placeholders in iTerm2. `TuiMainScreen` continues to render iTerm2 inline images normally.
在实现了 Kitty 图形协议的终端（包括 Kitty 和 Ghostty）中，`TuiAltScreen` 支持内联图片以及按视口进行局部裁剪。而 iTerm2 的内联图片协议没有提供在滚动过程中删除已有图片放置（placement）或裁剪其源图的操作。为避免残留的旧图片覆盖在重绘后的内容之上，`TuiAltScreen` 在 iTerm2 中会将图片组件渲染为文本占位符。`TuiMainScreen` 则仍然正常渲染 iTerm2 内联图片。

## Autocomplete 自动补全

### CombinedAutocompleteProvider 组合式补全提供器

Supports both slash commands and file paths.
同时支持斜杠命令与文件路径的补全。

```typescript
import { CombinedAutocompleteProvider } from "@earendil-works/pi-tui";

const provider = new CombinedAutocompleteProvider(
  [
    { name: "help", description: "Show help" },
    { name: "clear", description: "Clear screen" },
    { name: "delete", description: "Delete last message" },
  ],
  process.cwd() // base path for file completion
);

editor.setAutocompleteProvider(provider);
```

**Features:**
**特性：**
- Type `/` to see slash commands
  - 输入 `/` 查看可用的斜杠命令
- Press `Tab` for file path completion
  - 按 `Tab` 进行文件路径补全
- Works with `~/`, `./`, `../`, and `@` prefix
  - 支持 `~/`、`./`、`../` 以及 `@` 前缀
- Filters to attachable files for `@` prefix
  - 使用 `@` 前缀时，仅筛选出可作为附件的文件

## Key Detection 按键检测

Use `matchesKey()` with the `Key` helper for detecting keyboard input (supports Kitty keyboard protocol):
使用 `matchesKey()` 配合 `Key` 辅助对象来检测键盘输入（支持 Kitty 键盘协议）：

```typescript
import { matchesKey, Key } from "@earendil-works/pi-tui";

if (matchesKey(data, Key.ctrl("c"))) {
  process.exit(0);
}

if (matchesKey(data, Key.enter)) {
  submit();
} else if (matchesKey(data, Key.escape)) {
  cancel();
} else if (matchesKey(data, Key.up)) {
  moveUp();
}
```

**Key identifiers** (use `Key.*` for autocomplete, or string literals):
**按键标识符**（推荐使用 `Key.*` 以获得代码补全，也可直接使用字符串字面量）：
- Basic keys: `Key.enter`, `Key.escape`, `Key.tab`, `Key.space`, `Key.backspace`, `Key.delete`, `Key.home`, `Key.end`
  - 基础按键：`Key.enter`、`Key.escape`、`Key.tab`、`Key.space`、`Key.backspace`、`Key.delete`、`Key.home`、`Key.end`
- Arrow keys: `Key.up`, `Key.down`, `Key.left`, `Key.right`
  - 方向键：`Key.up`、`Key.down`、`Key.left`、`Key.right`
- With modifiers: `Key.ctrl("c")`, `Key.shift("tab")`, `Key.alt("left")`, `Key.ctrlShift("p")`
  - 带修饰键：`Key.ctrl("c")`、`Key.shift("tab")`、`Key.alt("left")`、`Key.ctrlShift("p")`
- String format also works: `"enter"`, `"ctrl+c"`, `"shift+tab"`, `"ctrl+shift+p"`
  - 也支持字符串写法：`"enter"`、`"ctrl+c"`、`"shift+tab"`、`"ctrl+shift+p"`

## Rendering modes 渲染模式

`TuiMainScreen` uses three rendering strategies:
`TuiMainScreen` 采用三种渲染策略：

1. **First Render**: Output all lines without clearing scrollback
   1. **首次渲染**：直接输出全部行，不清除回滚历史
2. **Width Changed or Change Above Viewport**: Clear screen and fully re-render
   2. **宽度变化或视口上方内容发生变化**：清屏并完整重绘
3. **Normal Update**: Move the cursor to the first changed line, clear to the end, and render changed lines
   3. **常规更新**：将光标移动到首个变化的行，清除其后内容，然后渲染发生变化的行

`TuiAltScreen` owns a terminal-height viewport. Without an explicit layout root it preserves the legacy single-document scrolling behavior. With `setLayoutRoot()`, `VStack`, `HStack`, and nested `ScrollView` components can reserve fixed regions and independently scroll constrained regions. It updates changed viewport rows in place, follows streaming output while at the bottom, and preserves a manually selected scroll position while content grows. Mouse-wheel and configurable keyboard navigation scroll without modifying terminal scrollback. Clicking an OSC 8 hyperlink opens it with the configured URL handler. Dragging with the primary mouse button selects text and copies it to the clipboard with OSC 52; holding the drag at a scroll view's top or bottom edge auto-scrolls and extends the selection into off-screen content. Kitty images support vertical viewport cropping; iTerm2 inline images fall back to text because the iTerm2 protocol cannot delete or crop placements during viewport repainting.
`TuiAltScreen` 自行管理一个与终端等高的视口。若未设置显式的布局根节点，它会保持原有的单文档滚动行为。通过 `setLayoutRoot()`，`VStack`、`HStack` 以及嵌套的 `ScrollView` 组件可以预留固定区域，并让受约束的区域各自独立滚动。它会就地更新视口中发生变化的行；当视图停留在底部时会自动跟随流式输出；而当用户手动选定了滚动位置时，即使内容持续增长也会保持该位置。鼠标滚轮和可配置的键盘导航都能滚动视图，且不会修改终端的回滚历史。点击 OSC 8 超链接会通过配置的 URL 处理器打开该链接。按住鼠标主键拖动可选中文本，并通过 OSC 52 复制到剪贴板；将拖动保持在滚动视图的顶部或底部边缘时会自动滚动，并把选区扩展到屏幕外的内容。Kitty 图片支持按视口进行垂直裁剪；iTerm2 内联图片则退化为文本，因为 iTerm2 协议无法在视口重绘期间删除或裁剪图片放置。

Both renderers wrap updates in **synchronized output** (`\x1b[?2026h` ... `\x1b[?2026l`) for atomic, flicker-free rendering.
两种渲染器都会将更新包裹在**同步输出**（`\x1b[?2026h` ... `\x1b[?2026l`）中，以实现原子化、无闪烁的渲染。

## Terminal Interface 终端接口

The TUI works with any object implementing the `Terminal` interface:
TUI 可以与任何实现了 `Terminal` 接口的对象协同工作：

```typescript
interface Terminal {
  start(onInput: (data: string) => void, onResize: () => void): void;
  stop(): void;
  write(data: string): void;
  get columns(): number;
  get rows(): number;
  moveBy(lines: number): void;
  hideCursor(): void;
  showCursor(): void;
  clearLine(): void;
  clearFromCursor(): void;
  clearScreen(): void;
}
```

**Built-in implementations:**
**内置实现：**
- `ProcessTerminal` - Uses `process.stdin/stdout`
  - `ProcessTerminal` - 基于 `process.stdin/stdout`
- `VirtualTerminal` - For testing (uses `@xterm/headless`)
  - `VirtualTerminal` - 用于测试（基于 `@xterm/headless`）

## Utilities 工具函数

```typescript
import { visibleWidth, truncateToWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

// Get visible width of string (ignoring ANSI codes)
const width = visibleWidth("\x1b[31mHello\x1b[0m"); // 5

// Truncate string to width (preserving ANSI codes, adds ellipsis)
const truncated = truncateToWidth("Hello World", 8); // "Hello..."

// Truncate without ellipsis
const truncatedNoEllipsis = truncateToWidth("Hello World", 8, ""); // "Hello Wo"

// Wrap text to width (preserving ANSI codes across line breaks)
const lines = wrapTextWithAnsi("This is a long line that needs wrapping", 20);
// ["This is a long line", "that needs wrapping"]
```

## Creating Custom Components 创建自定义组件

When creating custom components, **each line returned by `render()` must not exceed the `width` parameter**. The TUI will error if any line is wider than the terminal.
编写自定义组件时，**`render()` 返回的每一行都不得超过 `width` 参数所指定的宽度**。若任何一行宽于终端宽度，TUI 将会报错。

### Handling Input 处理输入

Use `matchesKey()` with the `Key` helper for keyboard input:
使用 `matchesKey()` 配合 `Key` 辅助对象来处理键盘输入：

```typescript
import { matchesKey, Key, truncateToWidth } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";

class MyInteractiveComponent implements Component {
  private selectedIndex = 0;
  private items = ["Option 1", "Option 2", "Option 3"];
  
  public onSelect?: (index: number) => void;
  public onCancel?: () => void;

  handleInput(data: string): void {
    if (matchesKey(data, Key.up)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
    } else if (matchesKey(data, Key.down)) {
      this.selectedIndex = Math.min(this.items.length - 1, this.selectedIndex + 1);
    } else if (matchesKey(data, Key.enter)) {
      this.onSelect?.(this.selectedIndex);
    } else if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c"))) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    return this.items.map((item, i) => {
      const prefix = i === this.selectedIndex ? "> " : "  ";
      return truncateToWidth(prefix + item, width);
    });
  }
}
```

### Handling Line Width 处理行宽

Use the provided utilities to ensure lines fit:
使用框架提供的工具函数来确保每行内容都能容纳在可用宽度内：

```typescript
import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";
import type { Component } from "@earendil-works/pi-tui";

class MyComponent implements Component {
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  render(width: number): string[] {
    // Option 1: Truncate long lines
    return [truncateToWidth(this.text, width)];

    // Option 2: Check and pad to exact width
    const line = this.text;
    const visible = visibleWidth(line);
    if (visible > width) {
      return [truncateToWidth(line, width)];
    }
    // Pad to exact width (optional, for backgrounds)
    return [line + " ".repeat(width - visible)];
  }
}
```

### ANSI Code Considerations ANSI 转义码注意事项

Both `visibleWidth()` and `truncateToWidth()` correctly handle ANSI escape codes:
`visibleWidth()` 和 `truncateToWidth()` 都能正确处理 ANSI 转义码：

- `visibleWidth()` ignores ANSI codes when calculating width
  - `visibleWidth()` 在计算宽度时会忽略 ANSI 转义码
- `truncateToWidth()` preserves ANSI codes and properly closes them when truncating
  - `truncateToWidth()` 会保留 ANSI 转义码，并在截断时正确地闭合这些样式

```typescript
import chalk from "chalk";

const styled = chalk.red("Hello") + " " + chalk.blue("World");
const width = visibleWidth(styled); // 11 (not counting ANSI codes)
const truncated = truncateToWidth(styled, 8); // Red "Hello" + " W..." with proper reset
```

### Caching 缓存

For performance, components should cache their rendered output and only re-render when necessary:
出于性能考虑，组件应当缓存自身的渲染结果，仅在必要时才重新渲染：

```typescript
class CachedComponent implements Component {
  private text: string;
  private cachedWidth?: number;
  private cachedLines?: string[];

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    const lines = [truncateToWidth(this.text, width)];

    this.cachedWidth = width;
    this.cachedLines = lines;
    return lines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
```

## Example 示例

See `test/chat-simple.ts` for a complete chat interface example with:
完整的聊天界面示例参见 `test/chat-simple.ts`，其中包含：
- Markdown messages with custom background colors
  - 带自定义背景色的 Markdown 消息
- Loading spinner during responses
  - 响应期间显示的加载指示器
- Editor with autocomplete and slash commands
  - 支持自动补全与斜杠命令的编辑器
- Spacers between messages
  - 消息之间的间隔组件

Run it:
运行方式：
```bash
npx tsx test/chat-simple.ts
```

## Development 开发

```bash
# Install dependencies (from monorepo root)
npm install

# Run type checking
npm run check

# Run the demo
npx tsx test/chat-simple.ts
```

上述命令依次为：安装依赖（在 monorepo 根目录执行）、运行类型检查、运行演示程序。

### Debug logging 调试日志

Set `PI_TUI_WRITE_LOG` to capture the raw ANSI stream written to stdout.
设置 `PI_TUI_WRITE_LOG` 环境变量，即可捕获写入 stdout 的原始 ANSI 数据流。

```bash
PI_TUI_WRITE_LOG=/tmp/tui-ansi.log npx tsx test/chat-simple.ts
```
