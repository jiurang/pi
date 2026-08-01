import { contentText, type Model, type Models, type RetryCallbacks, type RetryPolicy } from "@earendil-works/pi-ai";

import type { AgentMessage } from "../../types.ts";
import {
	convertToLlm,
	createBranchSummaryMessage,
	createCompactionSummaryMessage,
	createCustomMessage,
} from "../messages.ts";
import type { BranchSummaryResult, Session, SessionTreeEntry } from "../types.ts";
import { BranchSummaryError, err, ok, type Result, SessionError } from "../types.ts";
import { completeSimpleWithRetries, estimateTokens, SUMMARIZATION_SYSTEM_PROMPT } from "./compaction.ts";
import {
	computeFileLists,
	createFileOps,
	extractFileOpsFromMessage,
	type FileOperations,
	formatFileOperations,
	serializeConversation,
} from "./utils.ts";

/**
 * File-operation details stored on generated branch summary entries.
 * 存储在生成的分支摘要条目上的文件操作详情。
 */
export interface BranchSummaryDetails {
	/**
	 * Files read while exploring the summarized branch.
	 * 在探索被摘要分支的过程中读取过的文件。
	 */
	readFiles: string[];
	/**
	 * Files modified while exploring the summarized branch.
	 * 在探索被摘要分支的过程中修改过的文件。
	 */
	modifiedFiles: string[];
}

export type { FileOperations } from "./utils.ts";

/**
 * Prepared branch content for summarization.
 * 为摘要生成而准备好的分支内容。
 */
export interface BranchPreparation {
	/**
	 * Messages selected for the branch summary.
	 * 为分支摘要选定的消息。
	 */
	messages: AgentMessage[];
	/**
	 * File operations extracted from the branch.
	 * 从该分支中提取出的文件操作。
	 */
	fileOps: FileOperations;
	/**
	 * Estimated token count for selected messages.
	 * 选定消息的预估 token 数量。
	 */
	totalTokens: number;
}

/**
 * Entries selected for branch summarization.
 * 为分支摘要选定的条目。
 */
export interface CollectEntriesResult {
	/**
	 * Entries to summarize in chronological order.
	 * 按时间顺序排列的待摘要条目。
	 */
	entries: SessionTreeEntry[];
	/**
	 * Deepest common ancestor between the previous leaf and target entry.
	 * 前一个叶子节点与目标条目之间最深的公共祖先。
	 */
	commonAncestorId: string | null;
}

/**
 * Options for generating a branch summary.
 * 生成分支摘要的选项。
 */
export interface GenerateBranchSummaryOptions {
	/**
	 * Provider collection the summarization request goes through; owns auth resolution.
	 * 摘要请求所经过的提供方（provider）集合；负责鉴权解析。
	 */
	models: Models;
	/**
	 * Model used for summarization.
	 * 用于生成摘要的模型。
	 */
	model: Model<any>;
	/**
	 * Abort signal for the summarization request.
	 * 摘要请求的中止信号（abort signal）。
	 */
	signal: AbortSignal;
	/**
	 * Optional instructions appended to or replacing the default prompt.
	 * 可选的指令，用于追加到默认提示词之后或替换默认提示词。
	 */
	customInstructions?: string;
	/**
	 * Replace the default prompt with custom instructions instead of appending them.
	 * 用自定义指令替换默认提示词，而不是追加到其后。
	 */
	replaceInstructions?: boolean;
	/**
	 * Tokens reserved for prompt and model output. Defaults to 16384.
	 * 为提示词和模型输出预留的 token 数，默认为 16384。
	 */
	reserveTokens?: number;
	/**
	 * Optional retry policy for transient summarization errors.
	 * 针对摘要过程中瞬时错误的可选重试策略。
	 */
	retry?: RetryPolicy;
	/**
	 * Optional callbacks for retry reporting.
	 * 用于重试情况上报的可选回调。
	 */
	callbacks?: RetryCallbacks;
}

/**
 * Collect entries that should be summarized before navigating to a different session tree entry.
 * 在跳转到会话树中的其他条目之前，收集应当被摘要的条目。
 */
