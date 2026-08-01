import {
	type Component,
	Container,
	type Focusable,
	getKeybindings,
	Input,
	type Keybinding,
	Spacer,
	sliceByColumn,
	Text,
	truncateToWidth,
	visibleWidth,
	wrapTextWithAnsi,
} from "@earendil-works/pi-tui";
import type { SessionTreeNode } from "../../../core/session-manager.ts";
import { theme } from "../theme/theme.ts";
import { DynamicBorder } from "./dynamic-border.ts";
import { formatKeyText, keyHint } from "./keybinding-hints.ts";

/** Gutter info: position (displayIndent where connector was) and whether to show │
 *  竖线槽（gutter）信息：位置（连接符所在的 displayIndent 层级）以及是否显示 │ */
interface GutterInfo {
	position: number; // displayIndent level where the connector was shown
	// 显示连接符时所处的 displayIndent 层级
	show: boolean; // true = show │, false = show spaces
	// true = 显示 │，false = 显示空格
}

/** Flattened tree node for navigation
 *  用于导航的扁平化树节点 */
interface FlatNode {
	node: SessionTreeNode;
	/** Indentation level (each level = 3 chars)
	 *  缩进层级（每一层 = 3 个字符） */
	indent: number;
	/** Whether to show connector (├─ or └─) - true if parent has multiple children
	 *  是否显示连接符（├─ 或 └─）—— 当父节点有多个子节点时为 true */
	showConnector: boolean;
	/** If showConnector, true = last sibling (└─), false = not last (├─)
	 *  当 showConnector 为真时：true = 最后一个兄弟节点（└─），false = 非最后一个（├─） */
	isLast: boolean;
	/** Gutter info for each ancestor branch point
	 *  每个祖先分叉点对应的竖线槽（gutter）信息 */
	gutters: GutterInfo[];
	/** True if this node is a root under a virtual branching root (multiple roots)
	 *  若该节点是虚拟分叉根节点下的一个根节点（存在多个根）则为 true */
	isVirtualRootChild: boolean;
}

interface HorizontalViewportRow {
	gutter: string;
	body: string;
	anchorCol: number;
	bodyWidth: number;
	isSelected: boolean;
}

const TREE_GUTTER_WIDTH = 2;
const MIN_VISIBLE_ANCHOR_CONTENT_WIDTH = 4;
const MAX_VISIBLE_ANCHOR_CONTENT_WIDTH = 20;
const MIN_ANCHOR_CONTEXT_WIDTH = 2;
const MAX_ANCHOR_CONTEXT_WIDTH = 12;

/**
 * Render tree rows into a horizontally clipped viewport.
 * 将树的各行渲染到一个横向裁剪的视口（viewport）中。
 *
 * The tree gutter is always kept visible. The row bodies are shifted left only
 * when the selected row's anchor (the start of its entry text after tree
 * indentation/markers) would otherwise be too far right to see useful content.
 * 树的竖线槽（gutter）始终保持可见。仅当选中行的锚点（即树缩进/标记之后条目文本的
 * 起始位置）过于靠右、以致看不到有用内容时，才会将各行主体向左平移。
 */
function renderHorizontalViewport(rows: HorizontalViewportRow[], width: number): string[] {
	const viewportWidth = Math.max(0, width - TREE_GUTTER_WIDTH);
	const maxBodyWidth = rows.reduce((max, row) => Math.max(max, row.bodyWidth), 0);
	const maxHorizontalScroll = Math.max(0, maxBodyWidth - viewportWidth);
	const selectedRow = rows.find((row) => row.isSelected);

	// Only pan horizontally when needed to keep enough selected-row content visible after its anchor.
	// 仅在必要时进行横向平移，以保证选中行锚点之后仍有足够内容可见。
	let horizontalScroll = 0;
	if (selectedRow && maxHorizontalScroll > 0) {
		const minVisibleAnchorContentWidth = Math.min(
			MAX_VISIBLE_ANCHOR_CONTENT_WIDTH,
			Math.max(MIN_VISIBLE_ANCHOR_CONTENT_WIDTH, Math.floor(viewportWidth / 3)),
		);
		if (selectedRow.anchorCol > viewportWidth - minVisibleAnchorContentWidth) {
			const anchorContextWidth = Math.min(
				MAX_ANCHOR_CONTEXT_WIDTH,
				Math.max(MIN_ANCHOR_CONTEXT_WIDTH, Math.floor(viewportWidth / 4)),
			);
			horizontalScroll = Math.min(maxHorizontalScroll, selectedRow.anchorCol - anchorContextWidth);
		}
	}

	// Clip only the body; the fixed-width gutter remains visible as navigation context.
	// 只裁剪行主体；固定宽度的竖线槽（gutter）保持可见，作为导航时的上下文参照。
	return rows.map((row) => {
		const line =
			horizontalScroll > 0
				? `${row.gutter}${sliceByColumn(row.body, horizontalScroll, viewportWidth, true)}\x1b[0m`
				: row.gutter + row.body;
		return truncateToWidth(line, width, "");
	});
}

/** Filter mode for tree display
 *  树形展示所使用的过滤模式 */
export type FilterMode = "default" | "no-tools" | "user-only" | "labeled-only" | "all";

/**
 * Tree list component with selection and ASCII art visualization
 * 支持选择并以 ASCII 字符图形可视化的树形列表组件
 */
/** Tool call info for lookup
 *  用于查找的工具调用（tool call）信息 */
interface ToolCallInfo {
	name: string;
	arguments: Record<string, unknown>;
}

class TreeList implements Component {
	private flatNodes: FlatNode[] = [];
	private filteredNodes: FlatNode[] = [];
	private selectedIndex = 0;
	private currentLeafId: string | null;
	private maxVisibleLines: number;
	private filterMode: FilterMode = "default";
	private searchQuery = "";
	private toolCallMap: Map<string, ToolCallInfo> = new Map();
	private multipleRoots = false;
	private showLabelTimestamps = false;
	private activePathIds: Set<string> = new Set();
	private visibleParentMap: Map<string, string | null> = new Map();
	private visibleChildrenMap: Map<string | null, string[]> = new Map();
	private lastSelectedId: string | null = null;
	private foldedNodes: Set<string> = new Set();

	public onSelect?: (entryId: string) => void;
	public onCancel?: () => void;
	public onCopy?: (text: string | undefined) => void;
	public onLabelEdit?: (entryId: string, currentLabel: string | undefined) => void;

	constructor(
		tree: SessionTreeNode[],
		currentLeafId: string | null,
		maxVisibleLines: number,
		initialSelectedId?: string,
		initialFilterMode?: FilterMode,
	) {
		this.currentLeafId = currentLeafId;
		this.maxVisibleLines = maxVisibleLines;
		this.filterMode = initialFilterMode ?? "default";
		this.multipleRoots = tree.length > 1;
		this.flatNodes = this.flattenTree(tree);
		this.buildActivePath();
		this.applyFilter();

		// Start with initialSelectedId if provided, otherwise current leaf
		// 若提供了 initialSelectedId 则以其为起点，否则以当前叶子节点为起点
		const targetId = initialSelectedId ?? currentLeafId;
		this.selectedIndex = this.findNearestVisibleIndex(targetId);
		this.lastSelectedId = this.filteredNodes[this.selectedIndex]?.node.entry.id ?? null;
	}

