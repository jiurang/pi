# Alternate-Screen Layout System Plan 备用屏幕布局系统规划

## Purpose 目的

Implement a constrained layout system for `TuiAltScreen` and use it to keep the coding-agent transcript scrollable while the pending/status/widget/editor/footer area remains fixed at the bottom.
为 `TuiAltScreen` 实现一套受约束的布局系统（constrained layout system），并借助它让 coding-agent 的会话记录（transcript）保持可滚动，同时让待发送消息/状态/挂件/编辑器/页脚区域固定在底部。

This document is an implementation handoff. It records the decisions made during design discussion and should be treated as the intended scope unless implementation findings require revisiting a decision.
本文档是一份实现交接文档。它记录了设计讨论期间做出的各项决策，除非实现过程中的发现要求重新审视某个决策，否则应将其视为既定范围。

## Core decisions 核心决策

1. The constrained layout system is an alternate-screen feature.
   受约束布局系统是备用屏幕（alternate-screen）专属特性。
2. `TuiMainScreen` keeps its existing terminal-scrollback rendering model.
   `TuiMainScreen` 保持其现有的终端回滚缓冲区（terminal-scrollback）渲染模型。
3. Interactive mode uses two different compositions, but shares the same component instances and behavior.
   交互模式使用两种不同的组合方式，但共享相同的组件实例与行为。
4. The public layout primitives are initially:
   公开的布局原语（layout primitives）最初包括：
   - `VStack`
   - `HStack`
   - `ScrollView`
   - existing overlays
     现有的浮层（overlays）
5. The frame-specific layout tree is internal. API users construct a component tree and never manipulate layout boxes, rectangles, hit-test nodes, or scroll ancestry.
   帧级布局树（layout tree）是内部实现。API 使用者只构建组件树，绝不直接操作布局盒（layout box）、矩形、命中测试（hit-test）节点或滚动祖先链。
6. Rebuild the internal layout tree on each requested render. Do not rebuild component state.
   每次请求渲染时重建内部布局树，但不要重建组件状态。
7. Rely on existing leaf render caches, especially `Markdown`, `Text`, `Image`, and `Box`. Do not introduce a second framework-level render cache initially.
   依赖现有的叶子组件渲染缓存，尤其是 `Markdown`、`Text`、`Image` 和 `Box`。初期不要再引入第二层框架级渲染缓存。
8. `Editor` does not currently cache its rendered lines, but it is small and active; this is not expected to be the dominant cost.
   `Editor` 目前不缓存其渲染行，但它体积小且处于活跃状态，预计不会成为主要性能开销。
9. Keep `interactive-mode.ts` changes declarative and minimal. Layout, clipping, scrolling, hit testing, and event routing belong in `packages/tui`.
   保持 `interactive-mode.ts` 的改动声明式且最小化。布局、裁剪（clipping）、滚动、命中测试和事件路由都应归属于 `packages/tui`。
10. Mouse wheel support is an enhancement. Configurable keyboard scrolling must always remain available.
    鼠标滚轮支持属于增强能力。可配置的键盘滚动必须始终保持可用。

## Why main-screen and alternate-screen layouts differ 为什么主屏幕与备用屏幕的布局不同

The terminal owns scrolling in main-screen mode. The application cannot reliably provide:
在主屏幕模式下，滚动由终端掌控。应用程序无法可靠地提供：

- sticky rows
  吸附行（sticky rows）
- independently scrollable nested regions
  可独立滚动的嵌套区域
- full-height side-by-side panes
  等高并排的面板（panes）
- reliable mouse hit testing for content moved into terminal scrollback
  对已进入终端回滚缓冲区的内容进行可靠的鼠标命中测试
- arbitrary repainting of off-screen regions without replaying or clearing scrollback
  在不重放或清空回滚缓冲区的情况下任意重绘屏幕外区域

Therefore, do not pretend the same constrained viewport semantics exist in `TuiMainScreen`.
因此，不要假装 `TuiMainScreen` 中存在同样的受约束视口（viewport）语义。

Main-screen interactive mode remains a vertically rendered document:
主屏幕交互模式仍然是一份垂直渲染的文档：

```text
header
loaded resources
chat
pending messages
status
widgets above
editor / replacement UI
widgets below
footer
```

Alternate-screen interactive mode becomes:
备用屏幕交互模式则变为：

```text
┌─────────────────────────────────────────────┐
│ scrollable transcript                       │
│                                             │
│ header                                      │
│ loaded resources                            │
│ chat/messages/tool output                   │
│                                             │
├─────────────────────────────────────────────┤
│ pending messages                            │
│ working/retry/compaction status             │
│ widgets above editor                        │
│ editor or temporary replacement UI          │
│ widgets below editor                        │
│ footer                                      │
└─────────────────────────────────────────────┘
```

Pending messages and status belong in the fixed region. Hiding active queue/working state while the user reads older output would be surprising.
待发送消息和状态属于固定区域。在用户阅读较早输出时隐藏活跃的队列/工作状态会让人意外。

## Goals 目标

### Required for the first implementation 首次实现的必需项

- Constrained root layout in `TuiAltScreen`.
  在 `TuiAltScreen` 中实现受约束的根布局。
- Vertical and horizontal stack layout.
  垂直与水平的栈式布局。
- Vertical scrolling with follow-end behavior.
  带跟随末尾（follow-end）行为的垂直滚动。
- Sticky coding-agent dock.
  吸附式的 coding-agent 底部停靠区（dock）。
- Existing mouse-wheel and keyboard transcript scrolling.
  现有的鼠标滚轮与键盘会话记录滚动。
- Wheel routing based on the region under the pointer.
  基于指针所在区域的滚轮事件路由。
- Scroll chaining for nested scroll views.
  嵌套滚动视图的滚动链式传递（scroll chaining）。
- Existing overlay rendering must continue to work.
  现有的浮层渲染必须继续正常工作。
- Existing cursor positioning and IME support must continue to work.
  现有的光标定位与输入法（IME）支持必须继续正常工作。
- Existing hyperlink clicking and mouse text selection must continue to work.
  现有的超链接点击与鼠标文本选择必须继续正常工作。
- Existing Kitty image behavior must not regress for the transcript use case.
  在会话记录场景中，现有的 Kitty 图片行为不得出现回退。
- `TuiMainScreen` behavior and output order must remain unchanged.
  `TuiMainScreen` 的行为与输出顺序必须保持不变。
- Leaving alt mode must still print a complete logical final document.
  退出备用屏幕模式时仍必须打印一份完整的逻辑最终文档。

### Future uses enabled by the design 该设计可支撑的未来用途

- Wide-terminal sidebars.
  宽终端下的侧边栏。
- Independently scrollable transcript and sidebar.
  可独立滚动的会话记录与侧边栏。
- Sticky top regions.
  吸附式顶部区域。
- Layout-aware overlays.
  感知布局的浮层。
- Scrollbars and unread-line indicators.
  滚动条与未读行指示器。
- Transcript virtualization.
  会话记录虚拟化渲染。

## Non-goals for the first implementation 首次实现的非目标

- CSS-compatible flexbox.
  与 CSS 兼容的弹性盒（flexbox）。
- Grid layout.
  网格布局。
- Wrapped flex rows.
  可换行的弹性行。
- Arbitrary absolute positioning; overlays already cover this need.
  任意的绝对定位；浮层已经覆盖了这一需求。
- Percentage sizing unless it falls out naturally from existing size utilities.
  百分比尺寸，除非它能从现有的尺寸工具中自然得出。
- Virtualized transcript rendering.
  会话记录的虚拟化渲染。
