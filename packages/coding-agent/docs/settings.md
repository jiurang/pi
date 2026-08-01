# Settings 设置

Pi uses JSON settings files with project settings overriding global settings.
Pi 使用 JSON 设置文件，其中项目级设置会覆盖全局设置。

| Location | Scope |
|----------|-------|
| `~/.pi/agent/settings.json` | Global (all projects)<br>全局（适用于所有项目） |
| `.pi/settings.json` | Project (current directory)<br>项目级（当前目录） |

Edit directly or use `/settings` for common options.
可直接编辑文件，或使用 `/settings` 配置常用选项。

## Project Trust 项目信任

On interactive startup, pi asks before trusting a project folder that contains project-local settings, resources, or project `.agents/skills` and has no saved decision for the folder or a parent folder in `~/.pi/agent/trust.json`. Trusting a project allows pi to load `.pi/settings.json` and `.pi` resources, install missing project packages, and execute project extensions.
在交互式启动时，如果某个项目文件夹包含项目本地设置、资源或项目 `.agents/skills`，且在 `~/.pi/agent/trust.json` 中该文件夹及其父文件夹都没有已保存的决定，pi 会先询问是否信任该文件夹。信任一个项目后，pi 便可以加载 `.pi/settings.json` 和 `.pi` 资源、安装缺失的项目包，并执行项目扩展（extension）。

Non-interactive modes (`-p`, `--mode json`, and `--mode rpc`) do not show a trust prompt. Without an applicable saved trust decision, they use `defaultProjectTrust` from global settings: `ask` (default) and `never` ignore those project resources, while `always` trusts them. Pass `--approve`/`-a` or `--no-approve`/`-na` to override project trust for one run.
非交互模式（`-p`、`--mode json` 和 `--mode rpc`）不会弹出信任提示。若没有适用的已保存信任决定，它们会使用全局设置中的 `defaultProjectTrust`：`ask`（默认值）和 `never` 会忽略这些项目资源，而 `always` 则信任它们。可以传入 `--approve`/`-a` 或 `--no-approve`/`-na` 来为单次运行覆盖项目信任行为。

If no extension or saved decision applies, `defaultProjectTrust` controls the fallback behavior. Set it to `"ask"`, `"always"`, or `"never"` in `~/.pi/agent/settings.json`, or change it with `/settings`.
如果没有适用的扩展或已保存的决定，则由 `defaultProjectTrust` 控制回退行为。可在 `~/.pi/agent/settings.json` 中将其设为 `"ask"`、`"always"` 或 `"never"`，也可以通过 `/settings` 修改。

`pi config` and package commands use the same project trust flow, except `pi update` never prompts. Pass `--approve` to trust project-local settings for one command or `--no-approve` to ignore them.
`pi config` 和包相关命令使用同样的项目信任流程，唯独 `pi update` 从不弹出提示。传入 `--approve` 可为单条命令信任项目本地设置，传入 `--no-approve` 则忽略它们。

Use `/trust` in interactive mode to save a project trust decision for future sessions, including trust for the immediate parent folder. It writes `~/.pi/agent/trust.json` only; the current session is not reloaded, so restart pi for changes to take effect.
在交互模式下使用 `/trust` 可为后续会话保存项目信任决定，包括对上一级父文件夹的信任。该命令仅写入 `~/.pi/agent/trust.json`；当前会话不会重新加载，因此需要重启 pi 才能生效。

## All Settings 全部设置项

### Model & Thinking 模型与思考

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `defaultProvider` | string | - | Default provider (e.g., `"anthropic"`, `"openai"`)<br>默认提供商（例如 `"anthropic"`、`"openai"`） |
| `defaultModel` | string | - | Default model ID<br>默认模型 ID |
| `defaultThinkingLevel` | string | - | `"off"`, `"minimal"`, `"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`<br>取值：`"off"`、`"minimal"`、`"low"`、`"medium"`、`"high"`、`"xhigh"`、`"max"` |
| `hideThinkingBlock` | boolean | `false` | Hide thinking blocks in output<br>在输出中隐藏思考块 |
| `showCacheMissNotices` | boolean | `false` | Show transcript notices for significant prompt-cache misses<br>当出现明显的提示词缓存未命中时，在对话记录中显示提示 |
| `thinkingBudgets` | object | - | Custom token budgets per thinking level<br>为各思考级别自定义 token 预算 |

