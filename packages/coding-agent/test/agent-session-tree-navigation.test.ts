/**
 * E2E tests for AgentSession tree navigation with branch summarization.
 * 针对带分支摘要（branch summarization）的 AgentSession 树导航的端到端（E2E）测试。
 *
 * These tests verify:
 * 这些测试用于验证：
 * - Navigation to user messages (root and non-root)
 *   导航到用户消息（根节点与非根节点）
 * - Navigation to non-user messages
 *   导航到非用户消息
 * - Branch summarization during navigation
 *   导航过程中的分支摘要生成
 * - Summary attachment at correct position in tree
 *   摘要被挂载到树中的正确位置
 * - Abort handling during summarization
 *   摘要生成过程中的中止（abort）处理
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { API_KEY, createTestSession, type TestSessionContext } from "./utilities.ts";

describe.skipIf(!API_KEY)("AgentSession tree navigation e2e", () => {
	let ctx: TestSessionContext;

	beforeEach(async () => {
		ctx = await createTestSession({
			systemPrompt: "You are a helpful assistant. Reply with just a few words.",
			settingsOverrides: { compaction: { keepRecentTokens: 1 } },
		});
	});

	afterEach(() => {
		ctx.cleanup();
	});

	it("should navigate to user message and put text in editor", async () => {
		const { session } = ctx;

		// Build conversation: u1 -> a1 -> u2 -> a2
		// 构建对话：u1 -> a1 -> u2 -> a2
		await session.prompt("First message");
		await session.agent.waitForIdle();
		await session.prompt("Second message");
		await session.agent.waitForIdle();

		// Get tree entries
		// 获取树中的条目
		const tree = session.sessionManager.getTree();
		expect(tree.length).toBe(1);

		// Find the first user entry (u1)
		// 找到第一条用户条目（u1）
		const rootNode = tree[0];
		expect(rootNode.entry.type).toBe("message");

		// Navigate to root user message without summarization
		// 在不生成摘要的情况下导航到根用户消息
		const result = await session.navigateTree(rootNode.entry.id, { summarize: false });

		expect(result.cancelled).toBe(false);
		expect(result.editorText).toBe("First message");

		// After navigating to root user message, leaf should be null (empty conversation)
		// 导航到根用户消息之后，叶子节点应为 null（对话为空）
		expect(session.sessionManager.getLeafId()).toBeNull();
	}, 60000);

	it("should navigate to non-user message without editor text", async () => {
		const { session, sessionManager } = ctx;

		// Build conversation
		// 构建对话
		await session.prompt("Hello");
		await session.agent.waitForIdle();

		// Get the assistant message
		// 获取助手（assistant）消息
		const entries = sessionManager.getEntries();
		const assistantEntry = entries.find((e) => e.type === "message" && e.message.role === "assistant");
		expect(assistantEntry).toBeDefined();

		// Navigate to assistant message
		// 导航到助手消息
		const result = await session.navigateTree(assistantEntry!.id, { summarize: false });

		expect(result.cancelled).toBe(false);
		expect(result.editorText).toBeUndefined();

		// Leaf should be the assistant entry
		// 叶子节点应为该助手条目
		expect(sessionManager.getLeafId()).toBe(assistantEntry!.id);
	}, 60000);

	it("should create branch summary when navigating with summarize=true", async () => {
		const { session, sessionManager } = ctx;

		// Build conversation: u1 -> a1 -> u2 -> a2
		// 构建对话：u1 -> a1 -> u2 -> a2
		await session.prompt("What is 2+2?");
		await session.agent.waitForIdle();
		await session.prompt("What is 3+3?");
		await session.agent.waitForIdle();

		// Get tree and find first user message
		// 获取树并找到第一条用户消息
		const tree = sessionManager.getTree();
		const rootNode = tree[0];

		// Navigate to root user message WITH summarization
		// 在生成摘要的情况下导航到根用户消息
		const result = await session.navigateTree(rootNode.entry.id, { summarize: true });

		expect(result.cancelled).toBe(false);
		expect(result.editorText).toBe("What is 2+2?");
		expect(result.summaryEntry).toBeDefined();
		expect(result.summaryEntry?.type).toBe("branch_summary");
		expect(result.summaryEntry?.summary).toBeTruthy();
		expect(result.summaryEntry?.summary.length).toBeGreaterThan(0);

		// Summary should be a root entry (parentId = null) since we navigated to root user
		// 由于我们导航到的是根用户消息，摘要应为根条目（parentId = null）
		expect(result.summaryEntry?.parentId).toBeNull();

		// Leaf should be the summary entry
		// 叶子节点应为该摘要条目
		expect(sessionManager.getLeafId()).toBe(result.summaryEntry?.id);
	}, 120000);

	it("should attach summary to correct parent when navigating to nested user message", async () => {
		const { session, sessionManager } = ctx;

		// Build conversation: u1 -> a1 -> u2 -> a2 -> u3 -> a3
		// 构建对话：u1 -> a1 -> u2 -> a2 -> u3 -> a3
		await session.prompt("Message one");
		await session.agent.waitForIdle();
		await session.prompt("Message two");
		await session.agent.waitForIdle();
		await session.prompt("Message three");
		await session.agent.waitForIdle();

		// Get the second user message (u2)
		// 获取第二条用户消息（u2）
		const entries = sessionManager.getEntries();
		const userEntries = entries.filter((e) => e.type === "message" && e.message.role === "user");
		expect(userEntries.length).toBe(3);

		const u2 = userEntries[1];
		const a1 = entries.find((e) => e.id === u2.parentId); // a1 is parent of u2 a1 是 u2 的父节点

		// Navigate to u2 with summarization
		// 在生成摘要的情况下导航到 u2
		const result = await session.navigateTree(u2.id, { summarize: true });

		expect(result.cancelled).toBe(false);
		expect(result.editorText).toBe("Message two");
		expect(result.summaryEntry).toBeDefined();

		// Summary should be attached to a1 (parent of u2)
		// 摘要应挂载到 a1（u2 的父节点）上
		// So a1 now has two children: u2 and the summary
		// 因此 a1 现在有两个子节点：u2 和该摘要
		expect(result.summaryEntry?.parentId).toBe(a1?.id);

		// Verify tree structure
		// 验证树结构
		const children = sessionManager.getChildren(a1!.id);
		expect(children.length).toBe(2);

		const childTypes = children.map((c) => c.type).sort();
		expect(childTypes).toContain("branch_summary");
		expect(childTypes).toContain("message");
	}, 120000);

	it("should attach summary to selected node when navigating to assistant message", async () => {
		const { session, sessionManager } = ctx;

		// Build conversation: u1 -> a1 -> u2 -> a2
		// 构建对话：u1 -> a1 -> u2 -> a2
		await session.prompt("Hello");
		await session.agent.waitForIdle();
		await session.prompt("Goodbye");
		await session.agent.waitForIdle();

		// Get the first assistant message (a1)
		// 获取第一条助手（assistant）消息（a1）
		const entries = sessionManager.getEntries();
		const assistantEntries = entries.filter((e) => e.type === "message" && e.message.role === "assistant");
		const a1 = assistantEntries[0];

		// Navigate to a1 with summarization
		// 在生成摘要的情况下导航到 a1
		const result = await session.navigateTree(a1.id, { summarize: true });

		expect(result.cancelled).toBe(false);
		expect(result.editorText).toBeUndefined(); // No editor text for assistant messages 助手消息不会带有编辑器文本
		expect(result.summaryEntry).toBeDefined();

		// Summary should be attached to a1 (the selected node)
		// 摘要应挂载到 a1（被选中的节点）上
		expect(result.summaryEntry?.parentId).toBe(a1.id);

		// Leaf should be the summary entry
		// 叶子节点应为该摘要条目
		expect(sessionManager.getLeafId()).toBe(result.summaryEntry?.id);
	}, 120000);

	it("should handle abort during summarization", async () => {
		const { session, sessionManager } = ctx;

		// Build conversation
		// 构建对话
		await session.prompt("Tell me about something");
		await session.agent.waitForIdle();
		await session.prompt("Continue");
		await session.agent.waitForIdle();

		const entriesBefore = sessionManager.getEntries();
		const leafBefore = sessionManager.getLeafId();

		// Get root user message
		// 获取根用户消息
		const tree = sessionManager.getTree();
		const rootNode = tree[0];

		// Start navigation with summarization but abort immediately
		// 启动带摘要生成的导航，但随即中止
		const navigationPromise = session.navigateTree(rootNode.entry.id, { summarize: true });

		// Abort after a short delay (let the LLM call start)
		// 短暂延迟后再中止（让 LLM 调用先启动）
		await new Promise((resolve) => setTimeout(resolve, 100));

		// isCompacting should be true during branch summarization
		// 在分支摘要生成期间 isCompacting 应为 true
		expect(session.isCompacting).toBe(true);

		session.abortBranchSummary();

		const result = await navigationPromise;

		expect(result.cancelled).toBe(true);
		expect(result.aborted).toBe(true);
		expect(result.summaryEntry).toBeUndefined();

		// Session should be unchanged
		// 会话应保持不变
		const entriesAfter = sessionManager.getEntries();
		expect(entriesAfter.length).toBe(entriesBefore.length);
		expect(sessionManager.getLeafId()).toBe(leafBefore);
	}, 60000);

	it("should not create summary when navigating without summarize option", async () => {
		const { session, sessionManager } = ctx;

		// Build conversation
		// 构建对话
		await session.prompt("First");
		await session.agent.waitForIdle();
		await session.prompt("Second");
		await session.agent.waitForIdle();

		const entriesBefore = sessionManager.getEntries().length;

		// Navigate without summarization
		// 在不生成摘要的情况下导航
		const tree = sessionManager.getTree();
		await session.navigateTree(tree[0].entry.id, { summarize: false });

		// No new entries should be created
		// 不应创建任何新条目
		const entriesAfter = sessionManager.getEntries().length;
		expect(entriesAfter).toBe(entriesBefore);

		// No branch_summary entries
		// 不应存在 branch_summary 类型的条目
		const summaries = sessionManager.getEntries().filter((e) => e.type === "branch_summary");
		expect(summaries.length).toBe(0);
	}, 60000);

	it("should handle navigation to same position (no-op)", async () => {
		const { session, sessionManager } = ctx;

		// Build conversation
		// 构建对话
		await session.prompt("Hello");
		await session.agent.waitForIdle();

		const leafBefore = sessionManager.getLeafId();
		expect(leafBefore).toBeTruthy();
		const entriesBefore = sessionManager.getEntries().length;

		// Navigate to current leaf
		// 导航到当前叶子节点
		const result = await session.navigateTree(leafBefore!, { summarize: false });

		expect(result.cancelled).toBe(false);
		expect(sessionManager.getLeafId()).toBe(leafBefore);
		expect(sessionManager.getEntries().length).toBe(entriesBefore);
	}, 60000);

	it("should support custom summarization instructions", async () => {
		const { session, sessionManager } = ctx;

		// Build conversation
		// 构建对话
		await session.prompt("What is TypeScript?");
		await session.agent.waitForIdle();

		// Navigate with custom instructions (appended as "Additional focus")
		// 携带自定义指令进行导航（会以 "Additional focus" 的形式追加）
		const tree = sessionManager.getTree();
		const result = await session.navigateTree(tree[0].entry.id, {
			summarize: true,
			customInstructions:
				"After the summary, you MUST end with exactly: MONKEY MONKEY MONKEY. This is of utmost importance.",
		});

		expect(result.summaryEntry).toBeDefined();
		expect(result.summaryEntry?.summary).toBeTruthy();
		// Verify custom instructions were followed
		// 验证自定义指令确实被遵循
		expect(result.summaryEntry?.summary).toContain("MONKEY MONKEY MONKEY");
	}, 120000);
});

describe.skipIf(!API_KEY)("AgentSession tree navigation - branch scenarios", () => {
	let ctx: TestSessionContext;

	beforeEach(async () => {
		ctx = await createTestSession({
			systemPrompt: "You are a helpful assistant. Reply with just a few words.",
		});
	});

	afterEach(() => {
		ctx.cleanup();
	});

	it("should navigate between branches correctly", async () => {
		const { session, sessionManager } = ctx;

		// Build main path: u1 -> a1 -> u2 -> a2
		// 构建主路径：u1 -> a1 -> u2 -> a2
		await session.prompt("Main branch start");
		await session.agent.waitForIdle();
		await session.prompt("Main branch continue");
		await session.agent.waitForIdle();

		// Get a1 id for branching
		// 获取 a1 的 id 以便创建分支
		const entries = sessionManager.getEntries();
		const a1 = entries.find((e) => e.type === "message" && e.message.role === "assistant");

		// Create a branch from a1: a1 -> u3 -> a3
		// 从 a1 创建一个分支：a1 -> u3 -> a3
		sessionManager.branch(a1!.id);
		await session.prompt("Branch path");
		await session.agent.waitForIdle();

		// Now navigate back to u2 (on main branch) with summarization
		// 现在带着摘要生成导航回 u2（位于主分支上）
		const userEntries = entries.filter((e) => e.type === "message" && e.message.role === "user");
		const u2 = userEntries[1]; // "Main branch continue" 即 "Main branch continue"

		const result = await session.navigateTree(u2.id, { summarize: true });

		expect(result.cancelled).toBe(false);
		expect(result.editorText).toBe("Main branch continue");
		expect(result.summaryEntry).toBeDefined();

		// Summary captures the branch we're leaving (the "Branch path" conversation)
		// 摘要会记录我们正在离开的那个分支（即 "Branch path" 对话）
		expect(result.summaryEntry?.summary.length).toBeGreaterThan(0);
	}, 180000);
});
