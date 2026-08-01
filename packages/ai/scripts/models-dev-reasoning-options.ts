import type { ThinkingLevel, ThinkingLevelMap } from "../src/types.ts";

export type ModelsDevReasoningOption =
	| { type: "toggle" }
	| {
			type: "effort";
			values: Array<"none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max" | "default" | null>;
	  }
	| { type: "budget_tokens"; min?: number; max?: number };

const THINKING_LEVELS: readonly ThinkingLevel[] = ["minimal", "low", "medium", "high", "xhigh", "max"];

/**
 * Converts models.dev verified effort values into Pi's selectable thinking levels.
 * 将 models.dev 已验证的 effort（努力程度）取值转换为 Pi 可选的思考等级。
 * Values without a Pi equivalent (`default` and JSON `null`) are intentionally
 * omitted.
 * 没有 Pi 对应值的取值（`default` 与 JSON 的 `null`）会被有意忽略。
 */
export function getEffortThinkingLevelMap(options: readonly ModelsDevReasoningOption[]): ThinkingLevelMap | undefined {
	const effortValues = options.flatMap((option) => (option.type === "effort" ? option.values : []));
	if (effortValues.length === 0) return undefined;

	const supported = new Set(effortValues);
	if (!THINKING_LEVELS.some((level) => supported.has(level)) && !supported.has("none")) return undefined;

	const map: ThinkingLevelMap = { off: supported.has("none") ? "none" : null };
	for (const level of THINKING_LEVELS) {
		map[level] = supported.has(level) ? level : null;
	}
	return map;
}