#### thinkingBudgets

```json
{
  "thinkingBudgets": {
    "minimal": 1024,
    "low": 4096,
    "medium": 10240,
    "high": 32768
  }
}
```

### UI & Display 界面与显示

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `theme` | string | `"dark"` | Theme name (`"dark"`, `"light"`, or custom)<br>主题名称（`"dark"`、`"light"` 或自定义主题） |
| `externalEditor` | string | `$VISUAL`, then `$EDITOR`, then Notepad on Windows or `nano` elsewhere | Command for Ctrl+G external editor; takes precedence over environment variables<br>Ctrl+G 调用外部编辑器所使用的命令；优先级高于环境变量 |
| `quietStartup` | boolean | `false` | Hide startup header<br>隐藏启动时的头部信息 |
| `defaultProjectTrust` | string | `"ask"` | Fallback project trust behavior: `"ask"`, `"always"`, or `"never"`. Global setting only<br>项目信任的回退行为：`"ask"`、`"always"` 或 `"never"`。仅支持全局设置 |
| `collapseChangelog` | boolean | `false` | Show condensed changelog after updates<br>更新后显示精简版更新日志 |
| `enableInstallTelemetry` | boolean | `true` | Send an anonymous install/update version ping after first install or changelog-detected updates. This does not control update checks<br>在首次安装或检测到更新日志变化后，发送匿名的安装/更新版本上报。此项不控制更新检查 |
| `enableAnalytics` | boolean | `false` | Opt-in analytics data sharing. Currently only asked for during the experimental first-time setup (`PI_EXPERIMENTAL=1`)<br>选择加入（opt-in）的分析数据共享。目前仅在实验性的首次设置流程（`PI_EXPERIMENTAL=1`）中询问 |
| `trackingId` | string | - | Analytics tracking identifier, generated when `enableAnalytics` is turned on<br>分析追踪标识符，在启用 `enableAnalytics` 时生成 |
| `doubleEscapeAction` | string | `"tree"` | Action for double-escape: `"tree"`, `"fork"`, or `"none"`<br>连按两次 Esc 的行为：`"tree"`、`"fork"` 或 `"none"` |
| `treeFilterMode` | string | `"default"` | Default filter for `/tree`: `"default"`, `"no-tools"`, `"user-only"`, `"labeled-only"`, `"all"`<br>`/tree` 的默认过滤方式：`"default"`、`"no-tools"`、`"user-only"`、`"labeled-only"`、`"all"` |
| `editorPaddingX` | number | `0` | Horizontal padding for input editor (0-3)<br>输入编辑器的水平内边距（0-3） |
| `outputPad` | number | `1` | Horizontal padding for user messages, assistant messages, and thinking (0 or 1)<br>用户消息、助手消息和思考内容的水平内边距（0 或 1） |
| `autocompleteMaxVisible` | number | `5` | Max visible items in autocomplete dropdown (3-20)<br>自动补全下拉列表中最多可见项数（3-20） |
| `showHardwareCursor` | boolean | `false` | Show the terminal cursor while TUI positions it for IME support<br>在 TUI 为输入法（IME）支持而定位光标时，显示终端硬件光标 |

For VS Code, include `--wait` so pi resumes after the editor exits:
对于 VS Code，需要加上 `--wait`，这样编辑器退出后 pi 才会继续运行：

```json
{
  "externalEditor": "code --wait"
}
```

### Telemetry and update checks 遥测与更新检查

`enableInstallTelemetry` only controls the anonymous install/update ping to `https://pi.dev/api/report-install`. Opting out of telemetry does not disable update checks; Pi can still fetch `https://pi.dev/api/latest-version` to look for the latest version.
`enableInstallTelemetry` 仅控制向 `https://pi.dev/api/report-install` 发送的匿名安装/更新上报。关闭遥测并不会禁用更新检查；Pi 仍会请求 `https://pi.dev/api/latest-version` 以查找最新版本。

