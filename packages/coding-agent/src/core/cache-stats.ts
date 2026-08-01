import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { SessionEntry } from "./session-manager.ts";

/**
 * Prompt-cache TTL: idle gaps longer than this are worth mentioning as the
 * likely cause of a miss.
 * 提示词缓存(prompt cache)的存活时间(TTL)：超过该时长的空闲间隔值得作为缓存未命中的可能原因加以提示。
 * Anthropic's default cache TTL is 5 minutes.
 * Anthropic 的默认缓存 TTL 为 5 分钟。
 */
export const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Per-turn misses at or below this are cache breakpoint granularity noise.
 * 单轮对话中小于等于该值的未命中量属于缓存断点(cache breakpoint)粒度带来的噪声。
 */
const NOISE_FLOOR_TOKENS = 1024;

/**
 * A counted cache miss on a single assistant message.
 * 单条助手(assistant)消息上被计入统计的一次缓存未命中。
 */
export interface CacheMiss {
	/**
	 * Prompt tokens that were in the previous turn's prompt but not read from cache.
	 * 存在于上一轮提示词(prompt)中、但本次未从缓存读取的提示词 token 数。
	 */
	missedTokens: number;
	/**
	 * Extra dollars paid vs. a full cache hit; 0 when pricing is unknown.
	 * 相对于完全命中缓存所多支付的费用(美元)；价格未知时为 0。
	 */
	missedCost: number;
	/**
	 * Milliseconds since the previous request (which last refreshed the cache).
	 * 距离上一次请求(即最后一次刷新缓存的请求)的毫秒数。
	 */
	idleMs: number;
	/**
	 * True when the model changed relative to the previous request.
	 * 相对于上一次请求模型发生了变更时为 true。
	 */
	modelChanged: boolean;
}

export interface CacheWasteTotals {
	missedTokens: number;
	missedCost: number;
	/**
	 * Number of counted misses (turns above the noise floor).
	 * 被计入统计的未命中次数(即超过噪声下限的轮次数量)。
	 */
	missCount: number;
}

/**
 * Minimal pricing lookup, satisfied by ModelRuntime. Cost is $/million tokens.
 * 最小化的价格查询接口，由 ModelRuntime 实现。成本单位为美元/百万 token。
 */
export interface ModelPriceSource {
	getModel(provider: string, modelId: string): { cost: { cacheRead: number } } | undefined;
}

/**
 * The last request seen by the scan; everything in its prompt should be cached.
 * 扫描过程中遇到的上一次请求；其提示词(prompt)中的所有内容都应当已被缓存。
 */
interface PreviousRequest {
	promptTokens: number;
	modelKey: string;
	timestamp: number;
	/**
	 * Sticky: some earlier request in this scan segment reported cache activity.
	 * 粘性标记(sticky)：本次扫描区段中曾有更早的请求上报过缓存活动。
	 * Distinguishes a total miss on a cache-read-only provider (OpenAI-style,
	 * writes unreported) from a provider that never reports caching at all.
	 * 用于区分“仅上报缓存读取的供应商(provider)(OpenAI 风格，不上报写入)上发生的完全未命中”与“完全不上报缓存信息的供应商”。
	 */
	reportedCache: boolean;
}

/**
 * Compute the cache miss for one assistant message relative to the previous
 * request.
 * 计算某条助手(assistant)消息相对于上一次请求的缓存未命中情况。
 * Returns undefined when nothing is counted: first turn, after a
 * reset, no cache activity ever reported (provider without cache support), or
 * miss below the noise floor.
 * 当无需计入统计时返回 undefined：首轮对话、重置之后、从未上报过缓存活动(供应商不支持缓存)，或未命中量低于噪声下限。
 */
