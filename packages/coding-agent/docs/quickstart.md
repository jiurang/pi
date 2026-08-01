# Quickstart 快速开始

This page gets you from install to a useful first pi session.
本页带你从安装一路走到第一个真正有用的 pi 会话。

## Install 安装

Pi is distributed as an npm package:
Pi 以 npm 包的形式发布：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` disables dependency lifecycle scripts during install. Pi does not require install scripts for normal npm installs.
`--ignore-scripts` 会在安装期间禁用依赖的生命周期脚本。对于常规的 npm 安装，pi 并不需要安装脚本。

### Uninstall 卸载

Use the package manager that installed pi. The curl installer uses npm globally, so curl and npm installs are removed with npm:
请使用当初安装 pi 的那个包管理器。curl 安装脚本在全局使用 npm，因此通过 curl 和 npm 安装的版本都用 npm 卸载：

```bash
# curl installer or npm install -g
npm uninstall -g @earendil-works/pi-coding-agent

# pnpm
pnpm remove -g @earendil-works/pi-coding-agent

# Yarn
yarn global remove @earendil-works/pi-coding-agent

# Bun
bun uninstall -g @earendil-works/pi-coding-agent
```

Uninstalling pi leaves settings, credentials, sessions, and installed pi packages in `~/.pi/agent/`.
卸载 pi 后，设置、凭据、会话以及已安装的 pi 包仍会保留在 `~/.pi/agent/` 中。

Then start pi in the project directory you want it to work on:
然后在你希望它处理的项目目录中启动 pi：

```bash
cd /path/to/project
pi
```

## Authenticate 认证

Pi can use subscription providers through `/login`, or API-key providers through environment variables or the auth file.
Pi 既可以通过 `/login` 使用订阅制服务商（subscription provider），也可以通过环境变量或认证文件使用 API 密钥制服务商。

### Option 1: subscription login 方式一：订阅登录

Start pi and run:
启动 pi 并运行：

```text
/login
```

Then select a provider. Built-in subscription logins include Claude Pro/Max, ChatGPT Plus/Pro (Codex), and GitHub Copilot.
然后选择一个服务商。内置的订阅登录方式包括 Claude Pro/Max、ChatGPT Plus/Pro (Codex) 和 GitHub Copilot。

### Option 2: API key 方式二：API 密钥

Set an API key before launching pi:
在启动 pi 之前设置 API 密钥：

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

You can also run `/login` and select an API-key provider to store the key in `~/.pi/agent/auth.json`.
你也可以运行 `/login` 并选择一个 API 密钥制服务商，将密钥保存到 `~/.pi/agent/auth.json` 中。

See [Providers](providers.md) for all supported providers, environment variables, and cloud-provider setup.
关于所有受支持的服务商、环境变量以及云服务商配置，请参阅 [Providers](providers.md)。

## First session 第一个会话

Once pi starts, type a request and press Enter:
pi 启动后，输入一条请求并按下 Enter：

```text
Summarize this repository and tell me how to run its checks.
```

By default, pi gives the model four tools:
默认情况下，pi 会给模型提供四个工具：

- `read` - read files
  `read` —— 读取文件
- `write` - create or overwrite files
  `write` —— 创建或覆盖文件
- `edit` - patch files
  `edit` —— 对文件打补丁
- `bash` - run shell commands
  `bash` —— 执行 shell 命令

Additional built-in read-only tools (`grep`, `find`, `ls`) are available through tool options. Pi runs in your current working directory and can modify files there. Use git or another checkpointing workflow if you want easy rollback.
另外还有内置的只读工具（`grep`、`find`、`ls`），可通过工具选项启用。Pi 在你的当前工作目录中运行，并可以修改其中的文件。如果你希望方便地回滚，请使用 git 或其他带检查点（checkpointing）的工作流。

## Give pi project instructions 为 pi 提供项目说明

Pi loads context files at startup. Add an `AGENTS.md` file to tell it how to work in a project:
Pi 会在启动时加载上下文文件。添加一个 `AGENTS.md` 文件来告诉它在某个项目中应如何工作：

```markdown
# Project Instructions