- Incremental layout-tree mutation.
  布局树的增量式变更。
- A public API for custom components to create or mutate internal layout nodes.
  供自定义组件创建或修改内部布局节点的公开 API。
- Reworking every existing component to understand height constraints.
  改造每一个现有组件使其理解高度约束。
- Giving main-screen mode fake sticky or nested-scroll semantics.
  为主屏幕模式赋予虚假的吸附或嵌套滚动语义。

## Public API 公开 API

### Stack entries 栈条目

Use one axis-neutral entry type for both vertical and horizontal stacks.
垂直栈与水平栈共用同一种与轴向无关（axis-neutral）的条目类型。

```ts
export interface StackEntryOptions {
	/** Initial size on the stack's main axis. Defaults to "auto". */
	basis?: number | "auto";
	/** Share of positive remaining space. Defaults to 0. */
	grow?: number;
	/** Relative willingness to shrink when content overflows. Defaults to 1. */
	shrink?: number;
	/** Minimum allocated size on the main axis. Defaults to 0. */
	minSize?: number;
	/** Maximum allocated size on the main axis. */
	maxSize?: number;
	/** Conditionally omit this entry for a viewport size. */
	visible?: (viewport: { width: number; height: number }) => boolean;
}

export interface StackEntry extends StackEntryOptions {
	component: Component;
}

export type StackChild = Component | StackEntry;

export interface StackOptions {
	gap?: number;
	align?: "stretch" | "start" | "center" | "end";
}
```

Use explicit fields in implementations. Do not use TypeScript parameter properties because root-configured source must remain erasable in Node strip-only mode.
在实现中使用显式字段。不要使用 TypeScript 的参数属性（parameter properties），因为根级配置的源码必须在 Node 的 strip-only 模式下保持可擦除（erasable）。

### `VStack`

```ts
export class VStack implements Component {
	constructor(children?: StackChild[], options?: StackOptions);

	addChild(component: Component, options?: StackEntryOptions): void;
	removeChild(component: Component): void;
	clear(): void;
	invalidate(): void;
	render(width: number): string[];
}
```

Behavior:
行为：

- Public `render(width)` provides an unbounded-height rendering for compatibility and debugging.
  公开的 `render(width)` 提供高度无界（unbounded-height）的渲染，用于兼容性与调试。
- Constrained behavior is invoked internally by `TuiAltScreen` through the internal layout engine.
  受约束的行为由 `TuiAltScreen` 通过内部布局引擎在内部调用。
- Children are arranged from top to bottom.
  子组件自上而下排列。
- `gap` rows appear only between visible children.
  `gap` 行仅出现在可见子组件之间。
- The cross axis defaults to `stretch`.
  交叉轴（cross axis）默认为 `stretch`。

### `HStack`

```ts
export class HStack implements Component {
	constructor(children?: StackChild[], options?: StackOptions);

	addChild(component: Component, options?: StackEntryOptions): void;
	removeChild(component: Component): void;
	clear(): void;
	invalidate(): void;
	render(width: number): string[];
}
```

Behavior:
行为：

- Children are arranged from left to right.
  子组件自左向右排列。
- Child widths are allocated from `basis`, `grow`, `shrink`, `minSize`, and `maxSize`.
  子组件宽度依据 `basis`、`grow`、`shrink`、`minSize` 和 `maxSize` 分配。
- Shorter children are padded according to `align`.
  较短的子组件按照 `align` 进行填充对齐。
- Compose ANSI lines using existing ANSI-aware slicing/compositing utilities. Never use plain string length or raw substring for terminal columns.
  使用现有的 ANSI 感知切片/合成工具来组合 ANSI 行。绝不要用普通字符串长度或原始 substring 来计算终端列。
- Initial image support only needs to preserve current vertical transcript behavior. See the image section for horizontal limitations.
  初期的图片支持只需保持当前垂直会话记录的行为。水平方向的限制参见图片章节。

### `ScrollView`

```ts
export interface ScrollViewOptions {
	axis?: "vertical";
	/** Follow content growth while positioned at the end. */
	follow?: "none" | "end";
	/** Designate this view as the fallback target for global scroll actions. */
	primary?: boolean;
	/** Bubble unused wheel delta to an outer scroll view. */
	overscroll?: "chain" | "contain";
	/** Reserved for a later visible scrollbar implementation. */
	scrollbar?: "hidden" | "auto" | "always";
}

export class ScrollView implements Component {
	constructor(component: Component, options?: ScrollViewOptions);

	get scrollTop(): number;
	get isFollowingEnd(): boolean;

	scrollBy(lines: number): number;
	scrollToStart(): void;
	scrollToEnd(): void;
	invalidate(): void;
	render(width: number): string[];
}
```

`scrollBy()` returns unused delta so nested scrolling can chain:
`scrollBy()` 返回未消耗的增量（delta），以便嵌套滚动能够链式传递：

```ts
const remaining = scrollView.scrollBy(delta);
```

Examples:
示例：

- Requested `+3`, moved `+3`: return `0`.
  请求 `+3`，实际移动 `+3`：返回 `0`。
- Requested `+3`, only one row remained: move one and return `+2`.
  请求 `+3`，但只剩一行可移动：移动一行并返回 `+2`。
- Requested `-3`, already at the top: return `-3`.
  请求 `-3`，但已位于顶部：返回 `-3`。

Behavior:
行为：

- In constrained layout, the child is measured/rendered at unbounded height and clipped to the allocated viewport.
  在受约束布局中，子组件以无界高度进行测量/渲染，然后裁剪到分配的视口内。
- In public unbounded `render(width)`, render the complete child. This is needed for final-document output and debugging, not to emulate viewport behavior in main-screen mode.
  在公开的无界 `render(width)` 中，渲染完整的子组件。这是最终文档输出与调试所需，而不是为了在主屏幕模式下模拟视口行为。
- `follow: "end"` behaves like current `TuiAltScreen.stickToBottom`:
  `follow: "end"` 的行为与当前的 `TuiAltScreen.stickToBottom` 一致：
  - start in follow mode
    初始处于跟随模式
  - content growth keeps the view at the end
    内容增长时视图保持在末尾
  - scrolling away from the end disables follow mode
    从末尾滚动离开会关闭跟随模式
  - reaching or explicitly scrolling to the end enables follow mode
    到达末尾或显式滚动到末尾会重新启用跟随模式
- Scrolling must request a render.
  滚动必须触发一次渲染请求。
- Preserve `scrollTop` when viewport height changes, unless following the end.
  视口高度变化时保持 `scrollTop` 不变，除非正处于跟随末尾状态。

### Viewport capability 视口能力

Do not add constrained layout methods to every `TUI` implementation as though main-screen mode supports them.
不要给每一个 `TUI` 实现都加上受约束布局方法，仿佛主屏幕模式也支持它们一样。

Add an explicit capability:
应新增一个显式的能力接口：

```ts
export interface ViewportTUI extends TUI {
	setLayoutRoot(component: Component | undefined): void;
}

export function isViewportTUI(tui: TUI): tui is ViewportTUI;
```

`TuiAltScreen` implements `ViewportTUI`. `TuiMainScreen` does not.
`TuiAltScreen` 实现 `ViewportTUI`，`TuiMainScreen` 则不实现。

The type guard should test a stable capability, not rely on application-level `instanceof`. The concrete implementation may use a symbol or method-presence check.
该类型守卫（type guard）应检测一项稳定的能力，而不是依赖应用层的 `instanceof`。具体实现可以采用 symbol 标记或方法存在性检查。