function detectMiss(
	prev: PreviousRequest | undefined,
	message: AssistantMessage,
	models: ModelPriceSource,
): CacheMiss | undefined {
	const usage = message.usage;
	const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
	// A zero-cache turn only counts when cache activity was reported before:
	// 只有在此前上报过缓存活动的情况下，零缓存的一轮才计入统计：
	// on cache-read-only providers that is a total miss, while on providers
	// 在仅上报缓存读取的供应商(provider)上这意味着完全未命中，而在
	// that never report caching it means nothing.
	// 从不上报缓存信息的供应商上则不代表任何含义。
	if (!prev || promptTokens <= 0 || (usage.cacheRead + usage.cacheWrite === 0 && !prev.reportedCache)) {
		return undefined;
	}

	const missedTokens = Math.min(prev.promptTokens, promptTokens) - usage.cacheRead;
	if (missedTokens <= NOISE_FLOOR_TOKENS) return undefined;

	// Extra cost = missed tokens billed at the actual paid rate (input/cacheWrite,
	// 额外成本 = 未命中的 token 按实际支付的费率(input/cacheWrite，
	// incl. write premium) instead of the cache-read rate. Missed tokens can only
	// 含写入溢价)计费，而非按缓存读取费率计费。未命中的 token 只可能
	// land in the input or cacheWrite buckets, so the paid rate comes straight
	// 落入 input 或 cacheWrite 这两个计费项，因此实付费率可直接
	// from this message's own cost breakdown.
	// 从本条消息自身的成本明细中得出。
	const paidTokens = usage.input + usage.cacheWrite;
	const paidPerToken = paidTokens > 0 ? (usage.cost.input + usage.cost.cacheWrite) / paidTokens : 0;
	const readPerToken =
		usage.cacheRead > 0
			? usage.cost.cacheRead / usage.cacheRead
			: (models.getModel(message.provider, message.model)?.cost.cacheRead ?? 0) / 1_000_000;

	return {
		missedTokens,
		missedCost: missedTokens * Math.max(0, paidPerToken - readPerToken),
		idleMs: Math.max(0, message.timestamp - prev.timestamp),
		modelChanged: `${message.provider}/${message.model}` !== prev.modelKey,
	};
}

function asPreviousRequest(message: AssistantMessage, reportedCache: boolean): PreviousRequest | undefined {
	const usage = message.usage;
	const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
	if (promptTokens <= 0) return undefined;
	return {
		promptTokens,
		modelKey: `${message.provider}/${message.model}`,
		timestamp: message.timestamp,
		reportedCache: reportedCache || usage.cacheRead + usage.cacheWrite > 0,
	};
}

function scan(
	entries: SessionEntry[],
	models: ModelPriceSource,
): { prev: PreviousRequest | undefined; totals: CacheWasteTotals; misses: Map<AssistantMessage, CacheMiss> } {
	let prev: PreviousRequest | undefined;
	const totals: CacheWasteTotals = { missedTokens: 0, missedCost: 0, missCount: 0 };
	const misses = new Map<AssistantMessage, CacheMiss>();

	for (const entry of entries) {
		if (entry.type === "compaction" || entry.type === "branch_summary") {
			// The context legitimately changed; the next turn's prompt is new content,
			// 上下文发生了合理变更；下一轮的提示词(prompt)属于新内容，
			// not re-billed content. Model switches are NOT exempt: they re-bill the
			// 而非被重复计费的内容。模型切换不在豁免之列：它会对
			// full prompt and should be counted.
			// 完整提示词重新计费，应当计入统计。
			prev = undefined;
			continue;
		}
		if (entry.type === "message" && entry.message.role === "assistant") {
			const miss = detectMiss(prev, entry.message, models);
			if (miss) {
				totals.missedTokens += miss.missedTokens;
				totals.missedCost += miss.missedCost;
				totals.missCount += 1;
				misses.set(entry.message, miss);
			}
			prev = asPreviousRequest(entry.message, prev?.reportedCache ?? false) ?? prev;
		}
	}
	return { prev, totals, misses };
}

/**
 * Cumulative cache waste across a session: prompt tokens that should have been
 * cache reads (they were in the previous turn's prompt) but were re-billed.
 * 整个会话(session)中累计的缓存浪费：本应以缓存读取方式计费(因为它们已存在于上一轮提示词中)、却被重新计费的提示词 token。
 */
export function computeCacheWaste(entries: SessionEntry[], models: ModelPriceSource): CacheWasteTotals {
	return scan(entries, models).totals;
}

/**
 * All counted cache misses across a session, keyed by the assistant message
 * (by reference) that paid for them.
 * 整个会话(session)中所有被计入统计的缓存未命中，以为其付费的助手(assistant)消息(按引用)作为键。
 * Used to re-derive transcript notices when
 * rebuilding the chat from entries (resume, post-compaction rebuild).
 * 用于在依据条目(entries)重建对话时(恢复会话、压缩后重建)重新推导会话记录中的提示信息。
 */
export function collectCacheMisses(
	entries: SessionEntry[],
	models: ModelPriceSource,
): Map<AssistantMessage, CacheMiss> {
	return scan(entries, models).misses;
}

/**
 * Detect a cache miss on a just-completed assistant message.
 * 检测刚刚完成的助手(assistant)消息上的缓存未命中。
 * `entries` must not yet contain `message` (message_end fires before persistence).
 * `entries` 中必须尚未包含 `message`(message_end 事件在持久化之前触发)。
 */
export function detectCacheMiss(
	entries: SessionEntry[],
	message: AssistantMessage,
	models: ModelPriceSource,
): CacheMiss | undefined {
	return detectMiss(scan(entries, models).prev, message, models);
}