	/**
	 * Find the index of the nearest visible entry, walking up the parent chain if needed.
	 * 查找最近的可见条目的索引，必要时沿父节点链向上回溯。
	 * Returns the index in filteredNodes, or the last index as fallback.
	 * 返回该条目在 filteredNodes 中的索引；作为兜底则返回最后一个索引。
	 */
	private findNearestVisibleIndex(entryId: string | null): number {
		if (this.filteredNodes.length === 0) return 0;

		// Build a map for parent lookup
		// 构建用于查找父节点的映射表
		const entryMap = new Map<string, FlatNode>();
		for (const flatNode of this.flatNodes) {
			entryMap.set(flatNode.node.entry.id, flatNode);
		}

		// Build a map of visible entry IDs to their indices in filteredNodes
		// 构建可见条目 ID 到其在 filteredNodes 中索引的映射表
		const visibleIdToIndex = new Map<string, number>(this.filteredNodes.map((node, i) => [node.node.entry.id, i]));

		// Walk from entryId up to root, looking for a visible entry
		// 从 entryId 一路向上回溯到根节点，寻找可见条目
		let currentId = entryId;
		while (currentId !== null) {
			const index = visibleIdToIndex.get(currentId);
			if (index !== undefined) return index;
			const node = entryMap.get(currentId);
			if (!node) break;
			currentId = node.node.entry.parentId ?? null;
		}

		// Fallback: last visible entry
		// 兜底方案：取最后一个可见条目
		return this.filteredNodes.length - 1;
	}

	/** Build the set of entry IDs on the path from root to current leaf
	 *  构建从根节点到当前叶子节点路径上的条目 ID 集合 */
	private buildActivePath(): void {
		this.activePathIds.clear();
		if (!this.currentLeafId) return;

		// Build a map of id -> entry for parent lookup
		// 构建 id -> entry 的映射表以便查找父节点
		const entryMap = new Map<string, FlatNode>();
		for (const flatNode of this.flatNodes) {
			entryMap.set(flatNode.node.entry.id, flatNode);
		}

		// Walk from leaf to root
		// 从叶子节点回溯到根节点
		let currentId: string | null = this.currentLeafId;
		while (currentId) {
			this.activePathIds.add(currentId);
			const node = entryMap.get(currentId);
			if (!node) break;
			currentId = node.node.entry.parentId ?? null;
		}
	}

	private flattenTree(roots: SessionTreeNode[]): FlatNode[] {
		const result: FlatNode[] = [];
		this.toolCallMap.clear();

		// Indentation rules:
		// 缩进规则：
		// - At indent 0: stay at 0 unless parent has >1 children (then +1)
		//   缩进为 0 时：保持 0，除非父节点有多于 1 个子节点（此时 +1）
		// - At indent 1: children always go to indent 2 (visual grouping of subtree)
		//   缩进为 1 时：子节点一律进入缩进 2（用于在视觉上对子树分组）
		// - At indent 2+: stay flat for single-child chains, +1 only if parent branches
		//   缩进为 2 及以上时：单子节点链保持同级不缩进，仅当父节点分叉时才 +1

		// Stack items: [node, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild]
		// 栈元素结构：[node, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild]
		type StackItem = [SessionTreeNode, number, boolean, boolean, boolean, GutterInfo[], boolean];
		const stack: StackItem[] = [];

		// Determine which subtrees contain the active leaf (to sort current branch first)
		// 判断哪些子树包含当前活动叶子节点（以便把当前分支排在最前）
		// Use iterative post-order traversal to avoid stack overflow
		// 采用迭代式后序遍历以避免栈溢出
		const containsActive = new Map<SessionTreeNode, boolean>();
		const leafId = this.currentLeafId;
		{
			// Build list in pre-order, then process in reverse for post-order effect
			// 先按前序构建列表，再反向处理以达到后序遍历的效果
			const allNodes: SessionTreeNode[] = [];
			const preOrderStack: SessionTreeNode[] = [...roots];
			while (preOrderStack.length > 0) {
				const node = preOrderStack.pop()!;
				allNodes.push(node);
				// Push children in reverse so they're processed left-to-right
				// 反向入栈子节点，使其按从左到右的顺序被处理
				for (let i = node.children.length - 1; i >= 0; i--) {
					preOrderStack.push(node.children[i]);
				}
			}
			// Process in reverse (post-order): children before parents
			// 反向处理（后序）：先处理子节点，再处理父节点
			for (let i = allNodes.length - 1; i >= 0; i--) {
				const node = allNodes[i];
				let has = leafId !== null && node.entry.id === leafId;
				for (const child of node.children) {
					if (containsActive.get(child)) {
						has = true;
					}
				}
				containsActive.set(node, has);
			}
		}

		// Add roots in reverse order, prioritizing the one containing the active leaf
		// 反向添加根节点，并优先处理包含当前活动叶子节点的那个根
		// If multiple roots, treat them as children of a virtual root that branches
		// 若存在多个根节点，则将它们视为一个会分叉的虚拟根节点的子节点
		const multipleRoots = roots.length > 1;
		const orderedRoots = [...roots].sort((a, b) => Number(containsActive.get(b)) - Number(containsActive.get(a)));
		for (let i = orderedRoots.length - 1; i >= 0; i--) {
			const isLast = i === orderedRoots.length - 1;
			stack.push([orderedRoots[i], multipleRoots ? 1 : 0, multipleRoots, multipleRoots, isLast, [], multipleRoots]);
		}

		while (stack.length > 0) {
			const [node, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild] = stack.pop()!;

			// Extract tool calls from assistant messages for later lookup
			// 从助手（assistant）消息中提取工具调用，供后续查找使用
			const entry = node.entry;
			if (entry.type === "message" && entry.message.role === "assistant") {
				const content = (entry.message as { content?: unknown }).content;
				if (Array.isArray(content)) {
					for (const block of content) {
						if (typeof block === "object" && block !== null && "type" in block && block.type === "toolCall") {
							const tc = block as { id: string; name: string; arguments: Record<string, unknown> };
							this.toolCallMap.set(tc.id, { name: tc.name, arguments: tc.arguments });
						}
					}
				}
			}

			result.push({ node, indent, showConnector, isLast, gutters, isVirtualRootChild });

			const children = node.children;
			const multipleChildren = children.length > 1;

			// Order children so the branch containing the active leaf comes first
			// 对子节点排序，使包含当前活动叶子节点的分支排在最前
			const orderedChildren = (() => {
				const prioritized: SessionTreeNode[] = [];
				const rest: SessionTreeNode[] = [];
				for (const child of children) {
					if (containsActive.get(child)) {
						prioritized.push(child);
					} else {
						rest.push(child);
					}
				}
				return [...prioritized, ...rest];
			})();

			// Calculate child indent
			// 计算子节点的缩进
			let childIndent: number;
			if (multipleChildren) {
				// Parent branches: children get +1
				// 父节点分叉：子节点缩进 +1
				childIndent = indent + 1;
			} else if (justBranched && indent > 0) {
				// First generation after a branch: +1 for visual grouping
				// 分叉之后的第一代节点：+1 以便在视觉上分组
				childIndent = indent + 1;
			} else {
				// Single-child chain: stay flat
				// 单子节点链：保持同级不缩进
				childIndent = indent;
			}

			// Build gutters for children
			// 为子节点构建竖线槽（gutter）
			// If this node showed a connector, add a gutter entry for descendants
			// 若当前节点显示了连接符，则为其后代添加一项竖线槽记录
			// Only add gutter if connector is actually displayed (not suppressed for virtual root children)
			// 仅当连接符确实被显示时才添加竖线槽（虚拟根节点的子节点会抑制显示）
			const connectorDisplayed = showConnector && !isVirtualRootChild;
			// When connector is displayed, add a gutter entry at the connector's position
			// 当连接符被显示时，在连接符所在位置添加一项竖线槽记录
			// Connector is at position (displayIndent - 1), so gutter should be there too
			// 连接符位于 (displayIndent - 1) 处，因此竖线槽也应位于该处
			const currentDisplayIndent = this.multipleRoots ? Math.max(0, indent - 1) : indent;
			const connectorPosition = Math.max(0, currentDisplayIndent - 1);
			const childGutters: GutterInfo[] = connectorDisplayed
				? [...gutters, { position: connectorPosition, show: !isLast }]
				: gutters;

			// Add children in reverse order
			// 反向添加子节点
			for (let i = orderedChildren.length - 1; i >= 0; i--) {
				const childIsLast = i === orderedChildren.length - 1;
				stack.push([
					orderedChildren[i],
					childIndent,
					multipleChildren,
					multipleChildren,
					childIsLast,
					childGutters,
					false,
				]);
			}
		}

		return result;
	}

