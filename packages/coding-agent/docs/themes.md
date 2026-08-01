> pi can create themes. Ask it to build one for your setup.
>
> pi 可以创建主题（theme）。你可以让它为你的环境定制一个。

# Themes 主题

Themes are JSON files that define colors for the TUI.

主题是用于定义 TUI 配色的 JSON 文件。

## Table of Contents 目录

- [Locations](#locations)
  位置
- [Selecting a Theme](#selecting-a-theme)
  选择主题
- [Creating a Custom Theme](#creating-a-custom-theme)
  创建自定义主题
- [Theme Format](#theme-format)
  主题格式
- [Color Tokens](#color-tokens)
  颜色令牌
- [Color Values](#color-values)
  颜色取值
- [Tips](#tips)
  技巧

## Locations 位置

Pi loads themes from:

Pi 会从以下位置加载主题：

- Built-in: `dark`, `light`
  内置：`dark`、`light`
- Global: `~/.pi/agent/themes/*.json`
  全局：`~/.pi/agent/themes/*.json`
- Project: `.pi/themes/*.json` (only after the project is trusted)
  项目级：`.pi/themes/*.json`（仅在项目被信任后生效）
- Packages: `themes/` directories or `pi.themes` entries in `package.json`
  包：`themes/` 目录，或 `package.json` 中的 `pi.themes` 条目
- Settings: `themes` array with files or directories
  设置：`themes` 数组，可包含文件或目录
- CLI: `--theme <path>` (repeatable)
  CLI：`--theme <path>`（可重复指定）

Disable discovery with `--no-themes`.

使用 `--no-themes` 可禁用自动发现。

## Selecting a Theme 选择主题

Select a theme via `/settings` or in `settings.json`:

可通过 `/settings` 或在 `settings.json` 中选择主题：

```json
{
  "theme": "my-theme"
}
```

On first run, pi detects your terminal background and defaults to `dark` or `light`.

首次运行时，pi 会检测终端背景色，并默认使用 `dark` 或 `light`。

## Creating a Custom Theme 创建自定义主题

1. Create a theme file:
   创建一个主题文件：

```bash
mkdir -p ~/.pi/agent/themes
vim ~/.pi/agent/themes/my-theme.json
```

2. Define the theme with all required colors (see [Color Tokens](#color-tokens)):
   定义主题并提供所有必需的颜色（参见 [Color Tokens](#color-tokens) 颜色令牌）：

```json
{
  "$schema": "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  "name": "my-theme",
  "vars": {
    "primary": "#00aaff",
    "secondary": 242
  },
  "colors": {
    "accent": "primary",
    "border": "primary",
    "borderAccent": "#00ffff",
    "borderMuted": "secondary",
    "success": "#00ff00",
    "error": "#ff0000",
    "warning": "#ffff00",
    "muted": "secondary",
    "dim": 240,
    "text": "",
    "thinkingText": "secondary",
    "selectedBg": "#2d2d30",
    "userMessageBg": "#2d2d30",
    "userMessageText": "",
    "customMessageBg": "#2d2d30",
    "customMessageText": "",
    "customMessageLabel": "primary",
    "toolPendingBg": "#1e1e2e",
    "toolSuccessBg": "#1e2e1e",
    "toolErrorBg": "#2e1e1e",
    "toolTitle": "primary",
    "toolOutput": "",
    "mdHeading": "#ffaa00",
    "mdLink": "primary",
    "mdLinkUrl": "secondary",
    "mdCode": "#00ffff",
    "mdCodeBlock": "",
    "mdCodeBlockBorder": "secondary",
    "mdQuote": "secondary",
    "mdQuoteBorder": "secondary",
    "mdHr": "secondary",
    "mdListBullet": "#00ffff",
    "toolDiffAdded": "#00ff00",
    "toolDiffRemoved": "#ff0000",
    "toolDiffContext": "secondary",
    "syntaxComment": "secondary",
    "syntaxKeyword": "primary",
    "syntaxFunction": "#00aaff",
    "syntaxVariable": "#ffaa00",
    "syntaxString": "#00ff00",
    "syntaxNumber": "#ff00ff",
    "syntaxType": "#00aaff",
    "syntaxOperator": "primary",
    "syntaxPunctuation": "secondary",
    "thinkingOff": "secondary",
    "thinkingMinimal": "primary",
    "thinkingLow": "#00aaff",
    "thinkingMedium": "#00ffff",
    "thinkingHigh": "#ff00ff",
    "thinkingXhigh": "#ff0000",
    "thinkingMax": "#ff0088",
    "bashMode": "#ffaa00"
  }
}
```

3. Select the theme via `/settings`.
   通过 `/settings` 选择该主题。

**Hot reload:** When you edit the currently active custom theme file, pi reloads it automatically for immediate visual feedback.

**热重载：** 当你编辑当前生效的自定义主题文件时，pi 会自动重新加载，以便立即看到视觉效果。

## Theme Format 主题格式

```json
{
  "$schema": "https://raw.githubusercontent.com/earendil-works/pi/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json",
  "name": "my-theme",
  "vars": {
    "blue": "#0066cc",
    "gray": 242
  },
  "colors": {
    "accent": "blue",
    "muted": "gray",
    "text": "",
    ...
  }
}
```

- `name` is required, must be unique, and must not contain `/`.
  `name` 为必填项，必须唯一，且不能包含 `/`。
- `vars` is optional. Define reusable colors here, then reference them in `colors`.
  `vars` 为可选项。可在此定义可复用的颜色，然后在 `colors` 中引用它们。
- `colors` must define all 51 required tokens. `thinkingMax` is optional and falls back to `thinkingXhigh`.
  `colors` 必须定义全部 51 个必需令牌。`thinkingMax` 为可选项，缺省时回退为 `thinkingXhigh`。

The `$schema` field enables editor auto-completion and validation.

`$schema` 字段可启用编辑器的自动补全与校验功能。

## Color Tokens 颜色令牌

Every theme must define all 51 required color tokens. `thinkingMax` is optional for compatibility with existing themes; when omitted, it uses `thinkingXhigh`.

每个主题都必须定义全部 51 个必需的颜色令牌。为兼容既有主题，`thinkingMax` 是可选的；省略时将使用 `thinkingXhigh`。

### Core UI (11 colors) 核心界面（11 种颜色）

| Token<br>令牌 | Purpose<br>用途 |
|-------|---------|
| `accent` | Primary accent (logo, selected items, cursor)<br>主强调色（logo、选中项、光标） |
| `border` | Normal borders<br>普通边框 |
| `borderAccent` | Highlighted borders<br>高亮边框 |
| `borderMuted` | Subtle borders (editor)<br>弱化边框（编辑器） |
| `success` | Success states<br>成功状态 |
| `error` | Error states<br>错误状态 |
| `warning` | Warning states<br>警告状态 |
| `muted` | Secondary text<br>次要文本 |
| `dim` | Tertiary text<br>三级文本 |
| `text` | Default text (usually `""`)<br>默认文本（通常为 `""`） |
| `thinkingText` | Thinking block text<br>思考块文本 |

### Backgrounds & Content (11 colors) 背景与内容（11 种颜色）

| Token<br>令牌 | Purpose<br>用途 |
|-------|---------|
| `selectedBg` | Selected line background<br>选中行背景 |
| `userMessageBg` | User message background<br>用户消息背景 |
| `userMessageText` | User message text<br>用户消息文本 |
| `customMessageBg` | Extension message background<br>扩展消息背景 |
| `customMessageText` | Extension message text<br>扩展消息文本 |
| `customMessageLabel` | Extension message label<br>扩展消息标签 |
| `toolPendingBg` | Tool box (pending)<br>工具框（进行中） |
| `toolSuccessBg` | Tool box (success)<br>工具框（成功） |
| `toolErrorBg` | Tool box (error)<br>工具框（出错） |
| `toolTitle` | Tool title<br>工具标题 |
| `toolOutput` | Tool output text<br>工具输出文本 |

### Markdown (10 colors) Markdown（10 种颜色）

| Token<br>令牌 | Purpose<br>用途 |
|-------|---------|
| `mdHeading` | Headings<br>标题 |
| `mdLink` | Link text<br>链接文本 |
| `mdLinkUrl` | Link URL<br>链接 URL |
| `mdCode` | Inline code<br>行内代码 |
| `mdCodeBlock` | Code block content<br>代码块内容 |
| `mdCodeBlockBorder` | Code block fences<br>代码块围栏标记 |
| `mdQuote` | Blockquote text<br>引用块文本 |
| `mdQuoteBorder` | Blockquote border<br>引用块边框 |
| `mdHr` | Horizontal rule<br>水平分隔线 |
| `mdListBullet` | List bullets<br>列表项符号 |

### Tool Diffs (3 colors) 工具差异（3 种颜色）

| Token<br>令牌 | Purpose<br>用途 |
|-------|---------|
| `toolDiffAdded` | Added lines<br>新增行 |
| `toolDiffRemoved` | Removed lines<br>删除行 |
| `toolDiffContext` | Context lines<br>上下文行 |

### Syntax Highlighting (9 colors) 语法高亮（9 种颜色）

| Token<br>令牌 | Purpose<br>用途 |
|-------|---------|
| `syntaxComment` | Comments<br>注释 |
| `syntaxKeyword` | Keywords<br>关键字 |
| `syntaxFunction` | Function names<br>函数名 |
| `syntaxVariable` | Variables<br>变量 |
| `syntaxString` | Strings<br>字符串 |
| `syntaxNumber` | Numbers<br>数字 |
| `syntaxType` | Types<br>类型 |
| `syntaxOperator` | Operators<br>运算符 |
| `syntaxPunctuation` | Punctuation<br>标点符号 |

### Thinking Level Borders (6 required, 1 optional) 思考等级边框（6 个必需，1 个可选）

Editor border colors indicating thinking level (visual hierarchy from subtle to prominent):

用于标识思考等级的编辑器边框颜色（视觉层次由弱到强）：

| Token<br>令牌 | Purpose<br>用途 |
|-------|---------|
| `thinkingOff` | Thinking off<br>关闭思考 |
| `thinkingMinimal` | Minimal thinking<br>极简思考 |
| `thinkingLow` | Low thinking<br>低强度思考 |
| `thinkingMedium` | Medium thinking<br>中等强度思考 |
| `thinkingHigh` | High thinking<br>高强度思考 |
| `thinkingXhigh` | Extra high thinking<br>超高强度思考 |
| `thinkingMax` | Maximum thinking; optional, falls back to `thinkingXhigh`<br>最高强度思考；可选，缺省时回退为 `thinkingXhigh` |

### Bash Mode (1 color) Bash 模式（1 种颜色）

| Token<br>令牌 | Purpose<br>用途 |
|-------|---------|
| `bashMode` | Editor border in bash mode (`!` prefix)<br>bash 模式下的编辑器边框（以 `!` 为前缀） |

### HTML Export (optional) HTML 导出（可选）

The `export` section controls colors for `/export` HTML output. If omitted, colors are derived from `userMessageBg`.

`export` 部分用于控制 `/export` 生成的 HTML 输出配色。若省略，颜色将根据 `userMessageBg` 推导得出。

```json
{
  "export": {
    "pageBg": "#18181e",
    "cardBg": "#1e1e24",
    "infoBg": "#3c3728"
  }
}
```

## Color Values 颜色取值

Four formats are supported:

支持四种格式：

| Format<br>格式 | Example<br>示例 | Description<br>说明 |
|--------|---------|-------------|
| Hex<br>十六进制 | `"#ff0000"` | 6-digit hex RGB<br>6 位十六进制 RGB |
| 256-color<br>256 色 | `39` | xterm 256-color palette index (0-255)<br>xterm 256 色调色板索引（0-255） |
| Variable<br>变量 | `"primary"` | Reference to a `vars` entry<br>引用 `vars` 中的条目 |
| Default<br>默认 | `""` | Terminal's default color<br>终端的默认颜色 |

### 256-Color Palette 256 色调色板

- `0-15`: Basic ANSI colors (terminal-dependent)
  `0-15`：基础 ANSI 颜色（取决于终端）
- `16-231`: 6×6×6 RGB cube (`16 + 36×R + 6×G + B` where R,G,B are 0-5)
  `16-231`：6×6×6 的 RGB 色立方（`16 + 36×R + 6×G + B`，其中 R、G、B 取值 0-5）
- `232-255`: Grayscale ramp
  `232-255`：灰度渐变

### Terminal Compatibility 终端兼容性

Pi uses 24-bit RGB colors. Most modern terminals support this (iTerm2, Kitty, WezTerm, Windows Terminal, VS Code). For older terminals with only 256-color support, pi falls back to the nearest approximation.

Pi 使用 24 位 RGB 真彩色。大多数现代终端都支持（iTerm2、Kitty、WezTerm、Windows Terminal、VS Code）。对于仅支持 256 色的旧终端，pi 会回退到最接近的近似色。

Check truecolor support:

检查真彩色支持情况：

```bash
echo $COLORTERM  # Should output "truecolor" or "24bit"
```

## Tips 技巧

**Dark terminals:** Use bright, saturated colors with higher contrast.

**深色终端：** 使用明亮、高饱和度且对比度较高的颜色。

**Light terminals:** Use darker, muted colors with lower contrast.

**浅色终端：** 使用较深、低饱和度且对比度较低的颜色。

**Color harmony:** Start with a base palette (Nord, Gruvbox, Tokyo Night), define it in `vars`, and reference consistently.

**配色协调：** 从一套基础调色板开始（Nord、Gruvbox、Tokyo Night），在 `vars` 中定义它，并保持一致地引用。

**Testing:** Check your theme with different message types, tool states, markdown content, and long wrapped text.

**测试：** 用不同的消息类型、工具状态、Markdown 内容以及长换行文本来检验你的主题。

**VS Code:** Set `terminal.integrated.minimumContrastRatio` to `1` for accurate colors.

**VS Code：** 将 `terminal.integrated.minimumContrastRatio` 设为 `1`，以获得准确的颜色显示。

## Examples 示例

See the built-in themes:

参见内置主题：
- [dark.json](../src/modes/interactive/theme/dark.json)
- [light.json](../src/modes/interactive/theme/light.json)
