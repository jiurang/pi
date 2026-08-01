import type { Terminal as XtermTerminalType } from "@xterm/headless";
import xterm from "@xterm/headless";
import type { Terminal } from "../src/terminal.ts";

// Extract Terminal class from the module
// 从该模块中取出 Terminal 类
const XtermTerminal = xterm.Terminal;

/**
 * Virtual terminal for testing using xterm.js for accurate terminal emulation
 * 用于测试的虚拟终端，借助 xterm.js 实现精确的终端仿真
 */
export class VirtualTerminal implements Terminal {
	private xterm: XtermTerminalType;
	private inputHandler?: (data: string) => void;
	private resizeHandler?: () => void;
	private _columns: number;
	private _rows: number;

	constructor(columns = 80, rows = 24) {
		this._columns = columns;
		this._rows = rows;

		// Create xterm instance with specified dimensions
		// 按指定尺寸创建 xterm 实例
		this.xterm = new XtermTerminal({
			cols: columns,
			rows: rows,
			// Disable all interactive features for testing
			// 为便于测试，禁用所有交互功能
			disableStdin: true,
			allowProposedApi: true,
		});
	}

	start(onInput: (data: string) => void, onResize: () => void): void {
		this.inputHandler = onInput;
		this.resizeHandler = onResize;
		// Enable bracketed paste mode for consistency with ProcessTerminal
		// 启用括号粘贴模式（bracketed paste），以与 ProcessTerminal 行为保持一致
		this.xterm.write("\x1b[?2004h");
	}

	async drainInput(_maxMs?: number, _idleMs?: number): Promise<void> {
		// No-op for virtual terminal - no stdin to drain
		// 对虚拟终端而言是空操作 —— 没有需要清空的标准输入（stdin）
	}

	stop(): void {
		// Disable bracketed paste mode
		// 禁用括号粘贴模式（bracketed paste）
		this.xterm.write("\x1b[?2004l");
		this.inputHandler = undefined;
		this.resizeHandler = undefined;
	}

	write(data: string): void {
		this.xterm.write(data);
	}

	get columns(): number {
		return this._columns;
	}

	get rows(): number {
		return this._rows;
	}

	get kittyProtocolActive(): boolean {
		// Virtual terminal always reports Kitty protocol as active for testing
		// 为便于测试，虚拟终端始终报告 Kitty 协议处于启用状态
		return true;
	}

	moveBy(lines: number): void {
		if (lines > 0) {
			// Move down
			// 向下移动
			this.xterm.write(`\x1b[${lines}B`);
		} else if (lines < 0) {
			// Move up
			// 向上移动
			this.xterm.write(`\x1b[${-lines}A`);
		}
		// lines === 0: no movement
		// lines === 0：不进行任何移动
	}

	hideCursor(): void {
		this.xterm.write("\x1b[?25l");
	}

	showCursor(): void {
		this.xterm.write("\x1b[?25h");
	}

	clearLine(): void {
		this.xterm.write("\x1b[K");
	}

	clearFromCursor(): void {
		this.xterm.write("\x1b[J");
	}

	clearScreen(): void {
		this.xterm.write("\x1b[2J\x1b[H"); // Clear screen and move to home (1,1) | 清屏并将光标移至左上角原点 (1,1)
	}

	setTitle(title: string): void {
		// OSC 0;title BEL - set terminal window title
		// OSC 0;title BEL - 设置终端窗口标题
		this.xterm.write(`\x1b]0;${title}\x07`);
	}

	setProgress(_active: boolean): void {}

	// Test-specific methods not in Terminal interface
	// 以下为测试专用方法，不属于 Terminal 接口

	/**
	 * Simulate keyboard input
	 * 模拟键盘输入
	 */
	sendInput(data: string): void {
		if (this.inputHandler) {
			this.inputHandler(data);
		}
	}

	/**
	 * Resize the terminal
	 * 调整终端尺寸
	 */
	resize(columns: number, rows: number): void {
		this._columns = columns;
		this._rows = rows;
		this.xterm.resize(columns, rows);
		if (this.resizeHandler) {
			this.resizeHandler();
		}
	}

	/**
	 * Wait for all pending writes to complete. Viewport and scroll buffer will be updated.
	 * 等待所有待处理的写入操作完成。视口（viewport）与滚动缓冲区将会随之更新。
	 */
	async flush(): Promise<void> {
		// Write an empty string to ensure all previous writes are flushed
		// 写入一个空字符串，以确保先前的所有写入都已被刷新
		return new Promise<void>((resolve) => {
			this.xterm.write("", () => resolve());
		});
	}

	/**
	 * Flush and get viewport - convenience method for tests
	 * 刷新并获取视口（viewport）内容 —— 供测试使用的便捷方法
	 */
	async flushAndGetViewport(): Promise<string[]> {
		await this.flush();
		return this.getViewport();
	}

	/**
	 * Get the visible viewport (what's currently on screen)
	 * 获取可见视口（viewport）内容（即当前屏幕上显示的内容）
	 * Note: You should use getViewportAfterWrite() for testing after writing data
	 * 注意：在写入数据之后进行测试时，应改用 getViewportAfterWrite()
	 */
	getViewport(): string[] {
		const lines: string[] = [];
		const buffer = this.xterm.buffer.active;

		// Get only the visible lines (viewport)
		// 仅获取可见行（视口 viewport 内的行）
		for (let i = 0; i < this.xterm.rows; i++) {
			const line = buffer.getLine(buffer.viewportY + i);
			if (line) {
				lines.push(line.translateToString(true));
			} else {
				lines.push("");
			}
		}

		return lines;
	}

	/**
	 * Get the entire scroll buffer
	 * 获取完整的滚动缓冲区内容
	 */
	getScrollBuffer(): string[] {
		const lines: string[] = [];
		const buffer = this.xterm.buffer.active;

		// Get all lines in the buffer (including scrollback)
		// 获取缓冲区中的所有行（包含回滚缓冲区 scrollback 内容）
		for (let i = 0; i < buffer.length; i++) {
			const line = buffer.getLine(i);
			if (line) {
				lines.push(line.translateToString(true));
			} else {
				lines.push("");
			}
		}

		return lines;
	}

	/**
	 * Clear the terminal viewport
	 * 清空终端视口（viewport）
	 */
	clear(): void {
		this.xterm.clear();
	}

	/**
	 * Reset the terminal completely
	 * 彻底重置终端
	 */
	reset(): void {
		this.xterm.reset();
	}

	/**
	 * Get cursor position
	 * 获取光标位置
	 */
	getCursorPosition(): { x: number; y: number } {
		const buffer = this.xterm.buffer.active;
		return {
			x: buffer.cursorX,
			y: buffer.cursorY,
		};
	}

	/** Wait for TUI's throttled render pipeline to settle. 等待 TUI 经过节流（throttle）的渲染流水线稳定下来。 */
	async waitForRender(): Promise<void> {
		await new Promise<void>((resolve) => process.nextTick(resolve));
		await new Promise<void>((resolve) => setTimeout(resolve, 20));
		await this.flush();
	}
}
