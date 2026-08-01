import { createModelRegistry, getModelRuntime } from "./model-runtime-test-utils.ts";
/**
 * E2E tests for AgentSession compaction behavior.
 * AgentSession 压缩（compaction）行为的端到端（E2E）测试。
 *
 * These tests use real LLM calls (no mocking) to verify:
 * 这些测试使用真实的 LLM 调用（不做 mock）来验证：
 * - Manual compaction works correctly
 *   手动压缩能正确工作
 * - Session persistence during compaction
 *   压缩过程中的会话持久化
 * - Compaction entry is saved to session file
 *   压缩条目被保存到会话文件中
 */

import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Agent } from "@earendil-works/pi-agent-core";
import { getModel, streamSimple } from "@earendil-works/pi-ai/compat";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentSession, type AgentSessionEvent } from "../src/core/agent-session.ts";
import { AuthStorage } from "../src/core/auth-storage.ts";
import { SessionManager } from "../src/core/session-manager.ts";
import { SettingsManager } from "../src/core/settings-manager.ts";
import { createCodingTools } from "../src/index.ts";
import { API_KEY, createTestResourceLoader } from "./utilities.ts";

describe.skipIf(!API_KEY)("AgentSession compaction e2e", () => {
	let session: AgentSession;
	let tempDir: string;
	let sessionManager: SessionManager;
	let events: AgentSessionEvent[];

	beforeEach(async () => {
		// Create temp directory for session files
		// 为会话文件创建临时目录
		tempDir = join(tmpdir(), `pi-compaction-test-${Date.now()}`);
		mkdirSync(tempDir, { recursive: true });

		// Track events
		// 跟踪事件
		events = [];
	});

	afterEach(async () => {
		if (session) {
			session.dispose();
		}
		if (tempDir && existsSync(tempDir)) {
			rmSync(tempDir, { recursive: true });
		}
	});

	async function createSession(inMemory = false) {
		const model = getModel("anthropic", "claude-sonnet-4-5")!;
		const agent = new Agent({
			getApiKey: () => API_KEY,
			streamFn: streamSimple,
			initialState: {
				model,
				systemPrompt: "You are a helpful assistant. Be concise.",
				tools: createCodingTools(process.cwd()),
			},
		});

		sessionManager = inMemory ? SessionManager.inMemory() : SessionManager.create(tempDir);
		const settingsManager = SettingsManager.create(tempDir, tempDir);
		// Use minimal keepRecentTokens so small test conversations have something to summarize
		// 使用最小的 keepRecentTokens，以便小规模的测试对话也有内容可供总结
		settingsManager.applyOverrides({ compaction: { keepRecentTokens: 1 } });
		const authStorage = AuthStorage.create(join(tempDir, "auth.json"));
		const modelRegistry = await createModelRegistry(authStorage);

		session = new AgentSession({
			agent,
			sessionManager,
			settingsManager,
			cwd: tempDir,
			modelRuntime: getModelRuntime(modelRegistry),
			resourceLoader: createTestResourceLoader(),
		});

		// Subscribe to track events
		// 订阅以跟踪事件
		session.subscribe((event) => {
			events.push(event);
		});

		return session;
	}

	it("should trigger manual compaction via compact()", async () => {
		await createSession();

		// Send a few prompts to build up history
		// 发送若干提示词以累积历史记录
		await session.prompt("What is 2+2? Reply with just the number.");
		await session.agent.waitForIdle();

		await session.prompt("What is 3+3? Reply with just the number.");
		await session.agent.waitForIdle();

		// Manually compact
		// 手动执行压缩
		const result = await session.compact();

		expect(result.summary).toBeDefined();
		expect(result.summary.length).toBeGreaterThan(0);
		expect(result.tokensBefore).toBeGreaterThan(0);

		// Verify messages were compacted (should have summary + recent)
		// 验证消息已被压缩（应包含摘要 + 最近的消息）
		const messages = session.messages;
		expect(messages.length).toBeGreaterThan(0);

		// First message should be the summary (a user message with summary content)
		// 第一条消息应该是摘要（一条包含摘要内容的用户消息）
		const firstMsg = messages[0];
		expect(firstMsg.role).toBe("compactionSummary");
	}, 120000);

	it("should maintain valid session state after compaction", async () => {
		await createSession();

		// Build up history
		// 累积历史记录
		await session.prompt("What is the capital of France? One word answer.");
		await session.agent.waitForIdle();

		await session.prompt("What is the capital of Germany? One word answer.");
		await session.agent.waitForIdle();

		// Compact
		// 执行压缩
		await session.compact();

		// Session should still be usable
		// 会话应仍然可用
		await session.prompt("What is the capital of Italy? One word answer.");
		await session.agent.waitForIdle();

		// Should have messages after compaction
		// 压缩之后应仍有消息
		expect(session.messages.length).toBeGreaterThan(0);

		// The agent should have responded
		// 智能体（agent）应已作出响应
		const assistantMessages = session.messages.filter((m) => m.role === "assistant");
		expect(assistantMessages.length).toBeGreaterThan(0);
	}, 180000);

	it("should persist compaction to session file", async () => {
		await createSession();

		await session.prompt("Say hello");
		await session.agent.waitForIdle();

		await session.prompt("Say goodbye");
		await session.agent.waitForIdle();

		// Compact
		// 执行压缩
		await session.compact();

		// Load entries from session manager
		// 从会话管理器（session manager）加载条目
		const entries = sessionManager.getEntries();

		// Should have a compaction entry
		// 应存在一条压缩条目
		const compactionEntries = entries.filter((e) => e.type === "compaction");
		expect(compactionEntries.length).toBe(1);

		const compaction = compactionEntries[0];
		expect(compaction.type).toBe("compaction");
		if (compaction.type === "compaction") {
			expect(compaction.summary.length).toBeGreaterThan(0);
			expect(typeof compaction.firstKeptEntryId).toBe("string");
			expect(compaction.tokensBefore).toBeGreaterThan(0);
		}
	}, 120000);

	it("should work with --no-session mode (in-memory only)", async () => {
		// 内存模式（in-memory mode）
		await createSession(true); // in-memory mode

		// Send prompts
		// 发送提示词
		await session.prompt("What is 2+2? Reply with just the number.");
		await session.agent.waitForIdle();

		await session.prompt("What is 3+3? Reply with just the number.");
		await session.agent.waitForIdle();

		// Compact should work even without file persistence
		// 即使没有文件持久化，压缩也应能正常工作
		const result = await session.compact();

		expect(result.summary).toBeDefined();
		expect(result.summary.length).toBeGreaterThan(0);

		// In-memory entries should have the compaction
		// 内存中的条目应包含此次压缩记录
		const entries = sessionManager.getEntries();
		const compactionEntries = entries.filter((e) => e.type === "compaction");
		expect(compactionEntries.length).toBe(1);
	}, 120000);

	it("should emit compaction events during manual compaction", async () => {
		await createSession();

		// Build some history
		// 构建一些历史记录
		await session.prompt("Say hello");
		await session.agent.waitForIdle();

		// Manually trigger compaction and check events
		// 手动触发压缩并检查事件
		await session.compact();

		const compactionEvents = events.filter((e) => e.type === "compaction_start" || e.type === "compaction_end");
		expect(compactionEvents).toHaveLength(2);
		expect(compactionEvents[0]).toEqual({ type: "compaction_start", reason: "manual" });
		expect(compactionEvents[1]).toMatchObject({
			type: "compaction_end",
			reason: "manual",
			aborted: false,
			willRetry: false,
		});

		// Regular events should have been emitted
		// 常规事件应已被发出
		const messageEndEvents = events.filter((e) => e.type === "message_end");
		expect(messageEndEvents.length).toBeGreaterThan(0);
	}, 120000);
});
