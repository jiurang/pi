/**
 * Branch summarization for tree navigation.
 * 用于会话树导航的分支摘要（branch summarization）。
 *
 * When navigating to a different point in the session tree, this generates
 * a summary of the branch being left so context isn't lost.
 * 当导航到会话树中的另一个节点时，本模块会为即将离开的分支生成一份摘要，以免丢失上下文。
 */

import type { AgentMessage, StreamFn } from "@earendil-works/pi-agent-core";
import type { RetryCallbacks, RetryPolicy } from "@earendil-works/pi-ai";
import { contentText } from "@earendil-works/pi-ai";
import type { Model, SimpleStreamOptions, Usage } from "@earendil-works/pi-ai/compat";
import {
	convertToLlm,
	createBranchSummaryMessage,
	createCompactionSummaryMessage,
	createCustomMessage,
} from "../messages.ts";
import type { ReadonlySessionManager, SessionEntry } from "../session-manager.ts";
import { completeSummarization, estimateTokens } from "./compaction.ts";
import {
	computeFileLists,
	createFileOps,
	extractFileOpsFromMessage,
	type FileOperations,
	formatFileOperations,
	SUMMARIZATION_SYSTEM_PROMPT,
	serializeConversation,
} from "./utils.ts";

// ============================================================================
// Types
// 类型定义
// ============================================================================

export interface BranchSummaryResult {
	summary?: string;
	usage?: Usage;
	readFiles?: string[];
	modifiedFiles?: string[];
	aborted?: boolean;
	error?: string;
}

/**
 * Details stored in BranchSummaryEntry.details for file tracking
 * 存放于 BranchSummaryEntry.details 中、用于文件追踪的详情数据
 */
export interface BranchSummaryDetails {
	readFiles: string[];
	modifiedFiles: string[];
}

export type { FileOperations } from "./utils.ts";

export interface BranchPreparation {
	/**
	 * Messages extracted for summarization, in chronological order
	 * 为生成摘要而提取出的消息，按时间先后排序
	 */
	messages: AgentMessage[];
	/**
	 * File operations extracted from tool calls
	 * 从工具调用中提取出的文件操作
	 */
	fileOps: FileOperations;
	/**
	 * Total estimated tokens in messages
	 * 这些消息估算出的 token 总数
	 */
	totalTokens: number;
}

export interface CollectEntriesResult {
	/**
	 * Entries to summarize, in chronological order
	 * 待生成摘要的条目，按时间先后排序
	 */
	entries: SessionEntry[];
	/**
	 * Common ancestor between old and new position, if any
	 * 旧位置与新位置之间的共同祖先节点（若存在）
	 */
	commonAncestorId: string | null;
}

export interface GenerateBranchSummaryOptions {
	/**
	 * Model to use for summarization
	 * 用于生成摘要的模型
	 */
	model: Model<any>;
	/**
	 * API key for the model
	 * 该模型使用的 API key
	 */
	apiKey?: string;
	/**
	 * Request headers for the model
	 * 该模型请求所携带的请求头
	 */
	headers?: Record<string, string>;
	/**
	 * Provider-scoped environment values for the model
	 * 该模型对应的、按服务商（provider）划分作用域的环境变量值
	 */
	env?: Record<string, string>;
	/**
	 * Abort signal for cancellation
	 * 用于取消操作的中止信号（abort signal）
	 */
	signal: AbortSignal;
	/**
	 * Optional custom instructions for summarization
	 * 可选的摘要自定义指令
	 */
	customInstructions?: string;
	/**
	 * If true, customInstructions replaces the default prompt instead of being appended
	 * 若为 true，则 customInstructions 会替换默认提示词，而不是追加在其后
	 */
	replaceInstructions?: boolean;
	/**
	 * Tokens reserved for prompt + LLM response (default 16384)
	 * 为提示词与 LLM 响应预留的 token 数量（默认 16384）
	 */
	reserveTokens?: number;
	/**
	 * Optional session stream function. Used to preserve SDK request behavior without mutating agent state.
	 * 可选的会话流式函数。用于在不改动智能体状态的前提下保持 SDK 的请求行为一致。
	 */
	streamFn?: StreamFn;
	/**
	 * Retry policy for transient summarization errors. Reuses coding-agent's `settings.retry`.
	 * 针对摘要过程中瞬时错误的重试策略。复用 coding-agent 的 `settings.retry` 配置。
	 */
	retry?: RetryPolicy;
	/**
	 * Optional callbacks for retry reporting (e.g. TUI retry indicators).
	 * 可选的重试上报回调（例如 TUI 中的重试指示器）。
	 */
	callbacks?: RetryCallbacks;
}

