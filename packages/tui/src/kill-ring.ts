/**
 * Ring buffer for Emacs-style kill/yank operations.
 * 用于 Emacs 风格 kill/yank（剪切/粘贴）操作的环形缓冲区。
 *
 * Tracks killed (deleted) text entries. Consecutive kills can accumulate
 * into a single entry.
 * 记录被 kill（删除）的文本条目。连续的 kill 操作可以累积合并为单个条目。
 * Supports yank (paste most recent) and yank-pop
 * (cycle through older entries).
 * 支持 yank（粘贴最近一条）和 yank-pop（在较早的条目之间循环切换）。
 */
export class KillRing {
	private ring: string[] = [];

	/**
	 * Add text to the kill ring.
	 * 向 kill ring（剪切环）中添加文本。
	 *
	 * @param text - The killed text to add 要添加的被删除文本
	 * @param opts - Push options 入栈选项
	 * @param opts.prepend - If accumulating, prepend (backward deletion) or append (forward deletion) 在累积合并时，选择前置插入（向后删除）还是追加（向前删除）
	 * @param opts.accumulate - Merge with the most recent entry instead of creating a new one 与最近一条条目合并，而不是新建一条
	 */
	push(text: string, opts: { prepend: boolean; accumulate?: boolean }): void {
		if (!text) return;

		if (opts.accumulate && this.ring.length > 0) {
			const last = this.ring.pop()!;
			this.ring.push(opts.prepend ? text + last : last + text);
		} else {
			this.ring.push(text);
		}
	}

	/** Get most recent entry without modifying the ring. 获取最近一条条目，且不修改环形缓冲区。 */
	peek(): string | undefined {
		return this.ring.length > 0 ? this.ring[this.ring.length - 1] : undefined;
	}

	/** Move last entry to front (for yank-pop cycling). 将最后一条条目移到最前（用于 yank-pop 循环切换）。 */
	rotate(): void {
		if (this.ring.length > 1) {
			const last = this.ring.pop()!;
			this.ring.unshift(last);
		}
	}

	get length(): number {
		return this.ring.length;
	}
}