`TuiAltScreen` behavior when no explicit layout root is set must remain compatible with current users of `addChild()`. Treat its existing children as an implicit vertically stacked document in an implicit primary `ScrollView`.
当未设置显式布局根节点时，`TuiAltScreen` 的行为必须与当前使用 `addChild()` 的调用方保持兼容。应把它已有的子组件视为一份隐式的垂直堆叠文档，置于一个隐式的主 `ScrollView` 之中。

## Internal layout API 内部布局 API

Do not export these types from `packages/tui/src/index.ts`.
不要从 `packages/tui/src/index.ts` 导出这些类型。

Suggested module: `packages/tui/src/layout.ts`.
建议放置的模块：`packages/tui/src/layout.ts`。

```ts
interface LayoutConstraints {
	width: number;
	/** Undefined means unbounded height. */
	height: number | undefined;
}

interface LayoutRect {
	x: number;
	y: number;
	width: number;
	height: number;
}

interface LayoutBox {
	component: Component;
	rect: LayoutRect;
	clip: LayoutRect;
	children: LayoutBox[];
	parent?: LayoutBox;
	/** Leaf-rendered lines. Keep the returned array by reference. */
	lines?: readonly string[];
	/** Present when this box represents a ScrollView viewport. */
	scrollView?: ScrollView;
	/** Z/layer ordering for hit testing when needed. */
	layer: number;
}

interface LayoutFrame {
	root: LayoutBox;
	width: number;
	height: number;
	lines: string[];
	primaryScrollView?: ScrollView;
}
```

The exact shape may change during implementation, but it must support:
确切的结构在实现过程中可能会调整，但它必须支持：

- painting visible terminal rows
  绘制可见的终端行
- clipping nested children
  裁剪嵌套的子组件
- hit testing from terminal coordinates
  基于终端坐标进行命中测试
- translating to component-local coordinates
  转换为组件本地坐标
- walking ancestors
  遍历祖先节点
- identifying scroll ancestors
  识别滚动祖先节点
- locating cursor markers
  定位光标标记（cursor marker）
- retaining enough mapping for selection and hyperlinks
  保留足够的映射信息以支持文本选择与超链接

### Component tree versus layout tree 组件树与布局树的区别

The public component tree is long-lived and stateful:
公开的组件树是长期存在且有状态的：

```text
VStack
├─ ScrollView
│  └─ chat container
└─ dock VStack
   ├─ editor container
   └─ footer container
```

The internal layout tree is a transient frame snapshot:
内部布局树则是一份临时的帧快照：

```text
box root       rect 0,0,120,40
├─ scroll box  rect 0,0,120,31 clip 0,0,120,31
│  └─ content  rect 0,-85,120,116
└─ dock box    rect 0,31,120,9
```

Rebuild the layout tree for every requested frame. Replace the committed frame atomically after successful painting so input is always routed against the last displayed geometry.
每一次请求的帧都要重建布局树。绘制成功后再原子性地替换已提交的帧，从而保证输入始终依据最后一次显示的几何信息进行路由。

Do not mutate component state merely to generate layout geometry, except for intentional `ScrollView` clamping/follow state.
除了 `ScrollView` 有意为之的钳制（clamping）/跟随状态之外，不要仅仅为了生成布局几何而修改组件状态。

## Rendering and caching strategy 渲染与缓存策略

### Rebuild geometry, reuse leaf lines 重建几何信息，复用叶子行

A fresh frame performs:
一个全新帧执行如下流程：

```ts
const nextLayout = layout(root, terminalBounds);
const nextScreen = paint(nextLayout);
writeScreenDiff(previousScreen, nextScreen);
currentLayout = nextLayout;
```

For a leaf component:
对于叶子组件：

```ts
const lines = component.render(width);
```

Keep `lines` by reference in the layout box. Most expensive leaves already cache by content and width:
在布局盒中按引用保存 `lines`。大多数开销较大的叶子组件已经按内容和宽度做了缓存：

- `Markdown` caches text, width, and rendered lines.
  `Markdown` 缓存文本、宽度以及渲染后的行。
- `Text` caches text, width, and rendered lines.
  `Text` 缓存文本、宽度以及渲染后的行。
- `Image` caches width and rendered lines.
  `Image` 缓存宽度以及渲染后的行。
- `Box` caches based on width/background/child output.
  `Box` 基于宽度/背景/子组件输出进行缓存。
- several coding-agent animation and tool components have their own caches.
  若干 coding-agent 动画与工具组件拥有各自的缓存。

`Editor`, `Input`, selectors, footer, and some small leaves recompute. This is acceptable initially.
`Editor`、`Input`、各类选择器、页脚以及一些小型叶子组件会重新计算。初期这是可以接受的。

Do not add a separate `WeakMap<Component, RenderCache>` in the layout engine until profiling shows a need. A second cache risks becoming stale because existing components own their invalidation semantics.
在性能分析证明确有必要之前，不要在布局引擎中新增独立的 `WeakMap<Component, RenderCache>`。第二层缓存有变陈旧的风险，因为现有组件自行掌管其失效（invalidation）语义。

### Avoid unnecessary flattening where practical 在可行处避免不必要的扁平化

The first correct implementation may call existing `Container.render(width)`, which flattens child arrays. Markdown parsing/highlighting will still be cached, so this is acceptable for the initial implementation.
首个正确的实现可以直接调用现有的 `Container.render(width)`，它会把子组件数组扁平化。Markdown 的解析/高亮仍然会被缓存，因此这对初始实现来说是可以接受的。

If easy and safe, optimize exact base `Container` instances as structural vertical stacks so layout can retain child line arrays and heights without flattening the whole transcript. Do not bypass overridden rendering in `Container` subclasses such as message/tool components. Treat subclasses as leaves unless they explicitly opt into internal structural layout.
如果简单且安全，可将纯粹的基类 `Container` 实例优化为结构性垂直栈，使布局能够保留子组件的行数组与高度，而无需把整份会话记录扁平化。不要绕过消息/工具组件等 `Container` 子类中被重写的渲染逻辑。除非子类显式选择加入内部结构化布局，否则一律视其为叶子组件。

Do not make this optimization a prerequisite for correctness.
不要把这项优化当作保证正确性的前提条件。

### No render means no layout 没有渲染就没有布局

Only rebuild a layout frame after `requestRender()` schedules a render. There is no independent layout loop.
只有在 `requestRender()` 调度了一次渲染之后才重建布局帧。不存在独立的布局循环。

## Stack layout algorithm 栈布局算法

The implementation should use one shared stack allocator parameterized by axis.
实现应使用一个以轴向为参数的共享栈分配器（stack allocator）。

### Visibility 可见性

1. Evaluate `visible` against the terminal viewport dimensions.
   依据终端视口尺寸计算 `visible`。
2. Remove invisible entries before calculating gaps or size distribution.
   在计算间距或尺寸分配之前先移除不可见的条目。

### Intrinsic sizes 固有尺寸

- `basis: "auto"` uses the child's intrinsic size on the main axis.
  `basis: "auto"` 采用子组件在主轴上的固有尺寸。
- Numeric `basis` uses the given cell count.
  数值型 `basis` 采用给定的单元格数量。
- Clamp basis to `minSize`/`maxSize`.
  将 basis 钳制在 `minSize`/`maxSize` 之间。
- For wrapped leaves, width allocation must happen before intrinsic height is known.
  对于会换行的叶子组件，必须先完成宽度分配才能得知其固有高度。
- `HStack` therefore allocates widths before measuring child heights.
  因此 `HStack` 会先分配宽度，再测量子组件高度。
- `VStack` renders/measures auto-height children at the allocated width before distributing remaining height.
  `VStack` 会先按分配到的宽度渲染/测量自动高度的子组件，然后再分配剩余高度。

