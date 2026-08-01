<p align="center">
  <a href="https://pi.dev">
    <img alt="pi logo" src="https://pi.dev/logo-auto.svg" width="128">
  </a>
</p>
<p align="center">
  <a href="https://discord.com/invite/3cU7Bz4UPx"><img alt="Discord" src="https://img.shields.io/badge/discord-community-5865F2?style=flat-square&logo=discord&logoColor=white" /></a>
  <a href="https://www.npmjs.com/package/@earendil-works/pi-coding-agent"><img alt="npm" src="https://img.shields.io/npm/v/@earendil-works/pi-coding-agent?style=flat-square" /></a>
</p>

> New issues and PRs from new contributors are auto-closed by default. Maintainers review auto-closed issues daily. See [CONTRIBUTING.md](CONTRIBUTING.md).
> 新贡献者提交的 issue 与 PR 默认会被自动关闭。维护者每天都会审阅被自动关闭的 issue。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

# Pi Agent Harness Pi 智能体框架

This is the home of the Pi agent harness project including our self extensible coding agent.
这里是 Pi 智能体框架（agent harness）项目的主仓库，其中包含我们可自我扩展的编程智能体（coding agent）。

* **[@earendil-works/pi-coding-agent](packages/coding-agent)**: Interactive coding agent CLI
  交互式编程智能体命令行工具
* **[@earendil-works/pi-agent-core](packages/agent)**: Agent runtime with tool calling and state management
  具备工具调用与状态管理能力的智能体运行时
* **[@earendil-works/pi-ai](packages/ai)**: Unified multi-provider LLM API (OpenAI, Anthropic, Google, …)
  统一的多服务商 LLM API（OpenAI、Anthropic、Google 等）

To learn more about Pi:
想进一步了解 Pi：

