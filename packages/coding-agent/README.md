<p align="center">
  <a href="https://pi.dev">
    <img alt="pi logo" src="https://pi.dev/logo-auto.svg" width="128">
  </a>
</p>
<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent"><img alt="npm" src="https://img.shields.io/npm/v/@earendil-works/pi-coding-agent?style=flat-square" /></a>
</p>

> New issues and PRs from new contributors are auto-closed by default. Maintainers review auto-closed issues daily. See [CONTRIBUTING.md](../../CONTRIBUTING.md).
>
> 来自新贡献者的新 issue 和 PR 默认会被自动关闭。维护者每天都会审阅这些被自动关闭的 issue。详见 [CONTRIBUTING.md](../../CONTRIBUTING.md)。

---

Pi is a minimal terminal coding harness. Adapt pi to your workflows, not the other way around, without having to fork and modify pi internals. Extend it with TypeScript [Extensions](#extensions), [Skills](#skills), [Prompt Templates](#prompt-templates), and [Themes](#themes). Put your extensions, skills, prompt templates, and themes in [Pi Packages](#pi-packages) and share them with others via npm or git.

Pi 是一个极简的终端编码框架（coding harness）。让 pi 适配你的工作流，而不是反过来，并且无需 fork 和修改 pi 的内部实现。你可以用 TypeScript 编写的[扩展（Extensions）](#extensions)、[技能（Skills）](#skills)、[提示词模板（Prompt Templates）](#prompt-templates)和[主题（Themes）](#themes)来扩展它。把你的扩展、技能、提示词模板和主题打包成 [Pi Packages](#pi-packages)，即可通过 npm 或 git 分享给他人。

Pi ships with powerful defaults but skips features like sub agents and plan mode. Instead, you can ask pi to build what you want or install a third party pi package that matches your workflow.

Pi 自带强大的默认配置，但刻意省略了子代理（sub agents）、计划模式（plan mode）之类的功能。取而代之的是，你可以让 pi 自己构建你想要的功能，或者安装契合你工作流的第三方 pi 包。

Pi runs in four modes: interactive, print or JSON, RPC for process integration, and an SDK for embedding in your own apps.

Pi 支持四种运行模式：交互模式、打印或 JSON 模式、用于进程集成的 RPC 模式，以及可嵌入你自己应用的 SDK 模式。

## Share your OSS coding agent sessions 分享你的开源编码 agent 会话

If you use pi for open source work, please share your coding agent sessions.

如果你使用 pi 进行开源工作，请分享你的编码 agent 会话。

Public OSS session data helps improve models, prompts, tools, and evaluations using real development workflows.

公开的开源会话数据有助于借助真实开发工作流改进模型、提示词、工具和评估体系。

For the full explanation, see [this post on X](https://x.com/badlogicgames/status/2037811643774652911).

完整说明请参见 [X 上的这篇帖子](https://x.com/badlogicgames/status/2037811643774652911)。

To publish sessions, use [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf). Read its README.md for setup instructions. All you need is a Hugging Face account, the Hugging Face CLI, and `pi-share-hf`.

要发布会话，请使用 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。安装配置说明见其 README.md。你只需要一个 Hugging Face 账号、Hugging Face CLI 和 `pi-share-hf`。

You can also watch [this video](https://x.com/badlogicgames/status/2041151967695634619), where I show how I publish my `pi-mono` sessions.

你也可以观看[这个视频](https://x.com/badlogicgames/status/2041151967695634619)，其中演示了我如何发布自己的 `pi-mono` 会话。

I regularly publish my own `pi-mono` work sessions here:

我会定期在这里发布自己的 `pi-mono` 工作会话：

- [badlogicgames/pi-mono on Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono)
  [Hugging Face 上的 badlogicgames/pi-mono](https://huggingface.co/datasets/badlogicgames/pi-mono)

## Table of Contents 目录

- [Quick Start](#quick-start) 快速开始
- [Providers & Models](#providers--models) 服务商与模型
- [Interactive Mode](#interactive-mode) 交互模式
  - [Editor](#editor) 编辑器
  - [Commands](#commands) 命令
  - [Keyboard Shortcuts](#keyboard-shortcuts) 键盘快捷键
  - [Message Queue](#message-queue) 消息队列
- [Sessions](#sessions) 会话
  - [Branching](#branching) 分支
  - [Compaction](#compaction) 上下文压缩
- [Settings](#settings) 设置
- [Context Files](#context-files) 上下文文件
- [Customization](#customization) 定制化
  - [Prompt Templates](#prompt-templates) 提示词模板
  - [Skills](#skills) 技能
  - [Extensions](#extensions) 扩展
  - [Themes](#themes) 主题
  - [Pi Packages](#pi-packages) Pi 包
- [Programmatic Usage](#programmatic-usage) 编程式用法
- [Philosophy](#philosophy) 设计理念
- [CLI Reference](#cli-reference) CLI 参考

---

## Quick Start 快速开始

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` disables dependency lifecycle scripts during install. Pi does not require install scripts for normal npm installs.

`--ignore-scripts` 会在安装期间禁用依赖的生命周期脚本。对于常规的 npm 安装，Pi 不需要安装脚本。

Installer alternative:

安装脚本方式（备选）：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

Authenticate with an API key:

使用 API key 认证：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

Or use your existing subscription:

或使用你已有的订阅：

```bash
pi
/login  # Then select provider
```

Then just talk to pi. By default, pi gives the model four tools: `read`, `write`, `edit`, and `bash`. The model uses these to fulfill your requests. Add capabilities via [skills](#skills), [prompt templates](#prompt-templates), [extensions](#extensions), or [pi packages](#pi-packages).

然后直接和 pi 对话即可。默认情况下，pi 会给模型提供四个工具：`read`、`write`、`edit` 和 `bash`。模型使用这些工具来完成你的请求。你可以通过[技能](#skills)、[提示词模板](#prompt-templates)、[扩展](#extensions)或 [pi 包](#pi-packages)来增加能力。

**Platform notes:** [Windows](docs/windows.md) | [Termux (Android)](docs/termux.md) | [tmux](docs/tmux.md) | [Terminal setup](docs/terminal-setup.md) | [Shell aliases](docs/shell-aliases.md)

**平台相关说明：** [Windows](docs/windows.md) | [Termux (Android)](docs/termux.md) | [tmux](docs/tmux.md) | [终端配置](docs/terminal-setup.md) | [Shell 别名](docs/shell-aliases.md)

---

## Providers & Models 服务商与模型

For each built-in provider, pi maintains a list of tool-capable models. Configured provider catalogs refresh automatically; run `pi update --models` to force an immediate refresh. Authenticate via subscription (`/login`) or API key, then select any model from that provider via `/model` (or Ctrl+L).

对于每个内置服务商，pi 都维护了一份支持工具调用（tool-capable）的模型列表。已配置服务商的模型目录会自动刷新；运行 `pi update --models` 可强制立即刷新。通过订阅（`/login`）或 API key 完成认证后，即可用 `/model`（或 Ctrl+L）选择该服务商下的任意模型。

**Subscriptions:**
**订阅方式：**
- Anthropic Claude Pro/Max
- OpenAI ChatGPT Plus/Pro (Codex)
- GitHub Copilot

**API keys:**
**API key 方式：**
- Anthropic
- Ant Ling
- OpenAI
- Azure OpenAI
- DeepSeek
- NVIDIA NIM
- Google Gemini
- Google Vertex
- Amazon Bedrock
- Mistral
- Groq
- Cerebras
- Cloudflare AI Gateway
- Cloudflare Workers AI
- xAI
- OpenRouter
- Vercel AI Gateway
- ZAI Coding Plan (Global)
- ZAI Coding Plan (China)
- OpenCode Zen
- OpenCode Go
- Hugging Face
- Fireworks
- Together AI
- Kimi For Coding
- MiniMax
- Xiaomi MiMo
- Xiaomi MiMo Token Plan (China)
- Xiaomi MiMo Token Plan (Amsterdam)
- Xiaomi MiMo Token Plan (Singapore)

Pi also supports the llama.cpp router server. Configure it with `/login llama.cpp`, manage downloads and loaded models with `/llama`, then select a loaded model with `/model`. See [docs/llama-cpp.md](docs/llama-cpp.md) for setup and usage.

Pi 也支持 llama.cpp 路由服务器（router server）。用 `/login llama.cpp` 进行配置，用 `/llama` 管理下载与已加载的模型，然后用 `/model` 选择一个已加载的模型。安装与使用方法见 [docs/llama-cpp.md](docs/llama-cpp.md)。

See [docs/providers.md](docs/providers.md) for other provider setup instructions.

其他服务商的配置说明见 [docs/providers.md](docs/providers.md)。

**Custom providers & models:** Add providers via `~/.pi/agent/models.json` if they speak a supported API (OpenAI, Anthropic, Google). For custom APIs or OAuth, use extensions. See [docs/models.md](docs/models.md) and [docs/custom-provider.md](docs/custom-provider.md).

**自定义服务商与模型：** 如果某个服务商使用受支持的 API（OpenAI、Anthropic、Google），可以通过 `~/.pi/agent/models.json` 添加。对于自定义 API 或 OAuth，请使用扩展。参见 [docs/models.md](docs/models.md) 和 [docs/custom-provider.md](docs/custom-provider.md)。

---

## Interactive Mode 交互模式

<p align="center"><img src="docs/images/interactive-mode.png" alt="Interactive Mode" width="600"></p>

The interface from top to bottom:

界面自上而下依次为：

- **Startup header** - Shows shortcuts (`/hotkeys` for all), loaded AGENTS.md files, prompt templates, skills, and extensions
  **启动头部（Startup header）** - 显示快捷键（用 `/hotkeys` 查看全部）、已加载的 AGENTS.md 文件、提示词模板、技能和扩展
- **Messages** - Your messages, assistant responses, tool calls and results, notifications, errors, and extension UI
  **消息区（Messages）** - 你的消息、助手回复、工具调用与结果、通知、错误以及扩展 UI
- **Editor** - Where you type; border color indicates thinking level
  **编辑器（Editor）** - 你输入内容的地方；边框颜色表示思考等级（thinking level）
- **Footer** - Working directory, session name, total token/cache usage (`↑` input, `↓` output, `R` cache read, `W` cache write, `CH` latest cache hit rate), cost, context usage, current model. Totals include assistant responses, usage reported by tools, and summary generation.
  **底部状态栏（Footer）** - 工作目录、会话名称、总 token/缓存用量（`↑` 输入、`↓` 输出、`R` 缓存读取、`W` 缓存写入、`CH` 最近一次缓存命中率）、费用、上下文占用、当前模型。统计总量包含助手回复、工具上报的用量以及摘要生成的消耗。

The editor can be temporarily replaced by other UI, like built-in `/settings` or custom UI from extensions (e.g., a Q&A tool that lets the user answer model questions in a structured format). [Extensions](#extensions) can also replace the editor, add widgets above/below it, a status line, custom footer, or overlays.

编辑器可以被其他 UI 临时替换，例如内置的 `/settings` 或来自扩展的自定义 UI（比如一个问答工具，让用户以结构化方式回答模型的提问）。[扩展](#extensions)还可以替换编辑器、在其上方/下方添加控件、添加状态行、自定义底栏或浮层（overlay）。

### Editor 编辑器

| Feature 功能 | How 用法 |
|---------|-----|
| File reference<br>文件引用 | Type `@` to fuzzy-search project files<br>输入 `@` 可模糊搜索项目文件 |
| Path completion<br>路径补全 | Tab to complete paths<br>按 Tab 补全路径 |
| Multi-line<br>多行输入 | Shift+Enter (or Ctrl+Enter on Windows Terminal)<br>Shift+Enter（在 Windows Terminal 上为 Ctrl+Enter） |
| External editor<br>外部编辑器 | Ctrl+G opens `externalEditor`, `$VISUAL`, `$EDITOR`, Notepad on Windows, or `nano` elsewhere<br>Ctrl+G 打开 `externalEditor`、`$VISUAL`、`$EDITOR`，Windows 上为记事本，其他平台为 `nano` |
| Clipboard<br>剪贴板 | Ctrl+V to paste an image or text (Alt+V on Windows), or drag images onto terminal<br>Ctrl+V 粘贴图片或文本（Windows 上为 Alt+V），或将图片拖入终端 |
| Bash commands<br>Bash 命令 | `!command` runs and sends output to LLM, `!!command` runs without sending<br>`!command` 执行并将输出发送给 LLM，`!!command` 执行但不发送 |

Standard editing keybindings for delete word, undo, etc. See [docs/keybindings.md](docs/keybindings.md).

删除单词、撤销等操作使用标准编辑快捷键。参见 [docs/keybindings.md](docs/keybindings.md)。

### Commands 命令

Type `/` in the editor to trigger commands. [Extensions](#extensions) can register custom commands, [skills](#skills) are available as `/skill:name`, and [prompt templates](#prompt-templates) expand via `/templatename`.

在编辑器中输入 `/` 即可触发命令。[扩展](#extensions)可以注册自定义命令，[技能](#skills)以 `/skill:name` 的形式提供，[提示词模板](#prompt-templates)则通过 `/templatename` 展开。

| Command 命令 | Description 说明 |
|---------|-------------|
| `/login`, `/logout` | Manage provider credentials<br>管理服务商凭证 |
| [`/llama`](docs/llama-cpp.md) | Download, load, and unload llama.cpp router models<br>下载、加载和卸载 llama.cpp 路由模型 |
| `/model` | Switch models<br>切换模型 |
| `/scoped-models` | Enable/disable models for Ctrl+P cycling<br>启用/禁用可通过 Ctrl+P 循环切换的模型 |
| `/settings` | Thinking level, theme, message delivery, transport<br>思考等级、主题、消息投递方式、传输方式 |
| `/resume` | Pick from previous sessions<br>从历史会话中选择一个继续 |
| `/new` | Start a new session<br>开始新会话 |
| `/name <name>` | Set session display name<br>设置会话显示名称 |
| `/session` | Show session info (file, ID, messages, tokens, cost)<br>显示会话信息（文件、ID、消息数、token 数、费用） |
| `/tree` | Jump to any point in the session and continue from there<br>跳转到会话中的任意位置并从那里继续 |
| `/trust` | Save project trust decision for future sessions (restart required)<br>保存项目信任决定以供后续会话使用（需重启） |
| `/fork` | Create a new session from a previous user message<br>从之前的某条用户消息创建新会话 |
| `/clone` | Duplicate the current active branch into a new session<br>将当前活动分支复制为一个新会话 |
| `/compact [prompt]` | Manually compact context, optional custom instructions<br>手动压缩上下文，可附加自定义指令 |
| `/copy` | Copy last assistant message to clipboard<br>将最后一条助手消息复制到剪贴板 |
| `/export [file]` | Export session to HTML or JSONL file<br>将会话导出为 HTML 或 JSONL 文件 |
| `/import <file>` | Import and resume a session from a JSONL file<br>从 JSONL 文件导入并恢复会话 |
| `/share` | Upload as private GitHub gist with shareable HTML link<br>上传为私有 GitHub gist，并生成可分享的 HTML 链接 |
| `/reload` | Reload keybindings, extensions, skills, prompts, themes, and context files<br>重新加载快捷键、扩展、技能、提示词、主题和上下文文件 |
| `/hotkeys` | Show all keyboard shortcuts<br>显示所有键盘快捷键 |
| `/changelog` | Display version history<br>显示版本历史 |
| `/quit` | Quit pi<br>退出 pi |

### Keyboard Shortcuts 键盘快捷键

See `/hotkeys` for the full list. Customize via `~/.pi/agent/keybindings.json`. See [docs/keybindings.md](docs/keybindings.md).

完整列表请查看 `/hotkeys`。可通过 `~/.pi/agent/keybindings.json` 自定义。参见 [docs/keybindings.md](docs/keybindings.md)。

**Commonly used:**

**常用快捷键：**

| Key 按键 | Action 作用 |
|-----|--------|
| Ctrl+C | Clear editor<br>清空编辑器 |
| Ctrl+C twice<br>连按两次 Ctrl+C | Quit<br>退出 |
| Escape | Cancel/abort<br>取消/中止 |
| Escape twice<br>连按两次 Escape | Open `/tree`<br>打开 `/tree` |
| Ctrl+L | Open model selector<br>打开模型选择器 |
| Ctrl+P / Shift+Ctrl+P | Cycle scoped models forward/backward<br>向前/向后循环切换已限定范围的模型 |
| Shift+Tab | Cycle thinking level<br>循环切换思考等级 |
| Ctrl+O | Collapse/expand tool output<br>折叠/展开工具输出 |
| Ctrl+T | Collapse/expand thinking blocks<br>折叠/展开思考块 |
| Ctrl+X | Copy the last assistant message<br>复制最后一条助手消息 |

### Message Queue 消息队列

Submit messages while the agent is working:

在 agent 工作期间提交消息：

- **Enter** queues a *steering* message, delivered after the current assistant turn finishes executing its tool calls
  **Enter** 将消息作为*引导（steering）*消息入队，在当前助手回合执行完其工具调用后投递
- **Alt+Enter** queues a *follow-up* message, delivered only after the agent finishes all work
  **Alt+Enter** 将消息作为*后续（follow-up）*消息入队，仅在 agent 完成全部工作后才投递
- **Escape** aborts and restores queued messages to editor
  **Escape** 中止执行，并把队列中的消息恢复到编辑器
- **Alt+Up** retrieves queued messages back to editor
  **Alt+Up** 把队列中的消息取回编辑器

On Windows Terminal, `Alt+Enter` is fullscreen by default. Remap it in [docs/terminal-setup.md](docs/terminal-setup.md) so pi can receive the follow-up shortcut.

在 Windows Terminal 上，`Alt+Enter` 默认是全屏快捷键。请按 [docs/terminal-setup.md](docs/terminal-setup.md) 重新映射，这样 pi 才能接收到 follow-up 快捷键。

Configure delivery in [settings](docs/settings.md): `steeringMode` and `followUpMode` can be `"one-at-a-time"` (default, waits for response) or `"all"` (delivers all queued at once). `transport` selects provider transport preference (`"sse"`, `"websocket"`, or `"auto"`) for providers that support multiple transports.

在[设置](docs/settings.md)中配置投递方式：`steeringMode` 和 `followUpMode` 可设为 `"one-at-a-time"`（默认，逐条投递并等待回复）或 `"all"`（一次性投递队列中的全部消息）。`transport` 用于为支持多种传输方式的服务商选择首选传输方式（`"sse"`、`"websocket"` 或 `"auto"`）。

---

## Sessions 会话

Sessions are stored as JSONL files with a tree structure. Each entry has an `id` and `parentId`, enabling in-place branching without creating new files. See [docs/session-format.md](docs/session-format.md) for file format.

会话以树状结构存储为 JSONL 文件。每个条目都有 `id` 和 `parentId`，从而可以原地分支而无需创建新文件。文件格式参见 [docs/session-format.md](docs/session-format.md)。

### Management 会话管理

Sessions auto-save to `~/.pi/agent/sessions/` organized by working directory.

会话会按工作目录自动保存到 `~/.pi/agent/sessions/`。

```bash
pi -c                  # Continue most recent session
pi -r                  # Browse and select from past sessions
pi --no-session        # Ephemeral mode (don't save)
pi --name "my task"    # Set session display name at startup
pi --session <path|id> # Use specific session file or ID
pi --fork <path|id>    # Fork specific session file or ID into a new session
```

Use `/session` in interactive mode to see the current session ID before reusing it with `--session <id>` or `--fork <id>`.

在交互模式中使用 `/session` 查看当前会话 ID，然后可用 `--session <id>` 或 `--fork <id>` 复用它。

### Branching 分支

**`/tree`** - Navigate the session tree in-place. Select any previous point, continue from there, and switch between branches. All history preserved in a single file.

**`/tree`** - 原地浏览会话树。选择任意历史节点并从那里继续，也可在分支之间切换。全部历史都保存在同一个文件中。

<p align="center"><img src="docs/images/tree-view.png" alt="Tree View" width="600"></p>

- Search by typing, fold/unfold and jump between branches with Ctrl+←/Ctrl+→ or Alt+←/Alt+→, page with ←/→
  直接输入即可搜索，用 Ctrl+←/Ctrl+→ 或 Alt+←/Alt+→ 折叠/展开并在分支间跳转，用 ←/→ 翻页
- Filter modes (Ctrl+O): default → no-tools → user-only → labeled-only → all
  过滤模式（Ctrl+O）：default（默认）→ no-tools（隐藏工具）→ user-only（仅用户消息）→ labeled-only（仅带标签）→ all（全部）
- Press Ctrl+X to copy the selected message
  按 Ctrl+X 复制选中的消息
- Press Shift+L to label entries as bookmarks and Shift+T to toggle label timestamps
  按 Shift+L 为条目打标签作为书签，按 Shift+T 切换标签时间戳的显示

**`/fork`** - Create a new session file from a previous user message on the active branch. Opens a selector, copies the active path up to that point, and places the selected prompt in the editor for modification.

**`/fork`** - 基于当前活动分支上的某条历史用户消息创建一个新的会话文件。它会打开一个选择器，复制到该点为止的活动路径，并把选中的提示词放入编辑器以便修改。

**`/clone`** - Duplicate the current active branch into a new session file at the current position. The new session keeps the full active-path history and opens with an empty editor.

**`/clone`** - 在当前位置把当前活动分支复制到一个新的会话文件中。新会话保留完整的活动路径历史，并以空编辑器打开。

**`--fork <path|id>`** - Fork an existing session file or partial session UUID directly from the CLI. This copies the full source session into a new session file in the current project.

**`--fork <path|id>`** - 直接从 CLI 对已有会话文件或部分会话 UUID 进行 fork。它会把完整的源会话复制到当前项目下的一个新会话文件中。

### Compaction 上下文压缩

Long sessions can exhaust context windows. Compaction summarizes older messages while keeping recent ones.

长会话可能耗尽上下文窗口。压缩（compaction）会对较早的消息生成摘要，同时保留最近的消息。

**Manual:** `/compact` or `/compact <custom instructions>`

**手动：** `/compact` 或 `/compact <custom instructions>`

**Automatic:** Enabled by default. Triggers on context overflow (recovers and retries) or when approaching the limit (proactive). Configure via `/settings` or `settings.json`.

**自动：** 默认启用。在上下文溢出时触发（自动恢复并重试），或在接近上限时提前触发（主动压缩）。可通过 `/settings` 或 `settings.json` 配置。

Compaction is lossy. The full history remains in the JSONL file; use `/tree` to revisit. Customize compaction behavior via [extensions](#extensions). See [docs/compaction.md](docs/compaction.md) for internals.

压缩是有损的。完整历史仍保留在 JSONL 文件中；可用 `/tree` 回看。可通过[扩展](#extensions)自定义压缩行为。内部实现参见 [docs/compaction.md](docs/compaction.md)。

---

## Settings 设置

Use `/settings` to modify common options, or edit JSON files directly:

使用 `/settings` 修改常用选项，或直接编辑 JSON 文件：

| Location 位置 | Scope 作用范围 |
|----------|-------|
| `~/.pi/agent/settings.json` | Global (all projects)<br>全局（所有项目） |
| `.pi/settings.json` | Project (overrides global)<br>项目级（覆盖全局设置） |

See [docs/settings.md](docs/settings.md) for all options.

全部选项参见 [docs/settings.md](docs/settings.md)。

### Project Trust 项目信任

On interactive startup, pi asks before trusting a project folder that contains project-local settings, resources, or project `.agents/skills` and has no saved decision for the folder or a parent folder in `~/.pi/agent/trust.json`. Trusting a project allows pi to load `.pi/settings.json` and `.pi` resources, install missing project packages, and execute project extensions.

在交互模式启动时，如果某个项目文件夹包含项目本地设置、资源或项目级 `.agents/skills`，且 `~/.pi/agent/trust.json` 中没有针对该文件夹或其上级文件夹的已保存决定，pi 会先询问你是否信任它。信任一个项目后，pi 才能加载 `.pi/settings.json` 和 `.pi` 资源、安装缺失的项目包，并执行项目扩展。

Before the trust decision, pi loads only context files, user/global extensions, and CLI `-e` extensions so they can handle the `project_trust` event. Project-local extensions, project package-managed extensions, and project settings are loaded only after the project is trusted. This split also applies when switching to a session from a different cwd whose trust has not been resolved in the current process.

在做出信任决定之前，pi 只加载上下文文件、用户/全局扩展以及通过 CLI `-e` 指定的扩展，以便它们能处理 `project_trust` 事件。项目本地扩展、由项目包管理的扩展以及项目设置，只有在项目被信任之后才会加载。当切换到来自另一个工作目录、且在当前进程中尚未确定信任状态的会话时，同样适用这一区分。

Non-interactive modes (`-p`, `--mode json`, and `--mode rpc`) do not show a trust prompt. Without an applicable saved trust decision, they use `defaultProjectTrust` from global settings: `ask` (default) and `never` ignore those project resources, while `always` trusts them. Pass `--approve`/`-a` or `--no-approve`/`-na` to override project trust for one run.

非交互模式（`-p`、`--mode json` 和 `--mode rpc`）不会弹出信任提示。若没有适用的已保存信任决定，它们会使用全局设置中的 `defaultProjectTrust`：`ask`（默认）和 `never` 会忽略这些项目资源，而 `always` 则会信任它们。传入 `--approve`/`-a` 或 `--no-approve`/`-na` 可为单次运行覆盖项目信任设置。

If no extension or saved decision applies, `defaultProjectTrust` controls the fallback behavior. Set it to `"ask"`, `"always"`, or `"never"` in `~/.pi/agent/settings.json`, or change it with `/settings`.

如果没有扩展或已保存的决定适用，则由 `defaultProjectTrust` 决定兜底行为。可在 `~/.pi/agent/settings.json` 中将其设为 `"ask"`、`"always"` 或 `"never"`，也可以用 `/settings` 修改。

`pi config` and package commands use the same project trust flow, except `pi update` never prompts. Pass `--approve` to trust project-local settings for one command or `--no-approve` to ignore them.

`pi config` 和各类包管理命令使用相同的项目信任流程，只有 `pi update` 从不提示。传入 `--approve` 可为单条命令信任项目本地设置，或用 `--no-approve` 忽略它们。

Use `/trust` in interactive mode to save a project trust decision for future sessions, including trust for the immediate parent folder. It writes `~/.pi/agent/trust.json` only; the current session is not reloaded, so restart pi for changes to take effect.

在交互模式中使用 `/trust` 可保存项目信任决定以供后续会话使用，也包括对直接上级文件夹的信任。它只会写入 `~/.pi/agent/trust.json`；当前会话不会重新加载，因此需要重启 pi 才能生效。

### Telemetry and update checks 遥测与更新检查

Pi has two separate startup features:

Pi 有两个相互独立的启动期功能：

- **Update check:** fetches `https://pi.dev/api/latest-version` to check whether a newer Pi version exists. Disable it with `PI_SKIP_VERSION_CHECK=1`. Disabling update checks only turns off this check.
  **更新检查：** 请求 `https://pi.dev/api/latest-version` 以检查是否存在更新版本的 Pi。可用 `PI_SKIP_VERSION_CHECK=1` 禁用。禁用更新检查仅关闭这一项检查。
- **Install/update telemetry:** after first install or a changelog-detected update, sends an anonymous version ping to `https://pi.dev/api/report-install`. This setting also controls optional provider attribution headers for OpenRouter, Cloudflare, and direct NVIDIA NIM requests. Opt out by setting `enableInstallTelemetry` to `false` in `settings.json`, or by setting `PI_TELEMETRY=0`. This does not disable update checks; Pi may still contact `pi.dev` for the latest version unless update checks are disabled or offline mode is enabled.
  **安装/更新遥测：** 在首次安装后，或通过 changelog 检测到更新后，向 `https://pi.dev/api/report-install` 发送一次匿名的版本上报。该设置同时也控制针对 OpenRouter、Cloudflare 以及直连 NVIDIA NIM 请求的可选服务商归属（attribution）请求头。可在 `settings.json` 中将 `enableInstallTelemetry` 设为 `false`，或设置 `PI_TELEMETRY=0` 来退出。这不会禁用更新检查；除非禁用更新检查或启用离线模式，Pi 仍可能访问 `pi.dev` 获取最新版本。

Use `--offline` or `PI_OFFLINE=1` to disable all startup network operations described here, including update checks, package update checks, and install/update telemetry.

使用 `--offline` 或 `PI_OFFLINE=1` 可禁用此处描述的所有启动期网络操作，包括更新检查、包更新检查以及安装/更新遥测。

---

## Context Files 上下文文件

Pi loads `AGENTS.md` (or `CLAUDE.md`) at startup from:

Pi 在启动时会从以下位置加载 `AGENTS.md`（或 `CLAUDE.md`）：

- `~/.pi/agent/AGENTS.md` (global)
  `~/.pi/agent/AGENTS.md`（全局）
- Parent directories (walking up from cwd)
  各级上级目录（从当前工作目录逐级向上查找）
- Current directory
  当前目录

Use for project instructions (`AGENTS.md`/`CLAUDE.md`), conventions, common commands. All matching files are concatenated.

可用于编写项目说明（`AGENTS.md`/`CLAUDE.md`）、约定规范和常用命令。所有匹配到的文件会被拼接在一起。

Disable context file loading with `--no-context-files` (or `-nc`).

使用 `--no-context-files`（或 `-nc`）可禁用上下文文件加载。

### System Prompt 系统提示词

Replace the default system prompt with `.pi/SYSTEM.md` (project) or `~/.pi/agent/SYSTEM.md` (global). Append without replacing via `APPEND_SYSTEM.md`.

用 `.pi/SYSTEM.md`（项目级）或 `~/.pi/agent/SYSTEM.md`（全局）替换默认系统提示词。若只想追加而不替换，可使用 `APPEND_SYSTEM.md`。

---

## Customization 定制化

### Prompt Templates 提示词模板

Reusable prompts as Markdown files. Type `/name` to expand.

以 Markdown 文件形式存在的可复用提示词。输入 `/name` 即可展开。

```markdown
<!-- ~/.pi/agent/prompts/review.md -->
Review this code for bugs, security issues, and performance problems.
Focus on: {{focus}}
```

Place in `~/.pi/agent/prompts/`, `.pi/prompts/`, or a [pi package](#pi-packages) to share with others. See [docs/prompt-templates.md](docs/prompt-templates.md).

放置在 `~/.pi/agent/prompts/`、`.pi/prompts/` 或某个 [pi 包](#pi-packages)中即可分享给他人。参见 [docs/prompt-templates.md](docs/prompt-templates.md)。

### Skills 技能

On-demand capability packages following the [Agent Skills standard](https://agentskills.io). Invoke via `/skill:name` or let the agent load them automatically.

遵循 [Agent Skills 标准](https://agentskills.io)的按需能力包。可通过 `/skill:name` 调用，也可以让 agent 自动加载。

```markdown
<!-- ~/.pi/agent/skills/my-skill/SKILL.md -->
# My Skill
Use this skill when the user asks about X.

## Steps
1. Do this
2. Then that
```

Place in `~/.pi/agent/skills/`, `~/.agents/skills/`, `.pi/skills/`, or `.agents/skills/` (from `cwd` up through parent directories) or a [pi package](#pi-packages) to share with others. See [docs/skills.md](docs/skills.md).

放置在 `~/.pi/agent/skills/`、`~/.agents/skills/`、`.pi/skills/` 或 `.agents/skills/`（从 `cwd` 逐级向上查找上级目录），或某个 [pi 包](#pi-packages)中即可分享给他人。参见 [docs/skills.md](docs/skills.md)。

### Extensions 扩展

<p align="center"><img src="docs/images/doom-extension.png" alt="Doom Extension" width="600"></p>

TypeScript modules that extend pi with custom tools, commands, keyboard shortcuts, event handlers, and UI components.

用 TypeScript 编写的模块，可为 pi 扩展自定义工具、命令、键盘快捷键、事件处理器和 UI 组件。

```typescript
export default function (pi: ExtensionAPI) {
  pi.registerTool({ name: "deploy", ... });
  pi.registerCommand("stats", { ... });
  pi.on("tool_call", async (event, ctx) => { ... });
}
```

The default export can also be `async`. pi waits for async extension factories before startup continues, which is useful for one-time initialization such as fetching remote model lists before calling `pi.registerProvider()`.

默认导出也可以是 `async` 的。pi 会等待异步扩展工厂函数完成后才继续启动，这对于一次性初始化很有用，例如在调用 `pi.registerProvider()` 之前先拉取远程模型列表。

**What's possible:**

**可以做到的事情：**

- Custom tools (or replace built-in tools entirely)
  自定义工具（或完全替换内置工具）
- Sub-agents and plan mode
  子代理（sub-agents）和计划模式（plan mode）
- Custom compaction and summarization
  自定义上下文压缩与摘要生成
- Permission gates and path protection
  权限闸门与路径保护
- Custom editors and UI components
  自定义编辑器和 UI 组件
- Status lines, headers, footers
  状态行、头部、底栏
- Git checkpointing and auto-commit
  Git 检查点与自动提交
- SSH and sandbox execution
  SSH 与沙箱执行
- MCP server integration
  MCP 服务器集成
- Make pi look like Claude Code
  把 pi 的外观做成 Claude Code 的样子
- Games while waiting (yes, Doom runs)
  等待时玩游戏（没错，Doom 真能跑起来）
- ...anything you can dream up
  ……以及任何你能想到的东西

Place in `~/.pi/agent/extensions/`, `.pi/extensions/`, or a [pi package](#pi-packages) to share with others. See [docs/extensions.md](docs/extensions.md) and [examples/extensions/](examples/extensions/).

放置在 `~/.pi/agent/extensions/`、`.pi/extensions/` 或某个 [pi 包](#pi-packages)中即可分享给他人。参见 [docs/extensions.md](docs/extensions.md) 和 [examples/extensions/](examples/extensions/)。

### Themes 主题

Built-in: `dark`, `light`. Themes hot-reload: modify the active theme file and pi immediately applies changes.

内置主题：`dark`、`light`。主题支持热重载：修改当前生效的主题文件后，pi 会立即应用变更。

Place in `~/.pi/agent/themes/`, `.pi/themes/`, or a [pi package](#pi-packages) to share with others. See [docs/themes.md](docs/themes.md).

放置在 `~/.pi/agent/themes/`、`.pi/themes/` 或某个 [pi 包](#pi-packages)中即可分享给他人。参见 [docs/themes.md](docs/themes.md)。

### Pi Packages Pi 包

Bundle and share extensions, skills, prompts, and themes via npm or git. Find packages on [npmjs.com](https://www.npmjs.com/search?q=keywords%3Api-package) or [Discord](https://discord.com/channels/1456806362351669492/1457744485428629628).

将扩展、技能、提示词和主题打包，并通过 npm 或 git 分享。可在 [npmjs.com](https://www.npmjs.com/search?q=keywords%3Api-package) 或 [Discord](https://discord.com/channels/1456806362351669492/1457744485428629628) 上寻找现成的包。

> **Security:** Pi packages run with full system access. Extensions execute arbitrary code, and skills can instruct the model to perform any action including running executables. Review source code before installing third-party packages.
>
> **安全提示：** Pi 包以完整的系统权限运行。扩展会执行任意代码，技能则可以指示模型执行任何操作，包括运行可执行文件。安装第三方包之前请先审阅其源代码。

```bash
pi install npm:@foo/pi-tools
pi install npm:@foo/pi-tools@1.2.3      # pinned version
pi install git:github.com/user/repo
pi install git:github.com/user/repo@v1  # tag or commit
pi install git:git@github.com:user/repo
pi install git:git@github.com:user/repo@v1  # tag or commit
pi install https://github.com/user/repo
pi install https://github.com/user/repo@v1      # tag or commit
pi install ssh://git@github.com/user/repo
pi install ssh://git@github.com/user/repo@v1    # tag or commit
pi remove npm:@foo/pi-tools
pi uninstall npm:@foo/pi-tools          # alias for remove
pi list
pi update                               # update pi only
pi update --all                         # update pi and packages
pi update --extensions                  # update packages only
pi update --models                      # refresh model catalogs only
pi update --self                        # update pi only
pi update --self --force                # reinstall pi even if current
pi update npm:@foo/pi-tools             # update one package
pi config                               # enable/disable extensions, skills, prompts, themes
```

Packages install to `~/.pi/agent/git/` (git) or `~/.pi/agent/npm/` (npm). Use `-l` for project-local installs (`.pi/git/`, `.pi/npm/`). Git `@ref` values are pinned tags or commits; pinned packages are skipped by `pi update --extensions` and `pi update --all`, so use `pi install git:host/user/repo@new-ref` to move an existing package to a new ref. Git packages install dependencies with `npm install --omit=dev` by default, so runtime deps must be listed under `dependencies`; when `npmCommand` is configured, git packages use plain `install` for compatibility with wrappers. If you use a Node version manager and want package installs to reuse a stable npm context, set `npmCommand` in `settings.json`, for example `["mise", "exec", "node@20", "--", "npm"]`.

包会安装到 `~/.pi/agent/git/`（git 方式）或 `~/.pi/agent/npm/`（npm 方式）。使用 `-l` 可安装到项目本地（`.pi/git/`、`.pi/npm/`）。git 的 `@ref` 值表示锁定到某个 tag 或 commit；被锁定的包会被 `pi update --extensions` 和 `pi update --all` 跳过，因此要把已有包切换到新的 ref，请使用 `pi install git:host/user/repo@new-ref`。git 包默认使用 `npm install --omit=dev` 安装依赖，因此运行时依赖必须列在 `dependencies` 下；当配置了 `npmCommand` 时，git 包会使用普通的 `install` 以兼容各类包装器（wrapper）。如果你使用 Node 版本管理器，并希望包安装时复用稳定的 npm 环境，可在 `settings.json` 中设置 `npmCommand`，例如 `["mise", "exec", "node@20", "--", "npm"]`。

Create a package by adding a `pi` key to `package.json`:

在 `package.json` 中添加一个 `pi` 字段即可创建一个包：

```json
{
  "name": "my-pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"],
    "themes": ["./themes"]
  }
}
```

Without a `pi` manifest, pi auto-discovers from conventional directories (`extensions/`, `skills/`, `prompts/`, `themes/`).

如果没有 `pi` 清单（manifest），pi 会自动从约定的目录（`extensions/`、`skills/`、`prompts/`、`themes/`）中发现资源。

See [docs/packages.md](docs/packages.md).

参见 [docs/packages.md](docs/packages.md)。

---

## Programmatic Usage 编程式用法

### SDK

```typescript
import { createAgentSession, ModelRuntime, SessionManager } from "@earendil-works/pi-coding-agent";

const modelRuntime = await ModelRuntime.create();
const { session } = await createAgentSession({
  sessionManager: SessionManager.inMemory(),
  modelRuntime,
});

await session.prompt("What files are in the current directory?");
```

For advanced multi-session runtime replacement, use `createAgentSessionRuntime()` and `AgentSessionRuntime`.

若需要更高级的多会话运行时替换能力，请使用 `createAgentSessionRuntime()` 和 `AgentSessionRuntime`。

See [docs/sdk.md](docs/sdk.md) and [examples/sdk/](examples/sdk/).

参见 [docs/sdk.md](docs/sdk.md) 和 [examples/sdk/](examples/sdk/)。

### RPC Mode RPC 模式

For non-Node.js integrations, use RPC mode over stdin/stdout:

对于非 Node.js 的集成场景，可通过 stdin/stdout 使用 RPC 模式：

```bash
pi --mode rpc
```

RPC mode uses strict LF-delimited JSONL framing. Clients must split records on `\n` only. Do not use generic line readers like Node `readline`, which also split on Unicode separators inside JSON payloads.

RPC 模式采用严格的以 LF 分隔的 JSONL 帧格式。客户端必须只按 `\n` 切分记录。不要使用像 Node `readline` 这样的通用行读取器，它还会在 JSON 负载内部的 Unicode 分隔符处切分。

See [docs/rpc.md](docs/rpc.md) for the protocol.

协议细节参见 [docs/rpc.md](docs/rpc.md)。

---

## Philosophy 设计理念

Pi is aggressively extensible so it doesn't have to dictate your workflow. Features that other tools bake in can be built with [extensions](#extensions), [skills](#skills), or installed from third-party [pi packages](#pi-packages). This keeps the core minimal while letting you shape pi to fit how you work.

Pi 追求极致的可扩展性，因此不必替你规定工作流。其他工具内置的功能，在这里都可以用[扩展](#extensions)、[技能](#skills)来实现，或者从第三方 [pi 包](#pi-packages)安装。这样既能保持内核极简，又能让你把 pi 塑造成契合自己工作方式的样子。

**No MCP.** Build CLI tools with READMEs (see [Skills](#skills)), or build an extension that adds MCP support. [Why?](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)

**不内置 MCP。** 请编写带 README 的 CLI 工具（参见[技能](#skills)），或者做一个扩展来添加 MCP 支持。[为什么？](https://mariozechner.at/posts/2025-11-02-what-if-you-dont-need-mcp/)

**No sub-agents.** There's many ways to do this. Spawn pi instances via tmux, or build your own with [extensions](#extensions), or install a package that does it your way.

**不内置子代理（sub-agents）。** 实现方式有很多种：通过 tmux 启动多个 pi 实例，用[扩展](#extensions)自行实现，或者安装一个符合你习惯的包。

**No permission popups.** Run in a container, or build your own confirmation flow with [extensions](#extensions) inline with your environment and security requirements.

**不内置权限弹窗。** 请在容器中运行，或者用[扩展](#extensions)按照你自己的环境和安全要求构建确认流程。

**No plan mode.** Write plans to files, or build it with [extensions](#extensions), or install a package.

**不内置计划模式（plan mode）。** 把计划写进文件，或者用[扩展](#extensions)实现，或者安装一个包。

**No built-in to-dos.** They confuse models. Use a TODO.md file, or build your own with [extensions](#extensions).

**不内置待办事项（to-dos）。** 它们会让模型产生困惑。请使用 TODO.md 文件，或者用[扩展](#extensions)自行实现。

**No background bash.** Use tmux. Full observability, direct interaction.

**不内置后台 bash。** 请使用 tmux，可获得完整的可观测性和直接交互能力。

Read the [blog post](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) for the full rationale.

完整的设计理由请阅读这篇[博客文章](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)。

---

## CLI Reference CLI 参考

```bash
pi [options] [@files...] [messages...]
```

### Package Commands 包管理命令

```bash
pi install <source> [-l]     # Install package, -l for project-local
pi remove <source> [-l]      # Remove package
pi uninstall <source> [-l]   # Alias for remove
pi update [source|self|pi]   # Update pi only, or one package source
pi update --all              # Update pi and packages
pi update --extensions       # Update packages only
pi update --models           # Refresh model catalogs only
pi update --self             # Update pi only
pi update --self --force     # Reinstall pi even if current
pi update --extension <src>  # Update one package
pi list                      # List installed packages
pi config                    # Enable/disable package resources
```

`pi config` and project package commands accept `--approve`/`--no-approve` to trust or ignore project-local settings for one command. `pi update` never prompts for project trust.

`pi config` 和项目相关的包管理命令支持 `--approve`/`--no-approve`，用于为单条命令信任或忽略项目本地设置。`pi update` 从不就项目信任进行提示。

### Modes 运行模式

| Flag 参数 | Description 说明 |
|------|-------------|
| (default) | Interactive mode<br>交互模式 |
| `-p`, `--print` | Print response and exit<br>打印回复后退出 |
| `--mode json` | Output all events as JSON lines (see [docs/json.md](docs/json.md))<br>以 JSON 行的形式输出所有事件（参见 [docs/json.md](docs/json.md)） |
| `--mode rpc` | RPC mode for process integration (see [docs/rpc.md](docs/rpc.md))<br>用于进程集成的 RPC 模式（参见 [docs/rpc.md](docs/rpc.md)） |
| `--export <in> [out]` | Export session to HTML<br>将会话导出为 HTML |

In print mode, pi also reads piped stdin and merges it into the initial prompt:

在打印模式下，pi 还会读取通过管道传入的 stdin，并把它合并到初始提示词中：

```bash
cat README.md | pi -p "Summarize this text"
```

### Model Options 模型选项

| Option 选项 | Description 说明 |
|--------|-------------|
| `--provider <name>` | Provider (anthropic, openai, google, etc.)<br>服务商（anthropic、openai、google 等） |
| `--model <pattern>` | Model pattern or ID (supports `provider/id` and optional `:<thinking>`)<br>模型匹配模式或 ID（支持 `provider/id` 以及可选的 `:<thinking>`） |
| `--api-key <key>` | API key (overrides env vars)<br>API key（优先级高于环境变量） |
| `--thinking <level>` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`<br>思考等级：`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` |
| `--models <patterns>` | Comma-separated patterns for Ctrl+P cycling<br>用于 Ctrl+P 循环切换的模式列表，以逗号分隔 |
| `--list-models [search]` | List available models<br>列出可用模型 |

### Session Options 会话选项

| Option 选项 | Description 说明 |
|--------|-------------|
| `-c`, `--continue` | Continue most recent session<br>继续最近一次会话 |
| `-r`, `--resume` | Browse and select session<br>浏览并选择会话 |
| `--session <path\|id>` | Use specific session file or partial UUID<br>使用指定的会话文件或部分 UUID |
| `--fork <path\|id>` | Fork specific session file or partial UUID into a new session<br>将指定会话文件或部分 UUID fork 为一个新会话 |
| `--session-dir <dir>` | Custom session storage directory<br>自定义会话存储目录 |
| `--no-session` | Ephemeral mode (don't save)<br>临时模式（不保存） |
| `--name <name>`, `-n <name>` | Set session display name at startup<br>在启动时设置会话显示名称 |

### Tool Options 工具选项

| Option 选项 | Description 说明 |
|--------|-------------|
| `--tools <list>`, `-t <list>` | Allowlist specific tool names across built-in, extension, and custom tools<br>在内置工具、扩展工具和自定义工具中，按名称设置允许使用的工具白名单 |
| `--exclude-tools <list>`, `-xt <list>` | Disable specific tool names across built-in, extension, and custom tools<br>在内置工具、扩展工具和自定义工具中，按名称禁用指定工具 |
| `--no-builtin-tools`, `-nbt` | Disable built-in tools by default but keep extension/custom tools enabled<br>默认禁用内置工具，但仍保持扩展/自定义工具可用 |
| `--no-tools`, `-nt` | Disable all tools by default<br>默认禁用所有工具 |

Available built-in tools: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`

可用的内置工具：`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`

### Resource Options 资源选项

| Option 选项 | Description 说明 |
|--------|-------------|
| `-e`, `--extension <source>` | Load extension from path, npm, or git (repeatable)<br>从路径、npm 或 git 加载扩展（可重复指定） |
| `--no-extensions` | Disable extension discovery<br>禁用扩展自动发现 |
| `--skill <path>` | Load skill (repeatable)<br>加载技能（可重复指定） |
| `--no-skills` | Disable skill discovery<br>禁用技能自动发现 |
| `--prompt-template <path>` | Load prompt template (repeatable)<br>加载提示词模板（可重复指定） |
| `--no-prompt-templates` | Disable prompt template discovery<br>禁用提示词模板自动发现 |
| `--theme <path>` | Load theme (repeatable)<br>加载主题（可重复指定） |
| `--no-themes` | Disable theme discovery<br>禁用主题自动发现 |
| `--no-context-files`, `-nc` | Disable AGENTS.md and CLAUDE.md context file discovery<br>禁用 AGENTS.md 和 CLAUDE.md 上下文文件的自动发现 |

Combine `--no-*` with explicit flags to load exactly what you need, ignoring settings.json (e.g., `--no-extensions -e ./my-ext.ts`).

将 `--no-*` 与显式参数组合使用，可以在忽略 settings.json 的情况下精确加载你需要的内容（例如 `--no-extensions -e ./my-ext.ts`）。

### Other Options 其他选项

| Option 选项 | Description 说明 |
|--------|-------------|
| `--system-prompt <text>` | Replace default prompt (context files and skills still appended)<br>替换默认系统提示词（上下文文件和技能仍会被追加） |
| `--append-system-prompt <text>` | Append to system prompt<br>追加到系统提示词末尾 |
| `--alt` | Use the alternate-screen TUI with application-owned scrolling in interactive mode<br>在交互模式下使用备用屏幕（alternate-screen）TUI，由应用自身管理滚动 |
| `--verbose` | Force verbose startup<br>强制以详细模式启动 |
| `-a`, `--approve` | Trust project-local files for this run<br>本次运行信任项目本地文件 |
| `-na`, `--no-approve` | Ignore project-local files for this run<br>本次运行忽略项目本地文件 |
| `-h`, `--help` | Show help<br>显示帮助 |
| `-v`, `--version` | Show version<br>显示版本 |

### File Arguments 文件参数

Prefix files with `@` to include in the message:

在文件前加 `@` 前缀即可将其包含进消息中：

```bash
pi @prompt.md "Answer this"
pi -p @screenshot.png "What's in this image?"
pi @code.ts @test.ts "Review these files"
```

### Examples 示例

```bash
# Interactive with initial prompt
pi "List all .ts files in src/"

# Non-interactive
pi -p "Summarize this codebase"

# Non-interactive with piped stdin
cat README.md | pi -p "Summarize this text"

# Named one-shot session
pi --name "release audit" -p "Audit this repository"

# Different model
pi --provider openai --model gpt-4o "Help me refactor"

# Model with provider prefix (no --provider needed)
pi --model openai/gpt-4o "Help me refactor"

# Model with thinking level shorthand
pi --model sonnet:high "Solve this complex problem"

# Limit model cycling
pi --models "claude-*,gpt-4o"

# Read-only mode
pi --tools read,grep,find,ls -p "Review the code"

# Disable one extension or built-in tool while keeping the rest available
pi --exclude-tools ask_question

# High thinking level
pi --thinking high "Solve this complex problem"
```

### Environment Variables 环境变量

| Variable 变量 | Description 说明 |
|----------|-------------|
| `PI_CODING_AGENT` | Set to `true` by the CLI and RPC entry points so child processes can detect that they run inside Pi<br>由 CLI 和 RPC 入口设置为 `true`，便于子进程判断自己运行在 Pi 内部 |
| `PI_CODING_AGENT_DIR` | Override config directory (default: `~/.pi/agent`)<br>覆盖配置目录（默认为 `~/.pi/agent`） |
| `PI_CODING_AGENT_SESSION_DIR` | Override session storage directory (overridden by `--session-dir`)<br>覆盖会话存储目录（会被 `--session-dir` 覆盖） |
| `PI_PACKAGE_DIR` | Override package directory (useful for Nix/Guix where store paths tokenize poorly)<br>覆盖包目录（在 Nix/Guix 等 store 路径分词效果不佳的环境中很有用） |
| `PI_OFFLINE` | Disable startup network operations, including update checks, package update checks, and install/update telemetry<br>禁用启动期的网络操作，包括更新检查、包更新检查以及安装/更新遥测 |
| `PI_SKIP_VERSION_CHECK` | Skip the Pi version update check at startup. This prevents the `pi.dev` latest-version request<br>跳过启动时的 Pi 版本更新检查，从而不会向 `pi.dev` 发起最新版本请求 |
| `PI_TELEMETRY` | Override install/update telemetry and provider attribution headers. Use `1`/`true`/`yes` to enable or `0`/`false`/`no` to disable. This does not disable update checks<br>覆盖安装/更新遥测以及服务商归属请求头的设置。用 `1`/`true`/`yes` 启用，用 `0`/`false`/`no` 禁用。这不会禁用更新检查 |
| `PI_CACHE_RETENTION` | Set to `long` for extended prompt cache (Anthropic: 1h, OpenAI: 24h)<br>设为 `long` 可启用更长的提示词缓存（Anthropic：1 小时，OpenAI：24 小时） |
| `VISUAL`, `EDITOR` | Fallback external editor for Ctrl+G when `externalEditor` is unset; defaults to Notepad on Windows and `nano` elsewhere<br>当未设置 `externalEditor` 时，Ctrl+G 使用的兜底外部编辑器；Windows 上默认为记事本，其他平台默认为 `nano` |

Commands run by the LLM-callable bash tool also receive current session metadata:

由 LLM 可调用的 bash 工具执行的命令，还会收到当前会话的元数据：

| Variable 变量 | Description 说明 |
|----------|-------------|
| `PI_SESSION_ID` | Current session ID<br>当前会话 ID |
| `PI_SESSION_FILE` | Absolute session JSONL path; unset for ephemeral sessions<br>会话 JSONL 文件的绝对路径；临时会话下该变量不设置 |
| `PI_PROVIDER` | Currently selected model provider<br>当前选中的模型服务商 |
| `PI_MODEL` | Currently selected model ID<br>当前选中的模型 ID |
| `PI_REASONING_LEVEL` | Current effective reasoning level<br>当前实际生效的推理等级 |

These values are resolved when each command starts. See [Environment Variables](docs/environment-variables.md#bash-tool-session-environment) for semantics, examples, and custom-tool opt-out.

这些值在每条命令启动时解析确定。语义说明、示例以及自定义工具的退出方式，参见[环境变量文档](docs/environment-variables.md#bash-tool-session-environment)。

---

## Contributing & Development 贡献与开发

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines and [docs/development.md](docs/development.md) for setup, forking, and debugging.

贡献指南参见 [CONTRIBUTING.md](../../CONTRIBUTING.md)；环境搭建、fork 与调试方法参见 [docs/development.md](docs/development.md)。

## License 许可证

MIT

## See Also 另请参阅

- [@earendil-works/pi-ai](https://www.npmjs.com/package/@earendil-works/pi-ai): Core LLM toolkit
  [@earendil-works/pi-ai](https://www.npmjs.com/package/@earendil-works/pi-ai)：核心 LLM 工具库
- [@earendil-works/pi-agent-core](https://www.npmjs.com/package/@earendil-works/pi-agent-core): Agent framework
  [@earendil-works/pi-agent-core](https://www.npmjs.com/package/@earendil-works/pi-agent-core)：Agent 框架
- [@earendil-works/pi-tui](https://www.npmjs.com/package/@earendil-works/pi-tui): Terminal UI components
  [@earendil-works/pi-tui](https://www.npmjs.com/package/@earendil-works/pi-tui)：终端 UI 组件

<p align="center">
  <a href="https://pi.dev">pi.dev</a> domain graciously donated by
  <br /><br />
  <a href="https://exe.dev"><img src="docs/images/exy.png" alt="Exy mascot" width="48" /><br />exe.dev</a>
</p>