### Positive remaining space 正剩余空间

Distribute positive remaining space among entries with `grow > 0`, proportional to `grow`, respecting `maxSize`.
将正的剩余空间按 `grow` 比例分配给 `grow > 0` 的条目，并遵守 `maxSize` 限制。

Use deterministic integer rounding. Allocate leftover cells in child order so layouts do not jitter frame to frame.
使用确定性的整数取整。按子组件顺序分配余下的单元格，以免布局在帧与帧之间抖动。

### Overflow 溢出

When total basis exceeds available size:
当 basis 总和超出可用尺寸时：

1. Compute shrinkable entries (`shrink > 0` and current size above `minSize`).
   计算可收缩的条目（`shrink > 0` 且当前尺寸大于 `minSize`）。
2. Distribute required shrink proportional to `shrink` and current basis, or another deterministic documented policy.
   按 `shrink` 与当前 basis 的比例分摊所需的收缩量，或采用另一种确定且有文档记录的策略。
3. Repeat if an entry reaches `minSize` before overflow is resolved.
   若某个条目在溢出解决之前已达到 `minSize`，则重复上述过程。
4. If constraints still cannot be satisfied, clip at the parent boundary.
   如果约束仍无法满足，则在父级边界处进行裁剪。

A focused cursor must not disappear merely because a leaf is clipped. When clipping a leaf vertically and its lines contain `CURSOR_MARKER`, choose a visible line window containing the marker where possible.
不能仅仅因为叶子组件被裁剪就让处于焦点的光标消失。当垂直裁剪某个叶子组件且其行中包含 `CURSOR_MARKER` 时，应尽可能选取包含该标记的可见行窗口。

### Initial interactive layout sizing 初始交互式布局的尺寸设定

The transcript should be flexible and the dock should prefer intrinsic height:
会话记录区应具备弹性，而停靠区应优先采用固有高度：

```ts
new VStack([
	{
		component: transcriptScrollView,
		basis: 0,
		grow: 1,
		shrink: 1,
		minSize: 1,
	},
	{
		component: dock,
		basis: "auto",
		grow: 0,
		shrink: 1,
		minSize: 1,
	},
]);
```

The implementation must define sensible behavior for very small terminals and oversized custom widgets. Preferred priority:
实现必须为极小终端和超大自定义挂件定义合理的行为。优先级建议如下：

1. Preserve at least one transcript row when terminal height permits.
   在终端高度允许时，至少保留一行会话记录。
2. Preserve the focused editor/selector cursor.
   保留处于焦点的编辑器/选择器光标。
3. Preserve at least one footer row when possible.
   在可能的情况下至少保留一行页脚。
4. Clip/truncate widgets and pending/status content before hiding the focused editor.
   在隐藏处于焦点的编辑器之前，优先裁剪/截断挂件与待发送消息/状态内容。

This may require coding-agent-specific stack entry `minSize`/`shrink` settings rather than adding domain-specific priority rules to generic TUI layout.
这可能需要为 coding-agent 专门设置栈条目的 `minSize`/`shrink`，而不是把领域特定的优先级规则塞进通用的 TUI 布局中。

## Painting 绘制

### Frame surface 帧表面

The layout engine may continue using ANSI strings per terminal row rather than introducing a full cell object model.
布局引擎可以继续对每个终端行使用 ANSI 字符串，而不必引入完整的单元格对象模型。

Painting must:
绘制过程必须：

- create exactly `terminal.rows` base rows in constrained alt mode
  在受约束的备用屏幕模式下，恰好生成 `terminal.rows` 个基础行
- respect each box's rectangle and accumulated clip
  遵守每个布局盒的矩形与累积裁剪区域
- use ANSI-aware column slicing
  使用 ANSI 感知的列切片
- reset styles between independently painted regions
  在各自独立绘制的区域之间重置样式
- preserve `CURSOR_MARKER` until cursor extraction
  在提取光标之前保留 `CURSOR_MARKER`
- compose horizontal children without style leakage
  组合水平方向的子组件时不发生样式泄漏
- produce lines no wider than terminal width
  生成的行宽不超过终端宽度

Reuse:
复用以下工具：

- `sliceByColumn()`
- `compositeTuiLine()`
- `visibleWidth()`
- existing line-reset normalization
  现有的行重置归一化逻辑

### Vertical stacks 垂直栈

Paint each child at its allocated `y`. Skip children and line ranges that do not intersect the accumulated clip.
在各子组件分配到的 `y` 位置绘制它们。跳过与累积裁剪区域不相交的子组件和行区间。

### Horizontal stacks 水平栈

Paint each child at its allocated `x`. Pad short lines to the allocated width before composing adjacent children. Apply reset boundaries so one child's style or OSC 8 hyperlink does not leak into another.
在各子组件分配到的 `x` 位置绘制它们。在组合相邻子组件之前，将较短的行填充到分配宽度。设置重置边界，避免某个子组件的样式或 OSC 8 超链接泄漏到另一个子组件中。

### Scroll views 滚动视图

- Child content is laid out at its full natural height.
  子内容按其完整的自然高度进行布局。
- The child's painted origin is translated by `-scrollTop`.
  子组件的绘制原点按 `-scrollTop` 平移。
- Accumulate the scroll view's rectangle into the clip.
  将滚动视图的矩形累加进裁剪区域。
- Only paint child rows intersecting the viewport.
  只绘制与视口相交的子组件行。
- Record the scroll box in the layout tree for hit testing and ancestor walking.
  在布局树中记录该滚动盒，以便进行命中测试与祖先遍历。

## Input and event routing 输入与事件路由

### Normalized mouse events 规范化的鼠标事件

Keep terminal mouse parsing in `TuiAltScreen`, but convert parsed sequences into normalized events before routing:
终端鼠标序列的解析仍保留在 `TuiAltScreen` 中，但在路由之前先把解析出的序列转换为规范化事件：

```ts
interface TuiMouseEvent {
	type: "press" | "release" | "move" | "wheel";
	x: number;
	y: number;
	button: number;
	deltaX: number;
	deltaY: number;
}
```

The exact public visibility of this type is optional. The initial wheel router can remain internal.
该类型是否对外公开可自行决定。初期的滚轮路由器可以保持为内部实现。

### Hit testing 命中测试

Hit test the committed layout frame, not the frame currently being constructed.
针对已提交的布局帧进行命中测试，而不是正在构建中的帧。

1. Reject boxes outside their clip.
   排除位于自身裁剪区域之外的布局盒。
2. Traverse higher layers/frontmost children first.
   优先遍历更高层级/最前面的子组件。
3. Return the deepest visible box containing the terminal coordinate.
   返回包含该终端坐标的最深层可见布局盒。
4. Preserve the ancestor chain for event bubbling.
   保留祖先链以支持事件冒泡。

### Wheel routing 滚轮路由

For a wheel event:
对于一个滚轮事件：

1. Hit test at the pointer.
   在指针位置进行命中测试。
2. Starting at the deepest box, walk toward the root.
   从最深层的布局盒开始向根节点遍历。
3. Offer the delta to each encountered `ScrollView`.
   将增量依次交给沿途遇到的每个 `ScrollView`。
4. If `overscroll` is `"chain"`, pass unused delta to the next scroll ancestor.
   如果 `overscroll` 为 `"chain"`，则把未消耗的增量传递给下一个滚动祖先。
5. If `overscroll` is `"contain"`, stop even when delta remains.
   如果 `overscroll` 为 `"contain"`，即使仍有剩余增量也就此停止。
