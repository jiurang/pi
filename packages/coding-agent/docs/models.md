# Custom Models 自定义模型

Add custom providers and models (Ollama, vLLM, LM Studio, proxies) via `~/.pi/agent/models.json`.
通过 `~/.pi/agent/models.json` 添加自定义提供方(provider)和模型(Ollama、vLLM、LM Studio、代理服务)。

## Table of Contents 目录

- [Minimal Example](#minimal-example)
  最小示例
- [Full Example](#full-example)
  完整示例
- [Supported APIs](#supported-apis)
  支持的 API
- [Provider Configuration](#provider-configuration)
  提供方配置
- [Model Configuration](#model-configuration)
  模型配置
- [Overriding Built-in Providers](#overriding-built-in-providers)
  覆盖内置提供方
- [Per-model Overrides](#per-model-overrides)
  按模型覆盖
- [Anthropic Messages Compatibility](#anthropic-messages-compatibility)
  Anthropic Messages 兼容性
- [OpenAI Compatibility](#openai-compatibility)
  OpenAI 兼容性

## Minimal Example 最小示例

For local models (Ollama, LM Studio, vLLM), only `id` is required per model:
对于本地模型(Ollama、LM Studio、vLLM),每个模型只需要 `id` 字段:

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

The `apiKey` value is a placeholder because Ollama ignores it. pi still treats models as requiring auth before they appear in `/model`, so keyless local servers should keep a dummy value, save a key for that provider with `/login`, or pass `--api-key` when selecting the model.
这里的 `apiKey` 只是一个占位值,因为 Ollama 会忽略它。pi 仍然要求模型先配置好鉴权(auth)才会出现在 `/model` 中,因此无需密钥的本地服务应保留一个占位值,或用 `/login` 为该提供方保存一个密钥,或在选择模型时传入 `--api-key`。

Some OpenAI-compatible servers do not understand the `developer` role used for reasoning-capable models. For those providers, set `compat.supportsDeveloperRole` to `false` so pi sends the system prompt as a `system` message instead. If the server also does not support `reasoning_effort`, set `compat.supportsReasoningEffort` to `false` too.
某些 OpenAI 兼容服务不认识推理(reasoning)类模型所使用的 `developer` 角色。对于这类提供方,请将 `compat.supportsDeveloperRole` 设为 `false`,这样 pi 会改用 `system` 消息发送系统提示词。如果该服务同样不支持 `reasoning_effort`,请一并将 `compat.supportsReasoningEffort` 设为 `false`。

You can set `compat` at the provider level to apply to all models, or at the model level to override a specific model. This commonly applies to Ollama, vLLM, SGLang, and similar OpenAI-compatible servers.
你可以在提供方级别设置 `compat` 以应用于该提供方下所有模型,也可以在模型级别设置以覆盖某个特定模型。这通常适用于 Ollama、vLLM、SGLang 以及类似的 OpenAI 兼容服务。

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "compat": {
        "supportsDeveloperRole": false,
        "supportsReasoningEffort": false
      },
      "models": [
        {
          "id": "gpt-oss:20b",
          "reasoning": true
        }
      ]
    }
  }
}
```

## Full Example 完整示例

Override defaults when you need specific values:
当你需要指定具体取值时,可以覆盖默认值:

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        {
          "id": "llama3.1:8b",
          "name": "Llama 3.1 8B (Local)",
          "reasoning": false,
          "input": ["text"],
          "contextWindow": 128000,
          "maxTokens": 32000,
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 }
        }
      ]
    }
  }
}
```

The file reloads each time you open `/model`. Edit during session; no restart needed.
每次打开 `/model` 时该文件都会重新加载。可以在会话进行中直接编辑,无需重启。

## Google AI Studio Example Google AI Studio 示例

Use `google-generative-ai` with a `baseUrl` to add models from Google AI Studio, including custom Gemma 4 entries:
使用 `google-generative-ai` 并配合 `baseUrl`,即可添加来自 Google AI Studio 的模型,包括自定义的 Gemma 4 条目:

```json
{
  "providers": {
    "my-google": {
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "api": "google-generative-ai",
      "apiKey": "$GEMINI_API_KEY",
      "models": [
        {
          "id": "gemma-4-31b-it",
          "name": "Gemma 4 31B",
          "input": ["text", "image"],
          "contextWindow": 262144,
          "reasoning": true
        }
      ]
    }
  }
}
```

The `baseUrl` is required when adding custom models to the `google-generative-ai` API type.
向 `google-generative-ai` API 类型添加自定义模型时,必须提供 `baseUrl`。

## Supported APIs 支持的 API

| API | Description<br>说明 |
|-----|-------------|
| `openai-completions` | OpenAI Chat Completions (most compatible)<br>OpenAI Chat Completions(兼容性最好) |
| `openai-responses` | OpenAI Responses API<br>OpenAI Responses API |
| `anthropic-messages` | Anthropic Messages API<br>Anthropic Messages API |
| `google-generative-ai` | Google Generative AI<br>Google Generative AI |

Set `api` at provider level (default for all models) or model level (override per model).
可以在提供方级别设置 `api`(作为所有模型的默认值),也可以在模型级别设置(按模型覆盖)。

## Provider Configuration 提供方配置

| Field | Description<br>说明 |
|-------|-------------|
| `baseUrl` | API endpoint URL<br>API 端点 URL |
| `api` | API type (see above)<br>API 类型(见上文) |
| `apiKey` | Optional API key config (see value resolution below). Omit it when auth is provided by `/login`/`auth.json` or CLI `--api-key`.<br>可选的 API 密钥配置(见下文的取值解析)。当鉴权由 `/login`/`auth.json` 或命令行 `--api-key` 提供时可省略。 |
| `oauth` | Dynamic OAuth provider type. Currently supports `"radius"`; requires the gateway `baseUrl`.<br>动态 OAuth 提供方类型。目前支持 `"radius"`;需要提供网关的 `baseUrl`。 |
| `headers` | Custom headers (see value resolution below)<br>自定义请求头(见下文的取值解析) |
| `authHeader` | Set `true` to add `Authorization: Bearer <apiKey>` automatically<br>设为 `true` 可自动添加 `Authorization: Bearer <apiKey>` |
| `models` | Array of model configurations<br>模型配置数组 |
| `modelOverrides` | Per-model overrides for built-in or extension-registered models on this provider<br>针对该提供方下内置模型或由扩展注册的模型的按模型覆盖配置 |

For providers with `models`, non-built-in provider configs need `baseUrl` and an `api` value at either provider or model level. `apiKey` is not required to load the file: models become available when auth is configured through `/login`/`auth.json`, CLI `--api-key`, or provider `apiKey`. If no auth is configured, the models load but stay unavailable in `/model` and `--list-models`.
对于配置了 `models` 的提供方,非内置的提供方配置需要在提供方级别或模型级别提供 `baseUrl` 和 `api` 值。加载该文件并不要求 `apiKey`:只要通过 `/login`/`auth.json`、命令行 `--api-key` 或提供方的 `apiKey` 配置了鉴权,模型就会变为可用。如果未配置任何鉴权,模型仍会被加载,但在 `/model` 和 `--list-models` 中保持不可用状态。

### Value Resolution 取值解析

The `apiKey` and `headers` fields support command execution, environment interpolation, and literals:
`apiKey` 和 `headers` 字段支持执行命令、环境变量插值以及字面量:

- **Shell command:** `"!command"` at the start executes the whole value as a command and uses stdout
  **Shell 命令:** 以 `"!command"` 开头时,整个值会被当作命令执行,并使用其标准输出(stdout)
  ```json
  "apiKey": "!security find-generic-password -ws 'anthropic'"
  "apiKey": "!op read 'op://vault/item/credential'"
  ```
- **Environment interpolation:** `"$ENV_VAR"` or `"${ENV_VAR}"` uses the value of the named variable. Interpolation works inside larger literals.
  **环境变量插值:** `"$ENV_VAR"` 或 `"${ENV_VAR}"` 会使用同名变量的值。插值也可以嵌在更长的字面量中使用。
  ```json
  "apiKey": "$MY_API_KEY"
  "apiKey": "${KEY_PREFIX}_${KEY_SUFFIX}"
  ```
  `$FOO_BAR` is the variable `FOO_BAR`; use `${FOO}_BAR` when `BAR` is literal text. Missing environment variables make the value unresolved.
  `$FOO_BAR` 表示变量 `FOO_BAR`;当 `BAR` 是字面文本时请使用 `${FOO}_BAR`。若环境变量不存在,该值将无法解析。
- **Escapes:** `"$$"` emits a literal `"$"`; `"$!"` emits a literal `"!"` without triggering command execution.
  **转义:** `"$$"` 输出字面量 `"$"`;`"$!"` 输出字面量 `"!"` 且不会触发命令执行。
  ```json
  "apiKey": "$$literal-dollar-prefix"
  "apiKey": "$!literal-bang-prefix"
  ```
- **Literal value:** Used directly. Plain uppercase strings such as `MY_API_KEY` are literals; use `$MY_API_KEY` for environment variables.
  **字面量:** 直接按原样使用。像 `MY_API_KEY` 这样的纯大写字符串是字面量;要引用环境变量请使用 `$MY_API_KEY`。
  ```json
  "apiKey": "sk-..."
  ```

For `models.json`, shell commands are resolved at request time. pi intentionally does not apply built-in TTL, stale reuse, or recovery logic for arbitrary commands. Different commands need different caching and failure strategies, and pi cannot infer the right one.
对于 `models.json`,shell 命令会在发起请求时解析。pi 有意不为任意命令内置 TTL、过期值复用或错误恢复逻辑。不同命令需要不同的缓存与失败处理策略,pi 无法推断出正确的做法。

If your command is slow, expensive, rate-limited, or should keep using a previous value on transient failures, wrap it in your own script or command that implements the caching or TTL behavior you want.
如果你的命令较慢、代价较高、受限流约束,或者希望在临时失败时继续沿用先前的值,请将其包装进你自己的脚本或命令中,并在其中实现所需的缓存或 TTL 行为。

`/model` availability checks use configured auth presence and do not execute shell commands.
`/model` 的可用性检查只依据是否已配置鉴权,不会执行 shell 命令。

### Custom Headers 自定义请求头

```json
{
  "providers": {
    "custom-proxy": {
      "baseUrl": "https://proxy.example.com/v1",
      "apiKey": "$MY_API_KEY",
      "api": "anthropic-messages",
      "headers": {
        "x-portkey-api-key": "$PORTKEY_API_KEY",
        "x-secret": "!op read 'op://vault/item/secret'"
      },
      "models": [...]
    }
  }
}
```

## Model Configuration 模型配置

| Field | Required | Default | Description<br>说明 |
|-------|----------|---------|-------------|
| `id` | Yes | — | Model identifier (passed to the API)<br>模型标识符(会传给 API) |
| `name` | No | `id` | Human-readable model label. Used for matching (`--model` patterns) and shown as secondary model detail text.<br>易读的模型标签。用于匹配(`--model` 模式),并作为次要的模型详情文本展示。 |
| `api` | No | provider's `api` | Override provider's API for this model<br>为该模型覆盖提供方的 API 类型 |
| `reasoning` | No | `false` | Supports extended thinking<br>是否支持扩展思考(extended thinking) |
| `thinkingLevelMap` | No | omitted | Maps pi thinking levels to provider values and marks unsupported levels (see below)<br>将 pi 的思考级别映射为提供方取值,并标记不支持的级别(见下文) |
| `input` | No | `["text"]` | Input types: `["text"]` or `["text", "image"]`<br>输入类型:`["text"]` 或 `["text", "image"]` |
| `contextWindow` | No | `128000` | Context window size in tokens<br>上下文窗口(context window)大小,单位为 token |
| `maxTokens` | No | `16384` | Maximum output tokens<br>最大输出 token 数 |
| `cost` | No | all zeros | Per-million-token rates with optional request-wide input pricing tiers<br>每百万 token 的费率,可选配置作用于整个请求的输入定价阶梯 |
| `compat` | No | provider `compat` | Provider compatibility overrides. Merged with provider-level `compat` when both are set.<br>提供方兼容性覆盖配置。当模型级与提供方级同时设置时会进行合并。 |

A cost tier supplies a complete alternate rate set and applies to the full request when total input usage (`input + cacheRead + cacheWrite`) exceeds `inputTokensAbove`. When multiple tiers match, the highest threshold wins.
一个费用阶梯(tier)提供一整套替代费率;当输入总用量(`input + cacheRead + cacheWrite`)超过 `inputTokensAbove` 时,该费率将应用于整个请求。若多个阶梯同时命中,取阈值最高的那个。

```json
{
  "cost": {
    "input": 5,
    "output": 30,
    "cacheRead": 0.5,
    "cacheWrite": 6.25,
    "tiers": [
      {
        "inputTokensAbove": 272000,
        "input": 10,
        "output": 45,
        "cacheRead": 1,
        "cacheWrite": 12.5
      }
    ]
  }
}
```

Current behavior:
当前行为:
- `/model`, `--list-models`, and the interactive footer display entries by model `id`.
  `/model`、`--list-models` 以及交互式底栏均按模型 `id` 展示条目。
- The configured `name` is used for model matching and secondary model detail text. It does not replace the footer/status-bar model id.
  配置的 `name` 用于模型匹配和次要的模型详情文本,不会替换底栏/状态栏中显示的模型 id。

### Thinking Level Map 思考级别映射

Use `thinkingLevelMap` on a model to describe model-specific thinking controls. Keys are pi thinking levels: `off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`. Maps may contain holes; for example, a model can expose `high` and `max` without exposing `xhigh`.
在模型上使用 `thinkingLevelMap` 来描述该模型特有的思考控制方式。键为 pi 的思考级别:`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`。映射允许存在缺口;例如某个模型可以暴露 `high` 和 `max`,但不暴露 `xhigh`。

Values are tristate:
取值有三种形态:

| Value | Meaning<br>含义 |
|-------|---------|
| omitted | Standard levels through `high` use the provider's default mapping; extended `xhigh` and `max` levels are unsupported<br>省略:直到 `high` 为止的标准级别使用提供方的默认映射;扩展的 `xhigh` 和 `max` 级别不受支持 |
| string | Level is supported and this value is sent to the provider<br>字符串:该级别受支持,并将此值发送给提供方 |
| `null` | Level is unsupported and hidden/skipped/clamped away<br>该级别不受支持,会被隐藏/跳过/钳制掉 |

Example for a model that only supports off, high, and max reasoning:
以下示例适用于仅支持 off、high 和 max 三种推理级别的模型:

```json
{
  "id": "deepseek-v4-pro",
  "reasoning": true,
  "thinkingLevelMap": {
    "minimal": null,
    "low": null,
    "medium": null,
    "high": "high",
    "xhigh": null,
    "max": "max"
  }
}
```

Example for a model where thinking cannot be disabled:
以下示例适用于无法关闭思考功能的模型:

```json
{
  "id": "always-thinking-model",
  "reasoning": true,
  "thinkingLevelMap": {
    "off": null
  }
}
```

Migration: older configs that used `compat.reasoningEffortMap` should move that mapping to model-level `thinkingLevelMap`. Use `null` for levels that should not appear in the UI.
迁移说明:此前使用 `compat.reasoningEffortMap` 的旧配置应将该映射迁移到模型级别的 `thinkingLevelMap`。对于不应出现在界面中的级别,请使用 `null`。

## Overriding Built-in Providers 覆盖内置提供方

Route a built-in provider through a proxy without redefining models:
无需重新定义模型,即可将内置提供方的请求路由到代理服务:

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1"
    }
  }
}
```

All built-in Anthropic models remain available. Existing OAuth or API key auth continues to work.
所有内置的 Anthropic 模型仍然可用。已有的 OAuth 或 API 密钥鉴权方式继续有效。

To merge custom models into a built-in provider, include the `models` array:
若要把自定义模型合并进内置提供方,请加入 `models` 数组:

```json
{
  "providers": {
    "anthropic": {
      "baseUrl": "https://my-proxy.example.com/v1",
      "apiKey": "$ANTHROPIC_API_KEY",
      "api": "anthropic-messages",
      "models": [...]
    }
  }
}
```

Merge semantics:
合并语义:
- Built-in models are kept.
  内置模型会被保留。
- Custom models are upserted by `id` within the provider.
  自定义模型在该提供方内按 `id` 进行 upsert(存在则更新,不存在则新增)。
- If a custom model `id` matches a built-in model `id`, the custom model replaces that built-in model.
  如果自定义模型的 `id` 与某个内置模型的 `id` 相同,则该自定义模型会替换对应的内置模型。
- If a custom model `id` is new, it is added alongside built-in models.
  如果自定义模型的 `id` 是新的,则会与内置模型并存新增。

## Per-model Overrides 按模型覆盖

Use `modelOverrides` to customize built-in models and matching extension-registered models without replacing the provider's full model list.
使用 `modelOverrides` 可以自定义内置模型以及匹配的、由扩展注册的模型,而无需替换该提供方的完整模型列表。

```json
{
  "providers": {
    "openrouter": {
      "modelOverrides": {
        "anthropic/claude-sonnet-4": {
          "name": "Claude Sonnet 4 (Bedrock Route)",
          "compat": {
            "openRouterRouting": {
              "only": ["amazon-bedrock"]
            }
          }
        }
      }
    }
  }
}
```

`modelOverrides` supports these fields per model: `name`, `reasoning`, `thinkingLevelMap`, `input`, `cost` (partial), `contextWindow`, `maxTokens`, `headers`, `compat`.
`modelOverrides` 对每个模型支持以下字段:`name`、`reasoning`、`thinkingLevelMap`、`input`、`cost`(可部分覆盖)、`contextWindow`、`maxTokens`、`headers`、`compat`。

Direct OpenAI GPT-5.6 Sol, Terra, and Luna default to a `272000` context window so requests remain within OpenAI's short-context pricing tier. To opt into OpenAI's 1.05M context window, increase it for each model you use:
直连 OpenAI 的 GPT-5.6 Sol、Terra 和 Luna 默认使用 `272000` 的上下文窗口,以便请求保持在 OpenAI 的短上下文定价档位内。若要启用 OpenAI 的 1.05M 上下文窗口,需要为你所使用的每个模型分别调高该值:

```json
{
  "providers": {
    "openai": {
      "modelOverrides": {
        "gpt-5.6-sol": {
          "contextWindow": 1050000
        }
      }
    }
  }
}
```

The override preserves the built-in pricing metadata. Requests with more than 272K total input tokens use GPT-5.6's long-context rates for the entire request. Apply the same override to `gpt-5.6-terra` or `gpt-5.6-luna` when needed.
该覆盖配置会保留内置的定价元数据。输入总量超过 272K token 的请求,整个请求都将按 GPT-5.6 的长上下文费率计费。需要时可对 `gpt-5.6-terra` 或 `gpt-5.6-luna` 应用同样的覆盖配置。

Behavior notes:
行为说明:
- `modelOverrides` are applied to built-in provider models and matching extension-registered provider models.
  `modelOverrides` 会应用于内置提供方模型,以及匹配的、由扩展注册的提供方模型。
- Unknown model IDs are ignored.
  未知的模型 ID 会被忽略。
- You can combine provider-level `baseUrl`/`headers` with `modelOverrides`.
  你可以将提供方级别的 `baseUrl`/`headers` 与 `modelOverrides` 组合使用。
- Overriding `name` changes model matching and secondary detail text only; the footer and primary model lists continue to show the model `id`.
  覆盖 `name` 仅影响模型匹配和次要详情文本;底栏和主要模型列表仍会显示模型 `id`。
- If `models` is also defined for a provider, custom models are merged after built-in overrides. A custom model with the same `id` replaces the overridden built-in model entry.
  如果某个提供方同时定义了 `models`,自定义模型会在内置覆盖之后再进行合并。`id` 相同的自定义模型会替换已被覆盖的内置模型条目。

## Anthropic Messages Compatibility Anthropic Messages 兼容性

For providers or proxies using `api: "anthropic-messages"`, use `compat` to control Anthropic-specific request compatibility.
对于使用 `api: "anthropic-messages"` 的提供方或代理服务,可通过 `compat` 控制 Anthropic 特有的请求兼容性。

By default pi sends per-tool `eager_input_streaming: true`. If a proxy or Anthropic-compatible backend rejects that field, set `supportsEagerToolInputStreaming` to `false`. Pi will omit `tools[].eager_input_streaming` and send the legacy `fine-grained-tool-streaming-2025-05-14` beta header for tool-enabled requests instead.
默认情况下,pi 会为每个工具发送 `eager_input_streaming: true`。如果代理服务或 Anthropic 兼容后端拒绝该字段,请将 `supportsEagerToolInputStreaming` 设为 `false`。此时 pi 会省略 `tools[].eager_input_streaming`,并在启用了工具的请求中改为发送旧版的 `fine-grained-tool-streaming-2025-05-14` beta 请求头。

Some Anthropic models require adaptive thinking (`thinking.type: "adaptive"` plus `output_config.effort`) instead of the legacy budget-based thinking payload. Built-in models set this automatically. For custom providers or aliases that route to those models, set `forceAdaptiveThinking` to `true`.
部分 Anthropic 模型需要使用自适应思考(`thinking.type: "adaptive"` 加上 `output_config.effort`),而非旧版基于预算(budget)的思考负载。内置模型会自动进行该设置。对于路由到这些模型的自定义提供方或别名,请将 `forceAdaptiveThinking` 设为 `true`。

Some Anthropic-compatible providers emit thinking blocks with empty signatures and still expect them on replay. Set `allowEmptySignature` to `true` only for those providers; real Anthropic rejects empty thinking signatures.
某些 Anthropic 兼容提供方会输出签名(signature)为空的思考块,并且在重放时仍要求带上这些块。仅对这类提供方将 `allowEmptySignature` 设为 `true`;真正的 Anthropic 会拒绝空的思考签名。

Built-in Anthropic models enable `supportsStrictTools` in their model metadata. Custom Anthropic-compatible models must set it to `true` when their endpoint accepts strict JSON-schema tool definitions.
内置 Anthropic 模型已在其模型元数据中启用 `supportsStrictTools`。当自定义的 Anthropic 兼容模型的端点接受严格(strict)JSON Schema 工具定义时,必须将该项设为 `true`。

```json
{
  "providers": {
    "anthropic-proxy": {
      "baseUrl": "https://proxy.example.com",
      "api": "anthropic-messages",
      "apiKey": "$ANTHROPIC_PROXY_KEY",
      "compat": {
        "supportsEagerToolInputStreaming": false,
        "supportsLongCacheRetention": true,
        "forceAdaptiveThinking": true,
        "allowEmptySignature": true
      },
      "models": [
        {
          "id": "claude-opus-4-7",
          "reasoning": true,
          "input": ["text", "image"]
        }
      ]
    }
  }
}
```

| Field | Description<br>说明 |
|-------|-------------|
| `supportsEagerToolInputStreaming` | Whether the provider accepts per-tool `eager_input_streaming`. Default: `true`. Set to `false` to omit that field and use the legacy fine-grained tool streaming beta header on tool-enabled requests.<br>提供方是否接受按工具设置的 `eager_input_streaming`。默认值:`true`。设为 `false` 会省略该字段,并在启用工具的请求中使用旧版细粒度工具流式 beta 请求头。 |
| `supportsLongCacheRetention` | Whether the provider accepts Anthropic long cache retention (`cache_control.ttl: "1h"`) when cache retention is `long`. Default: `true`.<br>当缓存保留策略为 `long` 时,提供方是否接受 Anthropic 的长缓存保留(`cache_control.ttl: "1h"`)。默认值:`true`。 |
| `sendSessionAffinityHeaders` | Whether to send `x-session-affinity` from the session id when caching is enabled. Default: auto-detected for known providers.<br>启用缓存时是否根据会话 id 发送 `x-session-affinity`。默认值:对已知提供方自动检测。 |
| `supportsCacheControlOnTools` | Whether the provider accepts Anthropic-style `cache_control` markers on tool definitions. Default: `true`.<br>提供方是否接受在工具定义上使用 Anthropic 风格的 `cache_control` 标记。默认值:`true`。 |
| `forceAdaptiveThinking` | Whether to send adaptive thinking (`thinking.type: "adaptive"` plus `output_config.effort`) for this model. Built-in adaptive models set this automatically. Default: `false`.<br>是否为该模型发送自适应思考(`thinking.type: "adaptive"` 加 `output_config.effort`)。内置的自适应模型会自动设置。默认值:`false`。 |
| `allowEmptySignature` | Whether to replay empty thinking signatures as `signature: ""` instead of converting thinking to text. Default: `false`.<br>是否将空的思考签名以 `signature: ""` 形式重放,而不是把思考内容转换为纯文本。默认值:`false`。 |
| `supportsStrictTools` | Whether the provider accepts strict JSON-schema tool definitions. Default: `false`; built-in Anthropic models enable it in generated metadata.<br>提供方是否接受严格的 JSON Schema 工具定义。默认值:`false`;内置 Anthropic 模型会在生成的元数据中启用该项。 |

## OpenAI Compatibility OpenAI 兼容性

For providers with partial OpenAI compatibility, use the `compat` field.
对于仅部分兼容 OpenAI 的提供方,请使用 `compat` 字段。

- Provider-level `compat` applies defaults to all models under that provider.
  提供方级别的 `compat` 会为该提供方下的所有模型提供默认值。
- Model-level `compat` overrides provider-level values for that model.
  模型级别的 `compat` 会针对该模型覆盖提供方级别的取值。

```json
{
  "providers": {
    "local-llm": {
      "baseUrl": "http://localhost:8080/v1",
      "api": "openai-completions",
      "compat": {
        "supportsUsageInStreaming": false,
        "maxTokensField": "max_tokens"
      },
      "models": [...]
    }
  }
}
```

| Field | Description<br>说明 |
|-------|-------------|
| `supportsStore` | Provider supports `store` field<br>提供方是否支持 `store` 字段 |
| `supportsDeveloperRole` | Use `developer` vs `system` role<br>使用 `developer` 角色还是 `system` 角色 |
| `supportsReasoningEffort` | Support for `reasoning_effort` parameter<br>是否支持 `reasoning_effort` 参数 |
| `supportsUsageInStreaming` | Supports `stream_options: { include_usage: true }` (default: `true`)<br>是否支持 `stream_options: { include_usage: true }`(默认值:`true`) |
| `supportsFinishReason` | Whether streamed responses include `finish_reason`. When `false`, pi infers `stop` or `toolUse` when the stream ends. Default: `true`.<br>流式响应中是否包含 `finish_reason`。设为 `false` 时,pi 会在流结束时推断出 `stop` 或 `toolUse`。默认值:`true`。 |
| `maxTokensField` | Use `max_completion_tokens` or `max_tokens`<br>使用 `max_completion_tokens` 还是 `max_tokens` |
| `requiresToolResultName` | Include `name` on tool result messages<br>是否需要在工具结果消息中包含 `name` |
| `requiresAssistantAfterToolResult` | Insert an assistant message before a user message after tool results<br>在工具结果之后、用户消息之前是否需要插入一条 assistant 消息 |
| `requiresThinkingAsText` | Convert thinking blocks to plain text<br>将思考块转换为纯文本 |
| `requiresReasoningContentOnAssistantMessages` | Include empty `reasoning_content` on all replayed assistant messages when reasoning is enabled<br>启用推理时,在所有重放的 assistant 消息上附带空的 `reasoning_content` |
| `thinkingFormat` | Use `reasoning_effort`, `openrouter`, `deepseek`, `together`, `zai`, `qwen`, `chat-template`, or `qwen-chat-template` thinking parameters<br>使用 `reasoning_effort`、`openrouter`、`deepseek`、`together`、`zai`、`qwen`、`chat-template` 或 `qwen-chat-template` 形式的思考参数 |
| `chatTemplateKwargs` | `chat_template_kwargs` values for `thinkingFormat: "chat-template"`; use `{ "$var": "thinking.enabled" }` or `{ "$var": "thinking.effort" }` for pi-controlled thinking values<br>用于 `thinkingFormat: "chat-template"` 的 `chat_template_kwargs` 取值;使用 `{ "$var": "thinking.enabled" }` 或 `{ "$var": "thinking.effort" }` 可让思考取值由 pi 控制 |
| `cacheControlFormat` | Use Anthropic-style `cache_control` markers on the system prompt, last tool definition, and last user, assistant, or tool-result text content. Currently only `anthropic` is supported.<br>在系统提示词、最后一个工具定义,以及最后的用户、assistant 或工具结果文本内容上使用 Anthropic 风格的 `cache_control` 标记。目前仅支持 `anthropic`。 |
| `sendSessionAffinityHeaders` | For `openai-completions`, send session-affinity headers from the session id when caching is enabled. Default: `false`.<br>对于 `openai-completions`,启用缓存时根据会话 id 发送会话亲和性(session-affinity)请求头。默认值:`false`。 |
| `sessionAffinityFormat` | For `openai-completions` and `openai-responses`, the session-affinity header format: `openai` sends `session_id`/`x-client-request-id` (completions also `x-session-affinity`), `openai-nosession` omits the underscore-containing `session_id` header, `openrouter` sends `x-session-id`. Does not affect the `prompt_cache_key` body param. Default: auto-detected.<br>对于 `openai-completions` 和 `openai-responses`,指定会话亲和性请求头格式:`openai` 发送 `session_id`/`x-client-request-id`(completions 还会发送 `x-session-affinity`),`openai-nosession` 会省略含下划线的 `session_id` 请求头,`openrouter` 发送 `x-session-id`。不影响请求体参数 `prompt_cache_key`。默认值:自动检测。 |
| `supportsStrictMode` | Whether the provider accepts strict JSON-schema function tool definitions. Defaults depend on the API; built-in OpenAI models carry explicit capability metadata.<br>提供方是否接受严格的 JSON Schema 函数工具定义。默认值取决于具体 API;内置 OpenAI 模型带有显式的能力元数据。 |
| `supportsOpenAIGrammarTools` | Whether OpenAI-compatible APIs emit custom Lark/regex grammar tools. When `false`, grammar-constrained tools fall back to normal function tools. Default: `false`; the built-in model catalog enables it for GPT-5+ models on OpenAI, OpenAI Codex, Azure OpenAI, GitHub Copilot, opencode, and Cloudflare AI Gateway.<br>OpenAI 兼容 API 是否输出自定义的 Lark/正则语法工具。设为 `false` 时,受语法约束的工具会回退为普通函数工具。默认值:`false`;内置模型目录会为 OpenAI、OpenAI Codex、Azure OpenAI、GitHub Copilot、opencode 和 Cloudflare AI Gateway 上的 GPT-5+ 模型启用该项。 |
| `deferredToolsMode` | Use provider-specific deferred tool serialization. Currently only `"kimi"` is supported for Kimi's OpenAI-compatible Chat Completions format.<br>使用提供方特有的延迟工具(deferred tool)序列化方式。目前仅支持 `"kimi"`,对应 Kimi 的 OpenAI 兼容 Chat Completions 格式。 |
| `supportsLongCacheRetention` | Whether the provider accepts long cache retention when cache retention is `long`: `prompt_cache_retention: "24h"` for OpenAI prompt caching, or `cache_control.ttl: "1h"` when `cacheControlFormat` is `anthropic`. Default: `true`.<br>当缓存保留策略为 `long` 时,提供方是否接受长缓存保留:OpenAI 提示词缓存使用 `prompt_cache_retention: "24h"`,当 `cacheControlFormat` 为 `anthropic` 时则使用 `cache_control.ttl: "1h"`。默认值:`true`。 |
| `openRouterRouting` | OpenRouter provider routing preferences. This object is sent as-is in the `provider` field of the [OpenRouter API request](https://openrouter.ai/docs/guides/routing/provider-selection).<br>OpenRouter 的提供方路由偏好。该对象会原样放入 [OpenRouter API 请求](https://openrouter.ai/docs/guides/routing/provider-selection) 的 `provider` 字段中发送。 |
| `vercelGatewayRouting` | Vercel AI Gateway routing config for provider selection (`only`, `order`)<br>用于提供方选择的 Vercel AI Gateway 路由配置(`only`、`order`) |

`openrouter` uses `reasoning: { effort }`. `together` uses `reasoning: { enabled }` and also `reasoning_effort` when `supportsReasoningEffort` is enabled. `qwen` uses top-level `enable_thinking`. Use `qwen-chat-template` for local Qwen-compatible servers that require `chat_template_kwargs.enable_thinking` and `preserve_thinking`. Use `chat-template` for vLLM/Hugging Face chat templates that need configurable `chat_template_kwargs`, such as `chatTemplateKwargs: { "thinking": { "$var": "thinking.enabled" } }` for DeepSeek V3.x templates.
`openrouter` 使用 `reasoning: { effort }`。`together` 使用 `reasoning: { enabled }`,并在启用 `supportsReasoningEffort` 时额外使用 `reasoning_effort`。`qwen` 使用顶层的 `enable_thinking`。对于需要 `chat_template_kwargs.enable_thinking` 和 `preserve_thinking` 的本地 Qwen 兼容服务,请使用 `qwen-chat-template`。对于需要可配置 `chat_template_kwargs` 的 vLLM/Hugging Face 聊天模板,请使用 `chat-template`,例如面向 DeepSeek V3.x 模板的 `chatTemplateKwargs: { "thinking": { "$var": "thinking.enabled" } }`。

`cacheControlFormat: "anthropic"` is for OpenAI-compatible providers that expose Anthropic-style prompt caching through `cache_control` markers on text content and tool definitions.
`cacheControlFormat: "anthropic"` 适用于那些通过在文本内容和工具定义上添加 `cache_control` 标记来暴露 Anthropic 风格提示词缓存的 OpenAI 兼容提供方。

Example:
示例:

```json
{
  "providers": {
    "openrouter": {
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "$OPENROUTER_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "openrouter/anthropic/claude-3.5-sonnet",
          "name": "OpenRouter Claude 3.5 Sonnet",
          "compat": {
            "openRouterRouting": {
              "allow_fallbacks": true,
              "require_parameters": false,
              "data_collection": "deny",
              "zdr": true,
              "enforce_distillable_text": false,
              "order": ["anthropic", "amazon-bedrock", "google-vertex"],
              "only": ["anthropic", "amazon-bedrock"],
              "ignore": ["gmicloud", "friendli"],
              "quantizations": ["fp16", "bf16"],
              "sort": {
                "by": "price",
                "partition": "model"
              },
              "max_price": {
                "prompt": 10,
                "completion": 20
              },
              "preferred_min_throughput": {
                "p50": 100,
                "p90": 50
              },
              "preferred_max_latency": {
                "p50": 1,
                "p90": 3,
                "p99": 5
              }
            }
          }
        }
      ]
    }
  }
}
```

Vercel AI Gateway example:
Vercel AI Gateway 示例:

```json
{
  "providers": {
    "vercel-ai-gateway": {
      "baseUrl": "https://ai-gateway.vercel.sh/v1",
      "apiKey": "$AI_GATEWAY_API_KEY",
      "api": "openai-completions",
      "models": [
        {
          "id": "moonshotai/kimi-k2.5",
          "name": "Kimi K2.5 (Fireworks via Vercel)",
          "reasoning": true,
          "input": ["text", "image"],
          "cost": { "input": 0.6, "output": 3, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 262144,
          "maxTokens": 262144,
          "compat": {
            "vercelGatewayRouting": {
              "only": ["fireworks", "novita"],
              "order": ["fireworks", "novita"]
            }
          }
        }
      ]
    }
  }
}
```