	private applyFilter(): void {
		// Update lastSelectedId only when we have a valid selection (non-empty list)
		// 仅在存在有效选中项（列表非空）时才更新 lastSelectedId
		// This preserves the selection when switching through empty filter results
		// 这样在切换到结果为空的过滤条件时仍能保留原选中项
		if (this.filteredNodes.length > 0) {
			this.lastSelectedId = this.filteredNodes[this.selectedIndex]?.node.entry.id ?? this.lastSelectedId;
		}

		const searchTokens = this.searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

		this.filteredNodes = this.flatNodes.filter((flatNode) => {
			const entry = flatNode.node.entry;
			const isCurrentLeaf = entry.id === this.currentLeafId;

			// Skip assistant messages with only tool calls (no text) unless error/aborted
			// 跳过仅含工具调用（无文本）的助手消息，除非其为错误或已中止（aborted）状态
			// Always show current leaf so active position is visible
			// 始终显示当前叶子节点，以保证当前位置可见
			if (entry.type === "message" && entry.message.role === "assistant" && !isCurrentLeaf) {
				const msg = entry.message as { stopReason?: string; content?: unknown };
				const hasText = this.hasTextContent(msg.content);
				const isErrorOrAborted = msg.stopReason && msg.stopReason !== "stop" && msg.stopReason !== "toolUse";
				// Only hide if no text AND not an error/aborted message
				// 仅当既没有文本、又不是错误/已中止消息时才隐藏
				if (!hasText && !isErrorOrAborted) {
					return false;
				}
			}

			// Apply filter mode
			// 应用过滤模式
			let passesFilter = true;
			// Entry types hidden in default view (settings/bookkeeping)
			// 在默认视图中被隐藏的条目类型（设置类/记账类条目）
			const isSettingsEntry =
				entry.type === "label" ||
				entry.type === "custom" ||
				entry.type === "model_change" ||
				entry.type === "thinking_level_change" ||
				entry.type === "session_info";

			switch (this.filterMode) {
				case "user-only":
					// Just user messages
					// 仅保留用户消息
					passesFilter = entry.type === "message" && entry.message.role === "user";
					break;
				case "no-tools":
					// Default minus tool results
					// 在默认模式基础上排除工具结果（tool result）
					passesFilter = !isSettingsEntry && !(entry.type === "message" && entry.message.role === "toolResult");
					break;
				case "labeled-only":
					// Just labeled entries
					// 仅保留带标签（label）的条目
					passesFilter = flatNode.node.label !== undefined;
					break;
				case "all":
					// Show everything
					// 显示全部内容
					passesFilter = true;
					break;
				default:
					// Default mode: hide settings/bookkeeping entries
					// 默认模式：隐藏设置类/记账类条目
					passesFilter = !isSettingsEntry;
					break;
			}

			if (!passesFilter) return false;

			// Apply search filter
			// 应用搜索过滤
			if (searchTokens.length > 0) {
				const nodeText = this.getSearchableText(flatNode.node).toLowerCase();
				return searchTokens.every((token) => nodeText.includes(token));
			}

			return true;
		});

		// Filter out descendants of folded nodes.
		// 过滤掉已折叠（folded）节点的后代节点。
		if (this.foldedNodes.size > 0) {
			const skipSet = new Set<string>();
			for (const flatNode of this.flatNodes) {
				const { id, parentId } = flatNode.node.entry;
				if (parentId != null && (this.foldedNodes.has(parentId) || skipSet.has(parentId))) {
					skipSet.add(id);
				}
			}
			this.filteredNodes = this.filteredNodes.filter((flatNode) => !skipSet.has(flatNode.node.entry.id));
		}

		// Recalculate visual structure (indent, connectors, gutters) based on visible tree
		// 基于可见树重新计算视觉结构（缩进、连接符、竖线槽）
		this.recalculateVisualStructure();

		// Try to preserve cursor on the same node, or find nearest visible ancestor
		// 尽量让光标停留在同一节点上，否则查找最近的可见祖先节点
		if (this.lastSelectedId) {
			this.selectedIndex = this.findNearestVisibleIndex(this.lastSelectedId);
		} else if (this.selectedIndex >= this.filteredNodes.length) {
			// Clamp index if out of bounds
			// 索引越界时进行钳制（clamp）
			this.selectedIndex = Math.max(0, this.filteredNodes.length - 1);
		}

		// Update lastSelectedId to the actual selection (may have changed due to parent walk)
		// 将 lastSelectedId 更新为实际选中项（可能因向父节点回溯而发生变化）
		if (this.filteredNodes.length > 0) {
			this.lastSelectedId = this.filteredNodes[this.selectedIndex]?.node.entry.id ?? this.lastSelectedId;
		}
	}

