> pi can create TUI components. Ask it to build one for your use case.
> pi 可以创建 TUI 组件。你可以让它为你的使用场景构建一个。

# TUI Components TUI 组件

Extensions and custom tools can render custom TUI components for interactive user interfaces. This page covers the component system and available building blocks.
扩展（extension）和自定义工具可以渲染自定义 TUI 组件，以构建交互式用户界面。本页介绍组件系统以及可用的构建模块。

**Source:** [`@earendil-works/pi-tui`](https://github.com/earendil-works/pi-mono/tree/main/packages/tui)
**源码：** [`@earendil-works/pi-tui`](https://github.com/earendil-works/pi-mono/tree/main/packages/tui)

## Component Interface 组件接口

All components implement:
所有组件都实现以下接口：

```typescript
interface Component {
  render(width: number): string[];
  handleInput?(data: string): void;
  wantsKeyRelease?: boolean;
  invalidate(): void;
}
```

| Method | Description |
|--------|-------------|
| `render(width)` | Return array of strings (one per line). Each line **must not exceed `width`**.<br>返回字符串数组（每行一个元素）。每一行**都不得超过 `width`**。 |
| `handleInput?(data)` | Receive keyboard input when component has focus.<br>当组件获得焦点时接收键盘输入。 |
| `wantsKeyRelease?` | If true, component receives key release events (Kitty protocol). Default: false.<br>若为 true，组件会接收按键释放（key release）事件（Kitty 协议）。默认值：false。 |
| `invalidate()` | Clear cached render state. Called on theme changes.<br>清除缓存的渲染状态。主题变更时会被调用。 |

The TUI appends a full SGR reset and OSC 8 reset at the end of each rendered line. Styles do not carry across lines. If you emit multi-line text with styling, reapply styles per line or use `wrapTextWithAnsi()` so styles are preserved for each wrapped line.
TUI 会在每一行渲染结果末尾追加完整的 SGR 重置和 OSC 8 重置。样式不会跨行延续。如果你输出带样式的多行文本，需要为每一行重新应用样式，或使用 `wrapTextWithAnsi()`，这样每个折行后的行都能保留样式。

## Focusable Interface (IME Support) Focusable 接口（输入法支持）

Components that display a text cursor and need IME (Input Method Editor) support should implement the `Focusable` interface:
需要显示文本光标并支持 IME（输入法编辑器）的组件应实现 `Focusable` 接口：

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
当 `Focusable` 组件获得焦点时，TUI 会：
1. Sets `focused = true` on the component
   在该组件上设置 `focused = true`
2. Scans rendered output for `CURSOR_MARKER` (a zero-width APC escape sequence)
   在渲染输出中扫描 `CURSOR_MARKER`（一个零宽度的 APC 转义序列）
3. Positions the hardware terminal cursor at that location
   将终端硬件光标定位到该位置
4. Shows the hardware cursor only when `showHardwareCursor` is enabled
   仅在启用 `showHardwareCursor` 时才显示硬件光标

The cursor remains hidden by default. This keeps the fake cursor rendering, while still positioning the hardware cursor for terminals that track IME candidate windows with hidden cursors. Some terminals require a visible hardware cursor for IME positioning; enable it with `showHardwareCursor`, `setShowHardwareCursor(true)`, or `PI_HARDWARE_CURSOR=1`. The `Editor` and `Input` built-in components already implement this interface.
光标默认保持隐藏。这样既保留了模拟光标（fake cursor）的渲染效果，又能为那些在光标隐藏时仍会跟踪 IME 候选词窗口的终端定位硬件光标。某些终端需要可见的硬件光标才能正确定位 IME；可通过 `showHardwareCursor`、`setShowHardwareCursor(true)` 或 `PI_HARDWARE_CURSOR=1` 启用。内置的 `Editor` 和 `Input` 组件已经实现了该接口。

### Container Components with Embedded Inputs 内嵌输入框的容器组件

When a container component (dialog, selector, etc.) contains an `Input` or `Editor` child, the container must implement `Focusable` and propagate the focus state to the child. Otherwise, the hardware cursor won't be positioned correctly for IME input.
当容器组件（对话框、选择器等）包含 `Input` 或 `Editor` 子组件时，容器必须实现 `Focusable` 并把焦点状态传递给子组件。否则，硬件光标无法为 IME 输入正确定位。

```typescript
import { Container, type Focusable, Input } from "@earendil-works/pi-tui";

class SearchDialog extends Container implements Focusable {
  private searchInput: Input;

  // Focusable implementation - propagate to child input for IME cursor positioning
  private _focused = false;
  get focused(): boolean {
    return this._focused;
  }
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

Without this propagation, typing with an IME (Chinese, Japanese, Korean, etc.) will show the candidate window in the wrong position on screen.
如果不做这种传递，使用输入法（中文、日文、韩文等）打字时，候选词窗口会出现在屏幕上的错误位置。

## Using Components 使用组件

**In extensions** via `ctx.ui.custom()`:
**在扩展中**，通过 `ctx.ui.custom()` 使用：

```typescript
pi.on("session_start", async (_event, ctx) => {
  const result = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) =>
    new MyComponent({
      theme,
      keybindings,
      onChange: () => tui.requestRender(),
      onSelect: (value) => done(value),
      onCancel: () => done(null),
    })
  );
});
```

**In custom tools** via `ctx.ui.custom()`:
**在自定义工具中**，通过 `ctx.ui.custom()` 使用：

```typescript
async execute(toolCallId, params, signal, onUpdate, ctx) {
  const result = await ctx.ui.custom<string | null>((tui, theme, keybindings, done) =>
    new MyComponent({
      theme,
      keybindings,
      onChange: () => tui.requestRender(),
      onSelect: (value) => done(value),
      onCancel: () => done(null),
    })
  );
  // Use result...
}
```

## Overlays 浮层

Overlays render components on top of existing content without clearing the screen. Pass `{ overlay: true }` to `ctx.ui.custom()`:
浮层（overlay）会把组件渲染在已有内容之上，且不会清屏。向 `ctx.ui.custom()` 传入 `{ overlay: true }` 即可：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new MyDialog({ onClose: done }),
  { overlay: true }
);
```

