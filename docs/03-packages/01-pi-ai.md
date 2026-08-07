# @earendil-works/pi-ai 包详解

> 第 3 层：局部深入（第一篇）。本页按 **局部 → 提升到全局 → 再看局部 → 细节** 的节奏组织：先看这个包是干什么的，再把它放到整条主链路里看它的位置与接口，最后才深入内部实现。

## 0. 局部：这个包是什么

**pi-ai = LLM 抽象层**。定位原文："Unified LLM API with automatic model discovery and provider configuration"。它解决一个朴素的问题：**Pi 不想为每个大模型服务商各写一套接入代码**，所以把"服务商差异"（协议、鉴权、模型列表）全部隔离在一个包里，对外只暴露统一接口。

只收录**支持工具调用（tool calling）的模型**（agentic 工作流所需）。它不关心"智能体怎么循环、会话怎么存"——那是下一层 pi-agent-core 的事。

## 1. 提升到全局：它在整条链路中的位置

在全局链路中，pi-ai 是**最底层的地基**：

```
coding-agent → agent-core → 【pi-ai】 → 大模型服务商
                  │            │
             调用 streams      Models.stream(model, context, options)
             （agent-loop 只在 LLM 边界碰到它）
```

**下游对它的依赖**（全局视角）：

| 谁 | 用它的什么 | 怎么用 |
|---|---|---|
| pi-agent-core（agent-loop） | `streamFn` | 把一个 `(model, context, options) => EventStream` 函数作为回调传入，循环本身不感知 pi-ai |
| pi-agent-core（AgentHarness） | `Models` | 直接注入 `models`，每回合调用 `stream/complete` |
| pi-coding-agent（ModelRuntime） | `Models` 接口 | 实现该接口包装 provider 组合、鉴权、刷新 |

**关键边界契约**：pi-ai 对外的"统一语言"就是 **消息（Message）+ 事件流（EventStream）**——大模型返回的一切（文本、思考、工具调用）都变成流式事件。这个契约就是 [消息模型与事件流](../02-architecture/03-message-and-stream.md) 里讲的通用语言。**错误永远编码进流、不抛异常**，这是 pi-ai 对外最重要的行为约定。

带着这个全局视角，下面回到 pi-ai 内部。

## 2. 包结构

```
packages/ai/
├── src/
│   ├── index.ts            # 核心入口（零副作用，不含 provider 目录/OAuth/compat）
│   ├── types.ts            # 全部核心类型
│   ├── models.ts           # Models 集合、createModels、createProvider、cost 计算
│   ├── models-store.ts     # 动态模型目录持久化
│   ├── model-catalog.ts    # flattenModelCatalog（类型推导）
│   ├── models.generated.ts # 生成的 MODELS 全量注册表
│   ├── providers/          # 37+ provider 工厂 + 生成的 *.models.ts + data/ + faux.ts + all.ts
│   ├── api/                # 10 个 API 实现（stream/streamSimple）+ *.lazy.ts + lazy.ts
│   ├── auth/               # 鉴权类型/解析/凭据存储/oauth 流程
│   ├── utils/              # EventStream、retry、校验、文本工具等
│   ├── compat.ts           # 旧全局 API 兼容层（待移除）
│   ├── images.ts / images-models.ts  # 图像生成侧（独立于对话侧）
│   └── cli.ts              # pi-ai CLI（login/list）
└── scripts/generate-models.ts  # 模型目录生成管线
```

**exports 多入口设计**（`package.json`）：核心入口 `.` 之外，还有 `. /compat`、`. /providers/*`、`. /api/*`、`. /oauth`、`. /bedrock-provider`、`. /bun-oauth`。目的是把重依赖隔离到子路径，保证 tree-shaking。

## 3. 再看局部：内部三层架构

```
types.ts（纯数据契约）
   │
   ▼
api/（线协议实现：stream + streamSimple）   ← 每家服务商一个模块
   │
   ▼
providers/（工厂组装：模型目录 + 鉴权 + API 包装）
   └── models.ts（Models 集合：鉴权解析 + 按 model.api 分发）
```

### API 实现层（`src/api/*.ts`）

每个模块恰好导出 `stream` 与 `streamSimple` 两个函数（即满足 `ProviderStreams` 接口）：

- `stream: StreamFunction` —— `(model, context, options) => AssistantMessageEventStream`。
- `streamSimple` —— 通过 `src/api/simple-options.ts` 的 `buildBaseOptions` 把 `reasoning` 档位（`minimal~max`）映射为 API 专属参数，再复用同一实现。

典型实现（以 `src/api/openai-responses.ts` 为例）：

```
构造 AssistantMessageEventStream → 立即同步返回
→ 后台 async 执行：
  构建输出骨架 → 转换消息/工具为 OpenAI 格式
  → 创建 SDK client → 发起流式请求
  → processResponsesStream：上游 SSE → 标准事件（text_delta/thinking_delta/toolcall_delta/done）
  → 计算 usage 与 cost（calculateCost，支持 Anthropic 1h 缓存写 2x 计价）
  → end()
```

### Provider 工厂层（`src/providers/<id>.ts`）

以 `src/providers/openai.ts` 为例，结构高度模板化：

```ts
return createProvider({
  id: "openai", name: "OpenAI",
  baseUrl: "https://api.openai.com/v1",
  auth: { apiKey: envApiKeyAuth("OpenAI API key", ["OPENAI_API_KEY"]) },
  models: Object.values(OPENAI_MODELS),   // 静态目录
  api: openAIResponsesApi(),              // 惰性 API 包装（.lazy.ts）
});
```

