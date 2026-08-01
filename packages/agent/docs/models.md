# Models architecture 模型架构

This document describes the target design for the next `pi-ai` model/provider refactor. It describes the desired shape, not the current implementation. It is intended to be complete enough to start implementing from a fresh session.
本文档描述下一轮 `pi-ai` 模型/提供方（provider）重构的目标设计。它描述的是期望达成的形态，而非当前的实现。其内容力求足够完整，使得可以从一个全新的会话开始着手实现。

Goals:
目标：

- `Models` is a dumb runtime collection of providers.
  `Models` 只是一个「笨」的运行时提供方集合。
- Concrete providers own metadata, auth, model listing, and stream behavior.
  具体的提供方自行拥有元数据、认证、模型列表与流式（stream）行为。
- API implementations live under `src/api/` and are reusable/lazy.
  API 实现位于 `src/api/` 下，可复用且惰性加载。
- Concrete provider factories live under `src/providers/`.
  具体的提供方工厂函数位于 `src/providers/` 下。
- Users can import only the providers they need.
  用户可以只导入自己需要的提供方。
- Importing a provider must not eagerly import heavy SDKs.
  导入一个提供方不得急切（eagerly）导入沉重的 SDK。
- Dynamic model lists are first-class: reads are sync (last-known list), fetching happens in an explicit async `refresh`.
  动态模型列表是一等公民：读取是同步的（返回最近一次已知的列表），拉取则发生在显式的异步 `refresh` 中。
- `models.json` and extensions layer by wrapping providers, not by mutating provider internals ad hoc.
  `models.json` 与扩展通过包装提供方来分层，而不是随意修改提供方的内部状态。
- Old global APIs survive only in an explicit, temporary `/compat` entrypoint.
  旧的全局 API 仅在一个显式的、临时的 `/compat` 入口中保留。

Non-goals for the immediate `pi-ai` pass:
本轮 `pi-ai` 改造的非目标：

- Do not migrate coding-agent `ModelRegistry` yet.
  暂不迁移 coding-agent 的 `ModelRegistry`。
- Do not keep the stream/API registry inside `Models`.
  不在 `Models` 内部保留 stream/API 注册表。
- Do not implement web OAuth flows yet.
  暂不实现 Web 端 OAuth 流程。
- Image generation mirrors the chat-side design (`ImagesModels`/`ImagesProvider` in `images-models.ts`); the old global image API (`images.ts`, `images-api-registry.ts`) lives on compat.
  图像生成沿用与对话侧一致的设计（`images-models.ts` 中的 `ImagesModels`/`ImagesProvider`）；旧的全局图像 API（`images.ts`、`images-api-registry.ts`）保留在 compat 中。

## Package layout 包结构布局

Target source layout:
目标源码布局：

```txt
packages/ai/src/
  index.ts                    # core exports only; no built-in provider imports
  models.ts                   # Models runtime, Provider
  images-models.ts            # ImagesModels runtime, ImagesProvider (mirrors models.ts)
  compat.ts                   # temporary old-API compatibility entrypoint
  auth/                       # auth method types, helpers, shared resolveProviderAuth(), login callbacks
  api/                        # API implementations and lazy wrappers
    openai-completions.ts     # real implementation, imports SDKs, exports stream/streamSimple
    openai-completions.lazy.ts
    openai-responses.ts
    openai-responses.lazy.ts
    openai-codex-responses.ts
    openai-codex-responses.lazy.ts
    azure-openai-responses.ts
    azure-openai-responses.lazy.ts
    anthropic-messages.ts
    anthropic-messages.lazy.ts
    google-generative-ai.ts
    google-generative-ai.lazy.ts
    google-vertex.ts
    google-vertex.lazy.ts
    mistral-conversations.ts
    mistral-conversations.lazy.ts
    bedrock-converse-stream.ts
    bedrock-converse-stream.lazy.ts
    openrouter-images.ts      # image-generation API implementation
    openrouter-images.lazy.ts
    lazy.ts                   # lazyStream()/lazyApi() helpers
    (shared helpers: openai-responses-shared, google-shared, transform-messages, ...)
  providers/                  # concrete provider factories and per-provider catalogs
    openai.ts
    openai.models.ts          # generated OpenAI catalog
    openai-codex.ts
    openai-codex.models.ts
    anthropic.ts
    anthropic.models.ts
    google.ts
    google.models.ts
    ...one pair per built-in provider...
    openrouter-images.ts      # image-generation provider factory
    faux.ts                   # test provider factory
    all.ts                    # explicit aggregate: builtinModels(), builtinImagesModels(), getBuiltin*()
  auth/oauth/                 # Canonical OAuth implementations (node), lazy-loaded
```

`src/index.ts` must stay core-only. It must not import:
`src/index.ts` 必须保持仅包含核心内容。它不得导入：

- generated model catalogs
  生成的模型目录（catalog）
- built-in provider factories
  内置提供方工厂
- provider SDK implementations
  提供方的 SDK 实现
- Node-only OAuth modules
  仅限 Node 环境的 OAuth 模块
- `providers/all`
- `compat`

Provider, API, and compat entrypoints are explicit subpath exports.
提供方、API 与 compat 入口都是显式的子路径导出（subpath exports）。

## Public usage 公开用法

Minimal provider usage:
最简的提供方用法：

```ts
import { createModels } from "@earendil-works/pi-ai";
import { openaiProvider } from "@earendil-works/pi-ai/providers/openai";

const models = createModels();
models.setProvider(openaiProvider());

const model = models.getModel("openai", "gpt-4o-mini");
if (!model) throw new Error("model not found");

const response = await models.complete(model, context);
```

Multiple providers:
使用多个提供方：

```ts
const models = createModels();
models.setProvider(openaiProvider());
models.setProvider(openrouterProvider());
```

All built-ins, explicitly heavy metadata entrypoint:
全部内置提供方，即显式的重量级元数据入口：

```ts
import { builtinModels } from "@earendil-works/pi-ai/providers/all";

const models = builtinModels();
```

`providers/all` may import all provider metadata/catalogs. It still must not eagerly import SDK implementations; provider streams use lazy wrappers.
`providers/all` 可以导入全部提供方的元数据/目录，但仍然不得急切导入 SDK 实现；提供方的 stream 使用惰性包装器。

## Core runtime: Models 核心运行时：Models

`Models` is a provider collection plus auth application and stream convenience. No stream registry, no auth resolver strategy object.
`Models` 是一个提供方集合，外加认证的应用与便捷的流式方法。没有 stream 注册表，也没有认证解析策略对象。

```ts
export function createModels(options?: {
  /** App-owned credential storage. Default: in-memory store. */
  credentials?: CredentialStore;
  /** Environment access for auth resolution (env vars, file existence). Default: process.env/node:fs backed; injectable for tests and non-Node hosts. */
  authContext?: AuthContext;
}): MutableModels;

export interface Models {
  getProviders(): readonly Provider[];
  getProvider(id: string): Provider | undefined;

  /** Sync read of last-known models. Best-effort: a provider whose getModels() throws yields no models. */
  getModels(provider?: string): readonly Model<Api>[];
  /** Dynamic lists are honestly Model<Api>; narrow with the hasApi() guard. */
  getModel(provider: string, id: string): Model<Api> | undefined;

  /**
   * Ask dynamic providers to re-fetch their model lists. With a provider id,
   * rejects on that provider's failure; without, refreshes all concurrently
   * best-effort. Static providers are no-ops.
   */
  refresh(provider?: string): Promise<void>;

  /**
   * Resolve request auth for a model. Includes source label for status UI.
   * Resolves undefined when the provider is unknown or unconfigured. Rejects
   * with ModelsError ("oauth" on refresh failure, "auth" on api-key/store
   * failure); status/availability UIs catch rejections and render
   * "needs re-login" instead of treating them as unconfigured.
   */
  getAuth(model: Model<Api>): Promise<AuthResult | undefined>;

  stream<TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options?: ApiStreamOptions<TApi>,
  ): AssistantMessageEventStream;

  complete<TApi extends Api>(
    model: Model<TApi>,
    context: Context,
    options?: ApiStreamOptions<TApi>,
  ): Promise<AssistantMessage>;

  streamSimple(model: Model<Api>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream;
  completeSimple(model: Model<Api>, context: Context, options?: SimpleStreamOptions): Promise<AssistantMessage>;
}

export interface MutableModels extends Models {
  /** Upsert/replace by provider.id. Provider ids are unique. */
  setProvider(provider: Provider): void;
  deleteProvider(id: string): void;
  clearProviders(): void;
}
```

Removed concepts:
被移除的概念：

```txt
no Models.setStreamFunctions() / getStreamFunctions()
no api-registry as a real dispatch mechanism
no Models.provider(id) builder, no setModel/upsertModel/patchModel lifecycle
no ModelAuthResolver / setAuthResolver — resolution policy is fixed, store is injected
```

If an app needs different auth policy, it wraps providers (wrap auth methods or `getModels`) or passes explicit request auth in stream options.
如果应用需要不同的认证策略，它可以包装提供方（包装认证方法或 `getModels`），或者在 stream 选项中传入显式的请求认证信息。

## Provider 提供方

A provider is the concrete runtime unit. It owns id/name/base metadata, auth methods, model listing, and stream behavior.
提供方是具体的运行时单元。它拥有 id/name/基础元数据、认证方法、模型列表以及流式行为。

`Provider` is generic over the APIs its models use. Concrete factories declare what they emit (`openaiProvider(): Provider<"openai-responses" | "openai-completions">`), giving typed model lists to direct factory users. A `Models` collection holds providers as `Provider<Api>`.
`Provider` 对其模型所使用的 API 是泛型的。具体的工厂函数会声明自己产出的类型（例如 `openaiProvider(): Provider<"openai-responses" | "openai-completions">`），从而为直接使用工厂的用户提供带类型的模型列表。`Models` 集合则以 `Provider<Api>` 的形式持有提供方。

```ts
export interface Provider<TApi extends Api = Api> {
  readonly id: string;
  readonly name: string;

  readonly baseUrl?: string;
  readonly headers?: Record<string, string>;

  /**
   * Required: at least one of apiKey/oauth. Even ambient-credential providers
   * (env vars, AWS profiles, ADC) and keyless local servers provide apiKey
   * auth whose resolve() reports whether the provider is configured.
   * getAuth() returning undefined = not configured.
   */
  readonly auth: ProviderAuth;

  /** Current known models, sync. Static providers: the catalog. Dynamic providers: as of the last refresh (empty before the first). */
  getModels(): readonly Model<TApi>[];

  /** Dynamic providers only: fetch and update the model list. Concurrent calls share one in-flight fetch. */
  refreshModels?(): Promise<void>;

  stream<T extends TApi>(model: Model<T>, context: Context, options?: ApiStreamOptions<T>): AssistantMessageEventStream;

  streamSimple(model: Model<TApi>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream;
}
```

There is no `Provider.api` field. `model.api` carries API identity; the provider dispatches internally (see `createProvider()`).
不存在 `Provider.api` 字段。API 身份由 `model.api` 承载；提供方在内部完成分发（参见 `createProvider()`）。

`Model.api` remains: existing metadata and tests use it, it is useful for diagnostics, and provider construction uses it for API implementation selection. But `Models` never dispatches on it; the provider does.
`Model.api` 予以保留：现有的元数据和测试会用到它，它对诊断也很有用，并且提供方在构造时用它来选择 API 实现。但 `Models` 绝不会依据它进行分发；分发由提供方负责。

### Typed stream options 带类型的流式选项

Full stream options are API-specific. `Model<TApi>` pays off by deriving the option type from the API:
完整的流式选项是与具体 API 相关的。`Model<TApi>` 的价值就在于可以从 API 推导出选项类型：

```ts
// types.ts — type-only imports from API impl modules are erased, so this is tree-shake safe
export interface ApiOptionsMap {
  "anthropic-messages": AnthropicOptions;
  "openai-completions": OpenAICompletionsOptions;
  "openai-responses": OpenAIResponsesOptions;
  "openai-codex-responses": OpenAICodexResponsesOptions;
  "azure-openai-responses": AzureOpenAIResponsesOptions;
  "google-generative-ai": GoogleOptions;
  "google-vertex": GoogleVertexOptions;
  "mistral-conversations": MistralOptions;
  "bedrock-converse-stream": BedrockOptions;
}

export type ApiStreamOptions<TApi extends Api> = TApi extends keyof ApiOptionsMap
  ? ApiOptionsMap[TApi]
  : StreamOptions & Record<string, unknown>;
```

