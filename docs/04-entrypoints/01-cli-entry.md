# CLI 启动链路

> 第 4 层：细节链路（第一篇）。**全局定位**：这条链路是整辆车点火的起点——从用户敲下 `pi` 开始，经过装配，把 [coding-agent](../03-packages/03-pi-coding-agent.md) 的 AgentSession（引擎的驾驶员）建好，然后分发到交互/打印/RPC 三种模式。全链路走完才会碰到底层的 agent-loop 与 pi-ai。

从执行 `pi` 命令到进入交互界面/打印/RPC 模式的完整代码路径。

## 入口点一览

| 入口 | 文件 | 触发方式 |
|---|---|---|
| Node CLI | `packages/coding-agent/src/cli.ts` | npm bin（`pi` 命令）→ `dist/cli.js` |
| Bun 二进制 | `packages/coding-agent/src/bun/cli.ts` | 独立二进制（`build:binary` 产物） |
| RPC 子路径 | `packages/coding-agent/src/rpc-entry.ts` | `import("@earendil-works/pi-coding-agent/rpc-entry")` |

### cli.ts（Node 入口）

`packages/coding-agent/src/cli.ts` 只有约 25 行，做三件事：

1. 设置 `process.title = APP_NAME`（`pi`）、`process.env.PI_CODING_AGENT = "true"`；
2. 调用 `configureHttpDispatcher()`（`src/core/http-dispatcher.ts`）——在 provider SDK 发请求前配置 undici 全局 dispatcher（代理、超时）；
3. `main(process.argv.slice(2))`。

### bun/cli.ts（Bun 二进制入口）

比 Node 入口多做三件事（`packages/coding-agent/src/bun/cli.ts`）：

1. `registerBunOAuthFlows()`——pi-ai 的 Bun OAuth 流程注册（PKCE 等需要 Node-only 模块的 OAuth 在 Bun 下改走内置流程）；
2. `restoreSandboxEnv()`——还原沙箱环境变量；
3. `await import("./register-bedrock.ts")`——注册 Bedrock AWS SDK 签名模块（Bun 单文件 bundle 需要显式注册）。

最后 `await import("../cli.ts")` 复用同一套 Node 主流程。

## main() 主流程（packages/coding-agent/src/main.ts）

`main(args, options?)`（[main.ts](file:///e:/MyCoding/LLMAgent/pi/packages/coding-agent/src/main.ts#L548-L959)）是整条启动链路的核心，按顺序执行：

### 阶段 1：预处理（L549-580）

- 收集扩展工厂：`[...builtInExtensions, ...(options?.extensionFactories ?? [])]`（L550）；
- `--offline` / `PI_OFFLINE` 检测（L551-555）；
- Windows 清理自更新隔离目录（L557-559）；
- 创建 `bootstrapSettingsManager`，应用 HTTP 代理设置（L562-565）。

### 阶段 2：包管理 / 配置 / 凭据命令（L567-589）

- `handlePackageCommand(args)`：`pi install/remove/update/list`（L567）；
- `handleConfigCommand(args)`：`pi config`（L583）；
- `runCredentialPrintCommand(args)`：`pi auth get` 等（L587）。

### 阶段 3：参数解析与模式选择（L591-626）

- `parseArgs(args)`（`src/cli/args.ts`）→ `Args`；诊断错误则退出（L591-601）；
- `--version` / `--export` 提前处理（L603-620）；
- **`resolveAppMode()` 决定运行模式**（L622，见 [main.ts](file:///e:/MyCoding/LLMAgent/pi/packages/coding-agent/src/main.ts#L115-L126)）：

```ts
if (parsed.mode === "rpc") return "rpc";
if (parsed.mode === "json") return "json";
if (parsed.print || !stdinIsTTY || !stdoutIsTTY) return "print";
return "interactive";
```

### 阶段 4：迁移与会话解析（L628-690）

- 校验 fork/session-id 标志互斥（L633-634）；
- `runMigrations(cwd)`（L638）：迁移历史配置/凭据；
- 首次启动引导（interactive 模式，L648-651）；
- **`createSessionManager(parsed, cwd, sessionDir, settingsManager)`**（L668）——按 `--no-session / --fork / --session / --resume / --continue / --session-id` 六种方式创建/打开/分支会话（[main.ts](file:///e:/MyCoding/LLMAgent/pi/packages/coding-agent/src/main.ts#L324-L415)）。

### 阶段 5：运行时装配（L692-836）

这是最核心的装配阶段。`createRuntime` 工厂（[main.ts](file:///e:/MyCoding/LLMAgent/pi/packages/coding-agent/src/main.ts#L705-L829)）在会话 cwd 确定后：

1. `SettingsManager.create(cwd, agentDir, { projectTrusted })`（L723）；
2. **`createAgentSessionServices(...)`**（L724，`src/core/agent-session-services.ts`）——创建 `ModelRuntime`、`SettingsManager`、`DefaultResourceLoader`，冲刷扩展的 provider 注册；
3. **`buildSessionOptions(...)`**（L786）——把 CLI 参数映射为 `CreateAgentSessionOptions`（模型解析、thinking level、工具白/黑名单）；
4. **`createAgentSessionFromServices(...)`**（L807）——最终创建 `AgentSession`。

然后 `createAgentSessionRuntime(createRuntime, {...})`（L831，`src/core/agent-session-runtime.ts`）包装出 `AgentSessionRuntime`（支持 switchSession/newSession/fork/import）。

### 阶段 6：模式分发（L909-958）

```
appMode === "rpc"        → runRpcMode(runtime)               // modes/rpc/rpc-mode.ts
appMode === "interactive"→ new InteractiveMode(runtime, {...}).run()  // modes/interactive/interactive-mode.ts
否则                     → runPrintMode(runtime, { mode: "text"|"json", ... })  // modes/print-mode.ts
```

## 从 main() 到 agent 运行时的完整调用链

```
cli.ts / bun/cli.ts
  └─ main.ts: main()
      ├─ createAgentSessionServices()      # ModelRuntime + SettingsManager + ResourceLoader
      ├─ createAgentSessionFromServices()  # → sdk.ts createAgentSession()
      │     └─ new Agent({...})            # pi-agent-core，streamFn = modelRuntime.streamSimple
      │     └─ new AgentSession({...})     # 包装 Agent + 事件/持久化/工具/扩展
      └─ createAgentSessionRuntime()       # 会话运行时（switch/fork/import）
            └─ InteractiveMode / runPrintMode / runRpcMode
                  └─ session.prompt(input) # → Agent.prompt() → runAgentLoop()
```

## 调试锚点

- 想看"从哪一行进入交互模式"：在 `main.ts` L913 附近断点（`new InteractiveMode(...)`）。
- 想看"会话如何被创建"：在 `createSessionManager`（L668）或 `SessionManager.create` 断点。
- 想看"模型如何被选中"：在 `buildSessionOptions`（L786）或 `resolveCliModel` 断点。
- 想看"Agent 如何构造"：在 `sdk.ts` 的 `createAgentSession()` 中 `new Agent(...)` 处断点。
