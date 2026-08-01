/**
 * Generic undo stack with clone-on-push semantics.
 * 通用撤销栈，采用入栈时克隆（clone-on-push）的语义。
 *
 * Stores deep clones of state snapshots.
 * 存储状态快照的深拷贝副本。
 * Popped snapshots are returned
 * directly (no re-cloning) since they are already detached.
 * 弹出的快照会直接返回（不再重新克隆），因为它们已与原状态解耦。
 */
export class UndoStack<S> {
	private stack: S[] = [];

	/** Push a deep clone of the given state onto the stack. 将给定状态的深拷贝副本压入栈中。 */
	push(state: S): void {
		this.stack.push(structuredClone(state));
	}

	/** Pop and return the most recent snapshot, or undefined if empty. 弹出并返回最近一个快照；若栈为空则返回 undefined。 */
	pop(): S | undefined {
		return this.stack.pop();
	}

	/** Remove all snapshots. 移除所有快照。 */
	clear(): void {
		this.stack.length = 0;
	}

	get length(): number {
		return this.stack.length;
	}
}
