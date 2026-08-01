/**
 * Pi Notify Extension
 * Pi 通知扩展
 *
 * Sends a native terminal notification when Pi agent is done and waiting for input.
 * 当 Pi agent 执行完毕并等待输入时,发送一条终端原生通知。
 * Supports multiple terminal protocols:
 * 支持多种终端协议:
 * - OSC 777: Ghostty, iTerm2, WezTerm, rxvt-unicode
 *   OSC 777: Ghostty、iTerm2、WezTerm、rxvt-unicode
 * - OSC 99: Kitty
 *   OSC 99: Kitty
 * - Windows toast: Windows Terminal (WSL)
 *   Windows toast(吐司通知): Windows Terminal (WSL)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

function windowsToastScript(title: string, body: string): string {
	const type = "Windows.UI.Notifications";
	const mgr = `[${type}.ToastNotificationManager, ${type}, ContentType = WindowsRuntime]`;
	const template = `[${type}.ToastTemplateType]::ToastText01`;
	const toast = `[${type}.ToastNotification]::new($xml)`;
	return [
		`${mgr} > $null`,
		`$xml = [${type}.ToastNotificationManager]::GetTemplateContent(${template})`,
		`$xml.GetElementsByTagName('text')[0].AppendChild($xml.CreateTextNode('${body}')) > $null`,
		`[${type}.ToastNotificationManager]::CreateToastNotifier('${title}').Show(${toast})`,
	].join("; ");
}

function notifyOSC777(title: string, body: string): void {
	process.stdout.write(`\x1b]777;notify;${title};${body}\x07`);
}

function notifyOSC99(title: string, body: string): void {
	// Kitty OSC 99: i=notification id, d=0 means not done yet, p=body for second part
	// Kitty OSC 99: i=通知 id,d=0 表示尚未结束,p=body 用于第二部分内容
	process.stdout.write(`\x1b]99;i=1:d=0;${title}\x1b\\`);
	process.stdout.write(`\x1b]99;i=1:p=body;${body}\x1b\\`);
}

function notifyWindows(title: string, body: string): void {
	const { execFile } = require("child_process");
	execFile("powershell.exe", ["-NoProfile", "-Command", windowsToastScript(title, body)]);
}

function notify(title: string, body: string): void {
	if (process.env.WT_SESSION) {
		notifyWindows(title, body);
	} else if (process.env.KITTY_WINDOW_ID) {
		notifyOSC99(title, body);
	} else {
		notifyOSC777(title, body);
	}
}

export default function (pi: ExtensionAPI) {
	pi.on("agent_end", async () => {
		notify("Pi", "Ready for input");
	});
}
