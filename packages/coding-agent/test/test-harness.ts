import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
/**
 * Test harness for AgentSession runtime testing.
 * 用于 AgentSession 运行时测试的测试脚手架（test harness）。
 *
 * Provides:
 * 提供：
 * - A faux stream function with declarative response sequencing
 *   一个伪造（faux）的流式函数，支持以声明式方式编排响应序列
 * - A one-call factory for a fully wired AgentSession with real in-memory dependencies
 *   一个一次调用即可完成装配的工厂函数，返回依赖真实内存实现、连线完整的 AgentSession
 * - Event capture for assertions
 *   事件捕获能力，便于编写断言
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Agent } from "@earendil-works/pi-agent-core";
import type {
	AssistantMessage,
	AssistantMessageEvent,
	AssistantMessageEventStream,
	Context,
	Model,
	SimpleStreamOptions,
	StopReason,
	TextContent,
	ThinkingContent,
	ToolCall,
	Usage,
} from "@earendil-works/pi-ai";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { AgentSession, type AgentSessionEvent } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import type { Settings } from "../src/core/settings-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import type { InlineExtension, ResourceLoader } from "../src/index.ts";
import {
	type CreateTestExtensionsResultInput,
	createTestExtensionsResult,
	createTestResourceLoader,
} from "./utilities.ts";

// ============================================================================
// Faux model
// 伪造模型（Faux model）
// ============================================================================

const FAUX_PROVIDER = "faux";
const FAUX_MODEL_ID = "faux-1";
const FAUX_API = "anthropic-messages" as const;

export const fauxModel: Model<typeof FAUX_API> = {
	id: FAUX_MODEL_ID,
	name: "Faux Model",
	api: FAUX_API,
	provider: FAUX_PROVIDER,
	baseUrl: "http://localhost:0",
	reasoning: false,
	input: ["text", "image"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 16384,
};

// ============================================================================
// Response description
// 响应描述（Response description）
// ============================================================================

export interface FauxResponse {
	/** Text content blocks. String shorthand becomes a single text block. 文本内容块。使用字符串简写时会变成单个文本块。 */
	text?: string;
	/** Tool calls to include in the response. 要包含在响应中的工具调用（tool call）。 */
	toolCalls?: Array<{ id?: string; name: string; args: Record<string, unknown> }>;
	/** Thinking content. 思考（thinking）内容。 */
	thinking?: string;
	/** Stop reason. Defaults to "stop", or "toolUse" if toolCalls are present, or "error" if error is set. 停止原因。默认为 "stop"；若存在 toolCalls 则为 "toolUse"；若设置了 error 则为 "error"。 */
	stopReason?: StopReason;
	/** Error message. Sets stopReason to "error" if not explicitly set. 错误消息。若未显式设置 stopReason，则会将其置为 "error"。 */
	error?: string;
	/** Usage numbers. Merged with defaults (input: 100, output: 50). 用量（usage）数值。会与默认值合并（input: 100, output: 50）。 */
	usage?: Partial<Usage>;
	/** Delay in ms before the response starts. 响应开始前的延迟毫秒数。 */
	delayMs?: number;
	/** Model overrides (provider, model id) for responses that should look like they came from a different model. 模型覆盖项（provider、model id），用于让响应看起来来自另一个模型。 */
	model?: { provider?: string; id?: string };
}

/** Shorthand: a string becomes a simple text response. 简写形式：字符串会变成一个简单的文本响应。 */
export type FauxResponseInput = FauxResponse | string;

// ============================================================================
// Faux stream function
// 伪造的流式函数（Faux stream function）
// ============================================================================

function normalizeResponse(input: FauxResponseInput): FauxResponse {
	if (typeof input === "string") {
		return { text: input };
	}
	return input;
}