For positioning and sizing, use `overlayOptions`:
如需控制定位和尺寸，请使用 `overlayOptions`：

```typescript
const result = await ctx.ui.custom<string | null>(
  (tui, theme, keybindings, done) => new SidePanel({ onClose: done }),
  {
    overlay: true,
    overlayOptions: {
      // Size: number or percentage string
      width: "50%",          // 50% of terminal width
      minWidth: 40,          // minimum 40 columns
      maxHeight: "80%",      // max 80% of terminal height

      // Position: anchor-based (default: "center")
      anchor: "right-center", // 9 positions: center, top-left, top-center, etc.
      offsetX: -2,            // offset from anchor
      offsetY: 0,

      // Or percentage/absolute positioning
      row: "25%",            // 25% from top
      col: 10,               // column 10

      // Margins
      margin: 2,             // all sides, or { top, right, bottom, left }

      // Responsive: hide on narrow terminals
      visible: (termWidth, termHeight) => termWidth >= 80,
    },
    // Get handle for programmatic focus and visibility control
    onHandle: (handle) => {
      // handle.focus() - focus this overlay and bring it to the visual front
      // handle.unfocus() - release input to normal fallback
      // handle.unfocus({ target }) - release input to a specific component or null
      // handle.setHidden(true/false) - toggle visibility
      // handle.hide() - permanently remove
    },
  }
);
```

### Overlay Focus 浮层焦点

A focused visible overlay keeps input ownership across temporary non-overlay UI. If an overlay opens another `ctx.ui.custom()` component without `{ overlay: true }`, that replacement UI receives input while it is active; when it closes, the focused overlay can reclaim input.
获得焦点且可见的浮层，会在临时的非浮层 UI 出现期间继续保持对输入的所有权。如果某个浮层打开了另一个不带 `{ overlay: true }` 的 `ctx.ui.custom()` 组件，那么这个替代 UI 在活动期间会接收输入；当它关闭后，处于焦点状态的浮层可以重新取回输入。

Use `handle.unfocus()` when a visible overlay should stop owning input and let TUI fall back to another visible capturing overlay or the previous focus target. Use `handle.unfocus({ target })` when a specific component should receive input while the overlay stays visible. Passing `{ target: null }` intentionally leaves no focused component until focus is set again.
当某个可见浮层应当放弃输入所有权、让 TUI 回退到另一个可见的捕获型浮层或先前的焦点目标时，使用 `handle.unfocus()`。当浮层保持可见、但希望由某个特定组件接收输入时，使用 `handle.unfocus({ target })`。传入 `{ target: null }` 表示有意让当前没有任何焦点组件，直到再次设置焦点为止。

### Overlay Lifecycle 浮层生命周期

Overlay components are disposed when closed. Don't reuse references - create fresh instances:
浮层组件在关闭时会被销毁（dispose）。不要复用旧引用，应创建新实例：

```typescript
// Wrong - stale reference
let menu: MenuComponent;
await ctx.ui.custom((_, __, ___, done) => {
  menu = new MenuComponent(done);
  return menu;
}, { overlay: true });
setActiveComponent(menu);  // Disposed

// Correct - re-call to re-show
const showMenu = () => ctx.ui.custom((_, __, ___, done) => 
  new MenuComponent(done), { overlay: true });

await showMenu();  // First show
await showMenu();  // "Back" = just call again
```

See [overlay-qa-tests.ts](../examples/extensions/overlay-qa-tests.ts) for comprehensive examples covering anchors, margins, stacking, responsive visibility, and animation.
完整示例请参见 [overlay-qa-tests.ts](../examples/extensions/overlay-qa-tests.ts)，其中涵盖锚点、外边距、层叠、响应式可见性和动画。

## Built-in Components 内置组件

Import from `@earendil-works/pi-tui`:
从 `@earendil-works/pi-tui` 导入：

```typescript
import { Text, Box, Container, Spacer, Markdown } from "@earendil-works/pi-tui";
```

### Text

Multi-line text with word wrapping.
支持按词折行的多行文本。