Set `PI_SKIP_VERSION_CHECK=1` to disable the Pi version update check. Use `--offline` or `PI_OFFLINE=1` to disable all startup network operations described here, including update checks, package update checks, and install/update telemetry.
设置 `PI_SKIP_VERSION_CHECK=1` 可禁用 Pi 的版本更新检查。使用 `--offline` 或 `PI_OFFLINE=1` 可禁用此处描述的所有启动期网络操作，包括更新检查、包更新检查以及安装/更新遥测。

### Network 网络

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `httpProxy` | string | - | HTTP proxy URL applied as `HTTP_PROXY` and `HTTPS_PROXY`. Global setting only.<br>作为 `HTTP_PROXY` 和 `HTTPS_PROXY` 应用的 HTTP 代理 URL。仅支持全局设置。 |

```json
{
  "httpProxy": "http://127.0.0.1:7890"
}
```

### Warnings 警告

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `warnings.anthropicExtraUsage` | boolean | `true` | Show a warning when Anthropic subscription auth may use paid extra usage<br>当 Anthropic 订阅认证可能产生付费的额外用量时显示警告 |

```json
{
  "warnings": {
    "anthropicExtraUsage": false
  }
}
```

### Compaction 上下文压缩

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `compaction.enabled` | boolean | `true` | Enable auto-compaction<br>启用自动压缩 |
| `compaction.reserveTokens` | number | `16384` | Tokens reserved for LLM response<br>为 LLM 响应预留的 token 数 |
| `compaction.keepRecentTokens` | number | `20000` | Recent tokens to keep (not summarized)<br>保留的最近 token 数（不参与摘要） |

```json
{
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  }
}
```

### Branch Summary 分支摘要

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `branchSummary.reserveTokens` | number | `16384` | Tokens reserved for branch summarization<br>为分支摘要预留的 token 数 |
| `branchSummary.skipPrompt` | boolean | `false` | Skip "Summarize branch?" prompt on `/tree` navigation (defaults to no summary)<br>在 `/tree` 导航时跳过 "Summarize branch?" 提示（默认不生成摘要） |

### Retry 重试

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `retry.enabled` | boolean | `true` | Enable automatic agent-level retry on transient errors<br>发生瞬时错误时启用 agent 级别的自动重试 |
| `retry.maxRetries` | number | `3` | Maximum agent-level retry attempts<br>agent 级别的最大重试次数 |
| `retry.baseDelayMs` | number | `2000` | Base delay for agent-level exponential backoff (2s, 4s, 8s)<br>agent 级别指数退避的基础延迟（2 秒、4 秒、8 秒） |
| `retry.provider.timeoutMs` | number | SDK default | Provider/SDK request timeout in milliseconds<br>提供商/SDK 请求超时时间（毫秒） |
| `retry.provider.maxRetries` | number | `0` | Provider/SDK retry attempts<br>提供商/SDK 层面的重试次数 |
| `retry.provider.maxRetryDelayMs` | number | `60000` | Max server-requested delay before failing (60s)<br>在直接失败之前，可接受的服务端要求的最大延迟（60 秒） |

When a provider requests a retry delay longer than `retry.provider.maxRetryDelayMs`, the request fails immediately with an informative error instead of waiting silently. Set it to `0` to disable the limit.
当提供商要求的重试延迟超过 `retry.provider.maxRetryDelayMs` 时，请求会立即失败并给出明确的错误信息，而不是静默等待。将其设为 `0` 可取消该限制。

Keep `retry.provider.maxRetries` at `0` unless provider-level retries are explicitly needed. Setting it above `0` can make SDK/provider retries handle out-of-usage-limit errors before Pi sees them, which may block the agent until the provider quota resets in some circumstances.
除非确实需要提供商层面的重试，否则请将 `retry.provider.maxRetries` 保持为 `0`。将其设为大于 `0` 的值会让 SDK/提供商的重试在 Pi 感知之前就处理掉超出用量限制（out-of-usage-limit）的错误，某些情况下可能导致 agent 一直阻塞，直到提供商配额重置。

```json
{
  "retry": {
    "enabled": true,
    "maxRetries": 3,
    "baseDelayMs": 2000,
    "provider": {
      "timeoutMs": 3600000,
      "maxRetries": 0,
      "maxRetryDelayMs": 60000
    }
  }
}
```

