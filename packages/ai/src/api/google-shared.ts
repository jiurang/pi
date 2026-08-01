/**
 * Shared utilities for Google Generative AI and Google Vertex providers.
 * Google Generative AI 与 Google Vertex 提供商共用的工具函数。
 */

import { type Content, FinishReason, FunctionCallingConfigMode, type Part } from "@google/genai";
import type { Context, ImageContent, Model, StopReason, TextContent, Tool } from "../types.ts";
import { sanitizeSurrogates } from "../utils/sanitize-unicode.ts";
import { resolveJsonSchemaStrictSampling } from "./constrained-sampling.ts";
import { transformMessages } from "./transform-messages.ts";

type GoogleApiType = "google-generative-ai" | "google-vertex";

/**
 * Thinking level for Gemini 3 models.
 * Gemini 3 模型的思考（thinking）级别。
 * Mirrors Google's ThinkingLevel enum values.
 * 与 Google 的 ThinkingLevel 枚举值保持一致。
 */
export type GoogleThinkingLevel = "THINKING_LEVEL_UNSPECIFIED" | "MINIMAL" | "LOW" | "MEDIUM" | "HIGH";

/**
 * Determines whether a streamed Gemini `Part` should be treated as "thinking".
 * 判断流式返回的 Gemini `Part` 是否应被视为“思考（thinking）”内容。
 *
 * Protocol note (Gemini / Vertex AI thought signatures):
 * 协议说明（Gemini / Vertex AI 的思考签名 thought signatures）：
 * - `thought: true` is the definitive marker for thinking content (thought summaries).
 *   `thought: true` 是思考内容（思考摘要）的权威标记。
 * - `thoughtSignature` is an encrypted representation of the model's internal thought process
 *   used to preserve reasoning context across multi-turn interactions.
 *   `thoughtSignature` 是模型内部思考过程的加密表示，用于在多轮交互中保留推理上下文。
 * - `thoughtSignature` can appear on ANY part type (text, functionCall, etc.) - it does NOT
 *   indicate the part itself is thinking content.
 *   `thoughtSignature` 可能出现在任意类型的 part 上（text、functionCall 等），它并不表示该 part 本身是思考内容。
 * - For non-functionCall responses, the signature appears on the last part for context replay.
 *   对于非 functionCall 的响应，签名会出现在最后一个 part 上，用于上下文回放（replay）。
 * - When persisting/replaying model outputs, signature-bearing parts must be preserved as-is;
 *   do not merge/move signatures across parts.
 *   在持久化/回放模型输出时，携带签名的 part 必须原样保留；不要跨 part 合并或移动签名。
 *
 * See: https://ai.google.dev/gemini-api/docs/thought-signatures
 * 参见：https://ai.google.dev/gemini-api/docs/thought-signatures
 */
export function isThinkingPart(part: Pick<Part, "thought" | "thoughtSignature">): boolean {
	return part.thought === true;
}

/**
 * Retain thought signatures during streaming.
 * 在流式传输过程中保留思考签名（thought signature）。
 *
 * Some backends only send `thoughtSignature` on the first delta for a given part/block; later deltas may omit it.
 * 某些后端只在某个 part/块的第一个增量（delta）中发送 `thoughtSignature`，后续增量可能会省略它。
 * This helper preserves the last non-empty signature for the current block.
 * 该辅助函数会为当前块保留最后一个非空签名。
 *
 * Note: this does NOT merge or move signatures across distinct response parts. It only prevents
 * a signature from being overwritten with `undefined` within the same streamed block.
 * 注意：此函数不会跨不同的响应 part 合并或移动签名，它只是防止同一流式块内的签名被 `undefined` 覆盖。
 */
export function retainThoughtSignature(existing: string | undefined, incoming: string | undefined): string | undefined {
	if (typeof incoming === "string" && incoming.length > 0) return incoming;
	return existing;
}

// Thought signatures must be base64 for Google APIs (TYPE_BYTES).
// 对于 Google API（TYPE_BYTES），思考签名必须是 base64 格式。
const base64SignaturePattern = /^[A-Za-z0-9+/]+={0,2}$/;

function isValidThoughtSignature(signature: string | undefined): boolean {
	if (!signature) return false;
	if (signature.length % 4 !== 0) return false;
	return base64SignaturePattern.test(signature);
}

/**
 * Only keep signatures from the same provider/model and with valid base64.
 * 仅保留来自相同提供商/模型且 base64 格式合法的签名。
 */
