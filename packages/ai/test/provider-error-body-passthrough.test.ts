// Regression test for issues/provider-error-body-passthrough
// 针对 issues/provider-error-body-passthrough 的回归测试
//
// When an endpoint behind a proxy / gateway returns a non-2xx response with a
// body the SDK cannot fold into its message, the provider catch block drops the
// body.
// 当位于代理 / 网关之后的端点返回一个非 2xx 响应,且其响应体(body)无法被 SDK
// 合并进错误 message 时,provider 的 catch 代码块会丢弃该响应体。
// The openai SDK's APIError keeps the parsed body on `error.error` and
// produces `"<status> status code (no body)"` as the message, so a body-blind
// catch (`error.message` only) surfaces the opaque message and hides the real
// reason the gateway returned.
// openai SDK 的 APIError 会把解析后的响应体保存在 `error.error` 上,并生成
// `"<status> status code (no body)"` 作为 message,因此忽略响应体的 catch
// (只读取 `error.message`)只会暴露这条含义不明的信息,而隐藏了网关返回的真实原因。
//
// This test routes a 403-with-body APIError through the OpenRouter image
// provider (one of the body-blind providers) and asserts the resulting
// errorMessage contains both the status and the body reason.
// 本测试将一个带响应体的 403 APIError 经由 OpenRouter 图像 provider(忽略响应体的
// provider 之一)进行传递,并断言最终的 errorMessage 同时包含状态码和响应体中的原因。
// It is EXPECTED TO
// FAIL until the provider catch blocks read the SDK error body.
// 在 provider 的 catch 代码块读取 SDK 错误响应体之前,本测试预期是失败的。

import { describe, expect, it, vi } from "vitest";
import { generateImages } from "../src/images.ts";
import type { ImagesContext, ImagesModel } from "../src/types.ts";

// Reproduce the openai SDK APIError shape: makeMessage(status, error, message)
// returns `"403 status code (no body)"` when status is set but the parsed body
// (`error`) is empty/unparsed, while the parsed body itself is kept on `.error`.
// 复现 openai SDK 的 APIError 形态:当状态码已设置但解析后的响应体(`error`)
// 为空 / 未被解析时,makeMessage(status, error, message) 会返回
// `"403 status code (no body)"`,而解析后的响应体本身仍保存在 `.error` 上。
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

vi.mock("openai", () => {
	class FakeOpenAI {
		chat = {
			completions: {
				create: () => {
					const promise = Promise.resolve(undefined) as unknown as {
						withResponse: () => Promise<never>;
					};
					promise.withResponse = async () => {
						// 403 from a gateway/proxy carrying the real reason in the body.
						// 来自网关 / 代理的 403 响应,真实原因携带在响应体中。
						throw new FakeAPIError(403, { error: "blocked by gateway WAF" });
					};
					return promise;
				},
			},
		};
	}
	return { default: FakeOpenAI };
});

describe("provider error body passthrough", () => {
	it("surfaces the HTTP body reason instead of the opaque SDK message (openrouter images)", async () => {
		const model: ImagesModel<"openrouter-images"> = {
			id: "black-forest-labs/flux.2-pro",
			name: "FLUX.2 Pro",
			api: "openrouter-images",
			provider: "openrouter",
			baseUrl: "https://openrouter.ai/api/v1",
			input: ["text", "image"],
			output: ["image"],
			cost: { input: 0.015, output: 0.03, cacheRead: 0, cacheWrite: 0 },
		};
		const context: ImagesContext = {
			input: [{ type: "text", text: "Generate a dog" }],
		};

		const output = await generateImages(model, context, { apiKey: "test" });

		expect(output.stopReason).toBe("error");
		// The status should be surfaced.
		// 状态码应当被暴露出来。
		expect(output.errorMessage).toContain("403");
		// The body reason must not be swallowed by the opaque SDK message.
		// 响应体中的原因不能被含义不明的 SDK message 吞掉。
		expect(output.errorMessage).toContain("blocked by gateway WAF");
		expect(output.errorMessage).not.toBe("403 status code (no body)");
	});
});