### Message Delivery 消息投递

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `steeringMode` | string | `"one-at-a-time"` | How steering messages are sent: `"all"` or `"one-at-a-time"`<br>引导（steering）消息的发送方式：`"all"` 或 `"one-at-a-time"` |
| `followUpMode` | string | `"one-at-a-time"` | How follow-up messages are sent: `"all"` or `"one-at-a-time"`<br>后续（follow-up）消息的发送方式：`"all"` 或 `"one-at-a-time"` |
| `transport` | string | `"auto"` | Preferred transport for providers that support multiple transports: `"sse"`, `"websocket"`, `"websocket-cached"`, or `"auto"`<br>对于支持多种传输方式的提供商，首选的传输方式：`"sse"`、`"websocket"`、`"websocket-cached"` 或 `"auto"` |
| `httpIdleTimeoutMs` | number | `300000` | HTTP header/body idle timeout in milliseconds, also used by providers with explicit stream idle timeouts. Set to `0` to disable.<br>HTTP 头部/主体的空闲超时时间（毫秒），对设置了显式流空闲超时的提供商同样适用。设为 `0` 可禁用。 |
| `websocketConnectTimeoutMs` | number | `15000` | WebSocket connect/open handshake timeout in milliseconds for providers that support WebSocket transports. Set to `0` to disable.<br>对于支持 WebSocket 传输的提供商，WebSocket 连接/握手的超时时间（毫秒）。设为 `0` 可禁用。 |

### Terminal & Images 终端与图片

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `terminal.showImages` | boolean | `true` | Show images in terminal (if supported)<br>在终端中显示图片（若终端支持） |
| `terminal.imageWidthCells` | number | `60` | Preferred inline image width in terminal cells<br>内联图片的首选宽度，以终端字符单元格计 |
| `terminal.clearOnShrink` | boolean | `false` | Clear empty rows when content shrinks (can cause flicker)<br>内容收缩时清除空行（可能导致闪烁） |
| `images.autoResize` | boolean | `true` | Resize images to 2000x2000 max<br>将图片缩放至最大 2000x2000 |
| `images.blockImages` | boolean | `false` | Block all images from being sent to LLM<br>阻止所有图片被发送给 LLM |

### Shell

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `shellPath` | string | - | Custom shell path (e.g., for Cygwin on Windows); supports a leading `~` for the home directory<br>自定义 shell 路径（例如 Windows 上的 Cygwin）；支持以 `~` 开头表示用户主目录 |
| `shellCommandPrefix` | string | - | Prefix for every bash command (e.g., `"shopt -s expand_aliases"`)<br>为每条 bash 命令添加的前缀（例如 `"shopt -s expand_aliases"`） |
| `npmCommand` | string[] | - | Command argv used for npm package lookup/install operations (e.g., `["mise", "exec", "node@20", "--", "npm"]`)<br>执行 npm 包查找/安装操作时使用的命令参数数组（例如 `["mise", "exec", "node@20", "--", "npm"]`） |

```json
{
  "npmCommand": ["mise", "exec", "node@20", "--", "npm"]
}
```

`npmCommand` is used for all npm package-manager operations, including installs, uninstalls, and dependency installs inside git packages. User-scoped npm packages install under `~/.pi/agent/npm/`; project-scoped npm packages install under `.pi/npm/`. Use argv-style entries exactly as the process should be launched. When `npmCommand` is configured, git package dependency installs use plain `install` to avoid npm-specific flags in wrappers or alternate package managers.
`npmCommand` 会用于所有 npm 包管理器操作，包括安装、卸载，以及 git 包内部的依赖安装。用户级（user-scoped）npm 包安装在 `~/.pi/agent/npm/` 下；项目级（project-scoped）npm 包安装在 `.pi/npm/` 下。请按照进程实际启动方式，使用 argv 风格逐项填写。当配置了 `npmCommand` 时，git 包的依赖安装会使用普通的 `install`，以避免在包装脚本或替代包管理器中出现 npm 专有的参数。