```typescript
const text = new Text(
  "Hello World",    // content
  1,                // paddingX (default: 1)
  1,                // paddingY (default: 1)
  (s) => bgGray(s)  // optional background function
);
text.setText("Updated");
```

### Box

Container with padding and background color.
带内边距和背景色的容器。

```typescript
const box = new Box(
  1,                // paddingX
  1,                // paddingY
  (s) => bgGray(s)  // background function
);
box.addChild(new Text("Content", 0, 0));
box.setBgFn((s) => bgBlue(s));
```

### Container

Groups child components vertically.
将子组件按垂直方向组合排列。

```typescript
const container = new Container();
container.addChild(component1);
container.addChild(component2);
container.removeChild(component1);
```

### Spacer

Empty vertical space.
垂直方向的空白间隔。

```typescript
const spacer = new Spacer(2);  // 2 empty lines
```

### Markdown

Renders markdown with syntax highlighting.
渲染带语法高亮的 markdown。

```typescript
const md = new Markdown(
  "# Title\n\nSome **bold** text",
  1,        // paddingX
  1,        // paddingY
  theme     // MarkdownTheme (see below)
);
md.setText("Updated markdown");
```

### Image

Renders images in supported terminals (Kitty, iTerm2, Ghostty, WezTerm, Warp).
在受支持的终端中渲染图片（Kitty、iTerm2、Ghostty、WezTerm、Warp）。

```typescript
const image = new Image(
  base64Data,   // base64-encoded image
  "image/png",  // MIME type
  theme,        // ImageTheme
  { maxWidthCells: 80, maxHeightCells: 24 }
);
```

## Keyboard Input 键盘输入

Use `matchesKey()` for key detection:
使用 `matchesKey()` 进行按键检测：

```typescript
import { matchesKey, Key } from "@earendil-works/pi-tui";

handleInput(data: string) {
  if (matchesKey(data, Key.up)) {
    this.selectedIndex--;
  } else if (matchesKey(data, Key.enter)) {
    this.onSelect?.(this.selectedIndex);
  } else if (matchesKey(data, Key.escape)) {
    this.onCancel?.();
  } else if (matchesKey(data, Key.ctrl("c"))) {
    // Ctrl+C
  }
}
```

**Key identifiers** (use `Key.*` for autocomplete, or string literals):
**按键标识符**（使用 `Key.*` 可获得自动补全，也可使用字符串字面量）：
- Basic keys: `Key.enter`, `Key.escape`, `Key.tab`, `Key.space`, `Key.backspace`, `Key.delete`, `Key.home`, `Key.end`
  基础按键：`Key.enter`、`Key.escape`、`Key.tab`、`Key.space`、`Key.backspace`、`Key.delete`、`Key.home`、`Key.end`
- Arrow keys: `Key.up`, `Key.down`, `Key.left`, `Key.right`
  方向键：`Key.up`、`Key.down`、`Key.left`、`Key.right`
- With modifiers: `Key.ctrl("c")`, `Key.shift("tab")`, `Key.alt("left")`, `Key.ctrlShift("p")`
  带修饰键：`Key.ctrl("c")`、`Key.shift("tab")`、`Key.alt("left")`、`Key.ctrlShift("p")`
- String format also works: `"enter"`, `"ctrl+c"`, `"shift+tab"`, `"ctrl+shift+p"`
  字符串格式同样可用：`"enter"`、`"ctrl+c"`、`"shift+tab"`、`"ctrl+shift+p"`

## Line Width 行宽

**Critical:** Each line from `render()` must not exceed the `width` parameter.
**关键：** `render()` 返回的每一行都不得超过 `width` 参数指定的宽度。

```typescript
import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";

render(width: number): string[] {
  // Truncate long lines
  return [truncateToWidth(this.text, width)];
}
```

Utilities:
工具函数：
- `visibleWidth(str)` - Get display width (ignores ANSI codes)
  `visibleWidth(str)` - 获取显示宽度（忽略 ANSI 转义码）
- `truncateToWidth(str, width, ellipsis?)` - Truncate with optional ellipsis
  `truncateToWidth(str, width, ellipsis?)` - 截断字符串，可选附加省略号
- `wrapTextWithAnsi(str, width)` - Word wrap preserving ANSI codes
  `wrapTextWithAnsi(str, width)` - 按词折行，同时保留 ANSI 转义码

## Creating Custom Components 创建自定义组件

Example: Interactive selector
示例：交互式选择器

```typescript
import {
  matchesKey, Key,
  truncateToWidth, visibleWidth
} from "@earendil-works/pi-tui";

class MySelector {
  private items: string[];
  private selected = 0;
  private cachedWidth?: number;
  private cachedLines?: string[];
  
  public onSelect?: (item: string) => void;
  public onCancel?: () => void;

  constructor(items: string[]) {
    this.items = items;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.up) && this.selected > 0) {
      this.selected--;
      this.invalidate();
    } else if (matchesKey(data, Key.down) && this.selected < this.items.length - 1) {
      this.selected++;
      this.invalidate();
    } else if (matchesKey(data, Key.enter)) {
      this.onSelect?.(this.items[this.selected]);
    } else if (matchesKey(data, Key.escape)) {
      this.onCancel?.();
    }
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }

    this.cachedLines = this.items.map((item, i) => {
      const prefix = i === this.selected ? "> " : "  ";
      return truncateToWidth(prefix + item, width);
    });
    this.cachedWidth = width;
    return this.cachedLines;
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }
}
```