6. If no hit ancestor consumes the delta, offer it to the frame's primary scroll view.
   如果命中链上没有任何祖先消耗该增量，则将其交给该帧的主滚动视图。
7. Consume recognized mouse sequences so raw mouse bytes never reach the editor.
   消费掉已识别的鼠标序列，确保原始鼠标字节永远不会传到编辑器。

Expected behavior:
预期行为：

- Wheel over transcript: scroll transcript.
  滚轮位于会话记录上方：滚动会话记录。
- Wheel over a future sidebar: scroll sidebar.
  滚轮位于（未来的）侧边栏上方：滚动侧边栏。
- Wheel over a nested scroll view: scroll inner view, then chain at its boundary.
  滚轮位于嵌套滚动视图上方：先滚动内层视图，到达其边界后再链式传递。
- Wheel over non-scrollable dock/footer: scroll primary transcript.
  滚轮位于不可滚动的停靠区/页脚上方：滚动主会话记录。
- Wheel interaction must not steal keyboard focus from the editor.
  滚轮交互不得从编辑器抢走键盘焦点。

### Trackpads 触控板

Preserve current behavior of ignoring horizontal wheel events for a vertical-only scroll view. If an event contains both axes, consume only the supported vertical portion and document the policy.
对于仅支持垂直方向的滚动视图，保持当前忽略水平滚轮事件的行为。如果某个事件同时包含两个轴向，只消费受支持的垂直部分，并将该策略写入文档。

### Mouse-disabled fallback 鼠标不可用时的回退方案

Do not depend on detecting mouse support. Terminals do not provide a sufficiently reliable universal capability signal.
不要依赖对鼠标支持能力的探测。终端并未提供足够可靠的通用能力信号。

Keyboard navigation is always available through existing configurable actions:
键盘导航始终可通过现有的可配置操作使用：

- `tui.altScreen.pageUp`
- `tui.altScreen.pageDown`
- `tui.altScreen.top`
- `tui.altScreen.bottom`

Route these actions to:
将这些操作路由到：

1. an explicitly active scroll region, if future multi-pane navigation sets one
   显式处于活动状态的滚动区域（如果未来的多面板导航设置了这样的区域）
2. otherwise the primary scroll view
   否则路由到主滚动视图

For the first coding-agent layout there is only one scroll view, so the transcript is always the keyboard target.
在首版 coding-agent 布局中只有一个滚动视图，因此会话记录始终是键盘操作的目标。

If future layouts introduce multiple keyboard-selectable scroll regions, add configurable actions to `TUI_KEYBINDINGS`; never hardcode key checks.
如果未来的布局引入了多个可用键盘选择的滚动区域，请向 `TUI_KEYBINDINGS` 添加可配置操作；绝不要硬编码按键判断。

## Focus and cursor behavior 焦点与光标行为

- Existing `TUI.setFocus(component)` remains the public keyboard-focus API.
  现有的 `TUI.setFocus(component)` 仍然是公开的键盘焦点 API。
- Keyboard focus and wheel-scroll target are separate. Scrolling a sidebar must not move focus away from the editor unless explicitly requested.
  键盘焦点与滚轮滚动目标是分离的。除非显式要求，滚动侧边栏不得把焦点从编辑器移走。
- During paint, find `CURSOR_MARKER` in the final composited frame.
  在绘制过程中，于最终合成的帧里查找 `CURSOR_MARKER`。
- Cursor row/column must include stack offsets, scroll translations, overlay offsets, and horizontal-pane offsets.
  光标的行/列必须计入栈偏移、滚动平移、浮层偏移以及水平面板偏移。
- Only show the hardware cursor according to existing `showHardwareCursor` behavior.
  仅按照现有的 `showHardwareCursor` 行为显示硬件光标。
- Layout containment checks used by overlay focus restoration must understand layout roots and nested layout components.
  用于浮层焦点恢复的布局包含关系检查必须能够理解布局根节点与嵌套的布局组件。

## Selection and hyperlinks 文本选择与超链接

The current alt renderer maps selection rows directly into one global logical document. That assumption no longer holds once fixed and horizontal regions exist.
当前的备用屏幕渲染器把选区行直接映射到一份全局逻辑文档上。一旦存在固定区域和水平区域，这个假设就不再成立。

For the first implementation, preserve visible-screen selection semantics:
首次实现应保留基于可见屏幕的选择语义：

- Anchor and focus begin from terminal-screen coordinates.
  选区锚点（anchor）与焦点（focus）都从终端屏幕坐标出发。
- Apply highlight against the current committed visible frame.
  针对当前已提交的可见帧应用高亮。
- Copy text from the selected visible rows/columns using ANSI-aware slicing and `stripTerminalSequences()`.
  使用 ANSI 感知的切片和 `stripTerminalSequences()` 从选中的可见行/列中复制文本。
- Blank/padded areas contribute no text beyond required line separation.
  空白/填充区域除必要的换行分隔外不贡献任何文本。
- Continue snapping selection columns to grapheme boundaries.
  继续将选区列对齐到字素簇（grapheme）边界。

If maintaining selection across frame changes is required, store enough source mapping in painted rows to translate screen rows into leaf line references. Do not map fixed dock rows to unrelated transcript rows.
如果需要在帧变化之间保持选区，则应在绘制的行中存储足够的来源映射，以便把屏幕行转换为叶子行引用。不要把固定停靠区的行映射到无关的会话记录行上。

Hyperlink clicking can continue reading OSC 8 metadata from the committed screen line at the clicked column. Ensure the final composed line, rather than an unshifted child line, is used.
超链接点击可以继续从已提交屏幕行的被点击列读取 OSC 8 元数据。务必使用最终合成后的行，而不是未经偏移的子组件行。

Maintain current behavior:
保持当前行为：

- click without drag may call `openUrl`
  未拖动的点击可以调用 `openUrl`
- dragging does not activate a URL
  拖动不会激活 URL
- release after drag copies via OSC 52
  拖动后松开鼠标会通过 OSC 52 复制内容

## Images 图片

The initial required image case is the existing vertically scrolling transcript.
初期必须支持的图片场景是现有的垂直滚动会话记录。

Preserve:
需要保留：

- Kitty image metadata and reserved rows
  Kitty 图片的元数据与预留行
- cropping when the top of a Kitty image is above the scroll viewport
  当 Kitty 图片顶部位于滚动视口之上时的裁剪处理
- deletion/redraw when image-containing rows change
  含图片的行发生变化时的删除/重绘
- iTerm2 fallback to text in alt mode
  备用屏幕模式下 iTerm2 回退为文本

Horizontal composition of image protocol lines is not required to become fully general in the first implementation. Terminal image placements do not behave like ordinary ANSI text. Document and defensively handle the limitation:
首次实现无需让图片协议行的水平组合完全通用。终端中的图片放置行为与普通 ANSI 文本并不相同。请记录该限制并做防御性处理：

- an image-bearing component in an `HStack` may be required to occupy the full row/width
  `HStack` 中承载图片的组件可以被要求独占整行/整个宽度
- do not silently corrupt adjacent pane output
  不要静默地破坏相邻面板的输出
- add a focused test for whatever fallback policy is chosen
  为所选定的回退策略补充一个针对性的测试

Do not regress existing vertical image tests.
不得使现有的垂直图片测试出现回退。

## Overlays 浮层

Keep the current overlay stack and positioning API.
保留当前的浮层栈与定位 API。

Initial integration:
初步集成方式：

1. Paint the base constrained layout into terminal-height lines.
   将受约束的基础布局绘制成终端高度的行集合。
2. Composite existing overlays over those lines using current overlay logic.
   使用现有的浮层逻辑把已有浮层合成到这些行之上。