* [Visit pi.dev](https://pi.dev), the project website with demos
  [访问 pi.dev](https://pi.dev)，项目官网，内含演示
* [Read the documentation](https://pi.dev/docs/latest), but you can also ask the agent to explain itself
  [阅读文档](https://pi.dev/docs/latest)，你也可以直接让智能体自行解释

## All Packages 全部包

| Package 包 | Description 说明 |
|---------|-------------|
| **[@earendil-works/pi-ai](packages/ai)** | Unified multi-provider LLM API (OpenAI, Anthropic, Google, etc.)<br>统一的多服务商 LLM API（OpenAI、Anthropic、Google 等） |
| **[@earendil-works/pi-agent-core](packages/agent)** | Agent runtime with tool calling and state management<br>具备工具调用与状态管理能力的智能体运行时 |
| **[@earendil-works/pi-coding-agent](packages/coding-agent)** | Interactive coding agent CLI<br>交互式编程智能体命令行工具 |
| **[@earendil-works/pi-tui](packages/tui)** | Terminal UI library with differential rendering<br>支持差分渲染的终端 UI 库 |

For Slack/chat automation and workflows see [earendil-works/pi-chat](https://github.com/earendil-works/pi-chat).
关于 Slack/聊天自动化与工作流，请参见 [earendil-works/pi-chat](https://github.com/earendil-works/pi-chat)。

## Permissions & Containerization 权限与容器化

Pi does not include a built-in permission system for restricting filesystem, process, network, or credential access. By default, it runs with the permissions of the user and process that launched it.
Pi 没有内置的权限系统来限制文件系统、进程、网络或凭据访问。默认情况下，它以启动它的用户和进程的权限运行。

If you need stronger boundaries, containerize or sandbox Pi. See [packages/coding-agent/docs/containerization.md](packages/coding-agent/docs/containerization.md) for three patterns:
如果你需要更强的边界隔离，请将 Pi 容器化或放入沙箱运行。[packages/coding-agent/docs/containerization.md](packages/coding-agent/docs/containerization.md) 中介绍了三种方案：

- **Gondolin extension**: keep `pi` and provider auth on the host while routing built-in tools and `!` commands into a local Linux micro-VM.
  **Gondolin 扩展**：将 `pi` 与服务商认证保留在宿主机上，同时把内置工具和 `!` 命令路由到本地 Linux 微虚拟机（micro-VM）中执行。
- **Plain Docker**: run the whole `pi` process in a local container for simple isolation.
  **纯 Docker**：将整个 `pi` 进程运行在本地容器中，实现简单隔离。
- **OpenShell**: run the whole `pi` process in a policy-controlled sandbox.
  **OpenShell**：将整个 `pi` 进程运行在受策略管控的沙箱中。

## Contributing 参与贡献

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [AGENTS.md](AGENTS.md) for project-specific rules (for both humans and agents).  Longer term plans for Pi can also be found in [RFCs](https://rfc.earendil.com/keyword/pi/).
贡献指南参见 [CONTRIBUTING.md](CONTRIBUTING.md)，项目专属规则（同时适用于人类与智能体）参见 [AGENTS.md](AGENTS.md)。Pi 的长期规划也可在 [RFCs](https://rfc.earendil.com/keyword/pi/) 中查阅。

## Development 开发

```bash
npm install --ignore-scripts  # Install all dependencies without running lifecycle scripts
npm run build         # Refresh model data, then build all packages
npm run build:offline # Rebuild using existing model data without network access
npm run check         # Lint, format, and type check
./test.sh            # Run tests (skips LLM-dependent tests without API keys)
./pi-test.sh         # Run pi from sources (can be run from any directory)
```

## Building standalone binaries from release source 从发布源码构建独立二进制文件

GitHub releases include a versioned source archive covered by the release's `SHA256SUMS` file. Extract it and run the same build script used for the official standalone binaries:
GitHub release 中包含带版本号的源码归档，并由该 release 的 `SHA256SUMS` 文件校验覆盖。解压后运行与官方独立二进制文件相同的构建脚本：

```bash
VERSION="<release-version>"
tar -xzf "pi-${VERSION}-source.tar.gz"
cd "pi-${VERSION}"
./scripts/build-binaries.sh --offline-model-data --platform linux-x64 --out "$PWD/out"
```

The source archive includes the generated provider model data used for the release. `--offline-model-data` builds with that snapshot instead of refreshing it from live provider catalogs. The script still installs dependencies, builds the monorepo, compiles the Bun executable, and stages its runtime assets. Package maintainers who provide dependencies separately can pass `--skip-install --skip-deps`.
该源码归档包含了此次发布所使用的、已生成的服务商模型数据。`--offline-model-data` 会使用该快照进行构建，而不是从在线的服务商目录重新拉取。脚本仍会安装依赖、构建 monorepo、编译 Bun 可执行文件并准备其运行时资源。若包维护者自行提供依赖，可传入 `--skip-install --skip-deps`。

## Supply-chain hardening 供应链加固

We treat npm dependency changes as reviewed code changes.
我们把 npm 依赖变更视同需要评审的代码变更。

- Direct external dependencies are pinned to exact versions. Internal workspace packages remain version-ranged.
  直接的外部依赖固定（pin）到精确版本。内部 workspace 包仍使用版本范围。
- `.npmrc` sets `save-exact=true` and `min-release-age=2` to avoid same-day dependency releases during npm resolution.
  `.npmrc` 设置了 `save-exact=true` 与 `min-release-age=2`，以避免 npm 解析时引入当天刚发布的依赖版本。
- `package-lock.json` is the dependency ground truth. Pre-commit blocks accidental lockfile commits unless `PI_ALLOW_LOCKFILE_CHANGE=1` is set.
  `package-lock.json` 是依赖的唯一权威来源。除非设置了 `PI_ALLOW_LOCKFILE_CHANGE=1`，否则 pre-commit 钩子会阻止误提交 lockfile。
- `npm run check` verifies pinned direct deps, native TypeScript import compatibility, and the generated coding-agent shrinkwrap.
  `npm run check` 会校验直接依赖是否已固定版本、原生 TypeScript 导入兼容性，以及生成的 coding-agent shrinkwrap 文件。
- The published CLI package includes `packages/coding-agent/npm-shrinkwrap.json`, generated from the root lockfile, to pin transitive deps for npm users.
  发布的 CLI 包中包含由根 lockfile 生成的 `packages/coding-agent/npm-shrinkwrap.json`，用于为 npm 用户固定传递依赖的版本。
- Release smoke tests use `npm run release:local` to build, pack, and create isolated npm and Bun installs outside the repo before tagging a release.
  发布冒烟测试使用 `npm run release:local`，在打发布标签之前于仓库之外完成构建、打包，并创建隔离的 npm 与 Bun 安装环境。
- Local release installs, documented npm installs, and `pi update --self` use `--ignore-scripts` where supported.
  本地发布安装、文档中记录的 npm 安装以及 `pi update --self` 都会在支持的情况下使用 `--ignore-scripts`。
- CI installs with `npm ci --ignore-scripts`, and a scheduled GitHub workflow runs `npm audit --omit=dev` plus `npm audit signatures --omit=dev`.
  CI 使用 `npm ci --ignore-scripts` 安装依赖，并有一个定时的 GitHub workflow 运行 `npm audit --omit=dev` 以及 `npm audit signatures --omit=dev`。
- Shrinkwrap generation has an explicit allowlist for dependency lifecycle scripts; new lifecycle-script deps fail checks until reviewed.
  shrinkwrap 生成过程对依赖的生命周期脚本设有显式白名单；新增带生命周期脚本的依赖会导致检查失败，直到通过评审为止。

## Share your OSS coding agent sessions 分享你的开源编程智能体会话

If you use Pi or other coding agents for open source work, please share your sessions.
如果你使用 Pi 或其他编程智能体进行开源工作，欢迎分享你的会话记录。

Public OSS session data helps improve coding agents with real-world tasks, tool use, failures, and fixes instead of toy benchmarks.
公开的开源会话数据能以真实世界的任务、工具使用、失败与修复来改进编程智能体，而不是依赖玩具式的基准测试。

For the full explanation, see [this post on X](https://x.com/badlogicgames/status/2037811643774652911).
完整说明请参见 [X 上的这篇帖子](https://x.com/badlogicgames/status/2037811643774652911)。

To publish sessions, use [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf). Read its README.md for setup instructions. All you need is a Hugging Face account, the Hugging Face CLI, and `pi-share-hf`.
要发布会话，请使用 [`badlogic/pi-share-hf`](https://github.com/badlogic/pi-share-hf)。安装配置说明请阅读它的 README.md。你只需要一个 Hugging Face 账号、Hugging Face CLI 以及 `pi-share-hf`。

You can also watch [this video](https://x.com/badlogicgames/status/2041151967695634619), where I show how I publish my `pi-mono` sessions.
你也可以观看[这个视频](https://x.com/badlogicgames/status/2041151967695634619)，其中演示了我是如何发布自己的 `pi-mono` 会话的。

I regularly publish my own `pi-mono` work sessions here:
我会定期在这里发布自己的 `pi-mono` 工作会话：

- [badlogicgames/pi-mono on Hugging Face](https://huggingface.co/datasets/badlogicgames/pi-mono)
  [Hugging Face 上的 badlogicgames/pi-mono](https://huggingface.co/datasets/badlogicgames/pi-mono)

## License 许可证

MIT

<p align="center">
  <a href="https://pi.dev">pi.dev</a> domain graciously donated by
  <br />
  <a href="https://pi.dev">pi.dev</a> 域名由以下机构慷慨捐赠
  <br /><br />
  <a href="https://exe.dev"><img src="packages/coding-agent/docs/images/exy.png" alt="Exy mascot" width="48" /><br />exe.dev</a>
</p>
