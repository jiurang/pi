# Using Pi 使用 Pi

This page collects day-to-day usage details that do not fit on the quickstart page.
本页汇总了不适合放在快速上手页面的日常使用细节。

## Interactive Mode 交互模式

<p align="center"><img src="images/interactive-mode.png" alt="Interactive Mode" width="600"></p>

The interface has four main areas:
界面包含四个主要区域:

- **Startup header** - shortcuts, loaded context files, prompt templates, skills, and extensions
  **启动头部(Startup header)** - 快捷键、已加载的上下文文件、提示词模板(prompt templates)、技能(skills)和扩展(extensions)
- **Messages** - user messages, assistant responses, tool calls, tool results, notifications, errors, and extension UI
  **消息区(Messages)** - 用户消息、助手响应、工具调用、工具结果、通知、错误以及扩展 UI
- **Editor** - where you type; border color indicates the current thinking level
  **编辑器(Editor)** - 你输入内容的地方;边框颜色表示当前的思考级别(thinking level)
- **Footer** - working directory, session name, token/cache usage, cost, context usage, and current model. Totals include assistant responses, usage reported by tools, and summary generation.
  **底栏(Footer)** - 工作目录、会话名称、token/缓存用量、费用、上下文用量以及当前模型。总计包含助手响应、工具上报的用量以及摘要生成。

The editor can be replaced temporarily by built-in UI such as `/settings` or by custom extension UI.
编辑器可被内置 UI(如 `/settings`)或自定义扩展 UI 临时替换。

### Editor Features 编辑器功能

| Feature | How |
|---------|-----|
| File reference<br>文件引用 | Type `@` to fuzzy-search project files<br>输入 `@` 以模糊搜索项目文件 |
| Path completion<br>路径补全 | Press Tab to complete paths<br>按 Tab 补全路径 |
| Multi-line input<br>多行输入 | Shift+Enter, or Ctrl+Enter on Windows Terminal<br>Shift+Enter,在 Windows Terminal 上为 Ctrl+Enter |
| Copy response<br>复制响应 | Ctrl+X copies the last assistant message; in `/tree`, it copies the selected message<br>Ctrl+X 复制最后一条助手消息;在 `/tree` 中则复制所选消息 |
| Images<br>图片 | Paste with Ctrl+V, Alt+V on Windows, or drag into the terminal<br>用 Ctrl+V 粘贴(Windows 上为 Alt+V),或拖入终端 |
| Shell command<br>Shell 命令 | `!command` runs and sends output to the model<br>`!command` 执行并将输出发送给模型 |
| Hidden shell command<br>隐藏 Shell 命令 | `!!command` runs without sending output to the model<br>`!!command` 执行但不将输出发送给模型 |
| External editor<br>外部编辑器 | Ctrl+G opens `externalEditor`, `$VISUAL`, `$EDITOR`, Notepad on Windows, or `nano` elsewhere<br>Ctrl+G 打开 `externalEditor`、`$VISUAL`、`$EDITOR`,Windows 上为记事本(Notepad),其他平台为 `nano` |

See [Keybindings](keybindings.md) for all shortcuts and customization.
全部快捷键与自定义方式参见 [Keybindings](keybindings.md)。

## Slash Commands 斜杠命令

Type `/` in the editor to open command completion. Extensions can register custom commands, skills are available as `/skill:name`, and prompt templates expand via `/templatename`.
在编辑器中输入 `/` 打开命令补全。扩展可以注册自定义命令,技能以 `/skill:name` 的形式提供,提示词模板通过 `/templatename` 展开。

