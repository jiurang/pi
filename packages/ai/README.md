# @earendil-works/pi-ai

Unified LLM API with provider collections, automatic auth resolution, token and cost tracking, and simple context persistence and hand-off to other models mid-session.
统一的 LLM API，提供 provider（服务商）集合、自动鉴权解析、token 与成本统计，以及简单的上下文（context）持久化，并支持在会话中途移交给其他模型。

**Note**: This library only includes models that support tool calling (function calling), as this is essential for agentic workflows.
**注意**：本库仅收录支持工具调用（function calling）的模型，因为这是 agentic 工作流的必备能力。

## Table of Contents 目录

- [Supported Providers 支持的 provider](#supported-providers)
- [Installation 安装](#installation)
- [Quick Start 快速上手](#quick-start)
- [Providers and Models provider 与模型](#providers-and-models)
  - [Provider Factories provider 工厂函数](#provider-factories)
  - [All Built-in Providers 全部内置 provider](#all-built-in-providers)
  - [Querying Models 查询模型](#querying-models)
  - [Static Catalog Reads 静态目录读取](#static-catalog-reads)
  - [Dynamic Providers 动态 provider](#dynamic-providers)
- [Auth 鉴权](#auth)
  - [How Auth Resolves 鉴权如何解析](#how-auth-resolves)
  - [Transforming Request Headers 改写请求头](#transforming-request-headers)
  - [Credential Store 凭据存储](#credential-store)
  - [Environment Variables 环境变量](#environment-variables)
- [Tools 工具](#tools)
  - [Defining Tools 定义工具](#defining-tools)
  - [Handling Tool Calls 处理工具调用](#handling-tool-calls)
  - [Streaming Tool Calls with Partial JSON 以部分 JSON 流式处理工具调用](#streaming-tool-calls-with-partial-json)
  - [Validating Tool Arguments 校验工具参数](#validating-tool-arguments)
  - [Complete Event Reference 完整事件参考](#complete-event-reference)
- [Image Input 图像输入](#image-input)
- [Image Generation 图像生成](#image-generation)
- [Thinking/Reasoning 思考/推理](#thinkingreasoning)
  - [Unified Interface 统一接口](#unified-interface-streamsimplecompletesimple)
  - [Provider-Specific Options provider 专属选项](#provider-specific-options-streamcomplete)
  - [Streaming Thinking Content 流式输出思考内容](#streaming-thinking-content)
- [Stop Reasons 停止原因](#stop-reasons)
- [Error Handling 错误处理](#error-handling)
  - [Aborting Requests 中止请求](#aborting-requests)
  - [Continuing After Abort 中止后继续](#continuing-after-abort)
  - [Debugging Provider Payloads 调试 provider 请求负载](#debugging-provider-payloads)
- [Custom Providers 自定义 provider](#custom-providers)
  - [createProvider()](#createprovider)
  - [Calling API Implementations Directly 直接调用 API 实现](#calling-api-implementations-directly)
  - [OpenAI Compatibility Settings OpenAI 兼容性设置](#openai-compatibility-settings)
- [Faux Provider for Tests 测试用的 Faux provider](#faux-provider-for-tests)
- [Cross-Provider Handoffs 跨 provider 移交](#cross-provider-handoffs)
- [Context Serialization 上下文序列化](#context-serialization)
- [Browser Usage 浏览器中使用](#browser-usage)
- [Bundling and Tree Shaking 打包与 Tree Shaking](#bundling-and-tree-shaking)
- [OAuth Providers 支持 OAuth 的 provider](#oauth-providers)
  - [Vertex AI](#vertex-ai)
  - [CLI Login 命令行登录](#cli-login)
  - [Programmatic OAuth 以编程方式进行 OAuth](#programmatic-oauth)
- [Migrating from the Old Global API 从旧的全局 API 迁移](#migrating-from-the-old-global-api)
- [Development 开发](#development)
- [License 许可证](#license)

## Supported Providers 支持的 provider

- **OpenAI**
- **Ant Ling**
- **Azure OpenAI (Responses)**
- **OpenAI Codex** (ChatGPT Plus/Pro subscription, requires OAuth, see below)
  （ChatGPT Plus/Pro 订阅，需要 OAuth，见下文）
- **DeepSeek**
- **NVIDIA NIM**
- **Anthropic**
- **Google**
- **Vertex AI** (Gemini via Vertex AI)
  （通过 Vertex AI 使用 Gemini）
- **Mistral**
- **Groq**
- **Cerebras**
- **Cloudflare AI Gateway**
- **Cloudflare Workers AI**
- **xAI**
- **OpenRouter**
- **Vercel AI Gateway**
- **ZAI Coding Plan (Global)** (with separate China provider)
  （另有独立的中国区 provider）
- **MiniMax** (with separate China provider)
  （另有独立的中国区 provider）
- **Together AI**
- **Hugging Face**
- **Moonshot AI** (with separate China provider)
  （另有独立的中国区 provider）
- **GitHub Copilot** (requires OAuth, see below)
  （需要 OAuth，见下文）
- **Amazon Bedrock**
- **OpenCode Zen**
- **OpenCode Go**
- **Fireworks** (uses OpenAI- and Anthropic-compatible APIs)
  （使用 OpenAI 与 Anthropic 兼容的 API）
- **Kimi For Coding** (Moonshot AI subscription endpoint, uses Anthropic-compatible API)
  （Moonshot AI 订阅端点，使用 Anthropic 兼容的 API）
- **Xiaomi MiMo** (defaults to API billing endpoint, with separate Token Plan providers for `cn`/`ams`/`sgp` regions)
  （默认使用 API 计费端点，另有面向 `cn`/`ams`/`sgp` 区域的独立 Token Plan provider）
- **Any OpenAI-compatible API**: Ollama, vLLM, LM Studio, etc.
  **任何 OpenAI 兼容 API**：Ollama、vLLM、LM Studio 等。

## Installation 安装

```bash
npm install @earendil-works/pi-ai
```

TypeBox exports are re-exported from `@earendil-works/pi-ai`: `Type`, `Static`, and `TSchema`.
`@earendil-works/pi-ai` 重新导出了 TypeBox 的这些内容：`Type`、`Static` 和 `TSchema`。

## Quick Start 快速上手

You build a `Models` collection of providers and stream through it. The quickest start registers every built-in provider; apps that care about bundle size register individual providers instead (see [Provider Factories](#provider-factories) and [Bundling and Tree Shaking](#bundling-and-tree-shaking)).
你需要构建一个包含若干 provider 的 `Models` 集合，并通过它进行流式调用。最快的方式是注册全部内置 provider；如果你在意打包体积，则应逐个注册所需 provider（参见 [Provider Factories](#provider-factories) 和 [Bundling and Tree Shaking](#bundling-and-tree-shaking)）。

```typescript
import { Type, type Context, type Tool } from '@earendil-works/pi-ai';
import { builtinModels } from '@earendil-works/pi-ai/providers/all';

// A Models collection with every built-in provider registered
const models = builtinModels();

// Sync lookup against the collection
const model = models.getModel('openai', 'gpt-4o-mini')!;

// Define tools with TypeBox schemas for type safety and validation
const tools: Tool[] = [{
  name: 'get_time',
  description: 'Get the current time',
  parameters: Type.Object({
    timezone: Type.Optional(Type.String({ description: 'Optional timezone (e.g., America/New_York)' }))
  })
}];

// Build a conversation context (easily serializable and transferable between models)
const context: Context = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [{ role: 'user', content: 'What time is it?', timestamp: Date.now() }],
  tools
};

// Option 1: Streaming with all event types.
// Auth resolves through the provider (OPENAI_API_KEY from the environment here).
const s = models.stream(model, context);

for await (const event of s) {
  switch (event.type) {
    case 'start':
      console.log(`Starting with ${event.partial.model}`);
      break;
    case 'text_start':
      console.log('\n[Text started]');
      break;
    case 'text_delta':
      process.stdout.write(event.delta);
      break;
    case 'text_end':
      console.log('\n[Text ended]');
      break;
    case 'thinking_start':
      console.log('[Model is thinking...]');
      break;
    case 'thinking_delta':
      process.stdout.write(event.delta);
      break;
    case 'thinking_end':
      console.log('[Thinking complete]');
      break;
    case 'toolcall_start':
      console.log(`\n[Tool call started: index ${event.contentIndex}]`);
      break;
    case 'toolcall_delta':
      // Partial tool arguments are being streamed
      const partialCall = event.partial.content[event.contentIndex];
      if (partialCall.type === 'toolCall') {
        console.log(`[Streaming args for ${partialCall.name}]`);
      }
      break;
    case 'toolcall_end':
      console.log(`\nTool called: ${event.toolCall.name}`);
      console.log(`Arguments: ${JSON.stringify(event.toolCall.arguments)}`);
      break;
    case 'done':
      console.log(`\nFinished: ${event.reason}`);
      break;
    case 'error':
      console.error(`Error: ${event.error.errorMessage}`);
      break;
  }
}

// Get the final message after streaming, add it to the context
const finalMessage = await s.result();
context.messages.push(finalMessage);

// Handle tool calls if any
const toolCalls = finalMessage.content.filter(b => b.type === 'toolCall');
for (const call of toolCalls) {
  const result = call.name === 'get_time'
    ? new Date().toLocaleString('en-US', {
        timeZone: call.arguments.timezone || 'UTC',
        dateStyle: 'full',
        timeStyle: 'long'
      })
    : 'Unknown tool';

  // Add tool result to context (supports text and images)
  context.messages.push({
    role: 'toolResult',
    toolCallId: call.id,
    toolName: call.name,
    content: [{ type: 'text', text: result }],
    isError: false,
    timestamp: Date.now()
  });
}

// Continue if there were tool calls
if (toolCalls.length > 0) {
  const continuation = await models.complete(model, context);
  context.messages.push(continuation);
  console.log('After tool execution:', continuation.content);
}

console.log(`Total tokens: ${finalMessage.usage.input} in, ${finalMessage.usage.output} out`);
console.log(`Cost: $${finalMessage.usage.cost.total.toFixed(4)}`);

// Option 2: Get complete response without streaming
const response = await models.complete(model, context);

for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'toolCall') {
    console.log(`Tool: ${block.name}(${JSON.stringify(block.arguments)})`);
  }
}
```

Snippets in the rest of this README assume a `models` collection set up like this (with the relevant providers registered).
本 README 后续的代码片段都假定你已按上述方式准备好了一个 `models` 集合（并注册了相关 provider）。

## Providers and Models provider 与模型

A **provider** is the runtime unit: it owns its model catalog, its auth (API key resolution, OAuth flows), and its stream behavior. A `Models` collection holds providers and routes every request to the provider that owns the model.
**provider** 是运行时的基本单元：它拥有自己的模型目录、自己的鉴权方式（API key 解析、OAuth 流程）以及自己的流式行为。`Models` 集合持有一组 provider，并把每个请求路由到拥有该模型的 provider。

Providers internally share **API implementations** (the wire protocols): Anthropic models use `anthropic-messages`, OpenAI uses `openai-responses`, while xAI, Groq, Cerebras, OpenRouter, and most others share `openai-completions`. Mixed-API providers (GitHub Copilot, OpenCode Zen) dispatch per model.
provider 内部共享 **API 实现**（即通信协议）：Anthropic 模型使用 `anthropic-messages`，OpenAI 使用 `openai-responses`，而 xAI、Groq、Cerebras、OpenRouter 及大多数其他 provider 共用 `openai-completions`。混合 API 的 provider（GitHub Copilot、OpenCode Zen）则按模型分别分发。

### Provider Factories provider 工厂函数

For apps that only need specific providers, there is one factory per built-in provider, each a subpath import that pulls only that provider's catalog:
如果你的应用只需要特定的 provider，每个内置 provider 都有对应的工厂函数，均为子路径导入，只会引入该 provider 自己的模型目录：

```typescript
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { openrouterProvider } from '@earendil-works/pi-ai/providers/openrouter';
import { amazonBedrockProvider } from '@earendil-works/pi-ai/providers/amazon-bedrock';
// ...one module per provider in the Supported Providers list

const models = createModels();
models.setProvider(anthropicProvider());
models.setProvider(openrouterProvider());
```

Provider factories import their model catalog and a lazy API wrapper. They do not import other providers. With bundler code splitting, SDK implementations (`@anthropic-ai/sdk`, `openai`, `@google/genai`, etc.) stay in lazy chunks loaded on the first request to a model of that API.
provider 工厂函数只会导入自己的模型目录和一个惰性的 API 包装层，不会导入其他 provider。在打包工具做代码分割（code splitting）的情况下，各 SDK 实现（`@anthropic-ai/sdk`、`openai`、`@google/genai` 等）会留在惰性 chunk 中，直到首次请求该 API 的模型时才加载。

### All Built-in Providers 全部内置 provider

For apps that want everything (as in Quick Start):
如果你的应用需要全部 provider（如快速上手中那样）：

```typescript
import { builtinModels } from '@earendil-works/pi-ai/providers/all';

const models = builtinModels(); // a Models collection with every built-in provider registered
```

This imports all catalogs and every built-in provider factory. It is the heavy, explicit entrypoint. `builtinModels()` accepts the same options as `createModels()` (`credentials`, `authContext`); `builtinProviders()` returns the provider array if you want to register them on your own collection.
这会导入所有模型目录和全部内置 provider 工厂函数，是较重但语义明确的入口。`builtinModels()` 接受与 `createModels()` 相同的选项（`credentials`、`authContext`）；如果你想把它们注册到自己的集合上，可以用 `builtinProviders()` 获取 provider 数组。

### Querying Models 查询模型

Reads are synchronous and return the last-known lists:
读取操作是同步的，返回最近一次已知的列表：

```typescript
const providers = models.getProviders();           // registered Provider objects
const provider = models.getProvider('anthropic');  // one provider

const all = models.getModels();                    // every model across providers
const anthropicModels = models.getModels('anthropic');
const model = models.getModel('anthropic', 'claude-sonnet-4-5');

for (const m of anthropicModels) {
  console.log(`${m.id}: ${m.name}`);
  console.log(`  API: ${m.api}`);
  console.log(`  Context: ${m.contextWindow} tokens`);
  console.log(`  Vision: ${m.input.includes('image')}`);
  console.log(`  Reasoning: ${m.reasoning}`);
}
```

Dynamically listed models are typed `Model<Api>`. Narrow with the `hasApi()` guard when you need API-specific option typing:
动态列出的模型类型为 `Model<Api>`。当你需要 API 专属的选项类型时，可用 `hasApi()` 类型守卫收窄类型：

```typescript
import { hasApi } from '@earendil-works/pi-ai';

const m = models.getModel('anthropic', 'claude-sonnet-4-5');
if (m && hasApi(m, 'anthropic-messages')) {
  // m: Model<'anthropic-messages'> — stream options fully typed
  models.stream(m, context, { thinkingEnabled: true, thinkingBudgetTokens: 2048 });
}
```

### Static Catalog Reads 静态目录读取

For tooling that wants the generated built-in catalog with full literal typing (provider and model IDs auto-complete), independent of any collection:
如果工具链需要访问生成的内置模型目录并获得完整的字面量类型（provider 与模型 ID 可自动补全），且不依赖任何集合实例：

```typescript
import { getBuiltinModel, getBuiltinModels, getBuiltinProviders } from '@earendil-works/pi-ai/providers/all';

const model = getBuiltinModel('openai', 'gpt-4o-mini'); // typed Model<'openai-responses'>
const providers = getBuiltinProviders();
const anthropic = getBuiltinModels('anthropic');
```

### Dynamic Providers 动态 provider

Providers may have dynamic model lists (a llama.cpp server, a live OpenRouter listing). Reads stay sync; fetching is an explicit async verb:
provider 的模型列表可以是动态的（例如 llama.cpp 服务，或实时拉取的 OpenRouter 列表）。读取仍然是同步的；拉取则是一个显式的异步操作：

```typescript
// getModels() returns the last-known list (empty before the first refresh)
await models.refresh('llamacpp');        // fetch one provider's list; rejects on failure
await models.refresh();                  // refresh all providers concurrently, best-effort
const fresh = models.getModel('llamacpp', 'qwen3-30b');
```

Static built-in providers are no-ops for `refresh()`. See [createProvider()](#createprovider) for building a dynamic provider.
对静态的内置 provider 来说，`refresh()` 是空操作。构建动态 provider 请参见 [createProvider()](#createprovider)。

## Auth 鉴权

Every provider owns its auth: how API keys resolve (stored credentials, environment variables, ambient sources like AWS profiles or gcloud ADC) and, where supported, OAuth login/refresh flows.
每个 provider 都自行负责鉴权：包括 API key 如何解析（已存储的凭据、环境变量，以及 AWS profile 或 gcloud ADC 等环境中的隐式来源），以及在支持的情况下的 OAuth 登录/刷新流程。

### How Auth Resolves 鉴权如何解析

When you call `models.stream()`, the collection resolves auth through the owning provider and merges it into the request. Explicit per-request values always win:
当你调用 `models.stream()` 时，集合会通过拥有该模型的 provider 解析鉴权信息并合并进请求。逐请求显式传入的值始终优先：

```typescript
// Resolved through the provider (env var, stored credential, OAuth token):
await models.complete(model, context);

// Explicit key wins over anything the provider would resolve:
await models.complete(model, context, { apiKey: 'sk-explicit' });
```

You can inspect resolution without making a request. Pass a provider ID for provider-scoped auth, or a model to include its static `model.headers`:
你可以在不发起请求的情况下查看解析结果。传入 provider ID 可获得 provider 级别的鉴权信息，传入模型则会一并包含其静态的 `model.headers`：

```typescript
const providerAuth = await models.getAuth(model.provider);
const modelAuth = await models.getAuth(model);

if (modelAuth) {
  console.log(`configured via ${modelAuth.source}`); // e.g. "ANTHROPIC_API_KEY", "OAuth", "stored credential"
  console.log(modelAuth.auth.headers);              // Provider auth headers + model.headers
} else {
  console.log('not configured');
}
```

Both overloads resolve credentials, refresh expired OAuth when necessary, and may return an auth-derived `apiKey`, `headers`, or `baseUrl`. `getAuth()` resolves `undefined` for unconfigured providers and rejects with `ModelsError` when something is actually broken (`"oauth"`: token refresh failed, credential preserved for re-login; `"auth"`: key resolution or credential store failure). Request paths surface the same failures as stream errors.
两个重载都会解析凭据、在需要时刷新过期的 OAuth，并可能返回由鉴权推导出的 `apiKey`、`headers` 或 `baseUrl`。对于未配置的 provider，`getAuth()` 会返回 `undefined`；当确实出错时则以 `ModelsError` 拒绝（`"oauth"`：token 刷新失败，凭据被保留以便重新登录；`"auth"`：key 解析或凭据存储失败）。请求路径会以流式错误（stream error）的形式暴露同样的失败。

### Transforming Request Headers 改写请求头

`Models.stream()`, `complete()`, `streamSimple()`, and `completeSimple()` accept a Models-only `transformHeaders` option. It runs once after provider auth, `model.headers`, and explicit `options.headers` have been merged, but before provider dispatch:
`Models.stream()`、`complete()`、`streamSimple()` 和 `completeSimple()` 接受一个仅属于 Models 层的 `transformHeaders` 选项。它在 provider 鉴权、`model.headers` 与显式的 `options.headers` 合并之后、分发到 provider 之前运行一次：

```typescript
const response = await models.completeSimple(model, context, {
  headers: { "X-Client": "my-app" },
  transformHeaders: async (headers) => ({
    ...headers,
    "X-Request-ID": crypto.randomUUID(),
  }),
});
```

The ordering is:
顺序如下：

```text
provider auth headers -> model.headers -> explicit options.headers -> transformHeaders -> Provider.stream*()
```

Header names are merged case-insensitively. Explicit headers override auth/model headers, and the transform has final control; returning `null` for a header suppresses lower-level defaults that support deletion.
请求头名称按大小写不敏感方式合并。显式请求头会覆盖鉴权/模型请求头，而 transform 拥有最终决定权；对某个请求头返回 `null` 可以抑制底层支持删除的默认值。

`transformHeaders` belongs to `Models`, not `Provider`. A `Models` implementation must consume it and remove it before calling `Provider.stream*()`. Provider implementations continue receiving ordinary `ApiStreamOptions` or `SimpleStreamOptions` and never handle the transform themselves. Use this option instead of calling `getAuth(model)` before `stream*()`, which would resolve request auth twice.
`transformHeaders` 属于 `Models` 而非 `Provider`。`Models` 的实现必须消费该选项，并在调用 `Provider.stream*()` 前将其移除。provider 实现依然只接收普通的 `ApiStreamOptions` 或 `SimpleStreamOptions`，永远不需要自己处理该 transform。请使用该选项，而不要在 `stream*()` 之前调用 `getAuth(model)`，否则会重复解析一次请求鉴权。

### Credential Store 凭据存储

Stored credentials (API keys entered interactively, OAuth tokens) live in a `CredentialStore` — one type-tagged credential per provider. pi-ai ships an in-memory default; apps inject persistent storage:
已存储的凭据（交互式输入的 API key、OAuth token）保存在 `CredentialStore` 中——每个 provider 对应一条带类型标记的凭据。pi-ai 自带一个内存实现作为默认值；应用可以注入持久化存储：

```typescript
import { createModels, type CredentialStore } from '@earendil-works/pi-ai';

const models = createModels({ credentials: myFileBackedStore });
// builtinModels() takes the same options:
// const models = builtinModels({ credentials: myFileBackedStore });
```

The contract is small: `read(providerId)`, `list()` for non-secret `{ providerId, type }` metadata, `modify(providerId, fn)` (the only write path — a serialized read-modify-write), and `delete(providerId)`. Enumeration must not resolve secrets or execute configured key commands. OAuth token refresh runs inside `modify`, so concurrent requests and processes cannot double-refresh a rotated token. A stored credential *owns* its provider: environment variables are only consulted when nothing is stored, and a failed refresh never silently falls back to an env key.
接口约定很小：`read(providerId)`、返回非机密 `{ providerId, type }` 元数据的 `list()`、`modify(providerId, fn)`（唯一的写入路径——一次串行化的读-改-写），以及 `delete(providerId)`。枚举操作不得解析机密内容，也不得执行配置的取 key 命令。OAuth token 刷新在 `modify` 内部进行，因此并发的请求和进程不会对已轮换的 token 重复刷新。已存储的凭据*独占*其 provider：只有在没有任何存储凭据时才会查询环境变量，且刷新失败绝不会静默回退到环境变量中的 key。

API-key credentials use the same discriminator as pi's `auth.json` and can carry provider-scoped env/config values:
API key 类型的凭据与 pi 的 `auth.json` 使用相同的判别字段，并可携带 provider 范围的环境变量/配置值：

```typescript
const credential = {
  type: 'api_key',
  key: '...',
  env: {
    CLOUDFLARE_ACCOUNT_ID: 'account-id',
    CLOUDFLARE_GATEWAY_ID: 'gateway-id'
  }
} as const;
```

### Environment Variables 环境变量

Built-in providers resolve these env vars (Node.js; in browsers pass `apiKey` explicitly):
内置 provider 会解析下列环境变量（适用于 Node.js；在浏览器中请显式传入 `apiKey`）：

| Provider<br>provider | Environment Variable(s)<br>环境变量 |
|----------|------------------------|
| OpenAI | `OPENAI_API_KEY` |
| Ant Ling | `ANT_LING_API_KEY` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_BASE_URL` (e.g. `https://{resource}.ai.azure.com`) or `AZURE_OPENAI_RESOURCE_NAME`. Supports `*.openai.azure.com`, `*.cognitiveservices.azure.com` and `*.ai.azure.com`; root endpoints auto-normalize to `/openai/v1`. Optional: `AZURE_OPENAI_API_VERSION` (default `v1`), `AZURE_OPENAI_DEPLOYMENT_NAME_MAP`.<br>`AZURE_OPENAI_API_KEY` + `AZURE_OPENAI_BASE_URL`（例如 `https://{resource}.ai.azure.com`）或 `AZURE_OPENAI_RESOURCE_NAME`。支持 `*.openai.azure.com`、`*.cognitiveservices.azure.com` 和 `*.ai.azure.com`；根端点会自动规范化为 `/openai/v1`。可选：`AZURE_OPENAI_API_VERSION`（默认 `v1`）、`AZURE_OPENAI_DEPLOYMENT_NAME_MAP`。 |
| Anthropic | `ANTHROPIC_API_KEY` or `ANTHROPIC_OAUTH_TOKEN` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| NVIDIA NIM | `NVIDIA_API_KEY` |
| Google | `GEMINI_API_KEY` |
| Vertex AI | `GOOGLE_CLOUD_API_KEY` or `GOOGLE_CLOUD_PROJECT` (or `GCLOUD_PROJECT`) + `GOOGLE_CLOUD_LOCATION` + ADC<br>`GOOGLE_CLOUD_API_KEY`，或 `GOOGLE_CLOUD_PROJECT`（或 `GCLOUD_PROJECT`）+ `GOOGLE_CLOUD_LOCATION` + ADC |
| Mistral | `MISTRAL_API_KEY` |
| Groq | `GROQ_API_KEY` |
| Cerebras | `CEREBRAS_API_KEY` |
| Cloudflare AI Gateway | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_GATEWAY_ID` |
| Cloudflare Workers AI | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID` |
| xAI | `XAI_API_KEY` |
| Fireworks | `FIREWORKS_API_KEY` |
| Together AI | `TOGETHER_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` |
| ZAI Coding Plan (Global) | `ZAI_API_KEY` |
| ZAI Coding Plan (China) | `ZAI_CODING_CN_API_KEY` |
| MiniMax (Global) | `MINIMAX_API_KEY` |
| MiniMax (China) | `MINIMAX_CN_API_KEY` |
| Moonshot AI / Moonshot AI (China) | `MOONSHOT_API_KEY` |
| Hugging Face | `HF_TOKEN` |
| OpenCode Zen / OpenCode Go | `OPENCODE_API_KEY` |
| Kimi For Coding | `KIMI_API_KEY` |
| Qwen Token Plan | `QWEN_TOKEN_PLAN_API_KEY` |
| Qwen Token Plan (China) | `QWEN_TOKEN_PLAN_CN_API_KEY` |
| Xiaomi MiMo (API billing)<br>Xiaomi MiMo（API 计费） | `XIAOMI_API_KEY` |
| Xiaomi MiMo Token Plan (China)<br>Xiaomi MiMo Token Plan（中国） | `XIAOMI_TOKEN_PLAN_CN_API_KEY` |
| Xiaomi MiMo Token Plan (Amsterdam)<br>Xiaomi MiMo Token Plan（阿姆斯特丹） | `XIAOMI_TOKEN_PLAN_AMS_API_KEY` |
| Xiaomi MiMo Token Plan (Singapore)<br>Xiaomi MiMo Token Plan（新加坡） | `XIAOMI_TOKEN_PLAN_SGP_API_KEY` |
| GitHub Copilot | `COPILOT_GITHUB_TOKEN` |

Amazon Bedrock resolves ambient AWS credentials (`AWS_PROFILE`, access key pairs, `AWS_BEARER_TOKEN_BEDROCK`, ECS task roles, web identity tokens); its provider-owned login flow supports bearer tokens, AWS profiles, and the existing credential chain. Vertex AI resolves either an explicit key or gcloud Application Default Credentials plus project/location, with a provider-owned login flow for API keys, ADC, and service-account files.
Amazon Bedrock 会解析环境中的 AWS 凭据（`AWS_PROFILE`、access key 对、`AWS_BEARER_TOKEN_BEDROCK`、ECS 任务角色、web identity token）；其 provider 自带的登录流程支持 bearer token、AWS profile 以及既有的凭据链。Vertex AI 则解析显式的 key，或 gcloud Application Default Credentials 加上 project/location，并提供 provider 自带的登录流程，支持 API key、ADC 和服务账号文件。

## Tools 工具

Tools enable LLMs to interact with external systems. This library uses TypeBox schemas for type-safe tool definitions with automatic validation using TypeBox's built-in validator and value conversion utilities. TypeBox schemas can be serialized and deserialized as plain JSON, making them ideal for distributed systems.
工具让 LLM 能够与外部系统交互。本库使用 TypeBox schema 来定义类型安全的工具，并借助 TypeBox 内置的校验器与值转换工具实现自动校验。TypeBox schema 可以序列化/反序列化为纯 JSON，因此非常适合分布式系统。

### Defining Tools 定义工具

```typescript
import { Type, type Tool, StringEnum } from '@earendil-works/pi-ai';

// Define tool parameters with TypeBox
const weatherTool: Tool = {
  name: 'get_weather',
  description: 'Get current weather for a location',
  parameters: Type.Object({
    location: Type.String({ description: 'City name or coordinates' }),
    units: StringEnum(['celsius', 'fahrenheit'], { default: 'celsius' })
  })
};

// Note: For Google API compatibility, use StringEnum helper instead of Type.Enum
// Type.Enum generates anyOf/const patterns that Google doesn't support

const bookMeetingTool: Tool = {
  name: 'book_meeting',
  description: 'Schedule a meeting',
  parameters: Type.Object({
    title: Type.String({ minLength: 1 }),
    startTime: Type.String({ format: 'date-time' }),
    endTime: Type.String({ format: 'date-time' }),
    attendees: Type.Array(Type.String({ format: 'email' }), { minItems: 1 })
  })
};
```

### Constrained Sampling for Tools 工具的受约束采样

Tools can opt in to provider-side constrained sampling. For JSON-schema tools, `strict: 'prefer'` uses provider-side strict schema enforcement when supported and otherwise falls back to normal tool calling. `strict: 'require'` fails the request when the active provider/model cannot honor it. Set `constrainedSampling: false` to explicitly opt out; it behaves the same as omitting the field.
工具可以选择启用 provider 侧的受约束采样（constrained sampling）。对于 JSON schema 类工具，`strict: 'prefer'` 会在支持时使用 provider 侧的严格 schema 约束，否则回退到普通的工具调用。`strict: 'require'` 则会在当前 provider/模型无法满足时让请求失败。设置 `constrainedSampling: false` 表示显式不启用，其行为与省略该字段相同。

```typescript
const strictTool: Tool = {
  name: 'edit_file',
  description: 'Edit a file',
  parameters: Type.Object({
    path: Type.String(),
    content: Type.String()
  }, { additionalProperties: false }),
  constrainedSampling: { type: 'json_schema', strict: 'prefer' }
};
```

Strict JSON-schema constrained sampling is supported for OpenAI, Anthropic, supported Amazon Bedrock Converse models, Mistral, and Gemini 3 tool calls through the Google Generative AI and Vertex adapters. Google uses `VALIDATED` function-calling mode (or `ANY` when explicitly requested); earlier Gemini versions fall back for `strict: 'prefer'` and reject `strict: 'require'` because they do not enforce required parameters. Bedrock strict-tool capability is generated from model structured-output metadata; custom Bedrock models can override `compat.supportsStrictMode`. OpenAI Responses and Chat Completions can also emit grammar-constrained custom tools with OpenAI Lark or regex grammar variants. If multiple OpenAI variants are supplied, Lark is preferred over regex. Grammar constraints are enforced when the active model supports grammar tools; otherwise the tool falls back to normal function/JSON-schema handling. Grammar tool capability is model metadata: the generated catalog sets `compat.supportsOpenAIGrammarTools` for GPT-5+ models on endpoints that pass OpenAI custom tools through (OpenAI, OpenAI Codex, Azure OpenAI Responses, GitHub Copilot, opencode, and Cloudflare AI Gateway). OpenAI rejects `type: "custom"` tools for pre-GPT-5 models, and gateways that normalize tool schemas (e.g. OpenRouter) mangle them, so the flag stays off elsewhere. Custom model definitions can opt in via `compat`. Grammar-capable models reject grammar configurations without a non-empty supported variant. Native grammar tools must have an object parameter schema with exactly one required string property:
严格的 JSON schema 受约束采样在以下场景受支持：OpenAI、Anthropic、受支持的 Amazon Bedrock Converse 模型、Mistral，以及通过 Google Generative AI 和 Vertex 适配器进行的 Gemini 3 工具调用。Google 使用 `VALIDATED` function-calling 模式（显式要求时使用 `ANY`）；更早版本的 Gemini 在 `strict: 'prefer'` 下会回退，并拒绝 `strict: 'require'`，因为它们不会强制校验必填参数。Bedrock 的严格工具能力由模型的结构化输出元数据生成；自定义 Bedrock 模型可以覆盖 `compat.supportsStrictMode`。OpenAI Responses 与 Chat Completions 还能发出受语法（grammar）约束的自定义工具，支持 OpenAI Lark 或正则语法变体。如果同时提供了多个 OpenAI 变体，Lark 优先于正则。只有当前模型支持语法工具时，语法约束才会生效；否则该工具会回退到普通的 function/JSON schema 处理方式。语法工具能力属于模型元数据：生成的模型目录会为运行在支持透传 OpenAI 自定义工具的端点（OpenAI、OpenAI Codex、Azure OpenAI Responses、GitHub Copilot、opencode 以及 Cloudflare AI Gateway）上的 GPT-5+ 模型设置 `compat.supportsOpenAIGrammarTools`。OpenAI 会拒绝 GPT-5 之前模型的 `type: "custom"` 工具，而会规范化工具 schema 的网关（例如 OpenRouter）则会破坏它们，因此该标志在其他场景保持关闭。自定义模型定义可以通过 `compat` 主动启用。具备语法能力的模型会拒绝不含任何受支持变体的语法配置。原生语法工具的参数 schema 必须是对象类型，且恰好包含一个必填的字符串属性：

```typescript
const patchTool: Tool = {
  name: 'apply_patch',
  description: 'Apply a patch',
  parameters: Type.Object({
    input: Type.String()
  }, { additionalProperties: false }),
  constrainedSampling: {
    type: 'grammar',
    variants: {
      openai_lark: 'start: /.+/s'
    }
  }
};
```

### Handling Tool Calls 处理工具调用

Tool results use content blocks and can include both text and images:
工具结果以内容块（content block）的形式表示，可以同时包含文本和图像：

```typescript
import { readFileSync } from 'fs';

const context: Context = {
  messages: [{ role: 'user', content: 'What is the weather in London?', timestamp: Date.now() }],
  tools: [weatherTool]
};

const response = await models.complete(model, context);

// Check for tool calls in the response
for (const block of response.content) {
  if (block.type === 'toolCall') {
    // Execute your tool with the arguments
    // See "Validating Tool Arguments" section for validation
    const result = await executeWeatherApi(block.arguments);

    // Add tool result with text content
    context.messages.push({
      role: 'toolResult',
      toolCallId: block.id,
      toolName: block.name,
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: false,
      timestamp: Date.now()
    });
  }
}

// Tool results can also include images (for vision-capable models)
const imageBuffer = readFileSync('chart.png');
context.messages.push({
  role: 'toolResult',
  toolCallId: 'tool_xyz',
  toolName: 'generate_chart',
  content: [
    { type: 'text', text: 'Generated chart showing temperature trends' },
    { type: 'image', data: imageBuffer.toString('base64'), mimeType: 'image/png' }
  ],
  isError: false,
  timestamp: Date.now()
});
```

### Streaming Tool Calls with Partial JSON 以部分 JSON 流式处理工具调用

During streaming, tool call arguments are progressively parsed as they arrive. This enables real-time UI updates before the complete arguments are available:
在流式传输过程中，工具调用的参数会随着数据到达被逐步解析。这样即使参数尚未完整，也能实时更新 UI：

```typescript
const s = models.stream(model, context);

for await (const event of s) {
  if (event.type === 'toolcall_delta') {
    const toolCall = event.partial.content[event.contentIndex];

    // toolCall.arguments contains partially parsed JSON during streaming
    // This allows for progressive UI updates
    if (toolCall.type === 'toolCall' && toolCall.arguments) {
      // BE DEFENSIVE: arguments may be incomplete
      // Example: Show file path being written even before content is complete
      if (toolCall.name === 'write_file' && toolCall.arguments.path) {
        console.log(`Writing to: ${toolCall.arguments.path}`);

        // Content might be partial or missing
        if (toolCall.arguments.content) {
          console.log(`Content preview: ${toolCall.arguments.content.substring(0, 100)}...`);
        }
      }
    }
  }

  if (event.type === 'toolcall_end') {
    // Here toolCall.arguments is complete (but not yet validated)
    const toolCall = event.toolCall;
    console.log(`Tool completed: ${toolCall.name}`, toolCall.arguments);
  }
}
```

**Important notes about partial tool arguments:**
**关于部分工具参数的重要说明：**
- During `toolcall_delta` events, `arguments` contains the best-effort parse of partial JSON
  在 `toolcall_delta` 事件期间，`arguments` 包含对部分 JSON 的尽力解析结果
- Fields may be missing or incomplete - always check for existence before use
  字段可能缺失或不完整——使用前务必先检查是否存在
- String values may be truncated mid-word
  字符串值可能在词中间被截断
- Arrays may be incomplete
  数组可能不完整
- Nested objects may be partially populated
  嵌套对象可能只被部分填充
- At minimum, `arguments` will be an empty object `{}`, never `undefined`
  `arguments` 最少也会是一个空对象 `{}`，绝不会是 `undefined`
- The Google provider does not support function call streaming. Instead, you will receive a single `toolcall_delta` event with the full arguments.
  Google provider 不支持 function call 的流式传输。取而代之，你会收到一个携带完整参数的 `toolcall_delta` 事件。

### Validating Tool Arguments 校验工具参数

When implementing your own tool execution loop, use `validateToolCall` to validate arguments before passing them to your tools:
当你实现自己的工具执行循环时，请在把参数传给工具之前用 `validateToolCall` 进行校验：

```typescript
import { validateToolCall, type Tool } from '@earendil-works/pi-ai';

const tools: Tool[] = [weatherTool, calculatorTool];
const s = models.stream(model, { messages, tools });

for await (const event of s) {
  if (event.type === 'toolcall_end') {
    const toolCall = event.toolCall;

    try {
      // Validate arguments against the tool's schema (throws on invalid args)
      const validatedArgs = validateToolCall(tools, toolCall);
      const result = await executeMyTool(toolCall.name, validatedArgs);
      // ... add tool result to context
    } catch (error) {
      // Validation failed - return error as tool result so model can retry
      context.messages.push({
        role: 'toolResult',
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        content: [{ type: 'text', text: error.message }],
        isError: true,
        timestamp: Date.now()
      });
    }
  }
}
```

### Complete Event Reference 完整事件参考

All streaming events emitted during assistant message generation:
助手消息生成过程中发出的全部流式事件：

| Event Type<br>事件类型 | Description<br>说明 | Key Properties<br>关键属性 |
|------------|-------------|----------------|
| `start` | Stream begins<br>流开始 | `partial`: Initial assistant message structure<br>`partial`：初始的助手消息结构 |
| `text_start` | Text block starts<br>文本块开始 | `contentIndex`: Position in content array<br>`contentIndex`：在 content 数组中的位置 |
| `text_delta` | Text chunk received<br>收到文本分片 | `delta`: New text, `contentIndex`: Position<br>`delta`：新增文本，`contentIndex`：位置 |
| `text_end` | Text block complete<br>文本块结束 | `content`: Full text, `contentIndex`: Position<br>`content`：完整文本，`contentIndex`：位置 |
| `thinking_start` | Thinking block starts<br>思考块开始 | `contentIndex`: Position in content array<br>`contentIndex`：在 content 数组中的位置 |
| `thinking_delta` | Thinking chunk received<br>收到思考分片 | `delta`: New text, `contentIndex`: Position<br>`delta`：新增文本，`contentIndex`：位置 |
| `thinking_end` | Thinking block complete<br>思考块结束 | `content`: Full thinking, `contentIndex`: Position<br>`content`：完整思考内容，`contentIndex`：位置 |
| `toolcall_start` | Tool call begins<br>工具调用开始 | `contentIndex`: Position in content array<br>`contentIndex`：在 content 数组中的位置 |
| `toolcall_delta` | Tool arguments streaming<br>工具参数流式传输中 | `delta`: JSON chunk, `partial.content[contentIndex].arguments`: Partial parsed args<br>`delta`：JSON 分片，`partial.content[contentIndex].arguments`：已部分解析的参数 |
| `toolcall_end` | Tool call complete<br>工具调用结束 | `toolCall`: Complete validated tool call with `id`, `name`, `arguments`<br>`toolCall`：完整且已校验的工具调用，包含 `id`、`name`、`arguments` |
| `done` | Stream complete<br>流结束 | `reason`: Stop reason ("stop", "length", "toolUse"), `message`: Final assistant message<br>`reason`：停止原因（"stop"、"length"、"toolUse"），`message`：最终的助手消息 |
| `error` | Error occurred<br>发生错误 | `reason`: Error type ("error" or "aborted"), `error`: AssistantMessage with partial content<br>`reason`：错误类型（"error" 或 "aborted"），`error`：包含部分内容的 AssistantMessage |

Streaming events for different content blocks are not guaranteed to be contiguous. Providers may emit deltas for text, thinking, and tool calls in the same upstream chunk, and pi may surface corresponding events interleaved, for example `text_start`, `text_delta`, `toolcall_start`, `text_delta`, `toolcall_delta`. Consumers must use `contentIndex` to associate each delta/end event with its block and must not assume that a block's `*_start`/`*_delta`/`*_end` sequence is uninterrupted by events for other blocks.
不同内容块的流式事件不保证连续。provider 可能在同一个上游分片中同时发出文本、思考和工具调用的增量，pi 也可能交错地暴露相应事件，例如 `text_start`、`text_delta`、`toolcall_start`、`text_delta`、`toolcall_delta`。消费方必须用 `contentIndex` 把每个 delta/end 事件关联到对应的块，不能假设某个块的 `*_start`/`*_delta`/`*_end` 序列不会被其他块的事件打断。

## Image Input 图像输入

Models with vision capabilities can process images. You can check if a model supports images via the `input` property. If you pass images to a non-vision model, they are silently ignored.
具备视觉能力的模型可以处理图像。你可以通过 `input` 属性检查某个模型是否支持图像。如果把图像传给不支持视觉的模型，它们会被静默忽略。

```typescript
import { readFileSync } from 'fs';

const model = models.getModel('openai', 'gpt-4o-mini')!;

// Check if model supports images
if (model.input.includes('image')) {
  console.log('Model supports vision');
}

const imageBuffer = readFileSync('image.png');
const base64Image = imageBuffer.toString('base64');

const response = await models.complete(model, {
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: 'What is in this image?' },
      { type: 'image', data: base64Image, mimeType: 'image/png' }
    ],
    timestamp: Date.now()
  }]
});

// Access the response
for (const block of response.content) {
  if (block.type === 'text') {
    console.log(block.text);
  }
}
```

## Image Generation 图像生成

Image generation uses a separate API surface from text/chat generation, mirroring the chat-side design: an `ImagesModels` collection holds `ImagesProvider`s, reads are sync, and auth resolves through the owning provider. Image generation is a one-shot API: `generateImages()` waits for the provider response and returns the final `AssistantImages` result — do not use the chat/stream APIs for it.
图像生成使用与文本/对话生成相互独立的一套 API，但设计与对话侧保持一致：`ImagesModels` 集合持有若干 `ImagesProvider`，读取是同步的，鉴权通过拥有该模型的 provider 解析。图像生成是一次性（one-shot）API：`generateImages()` 会等待 provider 响应并返回最终的 `AssistantImages` 结果——请不要对它使用对话/流式 API。

### Basic Image Generation 基本图像生成

```typescript
import { builtinImagesModels } from '@earendil-works/pi-ai/providers/all';

// Every built-in image-generation provider; accepts the same options as createModels()
const imagesModels = builtinImagesModels();

const model = imagesModels.getModel('openrouter', 'google/gemini-2.5-flash-image')!;

// Auth resolves through the provider (OPENROUTER_API_KEY here); explicit apiKey wins
const result = await imagesModels.generateImages(model, {
  input: [{ type: 'text', text: 'Generate a red circle on a plain white background.' }]
});

for (const block of result.output) {
  if (block.type === 'text') {
    console.log(block.text);
  } else if (block.type === 'image') {
    console.log(block.mimeType);
    console.log(block.data.substring(0, 32));
  }
}
```

Like the chat side, you can build the collection from parts: `createImagesModels({ credentials?, authContext? })`, the `openrouterImagesProvider()` factory from `@earendil-works/pi-ai/providers/openrouter-images`, and `createImagesProvider({ id, auth, models, refreshModels?, api })` for custom image providers (with `imagesModels.refresh(provider?)` for dynamic lists). Failures never reject — they return an `AssistantImages` with `stopReason: "error"`. The collection's provider-scoped `getAuth(providerId)` works exactly like the chat-side one.
与对话侧一样，你也可以按需组装该集合：使用 `createImagesModels({ credentials?, authContext? })`、来自 `@earendil-works/pi-ai/providers/openrouter-images` 的 `openrouterImagesProvider()` 工厂函数，以及用于自定义图像 provider 的 `createImagesProvider({ id, auth, models, refreshModels?, api })`（动态列表可用 `imagesModels.refresh(provider?)`）。失败不会以异常拒绝——而是返回一个 `stopReason: "error"` 的 `AssistantImages`。该集合中 provider 级别的 `getAuth(providerId)` 与对话侧完全一致。

The old global API (`getImageModel()` / `getImageModels()` / `getImageProviders()` / `generateImages()`) remains available on the [compat entrypoint](#migrating-from-the-old-global-api):
旧的全局 API（`getImageModel()` / `getImageModels()` / `getImageProviders()` / `generateImages()`）依然可以从 [compat 入口](#migrating-from-the-old-global-api) 获取：

```typescript
import { getImageModel, generateImages } from '@earendil-works/pi-ai/compat';

const model = getImageModel('openrouter', 'google/gemini-2.5-flash-image');
const result = await generateImages(model, {
  input: [{ type: 'text', text: 'Generate a red circle on a plain white background.' }]
}, {
  apiKey: process.env.OPENROUTER_API_KEY
});
```

Some models also support image input:
部分模型还支持图像输入：

```typescript
import { readFileSync } from 'fs';

const imageBuffer = readFileSync('input.png');
const result = await imagesModels.generateImages(model, {
  input: [
    { type: 'text', text: 'Create a variation of this image with a blue background.' },
    { type: 'image', data: imageBuffer.toString('base64'), mimeType: 'image/png' }
  ]
});
```

Check capabilities on the model metadata:
可以通过模型元数据检查其能力：

```typescript
console.log(model.input);   // ['text', 'image']
console.log(model.output);  // ['image'] or ['image', 'text']
```

### Notes and Limitations 注意事项与限制

- Image models live in `ImagesModels` collections, chat models in `Models` collections; the two are separate surfaces.
  图像模型位于 `ImagesModels` 集合中，对话模型位于 `Models` 集合中；两者是彼此独立的 API。
- Use `generateImages()`, not the chat/stream APIs.
  请使用 `generateImages()`，而不是对话/流式 API。
- Image-generation models do not participate in tool calling.
  图像生成模型不参与工具调用。
- Outputs are returned in `AssistantImages.output` and can include both base64-encoded `ImageContent` blocks and `TextContent` blocks.
  输出通过 `AssistantImages.output` 返回，可能同时包含 base64 编码的 `ImageContent` 块与 `TextContent` 块。
- Some models return only images, others return images plus text. Check `model.output`.
  有些模型只返回图像，有些则同时返回图像和文本。请检查 `model.output`。
- Some models accept image input, others are text-to-image only. Check `model.input`.
  有些模型接受图像输入，有些则仅支持文生图。请检查 `model.input`。
- Like the streaming APIs, image generation supports options such as `apiKey`, `signal`, `headers`, `onPayload`, and `onResponse`, and results may include `stopReason`, `responseId`, and `usage`.
  与流式 API 一样，图像生成支持 `apiKey`、`signal`、`headers`、`onPayload`、`onResponse` 等选项，结果中也可能包含 `stopReason`、`responseId` 和 `usage`。
- If you want a model to analyze images in a conversation or call tools, use the regular chat APIs with a model that supports image input.
  如果你希望模型在对话中分析图像或调用工具，请使用常规的对话 API，并选择支持图像输入的模型。
- At the moment, image generation is available through only one provider, OpenRouter.
  目前图像生成仅通过 OpenRouter 这一个 provider 提供。

## Thinking/Reasoning 思考/推理

Many models support thinking/reasoning capabilities where they can show their internal thought process. You can check if a model supports reasoning via the `reasoning` property. If you pass reasoning options to a non-reasoning model, they are silently ignored.
许多模型支持思考/推理（thinking/reasoning）能力，可以展示其内部思考过程。你可以通过 `reasoning` 属性检查模型是否支持推理。如果把推理选项传给不支持推理的模型，它们会被静默忽略。

### Unified Interface (streamSimple/completeSimple) 统一接口

```typescript
// Many models across providers support thinking/reasoning
const model = models.getModel('anthropic', 'claude-sonnet-4-5')!;
// or models.getModel('openai', 'gpt-5-mini');
// or models.getModel('google', 'gemini-2.5-flash');
// or models.getModel('xai', 'grok-4.5');

// Check if model supports reasoning
if (model.reasoning) {
  console.log('Model supports reasoning/thinking');
}

// Use the simplified reasoning option
const response = await models.completeSimple(model, {
  messages: [{ role: 'user', content: 'Solve: 2x + 5 = 13', timestamp: Date.now() }]
}, {
  reasoning: 'medium'  // 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
});

// Access thinking and text blocks
for (const block of response.content) {
  if (block.type === 'thinking') {
    console.log('Thinking:', block.thinking);
  } else if (block.type === 'text') {
    console.log('Response:', block.text);
  }
}
```

`xhigh` and `max` are model-specific, opt-in levels. Use `getSupportedThinkingLevels(model)` to determine whether a concrete model exposes either level; models such as GPT-5.6 can expose both.
`xhigh` 和 `max` 是需要模型专门支持、按需启用的档位。可用 `getSupportedThinkingLevels(model)` 判断某个具体模型是否提供这两个档位；像 GPT-5.6 这样的模型两者都支持。

### Provider-Specific Options (stream/complete) provider 专属选项

`models.stream()`/`complete()` accept the owning API's full option set. Use `hasApi()` to narrow a dynamically looked-up model to its API for full option typing:
`models.stream()`/`complete()` 接受所属 API 的完整选项集合。对动态查找得到的模型，可用 `hasApi()` 将其收窄到具体 API，从而获得完整的选项类型提示：

```typescript
import { hasApi } from '@earendil-works/pi-ai';

// OpenAI Reasoning (o1, o3, gpt-5)
const openaiModel = models.getModel('openai', 'gpt-5-mini')!;
if (hasApi(openaiModel, 'openai-responses')) {
  await models.complete(openaiModel, context, {
    reasoningEffort: 'medium',
    reasoningSummary: 'detailed'  // OpenAI Responses API only
  });
}

// Anthropic Thinking
const anthropicModel = models.getModel('anthropic', 'claude-sonnet-4-5')!;
if (hasApi(anthropicModel, 'anthropic-messages')) {
  await models.complete(anthropicModel, context, {
    thinkingEnabled: true,
    thinkingBudgetTokens: 8192  // Optional token limit
  });
}

// Google Gemini Thinking
const googleModel = models.getModel('google', 'gemini-2.5-flash')!;
if (hasApi(googleModel, 'google-generative-ai')) {
  await models.complete(googleModel, context, {
    thinking: {
      enabled: true,
      budgetTokens: 8192  // -1 for dynamic, 0 to disable
    }
  });
}
```

### Streaming Thinking Content 流式输出思考内容

When streaming, thinking content is delivered through specific events:
在流式传输中，思考内容通过特定事件传递：

```typescript
const s = models.streamSimple(model, context, { reasoning: 'high' });

for await (const event of s) {
  switch (event.type) {
    case 'thinking_start':
      console.log('[Model started thinking]');
      break;
    case 'thinking_delta':
      process.stdout.write(event.delta);  // Stream thinking content
      break;
    case 'thinking_end':
      console.log('\n[Thinking complete]');
      break;
  }
}
```

## Stop Reasons 停止原因

Every `AssistantMessage` includes a `stopReason` field that indicates how the generation ended:
每个 `AssistantMessage` 都包含一个 `stopReason` 字段，用于说明本次生成是如何结束的：

- `"pending"` - Only present in partial messages when we do not know what the stop reason will be
  仅出现在尚不知道最终停止原因的部分消息中
- `"stop"` - This is the final message the model will produce this turn
  这是模型在本轮中产生的最终消息
- `"length"` - Output hit the maximum token limit
  输出达到了最大 token 上限
- `"toolUse"` - Model is calling tools and expects tool results
  模型正在调用工具并等待工具结果
- `"error"` - An error occurred during generation
  生成过程中发生了错误
- `"aborted"` - Request was cancelled via abort signal
  请求被 abort signal 取消

`AssistantMessage` may also include `responseId`, a provider-specific upstream response or message identifier when the underlying API exposes one. Do not assume it is always present across providers.
当底层 API 暴露该信息时，`AssistantMessage` 还可能包含 `responseId`，即 provider 特有的上游响应或消息标识符。不要假定所有 provider 都会提供它。

## Error Handling 错误处理

Request failures never throw out of the stream functions: when a request ends with an error (including aborts and tool call validation errors), the streaming API emits an error event and the final message carries the details:
请求失败绝不会从流函数中抛出异常：当请求以错误结束时（包括中止和工具调用校验错误），流式 API 会发出一个 error 事件，最终消息中也会携带详细信息：

```typescript
// In streaming
for await (const event of s) {
  if (event.type === 'error') {
    // event.reason is either "error" or "aborted"
    // event.error is the AssistantMessage with partial content
    console.error(`Error (${event.reason}):`, event.error.errorMessage);
    console.log('Partial content:', event.error.content);
  }
}

// The final message will have the error details
const message = await s.result();
if (message.stopReason === 'error' || message.stopReason === 'aborted') {
  console.error('Request failed:', message.errorMessage);
  // message.content contains any partial content received before the error
  // message.usage contains partial token counts and costs
}
```

Auth failures (no key configured, OAuth refresh failed, unknown provider) surface the same way: as a stream error with `stopReason: "error"`.
鉴权失败（未配置 key、OAuth 刷新失败、未知 provider）也以同样的方式呈现：作为一个 `stopReason: "error"` 的流式错误。

### Aborting Requests 中止请求

The abort signal allows you to cancel in-progress requests. Aborted requests have `stopReason === 'aborted'`:
abort signal 可用于取消进行中的请求。被中止的请求其 `stopReason === 'aborted'`：

```typescript
const controller = new AbortController();

// Abort after 2 seconds
setTimeout(() => controller.abort(), 2000);

const s = models.stream(model, {
  messages: [{ role: 'user', content: 'Write a long story', timestamp: Date.now() }]
}, {
  signal: controller.signal
});

for await (const event of s) {
  if (event.type === 'text_delta') {
    process.stdout.write(event.delta);
  } else if (event.type === 'error') {
    // event.reason tells you if it was "error" or "aborted"
    console.log(`${event.reason === 'aborted' ? 'Aborted' : 'Error'}:`, event.error.errorMessage);
  }
}

// Get results (may be partial if aborted)
const response = await s.result();
if (response.stopReason === 'aborted') {
  console.log('Request was aborted:', response.errorMessage);
  console.log('Partial content received:', response.content);
  console.log('Tokens used:', response.usage);
}
```

### Continuing After Abort 中止后继续

Aborted messages can be added to the conversation context and continued in subsequent requests:
被中止的消息可以加入会话上下文，并在后续请求中继续：

```typescript
const context = {
  messages: [
    { role: 'user', content: 'Explain quantum computing in detail', timestamp: Date.now() }
  ]
};

// First request gets aborted after 2 seconds
const controller1 = new AbortController();
setTimeout(() => controller1.abort(), 2000);

const partial = await models.complete(model, context, { signal: controller1.signal });

// Add the partial response to context
context.messages.push(partial);
context.messages.push({ role: 'user', content: 'Please continue', timestamp: Date.now() });

// Continue the conversation
const continuation = await models.complete(model, context);
```

### Debugging Provider Payloads 调试 provider 请求负载

Use the `onPayload` callback to inspect the request payload sent to the provider. This is useful for debugging request formatting issues or provider validation errors.
使用 `onPayload` 回调可以查看发送给 provider 的请求负载（payload）。这对排查请求格式问题或 provider 校验错误很有用。

```typescript
const response = await models.complete(model, context, {
  onPayload: (payload) => {
    console.log('Provider payload:', JSON.stringify(payload, null, 2));
  }
});
```

The callback is supported by `stream`, `complete`, `streamSimple`, and `completeSimple`.
`stream`、`complete`、`streamSimple` 和 `completeSimple` 都支持该回调。

## Custom Providers 自定义 provider

### createProvider()

`createProvider()` builds a provider from parts: identity, auth, a model list, and an API implementation. Use it for local inference servers, proxies, or any OpenAI/Anthropic-compatible endpoint:
`createProvider()` 用若干组成部分构建一个 provider：标识、鉴权、模型列表和一个 API 实现。它适用于本地推理服务、代理，或任何 OpenAI/Anthropic 兼容端点：

```typescript
import { createModels, createProvider, envApiKeyAuth, type Model } from '@earendil-works/pi-ai';
import { openAICompletionsApi } from '@earendil-works/pi-ai/api/openai-completions.lazy';

const ollamaModel: Model<'openai-completions'> = {
  id: 'llama-3.1-8b',
  name: 'Llama 3.1 8B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: false,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 128000,
  maxTokens: 32000
};

const ollama = createProvider({
  id: 'ollama',
  name: 'Ollama',
  baseUrl: 'http://localhost:11434/v1',
  // Every provider declares auth; keyless local servers resolve as configured with no key.
  auth: { apiKey: { name: 'Ollama', resolve: async () => ({ auth: {} }) } },
  models: [ollamaModel],
  api: openAICompletionsApi(),
});

const models = createModels();
models.setProvider(ollama);

await models.complete(models.getModel('ollama', 'llama-3.1-8b')!, context);
```

For providers with real keys, `envApiKeyAuth(displayName, envVars)` gives the standard behavior (stored credential wins, then the first set env var):
对于确实需要 key 的 provider，`envApiKeyAuth(displayName, envVars)` 提供标准行为（已存储的凭据优先，其次是第一个已设置的环境变量）：

```typescript
const proxy = createProvider({
  id: 'my-proxy',
  auth: { apiKey: envApiKeyAuth('My proxy API key', ['MY_PROXY_API_KEY']) },
  models: [/* ... */],
  api: openAICompletionsApi(),
});
```

Mixed-API providers pass a map keyed by `model.api`; each model dispatches to its API's implementation:
混合 API 的 provider 需要传入以 `model.api` 为键的映射；每个模型会分发到其对应 API 的实现：

```typescript
import { anthropicMessagesApi } from '@earendil-works/pi-ai/api/anthropic-messages.lazy';
import { openAIResponsesApi } from '@earendil-works/pi-ai/api/openai-responses.lazy';

const gateway = createProvider({
  id: 'my-gateway',
  auth: { apiKey: envApiKeyAuth('Gateway key', ['GATEWAY_API_KEY']) },
  models: [/* models with api: 'anthropic-messages' or 'openai-responses' */],
  api: {
    'anthropic-messages': anthropicMessagesApi(),
    'openai-responses': openAIResponsesApi(),
  },
});
```

Provider-wide endpoint or request transformations belong in the provider's API implementation: wrap the `ProviderStreams` you pass as `api` so every request goes through the transformation before dispatch. The Cloudflare providers do this to materialize account/gateway endpoint placeholders from the resolved provider env:
provider 级别的端点或请求改写应放在该 provider 的 API 实现中：把作为 `api` 传入的 `ProviderStreams` 包装一层，使每个请求在分发前都经过该改写。Cloudflare 的 provider 就是这样从解析出的 provider 环境变量中填充 account/gateway 端点占位符的：

```typescript
function tenantStreams(streams: ProviderStreams): ProviderStreams {
  const withTenant = (model: Model<Api>) => ({ ...model, baseUrl: model.baseUrl.replace('{tenant}', tenantId) });
  return {
    stream: (model, context, options) => streams.stream(withTenant(model), context, options),
    streamSimple: (model, context, options) => streams.streamSimple(withTenant(model), context, options),
  };
}

const tenantGateway = createProvider({
  id: 'tenant-gateway',
  auth: { apiKey: envApiKeyAuth('Gateway key', ['GATEWAY_API_KEY']) },
  models: [/* ... */],
  api: tenantStreams(openAICompletionsApi()),
});
```

Dynamic model lists use `fetchModels`. `Models.refresh()` refreshes every configured dynamic provider, passing its effective API-key or refreshed OAuth credential. A `ModelsStore` persists dynamic catalogs; both stores default to in-memory implementations.
动态模型列表使用 `fetchModels`。`Models.refresh()` 会刷新每个已配置的动态 provider，并传入其生效的 API key 或刷新后的 OAuth 凭据。`ModelsStore` 用于持久化动态模型目录；两种存储的默认实现都是内存实现。

```typescript
const models = createModels({ credentials, modelsStore });
const llamacpp = createProvider({
  id: 'llamacpp',
  auth: { apiKey: { name: 'llama.cpp', resolve: async () => ({ auth: {} }) } },
  models: [],
  fetchModels: async ({ signal }) => fetchModelsFromServer('http://localhost:8080', signal),
  api: openAICompletionsApi(),
});

models.setProvider(llamacpp);
const result = await models.refresh({ signal });
if (result.aborted) console.log('refresh cancelled');
for (const [provider, error] of result.errors) console.error(provider, error);
```

Use `models.refresh({ allowNetwork: false })` to restore persisted catalogs without network access, or `models.refresh({ force: true })` to bypass provider freshness checks. Model reads stay synchronous and return the last restored or refreshed list.
使用 `models.refresh({ allowNetwork: false })` 可在不访问网络的情况下恢复已持久化的模型目录，使用 `models.refresh({ force: true })` 可跳过 provider 的新鲜度检查。模型读取仍然是同步的，返回最近一次恢复或刷新得到的列表。

Custom models can carry `headers` (e.g. proxies behind bot detection) and `compat` flags. `Models.getAuth(model)` includes those model headers, and stream methods merge them before explicit request headers and `transformHeaders`. See [OpenAI Compatibility Settings](#openai-compatibility-settings).
自定义模型可以携带 `headers`（例如位于机器人检测之后的代理）和 `compat` 标志。`Models.getAuth(model)` 会包含这些模型请求头，流式方法则会在显式请求头和 `transformHeaders` 之前合并它们。参见 [OpenAI Compatibility Settings](#openai-compatibility-settings)。

Some OpenAI-compatible servers do not understand the `developer` role used for reasoning-capable models. For those providers, set `compat.supportsDeveloperRole` to `false` so the system prompt is sent as a `system` message instead. If the server also does not support `reasoning_effort`, set `compat.supportsReasoningEffort` to `false` too. This commonly applies to Ollama, vLLM, SGLang, and similar OpenAI-compatible servers.
有些 OpenAI 兼容服务不认识推理类模型所使用的 `developer` 角色。对这些 provider，请把 `compat.supportsDeveloperRole` 设为 `false`，这样系统提示词会改为以 `system` 消息发送。如果该服务同样不支持 `reasoning_effort`，请把 `compat.supportsReasoningEffort` 也设为 `false`。这通常适用于 Ollama、vLLM、SGLang 等类似的 OpenAI 兼容服务。

Use model-level `thinkingLevelMap` to describe model-specific thinking controls. Keys are pi thinking levels (`off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`). Missing standard levels through `high` use provider defaults; `xhigh` and `max` are opt-in and require a non-null map entry. String values are sent to the provider, `null` marks a level unsupported, and maps may skip levels.
使用模型级的 `thinkingLevelMap` 来描述该模型专属的思考控制方式。键为 pi 的思考档位（`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`）。`high` 及以下的标准档位若未列出，则使用 provider 默认值；`xhigh` 和 `max` 需要显式启用，必须在映射中提供非 null 的取值。字符串值会被发送给 provider，`null` 表示不支持该档位，映射中也可以跳过某些档位。

```typescript
const ollamaReasoningModel: Model<'openai-completions'> = {
  id: 'gpt-oss:20b',
  name: 'GPT-OSS 20B (Ollama)',
  api: 'openai-completions',
  provider: 'ollama',
  baseUrl: 'http://localhost:11434/v1',
  reasoning: true,
  input: ['text'],
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: 131072,
  maxTokens: 32000,
  thinkingLevelMap: {
    minimal: null,
    low: null,
    medium: null,
    high: 'high',
    xhigh: null,
  },
  compat: {
    supportsDeveloperRole: false,
    supportsReasoningEffort: false,
  }
};
```

### Calling API Implementations Directly 直接调用 API 实现

The API implementations are importable on their own. Each module exports exactly `stream` and `streamSimple` with that API's full option typing. Direct calls bypass provider auth — pass `apiKey` explicitly:
各个 API 实现也可以单独导入。每个模块正好导出 `stream` 和 `streamSimple`，并带有该 API 的完整选项类型。直接调用会绕过 provider 鉴权——请显式传入 `apiKey`：

```typescript
import { stream } from '@earendil-works/pi-ai/api/anthropic-messages';

const s = stream(claudeModel, context, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  thinkingEnabled: true,
  thinkingBudgetTokens: 2048,
});
```

Built-in API implementations live under `./api/<api-id>`:
内置的 API 实现位于 `./api/<api-id>`：

| API id<br>API 标识 | Options type<br>选项类型 |
|--------|--------------|
| `anthropic-messages` | `AnthropicOptions` |
| `openai-completions` | `OpenAICompletionsOptions` |
| `openai-responses` | `OpenAIResponsesOptions` |
| `openai-codex-responses` | `OpenAICodexResponsesOptions` |
| `azure-openai-responses` | `AzureOpenAIResponsesOptions` |
| `google-generative-ai` | `GoogleOptions` |
| `google-vertex` | `GoogleVertexOptions` |
| `mistral-conversations` | `MistralOptions` |
| `bedrock-converse-stream` | `BedrockOptions` |

Importing an implementation module loads its SDK. The `./api/<id>.lazy` wrappers (used by the provider factories) defer that load to the first request when the runtime or bundler supports dynamic import chunking. Legacy raw API subpaths from older releases (`./anthropic`, `./google`, `./mistral`, `./openai-completions`, ...) were removed; use `@earendil-works/pi-ai/api/<api-id>`.
导入某个实现模块会同时加载其 SDK。`./api/<id>.lazy` 包装层（provider 工厂函数使用的就是它）会在运行时或打包工具支持动态导入分块时，把该加载推迟到首次请求。旧版本中的原始 API 子路径（`./anthropic`、`./google`、`./mistral`、`./openai-completions` 等）已被移除；请改用 `@earendil-works/pi-ai/api/<api-id>`。

### OpenAI Compatibility Settings OpenAI 兼容性设置

The `openai-completions` API is implemented by many providers with minor differences. By default, the library auto-detects compatibility settings based on `baseUrl` for a small set of known OpenAI-compatible providers (Cerebras, xAI, Chutes, DeepSeek, NVIDIA NIM, Together AI, zAi, OpenCode, Cloudflare Workers AI, etc.). For custom proxies or unknown endpoints, you can override these settings via the `compat` field. For `openai-responses` models, the compat field supports Responses-specific flags.
`openai-completions` API 被许多 provider 实现，彼此之间存在细微差异。默认情况下，本库会针对一小部分已知的 OpenAI 兼容 provider（Cerebras、xAI、Chutes、DeepSeek、NVIDIA NIM、Together AI、zAi、OpenCode、Cloudflare Workers AI 等）根据 `baseUrl` 自动检测兼容性设置。对于自定义代理或未知端点，你可以通过 `compat` 字段覆盖这些设置。对于 `openai-responses` 模型，compat 字段支持 Responses 专属的标志。

```typescript
interface OpenAICompletionsCompat {
  supportsStore?: boolean;           // Whether provider supports the `store` field (default: true)
  supportsDeveloperRole?: boolean;   // Whether provider supports `developer` role vs `system` (default: true)
  supportsReasoningEffort?: boolean; // Whether provider supports `reasoning_effort` (default: true)
  supportsUsageInStreaming?: boolean; // Whether provider supports `stream_options: { include_usage: true }` (default: true)
  supportsStrictMode?: boolean;      // Whether provider supports `strict` in tool definitions (default: true)
  supportsOpenAIGrammarTools?: boolean; // Whether to emit OpenAI custom Lark/regex grammar tools; false falls back to normal function tools (default: false; the generated catalog enables it for capable models)
  sendSessionAffinityHeaders?: boolean; // Send session-affinity data from `sessionId` (default: false)
  sessionAffinityFormat?: 'openai' | 'openai-nosession' | 'openrouter'; // Format for session affinity: 'openai' uses `prompt_cache_key`, `session_id`, `x-client-request-id`, and `x-session-affinity`; 'openai-nosession' uses `prompt_cache_key`, `x-client-request-id`, and `x-session-affinity`; 'openrouter' uses `x-session-id` (default: auto-detected)
  maxTokensField?: 'max_completion_tokens' | 'max_tokens';  // Which field name to use (default: max_completion_tokens)
  requiresToolResultName?: boolean;  // Whether tool results require the `name` field (default: false)
  requiresAssistantAfterToolResult?: boolean; // Whether tool results must be followed by an assistant message (default: false)
  requiresThinkingAsText?: boolean;  // Whether thinking blocks must be converted to text (default: false)
  requiresReasoningContentOnAssistantMessages?: boolean; // Whether all replayed assistant messages must include empty reasoning_content when reasoning is enabled (default: auto-detected for DeepSeek)
  thinkingFormat?: 'openai' | 'openrouter' | 'deepseek' | 'together' | 'zai' | 'qwen' | 'chat-template' | 'qwen-chat-template' | 'string-thinking' | 'ant-ling'; // Format for reasoning param: 'openai' uses reasoning_effort, 'openrouter' uses reasoning: { effort }, 'deepseek' uses thinking: { type } plus reasoning_effort when supported, 'together' uses reasoning: { enabled } plus reasoning_effort when supported, 'zai' uses thinking: { type }, 'qwen' uses enable_thinking, 'chat-template' uses configurable chat_template_kwargs, 'qwen-chat-template' uses chat_template_kwargs.enable_thinking and preserve_thinking, 'string-thinking' uses top-level thinking, 'ant-ling' uses reasoning: { effort } only for mapped efforts (default: openai)
  chatTemplateKwargs?: Record<string, string | number | boolean | null | { '$var': 'thinking.enabled' | 'thinking.effort'; omitWhenOff?: boolean }>; // chat_template_kwargs values; use $var for pi-controlled thinking values
  cacheControlFormat?: 'anthropic';  // Anthropic-style cache_control on system prompt, last tool, and last user/assistant text content
  openRouterRouting?: OpenRouterRouting; // OpenRouter routing preferences (default: {})
  vercelGatewayRouting?: VercelGatewayRouting; // Vercel AI Gateway routing preferences (default: {})
}

interface OpenAIResponsesCompat {
  supportsDeveloperRole?: boolean;   // Whether provider supports `developer` role vs `system` (default: true)
  sessionAffinityFormat?: 'openai' | 'openai-nosession' | 'openrouter'; // Session-affinity header format: 'openai' sends `session_id` and `x-client-request-id`; 'openai-nosession' sends `x-client-request-id`; 'openrouter' sends `x-session-id`. Does not affect the `prompt_cache_key` body param (default: auto-detected)
  supportsLongCacheRetention?: boolean; // Whether provider supports `prompt_cache_retention: "24h"` (default: true)
  supportsStrictMode?: boolean;      // Whether provider supports strict JSON-schema function tools (default: false; enabled in metadata for built-in OpenAI models)
  supportsOpenAIGrammarTools?: boolean; // Whether to emit OpenAI custom Lark/regex grammar tools; false falls back to normal function tools (default: false; the generated catalog enables it for capable models)
}
```

If `compat` is not set, the library falls back to URL-based detection. If `compat` is partially set, unspecified fields use the detected defaults. This is useful for:
如果未设置 `compat`，本库会回退到基于 URL 的检测。如果只设置了部分 `compat` 字段，未指定的字段沿用检测出的默认值。这在以下场景很有用：

- **LiteLLM proxies**: May not support `store` field
  **LiteLLM 代理**：可能不支持 `store` 字段
- **Custom inference servers**: May use non-standard field names
  **自定义推理服务**：可能使用非标准的字段名
- **Self-hosted endpoints**: May have different feature support
  **自建端点**：支持的特性可能不同

## Faux Provider for Tests 测试用的 Faux provider

`fauxProvider()` builds an in-memory provider with scripted responses for tests and demos:
`fauxProvider()` 会构建一个内存中的 provider，按预设脚本返回响应，适用于测试和演示：

```typescript
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxThinking,
  fauxToolCall,
} from '@earendil-works/pi-ai';

const faux = fauxProvider({
  tokensPerSecond: 50 // optional
});

const models = createModels();
models.setProvider(faux.provider);

const model = faux.getModel();
const context = {
  messages: [{ role: 'user', content: 'Summarize package.json and then call echo', timestamp: Date.now() }]
};

faux.setResponses([
  fauxAssistantMessage([
    fauxThinking('Need to inspect package metadata first.'),
    fauxToolCall('echo', { text: 'package.json' })
  ], { stopReason: 'toolUse' })
]);

const first = await models.complete(model, context, {
  sessionId: 'session-1',
  cacheRetention: 'short'
});
context.messages.push(first);

context.messages.push({
  role: 'toolResult',
  toolCallId: first.content.find((block) => block.type === 'toolCall')!.id,
  toolName: 'echo',
  content: [{ type: 'text', text: 'package.json contents here' }],
  isError: false,
  timestamp: Date.now()
});

faux.setResponses([
  fauxAssistantMessage([
    fauxThinking('Now I can summarize the tool output.'),
    fauxText('Here is the summary.')
  ])
]);

const s = models.stream(model, context);
for await (const event of s) {
  console.log(event.type);
}

// Optional: multiple faux models for model-switching tests
const multiModel = fauxProvider({
  provider: 'faux-multi',
  models: [
    { id: 'faux-fast', reasoning: false },
    { id: 'faux-thinker', reasoning: true }
  ]
});
models.setProvider(multiModel.provider);
const thinker = multiModel.getModel('faux-thinker');

console.log(thinker?.reasoning);
console.log(faux.getPendingResponseCount());
console.log(faux.state.callCount);
```

Notes:
说明：
- Responses are consumed from a queue in request start order.
  响应按请求开始的顺序从队列中依次取出。
- If the queue is empty, the faux provider returns an assistant error message with `errorMessage: "No more faux responses queued"`.
  如果队列为空，faux provider 会返回一条助手错误消息，其 `errorMessage: "No more faux responses queued"`。
- Use `faux.setResponses([...])` to replace the remaining queue and `faux.appendResponses([...])` to add more responses.
  用 `faux.setResponses([...])` 替换队列中剩余的响应，用 `faux.appendResponses([...])` 追加更多响应。
- `faux.models` exposes all faux models. `faux.getModel()` returns the first one, and `faux.getModel(id)` returns a specific one.
  `faux.models` 暴露所有 faux 模型。`faux.getModel()` 返回第一个，`faux.getModel(id)` 返回指定的那个。
- Use `fauxAssistantMessage(...)` for scripted assistant replies. Use `fauxText(...)`, `fauxThinking(...)`, and `fauxToolCall(...)` to build content blocks without filling in low-level fields manually.
  用 `fauxAssistantMessage(...)` 编写脚本化的助手回复。用 `fauxText(...)`、`fauxThinking(...)` 和 `fauxToolCall(...)` 构建内容块，无需手工填写底层字段。
- Usage is estimated at roughly 1 token per 4 characters. When `sessionId` is present and `cacheRetention` is not `"none"`, prompt cache reads and writes are simulated automatically.
  用量按大约每 4 个字符 1 个 token 估算。当存在 `sessionId` 且 `cacheRetention` 不为 `"none"` 时，会自动模拟提示缓存（prompt cache）的读写。
- Tool call arguments stream incrementally via `toolcall_delta` chunks.
  工具调用参数会通过 `toolcall_delta` 分片增量流式输出。
- By default, each streamed chunk is emitted on its own microtask. Set `tokensPerSecond` to pace chunk delivery in real time.
  默认情况下，每个流式分片都在各自的微任务中发出。设置 `tokensPerSecond` 可按真实时间节奏控制分片投递速度。
- The intended use is one deterministic scripted flow per handle. If you need independent concurrent flows, create separate faux providers with distinct `provider` ids.
  设计用途是每个句柄对应一条确定性的脚本流程。如果需要相互独立的并发流程，请创建多个使用不同 `provider` id 的 faux provider。

## Cross-Provider Handoffs 跨 provider 移交

The library supports seamless handoffs between different LLM providers within the same conversation. This allows you to switch models mid-conversation while preserving context, including thinking blocks, tool calls, and tool results.
本库支持在同一次会话中于不同 LLM provider 之间无缝移交。这样你可以在对话中途切换模型，同时保留上下文，包括思考块、工具调用和工具结果。

When messages from one provider are sent to a different provider, the library automatically transforms them for compatibility:
当来自某个 provider 的消息被发送到另一个 provider 时，本库会自动对其进行兼容性转换：

- **User and tool result messages** are passed through unchanged
  **用户消息和工具结果消息**原样透传
- **Assistant messages from the same provider/API** are preserved as-is
  **来自同一 provider/API 的助手消息**保持原样
- **Assistant messages from different providers** have their thinking blocks converted to text with `<thinking>` tags
  **来自不同 provider 的助手消息**，其思考块会被转换为带 `<thinking>` 标签的文本
- **Tool calls and regular text** are preserved unchanged
  **工具调用和普通文本**保持不变

```typescript
import { createModels, type Context } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { googleProvider } from '@earendil-works/pi-ai/providers/google';

const models = createModels();
models.setProvider(anthropicProvider());
models.setProvider(openaiProvider());
models.setProvider(googleProvider());

const context: Context = { messages: [] };

// Start with Claude
const claude = models.getModel('anthropic', 'claude-sonnet-4-5')!;
context.messages.push({ role: 'user', content: 'What is 25 * 18?', timestamp: Date.now() });
context.messages.push(await models.completeSimple(claude, context, { reasoning: 'medium' }));

// Switch to GPT-5 - it will see Claude's thinking as <thinking> tagged text
const gpt5 = models.getModel('openai', 'gpt-5-mini')!;
context.messages.push({ role: 'user', content: 'Is that calculation correct?', timestamp: Date.now() });
context.messages.push(await models.complete(gpt5, context));

// Switch to Gemini
const gemini = models.getModel('google', 'gemini-2.5-flash')!;
context.messages.push({ role: 'user', content: 'What was the original question?', timestamp: Date.now() });
const geminiResponse = await models.complete(gemini, context);
```

All providers can handle messages from other providers — text, tool calls and results (including images), thinking blocks (transformed to tagged text), and aborted messages with partial content. This enables flexible workflows: start with a fast model, switch to a more capable one for complex reasoning, or maintain continuity across provider outages.
所有 provider 都能处理来自其他 provider 的消息——文本、工具调用与结果（包括图像）、思考块（转换为带标签的文本），以及包含部分内容的被中止消息。这带来了灵活的工作流：先用快速模型起步，遇到复杂推理时切换到能力更强的模型，或在某个 provider 故障时保持会话连续性。

## Context Serialization 上下文序列化

The `Context` object can be easily serialized and deserialized using standard JSON methods, making it simple to persist conversations, implement chat history, or transfer contexts between services:
`Context` 对象可以用标准 JSON 方法轻松序列化和反序列化，因此持久化会话、实现聊天历史或在服务之间传递上下文都很简单：

```typescript
const context: Context = {
  systemPrompt: 'You are a helpful assistant.',
  messages: [
    { role: 'user', content: 'What is TypeScript?', timestamp: Date.now() }
  ]
};

const model = models.getModel('openai', 'gpt-4o-mini')!;
const response = await models.complete(model, context);
context.messages.push(response);

// Serialize the entire context
const serialized = JSON.stringify(context);

// Save to database, localStorage, file, etc.
localStorage.setItem('conversation', serialized);

// Later: deserialize and continue the conversation
const restored: Context = JSON.parse(localStorage.getItem('conversation')!);
restored.messages.push({ role: 'user', content: 'Tell me more about its type system', timestamp: Date.now() });

// Continue with any model
const newModel = models.getModel('anthropic', 'claude-3-5-haiku-20241022')!;
const continuation = await models.complete(newModel, restored);
```

Models are plain serializable data too — no functions or implementations attached — so persisting "which model was this conversation using" is a `JSON.stringify` away.
模型本身也是可序列化的纯数据——不附带任何函数或实现——因此保存“这段对话使用的是哪个模型”只需一次 `JSON.stringify`。

> **Note**: If the context contains images (encoded as base64 as shown in the Image Input section), those will also be serialized.
> **注意**：如果上下文中包含图像（如图像输入一节所示，以 base64 编码），它们同样会被序列化。

## Browser Usage 浏览器中使用

The library supports browser environments. The core entrypoint and provider factories are side-effect free and bundle cleanly. Environment variables are not available in browsers, so pass API keys explicitly — or inject a `CredentialStore` (e.g. localStorage-backed) and let provider auth resolve from stored credentials:
本库支持浏览器环境。核心入口和 provider 工厂函数没有副作用，能够干净地打包。浏览器中无法使用环境变量，因此请显式传入 API key——或者注入一个 `CredentialStore`（例如基于 localStorage 的实现），让 provider 鉴权从已存储的凭据中解析：

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';

const models = createModels();
models.setProvider(anthropicProvider());

const model = models.getModel('anthropic', 'claude-3-5-haiku-20241022')!;
const response = await models.complete(model, {
  messages: [{ role: 'user', content: 'Hello!', timestamp: Date.now() }]
}, {
  apiKey: 'your-api-key'
});
```

> **Security Warning**: Exposing API keys in frontend code is dangerous. Anyone can extract and abuse your keys. Only use this approach for internal tools or demos. For production applications, use a backend proxy that keeps your API keys secure.
> **安全警告**：在前端代码中暴露 API key 非常危险，任何人都可以提取并滥用你的 key。仅在内部工具或演示中使用这种方式。生产应用请使用后端代理，妥善保护你的 API key。

Browser compatibility notes:
浏览器兼容性说明：

- Amazon Bedrock (`bedrock-converse-stream`) is not supported in browser environments. It can still appear in model lists; calls fail at runtime.
  浏览器环境不支持 Amazon Bedrock（`bedrock-converse-stream`）。它仍会出现在模型列表中，但调用会在运行时失败。
- OAuth login flows are Node-only. They are lazy-loaded behind bundler-opaque imports, so registering an OAuth-capable provider does not pull Node-only code into a browser bundle — only actually logging in would.
  OAuth 登录流程仅限 Node。它们通过打包工具无法静态分析的导入惰性加载，因此注册一个支持 OAuth 的 provider 并不会把仅限 Node 的代码带入浏览器打包产物——只有真正执行登录时才会。
- Use a server-side proxy or backend service if you need Bedrock or OAuth-based auth from a web app.
  如果 Web 应用需要 Bedrock 或基于 OAuth 的鉴权，请使用服务端代理或后端服务。

## Bundling and Tree Shaking 打包与 Tree Shaking

For small bundles, import only the providers you need:
若要减小打包体积，请只导入你需要的 provider：

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';

const models = createModels();
models.setProvider(openaiProvider());
```

Rules:
规则：

- `@earendil-works/pi-ai` is the core entrypoint and does not import built-in catalogs, provider factories, or SDK implementations.
  `@earendil-works/pi-ai` 是核心入口，不会导入内置模型目录、provider 工厂函数或 SDK 实现。
- `@earendil-works/pi-ai/providers/<provider>` imports that provider's catalog and lazy API wrapper only.
  `@earendil-works/pi-ai/providers/<provider>` 只导入该 provider 的模型目录和惰性 API 包装层。
- `@earendil-works/pi-ai/providers/all` imports every built-in provider factory and all catalogs. Use it only when you want the full built-in set.
  `@earendil-works/pi-ai/providers/all` 会导入全部内置 provider 工厂函数和所有模型目录。只在你确实需要完整内置集合时才使用它。
- With code splitting, provider SDKs stay in lazy chunks and load on first request.
  启用代码分割时，各 provider 的 SDK 会留在惰性 chunk 中，首次请求时才加载。
- Without code splitting, bundlers fold reachable lazy API implementations into the single bundle. A single-provider bundle then includes that provider's SDK; `providers/all` includes all statically visible SDKs. Bedrock is the exception: its AWS SDK implementation is loaded through a bundler-opaque Node-only import.
  没有代码分割时，打包工具会把可达的惰性 API 实现并入单个 bundle。此时单 provider 的 bundle 会包含该 provider 的 SDK；`providers/all` 则包含所有静态可见的 SDK。Bedrock 是例外：它的 AWS SDK 实现通过打包工具无法静态分析、且仅限 Node 的导入加载。
- Importing `@earendil-works/pi-ai/api/<api-id>` directly loads that API implementation and its SDK immediately.
  直接导入 `@earendil-works/pi-ai/api/<api-id>` 会立即加载该 API 实现及其 SDK。

Avoid `@earendil-works/pi-ai/compat` in new bundled apps; it preserves the old global API and imports the full built-in catalog surface.
在新的打包应用中请避免使用 `@earendil-works/pi-ai/compat`；它保留了旧的全局 API，并会导入完整的内置模型目录。

For single-file Node ESM bundles, some SDK dependencies may still use dynamic CommonJS `require()` internally. If you see errors such as `Dynamic require of "child_process" is not supported`, add a Node `require` shim to the bundle. With esbuild:
对于单文件的 Node ESM bundle，某些 SDK 依赖内部可能仍会使用动态的 CommonJS `require()`。如果你看到诸如 `Dynamic require of "child_process" is not supported` 的错误，请为 bundle 添加一个 Node `require` 垫片。以 esbuild 为例：

```bash
esbuild app.js --bundle --platform=node --format=esm \
  --banner:js='import { createRequire } from "module";const require = createRequire(import.meta.url);' \
  --outfile=app.bundle.js
```

This is only for Node bundles; it is not a browser or Cloudflare Workers workaround.
这仅适用于 Node bundle，并不是浏览器或 Cloudflare Workers 的解决方案。

Bedrock is Node-only. Add it like any other provider:
Bedrock 仅限 Node。像添加其他 provider 一样添加它即可：

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { amazonBedrockProvider } from '@earendil-works/pi-ai/providers/amazon-bedrock';

const models = createModels();
models.setProvider(amazonBedrockProvider());
```

In normal Node package usage and code-split bundles, Bedrock loads its AWS SDK implementation lazily. For a standalone single-file bundle that must include Bedrock support, register the implementation module explicitly:
在常规的 Node 包使用方式和启用代码分割的 bundle 中，Bedrock 会惰性加载其 AWS SDK 实现。如果是必须内置 Bedrock 支持的独立单文件 bundle，请显式注册该实现模块：

```typescript
import { setBedrockProviderModule } from '@earendil-works/pi-ai/api/bedrock-converse-stream.lazy';
import { bedrockProviderModule } from '@earendil-works/pi-ai/bedrock-provider';

setBedrockProviderModule(bedrockProviderModule);
```

That explicit override bundles the AWS SDK. Without it, Bedrock's opaque runtime import expects the package's Bedrock implementation file to be available at runtime.
这种显式覆盖会把 AWS SDK 打进 bundle。若不这样做，Bedrock 那个不透明的运行时导入会要求本包的 Bedrock 实现文件在运行时可用。

### Provider-Scoped Environment Overrides provider 级环境变量覆盖

Pass `env` in stream options to scope provider configuration to a request. Values in `env` are used before process environment variables for provider auth and configuration such as Cloudflare account IDs, Azure OpenAI settings, Vertex project/location, Bedrock settings, `PI_CACHE_RETENTION`, and `HTTP_PROXY`/`HTTPS_PROXY`.
在流式选项中传入 `env`，可以把 provider 配置限定在单次请求范围内。对于 provider 鉴权与配置（如 Cloudflare account ID、Azure OpenAI 设置、Vertex 的 project/location、Bedrock 设置、`PI_CACHE_RETENTION` 以及 `HTTP_PROXY`/`HTTPS_PROXY`），`env` 中的值优先于进程环境变量。

```typescript
const models = builtinModels();
const model = models.getModel('cloudflare-ai-gateway', 'workers-ai/@cf/moonshotai/kimi-k2.6')!;

const response = await models.complete(model, context, {
  env: {
    CLOUDFLARE_API_KEY: '...',
    CLOUDFLARE_ACCOUNT_ID: 'account-id',
    CLOUDFLARE_GATEWAY_ID: 'gateway-id'
  }
});
```

Use this when one process needs different provider settings per request, or when ambient environment variables should not leak into a provider call.
当同一个进程需要为不同请求使用不同的 provider 设置，或者不希望环境中的变量泄漏到某次 provider 调用中时，请使用该选项。

## OAuth Providers 支持 OAuth 的 provider

Several providers support OAuth authentication instead of static API keys:
有若干 provider 支持使用 OAuth 鉴权来替代静态 API key：

- **Anthropic** (Claude Pro/Max subscription)
  （Claude Pro/Max 订阅）
- **OpenAI Codex** (ChatGPT Plus/Pro subscription, access to GPT-5.x Codex models)
  （ChatGPT Plus/Pro 订阅，可访问 GPT-5.x Codex 模型）
- **GitHub Copilot** (Copilot subscription)
  （Copilot 订阅）
- **OpenRouter** (OAuth PKCE that mints a user-controlled API key)
  （OAuth PKCE 流程，签发一个由用户掌控的 API key）

Each of these providers carries an `OAuthAuth` on `provider.auth.oauth` with three operations: `login(interaction)` uses the provider-neutral `AuthInteraction.prompt()`/`notify()` protocol and returns a credential, `refresh(credential)` refreshes expiring credentials when applicable, and `toAuth(credential)` derives request auth (GitHub Copilot's per-account base URL comes from here). Refresh is automatic: `models.getAuth(providerId)` and request paths refresh expired tokens under a credential-store lock, so concurrent requests and processes cannot double-refresh. OpenRouter's OAuth flow instead returns a permanent API key, so its refresh operation is a no-op.
这些 provider 都在 `provider.auth.oauth` 上带有一个 `OAuthAuth`，包含三个操作：`login(interaction)` 使用与 provider 无关的 `AuthInteraction.prompt()`/`notify()` 协议并返回凭据；`refresh(credential)` 在适用时刷新即将过期的凭据；`toAuth(credential)` 推导出请求鉴权信息（GitHub Copilot 按账号区分的 base URL 就来自这里）。刷新是自动的：`models.getAuth(providerId)` 和请求路径会在凭据存储锁的保护下刷新过期 token，因此并发的请求和进程不会重复刷新。OpenRouter 的 OAuth 流程返回的是一个永久 API key，所以它的 refresh 操作是空操作。

```typescript
import { createModels } from '@earendil-works/pi-ai';
import { anthropicProvider } from '@earendil-works/pi-ai/providers/anthropic';

const models = createModels({ credentials: myStore }); // persistent CredentialStore
models.setProvider(anthropicProvider());

// Login: Models drives the flow and persists the credential
await models.login('anthropic', 'oauth', {
  prompt: async (p) => {
    // p.type: 'text' | 'secret' | 'select' | 'manual_code'
    // manual_code prompts race a local callback server; p.signal aborts them when the server wins
    return await askUser(p.message);
  },
  notify: (event) => {
    // event.type: 'info' | 'auth_url' | 'device_code' | 'progress'
    if (event.type === 'info') {
      console.log(event.message);
      for (const link of event.links ?? []) console.log(`${link.label ?? 'More information'}: ${link.url}`);
    }
    if (event.type === 'auth_url') console.log(`Open: ${event.url}`);
    if (event.type === 'device_code') console.log(`Code: ${event.userCode} at ${event.verificationUri}`);
    if (event.type === 'progress') console.log(event.message);
  },
});

// From here on, requests resolve and refresh the token automatically
const model = models.getModel('anthropic', 'claude-sonnet-4-5')!;
await models.complete(model, context);

// Logout
await models.logout('anthropic');
```

### Vertex AI

Vertex AI models support either a Google Cloud API key or Application Default Credentials (ADC). Its provider-owned API-key login flow can configure either method:
Vertex AI 模型既支持 Google Cloud API key，也支持 Application Default Credentials（ADC）。其 provider 自带的 API key 登录流程可以配置这两种方式中的任意一种：

- **API key**: Set `GOOGLE_CLOUD_API_KEY` or pass `apiKey` in the call options.
  **API key**：设置 `GOOGLE_CLOUD_API_KEY`，或在调用选项中传入 `apiKey`。
- **Local development (ADC)**: Run `gcloud auth application-default login`
  **本地开发（ADC）**：运行 `gcloud auth application-default login`
- **CI/Production (ADC)**: Set `GOOGLE_APPLICATION_CREDENTIALS` to point to a service account JSON key file
  **CI/生产环境（ADC）**：把 `GOOGLE_APPLICATION_CREDENTIALS` 指向服务账号的 JSON key 文件

When using ADC, also set `GOOGLE_CLOUD_PROJECT` (or `GCLOUD_PROJECT`) and `GOOGLE_CLOUD_LOCATION`. You can also pass `project`/`location` in the call options. When using `GOOGLE_CLOUD_API_KEY`, `project` and `location` are not required.
使用 ADC 时，还需设置 `GOOGLE_CLOUD_PROJECT`（或 `GCLOUD_PROJECT`）和 `GOOGLE_CLOUD_LOCATION`。你也可以在调用选项中传入 `project`/`location`。使用 `GOOGLE_CLOUD_API_KEY` 时则无需 `project` 和 `location`。

```bash
# Local (uses your user credentials)
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT="my-project"
export GOOGLE_CLOUD_LOCATION="us-central1"

# CI/Production (service account key file)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
```

Official docs: [Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)
官方文档：[Application Default Credentials](https://cloud.google.com/docs/authentication/application-default-credentials)

### CLI Login 命令行登录

The quickest way to authenticate:
最快捷的鉴权方式：

```bash
npx @earendil-works/pi-ai login              # interactive provider selection
npx @earendil-works/pi-ai login anthropic    # login to specific provider
npx @earendil-works/pi-ai list               # list available providers
```

Credentials are saved to `auth.json` in the current directory.
凭据会保存到当前目录下的 `auth.json` 中。

### Programmatic OAuth 以编程方式进行 OAuth

Built-in login and refresh flows are private provider implementations. Use provider-owned `OAuthAuth`, which composes with `CredentialStore` and gets locked auto-refresh through `Models`. The `@earendil-works/pi-ai/oauth` entry point retains only type declarations required by coding-agent extension OAuth compatibility.
内置的登录与刷新流程属于 provider 的私有实现。请使用 provider 自带的 `OAuthAuth`，它可与 `CredentialStore` 组合，并通过 `Models` 获得带锁的自动刷新能力。`@earendil-works/pi-ai/oauth` 入口仅保留编码 agent 扩展 OAuth 兼容所需的类型声明。

Provider notes:
各 provider 说明：

**OpenAI Codex**: Requires a ChatGPT Plus or Pro subscription. Provides access to GPT-5.x Codex models with extended context windows and reasoning capabilities. The library automatically handles session-based prompt caching when `sessionId` is provided in stream options unless `cacheRetention` is `"none"`. You can set `transport` in stream options to `"sse"`, `"websocket"`, or `"auto"` for Codex Responses transport selection. When using WebSocket with a `sessionId` and cache retention enabled, connections are reused per session and expire after 5 minutes of inactivity.
**OpenAI Codex**：需要 ChatGPT Plus 或 Pro 订阅。可访问具备更大上下文窗口和推理能力的 GPT-5.x Codex 模型。当流式选项中提供了 `sessionId` 且 `cacheRetention` 不为 `"none"` 时，本库会自动处理基于会话的提示缓存。你可以把流式选项中的 `transport` 设为 `"sse"`、`"websocket"` 或 `"auto"` 来选择 Codex Responses 的传输方式。使用 WebSocket 且带有 `sessionId` 并启用缓存保留时，连接会按会话复用，并在空闲 5 分钟后过期。

**Azure OpenAI (Responses)**: Uses the Responses API only. Set `AZURE_OPENAI_API_KEY` and either `AZURE_OPENAI_BASE_URL` or `AZURE_OPENAI_RESOURCE_NAME`. `AZURE_OPENAI_BASE_URL` supports both `https://<resource>.openai.azure.com` and `https://<resource>.cognitiveservices.azure.com`; root endpoints are normalized to `.../openai/v1` automatically. Use `AZURE_OPENAI_API_VERSION` (defaults to `v1`) to override the API version if needed. Deployment names are treated as model IDs by default, override with `azureDeploymentName` or `AZURE_OPENAI_DEPLOYMENT_NAME_MAP` using comma-separated `model-id=deployment` pairs (for example `gpt-4o-mini=my-deployment,gpt-4o=prod`). Legacy deployment-based URLs are intentionally unsupported.
**Azure OpenAI (Responses)**：仅使用 Responses API。需设置 `AZURE_OPENAI_API_KEY`，并设置 `AZURE_OPENAI_BASE_URL` 或 `AZURE_OPENAI_RESOURCE_NAME` 之一。`AZURE_OPENAI_BASE_URL` 同时支持 `https://<resource>.openai.azure.com` 和 `https://<resource>.cognitiveservices.azure.com`；根端点会自动规范化为 `.../openai/v1`。如需覆盖 API 版本，可使用 `AZURE_OPENAI_API_VERSION`（默认 `v1`）。部署名（deployment name）默认按模型 ID 处理，可通过 `azureDeploymentName` 或 `AZURE_OPENAI_DEPLOYMENT_NAME_MAP` 覆盖，后者使用逗号分隔的 `model-id=deployment` 键值对（例如 `gpt-4o-mini=my-deployment,gpt-4o=prod`）。旧式基于 deployment 的 URL 有意不予支持。

**GitHub Copilot**: If you get "The requested model is not supported" error, enable the model manually in VS Code: open Copilot Chat, click the model selector, select the model (warning icon), and click "Enable".
**GitHub Copilot**：如果遇到 "The requested model is not supported" 错误，请在 VS Code 中手动启用该模型：打开 Copilot Chat，点击模型选择器，选中该模型（带警告图标），然后点击 "Enable"。

## Migrating from the Old Global API 从旧的全局 API 迁移

Older versions exposed a global API: `stream()`/`complete()` dispatching on `model.api` via a global registry, sync `getModel()`/`getModels()`/`getProviders()` catalog reads, `registerApiProvider()`, `getEnvApiKey()`, and per-API lazy stream functions. That surface lives unchanged on the **compat entrypoint**:
旧版本暴露的是一套全局 API：通过全局注册表按 `model.api` 分发的 `stream()`/`complete()`、同步的目录读取 `getModel()`/`getModels()`/`getProviders()`、`registerApiProvider()`、`getEnvApiKey()` 以及按 API 划分的惰性 stream 函数。这套 API 原封不动地保留在 **compat 入口**中：

```typescript
// Before
import { getModel, complete } from '@earendil-works/pi-ai';

// After (verbatim behavior, one import-path change)
import { getModel, complete } from '@earendil-works/pi-ai/compat';
```

Compat is a strict superset of the root entrypoint, so a file can switch its import path wholesale. It will be removed in a future release; migrate to `createModels()` + provider factories:
compat 是根入口的严格超集，因此一个文件可以整体切换导入路径。它会在未来版本中移除；请迁移到 `createModels()` + provider 工厂函数：

| Old<br>旧写法 | New<br>新写法 |
|-----|-----|
| `getModel('openai', 'gpt-4o-mini')` | `models.getModel('openai', 'gpt-4o-mini')` or `getBuiltinModel()` from `providers/all`<br>`models.getModel('openai', 'gpt-4o-mini')`，或来自 `providers/all` 的 `getBuiltinModel()` |
| `getModels('anthropic')` / `getProviders()` | `models.getModels('anthropic')` / `models.getProviders()` or `getBuiltin*`<br>`models.getModels('anthropic')` / `models.getProviders()`，或 `getBuiltin*` |
| `stream(model, ctx, opts)` (env-key injection)<br>`stream(model, ctx, opts)`（注入环境变量中的 key） | `models.stream(model, ctx, opts)` (provider auth resolution)<br>`models.stream(model, ctx, opts)`（由 provider 解析鉴权） |
| `registerApiProvider({ api, stream, streamSimple })` | `createProvider({ id, auth, models, api })` + `models.setProvider()` |
| `getEnvApiKey('openai')` | `await models.getAuth(model.provider)` |
| `streamAnthropic(model, ctx, opts)` | `stream` from `@earendil-works/pi-ai/api/anthropic-messages`, or a provider in a collection<br>使用来自 `@earendil-works/pi-ai/api/anthropic-messages` 的 `stream`，或集合中的某个 provider |
| `registerFauxProvider()` | `fauxProvider()` + `models.setProvider()` |

## Development 开发

### Adding a New Provider 新增一个 provider

Adding a new LLM provider requires changes across multiple files. The layered layout: API implementations live in `src/api/`, provider factories in `src/providers/`, stable generated catalog wrappers live in `src/providers/<id>.models.ts`, and `src/models.generated.ts` registers them. This checklist covers all necessary steps:
新增一个 LLM provider 需要改动多个文件。分层结构如下：API 实现位于 `src/api/`，provider 工厂函数位于 `src/providers/`，稳定的生成目录包装层位于 `src/providers/<id>.models.ts`，并由 `src/models.generated.ts` 注册。下面的清单涵盖了全部必要步骤：

#### 1. Core Types (`src/types.ts`) 核心类型

- Add the API identifier to `KnownApi` (for example `"bedrock-converse-stream"`), if it is a new API
  如果是新的 API，把该 API 标识加入 `KnownApi`（例如 `"bedrock-converse-stream"`）
- Add the provider name to `KnownProvider` (for example `"amazon-bedrock"`)
  把 provider 名称加入 `KnownProvider`（例如 `"amazon-bedrock"`）
- Add the options type to `ApiOptionsMap`
  把选项类型加入 `ApiOptionsMap`

#### 2. API Implementation (`src/api/<api-id>.ts`, only for a new API) API 实现（仅新 API 需要）

Create a new API implementation file (for example `bedrock-converse-stream.ts`) that exports exactly `stream` and `streamSimple`, plus:
新建一个 API 实现文件（例如 `bedrock-converse-stream.ts`），正好导出 `stream` 和 `streamSimple`，并包含：

- An options interface extending `StreamOptions` (for example `BedrockOptions`)
  一个继承 `StreamOptions` 的选项接口（例如 `BedrockOptions`）
- Message conversion functions to transform `Context` to provider format
  把 `Context` 转换为 provider 格式的消息转换函数
- Tool conversion if the provider supports tools
  如果该 provider 支持工具，则需要工具转换逻辑
- Response parsing to emit standardized events (`text`, `tool_call`, `thinking`, `usage`, `stop`)
  响应解析逻辑，用于发出标准化事件（`text`、`tool_call`、`thinking`、`usage`、`stop`）

Add a lazy wrapper `src/api/<api-id>.lazy.ts` (`<name>Api()` via `lazyApi()`) so providers can reference the implementation without importing its SDK. Add any root-level `export type` re-exports in `src/index.ts` that should remain available from `@earendil-works/pi-ai`.
再添加一个惰性包装层 `src/api/<api-id>.lazy.ts`（通过 `lazyApi()` 实现的 `<name>Api()`），这样 provider 引用该实现时无需导入其 SDK。若某些类型需要继续从 `@earendil-works/pi-ai` 导出，请在 `src/index.ts` 中补上相应的根级 `export type` 重导出。

#### 3. Model Generation (`scripts/generate-models.ts`, `scripts/generate-image-models.ts`) 模型生成

- Add logic to fetch and parse models from the provider's source (e.g., models.dev API)
  添加从该 provider 数据源（例如 models.dev API）拉取并解析模型的逻辑
- Map chat/tool-capable provider model data to the standardized `Model` interface via `scripts/generate-models.ts`; hydration groups the ignored `src/providers/data/<id>.json` values by API, while stable `src/providers/<id>.models.ts` wrappers derive exact model/API types directly from those JSON keys
  通过 `scripts/generate-models.ts` 把支持对话/工具的 provider 模型数据映射到标准化的 `Model` 接口；hydration 会把被忽略的 `src/providers/data/<id>.json` 中的值按 API 分组，而稳定的 `src/providers/<id>.models.ts` 包装层则直接从这些 JSON 键推导出精确的模型/API 类型
- Map image-generation provider model data to the standardized `ImagesModel` interface via `scripts/generate-image-models.ts`
  通过 `scripts/generate-image-models.ts` 把图像生成 provider 的模型数据映射到标准化的 `ImagesModel` 接口
- Handle provider-specific quirks (pricing format, capability flags, model ID transformations)
  处理该 provider 的特殊之处（定价格式、能力标志、模型 ID 转换）

#### 4. Provider Factory (`src/providers/<id>.ts`) provider 工厂函数

- `createProvider()` wiring catalog + auth + the lazy API wrapper
  用 `createProvider()` 串联模型目录 + 鉴权 + 惰性 API 包装层
- Auth: `envApiKeyAuth` for standard key providers, a custom `ApiKeyAuth` for ambient auth (AWS profiles, ADC), `lazyOAuth` where an OAuth flow exists
  鉴权：标准 key 类 provider 使用 `envApiKeyAuth`，环境隐式鉴权（AWS profile、ADC）使用自定义的 `ApiKeyAuth`，存在 OAuth 流程时使用 `lazyOAuth`
- Register the factory in `src/providers/all.ts`
  在 `src/providers/all.ts` 中注册该工厂函数
- If it is a new API: register it in the builtin list in `src/compat.ts` and add the package subpath export in `package.json`
  如果是新的 API：在 `src/compat.ts` 的内置列表中注册它，并在 `package.json` 中添加对应的包子路径导出

#### 5. Tests (`test/`) 测试

Create or update test files to cover the new provider:
新建或更新测试文件以覆盖新的 provider：

- `stream.test.ts` - Basic streaming and tool use
  基本流式输出与工具使用
- `tokens.test.ts` - Token usage reporting
  token 用量上报
- `abort.test.ts` - Request cancellation
  请求取消
- `empty.test.ts` - Empty message handling
  空消息处理
- `context-overflow.test.ts` - Context limit errors
  上下文超限错误
- `image-limits.test.ts` - Image support (if applicable)
  图像支持（如适用）
- `unicode-surrogate.test.ts` - Unicode handling
  Unicode 处理
- `tool-call-without-result.test.ts` - Orphaned tool calls
  没有对应结果的孤立工具调用
- `image-tool-result.test.ts` - Images in tool results
  工具结果中的图像
- `total-tokens.test.ts` - Token counting accuracy
  token 计数准确性
- `cross-provider-handoff.test.ts` - Cross-provider context replay
  跨 provider 的上下文重放
- `providers.test.ts` - Provider listing and auth resolution
  provider 列举与鉴权解析

For `cross-provider-handoff.test.ts`, add at least one provider/model pair. If the provider exposes multiple model families (for example GPT and Claude), add at least one pair per family.
对于 `cross-provider-handoff.test.ts`，至少要添加一组 provider/模型组合。如果该 provider 提供多个模型系列（例如 GPT 和 Claude），则每个系列至少添加一组。

For providers with non-standard auth (AWS, Google Vertex), create a utility like `bedrock-utils.ts` with credential detection helpers.
对于鉴权方式非标准的 provider（AWS、Google Vertex），请创建类似 `bedrock-utils.ts` 的工具文件，提供凭据检测辅助函数。

#### 6. Coding Agent Integration (`../coding-agent/`) 与 coding agent 集成

Update `src/core/model-resolver.ts`:
更新 `src/core/model-resolver.ts`：

- Add a default model ID for the provider in `DEFAULT_MODELS`
  在 `DEFAULT_MODELS` 中为该 provider 添加一个默认模型 ID

Update `src/cli/args.ts`:
更新 `src/cli/args.ts`：

- Add environment variable documentation in the help text
  在帮助文本中补充环境变量说明

Update `README.md`:
更新 `README.md`：

- Add the provider to the providers section with setup instructions
  把该 provider 加入 provider 章节，并附上配置说明

#### 7. Documentation 文档

Update `packages/ai/README.md`:
更新 `packages/ai/README.md`：

- Add to the Supported Providers table
  加入支持的 provider 列表
- Document any provider-specific options or authentication requirements
  记录该 provider 专属的选项或鉴权要求
- Add environment variable to the Environment Variables section
  把环境变量补充到「环境变量」一节

#### 8. Changelog 变更日志

Add an entry to `packages/ai/CHANGELOG.md` under `## [Unreleased]`:
在 `packages/ai/CHANGELOG.md` 的 `## [Unreleased]` 下添加一条记录：

```markdown
### Added
- Added support for [Provider Name] provider ([#PR](link) by [@author](link))
```

## License 许可证

MIT