Usage in an extension:
在扩展中的用法：

```typescript
pi.registerCommand("pick", {
  description: "Pick an item",
  handler: async (_args, ctx) => {
    const items = ["Option A", "Option B", "Option C"];
    const selected = await ctx.ui.custom<string | null>((tui, _theme, _keybindings, done) => {
      const selector = new MySelector(items);
      selector.onSelect = done;
      selector.onCancel = () => done(null);

      return {
        render: (width) => selector.render(width),
        handleInput: (data) => {
          selector.handleInput(data);
          tui.requestRender();
        },
        invalidate: () => selector.invalidate(),
      };
    });

    if (selected !== null) {
      ctx.ui.notify(`Selected: ${selected}`, "info");
    }
  }
});
```

## Theming 主题

Components accept theme objects for styling.
组件接受主题对象来控制样式。

**In `renderCall`/`renderResult`**, use the `theme` parameter:
**在 `renderCall`/`renderResult` 中**，使用 `theme` 参数：

```typescript
renderResult(result, options, theme, context) {
  // Use theme.fg() for foreground colors
  return new Text(theme.fg("success", "Done!"), 0, 0);
  
  // Use theme.bg() for background colors
  const styled = theme.bg("toolPendingBg", theme.fg("accent", "text"));
}
```

**Foreground colors** (`theme.fg(color, text)`):
**前景色**（`theme.fg(color, text)`）：

| Category | Colors |
|----------|--------|
| General<br>通用 | `text`, `accent`, `muted`, `dim` |
| Status<br>状态 | `success`, `error`, `warning` |
| Borders<br>边框 | `border`, `borderAccent`, `borderMuted` |
| Messages<br>消息 | `userMessageText`, `customMessageText`, `customMessageLabel` |
| Tools<br>工具 | `toolTitle`, `toolOutput` |
| Diffs<br>差异 | `toolDiffAdded`, `toolDiffRemoved`, `toolDiffContext` |
| Markdown | `mdHeading`, `mdLink`, `mdLinkUrl`, `mdCode`, `mdCodeBlock`, `mdCodeBlockBorder`, `mdQuote`, `mdQuoteBorder`, `mdHr`, `mdListBullet` |
| Syntax<br>语法高亮 | `syntaxComment`, `syntaxKeyword`, `syntaxFunction`, `syntaxVariable`, `syntaxString`, `syntaxNumber`, `syntaxType`, `syntaxOperator`, `syntaxPunctuation` |
| Thinking<br>思考等级 | `thinkingOff`, `thinkingMinimal`, `thinkingLow`, `thinkingMedium`, `thinkingHigh`, `thinkingXhigh`, `thinkingMax` |
| Modes<br>模式 | `bashMode` |

**Background colors** (`theme.bg(color, text)`):
**背景色**（`theme.bg(color, text)`）：

`selectedBg`, `userMessageBg`, `customMessageBg`, `toolPendingBg`, `toolSuccessBg`, `toolErrorBg`

**For Markdown**, use `getMarkdownTheme()`:
**对于 Markdown**，请使用 `getMarkdownTheme()`：

```typescript
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Markdown } from "@earendil-works/pi-tui";

renderResult(result, options, theme, context) {
  const mdTheme = getMarkdownTheme();
  return new Markdown(result.details.markdown, 0, 0, mdTheme);
}
```

**For custom components**, define your own theme interface:
**对于自定义组件**，可以定义你自己的主题接口：

```typescript
interface MyTheme {
  selected: (s: string) => string;
  normal: (s: string) => string;
}
```

## Debug logging 调试日志

Set `PI_TUI_WRITE_LOG` to capture the raw ANSI stream written to stdout.
设置 `PI_TUI_WRITE_LOG` 可以捕获写入 stdout 的原始 ANSI 流。

```bash
PI_TUI_WRITE_LOG=/tmp/tui-ansi.log npx tsx packages/tui/test/chat-simple.ts
```

## Performance 性能

Cache rendered output when possible:
尽可能缓存渲染输出：

```typescript
class CachedComponent {
  private cachedWidth?: number;
  private cachedLines?: string[];

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) {
      return this.cachedLines;
    }
    // ... compute lines ...
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

Call `invalidate()` when state changes, then use the injected `tui.requestRender()` to trigger re-render.
状态变更时调用 `invalidate()`，然后使用注入的 `tui.requestRender()` 触发重新渲染。

## Invalidation and Theme Changes 缓存失效与主题变更

When the theme changes, the TUI calls `invalidate()` on all components to clear their caches. Components must properly implement `invalidate()` to ensure theme changes take effect.
当主题变更时，TUI 会对所有组件调用 `invalidate()` 以清除其缓存。组件必须正确实现 `invalidate()`，才能确保主题变更生效。

### The Problem 问题所在

If a component pre-bakes theme colors into strings (via `theme.fg()`, `theme.bg()`, etc.) and caches them, the cached strings contain ANSI escape codes from the old theme. Simply clearing the render cache isn't enough if the component stores the themed content separately.
如果组件把主题颜色预先烘焙（pre-bake）进字符串（通过 `theme.fg()`、`theme.bg()` 等）并将其缓存，那么缓存的字符串中就包含来自旧主题的 ANSI 转义码。若组件把已上色的内容单独存储，仅清除渲染缓存是不够的。

**Wrong approach** (theme colors won't update):
**错误做法**（主题颜色不会更新）：

```typescript
class BadComponent extends Container {
  private content: Text;