function resolveThoughtSignature(isSameProviderAndModel: boolean, signature: string | undefined): string | undefined {
	return isSameProviderAndModel && isValidThoughtSignature(signature) ? signature : undefined;
}

/**
 * Models via Google APIs that require explicit tool call IDs in function calls/responses.
 * 判断通过 Google API 访问的模型是否要求在函数调用/响应中显式携带工具调用（tool call）ID。
 */
export function requiresToolCallId(modelId: string): boolean {
	return modelId.startsWith("claude-") || modelId.startsWith("gpt-oss-");
}

function getGeminiMajorVersion(modelId: string): number | undefined {
	const match = modelId.toLowerCase().match(/^gemini(?:-live)?-(\d+)/);
	if (!match) return undefined;
	return Number.parseInt(match[1], 10);
}

function supportsMultimodalFunctionResponse(modelId: string): boolean {
	const geminiMajorVersion = getGeminiMajorVersion(modelId);
	if (geminiMajorVersion !== undefined) {
		return geminiMajorVersion >= 3;
	}
	return true;
}

/**
 * Convert internal messages to Gemini Content[] format.
 * 将内部消息（message）转换为 Gemini 的 Content[] 格式。
 */
export function convertMessages<T extends GoogleApiType>(model: Model<T>, context: Context): Content[] {
	const contents: Content[] = [];
	const normalizeToolCallId = (id: string): string => {
		if (!requiresToolCallId(model.id)) return id;
		return id.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
	};

	const transformedMessages = transformMessages(context.messages, model, normalizeToolCallId);

	for (const msg of transformedMessages) {
		if (msg.role === "user") {
			if (typeof msg.content === "string") {
				contents.push({
					role: "user",
					parts: [{ text: sanitizeSurrogates(msg.content) }],
				});
			} else {
				const parts: Part[] = msg.content.map((item) => {
					if (item.type === "text") {
						return { text: sanitizeSurrogates(item.text) };
					} else {
						return {
							inlineData: {
								mimeType: item.mimeType,
								data: item.data,
							},
						};
					}
				});
				if (parts.length === 0) continue;
				contents.push({
					role: "user",
					parts,
				});
			}
		} else if (msg.role === "assistant") {
			const parts: Part[] = [];
			// Check if message is from same provider and model - only then keep thinking blocks
			// 检查消息是否来自相同的提供商和模型——只有这样才保留思考块（thinking block）
			const isSameProviderAndModel = msg.provider === model.provider && msg.model === model.id;

			for (const block of msg.content) {
				if (block.type === "text") {
					const thoughtSignature = resolveThoughtSignature(isSameProviderAndModel, block.textSignature);
					// Skip empty text blocks — unless they carry a thought signature. Gemini can attach
					// 跳过空的文本块——除非它们携带思考签名。Gemini 可能会把签名附加到
					// the signature to a part whose visible text is empty and requires it echoed back;
					// 可见文本为空的 part 上，并要求原样回传该签名；
					// dropping it breaks the reasoning chain and the model intermittently ends mid-task
					// 丢弃它会打断推理链，导致模型偶尔会在任务中途以仅含思考的 STOP 结束这一轮
					// turns with a thought-only STOP (empty completion, no tool call).
					// （空的补全结果，且没有工具调用）。
					if ((!block.text || block.text.trim() === "") && !thoughtSignature) continue;
					parts.push({
						text: sanitizeSurrogates(block.text),
						...(thoughtSignature && { thoughtSignature }),
					});
				} else if (block.type === "thinking") {
					// Only keep as thinking block if same provider AND same model
					// 仅当提供商和模型都相同时才保留为思考块（thinking block）
					// Otherwise convert to plain text (no tags to avoid model mimicking them)
					// 否则转换为纯文本（不加标签，以免模型模仿这些标签）
					if (isSameProviderAndModel) {
						const thoughtSignature = resolveThoughtSignature(isSameProviderAndModel, block.thinkingSignature);
						// Same rule as text blocks: an empty thinking block is dropped only when it
						// 与文本块规则相同：只有当空的思考块不携带签名时才会被丢弃
						// carries no signature (mirrors the anthropic converter's handling).
						//（与 anthropic 转换器的处理方式保持一致）。
						if ((!block.thinking || block.thinking.trim() === "") && !thoughtSignature) continue;
						parts.push({
							thought: true,
							text: sanitizeSurrogates(block.thinking),
							...(thoughtSignature && { thoughtSignature }),
						});
					} else {
						// Cross-provider/model: the signature is unusable, empty blocks stay dropped.
						// 跨提供商/模型时：签名不可用，空块仍然被丢弃。
						if (!block.thinking || block.thinking.trim() === "") continue;
						parts.push({
							text: sanitizeSurrogates(block.thinking),
						});
					}
				} else if (block.type === "toolCall") {
					const thoughtSignature = resolveThoughtSignature(isSameProviderAndModel, block.thoughtSignature);
					const part: Part = {
						functionCall: {
							name: block.name,
							args: block.arguments ?? {},
							...(requiresToolCallId(model.id) ? { id: block.id } : {}),
						},
						...(thoughtSignature && { thoughtSignature }),
					};
					parts.push(part);
				}
			}

			if (parts.length === 0) continue;
			contents.push({
				role: "model",
				parts,
			});
		} else if (msg.role === "toolResult") {
			// Extract text and image content
			// 提取文本和图片内容
			const textContent = msg.content.filter((c): c is TextContent => c.type === "text");
			const textResult = textContent.map((c) => c.text).join("\n");
			const imageContent = model.input.includes("image")
				? msg.content.filter((c): c is ImageContent => c.type === "image")
				: [];

			const hasText = textResult.length > 0;
			const hasImages = imageContent.length > 0;

			// Gemini 3+ models support multimodal function responses with images nested inside
			// Gemini 3 及以上版本的模型支持多模态函数响应，图片可嵌套在
			// functionResponse.parts. Claude and other non-Gemini models behind Cloud Code Assist /
			// functionResponse.parts 中。Cloud Code Assist 背后的 Claude 及其他非 Gemini 模型，
			// Gemini < 3 still needs a separate user image turn.
			// 以及 Gemini 3 以下版本，仍然需要单独的一轮 user 图片消息。
			const modelSupportsMultimodalFunctionResponse = supportsMultimodalFunctionResponse(model.id);

			// Use "output" key for success, "error" key for errors as per SDK documentation
			// 按照 SDK 文档要求：成功时使用 "output" 键，出错时使用 "error" 键
			const responseValue = hasText ? sanitizeSurrogates(textResult) : hasImages ? "(see attached image)" : "";

			const imageParts: Part[] = imageContent.map((imageBlock) => ({
				inlineData: {
					mimeType: imageBlock.mimeType,
					data: imageBlock.data,
				},
			}));

			const includeId = requiresToolCallId(model.id);
			const functionResponsePart: Part = {
				functionResponse: {
					name: msg.toolName,
					response: msg.isError ? { error: responseValue } : { output: responseValue },
					...(hasImages && modelSupportsMultimodalFunctionResponse && { parts: imageParts }),
					...(includeId ? { id: msg.toolCallId } : {}),
				},
			};

			// Cloud Code Assist API requires all function responses to be in a single user turn.
			// Cloud Code Assist API 要求所有函数响应都放在同一轮 user 消息中。
			// Check if the last content is already a user turn with function responses and merge.
			// 检查最后一条内容是否已经是包含函数响应的 user 轮次，若是则合并。
			const lastContent = contents[contents.length - 1];
			if (lastContent?.role === "user" && lastContent.parts?.some((p) => p.functionResponse)) {
				lastContent.parts.push(functionResponsePart);
			} else {
				contents.push({
					role: "user",
					parts: [functionResponsePart],
				});
			}

			// For Gemini < 3, add images in a separate user message
			// 对于 Gemini 3 以下版本，在单独的一条 user 消息中添加图片
			if (hasImages && !modelSupportsMultimodalFunctionResponse) {
				contents.push({
					role: "user",
					parts: [{ text: "Tool result image:" }, ...imageParts],
				});
			}
		}
	}

	return contents;
}

