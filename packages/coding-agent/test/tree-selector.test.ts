import { stripVTControlCharacters } from "node:util";
import { setKeybindings, visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import type {
	ModelChangeEntry,
	SessionEntry,
	SessionMessageEntry,
	SessionTreeNode,
} from "../src/core/session-manager.ts";
import { TreeSelectorComponent } from "../src/modes/interactive/components/tree-selector.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

beforeAll(() => {
	initTheme("dark");
});

beforeEach(() => {
	// Ensure test isolation: keybindings are a global singleton
	// 确保测试相互隔离：键位绑定(keybindings)是全局单例
	setKeybindings(new KeybindingsManager());
});

// Helper to create a user message entry
// 用于创建用户消息条目的辅助函数
function userMessage(id: string, parentId: string | null, content: string): SessionMessageEntry {
	return {
		type: "message",
		id,
		parentId,
		timestamp: new Date().toISOString(),
		message: { role: "user", content, timestamp: Date.now() },
	};
}

// Helper to create an assistant message entry
// 用于创建助手(assistant)消息条目的辅助函数
function assistantMessage(id: string, parentId: string | null, text: string): SessionMessageEntry {
	return {
		type: "message",
		id,
		parentId,
		timestamp: new Date().toISOString(),
		message: {
			role: "assistant",
			content: [{ type: "text", text }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-sonnet-4",
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "stop",
			timestamp: Date.now(),
		},
	};
}

// Helper to create a tool-call-only assistant message (filtered out in default mode)
// 用于创建仅含工具调用(tool call)的助手消息的辅助函数(在默认模式下会被过滤掉)
function toolCallOnlyAssistant(id: string, parentId: string | null): SessionMessageEntry {
	return {
		type: "message",
		id,
		parentId,
		timestamp: new Date().toISOString(),
		message: {
			role: "assistant",
			content: [{ type: "toolCall", id: `tc-${id}`, name: "read", arguments: { path: "test.ts" } }],
			api: "anthropic-messages",
			provider: "anthropic",
			model: "claude-sonnet-4",
			usage: {
				input: 0,
				output: 0,
				cacheRead: 0,
				cacheWrite: 0,
				totalTokens: 0,
				cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
			},
			stopReason: "toolUse",
			timestamp: Date.now(),
		},
	};
}

// Helper to create a model_change entry
// 用于创建 model_change 条目的辅助函数
function modelChange(id: string, parentId: string | null): ModelChangeEntry {
	return {
		type: "model_change",
		id,
		parentId,
		timestamp: new Date().toISOString(),
		provider: "anthropic",
		modelId: "claude-sonnet-4",
	};
}

// Helper to build a tree from entries using parentId relationships
// 用于依据 parentId 关系从条目集合构建树的辅助函数
function buildTree(entries: Array<SessionEntry>): SessionTreeNode[] {
	if (entries.length === 0) return [];

	const nodes: SessionTreeNode[] = entries.map((entry) => ({
		entry,
		children: [],
	}));

	const byId = new Map<string, SessionTreeNode>();
	for (const node of nodes) {
		byId.set(node.entry.id, node);
	}

	const roots: SessionTreeNode[] = [];
	for (const node of nodes) {
		if (node.entry.parentId === null) {
			roots.push(node);
		} else {
			const parent = byId.get(node.entry.parentId);
			if (parent) {
				parent.children.push(node);
			}
		}
	}
	return roots;
}

describe("TreeSelectorComponent", () => {
	describe("initial selection with metadata entries", () => {
		test("focuses nearest visible ancestor when currentLeafId is a model_change with sibling branch", () => {
			// Tree structure:
			// 树结构：
			// user-1
			// └── asst-1
			//     ├── user-2 (active branch)
			//     │       (活动分支)
			//     │   └── model-1 (model_change, CURRENT LEAF)
			//     │           (model_change 条目，当前叶子节点)
			//     └── user-3 (sibling branch, added later chronologically)
			//             (兄弟分支，按时间顺序后添加)
			const entries = [
				userMessage("user-1", null, "hello"),
				assistantMessage("asst-1", "user-1", "hi"),
				userMessage("user-2", "asst-1", "active branch"), // Active branch 活动分支
				modelChange("model-1", "user-2"), // Current leaf (metadata) 当前叶子节点(元数据)
				userMessage("user-3", "asst-1", "sibling branch"), // Sibling branch 兄弟分支
			];
			const tree = buildTree(entries);

			const selector = new TreeSelectorComponent(
				tree,
				"model-1", // currentLeafId is the model_change entry currentLeafId 即为该 model_change 条目
				24,
				() => {},
				() => {},
			);

			const list = selector.getTreeList();
			// Should focus on user-2 (parent of model-1), not user-3 (last item)
			// 应聚焦到 user-2(model-1 的父节点)，而不是 user-3(最后一项)
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");
		});

		test("focuses nearest visible ancestor when currentLeafId is a thinking_level_change entry", () => {
			// Similar structure with thinking_level_change instead of model_change
			// 结构类似，只是把 model_change 换成了 thinking_level_change
			const entries = [
				userMessage("user-1", null, "hello"),
				assistantMessage("asst-1", "user-1", "hi"),
				userMessage("user-2", "asst-1", "active branch"),
				{
					type: "thinking_level_change" as const,
					id: "thinking-1",
					parentId: "user-2",
					timestamp: new Date().toISOString(),
					thinkingLevel: "high",
				},
				userMessage("user-3", "asst-1", "sibling branch"),
			];
			const tree = buildTree(entries);

			const selector = new TreeSelectorComponent(
				tree,
				"thinking-1",
				24,
				() => {},
				() => {},
			);

			const list = selector.getTreeList();
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");
		});
	});

	describe("filter switching with parent traversal", () => {
		test("switches to nearest visible user message when changing to user-only filter", () => {
			// In user-only filter: [user-1, user-2, user-3]
			// 在仅显示用户消息的过滤模式下：[user-1, user-2, user-3]
			const entries = [
				userMessage("user-1", null, "hello"),
				assistantMessage("asst-1", "user-1", "hi"),
				userMessage("user-2", "asst-1", "active branch"),
				assistantMessage("asst-2", "user-2", "response"),
				userMessage("user-3", "asst-1", "sibling branch"),
			];
			const tree = buildTree(entries);

			const selector = new TreeSelectorComponent(
				tree,
				"asst-2",
				24,
				() => {},
				() => {},
			);

			const list = selector.getTreeList();
			expect(list.getSelectedNode()?.entry.id).toBe("asst-2");

			// Simulate Ctrl+U (user-only filter)
			// 模拟 Ctrl+U(仅显示用户消息的过滤模式)
			selector.handleInput("\x15");

			// Should now be on user-2 (the parent user message), not user-3
			// 此时应停留在 user-2(父级用户消息)上，而不是 user-3
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");
		});

		test("returns to nearest visible ancestor when switching back to default filter", () => {
			// Same branching structure
			// 相同的分支结构
			const entries = [
				userMessage("user-1", null, "hello"),
				assistantMessage("asst-1", "user-1", "hi"),
				userMessage("user-2", "asst-1", "active branch"),
				assistantMessage("asst-2", "user-2", "response"),
				userMessage("user-3", "asst-1", "sibling branch"),
			];
			const tree = buildTree(entries);

			const selector = new TreeSelectorComponent(
				tree,
				"asst-2",
				24,
				() => {},
				() => {},
			);

			const list = selector.getTreeList();
			expect(list.getSelectedNode()?.entry.id).toBe("asst-2");

			// Switch to user-only
			// 切换到仅显示用户消息模式
			selector.handleInput("\x15"); // Ctrl+U
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");

			// Switch back to default - should stay on user-2
			// 切换回默认模式——应仍停留在 user-2 上
			// (since that's what we navigated to via parent traversal)
			// (因为这正是我们通过向父节点回溯所定位到的节点)
			selector.handleInput("\x04"); // Ctrl+D
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");
		});
	});

	describe("help", () => {
		test("renders semantic help rows without truncating narrow terminal controls", () => {
			const entries = [userMessage("user-1", null, "hello"), assistantMessage("asst-1", "user-1", "hi")];
			const tree = buildTree(entries);
			const selector = new TreeSelectorComponent(
				tree,
				"asst-1",
				24,
				() => {},
				() => {},
			);

			const plainLines = selector.render(30).map(stripVTControlCharacters);
			const plain = plainLines.join("\n");
			expect(plain).toContain("branch");
			expect(plain).toContain("copy");
			expect(plain).toContain("filters");
			expect(plain).toContain("cycle");
			expect(plain).toContain("label time");
			expect(plain).not.toContain("...");
			expect(plainLines.every((line) => visibleWidth(line) <= 30)).toBe(true);
		});
	});

	describe("copy", () => {
		test("copies the full selected message with ctrl+x", () => {
			const message = `${"long message ".repeat(30)}\nsecond line`;
			const tree = buildTree([userMessage("user-1", null, "hello"), assistantMessage("asst-1", "user-1", message)]);
			const selector = new TreeSelectorComponent(
				tree,
				"asst-1",
				24,
				() => {},
				() => {},
			);
			let copied: string | undefined;
			selector.onCopy = (text) => {
				copied = text;
			};

			selector.handleInput("\x18");

			expect(copied).toBe(message);
		});
	});

	describe("label timestamps", () => {
		test("toggles label timestamps for labeled nodes", () => {
			const entries = [userMessage("user-1", null, "hello"), assistantMessage("asst-1", "user-1", "hi")];
			const tree = buildTree(entries);
			const labelDate = new Date(2026, 2, 28, 14, 32, 0);
			tree[0]!.label = "checkpoint";
			tree[0]!.labelTimestamp = labelDate.toISOString();

			const selector = new TreeSelectorComponent(
				tree,
				"asst-1",
				24,
				() => {},
				() => {},
			);

			const list = selector.getTreeList();
			let render = list.render(200).join("\n");
			expect(render).toContain("[checkpoint]");
			expect(render).not.toContain("3/28 14:32");
			expect(render).not.toContain("[+label time]");

			selector.handleInput("T");

			render = list.render(200).join("\n");
			expect(render).toContain("3/28 14:32");
			expect(render).toContain("[+label time]");
		});
	});

	describe("empty filter preservation", () => {
		test("preserves selection when switching to empty labeled filter and back", () => {
			// Tree with no labels
			// 不含任何标签(label)的树
			const entries = [
				userMessage("user-1", null, "hello"),
				assistantMessage("asst-1", "user-1", "hi"),
				userMessage("user-2", "asst-1", "bye"),
				assistantMessage("asst-2", "user-2", "goodbye"),
			];
			const tree = buildTree(entries);

			const selector = new TreeSelectorComponent(
				tree,
				"asst-2",
				24,
				() => {},
				() => {},
			);

			const list = selector.getTreeList();
			expect(list.getSelectedNode()?.entry.id).toBe("asst-2");

			// Switch to labeled-only filter (no labels exist, so empty result)
			// 切换到仅显示带标签节点的过滤模式(不存在任何标签，因此结果为空)
			selector.handleInput("\x0c"); // Ctrl+L

			// The list should be empty, getSelectedNode returns undefined
			// 列表应为空，getSelectedNode 返回 undefined
			expect(list.getSelectedNode()).toBeUndefined();

			// Switch back to default filter
			// 切换回默认过滤模式
			selector.handleInput("\x04"); // Ctrl+D

			// Should restore to asst-2 (the selection before we switched to empty filter)
			// 应恢复到 asst-2(切换到空过滤模式之前所选中的节点)
			expect(list.getSelectedNode()?.entry.id).toBe("asst-2");
		});

		test("preserves selection through multiple empty filter switches", () => {
			const entries = [userMessage("user-1", null, "hello"), assistantMessage("asst-1", "user-1", "hi")];
			const tree = buildTree(entries);

			const selector = new TreeSelectorComponent(
				tree,
				"asst-1",
				24,
				() => {},
				() => {},
			);

			const list = selector.getTreeList();
			expect(list.getSelectedNode()?.entry.id).toBe("asst-1");

			// Switch to labeled-only (empty) - Ctrl+L toggles labeled ↔ default
			// 切换到仅显示带标签节点的模式(结果为空)——Ctrl+L 在带标签模式与默认模式之间切换
			selector.handleInput("\x0c"); // Ctrl+L -> labeled-only Ctrl+L -> 仅显示带标签节点
			expect(list.getSelectedNode()).toBeUndefined();

			// Switch to default, then back to labeled-only
			// 先切换到默认模式，再切回仅显示带标签节点的模式
			selector.handleInput("\x0c"); // Ctrl+L -> default (toggle back) Ctrl+L -> 默认模式(切换回来)
			expect(list.getSelectedNode()?.entry.id).toBe("asst-1");

			selector.handleInput("\x0c"); // Ctrl+L -> labeled-only again Ctrl+L -> 再次切换到仅显示带标签节点
			expect(list.getSelectedNode()).toBeUndefined();

			// Switch back to default with Ctrl+D
			// 用 Ctrl+D 切换回默认模式
			selector.handleInput("\x04"); // Ctrl+D
			expect(list.getSelectedNode()?.entry.id).toBe("asst-1");
		});
	});

	describe("branch navigation and folding with ctrl+arrow keys", () => {
		// Key escape sequences
		// 按键转义序列
		const UP = "\x1b[A";
		const DOWN = "\x1b[B";
		const CTRL_LEFT = "\x1b[1;5D";
		const CTRL_RIGHT = "\x1b[1;5C";
		const ALT_LEFT = "\x1b[1;3D";
		const ALT_RIGHT = "\x1b[1;3C";

		// Tree structure:
		// 树结构：
		//
		// user-1
		// asst-1
		// user-2
		// asst-2          ← branch point (has 2 children)
		//                   分支点(有 2 个子节点)
		// ├─ user-3a      ← branch A (active: leaf is asst-4a)
		// │                 分支 A(活动分支：叶子节点为 asst-4a)
		// │  asst-3a
		// │  user-4a
		// │  asst-4a
		// └─ user-3b      ← branch B
		//                   分支 B
		//    asst-3b
		//    user-4b
		//
		// Foldable nodes: user-1 (root), user-3a (segment start), user-3b (segment start)
		// 可折叠节点：user-1(根节点)、user-3a(区段起点)、user-3b(区段起点)

		function buildBranchingTree() {
			const entries: SessionEntry[] = [
				userMessage("user-1", null, "first message"),
				assistantMessage("asst-1", "user-1", "response 1"),
				userMessage("user-2", "asst-1", "second message"),
				assistantMessage("asst-2", "user-2", "response 2"),
				// Branch A (active)
				// 分支 A(活动分支)
				userMessage("user-3a", "asst-2", "branch A start"),
				assistantMessage("asst-3a", "user-3a", "branch A response"),
				userMessage("user-4a", "asst-3a", "branch A deep"),
				assistantMessage("asst-4a", "user-4a", "branch A leaf"),
				// Branch B
				// 分支 B
				userMessage("user-3b", "asst-2", "branch B start"),
				assistantMessage("asst-3b", "user-3b", "branch B response"),
				userMessage("user-4b", "asst-3b", "branch B deep"),
			];
			return buildTree(entries);
		}

		test("ctrl+right unfolds a folded node, then does segment jump when unfolded", () => {
			const tree = buildBranchingTree();
			const selector = new TreeSelectorComponent(
				tree,
				"asst-4a",
				24,
				() => {},
				() => {},
			);
			const list = selector.getTreeList();

			selector.handleInput(CTRL_LEFT); // asst-4a → user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(CTRL_LEFT); // fold user-3a 折叠 user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(DOWN); // user-3a → user-3b (children hidden) 子节点已隐藏
			expect(list.getSelectedNode()?.entry.id).toBe("user-3b");

			selector.handleInput(UP); // user-3b → user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(CTRL_RIGHT); // unfold user-3a 展开 user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(DOWN); // user-3a → asst-3a (children restored) 子节点已恢复显示
			expect(list.getSelectedNode()?.entry.id).toBe("asst-3a");

			selector.handleInput(CTRL_LEFT); // asst-3a → user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(CTRL_RIGHT); // user-3a → asst-4a (segment jump to leaf) 区段跳转至叶子节点
			expect(list.getSelectedNode()?.entry.id).toBe("asst-4a");
		});

		test("alt+left/right are aliases for fold and unfold navigation", () => {
			const tree = buildBranchingTree();
			const selector = new TreeSelectorComponent(
				tree,
				"asst-4a",
				24,
				() => {},
				() => {},
			);
			const list = selector.getTreeList();

			selector.handleInput(ALT_LEFT); // asst-4a → user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(ALT_LEFT); // fold user-3a 折叠 user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(ALT_RIGHT); // unfold user-3a 展开 user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(ALT_RIGHT); // user-3a → asst-4a
			expect(list.getSelectedNode()?.entry.id).toBe("asst-4a");
		});

		test("folding root hides entire subtree, nested fold preserved on unfold", () => {
			const tree = buildBranchingTree();
			const selector = new TreeSelectorComponent(
				tree,
				"asst-4a",
				24,
				() => {},
				() => {},
			);
			const list = selector.getTreeList();

			selector.handleInput(CTRL_LEFT); // asst-4a → user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(CTRL_LEFT); // fold user-3a 折叠 user-3a
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(CTRL_LEFT); // user-3a (folded) → user-1 user-3a(已折叠) → user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(CTRL_LEFT); // fold user-1 折叠 user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(DOWN); // wrap (only visible node) 循环回绕(唯一可见节点)
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(CTRL_RIGHT); // unfold user-1 展开 user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(CTRL_RIGHT); // user-1 → user-3a (segment jump, user-3a still folded) 区段跳转，user-3a 仍处于折叠状态
			expect(list.getSelectedNode()?.entry.id).toBe("user-3a");

			selector.handleInput(DOWN); // user-3a → user-3b (user-3a still folded) user-3a 仍处于折叠状态
			expect(list.getSelectedNode()?.entry.id).toBe("user-3b");
		});

		test("fold and navigate on non-active branch", () => {
			const tree = buildBranchingTree();
			const selector = new TreeSelectorComponent(
				tree,
				"asst-4a",
				24,
				() => {},
				() => {},
			);
			const list = selector.getTreeList();

			// Navigate down to user-3b (branch B)
			// 向下导航到 user-3b(分支 B)
			let found = false;
			for (let i = 0; i < 20; i++) {
				selector.handleInput(DOWN);
				if (list.getSelectedNode()?.entry.id === "user-3b") {
					found = true;
					break;
				}
			}
			expect(found).toBe(true);

			selector.handleInput(CTRL_RIGHT); // user-3b → user-4b (segment jump to leaf) 区段跳转至叶子节点
			expect(list.getSelectedNode()?.entry.id).toBe("user-4b");

			selector.handleInput(CTRL_LEFT); // user-4b → user-3b
			expect(list.getSelectedNode()?.entry.id).toBe("user-3b");

			selector.handleInput(CTRL_LEFT); // fold user-3b 折叠 user-3b
			expect(list.getSelectedNode()?.entry.id).toBe("user-3b");

			selector.handleInput(CTRL_LEFT); // user-3b (folded) → user-1 user-3b(已折叠) → user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");
		});

		test("fold and navigate with multiple roots", () => {
			const entries: SessionEntry[] = [
				userMessage("user-1", null, "first root"),
				assistantMessage("asst-1", "user-1", "response 1"),
				userMessage("user-2", null, "second root"),
				assistantMessage("asst-2", "user-2", "response 2"),
			];
			const tree = buildTree(entries);
			const selector = new TreeSelectorComponent(
				tree,
				"asst-1",
				24,
				() => {},
				() => {},
			);
			const list = selector.getTreeList();

			expect(list.getSelectedNode()?.entry.id).toBe("asst-1");

			selector.handleInput(CTRL_LEFT); // asst-1 → user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(CTRL_LEFT); // fold user-1 折叠 user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(DOWN); // user-1 → user-2 (children hidden) 子节点已隐藏
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");

			selector.handleInput(CTRL_RIGHT); // user-2 → asst-2 (segment jump to leaf) 区段跳转至叶子节点
			expect(list.getSelectedNode()?.entry.id).toBe("asst-2");

			selector.handleInput(CTRL_LEFT); // asst-2 → user-2
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");

			selector.handleInput(CTRL_LEFT); // fold user-2 折叠 user-2
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");

			selector.handleInput(CTRL_LEFT); // user-2 (folded, root) → stays on user-2 user-2(已折叠且为根节点) → 保持停留在 user-2
			expect(list.getSelectedNode()?.entry.id).toBe("user-2");
		});

		test("folding root hides descendants even when intermediate nodes are filtered out", () => {
			// user-1 → toolCallOnly-1 (filtered out) → user-2 → asst-2
			// user-1 → toolCallOnly-1(被过滤掉) → user-2 → asst-2
			const entries: SessionEntry[] = [
				userMessage("user-1", null, "hello"),
				toolCallOnlyAssistant("tool-asst-1", "user-1"),
				userMessage("user-2", "tool-asst-1", "follow up"),
				assistantMessage("asst-2", "user-2", "response"),
			];
			const tree = buildTree(entries);
			const selector = new TreeSelectorComponent(
				tree,
				"asst-2",
				24,
				() => {},
				() => {},
			);
			const list = selector.getTreeList();

			selector.handleInput(CTRL_LEFT); // asst-2 → user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(CTRL_LEFT); // fold user-1 折叠 user-1
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");

			selector.handleInput(DOWN); // wrap (only visible node) 循环回绕(唯一可见节点)
			expect(list.getSelectedNode()?.entry.id).toBe("user-1");
		});

		test("search resets fold state", () => {
			const tree = buildBranchingTree();
			const selector = new TreeSelectorComponent(
				tree,
				"asst-4a",
				24,
				() => {},
				() => {},
			);
			const list = selector.getTreeList();

			selector.handleInput(CTRL_LEFT); // asst-4a → user-3a
			selector.handleInput(CTRL_LEFT); // fold user-3a 折叠 user-3a

			selector.handleInput(DOWN); // user-3a → user-3b (children hidden) 子节点已隐藏
			expect(list.getSelectedNode()?.entry.id).toBe("user-3b");

			selector.handleInput("b"); // search resets folds 搜索会重置折叠状态
			selector.handleInput("\x1b"); // clear search 清除搜索

			// Navigate to user-3a to verify fold was reset
			// 导航到 user-3a 以验证折叠状态已被重置
			let currentId = "";
			for (let i = 0; i < 20; i++) {
				selector.handleInput(DOWN);
				currentId = list.getSelectedNode()?.entry.id ?? "";
				if (currentId === "user-3a") break;
			}
			expect(currentId).toBe("user-3a");

			selector.handleInput(DOWN); // user-3a → asst-3a (not user-3b) 而不是 user-3b
			expect(list.getSelectedNode()?.entry.id).toBe("asst-3a");
		});

		test("filter mode change resets fold state", () => {
			const tree = buildBranchingTree();
			const selector = new TreeSelectorComponent(
				tree,
				"asst-4a",
				24,
				() => {},
				() => {},
			);
			const list = selector.getTreeList();

			selector.handleInput(CTRL_LEFT); // asst-4a → user-3a
			selector.handleInput(CTRL_LEFT); // fold user-3a 折叠 user-3a

			selector.handleInput("\x15"); // ctrl+u: user-only filter resets folds ctrl+u：切换到仅显示用户消息的过滤模式会重置折叠状态
			selector.handleInput("\x04"); // ctrl+d: back to default ctrl+d：回到默认模式

			// Navigate to user-3a to verify fold was reset
			// 导航到 user-3a 以验证折叠状态已被重置
			let currentId = "";
			for (let i = 0; i < 20; i++) {
				selector.handleInput(DOWN);
				currentId = list.getSelectedNode()?.entry.id ?? "";
				if (currentId === "user-3a") break;
			}
			expect(currentId).toBe("user-3a");

			selector.handleInput(DOWN); // user-3a → asst-3a (not user-3b) 而不是 user-3b
			expect(list.getSelectedNode()?.entry.id).toBe("asst-3a");
		});
	});
});
