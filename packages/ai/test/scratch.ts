// Scratch script showing real-world use of the new Models API.
// 演示新版 Models API 实际用法的临时脚本。
// Run from packages/ai: node test/scratch.ts
// 在 packages/ai 目录下运行:node test/scratch.ts
// Requires ANTHROPIC_API_KEY.
// 需要设置 ANTHROPIC_API_KEY。

import { createModels } from "../src/models.ts";
import { anthropicProvider } from "../src/providers/anthropic.ts";
import type { Context } from "../src/types.ts";

// ---------------------------------------------------------------------------
// 1. Build a Models runtime and register a built-in provider factory.
// 1. 构建一个 Models 运行时并注册一个内置的 provider 工厂函数。
//    (Apps wanting everything use `builtinModels()` from providers/all.)
//    (想一次性获取全部内容的应用可使用 providers/all 中的 `builtinModels()`。)
// ---------------------------------------------------------------------------

const models = createModels();
models.setProvider(anthropicProvider());

// ---------------------------------------------------------------------------
// 2. Look up a model and check auth.
// 2. 查找一个模型并检查认证信息。
// ---------------------------------------------------------------------------

const model = models.getModel("anthropic", "claude-haiku-4-5");
if (!model) throw new Error("model not found");

const auth = await models.getAuth(model.provider);
console.log(`model: ${model.provider}/${model.id}`);
console.log(`auth:  ${auth ? `configured via ${auth.source}` : "not configured"}\n`);
if (!auth) process.exit(1);

const context: Context = {
	systemPrompt: "You are terse.",
	messages: [{ role: "user", content: "Say exactly: ok", timestamp: Date.now() }],
};

// ---------------------------------------------------------------------------
// 3. Simple completion (request-level auth resolution happens inside).
// 3. 简单的补全调用(内部会完成请求级别的认证解析)。
// ---------------------------------------------------------------------------

const message = await models.completeSimple(model, context);
console.log(`completeSimple -> [${message.stopReason}]`, message.content);

// ---------------------------------------------------------------------------
// 4. Streaming with deltas.
// 4. 带增量(delta)的流式输出。
// ---------------------------------------------------------------------------

context.messages.push(message, {
	role: "user",
	content: "Now count from 1 to 5, one number per line.",
	timestamp: Date.now(),
});

process.stdout.write("streamSimple   -> ");
const stream = models.streamSimple(model, context);
for await (const event of stream) {
	if (event.type === "text_delta") process.stdout.write(event.delta.replaceAll("\n", " "));
}
const final = await stream.result();
console.log(`[${final.stopReason}] cost: $${final.usage.cost.total.toFixed(6)}`);