	/**
	 * Recompute indentation/connectors for the filtered view
	 * 为过滤后的视图重新计算缩进与连接符
	 *
	 * Filtering can hide intermediate entries; descendants attach to the nearest visible ancestor.
	 * 过滤可能会隐藏中间条目；此时后代节点将挂接到最近的可见祖先节点上。
	 * Keep indentation semantics aligned with flattenTree() so single-child chains don't drift right.
	 * 保持与 flattenTree() 一致的缩进语义，避免单子节点链不断向右偏移。
	 */
	private recalculateVisualStructure(): void {
		if (this.filteredNodes.length === 0) return;

		const visibleIds = new Set(this.filteredNodes.map((n) => n.node.entry.id));

		// Build entry map for efficient parent lookup (using full tree)
		// 构建条目映射表以高效查找父节点（基于完整树）
		const entryMap = new Map<string, FlatNode>();
		for (const flatNode of this.flatNodes) {
			entryMap.set(flatNode.node.entry.id, flatNode);
		}

		// Find nearest visible ancestor for a node
		// 查找某个节点最近的可见祖先节点
		const findVisibleAncestor = (nodeId: string): string | null => {
			let currentId = entryMap.get(nodeId)?.node.entry.parentId ?? null;
			while (currentId !== null) {
				if (visibleIds.has(currentId)) {
					return currentId;
				}
				currentId = entryMap.get(currentId)?.node.entry.parentId ?? null;
			}
			return null;
		};

		// Build visible tree structure:
		// 构建可见树结构：
		// - visibleParent: nodeId → nearest visible ancestor (or null for roots)
		//   visibleParent：nodeId → 最近的可见祖先节点（根节点则为 null）
		// - visibleChildren: parentId → list of visible children (in filteredNodes order)
		//   visibleChildren：parentId → 可见子节点列表（按 filteredNodes 中的顺序）
		const visibleParent = new Map<string, string | null>();
		const visibleChildren = new Map<string | null, string[]>();
		visibleChildren.set(null, []); // root-level nodes
		// 根层级节点

		for (const flatNode of this.filteredNodes) {
			const nodeId = flatNode.node.entry.id;
			const ancestorId = findVisibleAncestor(nodeId);
			visibleParent.set(nodeId, ancestorId);

			if (!visibleChildren.has(ancestorId)) {
				visibleChildren.set(ancestorId, []);
			}
			visibleChildren.get(ancestorId)!.push(nodeId);
		}

		// Update multipleRoots based on visible roots
		// 根据可见根节点更新 multipleRoots
		const visibleRootIds = visibleChildren.get(null)!;
		this.multipleRoots = visibleRootIds.length > 1;

		// Build a map for quick lookup: nodeId → FlatNode
		// 构建用于快速查找的映射表：nodeId → FlatNode
		const filteredNodeMap = new Map<string, FlatNode>();
		for (const flatNode of this.filteredNodes) {
			filteredNodeMap.set(flatNode.node.entry.id, flatNode);
		}

		// DFS over the visible tree using flattenTree() indentation semantics
		// 采用 flattenTree() 的缩进语义对可见树进行深度优先遍历（DFS）
		// Stack items: [nodeId, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild]
		// 栈元素结构：[nodeId, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild]
		type StackItem = [string, number, boolean, boolean, boolean, GutterInfo[], boolean];
		const stack: StackItem[] = [];

		// Add visible roots in reverse order (to process in forward order via stack)
		// 反向添加可见根节点（以便借助栈按正序处理）
		for (let i = visibleRootIds.length - 1; i >= 0; i--) {
			const isLast = i === visibleRootIds.length - 1;
			stack.push([
				visibleRootIds[i],
				this.multipleRoots ? 1 : 0,
				this.multipleRoots,
				this.multipleRoots,
				isLast,
				[],
				this.multipleRoots,
			]);
		}

		while (stack.length > 0) {
			const [nodeId, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild] = stack.pop()!;

			const flatNode = filteredNodeMap.get(nodeId);
			if (!flatNode) continue;

			// Update this node's visual properties
			// 更新该节点的视觉属性
			flatNode.indent = indent;
			flatNode.showConnector = showConnector;
			flatNode.isLast = isLast;
			flatNode.gutters = gutters;
			flatNode.isVirtualRootChild = isVirtualRootChild;

			// Get visible children of this node
			// 获取该节点的可见子节点
			const children = visibleChildren.get(nodeId) || [];
			const multipleChildren = children.length > 1;

			// Child indent follows flattenTree(): branch points (and first generation after a branch) shift +1
			// 子节点缩进沿用 flattenTree() 的规则：分叉点（以及分叉后的第一代节点）缩进 +1
			let childIndent: number;
			if (multipleChildren) {
				childIndent = indent + 1;
			} else if (justBranched && indent > 0) {
				childIndent = indent + 1;
			} else {
				childIndent = indent;
			}

			// Child gutters follow flattenTree() connector/gutter rules
			// 子节点的竖线槽沿用 flattenTree() 的连接符/竖线槽规则
			const connectorDisplayed = showConnector && !isVirtualRootChild;
			const currentDisplayIndent = this.multipleRoots ? Math.max(0, indent - 1) : indent;
			const connectorPosition = Math.max(0, currentDisplayIndent - 1);
			const childGutters: GutterInfo[] = connectorDisplayed
				? [...gutters, { position: connectorPosition, show: !isLast }]
				: gutters;

			// Add children in reverse order (to process in forward order via stack)
			// 反向添加子节点（以便借助栈按正序处理）
			for (let i = children.length - 1; i >= 0; i--) {
				const childIsLast = i === children.length - 1;
				stack.push([
					children[i],
					childIndent,
					multipleChildren,
					multipleChildren,
					childIsLast,
					childGutters,
					false,
				]);
			}
		}

		// Store visible tree maps for ancestor/descendant lookups in navigation
		// 保存可见树映射表，供导航时查找祖先/后代节点使用
		this.visibleParentMap = visibleParent;
		this.visibleChildrenMap = visibleChildren;
	}

	/** Get searchable text content from a node
	 *  从节点中提取可供搜索的文本内容 */
	private getSearchableText(node: SessionTreeNode): string {
		const entry = node.entry;
		const parts: string[] = [];

		if (node.label) {
			parts.push(node.label);
		}

		switch (entry.type) {
			case "message": {
				const msg = entry.message;
				parts.push(msg.role);
				if ("content" in msg && msg.content) {
					parts.push(this.extractContent(msg.content));
				}
				if (msg.role === "bashExecution") {
					const bashMsg = msg as { command?: string };
					if (bashMsg.command) parts.push(bashMsg.command);
				}
				break;
			}
			case "custom_message": {
				parts.push(entry.customType);
				if (typeof entry.content === "string") {
					parts.push(entry.content);
				} else {
					parts.push(this.extractContent(entry.content));
				}
				break;
			}
			case "compaction":
				parts.push("compaction");
				break;
			case "branch_summary":
				parts.push("branch summary", entry.summary);
				break;
			case "session_info":
				parts.push("title");
				if (entry.name) parts.push(entry.name);
				break;
			case "model_change":
				parts.push("model", entry.modelId);
				break;
			case "thinking_level_change":
				parts.push("thinking", entry.thinkingLevel);
				break;
			case "custom":
				parts.push("custom", entry.customType);
				break;
			case "label":
				parts.push("label", entry.label ?? "");
				break;
		}

		return parts.join(" ");
	}

	invalidate(): void {}

	getSearchQuery(): string {
		return this.searchQuery;
	}

	getSelectedNode(): SessionTreeNode | undefined {
		return this.filteredNodes[this.selectedIndex]?.node;
	}

	copySelected(): void {
		const node = this.getSelectedNode();
		this.onCopy?.(node ? this.getEntryCopyText(node) : undefined);
	}

	updateNodeLabel(entryId: string, label: string | undefined, labelTimestamp?: string): void {
		for (const flatNode of this.flatNodes) {
			if (flatNode.node.entry.id === entryId) {
				flatNode.node.label = label;
				flatNode.node.labelTimestamp = label ? (labelTimestamp ?? new Date().toISOString()) : undefined;
				break;
			}
		}
	}

	private getStatusLabels(): string {
		let labels = "";
		switch (this.filterMode) {
			case "no-tools":
				labels += " [no-tools]";
				break;
			case "user-only":
				labels += " [user]";
				break;
			case "labeled-only":
				labels += " [labeled]";
				break;
			case "all":
				labels += " [all]";
				break;
		}
		if (this.showLabelTimestamps) {
			labels += " [+label time]";
		}
		return labels;
	}

