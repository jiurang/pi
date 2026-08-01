# Custom Providers 自定义提供方

Extensions can register custom model providers via `pi.registerProvider()`. This enables:
扩展可以通过 `pi.registerProvider()` 注册自定义的模型提供方（provider）。这可以实现：

- **Proxies** - Route requests through corporate proxies or API gateways
  **代理（Proxies）** - 将请求路由到企业代理或 API 网关
- **Custom endpoints** - Use self-hosted or private model deployments
  **自定义端点（Custom endpoints）** - 使用自托管或私有的模型部署
- **OAuth/SSO** - Add authentication flows for enterprise providers
  **OAuth/SSO** - 为企业级提供方添加认证流程
- **Custom APIs** - Implement streaming for non-standard LLM APIs
  **自定义 API（Custom APIs）** - 为非标准的 LLM API 实现流式输出

## Example Extensions 示例扩展

See these complete provider examples:
可参考以下完整的提供方示例：

- [`examples/extensions/custom-provider-anthropic/`](../examples/extensions/custom-provider-anthropic/)
- [`examples/extensions/custom-provider-gitlab-duo/`](../examples/extensions/custom-provider-gitlab-duo/)

## Table of Contents 目录

- [Example Extensions](#example-extensions)
- [Quick Reference](#quick-reference)
- [Override Existing Provider](#override-existing-provider)
- [Register New Provider](#register-new-provider)
- [Unregister Provider](#unregister-provider)
- [OAuth Support](#oauth-support)
- [Custom Streaming API](#custom-streaming-api)
- [Context Overflow Errors](#context-overflow-errors)
- [Testing Your Implementation](#testing-your-implementation)
- [Config Reference](#config-reference)
- [Model Definition Reference](#model-definition-reference)

## Quick Reference 快速参考

Extensions can register either a complete pi-ai `Provider` or use the legacy provider-config form. Prefer a complete provider when custom authentication, filtering, refresh, or streaming behavior is required. Pi composes `models.json` overrides above registered native providers.
扩展既可以注册一个完整的 pi-ai `Provider`，也可以使用旧版的 provider-config 形式。当需要自定义认证、过滤、刷新或流式行为时，优先使用完整的 provider。Pi 会将 `models.json` 中的覆盖配置叠加在已注册的原生 provider 之上。

```typescript
import { createProvider, openAICompletionsApi } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerProvider(createProvider({
    id: "native-local",
    name: "Native Local",
    baseUrl: "http://localhost:8080/v1",
    auth: {
      apiKey: {
        name: "Local server API key",
        async login(interaction) {
          return {
            type: "api_key",
            key: await interaction.prompt({ type: "secret", message: "API key" })
          };
        },
        async resolve({ credential }) {
          return credential?.key
            ? { auth: { apiKey: credential.key }, source: "stored API key" }
            : undefined;
        }
      }
    },
    models: [],
    api: openAICompletionsApi()
  }));

  // Legacy provider-config form:
  // Override baseUrl for existing provider
  pi.registerProvider("anthropic", {
    baseUrl: "https://proxy.example.com"
  });

  // Register new provider with models
  pi.registerProvider("my-provider", {
    name: "My Provider",
    baseUrl: "https://api.example.com",
    apiKey: "$MY_API_KEY",
    api: "openai-completions",
    models: [
      {
        id: "my-model",
        name: "My Model",
        reasoning: false,
        input: ["text", "image"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 4096
      }
    ]
  });
}
```

The extension factory can also be `async`. For dynamic model discovery, fetch and register models in the factory instead of `session_start`. pi waits for the factory before startup continues, so the provider is available during interactive startup and to `pi --list-models`.
扩展工厂函数也可以是 `async` 的。如需动态发现模型，请在工厂函数中拉取并注册模型，而不要放在 `session_start` 中。pi 会等待工厂函数完成后才继续启动流程，因此该 provider 在交互式启动期间以及对 `pi --list-models` 都是可用的。

## Override Existing Provider 覆盖已有提供方

The simplest use case: redirect an existing provider through a proxy.
最简单的用法：将已有的 provider 重定向到代理。

```typescript
// All Anthropic requests now go through your proxy
pi.registerProvider("anthropic", {
  baseUrl: "https://proxy.example.com"
});

// Add custom headers to OpenAI requests
pi.registerProvider("openai", {
  headers: {
    "X-Custom-Header": "value"
  }
});

// Both baseUrl and headers
pi.registerProvider("google", {
  baseUrl: "https://ai-gateway.corp.com/google",
  headers: {
    "X-Corp-Auth": "$CORP_AUTH_TOKEN"  // env var or literal
  }
});
```

When only `baseUrl` and/or `headers` are provided (no `models`), all existing models for that provider are preserved with the new endpoint.
当只提供了 `baseUrl` 和/或 `headers`（未提供 `models`）时，该 provider 现有的全部模型都会被保留，并使用新的端点。

## Register New Provider 注册新提供方

To add a completely new provider, specify `models` along with the required configuration.
要添加一个全新的 provider，需要在必要配置之外同时指定 `models`。

If the model list comes from a remote endpoint, use an async extension factory:
如果模型列表来自远程端点，请使用异步的扩展工厂函数：

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  const response = await fetch("http://localhost:1234/v1/models");
  const payload = (await response.json()) as {
    data: Array<{
      id: string;
      name?: string;
      context_window?: number;
      max_tokens?: number;
    }>;
  };

  pi.registerProvider("local-openai", {
    baseUrl: "http://localhost:1234/v1",
    apiKey: "$LOCAL_OPENAI_API_KEY",
    api: "openai-completions",
    models: payload.data.map((model) => ({
      id: model.id,
      name: model.name ?? model.id,
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: model.context_window ?? 128000,
      maxTokens: model.max_tokens ?? 4096,
    })),
  });
}
```

This registers the fetched models before startup finishes.
这样会在启动流程结束前完成已拉取模型的注册。

```typescript
pi.registerProvider("my-llm", {
  baseUrl: "https://api.my-llm.com/v1",
  apiKey: "$MY_LLM_API_KEY",  // env var reference
  api: "openai-completions",  // which streaming API to use
  models: [
    {
      id: "my-llm-large",
      name: "My LLM Large",
      reasoning: true,        // supports extended thinking
      input: ["text", "image"],
      cost: {
        input: 3.0,           // $/million tokens
        output: 15.0,
        cacheRead: 0.3,
        cacheWrite: 3.75
      },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});
```

When `models` is provided, it **replaces** all existing models for that provider.
当提供了 `models` 时，它会**替换**该 provider 现有的全部模型。

`apiKey` and custom header values use the same config value syntax as `models.json`: `!command` at the start executes a command for the whole value, `$ENV_VAR` and `${ENV_VAR}` interpolate environment variables, `$$` emits a literal `$`, and `$!` emits a literal `!`.
`apiKey` 和自定义请求头的值使用与 `models.json` 相同的配置值语法：开头的 `!command` 会执行命令并将其输出作为整个值，`$ENV_VAR` 和 `${ENV_VAR}` 会插值环境变量，`$$` 输出字面量 `$`，`$!` 输出字面量 `!`。

## Unregister Provider 注销提供方

Use `pi.unregisterProvider(name)` to remove a provider that was previously registered via `pi.registerProvider(name, ...)`:
使用 `pi.unregisterProvider(name)` 可以移除此前通过 `pi.registerProvider(name, ...)` 注册的 provider：

```typescript
// Register
pi.registerProvider("my-llm", {
  baseUrl: "https://api.my-llm.com/v1",
  apiKey: "$MY_LLM_API_KEY",
  api: "openai-completions",
  models: [
    {
      id: "my-llm-large",
      name: "My LLM Large",
      reasoning: true,
      input: ["text", "image"],
      cost: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
      contextWindow: 200000,
      maxTokens: 16384
    }
  ]
});

// Later, remove it
pi.unregisterProvider("my-llm");
```

Unregistering removes that provider's dynamic models, API key fallback, OAuth provider registration, and custom stream handler registrations. Any built-in models or provider behavior that were overridden are restored.
注销会移除该 provider 的动态模型、API key 回退、OAuth provider 注册以及自定义流处理器注册。此前被覆盖的内置模型或 provider 行为都会恢复。

Calls made after the initial extension load phase are applied immediately, so no `/reload` is required.
在初始扩展加载阶段之后发起的调用会立即生效，因此无需执行 `/reload`。

### API Types API 类型

The `api` field determines which streaming implementation is used:
`api` 字段决定使用哪一种流式实现：

| API | Use for<br>适用场景 |
|-----|---------|
| `anthropic-messages` | Anthropic Claude API and compatibles<br>Anthropic Claude API 及其兼容实现 |
| `openai-completions` | OpenAI Chat Completions API and compatibles<br>OpenAI Chat Completions API 及其兼容实现 |
| `openai-responses` | OpenAI Responses API<br>OpenAI Responses API（响应式接口） |
| `azure-openai-responses` | Azure OpenAI Responses API<br>Azure 上的 OpenAI Responses API |
| `openai-codex-responses` | OpenAI Codex Responses API<br>OpenAI Codex 的 Responses API |
| `mistral-conversations` | Mistral SDK Conversations/Chat streaming<br>Mistral SDK 的 Conversations/Chat 流式接口 |
| `google-generative-ai` | Google Generative AI API<br>Google Generative AI 接口 |
| `google-vertex` | Google Vertex AI API<br>Google Vertex AI 接口 |
| `bedrock-converse-stream` | Amazon Bedrock Converse API<br>Amazon Bedrock 的 Converse 接口 |

Most OpenAI-compatible providers work with `openai-completions`. Use model-level `thinkingLevelMap` for model-specific thinking levels, and `compat` for provider quirks. The `xhigh` and `max` levels are opt-in, require non-null map entries, and may be separated by unsupported holes:
大多数 OpenAI 兼容的 provider 都可以使用 `openai-completions`。对于模型特有的思考级别，请使用模型级的 `thinkingLevelMap`；对于 provider 的特殊行为差异，请使用 `compat`。`xhigh` 和 `max` 级别需要显式启用，映射表中的对应项必须为非 null，并且中间允许存在不受支持的“空档”：

```typescript
models: [{
  id: "custom-model",
  // ...
  reasoning: true,
  thinkingLevelMap: {              // map pi levels to provider values; null hides unsupported levels
    minimal: null,
    low: null,
    medium: null,
    high: "default",
    xhigh: null,
    max: "max"
  },
  compat: {
    supportsDeveloperRole: false,   // use "system" instead of "developer"
    supportsReasoningEffort: true,
    maxTokensField: "max_tokens",   // instead of "max_completion_tokens"
    requiresToolResultName: true,   // tool results need name field
    thinkingFormat: "qwen",        // top-level enable_thinking: true
    cacheControlFormat: "anthropic" // Anthropic-style cache_control markers
  }
}]
```

Use `openrouter` for OpenRouter-style `reasoning: { effort }` controls. Use `together` for Together-style `reasoning: { enabled }` controls; with `supportsReasoningEffort`, it also sends `reasoning_effort`. Use `qwen-chat-template` for local Qwen-compatible servers that read `chat_template_kwargs.enable_thinking` and need `preserve_thinking`.
对于 OpenRouter 风格的 `reasoning: { effort }` 控制，使用 `openrouter`。对于 Together 风格的 `reasoning: { enabled }` 控制，使用 `together`；若同时启用 `supportsReasoningEffort`，还会额外发送 `reasoning_effort`。对于读取 `chat_template_kwargs.enable_thinking` 且需要 `preserve_thinking` 的本地 Qwen 兼容服务，使用 `qwen-chat-template`。
Use `cacheControlFormat: "anthropic"` for OpenAI-compatible providers that expose Anthropic-style prompt caching via `cache_control` on the system prompt, last tool definition, and last user, assistant, or tool-result text content.
对于通过在系统提示词、最后一个工具定义以及最后一条用户、助手或工具结果文本内容上添加 `cache_control` 来提供 Anthropic 风格提示词缓存的 OpenAI 兼容 provider，使用 `cacheControlFormat: "anthropic"`。

For Anthropic-compatible providers using `api: "anthropic-messages"`, set `compat.forceAdaptiveThinking: true` on models or providers whose upstream model requires adaptive thinking (`thinking.type: "adaptive"` plus `output_config.effort`). Built-in adaptive Claude models set this automatically. Set `compat.allowEmptySignature: true` only for providers that emit empty thinking signatures and expect `signature: ""` on replay.
对于使用 `api: "anthropic-messages"` 的 Anthropic 兼容 provider，如果其上游模型要求自适应思考（`thinking.type: "adaptive"` 加上 `output_config.effort`），请在相应模型或 provider 上设置 `compat.forceAdaptiveThinking: true`。内置的自适应 Claude 模型会自动设置该项。仅当 provider 会输出空的 thinking 签名并且在重放时期望 `signature: ""` 时，才设置 `compat.allowEmptySignature: true`。

> Migration note: Mistral moved from `openai-completions` to `mistral-conversations`.
> 迁移说明：Mistral 已从 `openai-completions` 迁移到 `mistral-conversations`。
> Use `mistral-conversations` for native Mistral models.
> 原生 Mistral 模型请使用 `mistral-conversations`。
> If you intentionally route Mistral-compatible/custom endpoints through `openai-completions`, set `compat` flags explicitly as needed.
> 如果你有意将 Mistral 兼容/自定义端点通过 `openai-completions` 路由，请按需显式设置 `compat` 标志。

### Auth Header 认证请求头

If your provider expects `Authorization: Bearer <key>` but doesn't use a standard API, set `authHeader: true`:
如果你的 provider 需要 `Authorization: Bearer <key>` 但并未使用标准 API，请设置 `authHeader: true`：

```typescript
pi.registerProvider("custom-api", {
  baseUrl: "https://api.example.com",
  apiKey: "$MY_API_KEY",
  authHeader: true,  // adds Authorization: Bearer header
  api: "openai-completions",
  models: [...]
});
```

The key is resolved for each request. An explicit request `Authorization` header takes precedence over the generated value.
该密钥会在每次请求时解析。请求中显式设置的 `Authorization` 请求头优先于自动生成的值。

## OAuth Support OAuth 支持

Add OAuth/SSO authentication that integrates with `/login`:
添加与 `/login` 集成的 OAuth/SSO 认证：

```typescript
import type { OAuthCredentials, OAuthLoginCallbacks } from "@earendil-works/pi-ai";

pi.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com/v1",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "Corporate AI (SSO)",

    async login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials> {
      const method = await callbacks.onSelect({
        message: "Select login method:",
        options: [
          { id: "browser", label: "Browser OAuth" },
          { id: "device", label: "Device code" }
        ]
      });
      if (!method) throw new Error("Login cancelled");

      let code: string;
      if (method === "device") {
        callbacks.onDeviceCode({
          userCode: "ABCD-1234",
          verificationUri: "https://sso.corp.com/device",
          intervalSeconds: 5,
          expiresInSeconds: 900
        });
        code = await pollDeviceCodeUntilComplete();
      } else {
        callbacks.onAuth({ url: "https://sso.corp.com/authorize?..." });
        code = await callbacks.onPrompt({ message: "Enter SSO code:" });
      }

      // Exchange for tokens (your implementation)
      const tokens = await exchangeCodeForTokens(code);

      return {
        refresh: tokens.refreshToken,
        access: tokens.accessToken,
        expires: Date.now() + tokens.expiresIn * 1000
      };
    },

    async refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials> {
      const tokens = await refreshAccessToken(credentials.refresh);
      return {
        refresh: tokens.refreshToken ?? credentials.refresh,
        access: tokens.accessToken,
        expires: Date.now() + tokens.expiresIn * 1000
      };
    },

    getApiKey(credentials: OAuthCredentials): string {
      return credentials.access;
    }
  }
});
```

After registration, users can authenticate via `/login corporate-ai`.
注册完成后，用户可以通过 `/login corporate-ai` 进行认证。

### OAuthLoginCallbacks 登录回调接口

The `callbacks` object provides UI-neutral interactions for the provider-owned flow:
`callbacks` 对象为 provider 自有的认证流程提供与 UI 无关的交互能力：

```typescript
interface OAuthLoginCallbacks {
  // Open URL in browser (for OAuth redirects)
  onAuth(params: { url: string }): void;

  // Show device code (for device authorization flow)
  onDeviceCode(params: {
    userCode: string;
    verificationUri: string;
    intervalSeconds?: number;
    expiresInSeconds?: number;
  }): void;

  // Show transient progress
  onProgress?(message: string): void;

  // Prompt user for input (for manual token entry)
  onPrompt(params: { message: string }): Promise<string>;

  // Show an interactive selector, e.g. to choose browser OAuth vs device code
  onSelect(params: {
    message: string;
    options: { id: string; label: string }[];
  }): Promise<string | undefined>;
}
```

### OAuthCredentials 凭据结构

Credentials are persisted in `~/.pi/agent/auth.json`:
凭据会持久化保存在 `~/.pi/agent/auth.json` 中：

```typescript
interface OAuthCredentials {
  refresh: string;   // Refresh token (for refreshToken())
  access: string;    // Access token (returned by getApiKey())
  expires: number;   // Expiration timestamp in milliseconds
}
```

## Custom Streaming API 自定义流式 API

For providers with non-standard APIs, implement `streamSimple`. Study the existing provider implementations before writing your own:
对于 API 非标准的 provider，请实现 `streamSimple`。在自行编写之前，建议先研究现有的 provider 实现：

**Reference implementations:**
**参考实现：**
- [anthropic.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/anthropic.ts) - Anthropic Messages API
  Anthropic Messages API 的实现
- [mistral.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/mistral.ts) - Mistral Conversations API
  Mistral Conversations API 的实现
- [openai-completions.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/openai-completions.ts) - OpenAI Chat Completions
  OpenAI Chat Completions 的实现
- [openai-responses.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/openai-responses.ts) - OpenAI Responses API
  OpenAI Responses API 的实现
- [google.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/google.ts) - Google Generative AI
  Google Generative AI 的实现
- [amazon-bedrock.ts](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/providers/amazon-bedrock.ts) - AWS Bedrock
  AWS Bedrock 的实现

### Stream Pattern 流式模式

All providers follow the same pattern:
所有 provider 都遵循相同的模式：

```typescript
import {
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  type Model,
  type SimpleStreamOptions,
  calculateCost,
  createAssistantMessageEventStream,
} from "@earendil-works/pi-ai";

function streamMyProvider(
  model: Model<any>,
  context: Context,
  options?: SimpleStreamOptions
): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();

  (async () => {
    // Initialize output message
    const output: AssistantMessage = {
      role: "assistant",
      content: [],
      api: model.api,
      provider: model.provider,
      model: model.id,
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
      },
      stopReason: "pending",
      timestamp: Date.now(),
    };

    try {
      // Push start event
      stream.push({ type: "start", partial: output });

      // Make API request and process response...
      // Push content events as they arrive and set stopReason from the terminal event.
      if (output.stopReason === "pending") {
        throw new Error("Provider stream ended without a stop reason");
      }
      if (output.stopReason === "error" || output.stopReason === "aborted") {
        throw new Error(output.errorMessage || "An unknown error occurred");
      }

      // Push done event
      stream.push({
        type: "done",
        reason: output.stopReason,
        message: output
      });
      stream.end();
    } catch (error) {
      output.stopReason = options?.signal?.aborted ? "aborted" : "error";
      output.errorMessage = error instanceof Error ? error.message : String(error);
      stream.push({ type: "error", reason: output.stopReason, error: output });
      stream.end();
    }
  })();

  return stream;
}
```

### Event Types 事件类型

Push events via `stream.push()` in this order:
通过 `stream.push()` 按以下顺序推送事件：

1. `{ type: "start", partial: output }` - Stream started
   `{ type: "start", partial: output }` - 流已开始

2. Content events (repeatable, track `contentIndex` for each block):
   内容事件（可重复出现，需为每个内容块跟踪 `contentIndex`）：
   - `{ type: "text_start", contentIndex, partial }` - Text block started
     文本块开始
   - `{ type: "text_delta", contentIndex, delta, partial }` - Text chunk
     文本增量片段
   - `{ type: "text_end", contentIndex, content, partial }` - Text block ended
     文本块结束
   - `{ type: "thinking_start", contentIndex, partial }` - Thinking started
     思考内容开始
   - `{ type: "thinking_delta", contentIndex, delta, partial }` - Thinking chunk
     思考增量片段
   - `{ type: "thinking_end", contentIndex, content, partial }` - Thinking ended
     思考内容结束
   - `{ type: "toolcall_start", contentIndex, partial }` - Tool call started
     工具调用开始
   - `{ type: "toolcall_delta", contentIndex, delta, partial }` - Tool call JSON chunk
     工具调用的 JSON 增量片段
   - `{ type: "toolcall_end", contentIndex, toolCall, partial }` - Tool call ended
     工具调用结束

3. `{ type: "done", reason, message }` or `{ type: "error", reason, error }` - Stream ended
   `{ type: "done", reason, message }` 或 `{ type: "error", reason, error }` - 流已结束

The `partial` field in each event contains the current `AssistantMessage` state. Update `output.content` as you receive data, then include `output` as the `partial`.
每个事件中的 `partial` 字段包含当前的 `AssistantMessage` 状态。在接收数据时更新 `output.content`，然后将 `output` 作为 `partial` 一并传入。

### Content Blocks 内容块

Add content blocks to `output.content` as they arrive:
在内容块到达时将其追加到 `output.content`：

```typescript
// Text block
output.content.push({ type: "text", text: "" });
stream.push({ type: "text_start", contentIndex: output.content.length - 1, partial: output });

// As text arrives
const block = output.content[contentIndex];
if (block.type === "text") {
  block.text += delta;
  stream.push({ type: "text_delta", contentIndex, delta, partial: output });
}

// When block completes
stream.push({ type: "text_end", contentIndex, content: block.text, partial: output });
```

### Tool Calls 工具调用

Tool calls require accumulating JSON and parsing:
工具调用需要累积 JSON 片段并进行解析：

```typescript
// Start tool call
output.content.push({
  type: "toolCall",
  id: toolCallId,
  name: toolName,
  arguments: {}
});
stream.push({ type: "toolcall_start", contentIndex: output.content.length - 1, partial: output });

// Accumulate JSON
let partialJson = "";
partialJson += jsonDelta;
try {
  block.arguments = JSON.parse(partialJson);
} catch {}
stream.push({ type: "toolcall_delta", contentIndex, delta: jsonDelta, partial: output });

// Complete
stream.push({
  type: "toolcall_end",
  contentIndex,
  toolCall: { type: "toolCall", id, name, arguments: block.arguments },
  partial: output
});
```

### Usage and Cost 用量与成本

Update usage from API response and calculate cost:
根据 API 响应更新用量并计算成本：

```typescript
output.usage.input = response.usage.input_tokens;
output.usage.output = response.usage.output_tokens;
output.usage.cacheRead = response.usage.cache_read_tokens ?? 0;
output.usage.cacheWrite = response.usage.cache_write_tokens ?? 0;
output.usage.totalTokens = output.usage.input + output.usage.output +
                           output.usage.cacheRead + output.usage.cacheWrite;
calculateCost(model, output.usage);
```

### Context Overflow Errors 上下文溢出错误

When a request exceeds the model's context window, pi can recover automatically by compacting the conversation and retrying. This recovery only kicks in if pi recognizes the failure as an overflow.
当请求超出模型的上下文窗口时，pi 可以通过压缩（compact）对话并重试来自动恢复。只有在 pi 能够将该失败识别为上下文溢出时，这一恢复机制才会生效。

Detection runs on the finalized assistant message:
检测是在最终生成的助手消息上进行的：

- `stopReason === "error"`
  即 `stopReason === "error"`
- `errorMessage` matches one of pi's known overflow patterns (see [`packages/ai/src/utils/overflow.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/utils/overflow.ts))
  `errorMessage` 匹配 pi 已知的某个溢出模式（参见 [`packages/ai/src/utils/overflow.ts`](https://github.com/earendil-works/pi-mono/blob/main/packages/ai/src/utils/overflow.ts)）

If your provider returns overflow errors with a message pi does not recognize, normalize the error from the same extension that registers the provider. Use a `message_end` handler to rewrite the assistant message so its `errorMessage` starts with a phrase pi recognizes. The generic fallback `context_length_exceeded` is the safest choice.
如果你的 provider 返回的溢出错误信息 pi 无法识别，请在注册该 provider 的同一个扩展中对错误进行归一化处理。使用 `message_end` 处理器重写助手消息，使其 `errorMessage` 以 pi 可识别的短语开头。通用的回退值 `context_length_exceeded` 是最稳妥的选择。

```typescript
const MY_PROVIDER_OVERFLOW_PATTERN = /your provider's overflow phrase/i;

export default function (pi: ExtensionAPI) {
  pi.registerProvider("my-provider", { /* ... */ });

  pi.on("message_end", (event, ctx) => {
    const message = event.message;
    if (message.role !== "assistant") return;
    if (message.stopReason !== "error") return;
    if (
      message.provider !== "my-provider" &&
      ctx.model?.provider !== "my-provider"
    )
      return;

    const errorMessage = message.errorMessage ?? "";
    if (errorMessage.includes("context_length_exceeded")) return;
    if (!MY_PROVIDER_OVERFLOW_PATTERN.test(errorMessage)) return;

    return {
      message: {
        ...message,
        errorMessage: `context_length_exceeded: ${errorMessage}`,
      },
    };
  });
}
```

`message_end` runs before pi tracks the assistant message for auto-compaction, so the rewritten `errorMessage` is what pi checks. With this in place, pi will:
`message_end` 会在 pi 将助手消息纳入自动压缩跟踪之前运行，因此 pi 检查的正是被重写后的 `errorMessage`。配置好之后，pi 将会：

1. Detect the overflow from `errorMessage`.
   从 `errorMessage` 中检测到上下文溢出。
2. Drop the failed assistant message from live context.
   将失败的助手消息从当前上下文中丢弃。
3. Run compaction.
   执行上下文压缩。
4. Retry the request once.
   重试一次该请求。

Guard the rewrite carefully:
请谨慎地为这种重写加上防护条件：

- Scope it to your provider (`message.provider` and `ctx.model?.provider`) so unrelated errors from other providers are untouched.
  将其限定在你自己的 provider 范围内（`message.provider` 与 `ctx.model?.provider`），以免影响其他 provider 的无关错误。
- Match a provider-specific pattern, not pi's generic overflow patterns. Rewriting rate-limit or throttling errors (`rate limit`, `too many requests`) would falsely trigger compaction instead of pi's normal retry-with-backoff path.
  匹配 provider 专有的模式，而不是 pi 的通用溢出模式。若把限流或节流错误（`rate limit`、`too many requests`）也一并重写，会错误地触发压缩，而不是走 pi 正常的退避重试路径。
- Skip when `errorMessage` already includes `context_length_exceeded` so the handler is idempotent.
  当 `errorMessage` 已经包含 `context_length_exceeded` 时直接跳过，以保证处理器是幂等的。

### Registration 注册

Register your stream function:
注册你的流式函数：

```typescript
pi.registerProvider("my-provider", {
  baseUrl: "https://api.example.com",
  apiKey: "$MY_API_KEY",
  api: "my-custom-api",
  models: [...],
  streamSimple: streamMyProvider
});
```

## Testing Your Implementation 测试你的实现

Test your provider against the same test suites used by built-in providers. Copy and adapt these test files from [packages/ai/test/](https://github.com/earendil-works/pi-mono/tree/main/packages/ai/test):
使用与内置 provider 相同的测试套件来测试你的 provider。可从 [packages/ai/test/](https://github.com/earendil-works/pi-mono/tree/main/packages/ai/test) 复制并改写以下测试文件：

| Test | Purpose<br>用途 |
|------|---------|
| `stream.test.ts` | Basic streaming, text output<br>基础流式输出与文本输出 |
| `tokens.test.ts` | Token counting and usage<br>token 计数与用量统计 |
| `abort.test.ts` | AbortSignal handling<br>AbortSignal 处理 |
| `empty.test.ts` | Empty/minimal responses<br>空响应/最小响应 |
| `context-overflow.test.ts` | Context window limits<br>上下文窗口上限 |
| `image-limits.test.ts` | Image input handling<br>图片输入处理 |
| `unicode-surrogate.test.ts` | Unicode edge cases<br>Unicode 边界情况 |
| `tool-call-without-result.test.ts` | Tool call edge cases<br>工具调用的边界情况 |
| `image-tool-result.test.ts` | Images in tool results<br>工具结果中的图片 |
| `total-tokens.test.ts` | Total token calculation<br>总 token 数计算 |
| `cross-provider-handoff.test.ts` | Context handoff between providers<br>不同 provider 之间的上下文交接 |

Run tests with your provider/model pairs to verify compatibility.
用你的 provider/模型组合运行这些测试，以验证兼容性。

## Config Reference 配置参考

```typescript
interface ProviderConfig {
  /** Display name for the provider in UI such as /login. */
  name?: string;

  /** API endpoint URL. Required when defining models. */
  baseUrl?: string;

  /** API key literal, env interpolation ($ENV_VAR or ${ENV_VAR}), or !command. Required when defining models (unless oauth). */
  apiKey?: string;

  /** API type for streaming. Required at provider or model level when defining models. */
  api?: Api;

  /** Custom streaming implementation for non-standard APIs. */
  streamSimple?: (
    model: Model<Api>,
    context: Context,
    options?: SimpleStreamOptions
  ) => AssistantMessageEventStream;

  /** Custom headers to include in requests. Values use the same resolution syntax as apiKey. */
  headers?: Record<string, string>;

  /** If true, adds Authorization: Bearer header with the resolved API key. */
  authHeader?: boolean;

  /** Models to register. If provided, replaces all existing models for this provider. */
  models?: ProviderModelConfig[];

  /** OAuth provider for /login support. */
  oauth?: {
    name: string;
    login(callbacks: OAuthLoginCallbacks): Promise<OAuthCredentials>;
    refreshToken(credentials: OAuthCredentials): Promise<OAuthCredentials>;
    getApiKey(credentials: OAuthCredentials): string;
  };
}
```

## Model Definition Reference 模型定义参考

```typescript
interface ProviderModelConfig {
  /** Model ID (e.g., "claude-sonnet-4-20250514"). */
  id: string;

  /** Display name (e.g., "Claude 4 Sonnet"). */
  name: string;

  /** API type override for this specific model. */
  api?: Api;

  /** API endpoint URL override for this specific model. */
  baseUrl?: string;

  /** Whether the model supports extended thinking. */
  reasoning: boolean;

  /** Maps pi thinking levels to provider/model-specific values; null marks a level unsupported. */
  thinkingLevelMap?: Partial<Record<"off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max", string | null>>;

  /** Supported input types. */
  input: ("text" | "image")[];

  /** Cost per million tokens (for usage tracking). */
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };

  /** Maximum context window size in tokens. */
  contextWindow: number;

  /** Maximum output tokens. */
  maxTokens: number;

  /** Custom headers for this specific model. */
  headers?: Record<string, string>;

  /** Compatibility settings for the selected API. */
  compat?: {
    // openai-completions
    supportsStore?: boolean;
    supportsDeveloperRole?: boolean;
    supportsReasoningEffort?: boolean;
    supportsUsageInStreaming?: boolean;
    supportsFinishReason?: boolean;
    supportsStrictMode?: boolean;
    supportsOpenAIGrammarTools?: boolean; // openai-completions/openai-responses; false falls back to normal function tools
    maxTokensField?: "max_completion_tokens" | "max_tokens";
    requiresToolResultName?: boolean;
    requiresAssistantAfterToolResult?: boolean;
    requiresThinkingAsText?: boolean;
    requiresReasoningContentOnAssistantMessages?: boolean;
    thinkingFormat?: "openai" | "openrouter" | "deepseek" | "together" | "zai" | "qwen" | "chat-template" | "qwen-chat-template" | "string-thinking" | "ant-ling";
    chatTemplateKwargs?: Record<string, string | number | boolean | null | { "$var": "thinking.enabled" | "thinking.effort"; omitWhenOff?: boolean }>;
    cacheControlFormat?: "anthropic";
    sessionAffinityFormat?: "openai" | "openai-nosession" | "openrouter";
    sendSessionAffinityHeaders?: boolean;

    // anthropic-messages
    supportsEagerToolInputStreaming?: boolean;
    supportsLongCacheRetention?: boolean;
    sendSessionAffinityHeaders?: boolean;
    supportsCacheControlOnTools?: boolean;
    forceAdaptiveThinking?: boolean;
    allowEmptySignature?: boolean;
    supportsStrictTools?: boolean;
  };
}
```

`openrouter` sends `reasoning: { effort }`. `deepseek` sends `thinking: { type: "enabled" | "disabled" }` and `reasoning_effort` when enabled. `together` sends `reasoning: { enabled }` and also `reasoning_effort` when `supportsReasoningEffort` is enabled. `qwen` is for DashScope-style top-level `enable_thinking`. Use `qwen-chat-template` for local Qwen-compatible servers that read `chat_template_kwargs.enable_thinking` and need `preserve_thinking`. Use `chat-template` for configurable `chat_template_kwargs`, for example DeepSeek V3.x behind vLLM with `chatTemplateKwargs: { "thinking": { "$var": "thinking.enabled" } }`.
`openrouter` 会发送 `reasoning: { effort }`。`deepseek` 会发送 `thinking: { type: "enabled" | "disabled" }`，并在启用时发送 `reasoning_effort`。`together` 会发送 `reasoning: { enabled }`，并在启用 `supportsReasoningEffort` 时额外发送 `reasoning_effort`。`qwen` 适用于 DashScope 风格的顶层 `enable_thinking`。对于读取 `chat_template_kwargs.enable_thinking` 且需要 `preserve_thinking` 的本地 Qwen 兼容服务，请使用 `qwen-chat-template`。对于需要可配置 `chat_template_kwargs` 的场景，请使用 `chat-template`，例如运行在 vLLM 之后的 DeepSeek V3.x，配置为 `chatTemplateKwargs: { "thinking": { "$var": "thinking.enabled" } }`。
`cacheControlFormat: "anthropic"` applies Anthropic-style `cache_control` markers to the system prompt, last tool definition, and last user, assistant, or tool-result text content.
`cacheControlFormat: "anthropic"` 会在系统提示词、最后一个工具定义，以及最后一条用户、助手或工具结果文本内容上应用 Anthropic 风格的 `cache_control` 标记。
