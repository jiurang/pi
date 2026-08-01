/**
 * Inter-extension event bus example.
 * 扩展间事件总线（event bus）示例。
 *
 * Shows pi.events for communication between extensions. One extension
 * can emit events that other extensions listen to.
 * 演示如何使用 pi.events 在扩展之间通信。一个扩展可以发出事件，
 * 供其他扩展监听。
 *
 * Usage: /emit [event-name] [data] - emit an event on the bus
 * 用法：/emit [event-name] [data] —— 在总线上发出一个事件
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	// Store ctx for use in event handler
	// 保存 ctx 以便在事件处理器中使用
	let currentCtx: ExtensionContext | undefined;

	pi.on("session_start", async (_event, ctx) => {
		currentCtx = ctx;
	});

	// Listen for events from other extensions
	// 监听来自其他扩展的事件
	pi.events.on("my:notification", (data) => {
		const { message, from } = data as { message: string; from: string };
		currentCtx?.ui.notify(`Event from ${from}: ${message}`, "info");
	});

	// Command to emit events (emits "my:notification" which the listener above receives)
	// 用于发出事件的命令（发出 "my:notification"，由上面的监听器接收）
	pi.registerCommand("emit", {
		description: "Emit my:notification event (usage: /emit message)",
		handler: async (args, _ctx) => {
			const message = args.trim() || "hello";
			pi.events.emit("my:notification", { message, from: "/emit command" });
			// Listener above will show the notification
			// 上面的监听器会显示该通知
		},
	});

	// Example: emit on session start
	// 示例：在会话开始时发出事件
	pi.on("session_start", async () => {
		pi.events.emit("my:notification", {
			message: "Session started",
			from: "event-bus-example",
		});
	});
}