	render(width: number): string[] {
		const lines: string[] = [];

		if (this.filteredNodes.length === 0) {
			lines.push(truncateToWidth(theme.fg("muted", "  No entries found"), width));
			lines.push(truncateToWidth(theme.fg("muted", `  (0/0)${this.getStatusLabels()}`), width));
			return lines;
		}

		const startIndex = Math.max(
			0,
			Math.min(
				this.selectedIndex - Math.floor(this.maxVisibleLines / 2),
				this.filteredNodes.length - this.maxVisibleLines,
			),
		);
		const endIndex = Math.min(startIndex + this.maxVisibleLines, this.filteredNodes.length);

		const renderedRows: HorizontalViewportRow[] = [];
		for (let i = startIndex; i < endIndex; i++) {
			const flatNode = this.filteredNodes[i];
			const entry = flatNode.node.entry;
			const isSelected = i === this.selectedIndex;

			// Build line: cursor + prefix + path marker + label + content
			// 拼装整行：光标 + 前缀 + 路径标记 + 标签 + 内容
			const cursor = isSelected ? theme.fg("accent", "› ") : "  ";

			// If multiple roots, shift display (roots at 0, not 1)
			// 若存在多个根节点，则整体平移显示（根节点位于 0 而非 1）
			const displayIndent = this.multipleRoots ? Math.max(0, flatNode.indent - 1) : flatNode.indent;

			// Build prefix with gutters at their correct positions
			// 构建前缀，并将各竖线槽放置在正确的位置上
			// Each gutter has a position (displayIndent where its connector was shown)
			// 每个竖线槽都带有一个位置（即其连接符所显示的 displayIndent 层级）
			const connector =
				flatNode.showConnector && !flatNode.isVirtualRootChild ? (flatNode.isLast ? "└─ " : "├─ ") : "";
			const connectorPosition = connector ? displayIndent - 1 : -1;

			// Build prefix char by char, placing gutters and connector at their positions
			// 逐字符构建前缀，把竖线槽和连接符放到各自的位置上
			const totalChars = displayIndent * 3;
			const prefixChars: string[] = [];
			const isFolded = this.foldedNodes.has(entry.id);
			for (let i = 0; i < totalChars; i++) {
				const level = Math.floor(i / 3);
				const posInLevel = i % 3;

				// Check if there's a gutter at this level
				// 检查该层级是否存在竖线槽
				const gutter = flatNode.gutters.find((g) => g.position === level);
				if (gutter) {
					if (posInLevel === 0) {
						prefixChars.push(gutter.show ? "│" : " ");
					} else {
						prefixChars.push(" ");
					}
				} else if (connector && level === connectorPosition) {
					// Connector at this level, with fold indicator
					// 该层级为连接符，并附带折叠指示符
					if (posInLevel === 0) {
						prefixChars.push(flatNode.isLast ? "└" : "├");
					} else if (posInLevel === 1) {
						const foldable = this.isFoldable(entry.id);
						prefixChars.push(isFolded ? "⊞" : foldable ? "⊟" : "─");
					} else {
						prefixChars.push(" ");
					}
				} else {
					prefixChars.push(" ");
				}
			}
			const prefix = prefixChars.join("");

			// Fold marker for nodes without connectors (roots)
			// 为没有连接符的节点（根节点）显示折叠标记
			const showsFoldInConnector = flatNode.showConnector && !flatNode.isVirtualRootChild;
			const foldMarker = isFolded && !showsFoldInConnector ? theme.fg("accent", "⊞ ") : "";

			// Active path marker - shown right before the entry text
			// 活动路径标记 —— 显示在条目文本的正前方
			const isOnActivePath = this.activePathIds.has(entry.id);
			const pathMarker = isOnActivePath ? theme.fg("accent", "• ") : "";

			const label = flatNode.node.label ? theme.fg("warning", `[${flatNode.node.label}] `) : "";
			const labelTimestamp =
				this.showLabelTimestamps && flatNode.node.label && flatNode.node.labelTimestamp
					? theme.fg("muted", `${this.formatLabelTimestamp(flatNode.node.labelTimestamp)} `)
					: "";
			const content = this.getEntryDisplayText(flatNode.node, isSelected);
			const prefixPart = theme.fg("dim", prefix) + foldMarker + pathMarker;
			const anchorCol = visibleWidth(prefixPart);
			let gutter = cursor;
			let body = prefixPart + label + labelTimestamp + content;
			if (isSelected) {
				gutter = theme.bg("selectedBg", gutter);
				body = theme.bg("selectedBg", body);
			}
			renderedRows.push({ gutter, body, anchorCol, bodyWidth: visibleWidth(body), isSelected });
		}

		lines.push(...renderHorizontalViewport(renderedRows, width));
		lines.push(
			truncateToWidth(
				theme.fg("muted", `  (${this.selectedIndex + 1}/${this.filteredNodes.length})${this.getStatusLabels()}`),
				width,
			),
		);

		return lines;
	}

	private getEntryDisplayText(node: SessionTreeNode, isSelected: boolean): string {
		const entry = node.entry;
		let result: string;

		const normalize = (s: string) => s.replace(/[\n\t]/g, " ").trim();

		switch (entry.type) {
			case "message": {
				const msg = entry.message;
				const role = msg.role;
				if (role === "user") {
					const msgWithContent = msg as { content?: unknown };
					const content = normalize(this.extractContent(msgWithContent.content));
					result = theme.fg("accent", "user: ") + content;
				} else if (role === "assistant") {
					const msgWithContent = msg as { content?: unknown; stopReason?: string; errorMessage?: string };
					const textContent = normalize(this.extractContent(msgWithContent.content));
					if (textContent) {
						result = theme.fg("success", "assistant: ") + textContent;
					} else if (msgWithContent.stopReason === "aborted") {
						result = theme.fg("success", "assistant: ") + theme.fg("muted", "(aborted)");
					} else if (msgWithContent.errorMessage) {
						const errMsg = normalize(msgWithContent.errorMessage).slice(0, 80);
						result = theme.fg("success", "assistant: ") + theme.fg("error", errMsg);
					} else {
						result = theme.fg("success", "assistant: ") + theme.fg("muted", "(no content)");
					}
				} else if (role === "toolResult") {
					const toolMsg = msg as { toolCallId?: string; toolName?: string };
					const toolCall = toolMsg.toolCallId ? this.toolCallMap.get(toolMsg.toolCallId) : undefined;
					if (toolCall) {
						result = theme.fg("muted", this.formatToolCall(toolCall.name, toolCall.arguments));
					} else {
						result = theme.fg("muted", `[${toolMsg.toolName ?? "tool"}]`);
					}
				} else if (role === "bashExecution") {
					const bashMsg = msg as { command?: string };
					result = theme.fg("dim", `[bash]: ${normalize(bashMsg.command ?? "")}`);
				} else {
					result = theme.fg("dim", `[${role}]`);
				}
				break;
			}
			case "custom_message": {
				const content =
					typeof entry.content === "string"
						? entry.content
						: entry.content
								.filter((c): c is { type: "text"; text: string } => c.type === "text")
								.map((c) => c.text)
								.join("");
				result = theme.fg("customMessageLabel", `[${entry.customType}]: `) + normalize(content);
				break;
			}
			case "compaction": {
				const tokens = Math.round(entry.tokensBefore / 1000);
				result = theme.fg("borderAccent", `[compaction: ${tokens}k tokens]`);
				break;
			}
			case "branch_summary":
				result = theme.fg("warning", `[branch summary]: `) + normalize(entry.summary);
				break;
			case "model_change":
				result = theme.fg("dim", `[model: ${entry.modelId}]`);
				break;
			case "thinking_level_change":
				result = theme.fg("dim", `[thinking: ${entry.thinkingLevel}]`);
				break;
			case "custom":
				result = theme.fg("dim", `[custom: ${entry.customType}]`);
				break;
			case "label":
				result = theme.fg("dim", `[label: ${entry.label ?? "(cleared)"}]`);
				break;
			case "session_info":
				result = entry.name
					? [theme.fg("dim", "[title: "), theme.fg("dim", entry.name), theme.fg("dim", "]")].join("")
					: [theme.fg("dim", "[title: "), theme.italic(theme.fg("dim", "empty")), theme.fg("dim", "]")].join("");
				break;
			default:
				result = "";
		}

		return isSelected ? theme.bold(result) : result;
	}