Custom api strings fall back to the generic shape.
自定义的 api 字符串会回退到通用形态。

### Typed model narrowing 模型类型收窄

Runtime model lists are dynamic, so `models.getModel()`/`getModels()` honestly return `Model<Api>`. Typing improves at three points:
运行时的模型列表是动态的，因此 `models.getModel()`/`getModels()` 如实返回 `Model<Api>`。类型信息在三个位置得到增强：

1. **`hasApi()` type guard** — runtime-checked narrowing for dynamic lookups (no blind casts):
   **`hasApi()` 类型守卫** —— 为动态查找提供经运行时校验的类型收窄（无需盲目断言）：

   ```ts
   export function hasApi<TApi extends Api>(model: Model<Api>, api: TApi): model is Model<TApi>;

   const model = models.getModel("anthropic", "claude-opus-4-7");
   if (model && hasApi(model, "anthropic-messages")) {
     // model: Model<"anthropic-messages">, stream options fully typed
   }
   ```

2. **`getBuiltinModel()`** — sync, generated-catalog lookup with typed overloads: `(provider, id) -> Model<exact-api-literal>`. The path for hardcoded known models.
   **`getBuiltinModel()`** —— 同步的、仅面向生成目录的查找，带有类型化重载：`(provider, id) -> Model<exact-api-literal>`。这是硬编码已知模型时使用的路径。

3. **`Provider<TApi>` factories** — typed model lists when using a provider directly, without a `Models` collection.
   **`Provider<TApi>` 工厂** —— 在不经过 `Models` 集合、直接使用提供方时，可获得带类型的模型列表。

Deliberately not done: tying `models.getModel(provider, ...)` to typed provider/model ids would require statically knowing which providers are installed in a mutable runtime collection. The harness path (`streamSimple` + `SimpleStreamOptions`) is API-agnostic and unaffected.
有意不做的事情：把 `models.getModel(provider, ...)` 与类型化的 provider/model id 绑定，需要在一个可变的运行时集合中静态地知道安装了哪些提供方。harness 路径（`streamSimple` + `SimpleStreamOptions`）与 API 无关，不受影响。

For comparison: Vercel AI SDK attaches the implementation to the model object, which dissolves dispatch typing but makes models non-serializable (no sessions/RPC/catalogs as plain data), and its `providerOptions` bag is `Record<string, JSON>` checked only by `satisfies` convention. Plain-data models + provider-owned behavior keeps stronger typing where it matters.
作为对比：Vercel AI SDK 把实现附加到模型对象上，这虽然消解了分发时的类型问题，却使模型不可序列化（无法把会话/RPC/目录当作纯数据处理），而且其 `providerOptions` 包是 `Record<string, JSON>`，仅靠 `satisfies` 约定来做检查。纯数据模型 + 由提供方拥有行为的方案，在真正重要的地方保留了更强的类型。

### Name collision 命名冲突

`types.ts` currently exports `type Provider = KnownProvider | string` (a provider id). Rename that alias to `ProviderId` and fix call sites. The `Provider` interface above takes the name.
`types.ts` 目前导出了 `type Provider = KnownProvider | string`（表示提供方 id）。应将该别名重命名为 `ProviderId` 并修正所有调用点。上文的 `Provider` 接口接管 `Provider` 这个名字。

## Provider model listing 提供方的模型列表

Reads are sync; fetching is an explicit async verb. `Provider.getModels()` returns the current known list — the full catalog for static providers, the last-refreshed list for dynamic ones (llama.cpp, OpenRouter live listing). `refreshModels()` is where dynamic providers fetch.
读取是同步的；拉取则是一个显式的异步动作。`Provider.getModels()` 返回当前已知的列表 —— 对静态提供方是完整目录，对动态提供方（llama.cpp、OpenRouter 实时列表）则是最近一次刷新的结果。动态提供方在 `refreshModels()` 中执行拉取。

This split exists because a sync-or-async union (`Promise<T> | T`) invites latent sync assumptions that detonate on the first async provider, while async-only reads force every consumer (UI lists, extension `find`/`getAll` surfaces) through Promises for data that is almost always static. Sync reads + explicit refresh keeps the staleness visible and the contract single: `getModels()` = last known, `refresh()` = make it current. A fetched list is stale the moment it returns anyway; naming the refresh point is honest about it.
之所以这样拆分，是因为「同步或异步」的联合类型（`Promise<T> | T`）会诱发潜在的同步假设，一旦遇到第一个异步提供方就会爆雷；而全异步的读取又会迫使每一个消费方（UI 列表、扩展的 `find`/`getAll` 接口）为几乎总是静态的数据去走 Promise。同步读取 + 显式刷新既让数据的陈旧程度显而易见，也让契约保持单一：`getModels()` = 最近已知，`refresh()` = 使其变为最新。反正拉取回来的列表在返回的那一刻就已经过期了；把刷新点明确命名出来才是诚实的做法。

Apps own the refresh lifecycle: startup, registry reload, opening a model selector. Freshness-critical lookups are two-step: `await models.refresh("llamacpp"); models.getModel("llamacpp", id)`.
刷新的生命周期由应用自己掌握：启动时、注册表重载时、打开模型选择器时。对新鲜度敏感的查找分两步进行：`await models.refresh("llamacpp"); models.getModel("llamacpp", id)`。

Dynamic refresh must be side-effect-free discovery:
动态刷新必须是无副作用的发现操作：

```txt
OK: fetch /v1/models, enumerate local catalog, refresh cached remote model list
Not OK: load model, download model, mutate server state, run request probe
```

Provider-specific model lifecycle (load/unload) belongs in app/provider-management commands, not in `refreshModels()`.
提供方专属的模型生命周期操作（加载/卸载）属于应用或提供方管理命令的范畴，不应放在 `refreshModels()` 中。

## Streaming path 流式路径

`Models.stream()` finds the provider by `model.provider`, resolves auth, merges it into request options, and delegates:
`Models.stream()` 依据 `model.provider` 找到提供方，解析认证信息，将其合并进请求选项，然后委派执行：

```ts
function stream(model, context, options) {
  const provider = this.getProvider(model.provider);
  if (!provider) {
    // produce an error stream, not a throw — see Error behavior
  }

  // async setup happens inside the returned stream (lazyStream pattern)
  const resolution = await this.getAuth(model);
  const requestModel = resolution?.auth.baseUrl ? { ...model, baseUrl: resolution.auth.baseUrl } : model;
  const requestOptions = mergeAuth(options, resolution?.auth); // explicit options win per-field

  return provider.stream(requestModel, context, requestOptions);
}
```

`stream()` returns `AssistantMessageEventStream` synchronously; async setup (auth resolution, lazy module load) happens inside the returned stream. The forwarding pattern already exists in today's `register-builtins.ts` (`createLazyStream`); extract it as `lazyStream()` in `src/api/lazy.ts`.
`stream()` 同步返回 `AssistantMessageEventStream`；异步的准备工作（认证解析、惰性模块加载）在返回的流内部完成。这种转发模式在如今的 `register-builtins.ts` 中已经存在（`createLazyStream`）；应将其抽取为 `src/api/lazy.ts` 中的 `lazyStream()`。

No request hot-path model canonicalization: `stream()` uses the supplied model object as-is. If an app wants fresh model metadata, it refreshes the provider and re-reads (`await models.refresh(p); models.getModel(p, id)`) before starting the turn.
请求热路径上不做模型规范化：`stream()` 原样使用传入的模型对象。如果应用需要最新的模型元数据，应在开始一轮对话之前刷新提供方并重新读取（`await models.refresh(p); models.getModel(p, id)`）。

## API implementations under `src/api` `src/api` 下的 API 实现

An API implementation is reusable stream behavior. It is not a provider.
API 实现是可复用的流式行为，它不是提供方。

Uniform export contract — every real implementation module exports exactly:
统一的导出契约 —— 每个真实的实现模块都恰好导出：

```ts
// src/api/anthropic-messages.ts — imports SDKs
export function stream(model, context, options) { ... }
export function streamSimple(model, context, options) { ... }
```

This makes the module itself satisfy `ProviderStreams`, so the lazy wrapper is one generic helper instead of bespoke per-API plumbing. `ProviderStreams` is the untyped dispatch shape (implementation modules export concretely typed functions, which would not be assignable to a generic method); per-API option typing lives on the modules themselves and on `Provider.stream()` via `ApiStreamOptions`:
这使得模块本身即满足 `ProviderStreams`，因此惰性包装器只需一个通用辅助函数，而不必为每种 API 单独编写管道代码。`ProviderStreams` 是无类型的分发形态（实现模块导出的是具体类型化的函数，它们无法赋值给泛型方法）；按 API 区分的选项类型则由模块自身以及 `Provider.stream()` 通过 `ApiStreamOptions` 承载：

```ts
export interface ProviderStreams {
  stream(model: Model<Api>, context: Context, options?: StreamOptions): AssistantMessageEventStream;
  streamSimple(model: Model<Api>, context: Context, options?: SimpleStreamOptions): AssistantMessageEventStream;
}

// src/api/lazy.ts
export function lazyApi(load: () => Promise<ProviderStreams>): ProviderStreams;

// src/api/anthropic-messages.lazy.ts
export const anthropicMessagesApi = (): ProviderStreams => lazyApi(() => import("./anthropic-messages.ts"));
```

Import chain:
导入链路：

```txt
provider module -> lazy API wrapper -> dynamic import(real API impl) -> SDK deps
```

Notes:
注意事项：

- Bedrock keeps the node-only dynamic import trick (`importNodeOnlyProvider`, `.ts`/`.js` specifier rewrite) inside its lazy wrapper. `setBedrockProviderModule()` (used by the Bun build) moves into the bedrock lazy wrapper module.
  Bedrock 在其惰性包装器内部保留仅限 Node 的动态导入技巧（`importNodeOnlyProvider`，以及 `.ts`/`.js` 说明符重写）。`setBedrockProviderModule()`（供 Bun 构建使用）迁入 bedrock 的惰性包装器模块。
- Shared helper modules (`openai-responses-shared.ts`, `google-shared.ts`, `transform-messages.ts`, prompt-cache, copilot headers) move to `src/api/` alongside the implementations.
  共享的辅助模块（`openai-responses-shared.ts`、`google-shared.ts`、`transform-messages.ts`、prompt-cache、copilot headers）随实现一并迁移到 `src/api/`。

## Shared API implementations across concrete providers 多个具体提供方共享 API 实现

Many concrete providers share an API implementation (OpenAI-completions: OpenRouter, Groq, Cerebras, xAI, ZAI, ...). They share lazy API objects by reference:
许多具体提供方共享同一份 API 实现（OpenAI-completions：OpenRouter、Groq、Cerebras、xAI、ZAI 等）。它们按引用共享惰性 API 对象：

```ts
import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";

export function openrouterProvider(): Provider {
  return createProvider({
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    auth: { apiKey: envApiKeyAuth("OpenRouter API key", ["OPENROUTER_API_KEY"]) },
    models: OPENROUTER_MODELS,
    api: openAICompletionsApi(),
  });
}
```

This copies Vercel AI SDK's useful property: users import concrete providers; shared protocol implementation is internal.
这借鉴了 Vercel AI SDK 的一个有益特性：用户导入的是具体提供方，而共享的协议实现属于内部细节。

## Auth 认证

Request auth output stays small:
请求认证的输出结构保持精简：

```ts
export interface ModelAuth {
  apiKey?: string;
  headers?: Record<string, string>;
  baseUrl?: string;
}
```

If a value cannot be expressed as `apiKey`, `headers`, or `baseUrl`, it is provider config, not auth (Vertex project/location, Bedrock region/profile, Azure apiVersion are provider factory options).
如果某个值无法表达为 `apiKey`、`headers` 或 `baseUrl`，那它属于提供方配置而非认证信息（Vertex 的 project/location、Bedrock 的 region/profile、Azure 的 apiVersion 都是提供方工厂的选项）。