### Sessions 会话

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `sessionDir` | string | - | Directory where session files are stored. Accepts absolute or relative paths, plus `~`.<br>存放会话文件的目录。支持绝对路径、相对路径以及 `~`。 |

```json
{ "sessionDir": ".pi/sessions" }
```

When multiple sources specify a session directory, precedence is `--session-dir`, `PI_CODING_AGENT_SESSION_DIR`, then `sessionDir` in settings.json.
当多个来源同时指定了会话目录时，优先级依次为 `--session-dir`、`PI_CODING_AGENT_SESSION_DIR`，最后是 settings.json 中的 `sessionDir`。

### Model Cycling 模型切换

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabledModels` | string[] | - | Model patterns for Ctrl+P cycling (same format as `--models` CLI flag)<br>用于 Ctrl+P 循环切换的模型匹配模式（格式与命令行参数 `--models` 相同） |

```json
{
  "enabledModels": ["claude-*", "gpt-4o", "gemini-2*"]
}
```

### Markdown

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `markdown.codeBlockIndent` | string | `"  "` | Indentation for code blocks<br>代码块的缩进 |

### Resources 资源

These settings define where to load extensions, skills, prompts, and themes from.
这些设置项定义了从哪里加载扩展（extension）、技能（skill）、提示词模板（prompt）和主题（theme）。

Paths in `~/.pi/agent/settings.json` resolve relative to `~/.pi/agent`. Paths in `.pi/settings.json` resolve relative to `.pi`. Absolute paths and `~` are supported.
`~/.pi/agent/settings.json` 中的路径相对于 `~/.pi/agent` 解析；`.pi/settings.json` 中的路径相对于 `.pi` 解析。同时支持绝对路径和 `~`。

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `packages` | array | `[]` | npm/git packages to load resources from<br>用于加载资源的 npm/git 包 |
| `extensions` | string[] | `[]` | Local extension file paths or directories<br>本地扩展文件路径或目录 |
| `skills` | string[] | `[]` | Local skill file paths or directories<br>本地技能文件路径或目录 |
| `prompts` | string[] | `[]` | Local prompt template paths or directories<br>本地提示词模板路径或目录 |
| `themes` | string[] | `[]` | Local theme file paths or directories<br>本地主题文件路径或目录 |
| `enableSkillCommands` | boolean | `true` | Register skills as `/skill:name` commands<br>将技能注册为 `/skill:name` 命令 |

Arrays support glob patterns and exclusions. Use `!pattern` to exclude. Use `+path` to force-include an exact path and `-path` to force-exclude an exact path.
数组支持 glob 通配模式与排除规则。使用 `!pattern` 进行排除；使用 `+path` 强制包含某个确切路径，使用 `-path` 强制排除某个确切路径。

#### packages

String form loads all resources from a package:
字符串形式会加载一个包中的全部资源：

```json
{
  "packages": ["pi-skills", "@org/my-extension"]
}
```

Object form filters which resources to load:
对象形式可以筛选要加载的资源：

```json
{
  "packages": [
    {
      "source": "pi-skills",
      "skills": ["brave-search", "transcribe"],
      "extensions": []
    }
  ]
}
```

See [packages.md](packages.md) for package management details.
包管理的详细说明参见 [packages.md](packages.md)。

## Example 示例

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-20250514",
  "defaultThinkingLevel": "medium",
  "theme": "dark",
  "compaction": {
    "enabled": true,
    "reserveTokens": 16384,
    "keepRecentTokens": 20000
  },
  "retry": {
    "enabled": true,
    "maxRetries": 3
  },
  "enabledModels": ["claude-*", "gpt-4o"],
  "warnings": {
    "anthropicExtraUsage": true
  },
  "packages": ["pi-skills"]
}
```

## Project Overrides 项目级覆盖

Project settings (`.pi/settings.json`) override global settings. Nested objects are merged:
项目级设置（`.pi/settings.json`）会覆盖全局设置。嵌套对象会进行合并：

```json
// ~/.pi/agent/settings.json (global)
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 16384 }
}

// .pi/settings.json (project)
{
  "compaction": { "reserveTokens": 8192 }
}

// Result
{
  "theme": "dark",
  "compaction": { "enabled": true, "reserveTokens": 8192 }
}
```