	private formatLabelTimestamp(timestamp: string): string {
		const date = new Date(timestamp);
		const now = new Date();
		const hours = date.getHours().toString().padStart(2, "0");
		const minutes = date.getMinutes().toString().padStart(2, "0");
		const time = `${hours}:${minutes}`;

		if (
			date.getFullYear() === now.getFullYear() &&
			date.getMonth() === now.getMonth() &&
			date.getDate() === now.getDate()
		) {
			return time;
		}

		const month = date.getMonth() + 1;
		const day = date.getDate();
		if (date.getFullYear() === now.getFullYear()) {
			return `${month}/${day} ${time}`;
		}

		const year = date.getFullYear().toString().slice(-2);
		return `${year}/${month}/${day} ${time}`;
	}

	private extractContent(content: unknown): string {
		return this.extractFullContent(content).slice(0, 200);
	}

	private extractFullContent(content: unknown): string {
		if (typeof content === "string") return content;
		if (!Array.isArray(content)) return "";

		let result = "";
		for (const block of content) {
			if (typeof block === "object" && block !== null && "type" in block && block.type === "text") {
				result += (block as { text: string }).text;
			}
		}
		return result;
	}

	private getEntryCopyText(node: SessionTreeNode): string | undefined {
		const entry = node.entry;
		let text: string | undefined;

		switch (entry.type) {
			case "message":
				if (entry.message.role === "bashExecution") {
					text = entry.message.command;
				} else if ("content" in entry.message) {
					text = this.extractFullContent(entry.message.content);
					if (!text && entry.message.role === "assistant") {
						text = entry.message.errorMessage;
					}
				}
				break;
			case "custom_message":
				text = this.extractFullContent(entry.content);
				break;
			case "compaction":
				text = entry.summary;
				break;
			case "branch_summary":
				text = entry.summary;
				break;
		}

		return text?.trim() ? text : undefined;
	}

	private hasTextContent(content: unknown): boolean {
		if (typeof content === "string") return content.trim().length > 0;
		if (Array.isArray(content)) {
			for (const c of content) {
				if (typeof c === "object" && c !== null && "type" in c && c.type === "text") {
					const text = (c as { text?: string }).text;
					if (text && text.trim().length > 0) return true;
				}
			}
		}
		return false;
	}

	private formatToolCall(name: string, args: Record<string, unknown>): string {
		const shortenPath = (p: string): string => {
			const home = process.env.HOME || process.env.USERPROFILE || "";
			if (home && p.startsWith(home)) return `~${p.slice(home.length)}`;
			return p;
		};

		switch (name) {
			case "read": {
				const path = shortenPath(String(args.path || args.file_path || ""));
				const offset = args.offset as number | undefined;
				const limit = args.limit as number | undefined;
				let display = path;
				if (offset !== undefined || limit !== undefined) {
					const start = offset ?? 1;
					const end = limit !== undefined ? start + limit - 1 : "";
					display += `:${start}${end ? `-${end}` : ""}`;
				}
				return `[read: ${display}]`;
			}
			case "write": {
				const path = shortenPath(String(args.path || args.file_path || ""));
				return `[write: ${path}]`;
			}
			case "edit": {
				const path = shortenPath(String(args.path || args.file_path || ""));
				return `[edit: ${path}]`;
			}
			case "bash": {
				const rawCmd = String(args.command || "");
				const cmd = rawCmd
					.replace(/[\n\t]/g, " ")
					.trim()
					.slice(0, 50);
				return `[bash: ${cmd}${rawCmd.length > 50 ? "..." : ""}]`;
			}
			case "grep": {
				const pattern = String(args.pattern || "");
				const path = shortenPath(String(args.path || "."));
				return `[grep: /${pattern}/ in ${path}]`;
			}
			case "find": {
				const pattern = String(args.pattern || "");
				const path = shortenPath(String(args.path || "."));
				return `[find: ${pattern} in ${path}]`;
			}
			case "ls": {
				const path = shortenPath(String(args.path || "."));
				return `[ls: ${path}]`;
			}
			default: {
				// Custom tool - show name and truncated JSON args
				// 自定义工具 —— 显示工具名与截断后的 JSON 参数
				const argsStr = JSON.stringify(args).slice(0, 40);
				return `[${name}: ${argsStr}${JSON.stringify(args).length > 40 ? "..." : ""}]`;
			}
		}
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();
		if (kb.matches(keyData, "tui.select.up")) {
			this.selectedIndex = this.selectedIndex === 0 ? this.filteredNodes.length - 1 : this.selectedIndex - 1;
		} else if (kb.matches(keyData, "tui.select.down")) {
			this.selectedIndex = this.selectedIndex === this.filteredNodes.length - 1 ? 0 : this.selectedIndex + 1;
		} else if (kb.matches(keyData, "app.tree.foldOrUp")) {
			const currentId = this.filteredNodes[this.selectedIndex]?.node.entry.id;
			if (currentId && this.isFoldable(currentId) && !this.foldedNodes.has(currentId)) {
				this.foldedNodes.add(currentId);
				this.applyFilter();
			} else {
				this.selectedIndex = this.findBranchSegmentStart("up");
			}
		} else if (kb.matches(keyData, "app.tree.unfoldOrDown")) {
			const currentId = this.filteredNodes[this.selectedIndex]?.node.entry.id;
			if (currentId && this.foldedNodes.has(currentId)) {
				this.foldedNodes.delete(currentId);
				this.applyFilter();
			} else {
				this.selectedIndex = this.findBranchSegmentStart("down");
			}
		} else if (kb.matches(keyData, "tui.editor.cursorLeft") || kb.matches(keyData, "tui.select.pageUp")) {
			// Page up
			// 向上翻页
			this.selectedIndex = Math.max(0, this.selectedIndex - this.maxVisibleLines);
		} else if (kb.matches(keyData, "tui.editor.cursorRight") || kb.matches(keyData, "tui.select.pageDown")) {
			// Page down
			// 向下翻页
			this.selectedIndex = Math.min(this.filteredNodes.length - 1, this.selectedIndex + this.maxVisibleLines);
		} else if (kb.matches(keyData, "tui.select.confirm")) {
			const selected = this.filteredNodes[this.selectedIndex];
			if (selected && this.onSelect) {
				this.onSelect(selected.node.entry.id);
			}
		} else if (kb.matches(keyData, "app.message.copy")) {
			this.copySelected();
		} else if (kb.matches(keyData, "tui.select.cancel")) {
			if (this.searchQuery) {
				this.searchQuery = "";
				this.foldedNodes.clear();
				this.applyFilter();
			} else {
				this.onCancel?.();
			}
		} else if (kb.matches(keyData, "app.tree.filter.default")) {
			// Direct filter: default
			// 直接切换过滤器：default（默认）
			this.filterMode = "default";
			this.foldedNodes.clear();
			this.applyFilter();
		} else if (kb.matches(keyData, "app.tree.filter.noTools")) {
			// Toggle filter: no-tools ↔ default
			// 切换过滤器：no-tools ↔ default
			this.filterMode = this.filterMode === "no-tools" ? "default" : "no-tools";
			this.foldedNodes.clear();
			this.applyFilter();
		} else if (kb.matches(keyData, "app.tree.filter.userOnly")) {
			// Toggle filter: user-only ↔ default
			// 切换过滤器：user-only ↔ default
			this.filterMode = this.filterMode === "user-only" ? "default" : "user-only";
			this.foldedNodes.clear();
			this.applyFilter();
		} else if (kb.matches(keyData, "app.tree.filter.labeledOnly")) {
			// Toggle filter: labeled-only ↔ default
			// 切换过滤器：labeled-only ↔ default
			this.filterMode = this.filterMode === "labeled-only" ? "default" : "labeled-only";
			this.foldedNodes.clear();
			this.applyFilter();
		} else if (kb.matches(keyData, "app.tree.filter.all")) {
			// Toggle filter: all ↔ default
			// 切换过滤器：all ↔ default
			this.filterMode = this.filterMode === "all" ? "default" : "all";
			this.foldedNodes.clear();
			this.applyFilter();
		} else if (kb.matches(keyData, "app.tree.filter.cycleBackward")) {
			// Cycle filter backwards
			// 反向循环切换过滤器
			const modes: FilterMode[] = ["default", "no-tools", "user-only", "labeled-only", "all"];
			const currentIndex = modes.indexOf(this.filterMode);
			this.filterMode = modes[(currentIndex - 1 + modes.length) % modes.length];
			this.foldedNodes.clear();
			this.applyFilter();
		} else if (kb.matches(keyData, "app.tree.filter.cycleForward")) {
			// Cycle filter forwards: default → no-tools → user-only → labeled-only → all → default
			// 正向循环切换过滤器：default → no-tools → user-only → labeled-only → all → default
			const modes: FilterMode[] = ["default", "no-tools", "user-only", "labeled-only", "all"];
			const currentIndex = modes.indexOf(this.filterMode);
			this.filterMode = modes[(currentIndex + 1) % modes.length];
			this.foldedNodes.clear();
			this.applyFilter();
		} else if (kb.matches(keyData, "tui.editor.deleteCharBackward")) {
			if (this.searchQuery.length > 0) {
				this.searchQuery = this.searchQuery.slice(0, -1);
				this.foldedNodes.clear();
				this.applyFilter();
			}
		} else if (kb.matches(keyData, "app.tree.editLabel")) {
			const selected = this.filteredNodes[this.selectedIndex];
			if (selected && this.onLabelEdit) {
				this.onLabelEdit(selected.node.entry.id, selected.node.label);
			}
		} else if (kb.matches(keyData, "app.tree.toggleLabelTimestamp")) {
			this.showLabelTimestamps = !this.showLabelTimestamps;
		} else {
			const hasControlChars = [...keyData].some((ch) => {
				const code = ch.charCodeAt(0);
				return code < 32 || code === 0x7f || (code >= 0x80 && code <= 0x9f);
			});
			if (!hasControlChars && keyData.length > 0) {
				this.searchQuery += keyData;
				this.foldedNodes.clear();
				this.applyFilter();
			}
		}
	}