// ============================================================================
// Entry Collection
// 条目收集
// ============================================================================

/**
 * Collect entries that should be summarized when navigating from one position to another.
 * 收集从一个位置导航到另一个位置时应当被纳入摘要的条目。
 *
 * Walks from oldLeafId back to the common ancestor with targetId, collecting entries
 * along the way. Does NOT stop at compaction boundaries - those are included and their
 * summaries become context.
 * 从 oldLeafId 向上回溯到它与 targetId 的共同祖先，沿途收集条目。
 * 不会在压缩（compaction）边界处停止 —— 这些边界条目同样会被纳入，其摘要将成为上下文的一部分。
 *
 * @param session - Session manager (read-only access)
 *                  会话管理器（只读访问）
 * @param oldLeafId - Current position (where we're navigating from)
 *                    当前位置（导航的起点）
 * @param targetId - Target position (where we're navigating to)
 *                   目标位置（导航的终点）
 * @returns Entries to summarize and the common ancestor
 *          待生成摘要的条目以及共同祖先节点
 */
export function collectEntriesForBranchSummary(
	session: ReadonlySessionManager,
	oldLeafId: string | null,
	targetId: string,
): CollectEntriesResult {
	// If no old position, nothing to summarize
	// 如果没有旧位置，则没有任何内容需要生成摘要
	if (!oldLeafId) {
		return { entries: [], commonAncestorId: null };
	}

	// Find common ancestor (deepest node that's on both paths)
	// 查找共同祖先（同时位于两条路径上的最深节点）
	const oldPath = new Set(session.getBranch(oldLeafId).map((e) => e.id));
	const targetPath = session.getBranch(targetId);

	// targetPath is root-first, so iterate backwards to find deepest common ancestor
	// targetPath 是从根节点开始排列的，因此需要倒序遍历以找到最深的共同祖先
	let commonAncestorId: string | null = null;
	for (let i = targetPath.length - 1; i >= 0; i--) {
		if (oldPath.has(targetPath[i].id)) {
			commonAncestorId = targetPath[i].id;
			break;
		}
	}

	// Collect entries from old leaf back to common ancestor
	// 从旧的叶子节点向上回溯到共同祖先，收集沿途的条目
	const entries: SessionEntry[] = [];
	let current: string | null = oldLeafId;

	while (current && current !== commonAncestorId) {
		const entry = session.getEntry(current);
		if (!entry) break;
		entries.push(entry);
		current = entry.parentId;
	}

	// Reverse to get chronological order
	// 反转数组以得到按时间先后排列的顺序
	entries.reverse();

	return { entries, commonAncestorId };
}

// ============================================================================
// Entry to Message Conversion
// 条目到消息的转换
// ============================================================================

/**
 * Extract AgentMessage from a session entry.
 * 从会话条目中提取出 AgentMessage。
 * Similar to getMessageFromEntry in compaction.ts but also handles compaction entries.
 * 与 compaction.ts 中的 getMessageFromEntry 类似，但同时还会处理压缩（compaction）条目。
 */
function getMessageFromEntry(entry: SessionEntry): AgentMessage | undefined {
	switch (entry.type) {
		case "message":
			// Skip tool results - context is in assistant's tool call
			// 跳过工具结果 —— 相关上下文已包含在助手消息的工具调用中
			if (entry.message.role === "toolResult") return undefined;
			return entry.message;

		case "custom_message":
			return createCustomMessage(entry.customType, entry.content, entry.display, entry.details, entry.timestamp);

		case "branch_summary":
			return createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp);

		case "compaction":
			return createCompactionSummaryMessage(entry.summary, entry.tokensBefore, entry.timestamp);

		// These don't contribute to conversation content
		// 以下这些条目类型不构成对话内容
		case "thinking_level_change":
		case "model_change":
		case "custom":
		case "label":
		case "session_info":
			return undefined;
	}
}

