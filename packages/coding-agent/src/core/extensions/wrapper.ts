/**
 * Tool wrappers for extension-registered tools.
 * 用于扩展所注册工具的工具包装器。
 *
 * These wrappers only adapt tool execution so extension tools receive the runner context.
 * 这些包装器仅对工具的执行过程做适配，以便扩展工具能够获取到 runner 上下文。
 * Tool call and tool result interception is handled by AgentSession via agent-core hooks.
 * 工具调用与工具结果的拦截由 AgentSession 通过 agent-core 钩子（hooks）负责处理。
 */

import type { AgentTool } from "@earendil-works/pi-agent-core";
import { wrapToolDefinition } from "../tools/tool-definition-wrapper.ts";
import type { ExtensionRunner } from "./runner.ts";
import type { RegisteredTool } from "./types.ts";

/**
 * Wrap a RegisteredTool into an AgentTool.
 * 将 RegisteredTool 包装为 AgentTool。
 * Uses the runner's createContext() for consistent context across tools and event handlers.
 * 使用 runner 的 createContext()，以保证各工具与事件处理器之间的上下文一致。
 */
export function wrapRegisteredTool(registeredTool: RegisteredTool, runner: ExtensionRunner): AgentTool {
	const tool = wrapToolDefinition(registeredTool.definition, () => runner.createContext());
	const execute = tool.execute;
	return {
		...tool,
		execute: async (toolCallId, params, signal, onUpdate) => {
			const activeBefore = runner.getActiveTools();
			const result = await execute(toolCallId, params, signal, onUpdate);
			const activeAfter = runner.getActiveTools();
			if (!activeBefore.every((name) => activeAfter.includes(name))) return result;

			const beforeNames = new Set(activeBefore);
			const addedToolNames = activeAfter.filter((name) => !beforeNames.has(name));
			if (addedToolNames.length === 0) return result;
			return {
				...result,
				addedToolNames: [...new Set([...(result.addedToolNames ?? []), ...addedToolNames])],
			};
		},
	};
}

/**
 * Wrap all registered tools into AgentTools.
 * 将所有已注册的工具包装为 AgentTool。
 * Uses the runner's createContext() for consistent context across tools and event handlers.
 * 使用 runner 的 createContext()，以保证各工具与事件处理器之间的上下文一致。
 */
export function wrapRegisteredTools(registeredTools: RegisteredTool[], runner: ExtensionRunner): AgentTool[] {
	return registeredTools.map((tool) => wrapRegisteredTool(tool, runner));
}