	/**
	 * Whether a node can be folded. A node is foldable if it has visible children
	 * and is either a root (no visible parent) or a segment start (visible parent
	 * has multiple visible children).
	 * 判断某个节点是否可折叠。当节点拥有可见子节点，且本身要么是根节点（没有可见父节点），
	 * 要么是分段起点（其可见父节点拥有多个可见子节点）时，该节点即可折叠。
	 */
	private isFoldable(entryId: string): boolean {
		const children = this.visibleChildrenMap.get(entryId);
		if (!children || children.length === 0) return false;
		const parentId = this.visibleParentMap.get(entryId);
		if (parentId === null || parentId === undefined) return true;
		const siblings = this.visibleChildrenMap.get(parentId);
		return siblings !== undefined && siblings.length > 1;
	}

	/**
	 * Find the index of the next branch segment start in the given direction.
	 * 沿指定方向查找下一个分支分段起点的索引。
	 * A segment start is the first child of a branch point.
	 * 分段起点即某个分叉点的第一个子节点。
	 *
	 * "up" walks the visible parent chain; "down" walks visible children
	 * (always following the first child).
	 * "up" 沿可见父节点链向上遍历；"down" 沿可见子节点向下遍历（始终沿第一个子节点前进）。
	 */
	private findBranchSegmentStart(direction: "up" | "down"): number {
		const selectedId = this.filteredNodes[this.selectedIndex]?.node.entry.id;
		if (!selectedId) return this.selectedIndex;

		const indexByEntryId = new Map(this.filteredNodes.map((node, i) => [node.node.entry.id, i]));
		let currentId: string = selectedId;
		if (direction === "down") {
			while (true) {
				const children: string[] = this.visibleChildrenMap.get(currentId) ?? [];
				if (children.length === 0) return indexByEntryId.get(currentId)!;
				if (children.length > 1) return indexByEntryId.get(children[0])!;
				currentId = children[0];
			}
		}

		// direction === "up"
		// 方向为 "up"（向上）的情形
		while (true) {
			const parentId: string | null = this.visibleParentMap.get(currentId) ?? null;
			if (parentId === null) return indexByEntryId.get(currentId)!;
			const children = this.visibleChildrenMap.get(parentId) ?? [];
			if (children.length > 1) {
				const segmentStart = indexByEntryId.get(currentId)!;
				if (segmentStart < this.selectedIndex) {
					return segmentStart;
				}
			}
			currentId = parentId;
		}
	}
}

/** Component that displays the current search query
 *  用于展示当前搜索关键词的组件 */
class SearchLine implements Component {
	private treeList: TreeList;

	constructor(treeList: TreeList) {
		this.treeList = treeList;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const query = this.treeList.getSearchQuery();
		if (query) {
			return [truncateToWidth(`  ${theme.fg("muted", "Type to search:")} ${theme.fg("accent", query)}`, width)];
		}
		return [truncateToWidth(`  ${theme.fg("muted", "Type to search:")}`, width)];
	}

	handleInput(_keyData: string): void {}
}

/** Component that renders tree help as semantic rows with chunk-aware wrapping
 *  将树形界面的帮助信息按语义行渲染、并进行分块感知换行的组件 */
class TreeHelp implements Component {
	invalidate(): void {}

	render(width: number): string[] {
		const items = TREE_HELP_ITEMS.map(({ keys, label, labelFirst }) => {
			const text = formatHelpKeys(keys);
			if (!text) return label;
			return labelFirst ? `${label} ${text}` : `${text} ${label}`;
		});

		const availableWidth = Math.max(1, width);
		const indent = "  ";
		const separator = " · ";
		const lines: string[] = [];
		let currentLine = "";

		for (const item of items) {
			const candidate = currentLine
				? `${currentLine}${separator}${item}`
				: visibleWidth(`${indent}${item}`) <= availableWidth
					? `${indent}${item}`
					: item;
			if (!currentLine || visibleWidth(candidate) <= availableWidth) {
				currentLine = candidate;
				continue;
			}

			lines.push(...wrapTextWithAnsi(currentLine.trimEnd(), availableWidth));
			currentLine = visibleWidth(`${indent}${item}`) <= availableWidth ? `${indent}${item}` : item;
		}

		if (currentLine) {
			lines.push(...wrapTextWithAnsi(currentLine.trimEnd(), availableWidth));
		}

		return lines.map((line) => theme.fg("muted", line));
	}
}