const JSON_SCHEMA_META_DECLARATIONS = new Set([
	"$schema",
	"$id",
	"$anchor",
	"$dynamicAnchor",
	"$vocabulary",
	"$comment",
	"$defs",
	"definitions", // pre-draft-2019-09 equivalent of $defs / draft-2019-09 之前版本中等价于 $defs 的字段
]);

/**
 * Strip meta-declarations from a schema obj
 * 从 schema 对象中剥离元声明（meta-declaration）字段
 */
function sanitizeForOpenApi(schema: unknown): unknown {
	if (typeof schema !== "object" || schema === null || Array.isArray(schema)) {
		return schema;
	}

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(schema)) {
		if (JSON_SCHEMA_META_DECLARATIONS.has(key)) continue;
		result[key] = sanitizeForOpenApi(value);
	}
	return result;
}

/**
 * Convert tools to Gemini function declarations format.
 * 将工具（tool）转换为 Gemini 的函数声明（function declaration）格式。
 *
 * By default uses `parametersJsonSchema` which supports full JSON Schema (including
 * anyOf, oneOf, const, etc.). Set `useParameters` to true to use the legacy `parameters`
 * field instead (OpenAPI 3.03 Schema). This is needed for Cloud Code Assist with Claude
 * models, where the API translates `parameters` into Anthropic's `input_schema`.
 * 默认使用 `parametersJsonSchema`，它支持完整的 JSON Schema（包括 anyOf、oneOf、const 等）。
 * 将 `useParameters` 设为 true 则改用旧版的 `parameters` 字段（OpenAPI 3.03 Schema）。
 * 在 Cloud Code Assist 上使用 Claude 模型时需要这样做，因为该 API 会把 `parameters`
 * 转换为 Anthropic 的 `input_schema`。
 */