### Provider auth 提供方认证

`Provider.auth` has exactly two slots; real providers have at most one api-key path and at most one OAuth path, and the slot names carry the UI's oauth-vs-api-key split without a `kind` discriminant or method ids:
`Provider.auth` 恰好有两个槽位；真实的提供方最多有一条 api-key 路径和一条 OAuth 路径，槽位名称本身就承载了 UI 上 oauth 与 api-key 的区分，无需 `kind` 判别字段或方法 id：

```ts
export interface ProviderAuth {
  apiKey?: ApiKeyAuth; // stored key/provider env + ambient env/files/ADC/IAM
  oauth?: OAuthAuth;   // login flow + refresh
}

export interface ApiKeyAuth {
  name: string; // "Anthropic API key"

  /** Interactive setup (prompt for key/provider env). Absent = ambient-only (env, ADC, IAM). */
  login?(interaction: AuthInteraction): Promise<ApiKeyCredential>;

  /**
   * Resolve auth from the stored credential and/or ambient sources, merging
   * per field (credential.key ?? env("..."), credential.env?.NAME ?? env("...")).
   * undefined = not configured.
   */
  resolve(input: {
    model: Model<Api>;
    ctx: AuthContext;
    credential?: ApiKeyCredential;
  }): Promise<AuthResult | undefined>;
}

export interface OAuthAuth {
  name: string; // "Anthropic (Claude Pro/Max)"

  login(interaction: AuthInteraction): Promise<OAuthCredential>;

  /** Exchange the refresh token. Network call; throws on failure (invalid_grant etc.). Runs under the store lock. */
  refresh(credential: OAuthCredential): Promise<OAuthCredential>;

  /** Side-effect-free derivation of request auth from a valid credential. Covers Copilot-style per-credential baseUrl. Async so lazy wrappers can load the implementation. */
  toAuth(credential: OAuthCredential): Promise<ModelAuth>;
}

export interface AuthResult {
  auth: ModelAuth;
  /** Human-readable label for status UI: "ANTHROPIC_API_KEY", "OAuth", "~/.aws/credentials". */
  source?: string;
}

export interface AuthContext {
  env(name: string): Promise<string | undefined>;
  fileExists(path: string): Promise<boolean>; // supports leading ~
}
```

The `refresh`/`toAuth` split lets `Models` own the locked refresh pattern without closure gymnastics: refresh produces a credential, while `toAuth` derives request auth from whatever credential ends up stored.
把 `refresh` 与 `toAuth` 拆开，使得 `Models` 可以掌控加锁刷新的模式而不必玩弄闭包技巧：refresh 负责产出凭据（credential），而 `toAuth` 则从最终存储下来的凭据推导出请求认证信息。

OAuth implementations use the provider-neutral `AuthInteraction` protocol directly. A callback-server flow issues a `manual_code` prompt racing the server and aborts the prompt when the callback wins, so the UI needs no provider-specific callback or static callback-server flag.
OAuth 实现直接使用与提供方无关的 `AuthInteraction` 协议。基于回调服务器的流程会发出一个 `manual_code` 提示与服务器竞速，一旦回调胜出便中止该提示，因此 UI 无需任何提供方专属的回调或静态的回调服务器标记。

### Credentials 凭据

One credential per provider, type-tagged — exactly the shape of today's auth.json (`type: "api_key" | "oauth"` per provider id):
每个提供方一份凭据，并带类型标签 —— 与如今 auth.json 的结构完全一致（每个 provider id 对应 `type: "api_key" | "oauth"`）：

```ts
export interface ApiKeyCredential {
  type: "api_key";
  key?: string;
  env?: ProviderEnv; // e.g. Cloudflare account/gateway ids, Azure/Vertex/Bedrock scoped config
}

export interface OAuthCredential extends OAuthCredentials {
  type: "oauth"; // access, refresh, expires from OAuthCredentials
}

export type Credential = ApiKeyCredential | OAuthCredential;
```

`ApiKeyCredential.env` stores provider-scoped environment/config values alongside or instead of a key. `ApiKeyAuth.resolve()` merges per field: `credential.key ?? env("CLOUDFLARE_API_KEY")`, `credential.env?.CLOUDFLARE_ACCOUNT_ID ?? env("CLOUDFLARE_ACCOUNT_ID")`, etc. The credential discriminator intentionally matches today's `auth.json` (`api_key`) so the file-backed store does not need lossy type translation.
`ApiKeyCredential.env` 用于在密钥之外（或替代密钥）存放提供方作用域内的环境变量/配置值。`ApiKeyAuth.resolve()` 按字段逐一合并：`credential.key ?? env("CLOUDFLARE_API_KEY")`、`credential.env?.CLOUDFLARE_ACCOUNT_ID ?? env("CLOUDFLARE_ACCOUNT_ID")` 等等。凭据的判别字段刻意与今天的 `auth.json` 保持一致（`api_key`），使基于文件的存储无需做有损的类型转换。

### Credential store 凭据存储

The app injects storage; `pi-ai` ships an in-memory default. Keyed by provider id, one credential per provider:
存储由应用注入；`pi-ai` 自带一个内存实现作为默认值。以 provider id 为键，每个提供方一份凭据：

```ts
export interface CredentialStore {
  /** Read the stored credential, possibly expired. Display/status use; request auth comes from Models.getAuth(). */
  read(providerId: string): Promise<Credential | undefined>;

  /**
   * Serialized write — the only write path. fn sees the current credential
   * because correct writes (refresh, login-during-refresh) depend on it;
   * return the new credential, or undefined to leave the entry unchanged.
   * Mutual exclusion per provider id, cross-process too where the backing
   * store supports it (file lock). Resolves with the post-write credential.
   */
  modify(
    providerId: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
  ): Promise<Credential | undefined>;

  /** Remove (logout). Serialized against modify. */
  delete(providerId: string): Promise<void>;
}
```

There is deliberately no `set`: an unserialized write path invites read-modify-write races (login-during-refresh clobbering a fresh credential, double token refresh). Call sites:
这里刻意没有 `set`：未串行化的写入路径会招致「读-改-写」竞态（刷新期间登录会覆盖掉刚获取的凭据、令牌被重复刷新等）。调用点如下：

```ts
await store.modify(pid, async () => credential);      // login: store this
await store.read(pid);                                // status UI ("logged in via OAuth")
await store.delete(pid);                               // logout
// refresh RMW happens inside Models.getAuth
```

