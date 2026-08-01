/**
 * A test suite to ensure all configured Amazon Bedrock models are usable.
 * 用于确保所有已配置的 Amazon Bedrock 模型均可用的测试套件。
 *
 * This is here to make sure we got correct model identifiers from models.dev and other sources.
 * 该套件用于确认我们从 models.dev 及其他来源获取到的模型标识符是正确的。
 * Because Amazon Bedrock requires cross-region inference in some models,
 * plain model identifiers are not always usable and it requires tweaking of model identifiers to use cross-region inference.
 * 由于 Amazon Bedrock 的部分模型要求使用跨区域推理（cross-region inference），
 * 纯模型标识符并非总是可用，需要对模型标识符做相应调整才能使用跨区域推理。
 * See https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html#inference-profiles-support-system for more details.
 * 更多细节参见 https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles-support.html#inference-profiles-support-system
 *
 * This test suite is not enabled by default unless AWS credentials and `BEDROCK_EXTENSIVE_MODEL_TEST` environment variables are set.
 * 除非设置了 AWS 凭据以及 `BEDROCK_EXTENSIVE_MODEL_TEST` 环境变量，否则本测试套件默认不启用。
 * This test suite takes ~2 minutes to run. Because not all models are available in all regions,
 * it's recommended to use `us-west-2` region for best coverage for running this test suite.
 * 本测试套件运行耗时约 2 分钟。由于并非所有模型在所有区域都可用，
 * 建议使用 `us-west-2` 区域运行本套件以获得最佳覆盖率。
 *
 * You can run this test suite with:
 * 你可以通过以下命令运行本测试套件：
 * ```bash
 * $ AWS_REGION=us-west-2 BEDROCK_EXTENSIVE_MODEL_TEST=1 AWS_PROFILE=... npm test -- ./test/bedrock-models.test.ts
 * ```
 */

import { describe, expect, it } from "vitest";
import { complete, getModels } from "../src/compat.ts";
import type { Context } from "../src/types.ts";
import { hasBedrockCredentials } from "./bedrock-utils.ts";

describe("Amazon Bedrock Models", () => {
	const models = getModels("amazon-bedrock");

	it("should get all available Bedrock models", () => {
		expect(models.length).toBeGreaterThan(0);
		console.log(`Found ${models.length} Bedrock models`);
	});

	it("exposes Claude Opus 5 through an inference profile only", () => {
		expect(models.some((model) => model.id === "global.anthropic.claude-opus-5")).toBe(true);
		expect(models.some((model) => model.id === "anthropic.claude-opus-5")).toBe(false);
	});

	if (hasBedrockCredentials() && process.env.BEDROCK_EXTENSIVE_MODEL_TEST) {
		for (const model of models) {
			it(`should make a simple request with ${model.id}`, { timeout: 10_000 }, async () => {
				const context: Context = {
					systemPrompt: "You are a helpful assistant. Be extremely concise.",
					messages: [
						{
							role: "user",
							content: "Reply with exactly: 'OK'",
							timestamp: Date.now(),
						},
					],
				};

				const response = await complete(model, context);

				expect(response.role).toBe("assistant");
				expect(response.content).toBeTruthy();
				expect(response.content.length).toBeGreaterThan(0);
				expect(response.usage.input + response.usage.cacheRead).toBeGreaterThan(0);
				expect(response.usage.output).toBeGreaterThan(0);
				expect(response.errorMessage).toBeFalsy();

				const textContent = response.content
					.filter((b) => b.type === "text")
					.map((b) => (b.type === "text" ? b.text : ""))
					.join("")
					.trim();
				expect(textContent).toBeTruthy();
				console.log(`${model.id}: ${textContent.substring(0, 100)}`);
			});
		}
	}
});