export function convertTools(
	tools: Tool[],
	useParameters = false,
): { functionDeclarations: Record<string, unknown>[] }[] | undefined {
	if (tools.length === 0) return undefined;
	return [
		{
			functionDeclarations: tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				...(useParameters
					? { parameters: sanitizeForOpenApi(tool.parameters as unknown) }
					: { parametersJsonSchema: tool.parameters }),
			})),
		},
	];
}

/**
 * Gemini 3+ enforces required function parameters in validated tool-calling modes.
 * Gemini 3 及以上版本在受校验的工具调用模式下会强制要求必填的函数参数。
 */
export function supportsGoogleStrictToolSampling(modelId: string): boolean {
	const majorVersion = getGeminiMajorVersion(modelId);
	return majorVersion !== undefined && majorVersion >= 3;
}

/**
 * Map tool choice string to Gemini FunctionCallingConfigMode.
 * 将工具选择（tool choice）字符串映射为 Gemini 的 FunctionCallingConfigMode。
 */
export function mapToolChoice(choice: string): FunctionCallingConfigMode {
	switch (choice) {
		case "auto":
			return FunctionCallingConfigMode.AUTO;
		case "none":
			return FunctionCallingConfigMode.NONE;
		case "any":
			return FunctionCallingConfigMode.ANY;
		default:
			return FunctionCallingConfigMode.AUTO;
	}
}

export function resolveGoogleFunctionCallingMode(
	tools: Tool[],
	toolChoice: string | undefined,
	supportsStrictMode: boolean,
): FunctionCallingConfigMode | undefined {
	const useStrictMode = tools.some((tool) => resolveJsonSchemaStrictSampling(tool, supportsStrictMode) === true);
	if (toolChoice === "none" || toolChoice === "any") {
		return mapToolChoice(toolChoice);
	}
	if (useStrictMode) {
		return FunctionCallingConfigMode.VALIDATED;
	}
	return toolChoice ? mapToolChoice(toolChoice) : undefined;
}

/**
 * Map Gemini FinishReason to our StopReason.
 * 将 Gemini 的 FinishReason 映射为我们内部的 StopReason。
 */
export function mapStopReason(reason: FinishReason): StopReason {
	switch (reason) {
		case FinishReason.STOP:
			return "stop";
		case FinishReason.MAX_TOKENS:
			return "length";
		case FinishReason.BLOCKLIST:
		case FinishReason.PROHIBITED_CONTENT:
		case FinishReason.SPII:
		case FinishReason.SAFETY:
		case FinishReason.IMAGE_SAFETY:
		case FinishReason.IMAGE_PROHIBITED_CONTENT:
		case FinishReason.IMAGE_RECITATION:
		case FinishReason.IMAGE_OTHER:
		case FinishReason.RECITATION:
		case FinishReason.FINISH_REASON_UNSPECIFIED:
		case FinishReason.OTHER:
		case FinishReason.LANGUAGE:
		case FinishReason.MALFORMED_FUNCTION_CALL:
		case FinishReason.UNEXPECTED_TOOL_CALL:
		case FinishReason.NO_IMAGE:
			return "error";
		default: {
			const _exhaustive: never = reason;
			throw new Error(`Unhandled stop reason: ${_exhaustive}`);
		}
	}
}

/**
 * Map string finish reason to our StopReason (for raw API responses).
 * 将字符串形式的结束原因映射为我们内部的 StopReason（用于原始 API 响应）。
 */
export function mapStopReasonString(reason: string): StopReason {
	switch (reason) {
		case "STOP":
			return "stop";
		case "MAX_TOKENS":
			return "length";
		default:
			return "error";
	}
}