  constructor(message: string, theme: Theme) {
    super();
    // Pre-baked theme colors stored in Text component
    this.content = new Text(theme.fg("accent", message), 1, 0);
    this.addChild(this.content);
  }
  // No invalidate override - parent's invalidate only clears
  // child render caches, not the pre-baked content
}
```

### The Solution 解决方案

Components that build content with theme colors must rebuild that content when `invalidate()` is called:
使用主题颜色构建内容的组件，必须在 `invalidate()` 被调用时重建这些内容：

```typescript
class GoodComponent extends Container {
  private message: string;
  private content: Text;

  constructor(message: string) {
    super();
    this.message = message;
    this.content = new Text("", 1, 0);
    this.addChild(this.content);
    this.updateDisplay();
  }

  private updateDisplay(): void {
    // Rebuild content with current theme
    this.content.setText(theme.fg("accent", this.message));
  }

  override invalidate(): void {
    super.invalidate();  // Clear child caches
    this.updateDisplay(); // Rebuild with new theme
  }
}
```

### Pattern: Rebuild on Invalidate 模式：在失效时重建

For components with complex content:
适用于内容较复杂的组件：

```typescript
class ComplexComponent extends Container {
  private data: SomeData;

  constructor(data: SomeData) {
    super();
    this.data = data;
    this.rebuild();
  }

  private rebuild(): void {
    this.clear();  // Remove all children

    // Build UI with current theme
    this.addChild(new Text(theme.fg("accent", theme.bold("Title")), 1, 0));
    this.addChild(new Spacer(1));

    for (const item of this.data.items) {
      const color = item.active ? "success" : "muted";
      this.addChild(new Text(theme.fg(color, item.label), 1, 0));
    }
  }

  override invalidate(): void {
    super.invalidate();
    this.rebuild();
  }
}
```

### When This Matters 何时需要关注

This pattern is needed when:
在以下情况下需要采用该模式：

1. **Pre-baking theme colors** - Using `theme.fg()` or `theme.bg()` to create styled strings stored in child components
   **预先烘焙主题颜色** - 使用 `theme.fg()` 或 `theme.bg()` 生成带样式的字符串并存储在子组件中
2. **Syntax highlighting** - Using `highlightCode()` which applies theme-based syntax colors
   **语法高亮** - 使用 `highlightCode()`，它会应用基于主题的语法颜色
3. **Complex layouts** - Building child component trees that embed theme colors
   **复杂布局** - 构建内嵌了主题颜色的子组件树

This pattern is NOT needed when:
在以下情况下不需要该模式：

1. **Using theme callbacks** - Passing functions like `(text) => theme.fg("accent", text)` that are called during render
   **使用主题回调** - 传入形如 `(text) => theme.fg("accent", text)` 的函数，它们在渲染时才被调用
2. **Simple containers** - Just grouping other components without adding themed content
   **简单容器** - 仅组合其他组件，不添加带主题样式的内容
3. **Stateless render** - Computing themed output fresh in every `render()` call (no caching)
   **无状态渲染** - 在每次 `render()` 调用时重新计算带主题的输出（不做缓存）

## Common Patterns 常见模式

These patterns cover the most common UI needs in extensions. **Copy these patterns instead of building from scratch.**
这些模式覆盖了扩展中最常见的 UI 需求。**请直接复用这些模式，而不要从零开始构建。**

### Pattern 1: Selection Dialog (SelectList) 模式 1：选择对话框（SelectList）

For letting users pick from a list of options. Use `SelectList` from `@earendil-works/pi-tui` with `DynamicBorder` for framing.
用于让用户从一组选项中进行选择。使用 `@earendil-works/pi-tui` 提供的 `SelectList`，并配合 `DynamicBorder` 作为边框。

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@earendil-works/pi-tui";

pi.registerCommand("pick", {
  handler: async (_args, ctx) => {
    const items: SelectItem[] = [
      { value: "opt1", label: "Option 1", description: "First option" },
      { value: "opt2", label: "Option 2", description: "Second option" },
      { value: "opt3", label: "Option 3" },  // description is optional
    ];

    const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
      const container = new Container();

      // Top border
      container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

      // Title
      container.addChild(new Text(theme.fg("accent", theme.bold("Pick an Option")), 1, 0));

      // SelectList with theme
      const selectList = new SelectList(items, Math.min(items.length, 10), {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("dim", t),
        noMatch: (t) => theme.fg("warning", t),
      });
      selectList.onSelect = (item) => done(item.value);
      selectList.onCancel = () => done(null);
      container.addChild(selectList);

      // Help text
      container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel"), 1, 0));

      // Bottom border
      container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

      return {
        render: (w) => container.render(w),
        invalidate: () => container.invalidate(),
        handleInput: (data) => { selectList.handleInput(data); tui.requestRender(); },
      };
    });

    if (result) {
      ctx.ui.notify(`Selected: ${result}`, "info");
    }
  },
});
```