`createProvider`（`src/models.ts`）统一组装：`id/name/baseUrl/headers` + 必填 `auth: ProviderAuth` + `models`（静态基线） + 可选 `fetchModels`（动态拉取）/`filterModels`（按凭据过滤）/`api`（单一实现或按 `model.api` 分发的映射，如 GitHub Copilot 是三 API 混合映射）。

### Models 集合（`src/models.ts`）

`Models` 是外部使用者的统一入口：

```
models.stream(model, context, options)
  → lazyStream()               // 同步返回空流，后台做异步初始化
  → applyAuth()                // getAuth() 解析凭据 → 合并请求头
  → provider.stream(requestModel, context, requestOptions)
models.complete() = stream().result()
models.login()/logout()        // 编排 provider OAuth/apiKey 登录
models.refresh()               // 并发刷新所有动态 provider 的模型目录
```

## 4. 模型目录（Model Catalog）

**生成管线**（`scripts/generate-models.ts`，构建时先跑）：

```
models.dev 等数据源
  → scripts/generate-models.ts（映射、价格处理、compat 标志）
  → src/providers/data/<id>.json      （gitignore，构建时生成）
  → src/providers/<id>.models.ts      （flattenModelCatalog 包装，稳定）
  → src/models.generated.ts           （MODELS 全量注册表）
```

- 运行时读取**全部同步**；静态 provider 直接返回目录值。
- **动态 provider**（如 Radius）：`models` 初始为空，通过 `refreshModels()` 钩子用生效凭据动态拉取，经 `ModelsStore` 持久化/恢复，失败保留旧列表。

## 5. 鉴权与 OAuth

- `ProviderAuth { apiKey?: ApiKeyAuth; oauth?: OAuthAuth }`：每个 provider 必提供其一。
- **ApiKeyAuth**：标准实现是 `envApiKeyAuth(name, envVars)`——已存储凭据优先 → 依次查环境变量。非标准来源由 provider 自写（如 Anthropic 依次查 `ANTHROPIC_AUTH_TOKEN → ANTHROPIC_OAUTH_TOKEN → ANTHROPIC_API_KEY`）。
- **OAuthAuth**：`login(interaction)`（返回凭据）、`refresh(credential, signal)`（网络刷新）、`toAuth(credential)`（推导请求鉴权）。拆分让 `Models` 掌握加锁刷新（凭据过期且 `minOAuthValidityMs` 默认 5 分钟内判定）。
- **CredentialStore**：`read/list/modify/delete`，默认 `InMemoryCredentialStore`；coding-agent 用 `RuntimeCredentials` 落盘到 `~/.pi/agent/auth.json`。
- **AuthInteraction**：provider 无关的登录交互协议（`prompt` + `notify`），支持 text/secret/select/manual_code 与 auth_url/device_code 等事件。
- **OAuth 流程**（`src/auth/oauth/`）：Anthropic（PKCE + 本地回调服务器）、OpenAI Codex、GitHub Copilot、OpenRouter、xAI、Kimi For Coding、Radius。支持 OAuth 的 provider 用 `lazyOAuth` 惰性加载。
- 解析失败**绝不静默回退**：刷新失败或类型不匹配时直接报错。

## 6. 惰性加载设计（`.lazy.ts`）

核心入口与 provider 工厂**不携带任何服务商 SDK**（openai、@anthropic-ai/sdk、@google/genai、AWS SDK 等）：

- `lazyApi(load)`：`() => import("./xxx.ts")` 包装为 `ProviderStreams`，首次 stream 调用才加载模块。
- `lazyStream(model, setup)`：**同步返回**空流，后台执行异步 setup（鉴权解析、惰性模块加载）；setup 失败以 error 事件终止流。
- Node-only 代码（OAuth 回调服务器、PKCE）通过变量形式模块说明符 `import(runtimeSpecifier)` 让打包器无法静态追踪；Bun 独立二进制用 `registerBundledOAuthFlowLoaders` 静态注册。
- Bedrock 特例：AWS SDK 需 `setBedrockProviderModule` 显式注册。

## 7. faux provider（测试核心）

`src/providers/faux.ts`：脚本化假 provider，返回 `{ provider, api, models, getModel, state, setResponses, appendResponses, getPendingResponseCount }`。

- 从响应队列取一条 `FauxResponseStep`（`AssistantMessage` 或工厂回调），模拟真实流式（发 `start → *_start → 多片 *_delta → *_end → done`）。
- 支持 AbortSignal（发 `error: aborted`）、`tokensPerSecond` 节奏、prompt cache 模拟、按每 4 字符 1 token 估算 usage。
- 是大量测试与 coding-agent 测试套件（`test/suite/harness.ts`）的基础。

## 8. 图像生成侧（独立体系）

`images.ts` / `images-models.ts` / `image-models.generated.ts`：与对话侧对称但独立的 `ImagesModels.generateImages()` 体系，目前仅 OpenRouter 一个 provider。

## 9. 常用 API 速查

| 函数/类 | 说明 |
|---|---|
| `createModels(options)` | 创建 Models 集合 |
| `createProvider(options)` | 组装一个 provider |
| `models.stream / complete / streamSimple / completeSimple` | LLM 调用 |
| `models.login / logout` | 登录/登出 |
| `models.refresh(options)` | 刷新动态模型目录 |
| `builtinModels() / builtinProviders()` | 全量内置（`src/providers/all.ts`） |
| `getBuiltinModel(provider, id)` | 静态目录读取 |
| `fauxProvider(options)` | 测试 provider |
| `Type / Static / TSchema` | TypeBox 工具参数 schema |

> 权威细节：`packages/ai/README.md`、`packages/ai/CHANGELOG.md`。下一篇：[pi-agent-core](02-pi-agent-core.md)。
