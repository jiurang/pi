# 构建与运行

## 环境要求

- **Node.js >= 22.19.0**（根 `package.json` engines 字段）。
- **Bash**（`test.sh` / `pi-test.sh` 是 bash 脚本；Windows 可用 Git Bash 或 WSL）。
- 构建全部包需要网络（刷新模型数据）；`npm run build:offline` 可用已有数据离线构建。

## 安装

```bash
npm install --ignore-scripts
```

仓库强制 `--ignore-scripts`（供应链加固，见根 `README.md`）；不要运行生命周期脚本。若依赖元数据变化，用 `npm install --package-lock-only --ignore-scripts` 刷新 lockfile。

## 构建

```bash
npm run build          # 先刷新模型数据，再按依赖顺序构建所有包
npm run build:offline  # 用已有模型数据离线构建
```

构建顺序（根 `package.json` 的 `build` 脚本）：`tui → ai → agent → storage/sqlite-node → protocol → client → coding-agent → server`。`ai` 构建时会先跑 `generate-models` 生成模型目录。

只构建某个包：

```bash
npm run build --workspace=@earendil-works/pi-agent-core
npm run build --workspace=@earendil-works/pi-coding-agent
```

## 从源码运行 pi（开发常用）

```bash
./pi-test.sh                    # 等价于：npx tsx packages/coding-agent/src/cli.ts
./pi-test.sh "你的提示词"       # 传参数
./pi-test.sh --no-env           # 清空所有 API key 环境变量
```

脚本可在任意目录运行，Pi 会保持调用方 cwd。它用 `tsx` 直接跑 TS 源码，无需先构建。

调试特定包的代码时，可以直接：

```bash
npx tsx packages/coding-agent/src/cli.ts --help
npx tsx packages/coding-agent/src/cli.ts -p "Say hello"
```

## 安装为 npm 全局命令

```bash
npm install -g @earendil-works/pi-coding-agent
pi --help
```

或从本地构建产物运行 Node 版 CLI（`dist/cli.js`）。

## 构建 Bun 独立二进制

```bash
npm run build:binary --workspace=@earendil-works/pi-coding-agent
# 产物：packages/coding-agent/dist/pi
```

Bun 二进制入口是 `src/bun/cli.ts`，额外注册 OAuth 流程、沙箱环境还原与 Bedrock（见 [01-cli-entry.md](../04-entrypoints/01-cli-entry.md)）。

## 配置与数据目录

| 内容 | 位置 |
|---|---|
| 用户数据根 | `~/.pi/agent`（可用 `PI_CODING_AGENT_DIR` 覆盖） |
| 会话文件 | `~/.pi/agent/sessions/`（`PI_CODING_AGENT_SESSION_DIR` 覆盖） |
| 凭据 | `~/.pi/agent/auth.json` |
| 用户模型配置 | `~/.pi/agent/models.json` |
| 全局设置 | `~/.pi/agent/settings.json` |
| 项目设置 | `<项目>/.pi/settings.json` |
| 项目资源 | `<项目>/.pi/`（extensions / skills / prompts / themes） |

## 常用环境变量

| 变量 | 作用 |
|---|---|
| `PI_CODING_AGENT` | 设为 `true`（cli.ts 设置，标记运行于 coding-agent） |
| `PI_CODING_AGENT_DIR` / `PI_CODING_AGENT_SESSION_DIR` | 覆盖数据目录/会话目录 |
| `PI_OFFLINE` | 离线模式（跳过版本检查与模型刷新） |
| `PI_SKIP_VERSION_CHECK` | 跳过版本检查 |
| `PI_SESSION_ID` / `PI_SESSION_FILE` / `PI_PROVIDER` / `PI_MODEL` / `PI_REASONING_LEVEL` | 注入给 bash 工具的子进程环境 |

各 provider 的 API key 环境变量见 `packages/ai/src/env-api-keys.ts`（如 `ANTHROPIC_API_KEY`、`OPENAI_API_KEY`、`GEMINI_API_KEY` 等）。

## 常见问题

- **`tsx` 找不到**：确认已 `npm install`。
- **模型目录为空 / 构建失败**：`ai` 包的 `generate-models` 需要网络；离线环境用 `npm run build:offline`。
- **Windows**：`pi-test.sh` 需要 Git Bash/WSL；也可用 `npx tsx packages/coding-agent/src/cli.ts` 直接在 PowerShell 运行。Windows 相关说明见 `packages/coding-agent/docs/windows.md`。
