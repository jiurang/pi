import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { setKittyProtocolActive } from "./keys.ts";
import { isNativeModifierPressed } from "./native-modifiers.ts";
import { StdinBuffer } from "./stdin-buffer.ts";

const cjsRequire = createRequire(import.meta.url);

const TERMINAL_PROGRESS_KEEPALIVE_MS = 1000;
const TERMINAL_PROGRESS_ACTIVE_SEQUENCE = "\x1b]9;4;3\x07";
const TERMINAL_PROGRESS_CLEAR_SEQUENCE = "\x1b]9;4;0;\x07";
const APPLE_TERMINAL_SHIFT_ENTER_SEQUENCE = "\x1b[13;2u";
const DESIRED_KITTY_KEYBOARD_PROTOCOL_FLAGS = 7;
const KEYBOARD_PROTOCOL_RESPONSE_FRAGMENT_TIMEOUT_MS = 150;
const KITTY_KEYBOARD_PROTOCOL_QUERY = `\x1b[>${DESIRED_KITTY_KEYBOARD_PROTOCOL_FLAGS}u\x1b[?u\x1b[c`;

export type KeyboardProtocolNegotiationSequence =
	| { type: "kitty-flags"; flags: number }
	| { type: "device-attributes" };

export function parseKeyboardProtocolNegotiationSequence(
	sequence: string,
): KeyboardProtocolNegotiationSequence | undefined {
	const kittyFlags = sequence.match(/^\x1b\[\?(\d+)u$/);
	if (kittyFlags) {
		return { type: "kitty-flags", flags: Number.parseInt(kittyFlags[1]!, 10) };
	}
	if (/^\x1b\[\?[\d;]*c$/.test(sequence)) {
		return { type: "device-attributes" };
	}
	return undefined;
}

function isKeyboardProtocolNegotiationSequencePrefix(sequence: string): boolean {
	return sequence === "\x1b[" || /^\x1b\[\?[\d;]*$/.test(sequence);
}

export function isAppleTerminalSession(): boolean {
	return process.platform === "darwin" && process.env.TERM_PROGRAM === "Apple_Terminal";
}

export function normalizeAppleTerminalInput(data: string, isAppleTerminal: boolean, isShiftPressed: boolean): string {
	if (isAppleTerminal && data === "\r" && isShiftPressed) return APPLE_TERMINAL_SHIFT_ENTER_SEQUENCE;
	return data;
}

/**
 * Minimal terminal interface for TUI
 * 供 TUI 使用的最小化终端接口
 */
export interface Terminal {
	// Start the terminal with input and resize handlers
	// 启动终端，并注册输入处理器与尺寸变化处理器
	start(onInput: (data: string) => void, onResize: () => void): void;

	// Stop the terminal and restore state
	// 停止终端并恢复其原有状态
	stop(): void;

	/**
	 * Drain stdin before exiting to prevent Kitty key release events from
	 * leaking to the parent shell over slow SSH connections.
	 * 在退出前排空 stdin，以防止 Kitty 的按键释放事件在慢速 SSH 连接中泄漏到父 shell。
	 * @param maxMs - Maximum time to drain (default: 1000ms)
	 *                排空操作的最长耗时（默认值：1000 毫秒）
	 * @param idleMs - Exit early if no input arrives within this time (default: 50ms)
	 *                 若在该时间内没有新输入到达，则提前退出（默认值：50 毫秒）
	 */
	drainInput(maxMs?: number, idleMs?: number): Promise<void>;

	// Write output to terminal
	// 向终端写入输出内容
	write(data: string): void;

	// Get terminal dimensions
	// 获取终端的尺寸
	get columns(): number;
	get rows(): number;

	// Whether Kitty keyboard protocol is active
	// Kitty 键盘协议当前是否处于启用状态
	get kittyProtocolActive(): boolean;

	// Cursor positioning (relative to current position)
	// 光标定位（相对于当前位置）
	moveBy(lines: number): void; // Move cursor up (negative) or down (positive) by N lines 将光标向上（负值）或向下（正值）移动 N 行

	// Cursor visibility
	// 光标可见性
	hideCursor(): void; // Hide the cursor 隐藏光标
	showCursor(): void; // Show the cursor 显示光标

	// Clear operations
	// 清除类操作
	clearLine(): void; // Clear current line 清除当前行
	clearFromCursor(): void; // Clear from cursor to end of screen 从光标处一直清除到屏幕末尾
	clearScreen(): void; // Clear entire screen and move cursor to (0,0) 清除整个屏幕并将光标移动到 (0,0)

	// Title operations
	// 标题类操作
	setTitle(title: string): void; // Set terminal window title 设置终端窗口标题

	// Progress indicator (OSC 9;4)
	// 进度指示器（OSC 9;4）
	setProgress(active: boolean): void;
}

/**
 * Real terminal using process.stdin/stdout
 * 基于 process.stdin/stdout 实现的真实终端
 */
export class ProcessTerminal implements Terminal {
	private wasRaw = false;
	private inputHandler?: (data: string) => void;
	private resizeHandler?: () => void;
	private _kittyProtocolActive = false;
	private _modifyOtherKeysActive = false;
	private keyboardProtocolPushed = false;
	private keyboardProtocolNegotiationBuffer = "";
	private keyboardProtocolBufferFlushTimer?: ReturnType<typeof setTimeout>;
	private stdinBuffer?: StdinBuffer;
	private stdinDataHandler?: (data: string) => void;
	private progressInterval?: ReturnType<typeof setInterval>;
	private writeLogPath = (() => {
		const env = process.env.PI_TUI_WRITE_LOG || "";
		if (!env) return "";
		try {
			if (fs.statSync(env).isDirectory()) {
				const now = new Date();
				const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`;
				return path.join(env, `tui-${ts}-${process.pid}.log`);
			}
		} catch {
			// Not an existing directory - use as-is (file path)
			// 该路径并非已存在的目录 —— 直接按原样使用（作为文件路径）
		}
		return env;
	})();

	get kittyProtocolActive(): boolean {
		return this._kittyProtocolActive;
	}

	get modifyOtherKeysActive(): boolean {
		return this._modifyOtherKeysActive;
	}

	start(onInput: (data: string) => void, onResize: () => void): void {
		this.inputHandler = onInput;
		this.resizeHandler = onResize;

		// Save previous state and enable raw mode
		// 保存先前的状态并启用原始（raw）模式
		this.wasRaw = process.stdin.isRaw || false;
		if (process.stdin.setRawMode) {
			process.stdin.setRawMode(true);
		}
		process.stdin.setEncoding("utf8");
		process.stdin.resume();

		// Enable bracketed paste mode - terminal will wrap pastes in \x1b[200~ ... \x1b[201~
		// 启用括号粘贴（bracketed paste）模式 —— 终端会用 \x1b[200~ ... \x1b[201~ 包裹粘贴内容
		process.stdout.write("\x1b[?2004h");

		// Set up resize handler immediately
		// 立即注册尺寸变化处理器
		process.stdout.on("resize", this.resizeHandler);

		// Refresh terminal dimensions - they may be stale after suspend/resume
		// (SIGWINCH is lost while process is stopped). Unix only.
		// 刷新终端尺寸 —— 在挂起/恢复之后这些数据可能已经过期
		//（进程被停止期间 SIGWINCH 信号会丢失）。仅适用于 Unix 系统。
		if (process.platform !== "win32") {
			process.kill(process.pid, "SIGWINCH");
		}

		// On Windows, enable ENABLE_VIRTUAL_TERMINAL_INPUT so the console sends
		// VT escape sequences (e.g. \x1b[Z for Shift+Tab) instead of raw console
		// events that lose modifier information.
		// 在 Windows 上启用 ENABLE_VIRTUAL_TERMINAL_INPUT，使控制台发送 VT 转义序列
		//（例如 Shift+Tab 对应 \x1b[Z），而不是会丢失修饰键信息的原始控制台事件。
		// Must run AFTER setRawMode(true)
		// since that resets console mode flags.
		// 必须在 setRawMode(true) 之后执行，因为该调用会重置控制台的模式标志位。
		this.enableWindowsVTInput();

		// Query Kitty keyboard protocol and fall back to modifyOtherKeys when DA confirms no Kitty response.
		// 查询 Kitty 键盘协议；当 DA 响应确认终端未返回 Kitty 响应时，回退到 modifyOtherKeys 方案。
		// See: https://sw.kovidgoyal.net/kitty/keyboard-protocol/
		// 参见：https://sw.kovidgoyal.net/kitty/keyboard-protocol/
		this.queryAndEnableKittyProtocol();
	}

	/**
	 * Set up StdinBuffer to split batched input into individual sequences.
	 * 设置 StdinBuffer，将成批到达的输入拆分为一个个独立的序列。
	 * This ensures components receive single events, making matchesKey/isKeyRelease work correctly.
	 * 这样可确保各组件接收到的是单个事件，从而使 matchesKey/isKeyRelease 能够正常工作。
	 *
	 * Also watches for Kitty protocol response and enables it when detected.
	 * 同时还会监听 Kitty 协议的响应，一旦检测到就启用该协议。
	 * This is done here (after stdinBuffer parsing) rather than on raw stdin
	 * to handle the case where the response arrives split across multiple events.
	 * 之所以放在这里处理（即在 stdinBuffer 解析之后）而非直接在原始 stdin 上处理，
	 * 是为了应对响应被拆分到多个事件中分批到达的情况。
	 */
	private setupStdinBuffer(): void {
		this.stdinBuffer = new StdinBuffer({ timeout: 10 });

		// Forward individual sequences to the input handler
		// 将各个独立的序列转发给输入处理器
		this.stdinBuffer.on("data", (sequence) => {
			const negotiationSequence = this.readKeyboardProtocolNegotiationSequence(sequence);
			if (negotiationSequence === "pending") {
				this.scheduleKeyboardProtocolNegotiationBufferFlush();
				return; // Wait briefly for the rest of a split Kitty response. 短暂等待被拆分的 Kitty 响应的剩余部分。
			}
			if (this.handleKeyboardProtocolNegotiationSequence(negotiationSequence)) {
				return;
			}

			this.forwardInputSequence(sequence);
		});

		// Re-wrap paste content with bracketed paste markers for existing editor handling
		// 用括号粘贴标记重新包裹粘贴内容，以便沿用编辑器现有的处理逻辑
		this.stdinBuffer.on("paste", (content) => {
			if (this.inputHandler) {
				this.inputHandler(`\x1b[200~${content}\x1b[201~`);
			}
		});

		// Handler that pipes stdin data through the buffer
		// 将 stdin 数据导入缓冲区的处理器
		this.stdinDataHandler = (data: string) => {
			this.stdinBuffer!.process(data);
		};
	}

	/**
	 * Query terminal for Kitty keyboard protocol support and enable it if available.
	 * 查询终端是否支持 Kitty 键盘协议，若支持则将其启用。
	 *
	 * Kitty's progressive enhancement detection requires requesting the desired
	 * flags before querying them.
	 * Kitty 的渐进增强（progressive enhancement）检测机制要求先请求所需的标志位，然后再对其进行查询。
	 * The trailing DA query is a sentinel supported by
	 * terminals that do not know Kitty keyboard protocol; receiving DA before a
	 * Kitty response enables modifyOtherKeys fallback without a startup timeout.
	 * 末尾附加的 DA 查询是一个哨兵探针，不认识 Kitty 键盘协议的终端同样支持它；
	 * 如果在收到 Kitty 响应之前先收到了 DA 响应，就可以直接回退到 modifyOtherKeys 方案，
	 * 而无需在启动时等待超时。
	 *
	 * The requested flags are:
	 * 所请求的标志位含义如下：
	 * - 1 = disambiguate escape codes
	 *   1 = 消除转义码的歧义
	 * - 2 = report event types (press/repeat/release)
	 *   2 = 上报事件类型（按下/重复/释放）
	 * - 4 = report alternate keys (shifted key, base layout key)
	 *   4 = 上报备选按键（Shift 组合后的按键、基础键盘布局对应的按键）
	 */
	private queryAndEnableKittyProtocol(): void {
		this.setupStdinBuffer();
		process.stdin.on("data", this.stdinDataHandler!);
		this.keyboardProtocolPushed = true;
		this.clearKeyboardProtocolNegotiationBuffer();
		process.stdout.write(KITTY_KEYBOARD_PROTOCOL_QUERY);
	}

	private handleKeyboardProtocolNegotiationSequence(
		negotiationSequence: KeyboardProtocolNegotiationSequence | undefined,
	): boolean {
		if (!negotiationSequence) return false;
		this.clearKeyboardProtocolNegotiationBuffer();
		if (negotiationSequence.type === "kitty-flags") {
			if (negotiationSequence.flags !== 0) {
				this.disableModifyOtherKeys();
				if (!this._kittyProtocolActive) {
					this._kittyProtocolActive = true;
					setKittyProtocolActive(true);
				}
			} else {
				this.enableModifyOtherKeys();
			}
			return true;
		}

		if (!this._kittyProtocolActive) {
			this.enableModifyOtherKeys();
		}
		return true;
	}

	private readKeyboardProtocolNegotiationSequence(
		sequence: string,
	): KeyboardProtocolNegotiationSequence | "pending" | undefined {
		if (this.keyboardProtocolNegotiationBuffer) {
			const bufferedSequence = this.keyboardProtocolNegotiationBuffer + sequence;
			const negotiationSequence = parseKeyboardProtocolNegotiationSequence(bufferedSequence);
			if (negotiationSequence) {
				this.clearKeyboardProtocolNegotiationBuffer();
				return negotiationSequence;
			}
			if (isKeyboardProtocolNegotiationSequencePrefix(bufferedSequence)) {
				this.setKeyboardProtocolNegotiationBuffer(bufferedSequence);
				return "pending";
			}
			this.flushKeyboardProtocolNegotiationBufferAsInput();
		}

		const negotiationSequence = parseKeyboardProtocolNegotiationSequence(sequence);
		if (negotiationSequence) return negotiationSequence;
		if (isKeyboardProtocolNegotiationSequencePrefix(sequence)) {
			this.setKeyboardProtocolNegotiationBuffer(sequence);
			return "pending";
		}
		return undefined;
	}

	private setKeyboardProtocolNegotiationBuffer(sequence: string): void {
		this.clearKeyboardProtocolNegotiationBufferFlushTimer();
		this.keyboardProtocolNegotiationBuffer = sequence;
	}

	private clearKeyboardProtocolNegotiationBuffer(): void {
		this.clearKeyboardProtocolNegotiationBufferFlushTimer();
		this.keyboardProtocolNegotiationBuffer = "";
	}

	private flushKeyboardProtocolNegotiationBufferAsInput(): void {
		if (!this.keyboardProtocolNegotiationBuffer) return;
		const sequence = this.keyboardProtocolNegotiationBuffer;
		this.clearKeyboardProtocolNegotiationBuffer();
		this.forwardInputSequence(sequence);
	}

	private scheduleKeyboardProtocolNegotiationBufferFlush(): void {
		if (!this.keyboardProtocolNegotiationBuffer || this.keyboardProtocolBufferFlushTimer) return;
		this.keyboardProtocolBufferFlushTimer = setTimeout(() => {
			this.keyboardProtocolBufferFlushTimer = undefined;
			this.flushKeyboardProtocolNegotiationBufferAsInput();
		}, KEYBOARD_PROTOCOL_RESPONSE_FRAGMENT_TIMEOUT_MS);
	}

	private clearKeyboardProtocolNegotiationBufferFlushTimer(): void {
		if (!this.keyboardProtocolBufferFlushTimer) return;
		clearTimeout(this.keyboardProtocolBufferFlushTimer);
		this.keyboardProtocolBufferFlushTimer = undefined;
	}

	private forwardInputSequence(sequence: string): void {
		if (!this.inputHandler) return;
		const isAppleTerminal = sequence === "\r" && isAppleTerminalSession();
		const input = normalizeAppleTerminalInput(
			sequence,
			isAppleTerminal,
			isAppleTerminal && isNativeModifierPressed("shift"),
		);
		this.inputHandler(input);
	}

	private enableModifyOtherKeys(): void {
		if (this._kittyProtocolActive || this._modifyOtherKeysActive) return;
		process.stdout.write("\x1b[>4;2m");
		this._modifyOtherKeysActive = true;
	}

	private disableModifyOtherKeys(): void {
		if (!this._modifyOtherKeysActive) return;
		process.stdout.write("\x1b[>4;0m");
		this._modifyOtherKeysActive = false;
	}

	/**
	 * On Windows, add ENABLE_VIRTUAL_TERMINAL_INPUT (0x0200) to the stdin
	 * console handle so the terminal sends VT sequences for modified keys
	 * (e.g. \x1b[Z for Shift+Tab).
	 * 在 Windows 上，为 stdin 的控制台句柄添加 ENABLE_VIRTUAL_TERMINAL_INPUT (0x0200)，
	 * 使终端针对带修饰键的按键发送 VT 序列（例如 Shift+Tab 对应 \x1b[Z）。
	 * Without this, libuv's ReadConsoleInputW
	 * discards modifier state and Shift+Tab arrives as plain \t.
	 * 若不这样做，libuv 的 ReadConsoleInputW 会丢弃修饰键状态，
	 * 导致 Shift+Tab 最终只表现为普通的 \t。
	 */
	private enableWindowsVTInput(): void {
		if (process.platform !== "win32") return;
		try {
			const arch = process.arch;
			if (arch !== "x64" && arch !== "arm64") return;

			// Dynamic require so non-Windows and bundled/browser paths never load the
			// native helper.
			// 使用动态 require，从而确保非 Windows 环境以及打包/浏览器场景永远不会加载该原生辅助模块。
			// In the npm package native/ is next to dist/; in compiled
			// binary archives native/ is copied next to the executable.
			// 在 npm 包中，native/ 与 dist/ 处于同级目录；
			// 而在编译生成的二进制归档中，native/ 会被复制到可执行文件旁边。
			const moduleDir = path.dirname(fileURLToPath(import.meta.url));
			const nativePath = path.join("native", "win32", "prebuilds", `win32-${arch}`, "win32-console-mode.node");
			const candidates = [
				path.join(moduleDir, "..", nativePath),
				path.join(moduleDir, nativePath),
				path.join(path.dirname(process.execPath), nativePath),
			];
			for (const modulePath of candidates) {
				try {
					const helper = cjsRequire(modulePath) as { enableVirtualTerminalInput?: () => boolean };
					helper.enableVirtualTerminalInput?.();
					return;
				} catch {
					// Try the next possible packaging location.
					// 继续尝试下一个可能的打包路径。
				}
			}
		} catch {
			// Native helper not available — Shift+Tab won't be distinguishable from Tab.
			// 原生辅助模块不可用 —— 将无法把 Shift+Tab 与 Tab 区分开来。
		}
	}

	async drainInput(maxMs = 1000, idleMs = 50): Promise<void> {
		const shouldDisableKittyProtocol = this.keyboardProtocolPushed || this._kittyProtocolActive;
		this.clearKeyboardProtocolNegotiationBuffer();
		if (shouldDisableKittyProtocol) {
			// Disable Kitty keyboard protocol first so any late key releases
			// do not generate new Kitty escape sequences.
			// 先禁用 Kitty 键盘协议，这样任何迟到的按键释放事件都不会再生成新的 Kitty 转义序列。
			process.stdout.write("\x1b[<u");
			this.keyboardProtocolPushed = false;
			this._kittyProtocolActive = false;
			setKittyProtocolActive(false);
		}
		this.disableModifyOtherKeys();

		const previousHandler = this.inputHandler;
		this.inputHandler = undefined;

		let lastDataTime = Date.now();
		const onData = () => {
			lastDataTime = Date.now();
		};

		process.stdin.on("data", onData);
		const endTime = Date.now() + maxMs;

		try {
			while (true) {
				const now = Date.now();
				const timeLeft = endTime - now;
				if (timeLeft <= 0) break;
				if (now - lastDataTime >= idleMs) break;
				await new Promise((resolve) => setTimeout(resolve, Math.min(idleMs, timeLeft)));
			}
		} finally {
			process.stdin.removeListener("data", onData);
			this.inputHandler = previousHandler;
		}
	}

	stop(): void {
		if (this.clearProgressInterval()) {
			process.stdout.write(TERMINAL_PROGRESS_CLEAR_SEQUENCE);
		}

		// Disable bracketed paste mode
		// 禁用括号粘贴模式
		process.stdout.write("\x1b[?2004l");

		const shouldDisableKittyProtocol = this.keyboardProtocolPushed || this._kittyProtocolActive;
		this.clearKeyboardProtocolNegotiationBuffer();

		// Disable Kitty keyboard protocol if not already done by drainInput()
		// 如果 drainInput() 尚未执行过该操作，则在此禁用 Kitty 键盘协议
		if (shouldDisableKittyProtocol) {
			process.stdout.write("\x1b[<u");
			this.keyboardProtocolPushed = false;
			this._kittyProtocolActive = false;
			setKittyProtocolActive(false);
		}
		this.disableModifyOtherKeys();

		// Clean up StdinBuffer
		// 清理 StdinBuffer
		if (this.stdinBuffer) {
			this.stdinBuffer.destroy();
			this.stdinBuffer = undefined;
		}

		// Remove event handlers
		// 移除事件处理器
		if (this.stdinDataHandler) {
			process.stdin.removeListener("data", this.stdinDataHandler);
			this.stdinDataHandler = undefined;
		}
		this.inputHandler = undefined;
		if (this.resizeHandler) {
			process.stdout.removeListener("resize", this.resizeHandler);
			this.resizeHandler = undefined;
		}

		// Pause stdin to prevent any buffered input (e.g., Ctrl+D) from being
		// re-interpreted after raw mode is disabled.
		// 暂停 stdin，以防止缓冲区中残留的输入（例如 Ctrl+D）在原始模式被禁用后遭到重新解读。
		// This fixes a race condition
		// where Ctrl+D could close the parent shell over SSH.
		// 这修复了一个竞态条件：在 SSH 场景下 Ctrl+D 有可能把父 shell 关闭掉。
		process.stdin.pause();

		// Restore raw mode state
		// 恢复原始模式的状态
		if (process.stdin.setRawMode) {
			process.stdin.setRawMode(this.wasRaw);
		}
	}

	write(data: string): void {
		process.stdout.write(data);
		if (this.writeLogPath) {
			try {
				fs.appendFileSync(this.writeLogPath, data, { encoding: "utf8" });
			} catch {
				// Ignore logging errors
				// 忽略写日志过程中产生的错误
			}
		}
	}

	get columns(): number {
		return process.stdout.columns || Number(process.env.COLUMNS) || 80;
	}

	get rows(): number {
		return process.stdout.rows || Number(process.env.LINES) || 24;
	}

	moveBy(lines: number): void {
		if (lines > 0) {
			// Move down
			// 向下移动
			process.stdout.write(`\x1b[${lines}B`);
		} else if (lines < 0) {
			// Move up
			// 向上移动
			process.stdout.write(`\x1b[${-lines}A`);
		}
		// lines === 0: no movement
		// lines === 0：不做任何移动
	}

	hideCursor(): void {
		process.stdout.write("\x1b[?25l");
	}

	showCursor(): void {
		process.stdout.write("\x1b[?25h");
	}

	clearLine(): void {
		process.stdout.write("\x1b[K");
	}

	clearFromCursor(): void {
		process.stdout.write("\x1b[J");
	}

	clearScreen(): void {
		process.stdout.write("\x1b[2J\x1b[H"); // Clear screen and move to home (1,1) 清屏并将光标移动到起始位置 (1,1)
	}

	setTitle(title: string): void {
		// OSC 0;title BEL - set terminal window title
		// OSC 0;title BEL —— 设置终端窗口标题
		process.stdout.write(`\x1b]0;${title}\x07`);
	}

	setProgress(active: boolean): void {
		if (active) {
			// OSC 9;4;3 - indeterminate progress
			// OSC 9;4;3 —— 不确定进度（indeterminate）状态
			process.stdout.write(TERMINAL_PROGRESS_ACTIVE_SEQUENCE);
			if (!this.progressInterval) {
				this.progressInterval = setInterval(() => {
					process.stdout.write(TERMINAL_PROGRESS_ACTIVE_SEQUENCE);
				}, TERMINAL_PROGRESS_KEEPALIVE_MS);
			}
		} else {
			this.clearProgressInterval();
			// OSC 9;4;0 - clear progress
			// OSC 9;4;0 —— 清除进度指示
			process.stdout.write(TERMINAL_PROGRESS_CLEAR_SEQUENCE);
		}
	}

	private clearProgressInterval(): boolean {
		if (!this.progressInterval) return false;
		clearInterval(this.progressInterval);
		this.progressInterval = undefined;
		return true;
	}
}