/**
 * Prepare entries for summarization with token budget.
 * 在 token 预算约束下，为生成摘要准备条目。
 *
 * Walks entries from NEWEST to OLDEST, adding messages until we hit the token budget.
 * This ensures we keep the most recent context when the branch is too long.
 * 从最新条目向最旧条目遍历，不断加入消息直到触达 token 预算上限。
 * 这样可以确保在分支过长时优先保留最近的上下文。
 *
 * Also collects file operations from:
 * 同时还会从以下来源收集文件操作：
 * - Tool calls in assistant messages
 *   助手消息中的工具调用
 * - Existing branch_summary entries' details (for cumulative tracking)
 *   已有 branch_summary 条目的 details 字段（用于累计追踪）
 *
 * @param entries - Entries in chronological order
 *                  按时间先后排序的条目
 * @param tokenBudget - Maximum tokens to include (0 = no limit)
 *                      可纳入的最大 token 数（0 表示不限制）
 */
export function prepareBranchEntries(entries: SessionEntry[], tokenBudget: number = 0): BranchPreparation {
	const messages: AgentMessage[] = [];
	const fileOps = createFileOps();
	let totalTokens = 0;

	// First pass: collect file ops from ALL entries (even if they don't fit in token budget)
	// 第一遍：从所有条目中收集文件操作（即使这些条目放不进 token 预算）
	// This ensures we capture cumulative file tracking from nested branch summaries
	// 这样可以确保捕获嵌套分支摘要中累计的文件追踪信息
	// Only extract from pi-generated summaries (fromHook !== true), not extension-generated ones
	// 只从 pi 自身生成的摘要中提取（fromHook !== true），不从扩展生成的摘要中提取
	for (const entry of entries) {
		if (entry.type === "branch_summary" && !entry.fromHook && entry.details) {
			const details = entry.details as BranchSummaryDetails;
			if (Array.isArray(details.readFiles)) {
				for (const f of details.readFiles) fileOps.read.add(f);
			}
			if (Array.isArray(details.modifiedFiles)) {
				// Modified files go into both edited and written for proper deduplication
				// 被修改的文件会同时计入 edited 与 written，以便正确去重
				for (const f of details.modifiedFiles) {
					fileOps.edited.add(f);
				}
			}
		}
	}

	// Second pass: walk from newest to oldest, adding messages until token budget
	// 第二遍：从最新条目向最旧条目遍历，不断加入消息直到触达 token 预算上限
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		const message = getMessageFromEntry(entry);
		if (!message) continue;

		// Extract file ops from assistant messages (tool calls)
		// 从助手消息（工具调用）中提取文件操作
		extractFileOpsFromMessage(message, fileOps);

		const tokens = estimateTokens(message);

		// Check budget before adding
		// 加入之前先检查预算
		if (tokenBudget > 0 && totalTokens + tokens > tokenBudget) {
			// If this is a summary entry, try to fit it anyway as it's important context
			// 如果这是一条摘要条目，仍尝试把它塞进去，因为它属于重要上下文
			if (entry.type === "compaction" || entry.type === "branch_summary") {
				if (totalTokens < tokenBudget * 0.9) {
					messages.unshift(message);
					totalTokens += tokens;
				}
			}
			// Stop - we've hit the budget
			// 停止 —— 已经触达预算上限
			break;
		}

		messages.unshift(message);
		totalTokens += tokens;
	}

	return { messages, fileOps, totalTokens };
}

// ============================================================================
// Summary Generation
// 摘要生成
// ============================================================================

const BRANCH_SUMMARY_PREAMBLE = `The user explored a different conversation branch before returning here.
Summary of that exploration:

`;