**Examples:** [preset.ts](../examples/extensions/preset.ts), [tools.ts](../examples/extensions/tools.ts)
**示例：** [preset.ts](../examples/extensions/preset.ts)、[tools.ts](../examples/extensions/tools.ts)

### Pattern 2: Async Operation with Cancel (BorderedLoader) 模式 2：可取消的异步操作（BorderedLoader）

For operations that take time and should be cancellable. `BorderedLoader` shows a spinner and handles escape to cancel.
适用于耗时且应可取消的操作。`BorderedLoader` 会显示一个加载动画（spinner），并处理 escape 键取消。

```typescript
import { BorderedLoader } from "@earendil-works/pi-coding-agent";

pi.registerCommand("fetch", {
  handler: async (_args, ctx) => {
    const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
      const loader = new BorderedLoader(tui, theme, "Fetching data...");
      loader.onAbort = () => done(null);

      // Do async work
      fetchData(loader.signal)
        .then((data) => done(data))
        .catch(() => done(null));

      return loader;
    });

    if (result === null) {
      ctx.ui.notify("Cancelled", "info");
    } else {
      ctx.ui.setEditorText(result);
    }
  },
});
```

**Examples:** [qna.ts](../examples/extensions/qna.ts), [handoff.ts](../examples/extensions/handoff.ts)
**示例：** [qna.ts](../examples/extensions/qna.ts)、[handoff.ts](../examples/extensions/handoff.ts)

### Pattern 3: Settings/Toggles (SettingsList) 模式 3：设置项/开关（SettingsList）

For toggling multiple settings. Use `SettingsList` from `@earendil-works/pi-tui` with `getSettingsListTheme()`.
用于切换多个设置项。使用 `@earendil-works/pi-tui` 提供的 `SettingsList`，并配合 `getSettingsListTheme()`。

```typescript
import { getSettingsListTheme } from "@earendil-works/pi-coding-agent";
import { Container, type SettingItem, SettingsList, Text } from "@earendil-works/pi-tui";

pi.registerCommand("settings", {
  handler: async (_args, ctx) => {
    const items: SettingItem[] = [
      { id: "verbose", label: "Verbose mode", currentValue: "off", values: ["on", "off"] },
      { id: "color", label: "Color output", currentValue: "on", values: ["on", "off"] },
    ];

    await ctx.ui.custom((_tui, theme, _kb, done) => {
      const container = new Container();
      container.addChild(new Text(theme.fg("accent", theme.bold("Settings")), 1, 1));

      const settingsList = new SettingsList(
        items,
        Math.min(items.length + 2, 15),
        getSettingsListTheme(),
        (id, newValue) => {
          // Handle value change
          ctx.ui.notify(`${id} = ${newValue}`, "info");
        },
        () => done(undefined),  // On close
        { enableSearch: true }, // Optional: enable fuzzy search by label
      );
      container.addChild(settingsList);

      return {
        render: (w) => container.render(w),
        invalidate: () => container.invalidate(),
        handleInput: (data) => settingsList.handleInput?.(data),
      };
    });
  },
});
```

**Examples:** [tools.ts](../examples/extensions/tools.ts)
**示例：** [tools.ts](../examples/extensions/tools.ts)

### Pattern 4: Persistent Status Indicator 模式 4：常驻状态指示器

Show status in the footer that persists across renders. Good for mode indicators.
在底栏（footer）中显示状态，并在多次渲染之间保持存在。适合用作模式指示器。

```typescript
// Set status (shown in footer)
ctx.ui.setStatus("my-ext", ctx.ui.theme.fg("accent", "● active"));

// Clear status
ctx.ui.setStatus("my-ext", undefined);
```

**Examples:** [status-line.ts](../examples/extensions/status-line.ts), [plan-mode/index.ts](../examples/extensions/plan-mode/index.ts), [preset.ts](../examples/extensions/preset.ts)
**示例：** [status-line.ts](../examples/extensions/status-line.ts)、[plan-mode/index.ts](../examples/extensions/plan-mode/index.ts)、[preset.ts](../examples/extensions/preset.ts)

### Pattern 4b: Working Indicator Customization 模式 4b：自定义工作指示器

Customize the inline working indicator shown while pi is streaming a response.
自定义 pi 在流式输出响应期间显示的内联工作指示器（working indicator）。

```typescript
// Static indicator
ctx.ui.setWorkingIndicator({ frames: [ctx.ui.theme.fg("accent", "●")] });

// Custom animated indicator
ctx.ui.setWorkingIndicator({
  frames: [
    ctx.ui.theme.fg("dim", "·"),
    ctx.ui.theme.fg("muted", "•"),
    ctx.ui.theme.fg("accent", "●"),
    ctx.ui.theme.fg("muted", "•"),
  ],
  intervalMs: 120,
});

// Hide the indicator entirely
ctx.ui.setWorkingIndicator({ frames: [] });

// Restore pi's default spinner
ctx.ui.setWorkingIndicator();
```

