// Per-tier provider regression for issues/provider-error-body-passthrough.
// 针对 issues/provider-error-body-passthrough 的分层(per-tier)provider 回归测试。
//
// Routes a 403-with-body error through the real provider catch path for one
// representative per tier (Success Criterion 7): a body-blind text provider
// (openai-completions), a status-only provider (openai-responses), and a
// body-blind Bedrock provider. Each asserts the resulting errorMessage carries
// both the HTTP status and the body reason.
// 将一个带响应体(body)的 403 错误,经由真实的 provider catch 路径进行传递,
// 每一层各取一个代表(验收标准 7):一个忽略响应体的文本 provider
// (openai-completions)、一个仅保留状态码的 provider(openai-responses),
// 以及一个忽略响应体的 Bedrock provider。每个用例都断言最终的 errorMessage
// 同时携带 HTTP 状态码和响应体中的原因。
// The image-provider tier is covered
// by provider-error-body-passthrough.test.ts; the already-correct happy path
// (no double body / no duplicated status) is asserted via the shared helper in
// error-body.test.ts.
// 图像 provider 这一层由 provider-error-body-passthrough.test.ts 覆盖;
// 本身已经正确的正常路径(不重复输出响应体 / 不重复输出状态码)则通过
// error-body.test.ts 中的共享辅助函数进行断言。

import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamSimple as streamSimpleBedrock } from "../src/api/bedrock-converse-stream.ts";
import { stream as streamOpenAICompletions } from "../src/api/openai-completions.ts";
import { stream as streamOpenAIResponses } from "../src/api/openai-responses.ts";
import type { Context, Model } from "../src/types.ts";

// openai SDK APIError shape: "<status> status code (no body)" message, the
// parsed body kept on `.error`.
// openai SDK 的 APIError 形态:message 为 "<status> status code (no body)",
// 而解析后的响应体(parsed body)保存在 `.error` 上。
class FakeAPIError extends Error {
	status: number;
	error: unknown;
	constructor(status: number, parsedBody: unknown) {
		super(`${status} status code (no body)`);
		this.name = "PermissionDeniedError";
		this.status = status;
		this.error = parsedBody;
	}
}

const bedrockMock = vi.hoisted(() => ({
	sendError: undefined as unknown,
}));

const openaiMock = vi.hoisted(() => ({
	// Default parsed body; individual tests may override before invoking.
	// 默认的解析后响应体(parsed body);各个测试可在调用前覆盖它。
	parsedBody: { error: "blocked by gateway WAF" } as unknown,
}));

vi.mock("openai", () => {
	function throwingCreate() {
		const promise = Promise.resolve(undefined) as unknown as { withResponse: () => Promise<never> };
		promise.withResponse = async () => {
			throw new FakeAPIError(403, openaiMock.parsedBody);
		};
		return promise;
	}
	class FakeOpenAI {
		chat = { completions: { create: throwingCreate } };
		responses = { create: throwingCreate };
	}
	return { default: FakeOpenAI };
});

vi.mock("@aws-sdk/client-bedrock-runtime", () => {
	class BedrockRuntimeServiceException extends Error {}

	class BedrockRuntimeClient {
		middlewareStack = { add: () => {} };
		send(): Promise<never> {
			return Promise.reject(bedrockMock.sendError);
		}
	}

	class ConverseStreamCommand {
		readonly input: unknown;
		constructor(input: unknown) {
			this.input = input;
		}
	}

	return {
		BedrockRuntimeClient,
		BedrockRuntimeServiceException,
		ConverseStreamCommand,
		StopReason: {
			END_TURN: "end_turn",
			STOP_SEQUENCE: "stop_sequence",
			MAX_TOKENS: "max_tokens",
			MODEL_CONTEXT_WINDOW_EXCEEDED: "model_context_window_exceeded",
			TOOL_USE: "tool_use",
		},
		CachePointType: { DEFAULT: "default" },
		CacheTTL: { ONE_HOUR: "ONE_HOUR" },
		ConversationRole: { ASSISTANT: "assistant", USER: "user" },
		ImageFormat: { JPEG: "jpeg", PNG: "png", GIF: "gif", WEBP: "webp" },
		ToolResultStatus: { ERROR: "error", SUCCESS: "success" },
	};
});

import { getModel } from "../src/compat.ts";

const context: Context = {
	systemPrompt: "",
	messages: [{ role: "user", content: [{ type: "text", text: "hi" }], timestamp: 0 }],
	tools: [],
};