| Command | Description |
|---------|-------------|
| `/login`, `/logout` | Manage OAuth or API-key credentials<br>管理 OAuth 或 API key 凭据 |
| [`/llama`](llama-cpp.md) | Download, load, and unload llama.cpp router models<br>下载、加载和卸载 llama.cpp 路由模型 |
| `/model` | Switch models<br>切换模型 |
| `/scoped-models` | Enable/disable models for Ctrl+P cycling<br>启用/禁用可通过 Ctrl+P 循环切换的模型 |
| `/settings` | Thinking level, theme, message delivery, transport<br>思考级别、主题、消息投递方式、传输方式 |
| `/resume` | Pick from previous sessions<br>从既往会话中选择 |
| `/new` | Start a new session<br>开始一个新会话 |
| `/name <name>` | Set session display name<br>设置会话显示名称 |
| `/session` | Show session file, ID, messages, tokens, and cost<br>显示会话文件、ID、消息、token 和费用 |
| `/tree` | Jump to any point in the session and continue from there<br>跳转到会话中的任意位置并从该处继续 |
| `/trust` | Save project trust decision for future sessions<br>保存项目信任决定以供后续会话使用 |
| `/fork` | Create a new session from a previous user message<br>从之前的某条用户消息创建新会话 |
| `/clone` | Duplicate the current active branch into a new session<br>将当前活动分支复制为一个新会话 |
| `/compact [prompt]` | Manually compact context, optionally with custom instructions<br>手动压缩上下文,可附带自定义指令 |
| `/copy` | Copy last assistant message to clipboard<br>将最后一条助手消息复制到剪贴板 |
| `/export [file]` | Export session to HTML or JSONL<br>将会话导出为 HTML 或 JSONL |
| `/import <file>` | Import and resume a session from a JSONL file<br>从 JSONL 文件导入并恢复会话 |
| `/share` | Upload as private GitHub gist with shareable HTML link<br>上传为私有 GitHub gist 并生成可分享的 HTML 链接 |
| `/reload` | Reload keybindings, extensions, skills, prompts, themes, and context files<br>重新加载快捷键绑定、扩展、技能、提示词、主题和上下文文件 |
| `/hotkeys` | Show all keyboard shortcuts<br>显示所有键盘快捷键 |
| `/changelog` | Display version history<br>显示版本历史 |
| `/quit` | Quit pi<br>退出 pi |

## Message Queue 消息队列

You can submit messages while the agent is still working:
在 agent 仍在工作时,你也可以提交消息:

- **Enter** queues a steering message, delivered after the current assistant turn finishes executing its tool calls.
  **Enter** 将消息作为引导消息(steering message)入队,在当前助手轮次执行完其工具调用后投递。
- **Alt+Enter** queues a follow-up message, delivered after the agent finishes all work.
  **Alt+Enter** 将消息作为后续消息(follow-up message)入队,在 agent 完成全部工作后投递。
- **Escape** aborts and restores queued messages to the editor.
  **Escape** 中止并将排队中的消息恢复到编辑器。
- **Alt+Up** retrieves queued messages back to the editor.
  **Alt+Up** 将排队中的消息取回编辑器。

On Windows Terminal, Alt+Enter is fullscreen by default. Remap it as described in [Terminal setup](terminal-setup.md) if you want pi to receive the shortcut.
在 Windows Terminal 上,Alt+Enter 默认是全屏快捷键。如果你希望该快捷键传递给 pi,请按 [Terminal setup](terminal-setup.md) 中的说明重新映射。

Configure delivery in [Settings](settings.md) with `steeringMode` and `followUpMode`.
在 [Settings](settings.md) 中通过 `steeringMode` 和 `followUpMode` 配置投递方式。

## Sessions 会话

Sessions are saved automatically to `~/.pi/agent/sessions/`, organized by working directory.
会话会自动保存到 `~/.pi/agent/sessions/`,并按工作目录组织。

```bash
pi -c                  # Continue most recent session
pi -r                  # Browse and select a session
pi --no-session        # Ephemeral mode; do not save
pi --name "my task"    # Set session display name at startup
pi --session <path|id> # Use a specific session file or session ID
pi --fork <path|id>    # Fork a session into a new session file
```

Useful session commands:
常用的会话命令:

- `/session` shows the current session file and ID.
  `/session` 显示当前会话文件和 ID。
- `/tree` navigates the in-file session tree and can summarize abandoned branches.
  `/tree` 浏览文件内的会话树,并可对已放弃的分支生成摘要。
- `/fork` creates a new session from an earlier user message.
  `/fork` 从较早的一条用户消息创建新会话。
- `/clone` duplicates the current active branch into a new session file.
  `/clone` 将当前活动分支复制到一个新的会话文件中。
- `/compact` summarizes older messages to free context.
  `/compact` 对较早的消息生成摘要以释放上下文空间。

See [Sessions](sessions.md) and [Compaction](compaction.md) for details.
详情参见 [Sessions](sessions.md) 和 [Compaction](compaction.md)。

## Context Files 上下文文件

Pi loads `AGENTS.md` or `CLAUDE.md` at startup from:
Pi 在启动时会从以下位置加载 `AGENTS.md` 或 `CLAUDE.md`:

- `~/.pi/agent/AGENTS.md` for global instructions
  `~/.pi/agent/AGENTS.md`,用于全局指令
- parent directories, walking up from the current working directory
  父级目录,从当前工作目录逐级向上查找
- the current directory
  当前目录

Use context files for project conventions, commands, safety rules, and preferences. Disable loading with `--no-context-files` or `-nc`.
可以用上下文文件记录项目约定、常用命令、安全规则和偏好设置。使用 `--no-context-files` 或 `-nc` 可禁用加载。