function buildUsage(partial?: Partial<Usage>): Usage {
	const input = partial?.input ?? 100;
	const output = partial?.output ?? 50;
	const cacheRead = partial?.cacheRead ?? 0;
	const cacheWrite = partial?.cacheWrite ?? 0;
	return {
		input,
		output,
		cacheRead,
		cacheWrite,
		totalTokens: partial?.totalTokens ?? input + output + cacheRead + cacheWrite,
		cost: partial?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

let toolCallIdCounter = 0;

function buildAssistantMessage(resp: FauxResponse): AssistantMessage {
	const content: (TextContent | ThinkingContent | ToolCall)[] = [];

	if (resp.thinking) {
		content.push({ type: "thinking", thinking: resp.thinking });
	}
	if (resp.text !== undefined) {
		content.push({ type: "text", text: resp.text });
	}
	if (resp.toolCalls) {
		for (const tc of resp.toolCalls) {
			content.push({
				type: "toolCall",
				id: tc.id ?? `faux_tc_${++toolCallIdCounter}`,
				name: tc.name,
				arguments: tc.args,
			});
		}
	}

	// If no content was added at all, add empty text
	// 如果完全没有添加任何内容，则补一个空文本块
	if (content.length === 0 && !resp.error) {
		content.push({ type: "text", text: "" });
	}

	let stopReason: StopReason;
	if (resp.stopReason) {
		stopReason = resp.stopReason;
	} else if (resp.error) {
		stopReason = "error";
	} else if (resp.toolCalls && resp.toolCalls.length > 0) {
		stopReason = "toolUse";
	} else {
		stopReason = "stop";
	}

	return {
		role: "assistant",
		content,
		api: FAUX_API,
		provider: resp.model?.provider ?? FAUX_PROVIDER,
		model: resp.model?.id ?? FAUX_MODEL_ID,
		usage: buildUsage(resp.usage),
		stopReason,
		errorMessage: resp.error,
		timestamp: Date.now(),
	};
}

// ============================================================================
// Token-level streaming
// 词元级（token-level）流式输出
// ============================================================================

/** Split a string into chunks of varying size (3-5 chars) for simulating token-by-token streaming. 将字符串切分为长度不等（3-5 个字符）的分片，用于模拟逐词元（token）的流式输出。 */
function chunkString(text: string): string[] {
	const chunks: string[] = [];
	let i = 0;
	while (i < text.length) {
		const size = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5 取 3、4 或 5
		chunks.push(text.slice(i, i + size));
		i += size;
	}
	return chunks.length > 0 ? chunks : [""];
}

/**
 * Stream a complete AssistantMessage through an EventStream with realistic
 * 通过 EventStream 流式发送一条完整的 AssistantMessage，并为每个内容块
 * intermediate delta events for each content block.
 * 生成贴近真实场景的中间增量（delta）事件。
 */
function streamWithDeltas(stream: AssistantMessageEventStream, message: AssistantMessage): void {
	// Build partial progressively as we stream content blocks
	// 随着内容块的流式发送，逐步构建 partial（部分消息）
	const partial: AssistantMessage = { ...message, content: [], stopReason: "pending" };
	stream.push({ type: "start", partial: { ...partial } });

	for (let i = 0; i < message.content.length; i++) {
		const block = message.content[i];

		if (block.type === "thinking") {
			partial.content = [...partial.content, { type: "thinking", thinking: "" }];
			stream.push({ type: "thinking_start", contentIndex: i, partial: { ...partial } });

			for (const chunk of chunkString(block.thinking)) {
				(partial.content[i] as ThinkingContent).thinking += chunk;
				stream.push(makeEvent("thinking_delta", i, chunk, partial));
			}

			stream.push({
				type: "thinking_end",
				contentIndex: i,
				content: block.thinking,
				partial: { ...partial },
			});
		} else if (block.type === "text") {
			partial.content = [...partial.content, { type: "text", text: "" }];
			stream.push({ type: "text_start", contentIndex: i, partial: { ...partial } });

			for (const chunk of chunkString(block.text)) {
				(partial.content[i] as TextContent).text += chunk;
				stream.push(makeEvent("text_delta", i, chunk, partial));
			}

			stream.push({
				type: "text_end",
				contentIndex: i,
				content: block.text,
				partial: { ...partial },
			});
		} else if (block.type === "toolCall") {
			const argsJson = JSON.stringify(block.arguments);
			partial.content = [...partial.content, { type: "toolCall", id: block.id, name: block.name, arguments: {} }];
			stream.push({ type: "toolcall_start", contentIndex: i, partial: { ...partial } });

			for (const chunk of chunkString(argsJson)) {
				stream.push(makeEvent("toolcall_delta", i, chunk, partial));
			}

			// Final toolcall has the real parsed arguments
			// 最终的 toolcall 事件携带真正解析后的参数
			(partial.content[i] as ToolCall).arguments = block.arguments;
			stream.push({
				type: "toolcall_end",
				contentIndex: i,
				toolCall: block,
				partial: { ...partial },
			});
		}
	}

	if (message.stopReason === "pending") {
		const error: AssistantMessage = {
			...message,
			stopReason: "error",
			errorMessage: "Faux response ended without a stop reason",
		};
		stream.push({ type: "error", reason: "error", error });
		return;
	}
	if (message.stopReason === "error" || message.stopReason === "aborted") {
		stream.push({ type: "error", reason: message.stopReason, error: message });
		return;
	}
	stream.push({ type: "done", reason: message.stopReason, message });
}

function makeEvent(
	type: "text_delta" | "thinking_delta" | "toolcall_delta",
	contentIndex: number,
	delta: string,
	partial: AssistantMessage,
): AssistantMessageEvent {
	return { type, contentIndex, delta, partial: { ...partial } };
}

// ============================================================================
// Stream function factory
// 流式函数工厂（Stream function factory）
// ============================================================================

export interface FauxStreamFnState {
	/** Number of times the stream function has been called. 该流式函数被调用的次数。 */
	callCount: number;
	/** The context passed to each call, in order. 每次调用传入的上下文（context），按顺序排列。 */
	contexts: Context[];
}

/**
 * Create a faux stream function from a sequence of response descriptions.
 * 根据一组响应描述创建一个伪造的流式函数。
 *
 * The function cycles through responses in order. If more calls are made than
 * 该函数会按顺序循环使用这些响应。若调用次数超过所提供的响应数量，
 * responses provided, it wraps around.
 * 则会回绕到开头重新使用。
 *
 * Returns the stream function and a state object for inspection.
 * 返回该流式函数以及一个可供检查的状态对象。
 */
export function createFauxStreamFn(responses: FauxResponseInput[]): {
	streamFn: (model: Model<any>, context: Context, options?: SimpleStreamOptions) => AssistantMessageEventStream;
	state: FauxStreamFnState;
} {
	if (responses.length === 0) {
		throw new Error("createFauxStreamFn requires at least one response");
	}

	const state: FauxStreamFnState = { callCount: 0, contexts: [] };

	const streamFn = (_model: Model<any>, context: Context, _options?: SimpleStreamOptions) => {
		const index = state.callCount % responses.length;
		state.callCount++;
		state.contexts.push(context);

		const resp = normalizeResponse(responses[index]);
		const message = buildAssistantMessage(resp);
		const stream = createAssistantMessageEventStream();

		const emit = () => {
			streamWithDeltas(stream, message);
		};

		if (resp.delayMs && resp.delayMs > 0) {
			setTimeout(emit, resp.delayMs);
		} else {
			queueMicrotask(emit);
		}

		return stream;
	};

	return { streamFn, state };
}

// ============================================================================
// Session harness
// 会话脚手架（Session harness）
// ============================================================================

export interface HarnessOptions {
	/** Response sequence for the faux provider. Default: single "ok" response. 伪造 provider 的响应序列。默认：单个 "ok" 响应。 */
	responses?: FauxResponseInput[];
	/** Model to use. Default: fauxModel. 要使用的模型。默认：fauxModel。 */
	model?: Model<any>;
	/** Context window override (applied to the model). 上下文窗口（context window）覆盖值（会应用到该模型上）。 */
	contextWindow?: number;
	/** Settings overrides (retry, compaction, etc.). 设置项覆盖（重试、上下文压缩等）。 */
	settings?: Partial<Settings>;
	/** System prompt. Default: "You are a test assistant." 系统提示词（system prompt）。默认："You are a test assistant."。 */
	systemPrompt?: string;
	/** Custom tools to register on the agent. 要注册到 agent 上的自定义工具。 */
	tools?: AgentTool[];
	/** Base tools override (replaces built-in read/bash/edit/write). 基础工具覆盖项（用于替换内置的 read/bash/edit/write）。 */
	baseToolsOverride?: Record<string, AgentTool>;
	/** Optional resource loader override. 可选的资源加载器（resource loader）覆盖项。 */
	resourceLoader?: ResourceLoader;
	/** Inline extensions to load into the session resource loader. 要加载进会话资源加载器的内联（inline）扩展。 */
	extensionFactories?: Array<InlineExtension | CreateTestExtensionsResultInput>;
}

export interface Harness {
	session: AgentSession;
	agent: Agent;
	sessionManager: SessionManager;
	settingsManager: SettingsManager;
	/** Faux stream function state (call count, captured contexts). 伪造流式函数的状态（调用次数、捕获到的上下文）。 */
	faux: FauxStreamFnState;
	/** All events emitted by the session, in order. 该会话发出的全部事件，按顺序排列。 */
	events: AgentSessionEvent[];
	/** Filter captured events by type. 按类型过滤已捕获的事件。 */
	eventsOfType<T extends AgentSessionEvent["type"]>(type: T): Extract<AgentSessionEvent, { type: T }>[];
	/** Temp directory (cleaned up by cleanup()). 临时目录（由 cleanup() 负责清理）。 */
	tempDir: string;
	/** Dispose session and remove temp directory. 释放会话资源并删除临时目录。 */
	cleanup: () => void;
}

function createTempDir(): string {
	const tempDir = join(tmpdir(), `pi-harness-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	mkdirSync(tempDir, { recursive: true });
	return tempDir;
}

async function createHarnessWithResourceLoader(
	options: HarnessOptions,
	resourceLoader: ResourceLoader,
	tempDir: string,
): Promise<Harness> {
	const baseModel = options.model ?? fauxModel;
	const model: Model<any> = options.contextWindow ? { ...baseModel, contextWindow: options.contextWindow } : baseModel;

	const { streamFn, state: fauxState } = createFauxStreamFn(options.responses ?? ["ok"]);

	const agent = new Agent({
		getApiKey: () => "faux-key",
		initialState: {
			model,
			systemPrompt: options.systemPrompt ?? "You are a test assistant.",
			tools: options.tools ?? [],
		},
		streamFn: streamFn,
	});

	const sessionManager = SessionManager.inMemory();
	const settingsManager = SettingsManager.create(tempDir, tempDir);

	if (options.settings) {
		settingsManager.applyOverrides(options.settings);
	}

	const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
	await authStorage.modify(model.provider, async () => ({ type: "api_key", key: "faux-key" }));
	const modelRegistry = await createModelRegistry(authStorage, tempDir);
	modelRegistry.registerProvider(model.provider, {
		baseUrl: model.baseUrl,
		api: model.api,
		models: [
			{
				id: model.id,
				name: model.name,
				api: model.api,
				reasoning: model.reasoning,
				input: model.input,
				cost: model.cost,
				contextWindow: model.contextWindow,
				maxTokens: model.maxTokens,
				baseUrl: model.baseUrl,
			},
		],
	});

	const session = new AgentSession({
		agent,
		sessionManager,
		settingsManager,
		cwd: tempDir,
		modelRuntime: getModelRuntime(modelRegistry),
		resourceLoader,
		baseToolsOverride: options.baseToolsOverride,
	});

	const events: AgentSessionEvent[] = [];
	session.subscribe((event) => {
		events.push(event);
	});

	const cleanup = () => {
		session.dispose();
		if (existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	};

	return {
		session,
		agent,
		sessionManager,
		settingsManager,
		faux: fauxState,
		events,
		eventsOfType<T extends AgentSessionEvent["type"]>(type: T) {
			return events.filter((e): e is Extract<AgentSessionEvent, { type: T }> => e.type === type);
		},
		tempDir,
		cleanup,
	};
}

export async function createHarness(options: HarnessOptions = {}): Promise<Harness> {
	if (options.extensionFactories?.length) {
		throw new Error("createHarness does not support extensionFactories. Use createHarnessWithExtensions().");
	}

	const tempDir = createTempDir();
	return await createHarnessWithResourceLoader(options, options.resourceLoader ?? createTestResourceLoader(), tempDir);
}

export async function createHarnessWithExtensions(options: HarnessOptions = {}): Promise<Harness> {
	const tempDir = createTempDir();
	const extensionsResult = await createTestExtensionsResult(options.extensionFactories ?? [], tempDir);
	const resourceLoader = options.resourceLoader ?? createTestResourceLoader({ extensionsResult });
	return await createHarnessWithResourceLoader(options, resourceLoader, tempDir);
}
