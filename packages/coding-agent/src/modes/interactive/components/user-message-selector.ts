import { type Component, Container, getKeybindings, Spacer, Text, truncateToWidth } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { DynamicBorder } from "./dynamic-border.ts";

interface UserMessageItem {
	id: string; // Entry ID in the session / 会话中的条目 ID
	text: string; // The message text / 消息文本
	timestamp?: string; // Optional timestamp if available / 可选的时间戳（若可用）
}

/**
 * Custom user message list component with selection
 * 支持选择功能的自定义用户消息列表组件
 */
class UserMessageList implements Component {
	private messages: UserMessageItem[] = [];
	private selectedIndex: number = 0;
	public onSelect?: (entryId: string) => void;
	public onCancel?: () => void;
	private maxVisible: number = 10; // Max messages visible / 可见消息的最大条数

	constructor(messages: UserMessageItem[], initialSelectedId?: string) {
		// Store messages in chronological order (oldest to newest)
		// 按时间顺序存储消息（从最旧到最新）
		this.messages = messages;
		const initialIndex = initialSelectedId ? messages.findIndex((message) => message.id === initialSelectedId) : -1;
		// Start with selected message if provided, else default to the most recent
		// 若提供了已选中的消息则以其为起点，否则默认选中最新的一条
		this.selectedIndex = initialIndex >= 0 ? initialIndex : Math.max(0, messages.length - 1);
	}

	invalidate(): void {
		// No cached state to invalidate currently
		// 目前没有需要失效处理的缓存状态
	}

	render(width: number): string[] {
		const lines: string[] = [];

		if (this.messages.length === 0) {
			lines.push(theme.fg("muted", "  No user messages found"));
			return lines;
		}

		// Calculate visible range with scrolling
		// 结合滚动计算可见范围
		const startIndex = Math.max(
			0,
			Math.min(this.selectedIndex - Math.floor(this.maxVisible / 2), this.messages.length - this.maxVisible),
		);
		const endIndex = Math.min(startIndex + this.maxVisible, this.messages.length);

		// Render visible messages (2 lines per message + blank line)
		// 渲染可见消息（每条消息占 2 行 + 1 个空行）
		for (let i = startIndex; i < endIndex; i++) {
			const message = this.messages[i];
			const isSelected = i === this.selectedIndex;

			// Normalize message to single line
			// 将消息归一化为单行
			const normalizedMessage = message.text.replace(/\n/g, " ").trim();

			// First line: cursor + message
			// 第一行：光标 + 消息内容
			const cursor = isSelected ? theme.fg("accent", "› ") : "  ";
			const maxMsgWidth = width - 2; // Account for cursor (2 chars) / 为光标预留宽度（2 个字符）
			const truncatedMsg = truncateToWidth(normalizedMessage, maxMsgWidth);
			const messageLine = cursor + (isSelected ? theme.bold(truncatedMsg) : truncatedMsg);

			lines.push(messageLine);

			// Second line: metadata (position in history)
			// 第二行：元数据（在历史记录中的位置）
			const position = i + 1;
			const metadata = `  Message ${position} of ${this.messages.length}`;
			const metadataLine = theme.fg("muted", metadata);
			lines.push(metadataLine);
			lines.push(""); // Blank line between messages / 消息之间的空行
		}

		// Add scroll indicator if needed
		// 如有需要，添加滚动指示器
		if (startIndex > 0 || endIndex < this.messages.length) {
			const scrollInfo = theme.fg("muted", `  (${this.selectedIndex + 1}/${this.messages.length})`);
			lines.push(scrollInfo);
		}

		return lines;
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();
		// Up arrow - go to previous (older) message, wrap to bottom when at top
		// 上方向键——跳转到上一条（更旧的）消息，位于顶部时回绕到底部
		if (kb.matches(keyData, "tui.select.up")) {
			this.selectedIndex = this.selectedIndex === 0 ? this.messages.length - 1 : this.selectedIndex - 1;
		}
		// Down arrow - go to next (newer) message, wrap to top when at bottom
		// 下方向键——跳转到下一条（更新的）消息，位于底部时回绕到顶部
		else if (kb.matches(keyData, "tui.select.down")) {
			this.selectedIndex = this.selectedIndex === this.messages.length - 1 ? 0 : this.selectedIndex + 1;
		}
		// Enter - select message and branch
		// 回车键——选中消息并创建分支
		else if (kb.matches(keyData, "tui.select.confirm")) {
			const selected = this.messages[this.selectedIndex];
			if (selected && this.onSelect) {
				this.onSelect(selected.id);
			}
		}
		// Escape - cancel
		// Escape 键——取消
		else if (kb.matches(keyData, "tui.select.cancel")) {
			if (this.onCancel) {
				this.onCancel();
			}
		}
	}
}

/**
 * Component that renders a user message selector for branching
 * 渲染用户消息选择器以便创建分支的组件
 */
export class UserMessageSelectorComponent extends Container {
	private messageList: UserMessageList;

	constructor(
		messages: UserMessageItem[],
		onSelect: (entryId: string) => void,
		onCancel: () => void,
		initialSelectedId?: string,
	) {
		super();

		// Add header
		// 添加头部
		this.addChild(new Spacer(1));
		this.addChild(new Text(theme.bold("Fork from Message"), 1, 0));
		this.addChild(
			new Text(
				theme.fg("muted", "Select a user message to copy the active path up to that point into a new session"),
				1,
				0,
			),
		);
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder());
		this.addChild(new Spacer(1));

		// Create message list
		// 创建消息列表
		this.messageList = new UserMessageList(messages, initialSelectedId);
		this.messageList.onSelect = onSelect;
		this.messageList.onCancel = onCancel;

		this.addChild(this.messageList);

		// Add bottom border
		// 添加底部边框
		this.addChild(new Spacer(1));
		this.addChild(new DynamicBorder());

		// Auto-cancel if no messages
		// 若没有任何消息则自动取消
		if (messages.length === 0) {
			setTimeout(() => onCancel(), 100);
		}
	}

	getMessageList(): UserMessageList {
		return this.messageList;
	}
}