This only affects the normal streaming working indicator. Compaction and retry loaders keep their built-in styling. Custom frames are rendered verbatim, so extensions must add their own colors when needed.
这只会影响常规流式输出时的工作指示器。压缩（compaction）与重试加载指示器仍保持其内置样式。自定义帧会被原样渲染，因此扩展需要时必须自行添加颜色。

**Examples:** [working-indicator.ts](../examples/extensions/working-indicator.ts)
**示例：** [working-indicator.ts](../examples/extensions/working-indicator.ts)

### Pattern 5: Widgets Above/Below Editor 模式 5：编辑器上方/下方的挂件

Show persistent content above or below the input editor. Good for todo lists, progress.
在输入编辑器的上方或下方显示常驻内容。适合待办列表、进度展示等场景。

```typescript
// Simple string array (above editor by default)
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"]);

// Render below the editor
ctx.ui.setWidget("my-widget", ["Line 1", "Line 2"], { placement: "belowEditor" });

// Or with theme
ctx.ui.setWidget("my-widget", (_tui, theme) => {
  const lines = items.map((item, i) =>
    item.done
      ? theme.fg("success", "✓ ") + theme.fg("muted", item.text)
      : theme.fg("dim", "○ ") + item.text
  );
  return {
    render: () => lines,
    invalidate: () => {},
  };
});

// Clear
ctx.ui.setWidget("my-widget", undefined);
```

**Examples:** [plan-mode/index.ts](../examples/extensions/plan-mode/index.ts)
**示例：** [plan-mode/index.ts](../examples/extensions/plan-mode/index.ts)

### Pattern 6: Custom Footer 模式 6：自定义底栏

Replace the footer. `footerData` exposes data not otherwise accessible to extensions.
替换底栏（footer）。`footerData` 暴露了扩展本来无法访问的数据。

```typescript
ctx.ui.setFooter((tui, theme, footerData) => ({
  invalidate() {},
  render(width: number): string[] {
    // footerData.getGitBranch(): string | null
    // footerData.getExtensionStatuses(): ReadonlyMap<string, string>
    return [`${ctx.model?.id} (${footerData.getGitBranch() || "no git"})`];
  },
  dispose: footerData.onBranchChange(() => tui.requestRender()), // reactive
}));

ctx.ui.setFooter(undefined); // restore default
```

Token stats available via `ctx.sessionManager.getBranch()` and `ctx.model`.
Token 统计信息可通过 `ctx.sessionManager.getBranch()` 和 `ctx.model` 获取。

**Examples:** [custom-footer.ts](../examples/extensions/custom-footer.ts)
**示例：** [custom-footer.ts](../examples/extensions/custom-footer.ts)

### Pattern 7: Custom Editor (vim mode, etc.) 模式 7：自定义编辑器（vim 模式等）

Replace the main input editor with a custom implementation. Useful for modal editing (vim), different keybindings (emacs), or specialized input handling.
用自定义实现替换主输入编辑器。适用于模态编辑（vim）、不同的快捷键方案（emacs）或特殊的输入处理需求。

```typescript
import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth } from "@earendil-works/pi-tui";

type Mode = "normal" | "insert";

class VimEditor extends CustomEditor {
  private mode: Mode = "insert";

  handleInput(data: string): void {
    // Escape: switch to normal mode, or pass through for app handling
    if (matchesKey(data, "escape")) {
      if (this.mode === "insert") {
        this.mode = "normal";
        return;
      }
      // In normal mode, escape aborts agent (handled by CustomEditor)
      super.handleInput(data);
      return;
    }

    // Insert mode: pass everything to CustomEditor
    if (this.mode === "insert") {
      super.handleInput(data);
      return;
    }

    // Normal mode: vim-style navigation
    switch (data) {
      case "i": this.mode = "insert"; return;
      case "h": super.handleInput("\x1b[D"); return; // Left
      case "j": super.handleInput("\x1b[B"); return; // Down
      case "k": super.handleInput("\x1b[A"); return; // Up
      case "l": super.handleInput("\x1b[C"); return; // Right
    }
    // Pass unhandled keys to super (ctrl+c, etc.), but filter printable chars
    if (data.length === 1 && data.charCodeAt(0) >= 32) return;
    super.handleInput(data);
  }

  render(width: number): string[] {
    const lines = super.render(width);
    // Add mode indicator to bottom border (use truncateToWidth for ANSI-safe truncation)
    if (lines.length > 0) {
      const label = this.mode === "normal" ? " NORMAL " : " INSERT ";
      const lastLine = lines[lines.length - 1]!;
      // Pass "" as ellipsis to avoid adding "..." when truncating
      lines[lines.length - 1] = truncateToWidth(lastLine, width - label.length, "") + label;
    }
    return lines;
  }
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", (_event, ctx) => {
    // Factory receives the TUI, theme, and keybindings from the app
    ctx.ui.setEditorComponent((tui, theme, keybindings) =>
      new VimEditor(tui, theme, keybindings)
    );
  });
}
```