const TREE_HELP_ITEMS: Array<{ keys: Keybinding[]; label: string; labelFirst?: boolean }> = [
	{ keys: ["tui.select.up", "tui.select.down"], label: "move" },
	{ keys: ["tui.editor.cursorLeft", "tui.editor.cursorRight"], label: "page" },
	{ keys: ["app.tree.foldOrUp", "app.tree.unfoldOrDown"], label: "branch" },
	{ keys: ["app.message.copy"], label: "copy" },
	{ keys: ["app.tree.editLabel"], label: "label" },
	{ keys: ["app.tree.toggleLabelTimestamp"], label: "label time" },
	{
		keys: [
			"app.tree.filter.default",
			"app.tree.filter.noTools",
			"app.tree.filter.userOnly",
			"app.tree.filter.labeledOnly",
			"app.tree.filter.all",
		],
		label: "filters",
		labelFirst: true,
	},
	{ keys: ["app.tree.filter.cycleForward", "app.tree.filter.cycleBackward"], label: "cycle", labelFirst: true },
];

function formatHelpKeys(keybindings: Keybinding[]): string {
	const keys: string[] = [];
	for (const keybinding of keybindings) {
		const key = getKeybindings().getKeys(keybinding)[0];
		if (key !== undefined) keys.push(key);
	}
	if (keys.length === 0) return "";

	return formatKeyText(compactRawKeys(keys))
		.replace(/\bpageUp\b/g, "pgup")
		.replace(/\bpageDown\b/g, "pgdn")
		.replace(/\bup\b/g, "↑")
		.replace(/\bdown\b/g, "↓")
		.replace(/\bleft\b/g, "←")
		.replace(/\bright\b/g, "→");
}

function compactRawKeys(keys: string[]): string {
	if (keys.length === 1) return keys[0]!;

	const parts = keys.map((key) => {
		const separatorIndex = key.lastIndexOf("+");
		return separatorIndex === -1
			? { prefix: "", suffix: key }
			: { prefix: key.slice(0, separatorIndex + 1), suffix: key.slice(separatorIndex + 1) };
	});
	const prefix = parts[0]!.prefix;
	return prefix && parts.every((part) => part.prefix === prefix)
		? `${prefix}${parts.map((part) => part.suffix).join("/")}`
		: keys.join("/");
}

/** Label input component shown when editing a label
 *  编辑标签（label）时显示的标签输入组件 */
class LabelInput implements Component, Focusable {
	private input: Input;
	private entryId: string;
	public onSubmit?: (entryId: string, label: string | undefined) => void;
	public onCancel?: () => void;

	// Focusable implementation - propagate to input for IME cursor positioning
	// Focusable 接口实现 —— 将焦点状态传递给 input，以便正确定位输入法（IME）光标
	private _focused = false;
	get focused(): boolean {
		return this._focused;
	}
	set focused(value: boolean) {
		this._focused = value;
		this.input.focused = value;
	}

	constructor(entryId: string, currentLabel: string | undefined) {
		this.entryId = entryId;
		this.input = new Input();
		if (currentLabel) {
			this.input.setValue(currentLabel);
		}
	}

	invalidate(): void {}

	render(width: number): string[] {
		const lines: string[] = [];
		const indent = "  ";
		const availableWidth = width - indent.length;
		lines.push(truncateToWidth(`${indent}${theme.fg("muted", "Label (empty to remove):")}`, width));
		lines.push(...this.input.render(availableWidth).map((line) => truncateToWidth(`${indent}${line}`, width)));
		lines.push(
			truncateToWidth(
				`${indent}${keyHint("tui.select.confirm", "save")}  ${keyHint("tui.select.cancel", "cancel")}`,
				width,
			),
		);
		return lines;
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();
		if (kb.matches(keyData, "tui.select.confirm")) {
			const value = this.input.getValue().trim();
			this.onSubmit?.(this.entryId, value || undefined);
		} else if (kb.matches(keyData, "tui.select.cancel")) {
			this.onCancel?.();
		} else {
			this.input.handleInput(keyData);
		}
	}
}

/**
 * Component that renders a session tree selector for navigation
 * 用于渲染会话树选择器以供导航的组件
 */
export class TreeSelectorComponent extends Container implements Focusable {
	private treeList: TreeList;
	private labelInput: LabelInput | null = null;
	private labelInputContainer: Container;
	private treeContainer: Container;
	private onLabelChangeCallback?: (entryId: string, label: string | undefined) => void;
	public onCopy?: (text: string | undefined) => void;

	// Focusable implementation - propagate to labelInput when active for IME cursor positioning
	// Focusable 接口实现 —— 当 labelInput 处于激活状态时将焦点传递给它，以便正确定位输入法（IME）光标
	private _focused = false;
	get focused(): boolean {
		return this._focused;
	}
	set focused(value: boolean) {
		this._focused = value;
		// Propagate to labelInput when it's active
		// 当 labelInput 处于激活状态时，将焦点状态传递给它
		if (this.labelInput) {
			this.labelInput.focused = value;
		}
	}

	constructor(
		tree: SessionTreeNode[],
		currentLeafId: string | null,
		terminalHeight: number,
		onSelect: (entryId: string) => void,
		onCancel: () => void,
		onLabelChange?: (entryId: string, label: string | undefined) => void,
		initialSelectedId?: string,
		initialFilterMode?: FilterMode,
	) {
		super();

		this.onLabelChangeCallback = onLabelChange;
		const maxVisibleLines = Math.max(5, Math.floor(terminalHeight / 2));

		this.treeList = new TreeList(tree, currentLeafId, maxVisibleLines, initialSelectedId, initialFilterMode);
		this.treeList.onSelect = onSelect;
		this.treeList.onCancel = onCancel;
		this.treeList.onCopy = (text) => this.onCopy?.(text);
		this.treeList.onLabelEdit = (entryId, currentLabel) => this.showLabelInput(entryId, currentLabel);

		this.treeContainer = new Container();
		this.treeContainer.addChild(this.treeList);

		this.labelInputContainer = new Container();

		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder());
		this.addChild(new Text(theme.bold("  Session Tree"), 1, 0));
		this.addChild(new TreeHelp());
		this.addChild(new SearchLine(this.treeList));
		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));
		this.addChild(this.treeContainer);
		this.addChild(this.labelInputContainer);
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder());

		if (tree.length === 0) {
			setTimeout(() => onCancel(), 100);
		}
	}

	private showLabelInput(entryId: string, currentLabel: string | undefined): void {
		this.labelInput = new LabelInput(entryId, currentLabel);
		this.labelInput.onSubmit = (id, label) => {
			this.treeList.updateNodeLabel(id, label);
			this.onLabelChangeCallback?.(id, label);
			this.hideLabelInput();
		};
		this.labelInput.onCancel = () => this.hideLabelInput();

		// Propagate current focused state to the new labelInput
		// 将当前焦点状态传递给新建的 labelInput
		this.labelInput.focused = this._focused;

		this.treeContainer.clear();
		this.labelInputContainer.clear();
		this.labelInputContainer.addChild(this.labelInput);
	}

	private hideLabelInput(): void {
		this.labelInput = null;
		this.labelInputContainer.clear();
		this.treeContainer.clear();
		this.treeContainer.addChild(this.treeList);
	}

	handleInput(keyData: string): void {
		if (this.labelInput) {
			this.labelInput.handleInput(keyData);
		} else {
			this.treeList.handleInput(keyData);
		}
	}

	getTreeList(): TreeList {
		return this.treeList;
	}
}
