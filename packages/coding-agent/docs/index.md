# Pi Documentation Pi 文档

Pi is a minimal terminal coding harness. It is designed to stay small at the core while being extended through TypeScript extensions, skills, prompt templates, themes, and pi packages.
Pi 是一个极简的终端编码框架（harness）。它的设计目标是保持内核精简，同时可通过 TypeScript 扩展（extensions）、技能（skills）、提示词模板（prompt templates）、主题（themes）以及 pi 包进行扩展。

## Quick start 快速开始

Install Pi with npm:
使用 npm 安装 Pi：

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` disables dependency lifecycle scripts during install. Pi does not require install scripts for normal npm installs.
`--ignore-scripts` 会在安装过程中禁用依赖的生命周期脚本。常规 npm 安装下，Pi 并不需要安装脚本。

On Linux or macOS, you can also use the installer:
在 Linux 或 macOS 上，你也可以使用安装脚本：

```bash
curl -fsSL https://pi.dev/install.sh | sh
```

To uninstall pi itself, use npm for curl and npm installs:
若要卸载 pi 本身，对于通过 curl 和 npm 安装的情况，使用 npm 卸载：

```bash
npm uninstall -g @earendil-works/pi-coding-agent
```

For pnpm, Yarn, or Bun installs, use the matching global remove command: `pnpm remove -g @earendil-works/pi-coding-agent`, `yarn global remove @earendil-works/pi-coding-agent`, or `bun uninstall -g @earendil-works/pi-coding-agent`.
对于通过 pnpm、Yarn 或 Bun 安装的情况，请使用对应的全局卸载命令：`pnpm remove -g @earendil-works/pi-coding-agent`、`yarn global remove @earendil-works/pi-coding-agent` 或 `bun uninstall -g @earendil-works/pi-coding-agent`。

Then run it in a project directory:
然后在项目目录中运行它：

```bash
pi
```

Authenticate with `/login` for subscription providers, or set an API key such as `ANTHROPIC_API_KEY` before starting pi.
对于订阅制的服务提供商（provider），使用 `/login` 进行认证；或者在启动 pi 之前设置 API 密钥，例如 `ANTHROPIC_API_KEY`。

For the full first-run flow, see [Quickstart](quickstart.md).
完整的首次运行流程请参见 [Quickstart](quickstart.md)。

## Start here 从这里开始

- [Quickstart](quickstart.md) - install, authenticate, and run a first session.
  安装、认证并运行第一个会话（session）。
- [Using Pi](usage.md) - interactive mode, slash commands, context files, and CLI reference.
  交互模式、斜杠命令、上下文文件以及 CLI 参考。
- [Providers](providers.md) - subscription and API-key setup for built-in providers.
  内置服务提供商（provider）的订阅与 API 密钥配置。
- [llama.cpp](llama-cpp.md) - run a local router and manage models with `/llama`.
  运行本地路由器，并使用 `/llama` 管理模型。
- [Security](security.md) - project trust, sandbox boundaries, and vulnerability reporting.
  项目信任、沙箱边界以及漏洞上报。
- [Containerization](containerization.md) - sandbox pi with Gondolin, Docker, or OpenShell.
  使用 Gondolin、Docker 或 OpenShell 将 pi 沙箱化。
- [Settings](settings.md) - global and project settings.
  全局设置与项目级设置。
- [Keybindings](keybindings.md) - default shortcuts and custom keybindings.
  默认快捷键与自定义快捷键。
- [Sessions](sessions.md) - session management, branching, and tree navigation.
  会话管理、分支以及树形导航。
- [Compaction](compaction.md) - context compaction and branch summarization.
  上下文压缩（compaction）与分支摘要。

## Customization 定制化

- [Extensions](extensions.md) - TypeScript modules for tools, commands, events, and custom UI.
  用于定义工具（tool）、命令、事件和自定义 UI 的 TypeScript 模块。
- [Skills](skills.md) - Agent Skills for reusable on-demand capabilities.
  Agent Skills，提供可复用的按需能力。
- [Prompt templates](prompt-templates.md) - reusable prompts that expand from slash commands.
  可复用的提示词，通过斜杠命令展开。
- [Themes](themes.md) - built-in and custom terminal themes.
  内置终端主题与自定义主题。
- [Pi packages](packages.md) - bundle and share extensions, skills, prompts, and themes.
  打包并分享扩展、技能、提示词和主题。
- [Custom models](models.md) - add model entries for supported provider APIs.
  为受支持的服务提供商 API 添加模型条目。
- [Custom providers](custom-provider.md) - implement custom APIs and OAuth flows.
  实现自定义 API 与 OAuth 流程。

## Programmatic usage 编程式使用

- [SDK](sdk.md) - embed pi in Node.js applications.
  在 Node.js 应用中嵌入 pi。
- [RPC mode](rpc.md) - integrate over stdin/stdout JSONL.
  通过 stdin/stdout 的 JSONL 进行集成。
- [JSON event stream mode](json.md) - print mode with structured events.
  带结构化事件的打印（print）模式。
- [TUI components](tui.md) - build custom terminal UI for extensions.
  为扩展构建自定义终端 UI。

## Reference 参考

- [Environment variables](environment-variables.md) - Pi process configuration and session metadata available to bash tools.
  Pi 进程配置，以及可供 bash 工具使用的会话元数据。
- [Session format](session-format.md) - JSONL session file format, entry types, and SessionManager API.
  JSONL 会话文件格式、条目类型以及 SessionManager API。

## Platform setup 平台配置

- [Windows](windows.md)
- [Termux on Android](termux.md)
- [tmux](tmux.md)
- [Terminal setup](terminal-setup.md)
  终端配置
- [Shell aliases](shell-aliases.md)
  Shell 别名

## Development 开发

- [Development](development.md) - local setup, project structure, and debugging.
  本地环境搭建、项目结构与调试。
