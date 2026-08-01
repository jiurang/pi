# Environment Variables 环境变量

Pi uses environment variables in three ways:
Pi 在三个方面使用环境变量：

- Variables such as `PI_OFFLINE` configure the Pi process.
  诸如 `PI_OFFLINE` 之类的变量用于配置 Pi 进程本身。
- Pi sets `PI_CODING_AGENT` so child processes can detect that they run inside Pi.
  Pi 会设置 `PI_CODING_AGENT`，以便子进程能够检测到自己运行在 Pi 内部。
- Commands run by the LLM-callable bash tool receive `PI_*` variables describing the current session.
  由 LLM 可调用的 bash 工具执行的命令会接收到描述当前会话的 `PI_*` 变量。

Provider API-key variables are documented separately in [Providers](providers.md#environment-variables-or-auth-file).
各提供方（provider）的 API key 变量在 [Providers](providers.md#environment-variables-or-auth-file) 中单独说明。

## Process Marker 进程标记

The CLI and RPC entry points set `PI_CODING_AGENT=true`. Child processes inherit it and can use it to detect that they run inside Pi. It is not session-specific and is not set automatically when Pi is embedded through the SDK.
CLI 与 RPC 入口会设置 `PI_CODING_AGENT=true`。子进程会继承该变量，并据此判断自己是否运行在 Pi 内部。它与具体会话无关；当 Pi 以 SDK 方式嵌入使用时，也不会自动设置该变量。

## Bash Tool Session Environment bash 工具的会话环境

Commands run by the bash tool receive the current Pi session state:
由 bash 工具执行的命令会接收到当前 Pi 会话的状态：

| Variable | Description |
|----------|-------------|
| `PI_SESSION_ID` | Current session ID<br>当前会话 ID |
| `PI_SESSION_FILE` | Absolute path to the current session JSONL file; unset for ephemeral sessions<br>当前会话 JSONL 文件的绝对路径；临时（ephemeral）会话下不设置该变量 |
| `PI_PROVIDER` | Currently selected model provider<br>当前选定的模型提供方 |
| `PI_MODEL` | Currently selected model ID<br>当前选定的模型 ID |
| `PI_REASONING_LEVEL` | Current effective reasoning level: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, or `max`<br>当前生效的推理强度级别：`off`、`minimal`、`low`、`medium`、`high`、`xhigh` 或 `max` |

The values are resolved when each command starts. Switching models or changing the reasoning level therefore affects the next bash command without restarting Pi. `PI_PROVIDER` and `PI_MODEL` identify the selected Pi model, not a different upstream model that a router may choose internally.
这些值在每条命令启动时解析。因此切换模型或调整推理强度会立即影响下一条 bash 命令，无需重启 Pi。`PI_PROVIDER` 和 `PI_MODEL` 标识的是在 Pi 中选定的模型，而非某个 router 内部可能选择的其他上游模型。

When asked which model or provider is running, inspect these variables instead of inferring the answer from the system prompt:
当被问及当前运行的是哪个模型或提供方时，应查看这些变量，而不要从系统提示词（system prompt）中推断答案：

```bash
printf '%s/%s\n' "$PI_PROVIDER" "$PI_MODEL"
printf 'reasoning=%s session=%s\n' "$PI_REASONING_LEVEL" "$PI_SESSION_ID"
```

The session file can be inspected directly when the session is persistent:
当会话是持久化会话时，可以直接查看会话文件：

```bash
if [ -n "$PI_SESSION_FILE" ]; then
  tail -n 1 "$PI_SESSION_FILE"
fi
```

These variables are injected into the LLM-callable bash tool. They are not injected into user-entered `!` or `!!` commands.
这些变量只会注入到 LLM 可调用的 bash 工具中，不会注入到用户手动输入的 `!` 或 `!!` 命令里。

### Custom Bash Tools 自定义 bash 工具

Bash tools created with `createBashTool()` expose the session environment by default when registered with Pi. Injection happens before `spawnHook`, so a hook receives the variables in `ctx.env`:
通过 `createBashTool()` 创建并注册到 Pi 的 bash 工具，默认会暴露会话环境变量。注入发生在 `spawnHook` 之前，因此 hook 可以在 `ctx.env` 中拿到这些变量：

```typescript
const bashTool = createBashTool(cwd, {
  spawnHook: (ctx) => ({
    ...ctx,
    env: { ...ctx.env, CI: "1" },
  }),
});
```

Disable session metadata independently of the spawn hook:
也可以在不影响 spawn hook 的前提下单独禁用会话元数据：

```typescript
const bashTool = createBashTool(cwd, {
  exposeSessionEnvironment: false,
  spawnHook: (ctx) => ctx,
});
```

When disabled, Pi removes inherited values for these variables so nested Pi processes do not expose stale parent-session metadata.
禁用后，Pi 会清除这些变量继承而来的值，以免嵌套运行的 Pi 进程暴露出已过期的父会话元数据。

## Pi Process Configuration Pi 进程配置

These variables are read by Pi itself:
以下变量由 Pi 自身读取：

| Variable | Description |
|----------|-------------|
| `PI_CODING_AGENT_DIR` | Override the config directory; default is `~/.pi/agent`<br>覆盖配置目录；默认为 `~/.pi/agent` |
| `PI_CODING_AGENT_SESSION_DIR` | Override session storage; overridden by `--session-dir`<br>覆盖会话存储位置；其优先级低于 `--session-dir` |
| `PI_PACKAGE_DIR` | Override the package directory, useful for Nix/Guix store paths<br>覆盖包目录，适用于 Nix/Guix 的 store 路径场景 |
| `PI_OFFLINE` | Disable startup network operations, including update checks, package updates, and install/update telemetry<br>禁用启动时的网络操作，包括更新检查、包更新以及安装/更新遥测 |
| `PI_SKIP_VERSION_CHECK` | Disable the `pi.dev` latest-version request<br>禁用向 `pi.dev` 请求最新版本信息 |
| `PI_TELEMETRY` | Override install/update telemetry and provider attribution headers: `1`/`true`/`yes` or `0`/`false`/`no`<br>覆盖安装/更新遥测及提供方归因（attribution）请求头的设置：可取 `1`/`true`/`yes` 或 `0`/`false`/`no` |
| `PI_CACHE_RETENTION` | Set to `long` for extended provider prompt caching where supported<br>设为 `long` 可在受支持的提供方上启用更长时间的 prompt 缓存 |
| `PI_SHARE_VIEWER_URL` | Override the base URL used by `/share`<br>覆盖 `/share` 使用的基础 URL |
| `PI_HARDWARE_CURSOR` | Set to `1` to show the hardware cursor; see [Terminal setup](terminal-setup.md)<br>设为 `1` 可显示硬件光标；参见 [Terminal setup](terminal-setup.md) |
| `VISUAL`, `EDITOR` | External editor fallback when `externalEditor` is unset<br>当 `externalEditor` 未设置时，作为外部编辑器的回退选项 |
| `HTTP_PROXY`, `HTTPS_PROXY` | Proxy outbound HTTP requests<br>为出站 HTTP 请求设置代理 |

Provider credentials such as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and cloud-provider configuration are listed in [Providers](providers.md#environment-variables-or-auth-file).
`ANTHROPIC_API_KEY`、`OPENAI_API_KEY` 等提供方凭据以及云厂商相关配置，请参见 [Providers](providers.md#environment-variables-or-auth-file)。