**Key points:**
**要点：**

- **Extend `CustomEditor`** (not base `Editor`) to get app keybindings (escape to abort, ctrl+d to exit, model switching, etc.)
  **继承 `CustomEditor`**（而不是基类 `Editor`），以获得应用级快捷键（escape 中止、ctrl+d 退出、切换模型等）
- **Call `super.handleInput(data)`** for keys you don't handle
  对于你不处理的按键，**调用 `super.handleInput(data)`**
- **Factory pattern**: `setEditorComponent` receives a factory function that gets `tui`, `theme`, and `keybindings`
  **工厂模式**：`setEditorComponent` 接收一个工厂函数，该函数会获得 `tui`、`theme` 和 `keybindings`
- **Pass `undefined`** to restore the default editor: `ctx.ui.setEditorComponent(undefined)`
  **传入 `undefined`** 可恢复默认编辑器：`ctx.ui.setEditorComponent(undefined)`

**Examples:** [modal-editor.ts](../examples/extensions/modal-editor.ts)
**示例：** [modal-editor.ts](../examples/extensions/modal-editor.ts)

## Key Rules 关键规则

1. **Always use theme from callback** - Don't import theme directly. Use `theme` from the `ctx.ui.custom((tui, theme, keybindings, done) => ...)` callback.
   **始终使用回调中的 theme** - 不要直接导入 theme。请使用 `ctx.ui.custom((tui, theme, keybindings, done) => ...)` 回调提供的 `theme`。

2. **Always type DynamicBorder color param** - Write `(s: string) => theme.fg("accent", s)`, not `(s) => theme.fg("accent", s)`.
   **始终为 DynamicBorder 的颜色参数标注类型** - 应写成 `(s: string) => theme.fg("accent", s)`，而不是 `(s) => theme.fg("accent", s)`。

3. **Call tui.requestRender() after state changes** - In `handleInput`, call `tui.requestRender()` after updating state.
   **状态变更后调用 tui.requestRender()** - 在 `handleInput` 中更新状态后，调用 `tui.requestRender()`。

4. **Return the three-method object** - Custom components need `{ render, invalidate, handleInput }`.
   **返回包含三个方法的对象** - 自定义组件需要 `{ render, invalidate, handleInput }`。

5. **Use existing components** - `SelectList`, `SettingsList`, `BorderedLoader` cover 90% of cases. Don't rebuild them.
   **复用现有组件** - `SelectList`、`SettingsList`、`BorderedLoader` 已覆盖 90% 的场景，不要重复造轮子。

## Examples 示例

- **Selection UI**: [examples/extensions/preset.ts](../examples/extensions/preset.ts) - SelectList with DynamicBorder framing
  **选择界面**：[examples/extensions/preset.ts](../examples/extensions/preset.ts) - 使用 SelectList 并以 DynamicBorder 加边框
- **Async with cancel**: [examples/extensions/qna.ts](../examples/extensions/qna.ts) - BorderedLoader for LLM calls
  **可取消的异步操作**：[examples/extensions/qna.ts](../examples/extensions/qna.ts) - 用于 LLM 调用的 BorderedLoader
- **Settings toggles**: [examples/extensions/tools.ts](../examples/extensions/tools.ts) - SettingsList for tool enable/disable
  **设置开关**：[examples/extensions/tools.ts](../examples/extensions/tools.ts) - 用 SettingsList 启用/禁用工具
- **Status indicators**: [examples/extensions/plan-mode/index.ts](../examples/extensions/plan-mode/index.ts) - setStatus and setWidget
  **状态指示器**：[examples/extensions/plan-mode/index.ts](../examples/extensions/plan-mode/index.ts) - setStatus 与 setWidget
- **Working indicator**: [examples/extensions/working-indicator.ts](../examples/extensions/working-indicator.ts) - setWorkingIndicator
  **工作指示器**：[examples/extensions/working-indicator.ts](../examples/extensions/working-indicator.ts) - setWorkingIndicator
- **Custom footer**: [examples/extensions/custom-footer.ts](../examples/extensions/custom-footer.ts) - setFooter with stats
  **自定义底栏**：[examples/extensions/custom-footer.ts](../examples/extensions/custom-footer.ts) - 带统计信息的 setFooter
- **Custom editor**: [examples/extensions/modal-editor.ts](../examples/extensions/modal-editor.ts) - Vim-like modal editing
  **自定义编辑器**：[examples/extensions/modal-editor.ts](../examples/extensions/modal-editor.ts) - 类 Vim 的模态编辑
- **Snake game**: [examples/extensions/snake.ts](../examples/extensions/snake.ts) - Full game with keyboard input, game loop
  **贪吃蛇游戏**：[examples/extensions/snake.ts](../examples/extensions/snake.ts) - 包含键盘输入和游戏循环的完整游戏
- **Custom tool rendering**: [examples/extensions/todo.ts](../examples/extensions/todo.ts) - renderCall and renderResult
  **自定义工具渲染**：[examples/extensions/todo.ts](../examples/extensions/todo.ts) - renderCall 与 renderResult
