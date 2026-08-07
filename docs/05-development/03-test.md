# 测试

> 仓库对测试有一套严格的约定，先看 `AGENTS.md` 的 "Commands" 章节，再按下面操作。

## 基本原则

- **不要直接运行完整 vitest 套件**：其中包含 e2e 测试，只有在 endpoint/auth 环境变量存在时才会激活（可能花真钱调 API）。
- **非 LLM 测试**：从仓库根运行 `./test.sh`。
- **单测**：在包根目录运行 `node ../../node_modules/vitest/dist/cli.js --run test/<file>.test.ts`。
- 只跑某包的测试：`npm test --workspace=<包名>`。

## 快速开始

```bash
npm install --ignore-scripts
./test.sh          # 跑全部非 LLM 测试（隔离 HOME，无 API key 也可跑）
```

`test.sh`（根目录）做了什么：

1. 创建一个隔离的临时环境（`mktemp -d`），把 `HOME/USERPROFILE/TMPDIR/XDG_*` 等全部指到临时目录，并清空 git/npm 配置；
2. 设 `PI_NO_LOCAL_LLM=1`、禁用 AWS 元数据；
3. `env -i ... npm test` 在干净环境跑所有包测试。

## 跑单个测试

```bash
# 在包根目录（例如 packages/agent）
node ../../node_modules/vitest/dist/cli.js --run test/agent-loop.test.ts

# 只跑某个用例（-t 过滤）
node ../../node_modules/vitest/dist/cli.js --run test/agent-loop.test.ts -t "steering"
```

## 各包测试速查

| 包 | 常用测试 | 说明 |
|---|---|---|
| `ai` | `test/faux-provider.test.ts`、`test/models-runtime.test.ts` | 用 faux provider 模拟流式 |
| `agent` | `test/agent-loop.test.ts`、`test/agent.test.ts`、`test/e2e.test.ts` | 循环/状态/端到端 |
| `agent`（harness） | `vitest.harness.config.ts` 专项：`test/harness/*` | 会话/压缩/技能/工具 |
| `coding-agent` | `test/suite/`（专用 harness + faux provider） | 集成行为测试 |
| `client` | `test/connection.test.ts` 等 | 连接状态机 |

> `packages/agent` 有独立配置 `vitest.harness.config.ts`，跑 harness 相关测试用 `npm run test:harness --workspace=@earendil-works/pi-agent-core`。

## coding-agent 集成测试约定

`packages/coding-agent/test/suite/` 的测试**必须**用 `test/suite/harness.ts` + faux provider（AGENTS.md 强制）：

- 不用真实 provider API、不用 key、不花 token；
- 针对特定 issue 的回归测试放 `test/suite/regressions/<issue-number>-<slug>.test.ts`。

## e2e 测试

`packages/agent/test/e2e.test.ts` 等在存在 endpoint/auth 环境变量时才激活（自动跳过/启用）。**不要**在无配置时手动触发。

## 提交前的检查

代码改动后（文档除外）：

```bash
npm run check   # biome lint/format + 类型检查 + 依赖/锁文件校验（跑全量，不看 tail）
```

`npm run check` 包含：`biome check`、`check:pinned-deps`（直接依赖必须锁定精确版本）、`check:ts-imports`、`check:shrinkwrap`、`tsgo --noEmit`、`check:browser-smoke`（浏览器冒烟，会用 `packages/client` + protocol）。

## 常见问题

- **测试因为缺少 API key 报错**：说明误跑了 e2e 或配置了 endpoint 环境变量；改用 `./test.sh`。
- **Windows 上 `./test.sh` 无法运行**：用 Git Bash/WSL；或在包根手动跑 vitest 单测命令。
- **`tsx` 相关错误**：确认根目录已 `npm install`。