const BRANCH_SUMMARY_PROMPT = `Create a structured summary of this conversation branch for context when returning later.

Use this EXACT format:

## Goal
[What was the user trying to accomplish in this branch?]

## Constraints & Preferences
- [Any constraints, preferences, or requirements mentioned]
- [Or "(none)" if none were mentioned]

## Progress
### Done
- [x] [Completed tasks/changes]

### In Progress
- [ ] [Work that was started but not finished]

### Blocked
- [Issues preventing progress, if any]

## Key Decisions
- **[Decision]**: [Brief rationale]

## Next Steps
1. [What should happen next to continue this work]

Keep each section concise. Preserve exact file paths, function names, and error messages.`;

/**
 * Generate a summary of abandoned branch entries.
 * 为被放弃分支中的条目生成摘要。
 *
 * @param entries - Session entries to summarize (chronological order)
 *                  待生成摘要的会话条目（按时间先后排序）
 * @param options - Generation options
 *                  生成选项
 */
export async function generateBranchSummary(
	entries: SessionEntry[],
	options: GenerateBranchSummaryOptions,
): Promise<BranchSummaryResult> {
	const {
		model,
		apiKey,
		headers,
		env,
		signal,
		customInstructions,
		replaceInstructions,
		reserveTokens = 16384,
		streamFn,
		retry,
		callbacks,
	} = options;

	// Token budget = context window minus reserved space for prompt + response
	// token 预算 = 上下文窗口大小减去为提示词与响应预留的空间
	const contextWindow = model.contextWindow || 128000;
	const tokenBudget = contextWindow - reserveTokens;

	const { messages, fileOps } = prepareBranchEntries(entries, tokenBudget);

	if (messages.length === 0) {
		return { summary: "No content to summarize" };
	}

	// Transform to LLM-compatible messages, then serialize to text
	// 先转换为 LLM 兼容的消息，再序列化为文本
	// Serialization prevents the model from treating it as a conversation to continue
	// 序列化可以避免模型把这些内容当成一段需要继续下去的对话
	const llmMessages = convertToLlm(messages);
	const conversationText = serializeConversation(llmMessages);

	// Build prompt
	// 构建提示词
	let instructions: string;
	if (replaceInstructions && customInstructions) {
		instructions = customInstructions;
	} else if (customInstructions) {
		instructions = `${BRANCH_SUMMARY_PROMPT}\n\nAdditional focus: ${customInstructions}`;
	} else {
		instructions = BRANCH_SUMMARY_PROMPT;
	}
	const promptText = `<conversation>\n${conversationText}\n</conversation>\n\n${instructions}`;

	const summarizationMessages = [
		{
			role: "user" as const,
			content: [{ type: "text" as const, text: promptText }],
			timestamp: Date.now(),
		},
	];

	// Call LLM for summarization. Prefer the session stream function so SDK
	// request behavior (timeouts, retries, attribution headers) stays consistent
	// without running through agent state/events. Retried via completeSummarization
	// so transient stream drops reuse the configured retry policy.
	// 调用 LLM 生成摘要。优先使用会话的流式函数，这样既能让 SDK 的请求行为
	// （超时、重试、归因请求头）保持一致，又不必经过智能体的状态/事件流程。
	// 通过 completeSummarization 进行重试，从而让瞬时的流中断复用已配置的重试策略。
	const context = { systemPrompt: SUMMARIZATION_SYSTEM_PROMPT, messages: summarizationMessages };
	const requestOptions: SimpleStreamOptions = { apiKey, headers, env, signal, maxTokens: 2048 };
	const response = await completeSummarization(model, context, requestOptions, streamFn, retry, callbacks);

	// Check if aborted or errored
	// 检查是否被中止或发生错误
	if (response.stopReason === "aborted") {
		return { aborted: true };
	}
	if (response.stopReason === "error") {
		return { error: response.errorMessage || "Summarization failed" };
	}

	let summary = contentText(response.content);

	// Prepend preamble to provide context about the branch summary
	// 在前面拼接引言，为这份分支摘要提供上下文说明
	summary = BRANCH_SUMMARY_PREAMBLE + summary;

	// Compute file lists and append to summary
	// 计算文件列表并追加到摘要末尾
	const { readFiles, modifiedFiles } = computeFileLists(fileOps);
	summary += formatFileOperations(readFiles, modifiedFiles);

	return {
		summary: summary || "No summary generated",
		usage: response.usage,
		readFiles,
		modifiedFiles,
	};
}