const completionsModel: Model<"openai-completions"> = {
	id: "test-model",
	name: "Test Model",
	api: "openai-completions",
	provider: "openrouter",
	baseUrl: "https://openrouter.ai/api/v1",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 1000,
	maxTokens: 100,
};

const responsesModel: Model<"openai-responses"> = {
	id: "gpt-test",
	name: "GPT Test",
	api: "openai-responses",
	provider: "openai",
	baseUrl: "https://api.openai.com/v1",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 1000,
	maxTokens: 100,
};

async function drainResult(stream: {
	[Symbol.asyncIterator](): AsyncIterator<unknown>;
	result(): Promise<{ errorMessage?: string; stopReason?: string }>;
}) {
	for await (const _event of stream) {
		void _event;
	}
	return stream.result();
}

describe("provider error body passthrough (per-tier regression)", () => {
	beforeEach(() => {
		openaiMock.parsedBody = { error: "blocked by gateway WAF" };
	});

	it("openai-completions (body-blind text) surfaces status + body", async () => {
		const output = await drainResult(streamOpenAICompletions(completionsModel, context, { apiKey: "test" }));

		expect(output.stopReason).toBe("error");
		expect(output.errorMessage).toContain("403");
		expect(output.errorMessage).toContain("blocked by gateway WAF");
		expect(output.errorMessage).not.toBe("403 status code (no body)");
	});

	it("openai-completions does not double-print the OpenRouter metadata.raw extra", async () => {
		// OpenRouter returns the extra reason under error.error.metadata.raw, which
		// is part of the parsed body normalizeProviderError already surfaces. The
		// manual append must not duplicate it.
		// OpenRouter 会把额外的错误原因放在 error.error.metadata.raw 下,它属于
		// normalizeProviderError 已经暴露出来的解析后响应体的一部分。因此手动追加
		// 时不能重复输出该内容。
		openaiMock.parsedBody = {
			message: "Provider returned error",
			code: 403,
			metadata: { raw: "upstream WAF blocked policy XYZ" },
		};

		const output = await drainResult(streamOpenAICompletions(completionsModel, context, { apiKey: "test" }));

		expect(output.errorMessage).toContain("upstream WAF blocked policy XYZ");
		const occurrences = output.errorMessage?.match(/upstream WAF blocked policy XYZ/g) ?? [];
		expect(occurrences).toHaveLength(1);
	});

	it("openai-responses (status-only) keeps the prefix and surfaces the body", async () => {
		const output = await drainResult(streamOpenAIResponses(responsesModel, context, { apiKey: "test" }));

		expect(output.stopReason).toBe("error");
		expect(output.errorMessage).toContain("OpenAI API error (403)");
		expect(output.errorMessage).toContain("blocked by gateway WAF");
	});

	it("bedrock (body-blind) surfaces the gateway body instead of Unknown: UnknownError", async () => {
		bedrockMock.sendError = Object.assign(new Error("UnknownError"), {
			name: "UnknownError",
			$metadata: { httpStatusCode: 403 },
			$response: { statusCode: 403, body: '{"message":"blocked by gateway WAF"}' },
		});

		const model = getModel("amazon-bedrock", "us.anthropic.claude-opus-4-8");
		const output = await drainResult(streamSimpleBedrock(model, { messages: context.messages }, {}));

		expect(output.stopReason).toBe("error");
		expect(output.errorMessage).toContain("403");
		expect(output.errorMessage).toContain("blocked by gateway WAF");
		expect(output.errorMessage).not.toContain("Unknown: UnknownError");
	});

	it("bedrock preserves the SDK validation message when the response body is a stream", async () => {
		bedrockMock.sendError = Object.assign(
			new Error(
				"Invocation of model ID anthropic.claude-opus-5 with on-demand throughput isn't supported. Retry with an inference profile.",
			),
			{
				name: "ValidationException",
				$metadata: { httpStatusCode: 400 },
				$response: {
					statusCode: 400,
					body: { pipe: () => undefined, _readableState: { buffer: [], length: 0 } },
				},
			},
		);

		const model = getModel("amazon-bedrock", "global.anthropic.claude-opus-5");
		const output = await drainResult(streamSimpleBedrock(model, { messages: context.messages }, {}));

		expect(output.stopReason).toBe("error");
		expect(output.errorMessage).toContain("on-demand throughput isn't supported");
		expect(output.errorMessage).toContain("inference profile");
		expect(output.errorMessage).not.toContain("_readableState");
	});
});