Error semantics: `read` resolves `undefined` for missing entries; methods reject only on storage failure, and `Models` wraps such rejections in `ModelsError` code `"auth"`. Best-effort stores that serve an in-memory view and record persistence errors internally (today's AuthStorage behavior) are valid implementations.
错误语义：对不存在的条目，`read` 解析为 `undefined`；各方法仅在存储失败时 reject，`Models` 会将此类 reject 包装为 `ModelsError` 且错误码为 `"auth"`。那些尽力而为、对外提供内存视图并在内部记录持久化错误的存储实现（即今天 AuthStorage 的行为）也是合法实现。

### Resolution policy (fixed) 解析策略（固定）

`Models.getAuth(model)` is a decision tree, not a loop. A stored credential owns the provider — ambient/env is consulted only when nothing is stored (AuthStorage parity: no silent env fallback after a failed refresh or for an unmatched credential type):
`Models.getAuth(model)` 是一棵决策树，而非循环。已存储的凭据独占该提供方 —— 只有在没有任何存储凭据时才会查询环境（ambient/env）来源（与 AuthStorage 保持一致：刷新失败之后、或凭据类型不匹配时，都不会静默回退到环境变量）：

```ts
const stored = await store.read(provider.id);
if (stored) {
  if (stored.type === "oauth" && provider.auth.oauth) {
    const oauth = provider.auth.oauth;
    let credential = stored;
    if (Date.now() >= credential.expires) {                 // optimistic check, lock-free
      const post = await store.modify(provider.id, async (current) => {
        if (current?.type !== "oauth") return undefined;    // logged out meanwhile
        return Date.now() >= current.expires                // authoritative check, under lock
          ? oauth.refresh(current)                          // throws -> ModelsError("oauth")
          : undefined;                                      // another process/request refreshed
      });
      if (post?.type !== "oauth") return undefined;
      credential = post;
    }
    return { auth: await oauth.toAuth(credential), source: "OAuth" };
  }
  if (stored.type === "api_key" && provider.auth.apiKey) {
    return provider.auth.apiKey.resolve({ model, ctx, credential: stored });
  }
  return undefined; // stored credential without matching handler blocks ambient
}
return provider.auth.apiKey?.resolve({ model, ctx, credential: undefined }); // ambient
```

Properties:
特性：

- Double-checked locking, same as today's `refreshOAuthTokenWithLock`: valid tokens cost one `read` and zero locks; expired tokens lock, re-check under the lock, refresh once globally, persist before release.
  双重检查加锁，与今天的 `refreshOAuthTokenWithLock` 相同：有效令牌只需一次 `read`、零次加锁；过期令牌则加锁、在锁内重新检查、全局只刷新一次，并在释放锁之前完成持久化。
- Explicit request auth (stream options `apiKey`/`headers`) is merged per-field on top in `stream()`, winning over everything.
  显式的请求认证（stream 选项中的 `apiKey`/`headers`）会在 `stream()` 中按字段合并到最上层，优先级高于一切。
- Refresh failure rejects with `ModelsError("oauth")`; the stored credential is untouched (preserved for retry). Request paths surface this as a stream error with the real cause ("run /login"); status/availability UIs catch the rejection and render "needs re-login" — documented contract on `getAuth`.
  刷新失败时以 `ModelsError("oauth")` reject；已存储的凭据保持不变（保留以便重试）。请求路径会把它呈现为携带真实原因的流式错误（例如「run /login」）；状态/可用性 UI 则捕获该 reject 并显示「需要重新登录」—— 这是 `getAuth` 上有文档约定的契约。

### Replacing AuthStorage 替换 AuthStorage

The end state for coding-agent: AuthStorage is deleted; its capabilities map onto a `CredentialStore` implementation plus composition.
coding-agent 的最终状态：删除 AuthStorage；其能力映射到一个 `CredentialStore` 实现加上若干组合装饰。

Today's `getApiKey` priority and its new home:
今天 `getApiKey` 的优先级及其新的归属：

| AuthStorage today 今天的 AuthStorage | New design 新设计 |
|---|---|
| runtime override (CLI `--api-key`) 运行时覆盖（CLI `--api-key`） | `withRuntimeOverrides(store, overrides)` decorator: `read` returns the override as an `ApiKeyCredential`; never persisted<br>`withRuntimeOverrides(store, overrides)` 装饰器：`read` 将覆盖值作为 `ApiKeyCredential` 返回；永不持久化 |
| stored `api_key` (with `$ENV`/`!command` via `resolveConfigValue`) 存储的 `api_key`（通过 `resolveConfigValue` 支持 `$ENV`/`!command`） | stored `ApiKeyCredential`; config-value resolution happens at `read` in coding-agent's adapter/decorator (command execution stays app policy)<br>存储为 `ApiKeyCredential`；配置值解析在 coding-agent 的适配器/装饰器的 `read` 中完成（命令执行仍属应用策略） |
| stored `oauth` + locked refresh, undefined on failure 存储的 `oauth` + 加锁刷新，失败时返回 undefined | `getAuth` decision tree above; failure rejects with cause instead of silently unconfiguring<br>采用上文的 `getAuth` 决策树；失败时带原因 reject，而不是静默地视作未配置 |
| env var (only when nothing stored) 环境变量（仅在没有任何存储凭据时） | ambient branch of `apiKey.resolve`<br>`apiKey.resolve` 的环境（ambient）分支 |
| `fallbackResolver` (models.json custom providers) `fallbackResolver`（models.json 自定义提供方） | gone — custom providers carry their own `auth.apiKey`<br>已移除 —— 自定义提供方自带 `auth.apiKey` |

```txt
FileCredentialStore        ports AuthStorage's lock backend: read = memory snapshot,
                           modify = withLockAsync(re-read, fn, merge-write), delete,
                           internal error recording (drainErrors equivalent)
└─ withConfigValues        $ENV / !command at read
   └─ withRuntimeOverrides --api-key
      └─ createModels({ credentials: store })

login/logout UI            provider.auth.{oauth,apiKey}.login(interaction) + store.modify/delete
status UI                  store.read(pid) + getAuth try/catch ("needs /login" on rejection)
getOAuthProviders          presence of provider.auth.oauth across registered providers
```

### Login callbacks 登录回调

One interface serves api-key and OAuth login:
同一个接口同时服务于 api-key 登录与 OAuth 登录：

```ts
export interface AuthInteraction {
  /** Aborts the whole login flow. Per-prompt cancellation uses AuthPrompt.signal. */
  signal?: AbortSignal;

  prompt(prompt: AuthPrompt): Promise<string>;
  notify(event: AuthEvent): void;
}

/** `signal` lets the flow cancel a pending prompt when an out-of-band event resolves the step. */
export type AuthPrompt = { signal?: AbortSignal } & (
  | { type: "text"; message: string; placeholder?: string }
  | { type: "secret"; message: string; placeholder?: string }
  | { type: "select"; message: string; options: readonly { id: string; label: string; description?: string }[] }
  | { type: "manual_code"; message: string; placeholder?: string }
);

export type AuthEvent =
  | { type: "auth_url"; url: string; instructions?: string }
  | { type: "device_code"; userCode: string; verificationUri: string; intervalSeconds?: number; expiresInSeconds?: number }
  | { type: "progress"; message: string };
```

`prompt()` returns the entered/selected string (`select` returns the option id). Flows race a `manual_code` prompt against a callback server by setting `AuthPrompt.signal` and aborting the prompt when the callback wins.
`prompt()` 返回用户输入/选择的字符串（`select` 返回选项 id）。流程通过设置 `AuthPrompt.signal`，让 `manual_code` 提示与回调服务器竞速，并在回调胜出时中止该提示。

### OAuth attachment OAuth 的挂载

Providers that support OAuth always attach it. There is no factory toggle: the flow is lazy-loaded, so advertising OAuth costs nothing until `login()`/`refresh()` actually runs, and a host that never logs in never loads it.
支持 OAuth 的提供方总是挂载它。不存在工厂开关：流程是惰性加载的，因此在 `login()`/`refresh()` 真正运行之前，声明支持 OAuth 不产生任何开销；从不登录的宿主环境永远不会加载它。

```ts
export function anthropicProvider(): Provider {
  return createProvider({
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    auth: {
      apiKey: envApiKeyAuth("Anthropic API key", ["ANTHROPIC_API_KEY"]),
      oauth: lazyOAuth({
        name: "Anthropic (Claude Pro/Max)",
        load: () => import("../auth/oauth/anthropic.ts").then((m) => m.anthropicOAuth),
      }),
    },
    models: ANTHROPIC_MODELS,
    api: anthropicMessagesApi(),
  });
}
```

`lazyOAuth()` wraps a dynamically imported `OAuthAuth` so provider definitions can advertise OAuth without importing the implementation (`toAuth` is async for exactly this reason):
`lazyOAuth()` 包装一个动态导入的 `OAuthAuth`，使提供方定义能够在不导入实现的前提下声明支持 OAuth（`toAuth` 之所以是异步的，正是出于这个原因）：

```ts
export function lazyOAuth(input: {
  name: string;
  load: () => Promise<OAuthAuth>;
}): OAuthAuth;
```

OAuth must not force Node-only code (`node:http`, `node:crypto`) into browser bundles: the dynamic import inside `lazyOAuth()` uses the same bundler-opaque variable-specifier trick as the bedrock lazy wrapper. Browser hosts never trigger the load (no stored node OAuth credentials, no login flow). If web OAuth lands later (sitegeist proved feasibility: Web Crypto PKCE, auth tab, fetch token exchange, device-code polling), it is just a different `OAuthAuth` implementation — no reserved option values.
OAuth 不得把仅限 Node 的代码（`node:http`、`node:crypto`）强行带入浏览器打包产物：`lazyOAuth()` 内部的动态导入使用与 bedrock 惰性包装器相同的、对打包器不透明的变量说明符技巧。浏览器宿主永远不会触发该加载（没有存储的 node OAuth 凭据，也没有登录流程）。如果日后引入 Web 端 OAuth（sitegeist 已验证可行性：Web Crypto PKCE、认证标签页、fetch 令牌交换、device-code 轮询），那也只是另一个 `OAuthAuth` 实现而已 —— 无需预留任何选项值。

The built-in flows in `src/auth/oauth/` implement `OAuthAuth` and `AuthInteraction` directly while remaining Node-targeted and lazy-loaded. Copilot derives its credential-specific request endpoint through `toAuth().baseUrl`.
`src/auth/oauth/` 中的内置流程直接实现 `OAuthAuth` 与 `AuthInteraction`，同时保持面向 Node 且惰性加载。Copilot 通过 `toAuth().baseUrl` 推导出与其凭据对应的请求端点。

## Provider wrappers and models.json 提供方包装器与 models.json

`models.json` is a provider wrapper layer. It does not mutate providers in place:
`models.json` 是一个提供方包装层，它不会就地修改提供方：

```ts
function withProviderOverrides(base: Provider, overrides: ProviderOverrides): Provider {
  return {
    ...base,
    name: overrides.name ?? base.name,
    baseUrl: overrides.baseUrl ?? base.baseUrl,
    headers: mergeHeaders(base.headers, overrides.headers),

    getModels: () => applyModelOverrides(base.getModels(), overrides.models),
    refreshModels: base.refreshModels?.bind(base),

    stream: base.stream,
    streamSimple: base.streamSimple,
  };
}
```

This composes with dynamic providers because `getModels()` delegates to the base source and `refreshModels()` passes through.
由于 `getModels()` 委派给基础来源、`refreshModels()` 直接透传，这套包装可以与动态提供方良好组合。

Request-auth config from models.json (`$ENV`, `!command`, inline keys) remains app-owned sidecar state, surfaced either as explicit request auth or as a custom `ApiKeyAuth` the app sets on the wrapped provider's `auth.apiKey`.
来自 models.json 的请求认证配置（`$ENV`、`!command`、内联密钥）仍然是由应用拥有的旁挂（sidecar）状态，既可以作为显式的请求认证暴露出来，也可以作为应用设置在被包装提供方 `auth.apiKey` 上的自定义 `ApiKeyAuth`。

## Custom providers: createProvider() 自定义提供方：createProvider()

One helper builds providers from parts; it handles both single-API and mixed-API providers:
一个辅助函数即可从各部件构建提供方；它同时支持单 API 与混合 API 的提供方：

```ts
export function createProvider(input: {
  id: string;
  name?: string;                 // default: id
  baseUrl?: string;
  headers?: Record<string, string>;
  auth: ProviderAuth;            // required, at least one of apiKey/oauth (no "no-auth" providers)
  /** Initial model list (empty for purely dynamic providers). */
  models: readonly Model<Api>[];
  /** Dynamic providers: fetch the current list; createProvider stores it and dedupes in-flight calls. */
  refreshModels?: () => Promise<readonly Model<Api>[]>;
  /** Single implementation, or map keyed by model.api for mixed-API providers. */
  api: ProviderStreams | Record<string, ProviderStreams>;
}): Provider;
```

- Single `api`: all models stream through it.
  单个 `api`：所有模型都经由它进行流式处理。
- Map `api`: `stream()`/`streamSimple()` dispatch on `model.api`; unknown api produces a stream error.
  映射形式的 `api`：`stream()`/`streamSimple()` 依据 `model.api` 分发；未知的 api 会产生流式错误。

Mixed-API custom providers must be supported (opencode Go/Zen-style providers expose models backed by different APIs under one provider id).
必须支持混合 API 的自定义提供方（opencode Go/Zen 风格的提供方会在同一个 provider id 下暴露由不同 API 支撑的模型）。

Built-in provider factories use `createProvider()` internally. models.json custom providers map onto it directly:
内置提供方工厂在内部使用 `createProvider()`。models.json 中的自定义提供方可直接映射到它：

```json
{
  "providers": {
    "my-openai-proxy": {
      "api": "openai-completions",
      "baseUrl": "https://proxy.example/v1",
      "models": [ ... ]
    }
  }
}
```

## Compat entrypoint 兼容入口

`@earendil-works/pi-ai/compat` preserves the old global API surface until the coding-agent migration deletes it. New code never imports it.
`@earendil-works/pi-ai/compat` 保留旧的全局 API 表面，直到 coding-agent 迁移完成后将其删除。新代码绝不导入它。

Old semantics being preserved: global `stream()` can still dispatch by `model.api` through the legacy api-registry for custom providers, mutated models, and tests/extensions that override a built-in API implementation.
被保留的旧语义：对于自定义提供方、被修改过的模型，以及覆盖了内置 API 实现的测试/扩展，全局 `stream()` 仍可通过旧版 api-registry 依据 `model.api` 进行分发。

- `stream/complete/streamSimple/completeSimple(model, ctx, opts)`: real built-in provider/model/api matches route through a singleton `builtinModels()` collection, so provider auth/env/baseUrl behavior is shared with the new runtime. Unknown providers, mutated models, or overridden API registrations fall back to api-registry dispatch plus `getEnvApiKey` injection.
  `stream/complete/streamSimple/completeSimple(model, ctx, opts)`：真正命中内置 provider/model/api 的调用会走单例的 `builtinModels()` 集合，因此提供方的认证/环境变量/baseUrl 行为与新运行时保持一致。未知提供方、被修改过的模型或被覆盖的 API 注册则回退到 api-registry 分发，并注入 `getEnvApiKey`。
- The builtin api registration side effect moves from the root barrel into compat. It skips api ids that already have a registration, since compat may load after a test or extension has already registered an override. `registerApiProvider()/unregisterApiProviders()` keep feeding the compat-local registry; `resetApiProviders()` clears and re-registers builtins.
  内置 api 的注册副作用从根 barrel 迁移到 compat。它会跳过已经存在注册的 api id，因为 compat 可能在测试或扩展已注册覆盖项之后才加载。`registerApiProvider()/unregisterApiProviders()` 继续向 compat 本地的注册表写入；`resetApiProviders()` 清空并重新注册内置项。
- Sync `getModel/getModels/getProviders` are deprecated aliases of `getBuiltinModel/getBuiltinModels/getBuiltinProviders` from `providers/all` (they were always pure generated-catalog reads — verified: nothing ever mutated the old `modelRegistry`).
  同步的 `getModel/getModels/getProviders` 是 `providers/all` 中 `getBuiltinModel/getBuiltinModels/getBuiltinProviders` 的废弃别名（它们一直都只是纯粹的生成目录读取 —— 已验证：从来没有任何代码修改过旧的 `modelRegistry`）。
- Re-exports the per-API lazy stream wrappers (incl. `setBedrockProviderModule`), `env-api-keys.ts`, and the image-generation registry/catalogs; none of these stay on the root barrel.
  重新导出按 API 划分的惰性 stream 包装器（含 `setBedrockProviderModule`）、`env-api-keys.ts` 以及图像生成的注册表/目录；这些都不再保留在根 barrel 上。
- `export * from "./index.ts"`: compat is a strict superset of the core entrypoint, so consumers switch a file's import path wholesale without symbol surgery.
  `export * from "./index.ts"`：compat 是核心入口的严格超集，因此消费方可以整体切换某个文件的导入路径，而无需逐个符号地修改。

coding-agent (and the interim agent package) switch imports of these symbols from `@earendil-works/pi-ai` to `@earendil-works/pi-ai/compat` (import-path-only change) and are otherwise untouched until the ModelManager migration.
coding-agent（以及过渡期的 agent 包）把这些符号的导入从 `@earendil-works/pi-ai` 切换到 `@earendil-works/pi-ai/compat`（仅改导入路径），在 ModelManager 迁移之前其余部分保持不变。

Extension grace period: the coding-agent extension loader (jiti aliases + Bun `virtualModules`) resolves the `@earendil-works/pi-ai` ROOT specifier to the compat entrypoint. Existing user extensions using the old global API (`complete`, `getModel`, `registerApiProvider`, ...) keep working at runtime without changes; they break only when compat is removed at the ModelManager migration, with a migration guide in the changelog. Typechecking is the nudge: editors resolve the root to the slim core types, so extension sources that typecheck must import old globals from `/compat` — which is what the repo example extensions demonstrate.
扩展的宽限期：coding-agent 的扩展加载器（jiti 别名 + Bun `virtualModules`）会把 `@earendil-works/pi-ai` 的根说明符解析到 compat 入口。使用旧全局 API（`complete`、`getModel`、`registerApiProvider` 等）的现有用户扩展在运行时无需改动即可继续工作；只有当 compat 在 ModelManager 迁移中被移除时它们才会失效，届时会在 changelog 中提供迁移指南。类型检查则起到推动作用：编辑器会把根路径解析到精简的核心类型，因此想通过类型检查的扩展源码必须从 `/compat` 导入旧的全局 API —— 仓库中的示例扩展正是这样演示的。

## Builtin static helpers 内置静态辅助函数

Typed, sync, generated-catalog-only helpers live with the catalogs (exported from `providers/all`):
带类型的、同步的、仅面向生成目录的辅助函数与目录放在一起（从 `providers/all` 导出）：

```ts
getBuiltinModel(provider, id)   // sync, typed overloads from generated catalog
getBuiltinModels(provider)      // sync
getBuiltinProviders()           // sync
```

Runtime lookup through a `Models` instance is sync over the last-known provider lists: `models.getModel(...)`. Freshness-critical callers run `await models.refresh(provider)` first.
通过 `Models` 实例进行的运行时查找是基于最近已知提供方列表的同步操作：`models.getModel(...)`。对新鲜度敏感的调用方应先执行 `await models.refresh(provider)`。

Generated catalogs are split per provider (`providers/<id>.models.ts`) by updating `packages/ai/scripts/generate-models.ts`. If the generator change turns out too large for this pass, splitting may be deferred; `providers/all` and provider factories may temporarily import the monolithic `models.generated.ts`, relying on `sideEffects: false` for pruning.
通过修改 `packages/ai/scripts/generate-models.ts`，生成的目录按提供方拆分（`providers/<id>.models.ts`）。如果本轮改动中生成器的改造工作量过大，拆分可以推迟；`providers/all` 与提供方工厂可以暂时导入单体的 `models.generated.ts`，依靠 `sideEffects: false` 来做裁剪。

## Tree-shaking and lazy imports Tree-shaking 与惰性导入

Rules:
规则：

1. Main `@earendil-works/pi-ai` import is core-only.
   主入口 `@earendil-works/pi-ai` 仅包含核心内容。
2. Provider modules import their catalog, auth helpers, and lazy API wrappers only.
   提供方模块只导入自己的目录、认证辅助函数以及惰性 API 包装器。
3. Lazy API wrappers dynamically import real API implementations.
   惰性 API 包装器动态导入真实的 API 实现。
4. Real API implementations import SDK dependencies.
   真实的 API 实现导入 SDK 依赖。
5. OAuth implementations are always attached via `lazyOAuth()` and lazy-loaded behind a bundler-opaque dynamic import; provider metadata never eagerly imports Node-only OAuth code.
   OAuth 实现始终通过 `lazyOAuth()` 挂载，并隐藏在对打包器不透明的动态导入之后惰性加载；提供方元数据绝不急切导入仅限 Node 的 OAuth 代码。
6. `providers/all` imports every built-in provider factory and all catalogs. It is the explicit heavy entrypoint.
   `providers/all` 导入所有内置提供方工厂与全部目录。它是显式的重量级入口。
7. Provider modules are side-effect-free; importing a provider does not register anything globally.
   提供方模块无副作用；导入一个提供方不会向全局注册任何东西。
8. `package.json` lists only effectful compat/image registration files in `sideEffects`; root and provider modules stay tree-shakeable.
   `package.json` 的 `sideEffects` 中只列出确有副作用的 compat/图像注册文件；根模块与提供方模块保持可 tree-shake。
9. With code splitting, provider SDKs stay in lazy chunks. Without code splitting, bundlers fold statically reachable lazy API implementations into the single bundle; `providers/all` then pulls all statically visible SDKs. Bedrock is the exception because its AWS SDK implementation is behind a bundler-opaque Node-only import and needs `setBedrockProviderModule()` for standalone single-file bundles.
   启用代码分割时，提供方 SDK 会留在惰性 chunk 中。未启用代码分割时，打包器会把静态可达的惰性 API 实现折叠进单一 bundle；此时 `providers/all` 会拉入所有静态可见的 SDK。Bedrock 是例外，因为它的 AWS SDK 实现位于对打包器不透明的、仅限 Node 的导入之后，在独立单文件打包场景中需要 `setBedrockProviderModule()`。

Exports map sketch:
exports 映射草图：

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./compat": "./dist/compat.js",
    "./providers/all": "./dist/providers/all.js",
    "./providers/openai": "./dist/providers/openai.js",
    "./providers/anthropic": "./dist/providers/anthropic.js",
    "./providers/*": "./dist/providers/*.js",
    "./api/*": "./dist/api/*.js"
  }
}
```

Browser smoke check (`scripts/check-browser-smoke.mjs`) must keep passing: bundling the core entrypoint (and any non-node provider entrypoint) must not pull `node:http`/`node:crypto`.
浏览器冒烟检查（`scripts/check-browser-smoke.mjs`）必须持续通过：打包核心入口（以及任何非 node 的提供方入口）都不得引入 `node:http`/`node:crypto`。

## AgentHarness integration AgentHarness 集成

`AgentHarness` receives a `Models` instance.
`AgentHarness` 接收一个 `Models` 实例。

- `AgentHarnessOptions.models` is required.
  `AgentHarnessOptions.models` 是必填项。
- The harness does not snapshot `Models` into turn state.
  harness 不会把 `Models` 快照进单轮（turn）状态中。
- Request path calls `this.models.streamSimple(model, context, options)`; same for compaction/branch-summarization paths.
  请求路径调用 `this.models.streamSimple(model, context, options)`；压缩（compaction）与分支摘要路径同理。
- Request path never calls async `models.getModel()` to canonicalize; if model metadata needs refresh, the app updates the selected model before starting a turn.
  请求路径绝不调用异步的 `models.getModel()` 来做规范化；如果模型元数据需要刷新，应用应在开始一轮之前更新所选模型。
- Harness tests build `createModels()` and install the faux provider (`fauxProvider()` factory from `providers/faux`).
  harness 测试通过 `createModels()` 构建集合，并安装 faux 提供方（来自 `providers/faux` 的 `fauxProvider()` 工厂）。

## coding-agent next phase (not this pass) coding-agent 的下一阶段（不在本轮范围）

coding-agent builds providers in layers and binds them per session:
coding-agent 分层构建提供方，并按会话绑定：

```txt
built-in providers (builtinModels)
-> models.json provider wrappers / custom providers (createProvider)
-> extension provider wrappers/additions
```

```ts
sessionModels.clearProviders();
for (const provider of layeredProviders) sessionModels.setProvider(provider);
```

coding-agent owns: `FileCredentialStore` + decorators replacing AuthStorage (see "Replacing AuthStorage"), models.json auth sidecar (`$ENV`, `!command`), command execution policy, provider status labels (from `AuthResult.source`), login/logout UI (driving `auth.{apiKey,oauth}.login()` with `prompt()/notify()`), extension lifecycle, provider-management slash commands.
coding-agent 负责：替代 AuthStorage 的 `FileCredentialStore` + 装饰器（参见「Replacing AuthStorage」）、models.json 的认证旁挂配置（`$ENV`、`!command`）、命令执行策略、提供方状态标签（来自 `AuthResult.source`）、登录/登出 UI（用 `prompt()/notify()` 驱动 `auth.{apiKey,oauth}.login()`）、扩展生命周期，以及提供方管理的斜杠命令。

Current interim state:
当前的过渡状态：

- `AgentHarness` already accepts a `Models` instance and uses it for turn streaming, compaction, and branch summaries.
  `AgentHarness` 已经接受 `Models` 实例，并将其用于单轮流式输出、压缩与分支摘要。
- coding-agent does not use `AgentHarness` yet; `AgentSession` still drives the low-level `Agent` with a `streamFn`.
  coding-agent 尚未使用 `AgentHarness`；`AgentSession` 仍通过 `streamFn` 驱动底层的 `Agent`。
- coding-agent still uses legacy `AuthStorage` + `ModelRegistry` and imports old global pi-ai APIs through `@earendil-works/pi-ai/compat`.
  coding-agent 仍在使用旧的 `AuthStorage` + `ModelRegistry`，并通过 `@earendil-works/pi-ai/compat` 导入旧的 pi-ai 全局 API。
- The extension loader still aliases the pi-ai root to `/compat` as the runtime grace period for old extensions.
  扩展加载器仍将 pi-ai 根路径别名到 `/compat`，作为旧扩展的运行时宽限期。

## Implementation TODOs 实现待办事项

Check items off as they land. Keep this list current; it is the working state for resumed sessions.
每完成一项就打勾。请保持本列表最新；它是恢复会话时的工作状态记录。

### Phase 1 — core types/runtime 阶段 1 —— 核心类型/运行时

- [x] Rename `types.ts` `Provider` alias to `ProviderId`; fix call sites.
  将 `types.ts` 中的 `Provider` 别名重命名为 `ProviderId`；修正调用点。
- [x] Add `ApiOptionsMap` and `ApiStreamOptions<TApi>` to `types.ts` (type-only imports).
  在 `types.ts` 中加入 `ApiOptionsMap` 与 `ApiStreamOptions<TApi>`（仅类型导入）。
- [x] New `models.ts`: `Provider<TApi>` interface, `hasApi()` guard, `ModelsError` + codes. Auth types live in `src/auth/types.ts` (`ProviderAuth` = `{ apiKey?, oauth? }`, credentials, `CredentialStore` (`read`/`modify`/`delete`, one credential per provider), `AuthResult`, `AuthContext`, `ModelAuth`, login callbacks), in-memory store in `src/auth/credential-store.ts`, default context in `src/auth/context.ts` (browser-safe node:fs trick), `lazyStream()` in `src/api/lazy.ts`.
  新建 `models.ts`：`Provider<TApi>` 接口、`hasApi()` 守卫、`ModelsError` 及错误码。认证类型放在 `src/auth/types.ts`（`ProviderAuth` = `{ apiKey?, oauth? }`、凭据、`CredentialStore`（`read`/`modify`/`delete`，每个提供方一份凭据）、`AuthResult`、`AuthContext`、`ModelAuth`、登录回调），内存存储在 `src/auth/credential-store.ts`，默认上下文在 `src/auth/context.ts`（浏览器安全的 node:fs 技巧），`lazyStream()` 在 `src/api/lazy.ts`。
- [x] `Models`/`MutableModels`/`createModels({ credentials?, authContext? })` with provider map, sync `getModel(s)` (per-provider failure isolation), explicit async `refresh(provider?)`, `getAuth` (decision tree, double-checked locked refresh), `stream/complete/streamSimple/completeSimple` with per-field auth merge. Tests: `packages/ai/test/models-runtime.test.ts`.
  实现 `Models`/`MutableModels`/`createModels({ credentials?, authContext? })`：提供方映射表、同步的 `getModel(s)`（按提供方隔离失败）、显式异步的 `refresh(provider?)`、`getAuth`（决策树、双重检查加锁刷新），以及带按字段认证合并的 `stream/complete/streamSimple/completeSimple`。测试：`packages/ai/test/models-runtime.test.ts`。
- [x] Keep metadata helpers: `calculateCost`, `getSupportedThinkingLevels`, `clampThinkingLevel`, `modelsAreEqual`.
  保留元数据辅助函数：`calculateCost`、`getSupportedThinkingLevels`、`clampThinkingLevel`、`modelsAreEqual`。

### Phase 2 — `src/api/` 阶段 2 —— `src/api/`

- [x] Move stream implementations from `src/providers/` to `src/api/`, renamed by API id (`anthropic.ts` -> `api/anthropic-messages.ts`, etc.).
  将 stream 实现从 `src/providers/` 迁移到 `src/api/`，并按 API id 重命名（`anthropic.ts` -> `api/anthropic-messages.ts` 等）。
- [x] Normalize each implementation module to export exactly `stream` and `streamSimple`.
  将每个实现模块规范化为恰好导出 `stream` 与 `streamSimple`。
- [x] Move shared helpers (`openai-responses-shared`, `google-shared`, `transform-messages`, `openai-prompt-cache`, `github-copilot-headers`, `cloudflare`, `simple-options`) to `src/api/`.
  将共享辅助模块（`openai-responses-shared`、`google-shared`、`transform-messages`、`openai-prompt-cache`、`github-copilot-headers`、`cloudflare`、`simple-options`）迁移到 `src/api/`。
- [x] Extract `lazyStream()`/`lazyApi()` into `src/api/lazy.ts`.
  将 `lazyStream()`/`lazyApi()` 抽取到 `src/api/lazy.ts`。
- [x] Add `*.lazy.ts` wrappers per API; bedrock keeps node-only import trick and `setBedrockProviderModule()`.
  为每种 API 添加 `*.lazy.ts` 包装器；bedrock 保留仅限 Node 的导入技巧与 `setBedrockProviderModule()`。
- [x] Delete `providers/register-builtins.ts`. Interim until Phase 5 compat: builtin api-registry registration lives in `stream.ts`; lazy API wrappers are exported from the root barrel.
  删除 `providers/register-builtins.ts`。在阶段 5 的 compat 落地之前的过渡方案：内置 api-registry 注册放在 `stream.ts` 中；惰性 API 包装器从根 barrel 导出。

### Phase 3 — provider factories + catalogs 阶段 3 —— 提供方工厂 + 目录

- [x] Auth helpers in `src/auth/helpers.ts`: `envApiKeyAuth()` (with secret-prompt `login`), `lazyOAuth()`. OAuth flow loads go through `auth/oauth/load.ts` (bundler-opaque dynamic import); the `OAuthAuth` exports it references land in Phase 4.
  在 `src/auth/helpers.ts` 中提供认证辅助函数：`envApiKeyAuth()`（带密钥提示的 `login`）、`lazyOAuth()`。OAuth 流程的加载统一走 `auth/oauth/load.ts`（对打包器不透明的动态导入）；它所引用的 `OAuthAuth` 导出将在阶段 4 落地。
- [x] `createProvider()` in `models.ts` (single + mixed `api` map, dispatch on `model.api`, unknown api -> stream error).
  在 `models.ts` 中实现 `createProvider()`（支持单一 `api` 与混合 `api` 映射，依据 `model.api` 分发，未知 api -> 流式错误）。
- [x] Per-provider factories under `src/providers/` for all built-in catalog providers; OAuth attached via `lazyOAuth()` (anthropic, openai-codex, github-copilot); ambient `ApiKeyAuth` for amazon-bedrock (AWS env/profile) and google-vertex (key or ADC+project+location).
  在 `src/providers/` 下为所有内置目录提供方编写各自的工厂；通过 `lazyOAuth()` 挂载 OAuth（anthropic、openai-codex、github-copilot）；为 amazon-bedrock（AWS 环境变量/profile）与 google-vertex（密钥或 ADC+project+location）提供基于环境的 `ApiKeyAuth`。
- [x] `providers/all.ts`: `builtinProviders()`, `builtinModels()`, `getBuiltinModel/getBuiltinModels/getBuiltinProviders` re-exports.
  `providers/all.ts`：`builtinProviders()`、`builtinModels()`，以及 `getBuiltinModel/getBuiltinModels/getBuiltinProviders` 的重新导出。
- [x] Faux provider factory (`fauxProvider()` in `providers/faux.ts`) for tests; legacy `registerFauxProvider()` kept until compat dies.
  用于测试的 faux 提供方工厂（`providers/faux.ts` 中的 `fauxProvider()`）；旧的 `registerFauxProvider()` 保留至 compat 移除为止。
- [x] Split generated catalogs per provider via `scripts/generate-models.ts` (`providers/<id>.models.ts`); `models.generated.ts` becomes a generated aggregator.
  通过 `scripts/generate-models.ts` 将生成的目录按提供方拆分（`providers/<id>.models.ts`）；`models.generated.ts` 变为生成的聚合文件。

### Phase 4 — OAuth adaptation 阶段 4 —— OAuth 适配

- [x] Built-in implementations live under `auth/oauth/` and implement `OAuthAuth` directly through `AuthInteraction.prompt()`/`notify()`. They are private provider implementations loaded lazily by provider factories.
  内置实现位于 `auth/oauth/` 下，直接通过 `AuthInteraction.prompt()`/`notify()` 实现 `OAuthAuth`。它们是由提供方工厂惰性加载的私有实现。
- [x] Callback-server flows race a `manual_code` prompt, aborted through `AuthPrompt.signal` once the flow settles. The public `oauth` subpath retains only coding-agent extension compatibility types.
  基于回调服务器的流程会与 `manual_code` 提示竞速，流程一旦确定即通过 `AuthPrompt.signal` 中止该提示。公开的 `oauth` 子路径仅保留 coding-agent 扩展兼容所需的类型。

### Phase 5 — packaging 阶段 5 —— 打包

- [x] `index.ts` core-only and side-effect free (no catalogs, no provider factories, no api-registry, no env-api-keys, no images, no OAuth, no compat). Typed catalog reads (`getBuiltin*`) implemented in `providers/all.ts`; `models.ts` no longer imports `models.generated.ts`.
  `index.ts` 仅含核心且无副作用（不含目录、提供方工厂、api-registry、env-api-keys、images、OAuth、compat）。带类型的目录读取（`getBuiltin*`）在 `providers/all.ts` 中实现；`models.ts` 不再导入 `models.generated.ts`。
- [x] `compat.ts`: superset of index + old api-dispatch globals, deprecated `getModel/getModels/getProviders` aliases, lazy api wrappers + `setBedrockProviderModule`, `getEnvApiKey`, images. Registration side effect lives here (skip-if-present).
  `compat.ts`：index 的超集 + 旧的 api 分发全局函数、废弃的 `getModel/getModels/getProviders` 别名、惰性 api 包装器 + `setBedrockProviderModule`、`getEnvApiKey`、images。注册副作用放在这里（已存在则跳过）。
- [x] Subpath exports map (`./compat`, `./providers/*`, `./api/*`); `sideEffects` array listing the effectful modules (`compat`, images registration) instead of `false`.
  子路径 exports 映射（`./compat`、`./providers/*`、`./api/*`）；`sideEffects` 改为列出确有副作用的模块（`compat`、图像注册）的数组，而非 `false`。
- [x] Browser smoke (entry now imports old globals from `/compat`) + shrinkwrap checks green. Internal old-global imports switched to `/compat` already (42 files in agent/coding-agent/examples; vitest configs alias `/compat` to src; spawn-CLI tests resolve workspace dist, so `packages/ai` + `packages/agent` dists were rebuilt).
  浏览器冒烟检查（入口现从 `/compat` 导入旧全局 API）与 shrinkwrap 检查均通过。内部的旧全局导入已切换到 `/compat`（agent/coding-agent/examples 中共 42 个文件；vitest 配置将 `/compat` 别名到 src；spawn-CLI 测试解析的是工作区的 dist，因此重新构建了 `packages/ai` 与 `packages/agent` 的 dist）。

### Phase 6 — AgentHarness 阶段 6 —— AgentHarness

- [x] `AgentHarnessOptions.models` required (`readonly models` on the harness); the harness stream path uses `models.streamSimple()`. `StreamFn` redefined structurally (no compat type dependency); `Models.streamSimple` satisfies it.
  `AgentHarnessOptions.models` 变为必填（harness 上为 `readonly models`）；harness 的流式路径使用 `models.streamSimple()`。`StreamFn` 以结构化方式重新定义（不再依赖 compat 类型）；`Models.streamSimple` 满足该类型。
- [x] Compaction/branch-summarization take the harness `Models` instance. `getApiKeyAndHeaders` is removed entirely — `Models` is the only auth path; per-request key resolution becomes provider auth on the collection. `compact()`/`generateSummary()`/`generateBranchSummary()` lose their explicit `apiKey`/`headers` parameters.
  压缩与分支摘要改用 harness 的 `Models` 实例。`getApiKeyAndHeaders` 被完全移除 —— `Models` 是唯一的认证路径；按请求解析密钥转变为集合上的提供方认证。`compact()`/`generateSummary()`/`generateBranchSummary()` 去掉了显式的 `apiKey`/`headers` 参数。
- [x] Harness tests use `createModels()` + `fauxProvider()` with unique per-fake provider ids; no global api-registry state, no unregister bookkeeping.
  harness 测试使用 `createModels()` + `fauxProvider()`，每个假实现使用唯一的 provider id；不再有全局 api-registry 状态，也无需注销记账。

### Phase 7 — coding-agent bridge (minimal) 阶段 7 —— coding-agent 桥接（最小化）

- [x] Switch old-global imports to `@earendil-works/pi-ai/compat` (landed with Phase 5; compat is a superset so the switch was path-only). Extension loader resolves the pi-ai root to compat as the runtime grace period.
  将旧全局导入切换到 `@earendil-works/pi-ai/compat`（随阶段 5 一并落地；由于 compat 是超集，切换仅涉及路径）。扩展加载器把 pi-ai 根路径解析到 compat，作为运行时宽限期。
- [x] Everything else originally sketched here is gated on coding-agent actually streaming through a `Models` instance — coding-agent's `AgentSession` drives the low-level `Agent` via `streamFn`, not the harness — and moved to Phase 9.
  这里原本规划的其余内容都取决于 coding-agent 是否真正通过 `Models` 实例进行流式处理 —— 而 coding-agent 的 `AgentSession` 是通过 `streamFn` 驱动底层 `Agent`，并非 harness —— 因此这些内容移至阶段 9。

### Phase 8 — wrap-up 阶段 8 —— 收尾

- [x] Update/add tests; run affected suites (tests landed with each phase; `./test.sh` green throughout).
  更新/新增测试；运行受影响的测试套件（测试随各阶段一并落地；`./test.sh` 全程通过）。
- [x] `packages/ai/CHANGELOG.md`: `### Breaking Changes` with migration guide (compat entrypoint, `Provider` -> `ProviderId`, api module moves) + `### Added` for the new Models/provider/auth API.
  `packages/ai/CHANGELOG.md`：`### Breaking Changes` 并附迁移指南（compat 入口、`Provider` -> `ProviderId`、api 模块迁移），以及针对新 Models/提供方/认证 API 的 `### Added`。
- [x] `packages/coding-agent/CHANGELOG.md`: `### Changed` entry for extension authors — runtime unaffected (loader resolves the pi-ai root to compat), typecheck nudges to `/compat` or the new API; removal happens later with a migration guide.
  `packages/coding-agent/CHANGELOG.md`：面向扩展作者的 `### Changed` 条目 —— 运行时不受影响（加载器将 pi-ai 根路径解析到 compat），类型检查会促使迁移到 `/compat` 或新 API；移除将在日后随迁移指南进行。
- [x] `packages/agent/CHANGELOG.md`: `### Breaking Changes` for required `AgentHarnessOptions.models`, compaction signature changes, structural `StreamFn`.
  `packages/agent/CHANGELOG.md`：为必填的 `AgentHarnessOptions.models`、压缩函数签名变更、结构化的 `StreamFn` 编写 `### Breaking Changes`。
- [x] `npm run check` clean.
  `npm run check` 无报错。

### Phase 9 — coding-agent on Models + CredentialStore (in scope) 阶段 9 —— coding-agent 迁移到 Models + CredentialStore（在本轮范围内）

coding-agent replaces AuthStorage and ModelRegistry's internals with `FileCredentialStore` + a `MutableModels` collection. AgentSession itself stays (AgentHarness adoption is pi 2.0); only its model/auth substrate swaps. Layering is strictly one-directional:
coding-agent 用 `FileCredentialStore` + 一个 `MutableModels` 集合替换 AuthStorage 与 ModelRegistry 的内部实现。AgentSession 本身保留（采用 AgentHarness 是 pi 2.0 的事）；只替换其模型/认证的底层基础。分层严格是单向的：

```txt
FileCredentialStore (auth.json, locked, $ENV/!command resolution) + explicit --api-key overlay
        ↑
MutableModels: builtin factories (wrapped per models.json config) + custom providers (models.json ∪ extensions)
        ↑
ModelRegistry: compatibility facade — sync last-known reads delegate to the collection; registerProvider/login/logout/status for extensions + UI
        ↑
AgentSession / sdk / interactive-mode (stream via models; await only auth/refresh paths)
```

Decisions:
决策：

- `AuthStorage` is deleted as a type — it would otherwise depend on provider auth while provider auth depends on its store (circular). Its surface splits: `get`/`set`/`remove` -> `CredentialStore`; `getApiKey` -> `Models.getAuth`; `login`/`logout`/`getAuthStatus` -> ModelRegistry facade methods over `provider.auth.oauth` + the store.
  `AuthStorage` 作为类型被删除 —— 否则它将依赖提供方认证，而提供方认证又依赖其存储（形成循环）。其职责被拆分：`get`/`set`/`remove` -> `CredentialStore`；`getApiKey` -> `Models.getAuth`；`login`/`logout`/`getAuthStatus` -> ModelRegistry 门面方法，基于 `provider.auth.oauth` 与存储实现。
- `FileCredentialStore` is self-contained (path, locking, parse/write, chmod, error buffering) and owns `auth.json` semantics, including `$ENV`/`!command` resolution for stored API-key credentials. Persisted values stay raw; resolution returns copies for auth use.
  `FileCredentialStore` 是自包含的（路径、加锁、解析/写入、chmod、错误缓冲），并拥有 `auth.json` 的语义，包括对存储的 API-key 凭据做 `$ENV`/`!command` 解析。持久化的值保持原样；解析结果以副本形式返回供认证使用。
- Runtime `--api-key` overrides are an explicit store overlay (an override reads as an ephemeral stored api-key credential, masking stored OAuth — matches today's priority). Every registered provider is guaranteed an `apiKey` auth slot so overrides apply to OAuth-only providers too.
  运行时的 `--api-key` 覆盖是一层显式的存储叠加（覆盖值读取时表现为一个临时的已存储 api-key 凭据，会遮蔽已存储的 OAuth —— 与今天的优先级一致）。每个已注册的提供方都保证拥有 `apiKey` 认证槽位，因此覆盖对仅支持 OAuth 的提供方同样有效。
- `ModelRegistry.getAll`/`find`/`getAvailable` stay sync for SDK and extension compatibility, delegating to the collection's last-known sync model lists and fast configured-looking status checks. Dynamic providers update through explicit async `refresh()`, and request auth remains async through `getApiKeyAndHeaders()`/`Models.getAuth()`. Extensions also get the collection itself as the forward API.
  为兼容 SDK 与扩展，`ModelRegistry.getAll`/`find`/`getAvailable` 保持同步，委派给集合中最近已知的同步模型列表以及快速的「看起来已配置」状态检查。动态提供方通过显式的异步 `refresh()` 更新，请求认证仍通过 `getApiKeyAndHeaders()`/`Models.getAuth()` 异步进行。扩展同时也可以拿到集合本身，作为面向未来的 API。
- models.json keeps FULL feature parity, implemented as provider decoration: builtin factories wrapped so `getModels()` applies provider `baseUrl`/`compat` overlays, `modelOverrides`, and custom-model merges (async-safe); provider `apiKey`/`headers`/`authHeader` configs become that provider's `ApiKeyAuth` (config first, factory auth fallback); parse errors keep `getError()` semantics.
  models.json 保持完全的功能对等，实现方式是对提供方进行装饰：包装内置工厂，使 `getModels()` 应用提供方级别的 `baseUrl`/`compat` 叠加、逐模型的 `modelOverrides` 以及自定义模型合并（异步安全）；提供方的 `apiKey`/`headers`/`authHeader` 配置转换为该提供方的 `ApiKeyAuth`（配置优先，回退到工厂认证）；解析错误保持 `getError()` 的语义。
- Extension `ProviderConfig` parity: provider-keyed `streamSimple`, legacy extension OAuth callbacks adapted to `OAuthAuth`, and full model replacement per provider. Legacy `registerApiProvider` writes stay compat-local for consumers that call global `complete()`; they die with compat.
  扩展 `ProviderConfig` 的对等能力：按提供方索引的 `streamSimple`、把旧的扩展 OAuth 回调适配为 `OAuthAuth`，以及按提供方整体替换模型。旧的 `registerApiProvider` 写入仅保留在 compat 内部，供调用全局 `complete()` 的消费方使用；它们随 compat 一起消亡。
- Copilot: stored-credential baseUrl applied in the wrapped `getModels()` (extension-visible models stay correct) plus per-request `toAuth().baseUrl`.
  Copilot：在被包装的 `getModels()` 中应用来自已存储凭据的 baseUrl（保证扩展可见的模型信息正确），并在每次请求时使用 `toAuth().baseUrl`。
- Cloudflare: provider-auth substitution (key + `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_GATEWAY_ID` from credential `env` or ambient `AuthContext.env()` -> `ModelAuth.baseUrl`). Built-in compat calls route through `Models`, so they use the same provider auth path.
  Cloudflare：提供方认证替换（密钥 + 来自凭据 `env` 或环境 `AuthContext.env()` 的 `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_GATEWAY_ID` -> `ModelAuth.baseUrl`）。内置的 compat 调用会路由到 `Models`，因此走的是同一条提供方认证路径。

Ordering for new sessions:
新会话中的推进顺序：

1. [x] pi-ai rework first: `Provider.getModels()` sync + optional `refreshModels()`; `Models.getModels`/`getModel` sync, `Models.refresh(provider?)` async; `createProvider` takes `models` array + optional `refreshModels` fetcher (in-flight dedupe). Reverses Phase 1's async-listing decision — see "Provider model listing" for rationale (sync-or-async unions breed latent sync assumptions; async-only breaks sync consumer surfaces like extension `find`/`getAll`).
   先改造 pi-ai：`Provider.getModels()` 同步 + 可选的 `refreshModels()`；`Models.getModels`/`getModel` 同步、`Models.refresh(provider?)` 异步；`createProvider` 接受 `models` 数组 + 可选的 `refreshModels` 拉取函数（对进行中的调用去重）。这推翻了阶段 1 的异步列表决策 —— 理由参见「Provider model listing」（同步或异步的联合类型会滋生潜在的同步假设；纯异步则会破坏诸如扩展 `find`/`getAll` 这类同步消费接口）。
2. [x] Cloudflare provider auth in pi-ai factories: Workers AI and AI Gateway validate their required account/gateway env/config and return resolved `baseUrl`, provider-scoped env, and header suppression/override metadata from provider auth.
   在 pi-ai 工厂中实现 Cloudflare 提供方认证：Workers AI 与 AI Gateway 校验各自必需的 account/gateway 环境变量与配置，并从提供方认证返回解析后的 `baseUrl`、提供方作用域内的环境变量，以及请求头抑制/覆盖的元数据。
3. [ ] Add `FileCredentialStore` in coding-agent.
   在 coding-agent 中新增 `FileCredentialStore`。
   - Implement the pi-ai `CredentialStore` interface as a self-contained `auth.json` store; do not depend on the old `AuthStorageBackend` abstraction, though its lock/retry semantics may be ported.
     以自包含的 `auth.json` 存储形式实现 pi-ai 的 `CredentialStore` 接口；不要依赖旧的 `AuthStorageBackend` 抽象，但可以移植其加锁/重试语义。
   - Preserve the existing file format. `ApiKeyCredential` uses `{ type: "api_key", key?, env? }`, matching today's `auth.json`; do not translate `env` into metadata or rewrite discriminators.
     保持现有文件格式。`ApiKeyCredential` 使用 `{ type: "api_key", key?, env? }`，与今天的 `auth.json` 一致；不要把 `env` 转换成 metadata，也不要改写判别字段。
   - Resolve `$ENV`/`!command` in stored API-key `key` and `env` values out of the box using an injected execution/config environment. `$ENV` lookup should come from that environment, and `!command` should run through the shared shell execution path rather than direct `execSync`.
     开箱即用地解析存储的 API-key `key` 与 `env` 值中的 `$ENV`/`!command`，使用注入的执行/配置环境。`$ENV` 的查找应来自该环境，`!command` 应走共享的 shell 执行路径而非直接使用 `execSync`。
   - Persist raw config values; resolved credentials returned for auth use must be copies and must not rewrite `$ENV`/`!command` strings unless a caller explicitly stores new values.
     持久化原始配置值；返回给认证使用的已解析凭据必须是副本，且除非调用方显式存入新值，否则不得改写 `$ENV`/`!command` 字符串。
   - `read(provider)` returns the current credential snapshot and records parse/storage errors for status UI parity.
     `read(provider)` 返回当前凭据快照，并记录解析/存储错误，以与状态 UI 的行为保持一致。
   - `modify(provider, fn)` must lock, re-read, run `fn`, merge-write the provider entry, chmod `0600`, and return the post-write credential.
     `modify(provider, fn)` 必须加锁、重新读取、执行 `fn`、合并写入该提供方条目、chmod `0600`，并返回写入后的凭据。
   - `delete(provider)` must lock and remove only that provider's entry.
     `delete(provider)` 必须加锁，且只移除该提供方的条目。
   - Add file-backed and in-memory tests covering lock/RMW behavior, `api_key` reads with config-value resolution, OAuth reads, provider `env` preservation, delete, parse errors, and concurrent refresh-style modifications.
     新增基于文件与内存的测试，覆盖加锁/读-改-写行为、带配置值解析的 `api_key` 读取、OAuth 读取、提供方 `env` 的保留、删除、解析错误，以及并发的刷新式修改。
4. [ ] Add runtime override overlay for coding-agent policy.
   为 coding-agent 的策略添加运行时覆盖叠加层。
   - `withRuntimeOverrides(store, overrides)` implements CLI `--api-key`: read returns an ephemeral `{ type: "api_key", key }` for each overridden provider, masking stored OAuth/API credentials without persisting.
     `withRuntimeOverrides(store, overrides)` 实现 CLI 的 `--api-key`：对每个被覆盖的提供方，read 返回一个临时的 `{ type: "api_key", key }`，在不持久化的前提下遮蔽已存储的 OAuth/API 凭据。
   - Runtime overrides must apply even to OAuth-capable providers; every provider registered in coding-agent must retain or gain an `apiKey` auth slot so the overlay is meaningful.
     运行时覆盖必须对支持 OAuth 的提供方同样生效；coding-agent 中注册的每个提供方都必须保留或获得 `apiKey` 认证槽位，覆盖才有意义。
   - Tests cover precedence: runtime override > stored credential > models.json config auth > ambient provider env, with stored credential blocking ambient fallback.
     测试需覆盖优先级：运行时覆盖 > 已存储凭据 > models.json 配置认证 > 提供方环境变量，且已存储凭据会阻断向环境变量的回退。
5. [ ] Build provider decoration helpers for `models.json`.
   为 `models.json` 构建提供方装饰辅助函数。
   - Start from built-in provider factories, not generated model arrays.
     从内置提供方工厂出发，而不是从生成的模型数组出发。
   - Wrap provider `getModels()` so provider-level `baseUrl`/`headers`/`compat`, per-model `modelOverrides`, and custom model merges apply on every sync read.
     包装提供方的 `getModels()`，使提供方级别的 `baseUrl`/`headers`/`compat`、逐模型的 `modelOverrides` 以及自定义模型合并在每次同步读取时都生效。
   - Preserve `refreshModels()` passthrough so dynamic providers compose with decorations.
     保留 `refreshModels()` 的透传，使动态提供方能与装饰组合使用。
   - Convert provider `apiKey`/`headers`/`authHeader` models.json config into a wrapped `ApiKeyAuth` that resolves config values first and falls back to the base provider auth.
     将 models.json 中提供方的 `apiKey`/`headers`/`authHeader` 配置转换为被包装的 `ApiKeyAuth`，优先解析配置值，并回退到基础提供方认证。
   - Custom providers with `models` use `createProvider()` with the appropriate lazy API wrapper or extension-provided stream implementation.
     带有 `models` 的自定义提供方使用 `createProvider()`，搭配合适的惰性 API 包装器或扩展提供的 stream 实现。
   - Parse errors must keep current `ModelRegistry.getError()` behavior: built-ins remain available, and the error is visible.
     解析错误必须保持当前 `ModelRegistry.getError()` 的行为：内置项仍然可用，同时错误是可见的。
6. [ ] Copilot `getModels()` baseUrl wrap.
   Copilot 的 `getModels()` baseUrl 包装。
   - GitHub Copilot OAuth `toAuth()` already returns per-credential request `baseUrl` for streaming.
     GitHub Copilot 的 OAuth `toAuth()` 已经为流式请求返回按凭据区分的 `baseUrl`。
   - Wrap Copilot's provider `getModels()` when an OAuth credential is present so extension/UI-visible model metadata also carries the authenticated account base URL.
     当存在 OAuth 凭据时包装 Copilot 提供方的 `getModels()`，使扩展/UI 可见的模型元数据同样携带已认证账号的基础 URL。
   - Keep API-key/env-token Copilot behavior unchanged.
     保持 Copilot 在 API-key/环境令牌方式下的行为不变。
   - Add tests for model metadata before login, after OAuth credential, after refresh/baseUrl change, and logout.
     为登录前、获得 OAuth 凭据后、刷新/baseUrl 变更后以及登出后的模型元数据添加测试。
7. [x] Extension OAuth adapter.
   扩展 OAuth 适配器。
   - Keep only the legacy callback/credential declarations required by coding-agent `ProviderConfig.oauth`.
     仅保留 coding-agent `ProviderConfig.oauth` 所需的旧版回调/凭据声明。
   - `login` maps legacy callbacks/events to `AuthInteraction.prompt()`/`notify()`.
     `login` 将旧版回调/事件映射到 `AuthInteraction.prompt()`/`notify()`。
   - `refreshToken` maps to `refresh`; `getApiKey` maps to `toAuth`.
     `refreshToken` 映射到 `refresh`；`getApiKey` 映射到 `toAuth`。
   - Preserve the type-only pi-ai `oauth` barrel and extension-loader aliases.
     保留仅含类型的 pi-ai `oauth` barrel 以及扩展加载器的别名。
8. [ ] Rebuild coding-agent `ModelRegistry` over `MutableModels`.
   在 `MutableModels` 之上重建 coding-agent 的 `ModelRegistry`。
   - It owns a `MutableModels` instance built from decorated built-ins + models.json custom providers + extension providers.
     它拥有一个由「装饰后的内置提供方 + models.json 自定义提供方 + 扩展提供方」构建而成的 `MutableModels` 实例。
   - `getAll()`, `find()`, and `getAvailable()` remain sync compatibility methods over last-known model lists and fast configured-looking auth status. Do not break the extension-facing `modelRegistry` surface for these reads.
     `getAll()`、`find()` 与 `getAvailable()` 仍是基于最近已知模型列表与快速「看起来已配置」认证状态的同步兼容方法。不得破坏面向扩展的 `modelRegistry` 在这些读取上的接口。
   - `refresh()` is the explicit async freshness boundary: rebuild provider layers and call `models.refresh()` where needed; no global api-registry reset should be part of the new path except compat-only grace behavior.
     `refresh()` 是显式的异步新鲜度边界：重建提供方层并在需要时调用 `models.refresh()`；新路径中不应包含全局 api-registry 重置，除非是仅限 compat 的宽限行为。
   - `registerProvider()`/`unregisterProvider()` mutate provider layers and rebuild the collection.
     `registerProvider()`/`unregisterProvider()` 修改提供方层并重建集合。
   - Facade auth ops (`login`, `logout`, provider status, available OAuth providers) drive `provider.auth.{apiKey,oauth}` and the `CredentialStore`; no `AuthStorage` type remains.
     门面上的认证操作（`login`、`logout`、提供方状态、可用的 OAuth 提供方）驱动 `provider.auth.{apiKey,oauth}` 与 `CredentialStore`；不再保留 `AuthStorage` 类型。
   - Legacy `registerApiProvider` writes stay only for `/compat` callers and are removed in Phase 10.
     旧的 `registerApiProvider` 写入仅为 `/compat` 调用方保留，并将在阶段 10 移除。
9. [ ] Rewire consumers.
   改接各消费方。
   - `AgentSession` stream function resolves through `ModelRegistry`/`Models`, not `getApiKeyAndHeaders()` + compat globals.
     `AgentSession` 的 stream 函数改为通过 `ModelRegistry`/`Models` 解析，而不是 `getApiKeyAndHeaders()` + compat 全局 API。
   - SDK options replace `authStorage` with `credentials?: CredentialStore` or an agent-dir-backed default; update `sdk.md` and examples.
     SDK 选项用 `credentials?: CredentialStore`（或基于 agent 目录的默认实现）替换 `authStorage`；同步更新 `sdk.md` 与示例。
   - `model-resolver`, `--list-models`, model selector, login/logout/status UI, and provider attribution use sync last-known model reads and await only explicit refresh/auth operations.
     `model-resolver`、`--list-models`、模型选择器、登录/登出/状态 UI 以及提供方归属信息都使用同步的「最近已知」模型读取，仅在显式的刷新/认证操作上 await。
   - CLI `--api-key` populates the runtime override decorator instead of mutating `AuthStorage`.
     CLI 的 `--api-key` 改为填充运行时覆盖装饰器，而不是修改 `AuthStorage`。
   - Keep extension loader root-to-compat alias until Phase 10, but expose the new collection/facade as the forward API.
     在阶段 10 之前保留扩展加载器的「根路径 -> compat」别名，但把新的集合/门面作为面向未来的 API 暴露出来。
10. [ ] Test migration and real-provider validation.
    测试迁移与真实提供方验证。
    - Unit tests for `FileCredentialStore`, runtime override overlay, provider decoration, extension OAuth adapter, Models-backed ModelRegistry facade, and consumer rewiring.
      为 `FileCredentialStore`、运行时覆盖叠加层、提供方装饰、扩展 OAuth 适配器、基于 Models 的 ModelRegistry 门面以及消费方改接编写单元测试。
    - Regression tests for Cloudflare account/gateway env, Copilot OAuth baseUrl wrapping, runtime `--api-key` precedence, `$ENV`/`!command` resolution, and stored credential blocking ambient fallback.
      为 Cloudflare 的 account/gateway 环境变量、Copilot OAuth 的 baseUrl 包装、运行时 `--api-key` 的优先级、`$ENV`/`!command` 解析，以及已存储凭据阻断环境回退等编写回归测试。
    - Update existing tests for sync last-known `ModelRegistry.getAll/find/getAvailable` plus explicit async refresh behavior.
      更新现有测试，以适配同步的「最近已知」`ModelRegistry.getAll/find/getAvailable` 以及显式的异步刷新行为。
    - Run targeted non-e2e suites plus tmux validation of login flows against real providers (Anthropic OAuth/API key, OpenAI Codex OAuth, GitHub Copilot OAuth, Cloudflare AI Gateway, Bedrock if credentials are available).
      运行有针对性的非 e2e 测试套件，并通过 tmux 针对真实提供方验证登录流程（Anthropic OAuth/API key、OpenAI Codex OAuth、GitHub Copilot OAuth、Cloudflare AI Gateway，以及在有凭据时的 Bedrock）。

### Phase 10 — compat deletion (pi 2.0 era, separate) 阶段 10 —— 删除 compat（pi 2.0 时期，独立进行）

- [ ] AgentSession -> AgentHarness; the registry facade dies in favor of harness `Models`.
  AgentSession -> AgentHarness；注册表门面被淘汰，改用 harness 的 `Models`。
- [ ] Move ALL internal `/compat` imports to the new API: every package's src, all tests, and the example extensions (examples then demonstrate the new API). Nothing inside the repo may import `/compat` at that point.
  将所有内部的 `/compat` 导入迁移到新 API：每个包的 src、全部测试以及示例扩展（届时示例将演示新 API）。那时仓库内不得有任何地方再导入 `/compat`。
- [ ] Delete `/compat`, `env-api-keys.ts`, the extension-loader root-to-compat alias, and the compat-local legacy API registry. The old OAuth registry/provider interface is already gone; the type-only `oauth` barrel remains for extension compatibility.
  删除 `/compat`、`env-api-keys.ts`、扩展加载器的「根路径 -> compat」别名，以及 compat 本地的旧版 API 注册表。旧的 OAuth 注册表/提供方接口此前已移除；仅含类型的 `oauth` barrel 为扩展兼容而保留。

### Deferred / follow-ups 推迟事项 / 后续跟进

- [ ] Web OAuth implementations (sitegeist-style) as an alternative `OAuthAuth`.
  Web 端 OAuth 实现（sitegeist 风格），作为另一种 `OAuthAuth`。
- [x] Images API redesign: `ImagesModels`/`ImagesProvider`/`createImagesProvider` mirror the chat-side design (sync reads, explicit refresh, never-reject generation); auth resolution shared with the chat side via the free-standing `resolveProviderAuth()` in `auth/resolve.ts` (which also owns `ModelsError`; both collections pass their store/context as arguments — no resolver object). `openrouterImagesProvider()` factory + `builtinImagesProviders()`/`builtinImagesModels()` in `providers/all`; impl moved to `api/openrouter-images.ts` with a lazy wrapper. The old global image API (registry + `getImageModel*` + `generateImages`) stays on compat; `ImagesProvider` id alias in types.ts renamed to `ImagesProviderId` (mirror of `Provider` -> `ProviderId`).
  图像 API 重新设计：`ImagesModels`/`ImagesProvider`/`createImagesProvider` 沿用对话侧的设计（同步读取、显式刷新、生成过程永不 reject）；认证解析与对话侧共用 `auth/resolve.ts` 中独立的 `resolveProviderAuth()`（该模块同时拥有 `ModelsError`；两个集合都把各自的存储/上下文作为参数传入 —— 不存在 resolver 对象）。`providers/all` 中提供 `openrouterImagesProvider()` 工厂以及 `builtinImagesProviders()`/`builtinImagesModels()`；实现迁移到 `api/openrouter-images.ts` 并配有惰性包装器。旧的全局图像 API（注册表 + `getImageModel*` + `generateImages`）保留在 compat 中；types.ts 中的 `ImagesProvider` id 别名重命名为 `ImagesProviderId`（与 `Provider` -> `ProviderId` 对应）。

## Error behavior 错误行为

`undefined` means not found or not configured. Real failures reject or become stream errors.
`undefined` 表示未找到或未配置。真正的失败会以 reject 或流式错误的形式表现。

```ts
export type ModelsErrorCode =
  | "model_source"      // provider model refresh failed
  | "model_validation"  // model object invalid
  | "provider"          // unknown provider, dispatch failure
  | "stream"            // stream setup failure
  | "auth"              // auth resolution failure
  | "oauth";            // oauth login/refresh failure
```

- `Models.stream()` produces stream errors (error event + error result) for async setup failures; it does not throw after returning the stream.
  对于异步准备阶段的失败，`Models.stream()` 会产生流式错误（error 事件 + error 结果）；在返回流之后不会再抛出异常。
- `Models.getModels()` is a sync best-effort read: a provider whose `getModels()` throws yields no models. `Models.refresh(provider)` rejects on that provider's fetch failure; `Models.refresh()` (all providers) is concurrent best-effort. Apps that need a concrete listing failure refresh the single provider.
  `Models.getModels()` 是同步的尽力而为读取：某个提供方的 `getModels()` 抛出异常时，它贡献零个模型。`Models.refresh(provider)` 在该提供方拉取失败时 reject；`Models.refresh()`（全部提供方）则是并发的尽力而为。需要拿到具体列表失败原因的应用应刷新单个提供方。
- Auth resolution and credential store failures reject loudly (`ModelsError` codes `auth`/`oauth`); silent fallback to a different auth path after a failure risks billing surprises. A stored credential always blocks ambient/env fallback, including after a failed refresh.
  认证解析与凭据存储的失败会显式 reject（`ModelsError` 错误码 `auth`/`oauth`）；失败后静默回退到另一条认证路径可能带来意外的计费风险。已存储的凭据始终会阻断向环境（ambient/env）的回退，包括在刷新失败之后。
- Status/availability UIs catch `getAuth` rejections and render "needs re-login"; they do not treat rejection as "unconfigured".
  状态/可用性 UI 会捕获 `getAuth` 的 reject 并显示「需要重新登录」；它们不会把 reject 当作「未配置」处理。