3. Extract the cursor from the final result.
   从最终结果中提取光标位置。
4. Apply differential rendering.
   应用差分渲染。

Existing overlays are not required to become nested `ScrollView` layout roots in the first implementation. However, base-layout hit testing must not break overlay focus or input ownership.
首次实现不要求把现有浮层改造成嵌套的 `ScrollView` 布局根节点。但基础布局的命中测试不得破坏浮层的焦点或输入归属。

A later phase can give each overlay its own constrained layout tree and include overlay boxes as higher hit-test layers.
后续阶段可以为每个浮层配备各自的受约束布局树，并将浮层布局盒作为更高的命中测试层级纳入。

## `TuiAltScreen` refactor `TuiAltScreen` 重构

Suggested state after the change:
改动后建议的状态字段：

```ts
private layoutRoot?: Component;
private currentLayout?: LayoutFrame;
private implicitScrollView?: ScrollView;
```

Move these responsibilities out of `TuiAltScreen` global fields and into `ScrollView` where applicable:
在适用的情况下，把以下职责从 `TuiAltScreen` 的全局字段迁移到 `ScrollView` 中：

- `scrollTop`
- `contentLineCount`
- `stickToBottom`

Compatibility getters/methods such as `viewportTop`, `isFollowingOutput`, `scrollBy()`, `scrollToTop()`, and `scrollToBottom()` may delegate to the primary/implicit scroll view so existing tests and consumers continue to work. Do not preserve backward compatibility if it materially complicates the implementation unless tests/public API indicate these methods are relied upon; check exports and usage before removal.
`viewportTop`、`isFollowingOutput`、`scrollBy()`、`scrollToTop()` 和 `scrollToBottom()` 等兼容性 getter/方法可以委托给主/隐式滚动视图，使既有测试与调用方继续可用。若保持向后兼容会显著增加实现复杂度，则不必强行保留，除非测试/公开 API 表明这些方法确实被依赖；移除前请先检查导出与使用情况。

`doRender()` becomes conceptually:
`doRender()` 在概念上变为：

```ts
const root = this.layoutRoot ?? this.getImplicitLegacyRoot();
const nextLayout = layoutConstrained(root, width, height);
let screen = paint(nextLayout);
screen = this.compositeOverlays(screen, width, height);
screen = this.applySelection(screen);
const cursor = this.extractCursorPosition(screen, height);
// Normalize, crop defensive overflow, diff, write.
this.currentLayout = nextLayout;
```

### Legacy implicit root 遗留的隐式根节点

When callers only use `tui.addChild()`:
当调用方仅使用 `tui.addChild()` 时：

```text
implicit ScrollView(primary, follow=end)
└─ implicit vertical document of TuiAltScreen.children
```

This preserves the current standalone `TuiAltScreen` API and tests.
这样可以保留当前独立使用 `TuiAltScreen` 的 API 与测试。

The implicit root must observe subsequent `addChild()`, `removeChild()`, and `clear()` mutations.
隐式根节点必须能够感知后续的 `addChild()`、`removeChild()` 和 `clear()` 变更。

### Final document on stop 停止时的最终文档

When leaving alt mode, render the explicit or implicit root with unbounded height:
退出备用屏幕模式时，以无界高度渲染显式或隐式根节点：

- `ScrollView` emits its complete child rather than a clipped viewport.
  `ScrollView` 输出其完整的子内容，而不是被裁剪的视口。
- The coding-agent transcript appears first and the dock appears once after it.
  coding-agent 的会话记录排在前面，停靠区在其后出现一次。
- Do not print terminal-height padding rows.
  不要打印用于补足终端高度的填充行。
- Strip cursor markers.
  去除光标标记。
- Preserve existing line resets and image cleanup.
  保留现有的行重置与图片清理逻辑。

Do not use only the last visible frame as the exit document.
不要仅把最后一帧可见画面当作退出文档。

## Interactive-mode changes 交互模式的改动

File: `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
文件：`packages/coding-agent/src/modes/interactive/interactive-mode.ts`

Changes should remain small.
改动应保持小规模。

### Add stable grouping containers 新增稳定的分组容器

```ts
private documentContainer: Container;
private footerContainer: Container;
```

The existing component containers remain unchanged:
现有的组件容器保持不变：

- `headerContainer`
- `loadedResourcesContainer`
- `chatContainer`
- `pendingMessagesContainer`
- `statusContainer`
- `widgetContainerAbove`
- `editorContainer`
- `widgetContainerBelow`

Build the transcript group once:
只构建一次会话记录分组：

```ts
this.documentContainer.addChild(this.headerContainer);
this.documentContainer.addChild(this.loadedResourcesContainer);
this.documentContainer.addChild(this.chatContainer);
```

Build the footer slot once:
只构建一次页脚插槽：

```ts
this.footerContainer.addChild(this.footer);
```

### Main-screen composition 主屏幕组合方式

Preserve exact current ordering:
严格保持当前的顺序：

```ts
this.ui.addChild(this.documentContainer);
this.ui.addChild(this.pendingMessagesContainer);
this.ui.addChild(this.statusContainer);
this.ui.addChild(this.widgetContainerAbove);
this.ui.addChild(this.editorContainer);
this.ui.addChild(this.widgetContainerBelow);
this.ui.addChild(this.footerContainer);
```

Because `documentContainer` is visually transparent, its three children render exactly where they do today.
由于 `documentContainer` 在视觉上是透明的，它的三个子组件会渲染在与今天完全相同的位置。

### Alternate-screen composition 备用屏幕组合方式

```ts
const transcript = new ScrollView(this.documentContainer, {
	follow: "end",
	primary: true,
	overscroll: "chain",
});

const dock = new VStack([
	{ component: this.pendingMessagesContainer, shrink: 1, minSize: 0 },
	{ component: this.statusContainer, shrink: 1, minSize: 0 },
	{ component: this.widgetContainerAbove, shrink: 1, minSize: 0 },
	{ component: this.editorContainer, shrink: 1, minSize: 3 },
	{ component: this.widgetContainerBelow, shrink: 1, minSize: 0 },
	{ component: this.footerContainer, shrink: 1, minSize: 1 },
]);

const root = new VStack([
	{ component: transcript, basis: 0, grow: 1, shrink: 1, minSize: 1 },
	{ component: dock, basis: "auto", grow: 0, shrink: 1, minSize: 1 },
]);