### System Prompt Files 系统提示词文件

Replace the default system prompt with:
可通过以下文件替换默认的系统提示词:

- `.pi/SYSTEM.md` for a project
  `.pi/SYSTEM.md`,针对单个项目
- `~/.pi/agent/SYSTEM.md` globally
  `~/.pi/agent/SYSTEM.md`,全局生效

Append to the default prompt without replacing it with `APPEND_SYSTEM.md` in either location.
若只想追加内容而不替换默认提示词,可在上述任一位置放置 `APPEND_SYSTEM.md`。

### Project Trust 项目信任

On interactive startup, pi asks before trusting a project folder that contains project-local settings, resources, or project `.agents/skills` and has no saved decision for the folder or a parent folder in `~/.pi/agent/trust.json`. Trusting a project allows pi to load `.pi/settings.json` and `.pi` resources, install missing project packages, and execute project extensions.
在交互模式启动时,如果项目文件夹包含项目本地设置、资源或项目 `.agents/skills`,且 `~/.pi/agent/trust.json` 中没有针对该文件夹或其父文件夹的已保存决定,pi 会先询问是否信任该项目。信任项目后,pi 才能加载 `.pi/settings.json` 和 `.pi` 资源、安装缺失的项目包并执行项目扩展。

Before the trust decision, pi loads only context files, user/global extensions, and CLI `-e` extensions so they can handle the `project_trust` event. Project-local extensions, project package-managed extensions, and project settings are loaded only after the project is trusted. This split also applies when switching to a session from a different cwd whose trust has not been resolved in the current process.
在做出信任决定之前,pi 只加载上下文文件、用户/全局扩展以及通过 CLI `-e` 指定的扩展,以便它们能够处理 `project_trust` 事件。项目本地扩展、由项目包管理的扩展以及项目设置只有在项目被信任后才会加载。当切换到来自另一个 cwd、且其信任状态在当前进程中尚未确定的会话时,同样遵循这一区分。

Non-interactive modes (`-p`, `--mode json`, and `--mode rpc`) do not show a trust prompt. Without an applicable saved trust decision, they use `defaultProjectTrust` from global settings: `ask` (default) and `never` ignore those project resources, while `always` trusts them. Pass `--approve`/`-a` or `--no-approve`/`-na` to override project trust for one run.
非交互模式(`-p`、`--mode json` 和 `--mode rpc`)不会显示信任提示。在没有适用的已保存信任决定时,它们会使用全局设置中的 `defaultProjectTrust`:`ask`(默认)和 `never` 会忽略这些项目资源,而 `always` 则信任它们。可传入 `--approve`/`-a` 或 `--no-approve`/`-na` 为单次运行覆盖项目信任设置。

If no extension or saved decision applies, `defaultProjectTrust` controls the fallback behavior. Set it to `"ask"`, `"always"`, or `"never"` in `~/.pi/agent/settings.json`, or change it with `/settings`.
如果没有扩展或已保存的决定适用,则由 `defaultProjectTrust` 控制回退行为。可在 `~/.pi/agent/settings.json` 中将其设为 `"ask"`、`"always"` 或 `"never"`,也可以用 `/settings` 修改。

`pi config` and package commands use the same project trust flow, except `pi update` never prompts. Pass `--approve` to trust project-local settings for one command or `--no-approve` to ignore them.
`pi config` 和各包管理命令使用相同的项目信任流程,只有 `pi update` 从不提示。传入 `--approve` 可在单条命令中信任项目本地设置,传入 `--no-approve` 则忽略它们。

Use `/trust` in interactive mode to save a project trust decision for future sessions, including trust for the immediate parent folder. It writes `~/.pi/agent/trust.json` only; the current session is not reloaded, so restart pi for changes to take effect.
在交互模式中使用 `/trust` 可保存项目信任决定供后续会话使用,也包括对直接父文件夹的信任。它只会写入 `~/.pi/agent/trust.json`;当前会话不会重新加载,因此需要重启 pi 才能生效。


## Exporting and Sharing Sessions 导出与分享会话

Use `/export [file]` to write a session to HTML.
使用 `/export [file]` 将会话写出为 HTML。

Use `/share` to upload a private GitHub gist with a shareable HTML link.
使用 `/share` 上传为私有 GitHub gist,并获得可分享的 HTML 链接。