- Run `npm run check` after code changes.
- Do not run production migrations locally.
- Keep responses concise.
```

Pi loads:
Pi 会加载：

- `~/.pi/agent/AGENTS.md` for global instructions
  `~/.pi/agent/AGENTS.md`，用于全局说明
- `AGENTS.md` or `CLAUDE.md` from parent directories and the current directory
  来自父级目录和当前目录的 `AGENTS.md` 或 `CLAUDE.md`

Restart pi, or run `/reload`, after changing context files.
修改上下文文件后，请重启 pi 或运行 `/reload`。

## Common things to try 常见用法尝试

### Reference files 引用文件

Type `@` in the editor to fuzzy-search files, or pass files on the command line:
在编辑器中输入 `@` 可模糊搜索文件，也可以在命令行中直接传入文件：

```bash
pi @README.md "Summarize this"
pi @src/app.ts @src/app.test.ts "Review these together"
```

Images or text can be pasted with Ctrl+V (Alt+V on Windows); images can also be dragged into supported terminals.
可以用 Ctrl+V（Windows 上为 Alt+V）粘贴图片或文本；在受支持的终端中，图片也可以直接拖入。

### Run shell commands 执行 shell 命令

In interactive mode:
在交互模式下：

```text
!npm run lint
```

The command output is sent to the model. Use `!!command` to run a command without adding its output to the model context.
命令输出会被发送给模型。使用 `!!command` 可以执行命令但不把其输出加入模型上下文。

### Switch models 切换模型

Use `/model` or Ctrl+L to choose a model. Use Shift+Tab to cycle thinking level. Use Ctrl+P / Shift+Ctrl+P to cycle through scoped models.
使用 `/model` 或 Ctrl+L 选择模型。使用 Shift+Tab 循环切换思考等级（thinking level）。使用 Ctrl+P / Shift+Ctrl+P 在作用域内的模型之间循环切换。

### Continue later 稍后继续

Sessions are saved automatically:
会话会自动保存：

```bash
pi -c                  # Continue most recent session
pi -r                  # Browse previous sessions
pi --name "my task"    # Set session display name at startup
pi --session <path|id> # Open a specific session
```

Inside pi, use `/resume`, `/new`, `/tree`, `/fork`, and `/clone` to manage sessions.
在 pi 内部，可使用 `/resume`、`/new`、`/tree`、`/fork` 和 `/clone` 来管理会话。

### Non-interactive mode 非交互模式

For one-shot prompts:
适用于一次性提示词：

```bash
pi -p "Summarize this codebase"
cat README.md | pi -p "Summarize this text"
pi -p @screenshot.png "What's in this image?"
```

Use `--mode json` for JSON event output or `--mode rpc` for process integration.
使用 `--mode json` 可输出 JSON 事件，使用 `--mode rpc` 可用于进程集成。

## Next steps 后续步骤

- [Using Pi](usage.md) - interactive mode, slash commands, sessions, context files, and CLI reference.
  [Using Pi](usage.md) —— 交互模式、斜杠命令、会话、上下文文件以及 CLI 参考。
- [Providers](providers.md) - authentication and model setup.
  [Providers](providers.md) —— 认证与模型配置。
- [Settings](settings.md) - global and project configuration.
  [Settings](settings.md) —— 全局与项目配置。
- [Keybindings](keybindings.md) - shortcuts and customization.
  [Keybindings](keybindings.md) —— 快捷键与自定义。
- [Pi Packages](packages.md) - install shared extensions, skills, prompts, and themes.
  [Pi Packages](packages.md) —— 安装共享的扩展、技能、提示词和主题。

Platform notes: [Windows](windows.md), [Termux](termux.md), [tmux](tmux.md), [Terminal setup](terminal-setup.md), [Shell aliases](shell-aliases.md).
平台说明：[Windows](windows.md)、[Termux](termux.md)、[tmux](tmux.md)、[Terminal setup](terminal-setup.md)、[Shell aliases](shell-aliases.md)。