export async function collectEntriesForBranchSummary(
	session: Session,
	oldLeafId: string | null,
	targetId: string,
): Promise<CollectEntriesResult> {
	if (!oldLeafId) {
		return { entries: [], commonAncestorId: null };
	}
	const oldPath = new Set((await session.getBranch(oldLeafId)).map((e) => e.id));
	const targetPath = await session.getBranch(targetId);
	let commonAncestorId: string | null = null;
	for (let i = targetPath.length - 1; i >= 0; i--) {
		if (oldPath.has(targetPath[i].id)) {
			commonAncestorId = targetPath[i].id;
			break;
		}
	}
	const entries: SessionTreeEntry[] = [];
	let current: string | null = oldLeafId;

	while (current && current !== commonAncestorId) {
		const entry = await session.getEntry(current);
		if (!entry) throw new SessionError("invalid_session", `Entry ${current} not found`);
		entries.push(entry as SessionTreeEntry);
		current = entry.parentId;
	}
	entries.reverse();

	return { entries, commonAncestorId };
}
function getMessageFromEntry(entry: SessionTreeEntry): AgentMessage | undefined {
	switch (entry.type) {
		case "message":
			if (entry.message.role === "toolResult") return undefined;
			return entry.message;

		case "custom_message":
			return createCustomMessage(entry.customType, entry.content, entry.display, entry.details, entry.timestamp);

		case "branch_summary":
			return createBranchSummaryMessage(entry.summary, entry.fromId, entry.timestamp);

		case "compaction":
			return createCompactionSummaryMessage(entry.summary, entry.tokensBefore, entry.timestamp);
		case "thinking_level_change":
		case "model_change":
		case "active_tools_change":
		case "custom":
		case "label":
		case "session_info":
		case "leaf":
			return undefined;
	}
}

/**
 * Prepare branch entries for summarization within an optional token budget.
 * 在可选的 token 预算范围内，准备用于生成摘要的分支条目。
 */
export function prepareBranchEntries(entries: SessionTreeEntry[], tokenBudget: number = 0): BranchPreparation {
	const messages: AgentMessage[] = [];
	const fileOps = createFileOps();
	let totalTokens = 0;
	for (const entry of entries) {
		if (entry.type === "branch_summary" && !entry.fromHook && entry.details) {
			const details = entry.details as BranchSummaryDetails;
			if (Array.isArray(details.readFiles)) {
				for (const f of details.readFiles) fileOps.read.add(f);
			}
			if (Array.isArray(details.modifiedFiles)) {
				for (const f of details.modifiedFiles) {
					fileOps.edited.add(f);
				}
			}
		}
	}
	for (let i = entries.length - 1; i >= 0; i--) {
		const entry = entries[i];
		const message = getMessageFromEntry(entry);
		if (!message) continue;
		extractFileOpsFromMessage(message, fileOps);

		const tokens = estimateTokens(message);
		if (tokenBudget > 0 && totalTokens + tokens > tokenBudget) {
			if (entry.type === "compaction" || entry.type === "branch_summary") {
				if (totalTokens < tokenBudget * 0.9) {
					messages.unshift(message);
					totalTokens += tokens;
				}
			}
			break;
		}

		messages.unshift(message);
		totalTokens += tokens;
	}

	return { messages, fileOps, totalTokens };
}

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
 * Generate a summary for abandoned branch entries.
 * 为被放弃的分支条目生成摘要。
 */
export async function generateBranchSummary(
	entries: SessionTreeEntry[],
	options: GenerateBranchSummaryOptions,
): Promise<Result<BranchSummaryResult, BranchSummaryError>> {
	const {
		models,
		model,
		signal,
		customInstructions,
		replaceInstructions,
		reserveTokens = 16384,
		retry,
		callbacks,
	} = options;
	const contextWindow = model.contextWindow || 128000;
	const tokenBudget = contextWindow - reserveTokens;

	const { messages, fileOps } = prepareBranchEntries(entries, tokenBudget);

	if (messages.length === 0) {
		return ok({ summary: "No content to summarize", readFiles: [], modifiedFiles: [] });
	}
	const llmMessages = convertToLlm(messages);
	const conversationText = serializeConversation(llmMessages);
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
	const response = await completeSimpleWithRetries(
		models,
		model,
		{ systemPrompt: SUMMARIZATION_SYSTEM_PROMPT, messages: summarizationMessages },
		{ signal, maxTokens: 2048 },
		retry,
		callbacks,
	);
	if (response.stopReason === "aborted") {
		return err(new BranchSummaryError("aborted", response.errorMessage || "Branch summary aborted"));
	}
	if (response.stopReason === "error") {
		return err(
			new BranchSummaryError(
				"summarization_failed",
				`Branch summary failed: ${response.errorMessage || "Unknown error"}`,
			),
		);
	}

	let summary = contentText(response.content);
	summary = BRANCH_SUMMARY_PREAMBLE + summary;
	const { readFiles, modifiedFiles } = computeFileLists(fileOps);
	summary += formatFileOperations(readFiles, modifiedFiles);

	return ok({
		summary: summary || "No summary generated",
		usage: response.usage,
		readFiles,
		modifiedFiles,
	});
}