If you use pi for open source work and want to publish sessions for model, prompt, tool, and evaluation research, see [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf). It publishes sessions to Hugging Face datasets.
如果你将 pi 用于开源工作,并希望公开会话以用于模型、提示词、工具和评测方面的研究,请参见 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。它可将会话发布到 Hugging Face 数据集。

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
pi update --all              # Update pi and packages; reconcile pinned git refs
pi update --extensions       # Update packages only; reconcile pinned git refs
pi update --models           # Refresh model catalogs only
pi update --self             # Update pi only
pi update --extension <src>  # Update one package
pi list                      # List installed packages
pi config                    # Enable/disable package resources
```

These commands manage pi packages and `pi update` can update the pi CLI installation. To uninstall pi itself, see [Quickstart](quickstart.md#uninstall). `pi config` and project package commands accept `--approve`/`--no-approve` to trust or ignore project-local settings for one command. `pi update` never prompts for project trust.
这些命令用于管理 pi 包,`pi update` 还可以更新 pi CLI 本身的安装。要卸载 pi 本身,请参见 [Quickstart](quickstart.md#uninstall)。`pi config` 和项目包管理命令接受 `--approve`/`--no-approve`,用于在单条命令中信任或忽略项目本地设置。`pi update` 从不提示项目信任。

See [Pi Packages](packages.md) for package sources and security notes.
包来源与安全说明参见 [Pi Packages](packages.md)。

### Modes 运行模式

| Flag | Description |
|------|-------------|
| default<br>默认 | Interactive mode<br>交互模式 |
| `-p`, `--print` | Print response and exit<br>打印响应后退出 |
| `--mode json` | Output all events as JSON lines; see [JSON mode](json.md)<br>以 JSON 行的形式输出所有事件;参见 [JSON mode](json.md) |
| `--mode rpc` | RPC mode over stdin/stdout; see [RPC mode](rpc.md)<br>基于 stdin/stdout 的 RPC 模式;参见 [RPC mode](rpc.md) |
| `--export <in> [out]` | Export a session to HTML<br>将会话导出为 HTML |

In print mode, pi also reads piped stdin and merges it into the initial prompt:
在打印模式(print mode)下,pi 还会读取管道传入的 stdin,并将其合并到初始提示词中:

```bash
cat README.md | pi -p "Summarize this text"
```

### Model Options 模型选项

| Option | Description |
|--------|-------------|
| `--provider <name>` | Provider, such as `anthropic`, `openai`, or `google`<br>提供商(provider),例如 `anthropic`、`openai` 或 `google` |
| `--model <pattern>` | Model pattern or ID; supports `provider/id` and optional `:<thinking>`<br>模型匹配模式或 ID;支持 `provider/id` 以及可选的 `:<thinking>` |
| `--api-key <key>` | API key, overriding environment variables<br>API key,优先级高于环境变量 |
| `--thinking <level>` | `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`<br>思考级别:`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` |
| `--models <patterns>` | Comma-separated patterns for Ctrl+P cycling<br>用逗号分隔的匹配模式,用于 Ctrl+P 循环切换 |
| `--list-models [search]` | List available models<br>列出可用模型 |

### Session Options 会话选项

| Option | Description |
|--------|-------------|
| `-c`, `--continue` | Continue the most recent session<br>继续最近一次会话 |
| `-r`, `--resume` | Browse and select a session<br>浏览并选择一个会话 |
| `--session <path\|id>` | Use a specific session file or partial UUID<br>使用指定的会话文件或部分 UUID |
| `--fork <path\|id>` | Fork a session file or partial UUID into a new session<br>将某个会话文件或部分 UUID 派生(fork)为新会话 |
| `--session-dir <dir>` | Custom session storage directory<br>自定义会话存储目录 |
| `--no-session` | Ephemeral mode; do not save<br>临时模式;不保存会话 |
| `--name <name>`, `-n <name>` | Set session display name at startup<br>在启动时设置会话显示名称 |

### Tool Options 工具选项

| Option | Description |
|--------|-------------|
| `--tools <list>`, `-t <list>` | Allowlist specific built-in, extension, and custom tools<br>将指定的内置工具、扩展工具和自定义工具加入允许列表 |
| `--exclude-tools <list>`, `-xt <list>` | Disable specific built-in, extension, and custom tools<br>禁用指定的内置工具、扩展工具和自定义工具 |
| `--no-builtin-tools`, `-nbt` | Disable built-in tools but keep extension/custom tools enabled<br>禁用内置工具,但保留扩展/自定义工具可用 |
| `--no-tools`, `-nt` | Disable all tools<br>禁用所有工具 |

Built-in tools: `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`.
内置工具:`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`。

### Resource Options 资源选项

| Option | Description |
|--------|-------------|
| `-e`, `--extension <source>` | Load an extension from path, npm, or git; repeatable<br>从路径、npm 或 git 加载扩展;可重复指定 |
| `--no-extensions` | Disable extension discovery<br>禁用扩展发现 |
| `--skill <path>` | Load a skill; repeatable<br>加载一个技能;可重复指定 |
| `--no-skills` | Disable skill discovery<br>禁用技能发现 |
| `--prompt-template <path>` | Load a prompt template; repeatable<br>加载一个提示词模板;可重复指定 |
| `--no-prompt-templates` | Disable prompt template discovery<br>禁用提示词模板发现 |
| `--theme <path>` | Load a theme; repeatable<br>加载一个主题;可重复指定 |
| `--no-themes` | Disable theme discovery<br>禁用主题发现 |
| `--no-context-files`, `-nc` | Disable `AGENTS.md` and `CLAUDE.md` discovery<br>禁用 `AGENTS.md` 和 `CLAUDE.md` 的发现 |

Combine `--no-*` with explicit flags to load exactly what you need, ignoring settings. Example:
将 `--no-*` 与显式标志组合使用,可以忽略设置文件,只加载你需要的内容。示例:

```bash
pi --no-extensions -e ./my-extension.ts
```

### Other Options 其他选项

| Option | Description |
|--------|-------------|
| `--system-prompt <text>` | Replace default prompt; context files and skills are still appended<br>替换默认提示词;上下文文件和技能仍会被追加 |
| `--append-system-prompt <text>` | Append to system prompt<br>追加到系统提示词 |
| `--alt` | Use the alternate-screen TUI with a scrollable transcript and fixed editor/status/footer dock<br>使用备用屏幕(alternate-screen)TUI,包含可滚动的对话记录以及固定的编辑器/状态/底栏区域 |
| `--verbose` | Force verbose startup<br>强制以详细模式启动 |
| `-a`, `--approve` | Trust project-local files for this run<br>本次运行信任项目本地文件 |
| `-na`, `--no-approve` | Ignore project-local files for this run<br>本次运行忽略项目本地文件 |
| `-h`, `--help` | Show help<br>显示帮助 |
| `-v`, `--version` | Show version<br>显示版本 |

When `--alt` is active, the transcript scrolls inside the terminal viewport while queued messages, working status, extension widgets, editor, and footer remain fixed at the bottom. Mouse/trackpad input scrolls the region under the pointer; keyboard viewport actions always remain available. Inline images work in terminals that support the Kitty graphics protocol, including Kitty and Ghostty. In iTerm2 they render as text placeholders because its inline-image protocol cannot delete or crop placements during application-owned scrolling. Without `--alt`, pi uses the main screen and terminal-owned scrollback, and iTerm2 inline images continue to render normally.
启用 `--alt` 时,对话记录在终端视口内滚动,而排队消息、工作状态、扩展控件、编辑器和底栏则固定在底部。鼠标/触控板输入会滚动指针所在的区域;键盘的视口操作始终可用。在支持 Kitty 图形协议的终端(包括 Kitty 和 Ghostty)中,内联图片可正常显示。在 iTerm2 中它们会渲染为文字占位符,因为其内联图片协议无法在应用自行控制滚动时删除或裁剪图片位置。不使用 `--alt` 时,pi 使用主屏幕和终端自带的回滚缓冲区,iTerm2 的内联图片仍可正常渲染。

### File Arguments 文件参数

Prefix files with `@` to include them in the message:
在文件名前加 `@` 前缀,即可将其包含到消息中:

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

# Model with provider prefix
pi --model openai/gpt-4o "Help me refactor"

# Model with thinking level shorthand
pi --model sonnet:high "Solve this complex problem"

# Limit model cycling
pi --models "claude-*,gpt-4o"

# Read-only mode
pi --tools read,grep,find,ls -p "Review the code"

# Disable one extension or built-in tool while keeping the rest available
pi --exclude-tools ask_question
```

## Design Principles 设计原则

Pi keeps the core small and pushes workflow-specific behavior into extensions, skills, prompt templates, and packages.
Pi 保持核心精简,把与具体工作流相关的行为下放到扩展、技能、提示词模板和包中。

It intentionally does not include built-in MCP, sub-agents, permission popups, plan mode, to-dos, or background bash. You can build or install those workflows as extensions or packages, or use external tools such as containers and tmux.
它有意不内置 MCP、子 agent(sub-agents)、权限弹窗、计划模式(plan mode)、待办事项或后台 bash。你可以将这些工作流构建或安装为扩展或包,也可以使用容器、tmux 等外部工具。

For the full rationale, read the [blog post](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/).
完整的设计理由请阅读这篇[博客文章](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)。
