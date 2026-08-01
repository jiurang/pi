import { execSync, spawn } from "child_process";
import { platform } from "os";
import { isWaylandSession } from "./clipboard-image.ts";
import { clipboard } from "./clipboard-native.ts";

type NativeClipboardExecOptions = {
	input: string;
	timeout: number;
	stdio: ["pipe", "ignore", "ignore"];
};

function copyToX11Clipboard(options: NativeClipboardExecOptions): void {
	try {
		execSync("xclip -selection clipboard", options);
	} catch {
		execSync("xsel --clipboard --input", options);
	}
}

const MAX_OSC52_ENCODED_LENGTH = 100_000;

function isRemoteSession(env: NodeJS.ProcessEnv = process.env): boolean {
	return Boolean(env.SSH_CONNECTION || env.SSH_CLIENT || env.MOSH_CONNECTION);
}

function emitOsc52(text: string): boolean {
	const encoded = Buffer.from(text).toString("base64");
	if (encoded.length > MAX_OSC52_ENCODED_LENGTH) {
		return false;
	}
	process.stdout.write(`\x1b]52;c;${encoded}\x07`);
	return true;
}

/**
 * Read plain text from the system clipboard, if native clipboard access is available.
 * 在原生剪贴板访问可用时，从系统剪贴板读取纯文本。
 */
export async function readClipboardText(): Promise<string | null> {
	if (!clipboard) {
		return null;
	}

	try {
		const text = await clipboard.getText();
		return text || null;
	} catch {
		return null;
	}
}

export async function copyToClipboard(text: string): Promise<void> {
	let copied = false;

	const p = platform();

	// Prefer direct clipboard writes. Emitting OSC 52 first can make terminals
	// write the same native clipboard concurrently with the addon, and very large
	// OSC 52 payloads can desynchronize terminal rendering.
	// 优先使用直接写入剪贴板的方式。先发出 OSC 52 会导致终端与原生插件(addon)并发写入
	// 同一个原生剪贴板，而且超大的 OSC 52 负载可能使终端渲染失去同步。
	//
	// On Linux, skip the native addon. The underlying `clipboard-rs` crate is
	// X11-only and does not retain selection ownership after `set_text`
	// resolves, so on Wayland-only compositors (Hyprland, Niri, ...) and even
	// some X11 sessions the call resolves successfully without populating the
	// clipboard. The platform tools below (wl-copy, xclip, xsel) properly
	// daemonize and keep ownership.
	// 在 Linux 上跳过原生插件。底层的 `clipboard-rs` crate 仅支持 X11，并且在 `set_text`
	// 完成之后不会保留选区所有权(selection ownership)，因此在纯 Wayland 合成器
	// (Hyprland、Niri 等)甚至某些 X11 会话上，该调用会成功返回但剪贴板并没有被写入。
	// 下面的平台工具(wl-copy、xclip、xsel)会正确地以守护进程方式运行并保持所有权。
	try {
		if (clipboard && p !== "linux") {
			await clipboard.setText(text);
			copied = true;
		}
	} catch {
		// Fall through to platform-specific clipboard tools.
		// 继续向下走，改用平台特定的剪贴板工具。
	}

	const remote = isRemoteSession();
	if (copied && !remote) {
		return;
	}

	const options: NativeClipboardExecOptions = { input: text, timeout: 5000, stdio: ["pipe", "ignore", "ignore"] };

	if (!copied) {
		try {
			if (p === "darwin") {
				execSync("pbcopy", options);
				copied = true;
			} else if (p === "win32") {
				execSync("clip", options);
				copied = true;
			} else {
				// Linux. Try Termux, Wayland, or X11 clipboard tools.
				// Linux 平台。依次尝试 Termux、Wayland 或 X11 的剪贴板工具。
				if (process.env.TERMUX_VERSION) {
					try {
						execSync("termux-clipboard-set", options);
						copied = true;
					} catch {
						// Fall back to Wayland or X11 tools.
						// 回退到 Wayland 或 X11 工具。
					}
				}

				if (!copied) {
					const hasWaylandDisplay = Boolean(process.env.WAYLAND_DISPLAY);
					const hasX11Display = Boolean(process.env.DISPLAY);
					const isWayland = isWaylandSession();
					if (isWayland && hasWaylandDisplay) {
						try {
							// Verify wl-copy exists (spawn errors are async and won't be caught)
							// 先确认 wl-copy 存在(spawn 的错误是异步的，无法被捕获)
							execSync("which wl-copy", { stdio: "ignore" });
							// wl-copy with execSync hangs due to fork behavior; use spawn instead.
							// Await the exit code and only claim success on a clean exit, so a
							// failed wl-copy falls through to the xclip/OSC 52 fallbacks.
							// 由于 fork 行为，使用 execSync 调用 wl-copy 会挂起，因此改用 spawn。
							// 等待退出码，且只有在正常退出时才认定成功，这样失败的 wl-copy
							// 才能继续回退到 xclip / OSC 52 方案。
							const wlCopyExit = await new Promise<number>((resolve) => {
								const proc = spawn("wl-copy", [], { stdio: ["pipe", "ignore", "ignore"] });
								proc.on("error", () => resolve(1));
								proc.on("close", (code) => resolve(code ?? 1));
								proc.stdin.on("error", () => {
									// Ignore EPIPE errors if wl-copy exits early
									// 如果 wl-copy 提前退出，忽略 EPIPE 错误
								});
								proc.stdin.write(text);
								proc.stdin.end();
							});
							if (wlCopyExit === 0) {
								copied = true;
							} else if (hasX11Display) {
								copyToX11Clipboard(options);
								copied = true;
							}
						} catch {
							if (hasX11Display) {
								copyToX11Clipboard(options);
								copied = true;
							}
						}
					} else if (hasX11Display) {
						copyToX11Clipboard(options);
						copied = true;
					}
				}
			}
		} catch {
			// Fall through to OSC 52 fallback.
			// 继续向下走，回退到 OSC 52 方案。
		}
	}

	if (remote || !copied) {
		const osc52Copied = emitOsc52(text);
		copied = copied || osc52Copied;
	}

	if (!copied) {
		throw new Error("Failed to copy to clipboard");
	}
}