viewportTui.setLayoutRoot(root);
```

Use `isViewportTUI(this.ui)` for narrowing. Since `options.alt` selected the renderer, failure to obtain the capability is an internal programming error rather than a silent fallback.
使用 `isViewportTUI(this.ui)` 进行类型收窄。由于渲染器是由 `options.alt` 选定的，无法获取该能力属于内部编程错误，而不应静默回退。

### Custom footer replacement 自定义页脚替换

Refactor `setExtensionFooter()` so it never removes/adds root TUI children:
重构 `setExtensionFooter()`，使其永不移除/新增 TUI 根级子组件：

```ts
this.footerContainer.clear();
this.footerContainer.addChild(this.customFooter ?? this.footer);
this.ui.requestRender();
```

Continue disposing replaced custom footers.
继续对被替换掉的自定义页脚执行释放（dispose）。

### Features that should require no logic changes 无需改动逻辑的功能

- message rendering
  消息渲染
- streaming updates
  流式更新
- tool updates
  工具调用更新
- widget APIs
  挂件 API
- editor replacement
  编辑器替换
- extension selectors/input/editor
  扩展提供的选择器/输入框/编辑器
- built-in selectors
  内置选择器
- queue rendering
  队列渲染
- status indicators
  状态指示器
- focus changes
  焦点切换
- overlays
  浮层
- theme invalidation
  主题失效刷新

These features mutate existing stable containers and should automatically appear in the correct layout.
这些功能都是修改现有的稳定容器，应当会自动出现在正确的布局位置上。

### Existing alt-specific status workaround 现有的备用屏幕专属状态变通处理

Revisit this code:
重新审视这段代码：

```ts
if (hadActiveStatusIndicator && !this.options.alt && this.ui.getClearOnShrink()) {
	this.statusContainer.addChild(this.idleStatus);
}
```

The main-screen workaround should remain main-screen-only. Constrained alt layout should naturally clear released rows.
该主屏幕变通处理应仅限主屏幕使用。受约束的备用屏幕布局本就应当自然地清理被释放的行。

## Suggested files 建议涉及的文件

Likely new files:
可能新增的文件：

- `packages/tui/src/layout.ts` — internal constraints, boxes, layout, paint, hit testing
  `packages/tui/src/layout.ts` — 内部约束、布局盒、布局计算、绘制与命中测试
- `packages/tui/src/components/v-stack.ts`
- `packages/tui/src/components/h-stack.ts`
- `packages/tui/src/components/scroll-view.ts`

Likely modified files:
可能修改的文件：

- `packages/tui/src/tui.ts`
- `packages/tui/src/TuiAltScreen.ts`
- `packages/tui/src/index.ts`
- `packages/tui/src/keybindings.ts` only if new configurable actions are required
  `packages/tui/src/keybindings.ts`，仅在需要新增可配置操作时修改
- `packages/coding-agent/src/modes/interactive/interactive-mode.ts`
- `packages/tui/test/tui-alt-screen.test.ts`
- new focused layout tests under `packages/tui/test/`
  在 `packages/tui/test/` 下新增针对性的布局测试
- `packages/coding-agent/test/interactive-tui.test.ts`
- `packages/tui/README.md`
- `packages/coding-agent/docs/usage.md`
- `packages/coding-agent/docs/keybindings.md` if keyboard behavior changes
  `packages/coding-agent/docs/keybindings.md`，如果键盘行为发生变化
- `packages/tui/CHANGELOG.md`
- `packages/coding-agent/CHANGELOG.md`

Do not modify released changelog sections. Add entries under the existing `## [Unreleased]` subsections.
不要修改已发布的更新日志章节。请把条目添加到现有的 `## [Unreleased]` 子章节下。

## Test plan 测试计划

### Stack allocation tests 栈分配测试

Add focused unit tests for both axes:
为两个轴向分别添加针对性的单元测试：

- auto-sized children
  自动尺寸的子组件
- numeric basis
  数值型 basis
- positive grow distribution
  正向 grow 空间分配
- shrink distribution
  shrink 收缩量分配
- min/max clamping
  最小/最大值钳制
- deterministic odd-cell rounding
  奇数单元格的确定性取整
- gaps only between visible children
  间距仅出现在可见子组件之间
- conditional visibility
  条件可见性
- cross-axis alignment
  交叉轴对齐
- child output wider than allocation is clipped safely
  子组件输出宽度超过分配值时能被安全裁剪
- ANSI styles/hyperlinks do not leak between horizontal children
  ANSI 样式/超链接不会在水平子组件之间泄漏
- CJK, emoji, and combining-character boundaries in horizontal clipping
  水平裁剪中的中日韩字符、表情符号与组合字符边界处理

### ScrollView tests ScrollView 测试

- initial `follow: "end"` position
  `follow: "end"` 的初始位置
- content growth while following
  跟随状态下内容增长
- manual upward scroll disables follow
  手动向上滚动会关闭跟随
- reaching bottom reenables follow
  到达底部会重新启用跟随
- explicit `scrollToEnd()` reenables follow
  显式调用 `scrollToEnd()` 会重新启用跟随
- viewport growth/shrink while following
  跟随状态下视口增大/缩小
- viewport growth/shrink while manually positioned
  手动定位状态下视口增大/缩小
- `scrollBy()` returns unused positive/negative delta
  `scrollBy()` 返回未消耗的正/负增量
- nested scroll chaining
  嵌套滚动的链式传递
- `overscroll: "contain"`
- child shorter than viewport
  子内容短于视口
- empty child
  空的子内容
- child width change
  子组件宽度变化
- cursor marker remains visible when focused content is clipped
  焦点内容被裁剪时光标标记仍然可见

### Layout frame tests 布局帧测试

- generated rectangles for nested V/H stacks
  嵌套垂直/水平栈生成的矩形
- accumulated clipping
  累积裁剪
- hit testing returns deepest visible box
  命中测试返回最深层的可见布局盒
- clipped boxes are not hit-testable
  被裁剪掉的布局盒不可被命中
- local coordinate translation
  本地坐标转换
- layer ordering
  层级排序
- only visible rows are painted from a scroll view
  滚动视图只绘制可见行
- each frame uses fresh geometry after resize/content change
  尺寸调整/内容变化后每一帧都使用全新的几何信息
- cached leaf line arrays are accepted by reference and not mutated
  缓存的叶子行数组按引用接收且不被修改

### Alternate-screen renderer tests 备用屏幕渲染器测试

Extend `packages/tui/test/tui-alt-screen.test.ts`:
扩展 `packages/tui/test/tui-alt-screen.test.ts`：

- legacy `addChild()` path still behaves as current implicit scrolling
  遗留的 `addChild()` 路径仍保持当前的隐式滚动行为
- explicit layout root renders terminal-height frame
  显式布局根节点渲染出终端高度的帧
- fixed dock remains unchanged while transcript scrolls
  会话记录滚动时固定停靠区保持不变
- transcript viewport height accounts for dock height
  会话记录视口高度已扣除停靠区高度
- dock growth/shrink while following
  跟随状态下停靠区增高/缩小
- dock growth/shrink while manually scrolled
  手动滚动状态下停靠区增高/缩小
- Shift+PageUp/Down targets primary ScrollView
  Shift+PageUp/Down 作用于主 ScrollView
- Ctrl+Home/End targets primary ScrollView
  Ctrl+Home/End 作用于主 ScrollView
- wheel over transcript scrolls transcript
  滚轮位于会话记录上方时滚动会话记录
- wheel over non-scrollable dock falls back to primary transcript
  滚轮位于不可滚动的停靠区上方时回退到滚动主会话记录
- nested scroll consumes first and bubbles unused delta
  嵌套滚动优先消费，并把未用完的增量向上冒泡
- mouse-disabled mode still supports keyboard scrolling
  鼠标禁用模式下仍支持键盘滚动
- cursor row is correct inside dock
  停靠区内的光标行位置正确
- cursor row is correct inside scrolled content
  已滚动内容中的光标行位置正确
- overlay compositing remains screen-relative
  浮层合成仍然基于屏幕坐标
- overlay focus behavior remains correct
  浮层焦点行为保持正确
- OSC 8 click remains correct after horizontal/vertical offsets
  在水平/垂直偏移后 OSC 8 点击仍然正确
- selection/copy works in transcript
  会话记录中的选择/复制正常工作
- selection/copy works in dock without mapping to transcript rows
  停靠区中的选择/复制正常工作且不会映射到会话记录行
- terminal resize recomputes layout
  终端尺寸变化会重新计算布局
- oversized dock does not lose the focused cursor
  超大停靠区不会丢失处于焦点的光标
- stopping prints complete transcript plus dock exactly once
  停止时恰好打印一次完整的会话记录加停靠区
- no terminal padding rows in final output
  最终输出中不包含终端填充行

Retain and pass all existing image tests:
保留并通过所有现有的图片测试：

- Kitty cropping at viewport top
  视口顶部的 Kitty 图片裁剪
- image deletion/redraw
  图片删除/重绘
- iTerm2 fallback
  iTerm2 回退处理
- no stale image placements
  不残留过期的图片放置

### Main-screen regression tests 主屏幕回归测试

- existing main-screen tests pass unchanged
  现有主屏幕测试无需改动即可通过
- interactive main-screen child order/rendered output is unchanged
  交互式主屏幕的子组件顺序/渲染输出保持不变
- custom footer remains at the bottom in flow
  自定义页脚在文档流中仍位于底部
- no layout root or application scrolling is installed in main-screen mode
  主屏幕模式下不会安装布局根节点或应用级滚动

### Coding-agent integration tests coding-agent 集成测试

In `packages/coding-agent/test/interactive-tui.test.ts` or a focused new test:
在 `packages/coding-agent/test/interactive-tui.test.ts` 或一个新的针对性测试中：

- renderer capability is exposed only for alt mode
  渲染器能力仅在备用屏幕模式下暴露
- main mode mounts flow composition
  主屏幕模式挂载文档流式组合
- alt mode mounts transcript ScrollView plus dock
  备用屏幕模式挂载会话记录 ScrollView 加停靠区
- pending/status/widgets/editor/footer are in the dock
  待发送消息/状态/挂件/编辑器/页脚都位于停靠区内
- custom footer replacement updates `footerContainer`
  自定义页脚替换会更新 `footerContainer`
- editor replacement does not rebuild the root layout
  编辑器替换不会重建根布局
- widget updates do not rebuild the public component composition
  挂件更新不会重建公开的组件组合结构

Prefer inspecting component composition or using `VirtualTerminal`; do not use real provider APIs.
优先通过检查组件组合结构或使用 `VirtualTerminal` 进行测试；不要调用真实的服务商 API。

## Verification commands 验证命令

After implementation changes:
完成实现改动之后：

1. Run each modified/new focused test from the relevant package root using the repository-prescribed Vitest invocation.
   在相关包的根目录下，使用仓库规定的 Vitest 调用方式运行每一个被修改/新增的针对性测试。
2. Run `npm run check` from the repository root and fix all errors, warnings, and infos.
   在仓库根目录运行 `npm run check`，并修复所有 error、warning 与 info。
3. Do not run `npm test` or the full Vitest suite.
   不要运行 `npm test` 或完整的 Vitest 测试套件。
4. Optionally use the repository's `./test.sh` for all non-e2e tests if broader validation is warranted.
   如需更大范围的验证，可选择使用仓库的 `./test.sh` 运行所有非端到端测试。
5. Manually exercise alt mode in tmux using the procedure in `AGENTS.md`:
   按照 `AGENTS.md` 中的流程，在 tmux 中手动验证备用屏幕模式：
   - long transcript
     长会话记录
   - wheel/trackpad scrolling
     滚轮/触控板滚动
   - Shift+PageUp/Down
   - streaming while manually scrolled
     手动滚动状态下的流式输出
   - return to bottom/follow
     返回底部/恢复跟随
   - multiline editor
     多行编辑器
   - autocomplete open
     打开自动补全
   - settings/model/tree selectors replacing editor
     设置/模型/文件树选择器替换编辑器
   - extension widget above and below editor
     编辑器上方与下方的扩展挂件
   - custom footer
     自定义页脚
   - terminal resize
     终端尺寸调整
   - hyperlink click
     超链接点击
   - mouse selection/copy
     鼠标选择/复制
   - Kitty image where available
     在支持的环境中测试 Kitty 图片
6. Manually smoke-test main-screen mode to ensure terminal scrollback behavior is unchanged.
   手动冒烟测试主屏幕模式，确认终端回滚缓冲区行为未发生变化。

## Recommended implementation order 建议的实现顺序

1. Add stack allocation unit tests and shared axis allocator.
   添加栈分配单元测试与共享的轴向分配器。
2. Implement `VStack` unbounded rendering and constrained internal layout.
   实现 `VStack` 的无界渲染与受约束的内部布局。
3. Implement `HStack` with ANSI-safe composition.
   实现具备 ANSI 安全组合能力的 `HStack`。
4. Implement `ScrollView` state and unit tests independent of terminal ANSI output.
   实现 `ScrollView` 的状态管理，并编写不依赖终端 ANSI 输出的单元测试。
5. Implement internal layout frame generation and painting.
   实现内部布局帧的生成与绘制。
6. Add hit testing and scroll-ancestor traversal.
   添加命中测试与滚动祖先遍历。
7. Integrate explicit and implicit layout roots into `TuiAltScreen`.
   将显式与隐式布局根节点集成到 `TuiAltScreen` 中。
8. Move current global alt scrolling behavior behind the implicit primary `ScrollView` compatibility path.
   把当前全局的备用屏幕滚动行为迁移到隐式主 `ScrollView` 的兼容路径之后。
9. Preserve selection, hyperlinks, cursor, overlays, and image handling one subsystem at a time, running existing tests after each step.
   逐个子系统地保留文本选择、超链接、光标、浮层与图片处理，每完成一步都运行现有测试。
10. Add coding-agent grouping containers and the two small composition branches.
    添加 coding-agent 的分组容器以及两条小规模的组合分支。
11. Refactor custom footer replacement to use `footerContainer`.
    重构自定义页脚替换逻辑，改用 `footerContainer`。
12. Add integration tests, docs, and changelog entries.
    补充集成测试、文档与更新日志条目。
13. Run focused tests and `npm run check`.
    运行针对性测试与 `npm run check`。
14. Perform tmux/manual smoke tests in both modes.
    在两种模式下进行 tmux/手动冒烟测试。

## Acceptance criteria 验收标准

The implementation is complete when:
当满足以下条件时，实现即视为完成：

- Main-screen mode behaves as before and preserves terminal scrollback.
  主屏幕模式行为与之前一致，并保留终端回滚缓冲区。
- Alt-screen mode has a scrollable transcript and fixed bottom dock.
  备用屏幕模式拥有可滚动的会话记录和固定的底部停靠区。
- Streaming follows the transcript end only while follow mode is active.
  仅在跟随模式激活时，流式输出才会跟随会话记录末尾。
- Manual scrolling remains stable while new output arrives.
  新输出到达时手动滚动位置保持稳定。
- Mouse wheel routes to the appropriate scroll view and chains at boundaries.
  鼠标滚轮能路由到合适的滚动视图，并在边界处链式传递。
- Keyboard navigation works with mouse disabled.
  在鼠标禁用的情况下键盘导航仍可用。
- Editor/selector focus and IME cursor placement remain correct.
  编辑器/选择器的焦点与输入法光标定位保持正确。
- Widgets and custom footers remain extension-compatible and fixed in alt mode.
  挂件与自定义页脚保持与扩展兼容，并在备用屏幕模式下固定显示。
- Hyperlinks, selection, overlays, and Kitty transcript images do not regress.
  超链接、文本选择、浮层以及会话记录中的 Kitty 图片均无功能回退。
- Leaving alt mode prints the complete logical document once.
  退出备用屏幕模式时完整打印一次逻辑文档。
- Layout boxes are internal and rebuilt per requested frame.
  布局盒属于内部实现，并按每次请求的帧重建。
- Expensive leaf rendering continues to use existing component caches.
  开销较大的叶子渲染继续复用现有的组件缓存。
- All focused tests and `npm run check` pass.
  所有针对性测试与 `npm run check` 全部通过。
