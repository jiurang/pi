/**
 * Tic-Tac-Toe extension - demonstrates executionMode: "sequential" on tools.
 * 井字棋扩展 —— 用于演示工具上的 executionMode: "sequential"（串行执行模式）。
 *
 * The user plays via /tic-tac-toe (arrow keys + Enter).
 * 用户通过 /tic-tac-toe 命令下棋（方向键移动 + 回车落子）。
 * The agent plays via a single tool `tic_tac_toe` that takes ONE atomic action
 * per call. To play at (r, c) from its cursor (r0, c0) the agent must emit the
 * required move_* and a final `play` as SEPARATE tool_use blocks inside ONE
 * assistant response.
 * 智能体（agent）通过单个工具 `tic_tac_toe` 下棋，每次调用只执行一个原子动作。
 * 若要把光标从 (r0, c0) 移动到 (r, c) 处落子，智能体必须在同一条助手回复中，
 * 以彼此独立的 tool_use 块的形式发出所需的若干 move_* 动作以及最后的 `play` 动作。
 *
 * Move actions share the agent cursor and have a 300ms delay. Under the
 * default parallel tool-execution mode this races: `play` can resolve before
 * the earlier `move_*` calls finish and O lands on the wrong cell. With
 * `executionMode: "sequential"` the runner serializes the sibling calls and O
 * lands on the intended cell.
 * 各个移动动作共享同一个智能体光标，且带有 300ms 延迟。在默认的并行工具执行模式下
 * 会产生竞态：`play` 可能先于前面的 `move_*` 调用完成，导致 O 落在错误的格子上。
 * 使用 `executionMode: "sequential"` 后，执行器会将同级调用串行化，O 就会落在预期的格子上。
 *
 * The user cursor (TUI-only) and the agent cursor (tool-only) are stored in
 * separate variables. Only the agent cursor is ever exposed to the agent.
 * 用户光标（仅用于 TUI）和智能体光标（仅用于工具）保存在各自独立的变量中。
 * 只有智能体光标才会暴露给智能体。
 */

import { StringEnum } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext, Theme, ToolExecutionMode } from "@earendil-works/pi-coding-agent";
import { type Component, matchesKey, Text, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { Type } from "typebox";

// Thrown from the tool on illegal actions. The agent runtime surfaces thrown
// errors as tool errors (isError=true) without resetting any of our state.
// 在非法动作时由工具抛出。智能体运行时会把抛出的错误呈现为工具错误
// （isError=true），并且不会重置我们的任何状态。
class TicTacToeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TicTacToeError";
	}
}

// ---------------------------------------------------------------------------
// Types
// 类型定义
// ---------------------------------------------------------------------------

type Cell = " " | "X" | "O";
type GameStatus = "playing" | "win_X" | "win_O" | "draw";

interface GameState {
	board: Cell[][];
	// User cursor (TUI-only, never exposed to the agent).
	// 用户光标（仅用于 TUI，绝不暴露给智能体）。
	userCursorRow: number;
	userCursorCol: number;
	// Agent cursor (manipulated by the tool, shown in the TUI during O's turn).
	// 智能体光标（由工具操作，在轮到 O 落子时显示在 TUI 中）。
	agentCursorRow: number;
	agentCursorCol: number;
	status: GameStatus;
	userMark: Cell;
	agentMark: Cell;
	currentTurn: Cell;
}

// Persisted with each toolResult for state reconstruction AND sent to the
// agent as `details`. Only the agent cursor is included: the user cursor is
// private to the TUI.
// 随每条 toolResult 一起持久化以便重建状态，同时作为 `details` 发送给智能体。
// 其中只包含智能体光标：用户光标是 TUI 私有的。
interface BoardDetails {
	board: Cell[][];
	agentCursorRow: number;
	agentCursorCol: number;
	status: GameStatus;
	currentTurn: Cell;
}

// ---------------------------------------------------------------------------
// Game logic
// 游戏逻辑
// ---------------------------------------------------------------------------

// Agent cursor home: where the cursor is reset to after a SUCCESSFUL play.
// Pinned at (0,0) so every non-origin play requires at least one move, which
// guarantees multiple tool calls per turn and makes the parallel-vs-sequential
// behavior observable in the demo. The cursor is NOT reset when the user plays
// nor on a failed `play` (cell taken), so the agent can retry without
// starting over.
// 智能体光标的初始位置（home）：成功落子后光标会被重置到这里。
// 固定在 (0,0)，这样任何非原点的落子都至少需要一次移动，从而保证每回合会产生多次
// 工具调用，使得并行与串行执行的差异在演示中可以被观察到。用户落子时以及 `play`
// 失败时（格子已被占用）都不会重置光标，因此智能体可以直接重试而无需从头开始。
const AGENT_CURSOR_HOME_ROW = 0;
const AGENT_CURSOR_HOME_COL = 0;

function createInitialState(): GameState {
	return {
		board: [
			[" ", " ", " "],
			[" ", " ", " "],
			[" ", " ", " "],
		],
		userCursorRow: 1,
		userCursorCol: 1,
		agentCursorRow: AGENT_CURSOR_HOME_ROW,
		agentCursorCol: AGENT_CURSOR_HOME_COL,
		status: "playing",
		userMark: "X",
		agentMark: "O",
		currentTurn: "X",
	};
}

function getWinLine(board: Cell[][]): [number, number][] | null {
	const lines: [number, number][][] = [
		[
			[0, 0],
			[0, 1],
			[0, 2],
		],
		[
			[1, 0],
			[1, 1],
			[1, 2],
		],
		[
			[2, 0],
			[2, 1],
			[2, 2],
		],
		[
			[0, 0],
			[1, 0],
			[2, 0],
		],
		[
			[0, 1],
			[1, 1],
			[2, 1],
		],
		[
			[0, 2],
			[1, 2],
			[2, 2],
		],
		[
			[0, 0],
			[1, 1],
			[2, 2],
		],
		[
			[0, 2],
			[1, 1],
			[2, 0],
		],
	];
	for (const line of lines) {
		const vals = line.map(([r, c]) => board[r][c]);
		if (vals[0] !== " " && vals[0] === vals[1] && vals[1] === vals[2]) {
			return line;
		}
	}
	return null;
}

function checkWin(board: Cell[][]): GameStatus {
	const winLine = getWinLine(board);
	if (winLine) {
		const [r, c] = winLine[0];
		return board[r][c] === "X" ? "win_X" : "win_O";
	}
	if (board.every((row) => row.every((c) => c !== " "))) {
		return "draw";
	}
	return "playing";
}

function boardToAscii(board: Cell[][], agentCursorRow: number, agentCursorCol: number): string {
	// Plain grid with coordinates for empty cells, marking the agent cursor
	// position with angle brackets. The user cursor is NEVER included: it is a
	// TUI-only concept and must not leak to the agent.
	// 纯文本网格，空格子显示其坐标，并用尖括号标记智能体光标所在位置。
	// 绝不包含用户光标：它只是 TUI 层面的概念，不能泄漏给智能体。
	const rows = board.map((row, r) =>
		row
			.map((c, cIdx) => {
				const onCursor = r === agentCursorRow && cIdx === agentCursorCol;
				if (c === " ") return onCursor ? `<[${r},${cIdx}]>` : ` [${r},${cIdx}] `;
				return onCursor ? `   <${c}>   ` : `    ${c}    `;
			})
			.join("|"),
	);
	const separator = "---------+---------+---------";
	return rows.join(`\n${separator}\n`);
}

// ---------------------------------------------------------------------------
// Visual board rendering (ANSI).
// 棋盘的可视化渲染（ANSI 转义序列）。
// - Cells have NO background fill. Only the centered glyph is drawn.
//   格子没有背景填充，只绘制居中的字形（glyph）。
// - Played cells color their glyph AND their surrounding borders in the
//   player's color, so each mark reads as a colored boxed region.
//   已落子的格子会把字形及其四周边框都染成对应玩家的颜色，
//   这样每个棋子看起来就像一个带颜色的方框区域。
// - Cursor is indicated with colored borders around the cursor cell.
//   光标通过给所在格子的四周边框着色来标示。
// ---------------------------------------------------------------------------

const CELL_WIDTH = 7;
const CELL_HEIGHT = 3;

// Player colors (SGR fg codes). Also used for the borders of played cells.
// 玩家颜色（SGR 前景色代码）。同时也用于已落子格子的边框。
const FG_CODE_X = "34"; // blue 蓝色
const FG_CODE_O = "33"; // yellow 黄色
const FG_CODE_WIN = "32"; // green (overrides on the winning line) 绿色（在获胜连线上会覆盖玩家自身的颜色）

// Single-character glyphs, picked for maximum visual size without emoji.
// 单字符字形，在不使用 emoji 的前提下挑选视觉上尽可能大的字符。
// - \u2573 (BOX DRAWINGS LIGHT DIAGONAL CROSS) for X
//   即细线对角交叉制表符，用作 X
// - \u25ef (LARGE CIRCLE) for O
//   即大圆圈，用作 O
const GLYPH_X = "\u2573";
const GLYPH_O = "\u25ef";

const DIM = (s: string) => `\x1b[2m${s}\x1b[22m`;
const RESET = "\x1b[0m";

function centerPad(content: string, width: number): string {
	const contentLen = visibleWidth(content);
	if (contentLen >= width) return truncateToWidth(content, width);
	const pad = width - contentLen;
	const left = Math.floor(pad / 2);
	return " ".repeat(left) + content + " ".repeat(pad - left);
}

// Fg color for a played cell's glyph and its surrounding borders. Undefined
// for empty cells.
// 已落子格子的字形及其四周边框所使用的前景色。空格子返回 undefined。
function cellFgCode(cell: Cell, isWin: boolean): string | undefined {
	if (cell === " ") return undefined;
	if (isWin) return FG_CODE_WIN;
	return cell === "X" ? FG_CODE_X : FG_CODE_O;
}

function buildCellContent(mark: Cell, lineIdx: number, isWin: boolean): string {
	const empty = " ".repeat(CELL_WIDTH);
	if (mark === " ") return empty;

	const isMidLine = lineIdx === Math.floor(CELL_HEIGHT / 2);
	if (!isMidLine) return empty;

	const glyph = mark === "X" ? GLYPH_X : GLYPH_O;
	const fg = cellFgCode(mark, isWin) as string;
	const padLen = CELL_WIDTH - visibleWidth(glyph);
	const leftPad = Math.floor(padLen / 2);
	const rightPad = padLen - leftPad;
	return `${" ".repeat(leftPad)}\x1b[${fg};1m${glyph}${RESET}${" ".repeat(rightPad)}`;
}

// Fg color for a border char based on its adjacent cells. Undefined when no
// adjacent cell is played or when adjacent plays disagree (border stays dim
// to show the separation).
// 根据相邻格子决定边框字符的前景色。当没有相邻格子被落子，或相邻落子颜色不一致时
// 返回 undefined（此时边框保持暗淡，以体现分隔效果）。
function borderFgCode(adjacent: ReadonlyArray<{ cell: Cell; isWin: boolean }>): string | undefined {
	const fgs = adjacent.map((a) => cellFgCode(a.cell, a.isWin)).filter((f): f is string => !!f);
	if (fgs.length === 0) return undefined;
	const first = fgs[0];
	return fgs.every((f) => f === first) ? first : undefined;
}

interface BoardRenderOpts {
	board: Cell[][];
	maxWidth: number;
	// Optional cursor overlay. Omit to render a static snapshot (used in tool
	// results, move messages, and the game-over banner).
	// 可选的光标叠加层。省略该项则渲染静态快照（用于工具结果、落子消息以及终局横幅）。
	cursor?: { row: number; col: number; owner: "user" | "agent" };
}

function renderBoard(opts: BoardRenderOpts): string[] {
	const { board, maxWidth, cursor } = opts;
	const showCursor = !!cursor;
	const cr = cursor?.row ?? -1;
	const cc = cursor?.col ?? -1;

	// Green for user cursor, yellow for agent cursor.
	// 用户光标为绿色，智能体光标为黄色。
	const cursorSgr = cursor?.owner === "agent" ? "\x1b[33;1m" : "\x1b[32;1m";

	const winLine = getWinLine(board);
	const winCells = new Set((winLine ?? []).map(([r, c]) => `${r},${c}`));
	const cellAt = (r: number, c: number) => ({ cell: board[r][c], isWin: winCells.has(`${r},${c}`) });

	const isCursorCorner = (gridR: number, gridC: number): boolean =>
		showCursor && (gridR === cr || gridR === cr + 1) && (gridC === cc || gridC === cc + 1);
	const isCursorHSegment = (gridR: number, c: number): boolean =>
		showCursor && c === cc && (gridR === cr || gridR === cr + 1);
	const isCursorVBorder = (r: number, gridC: number): boolean =>
		showCursor && r === cr && (gridC === cc || gridC === cc + 1);

	const paintBorder = (ch: string, highlighted: boolean, fgCode: string | undefined): string => {
		if (highlighted) return `${cursorSgr}${ch}${RESET}`;
		if (fgCode) return `\x1b[${fgCode};1m${ch}${RESET}`;
		return DIM(ch);
	};

	const cornerChar = (gridR: number, gridC: number): string => {
		if (gridR === 0 && gridC === 0) return "\u250c";
		if (gridR === 0 && gridC === 3) return "\u2510";
		if (gridR === 3 && gridC === 0) return "\u2514";
		if (gridR === 3 && gridC === 3) return "\u2518";
		if (gridR === 0) return "\u252c";
		if (gridR === 3) return "\u2534";
		if (gridC === 0) return "\u251c";
		if (gridC === 3) return "\u2524";
		return "\u253c";
	};

	const cornerAdjacent = (gridR: number, gridC: number) => {
		const out: { cell: Cell; isWin: boolean }[] = [];
		for (const [dr, dc] of [
			[-1, -1],
			[-1, 0],
			[0, -1],
			[0, 0],
		]) {
			const r = gridR + dr;
			const c = gridC + dc;
			if (r >= 0 && r < 3 && c >= 0 && c < 3) out.push(cellAt(r, c));
		}
		return out;
	};

	const lines: string[] = [];

	for (let gridR = 0; gridR <= 3; gridR++) {
		// Horizontal border row.
		// 水平边框行。
		let row = "";
		for (let gridC = 0; gridC <= 3; gridC++) {
			const cornerColor = borderFgCode(cornerAdjacent(gridR, gridC));
			row += paintBorder(cornerChar(gridR, gridC), isCursorCorner(gridR, gridC), cornerColor);
			if (gridC < 3) {
				const adj: { cell: Cell; isWin: boolean }[] = [];
				if (gridR > 0) adj.push(cellAt(gridR - 1, gridC));
				if (gridR < 3) adj.push(cellAt(gridR, gridC));
				const segColor = borderFgCode(adj);
				row += paintBorder("\u2500".repeat(CELL_WIDTH), isCursorHSegment(gridR, gridC), segColor);
			}
		}
		lines.push(centerPad(row, maxWidth));

		if (gridR === 3) break;

		for (let lineIdx = 0; lineIdx < CELL_HEIGHT; lineIdx++) {
			let contentRow = "";
			for (let gridC = 0; gridC <= 3; gridC++) {
				const adj: { cell: Cell; isWin: boolean }[] = [];
				if (gridC > 0) adj.push(cellAt(gridR, gridC - 1));
				if (gridC < 3) adj.push(cellAt(gridR, gridC));
				const vColor = borderFgCode(adj);
				contentRow += paintBorder("\u2502", isCursorVBorder(gridR, gridC), vColor);
				if (gridC < 3) {
					contentRow += buildCellContent(board[gridR][gridC], lineIdx, winCells.has(`${gridR},${gridC}`));
				}
			}
			lines.push(centerPad(contentRow, maxWidth));
		}
	}

	return lines;
}

// Full TUI board with the right cursor overlayed for the current turn.
// 完整的 TUI 棋盘，并根据当前回合叠加对应一方的光标。
function renderVisualBoard(state: GameState, maxWidth: number): string[] {
	const isUserTurn = state.currentTurn === state.userMark;
	const cursor =
		state.status !== "playing"
			? undefined
			: {
					row: isUserTurn ? state.userCursorRow : state.agentCursorRow,
					col: isUserTurn ? state.userCursorCol : state.agentCursorCol,
					owner: (isUserTurn ? "user" : "agent") as "user" | "agent",
				};
	return renderBoard({ board: state.board, maxWidth, cursor });
}

/**
 * Static snapshot used inside tool results and custom messages.
 * 用于工具结果和自定义消息内部的静态快照。
 */
function renderBoardSnapshot(board: Cell[][], maxWidth: number): string[] {
	return renderBoard({ board, maxWidth });
}

// ---------------------------------------------------------------------------
// TUI component
// TUI 组件
// ---------------------------------------------------------------------------

class TicTacToeComponent implements Component {
	private state: GameState;
	private onClose: () => void;
	private onUserPlay: (row: number, col: number) => void;
	private tui: { requestRender: () => void };
	private cachedLines: string[] = [];
	private cachedWidth = 0;
	private version = 0;
	private cachedVersion = -1;

	constructor(
		tui: { requestRender: () => void },
		onClose: () => void,
		onUserPlay: (row: number, col: number) => void,
		state: GameState,
	) {
		this.tui = tui;
		this.onClose = onClose;
		this.onUserPlay = onUserPlay;
		this.state = state;
	}

	updateState(state: GameState): void {
		this.state = state;
		this.version++;
		this.tui.requestRender();
	}

	handleInput(data: string): boolean {
		if (matchesKey(data, "escape") || data === "q" || data === "Q") {
			this.onClose();
			return true;
		}
		if (this.state.status !== "playing") {
			if (data === "r" || data === "R") {
				this.onClose();
				return true;
			}
			return true;
		}
		if (this.state.currentTurn !== this.state.userMark) return true;

		if (matchesKey(data, "up") && this.state.userCursorRow > 0) {
			this.state.userCursorRow--;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "down") && this.state.userCursorRow < 2) {
			this.state.userCursorRow++;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "left") && this.state.userCursorCol > 0) {
			this.state.userCursorCol--;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "right") && this.state.userCursorCol < 2) {
			this.state.userCursorCol++;
			this.version++;
			this.tui.requestRender();
		} else if (matchesKey(data, "return") || data === " ") {
			const { userCursorRow, userCursorCol } = this.state;
			if (this.state.board[userCursorRow][userCursorCol] === " ") {
				this.onUserPlay(userCursorRow, userCursorCol);
			}
		}
		return true;
	}

	invalidate(): void {
		this.cachedWidth = 0;
	}

	render(width: number): string[] {
		if (width === this.cachedWidth && this.cachedVersion === this.version) {
			return this.cachedLines;
		}

		const ESC = "\x1b[";
		const reset = `${ESC}0m`;
		const bold = (s: string) => `${ESC}1m${s}${reset}`;
		const dim = (s: string) => `${ESC}2m${s}${reset}`;
		const blue = (s: string) => `${ESC}34m${s}${reset}`;
		const yellow = (s: string) => `${ESC}33m${s}${reset}`;
		const green = (s: string) => `${ESC}32m${s}${reset}`;

		const lines: string[] = [];

		// Top title banner, full width.
		// 顶部标题横幅，占满整行宽度。
		const titleText = " Tic-Tac-Toe ";
		const titleLen = visibleWidth(titleText);
		const borderLen = Math.max(0, width - titleLen);
		const leftBorder = Math.floor(borderLen / 2);
		const rightBorder = borderLen - leftBorder;
		lines.push(dim("\u2500".repeat(leftBorder)) + bold(blue(titleText)) + dim("\u2500".repeat(rightBorder)));

		lines.push("");

		// Status line.
		// 状态行。
		if (this.state.status !== "playing") {
			const statusText =
				this.state.status === "draw"
					? bold(yellow("Draw!"))
					: this.state.status === "win_X"
						? bold(green("X wins!"))
						: bold(yellow("O wins!"));
			lines.push(centerPad(statusText, width));
		} else if (this.state.currentTurn === "X") {
			lines.push(centerPad(`Turn: ${bold(blue("X"))} (You)  ${dim("|")}  ${bold(yellow("O"))} (Agent)`, width));
		} else {
			lines.push(centerPad(`${blue("X")} (You)  ${dim("|")}  Turn: ${bold(yellow("O"))} (Agent)`, width));
		}

		lines.push("");
		lines.push("");

		lines.push(...renderVisualBoard(this.state, width));

		lines.push("");
		lines.push("");

		// Footer.
		// 底部提示栏。
		let footer: string;
		if (this.state.status !== "playing") {
			footer = `${bold("R")} restart  ${dim("|")}  ${bold("Q")}/${bold("ESC")} quit`;
		} else if (this.state.currentTurn !== this.state.userMark) {
			footer = dim("Agent is thinking...");
		} else {
			footer = `${bold("\u2190\u2191\u2193\u2192")} move  ${dim("|")}  ${bold("ENTER")} play  ${dim("|")}  ${bold("ESC")} quit`;
		}
		lines.push(centerPad(footer, width));

		// Bottom separator between the component and the editor below.
		// 底部分隔线，用于分隔本组件与下方的编辑器。
		lines.push("");
		lines.push(dim("\u2500".repeat(width)));

		this.cachedLines = lines;
		this.cachedWidth = width;
		this.cachedVersion = this.version;
		return lines;
	}
}

// ---------------------------------------------------------------------------
// Move-message renderer (full width banner)
// 落子消息渲染器（整行宽度的横幅）
// ---------------------------------------------------------------------------

// Full-width banner message with an optional board snapshot underneath.
// 整行宽度的横幅消息，下方可选地附带一张棋盘快照。
class BannerMessageComponent implements Component {
	private readonly title: string;
	private readonly details: BoardDetails | undefined;
	private readonly expanded: boolean;
	private readonly theme: Theme;

	constructor(title: string, details: BoardDetails | undefined, expanded: boolean, theme: Theme) {
		this.title = title;
		this.details = details;
		this.expanded = expanded;
		this.theme = theme;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const dim = (s: string) => this.theme.fg("dim", s);
		const lines: string[] = [];
		const titleLen = visibleWidth(this.title);
		const fillLen = Math.max(0, width - titleLen - 2);
		const leftFill = Math.floor(fillLen / 2);
		const rightFill = fillLen - leftFill;
		lines.push(`${dim("\u2500".repeat(leftFill))} ${this.title} ${dim("\u2500".repeat(rightFill))}`);

		if (this.expanded && this.details) {
			lines.push("");
			lines.push(...renderBoardSnapshot(this.details.board, width));
		}

		return lines;
	}
}

// End-of-game banner: two dim hrs, a big colored title line, and the final
// board with the winning line highlighted.
// 终局横幅：两条暗淡的分隔线、一行醒目的彩色标题，以及高亮显示获胜连线的最终棋盘。
class GameOverMessageComponent implements Component {
	private readonly status: GameStatus;
	private readonly details: BoardDetails | undefined;
	private readonly theme: Theme;

	constructor(status: GameStatus, details: BoardDetails | undefined, theme: Theme) {
		this.status = status;
		this.details = details;
		this.theme = theme;
	}

	invalidate(): void {}

	render(width: number): string[] {
		const dim = (s: string) => this.theme.fg("dim", s);
		const bold = (s: string) => this.theme.bold(s);

		const hr = dim("\u2500".repeat(width));
		const lines: string[] = [];
		lines.push(hr);
		lines.push("");

		let title: string;
		let sub: string;
		switch (this.status) {
			case "win_X":
				title = bold(this.theme.fg("accent", "\u2605 Player X wins \u2605"));
				sub = "You beat the agent.";
				break;
			case "win_O":
				title = bold(this.theme.fg("warning", "\u2605 Player O wins \u2605"));
				sub = "The agent beat you.";
				break;
			case "draw":
				title = bold(this.theme.fg("muted", "\u2014 Draw \u2014"));
				sub = "No winner.";
				break;
			default:
				title = bold("Game over");
				sub = "";
				break;
		}

		for (const line of [title, dim(sub)]) {
			const pad = Math.max(0, width - visibleWidth(line));
			lines.push(`${" ".repeat(Math.floor(pad / 2))}${line}`);
		}

		lines.push("");
		if (this.details) {
			lines.push(...renderBoardSnapshot(this.details.board, width));
			lines.push("");
		}
		lines.push(hr);

		return lines;
	}
}

// ---------------------------------------------------------------------------
// Delay helper
// 延迟辅助函数
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Extension
// 扩展主体
// ---------------------------------------------------------------------------

const SAVE_TYPE = "tic-tac-toe-save";
const MOVE_MESSAGE_TYPE = "tic-tac-toe-move";
const GAME_OVER_MESSAGE_TYPE = "tic-tac-toe-game-over";

let gameState: GameState = createInitialState();
let component: TicTacToeComponent | null = null;
let gameActive = false;

function reconstructState(ctx: ExtensionContext): void {
	gameState = createInitialState();
	gameActive = false;

	for (const entry of ctx.sessionManager.getBranch()) {
		if (entry.type !== "message") continue;
		const msg = entry.message;
		if (msg.role !== "toolResult") continue;
		if (msg.toolName !== "tic_tac_toe" && msg.toolName !== "tic_tac_toe_see_board") continue;

		const details = msg.details as BoardDetails | undefined;
		if (details) {
			gameState.board = details.board.map((row) => [...row]);
			gameState.agentCursorRow = details.agentCursorRow;
			gameState.agentCursorCol = details.agentCursorCol;
			gameState.status = details.status;
			gameState.currentTurn = details.currentTurn;
		}
	}
}

function getBoardDetails(): BoardDetails {
	return {
		board: gameState.board.map((row) => [...row]),
		agentCursorRow: gameState.agentCursorRow,
		agentCursorCol: gameState.agentCursorCol,
		status: gameState.status,
		currentTurn: gameState.currentTurn,
	};
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => reconstructState(ctx));
	pi.on("session_tree", async (_event, ctx) => reconstructState(ctx));

	// Sent once per game at end-of-game. The custom renderer paints the banner;
	// `content` is a plain-text fallback for any non-TUI consumer and for the
	// LLM (in case the message ends up in future context).
	// 每局游戏结束时发送一次。自定义渲染器负责绘制横幅；`content` 是给非 TUI 消费方
	// 以及 LLM 的纯文本兜底内容（以防该消息进入后续上下文）。
	const emitGameOverMessage = (): void => {
		const label =
			gameState.status === "win_X"
				? "Player X (human) wins"
				: gameState.status === "win_O"
					? "Player O (agent) wins"
					: gameState.status === "draw"
						? "Draw"
						: "Game over";
		pi.sendMessage({
			customType: GAME_OVER_MESSAGE_TYPE,
			content: `Game over: ${label}.`,
			display: true,
			details: getBoardDetails(),
		});
	};

	// -----------------------------------------------------------------------
	// Custom message renderer for user move messages
	// 用户落子消息的自定义消息渲染器
	// -----------------------------------------------------------------------
	pi.registerMessageRenderer(MOVE_MESSAGE_TYPE, (message, { expanded }, theme) => {
		const details = message.details as BoardDetails | undefined;
		const turnLabel =
			details?.currentTurn === "O"
				? `${theme.fg("warning", theme.bold("O"))} (Agent)`
				: `${theme.fg("accent", theme.bold("X"))} (You)`;
		const title = `${theme.fg("accent", theme.bold("Player X played"))}  ${theme.fg("dim", "\u2192")}  next: ${turnLabel}`;
		return new BannerMessageComponent(title, details, expanded, theme);
	});

	// -----------------------------------------------------------------------
	// Custom message renderer for game-over messages
	// 终局消息的自定义消息渲染器
	// -----------------------------------------------------------------------
	pi.registerMessageRenderer(GAME_OVER_MESSAGE_TYPE, (message, _options, theme) => {
		const details = message.details as BoardDetails | undefined;
		const status = (details?.status ?? "draw") as GameStatus;
		return new GameOverMessageComponent(status, details, theme);
	});

	// -----------------------------------------------------------------------
	// before_agent_start - inject game instructions each turn
	// before_agent_start - 每个回合注入游戏规则说明
	// -----------------------------------------------------------------------
	pi.on("before_agent_start", async (event) => {
		if (!gameActive) return undefined;

		const instructions = `

## Tic-Tac-Toe (you are Player O)

A tic-tac-toe game is in progress. The human is Player X. You are Player O.
The human plays through a TUI; you play through the \`tic_tac_toe\` tool.

### Turn protocol

When the human plays, you receive a message that contains the cell X marked,
the full board, and YOUR cursor position (Player O's cursor). The message is
the source of truth for the board.

Player O's cursor persists between O turns. It is reset to (row=${AGENT_CURSOR_HOME_ROW}, col=${AGENT_CURSOR_HOME_COL})
only after a successful \`play\`. If a \`play\` fails (cell already taken), the
cursor stays where it was, so you can move and retry.

You may also call \`tic_tac_toe_see_board\` if you want the current board and
your cursor position restated at any point. The user's cursor is private and
is never shown to you.

### The tool

\`tic_tac_toe\` takes ONE action per call:
- \`move_up\` / \`move_down\` / \`move_left\` / \`move_right\`: move YOUR cursor one cell (clamped at edges)
- \`play\`: place O on the cell under YOUR cursor. Errors if the cell is not empty.

There is no batched form. One call = one action.

### CRITICAL: emit the whole turn in a single response

To play at (r, c) from your cursor (r0, c0) emit, in order:
- \`move_down\` (r - r0) times (or \`move_up\` (r0 - r) times if r < r0)
- \`move_right\` (c - c0) times (or \`move_left\` (c0 - c) times if c < c0)
- one call of \`play\`

All of these tool calls MUST be emitted in the SAME assistant response, as
separate tool_use blocks, before you stop. Do not:
- split the sequence across multiple assistant responses,
- wait for a move result before emitting the next move or \`play\`,
- write any explanation or text between the tool calls,
- call any other tool during your turn (except \`tic_tac_toe_see_board\` when you
  explicitly need the state restated).

Decide the target cell first, then dump every action for the turn in one go.

### Examples (cursor starts at (${AGENT_CURSOR_HOME_ROW}, ${AGENT_CURSOR_HOME_COL}))

- Target (0,0): one call, \`play\`.
- Target (0,2): \`move_right\`, \`move_right\`, \`play\`. Three calls, one response.
- Target (1,1): \`move_down\`, \`move_right\`, \`play\`. Three calls, one response.
- Target (2,2): \`move_down\`, \`move_down\`, \`move_right\`, \`move_right\`, \`play\`. Five calls, one response.

### Strategy

1. If you have two O's in a line with the third cell empty, win by playing there.
2. Otherwise, if X has two in a line with the third cell empty, block there.
3. Otherwise, prefer center, then corners, then edges.
`;

		return {
			systemPrompt: event.systemPrompt + instructions,
		};
	});

	// -----------------------------------------------------------------------
	// /tic-tac-toe command
	// /tic-tac-toe 命令
	// -----------------------------------------------------------------------
	pi.registerCommand("tic-tac-toe", {
		description: "Play tic-tac-toe against the agent",

		handler: async (_args, ctx) => {
			if (ctx.mode !== "tui") {
				ctx.ui.notify("Tic-tac-toe requires interactive mode", "error");
				return;
			}

			reconstructState(ctx);
			if (gameState.status !== "playing") {
				gameState = createInitialState();
			}
			gameActive = true;
			pi.setSessionName("Tic-Tac-Toe");

			await ctx.ui.custom<void>((tui, _theme, _kb, done) => {
				component = new TicTacToeComponent(
					tui,
					() => {
						component = null;
						gameActive = false;
						done(undefined);
					},
					(row, col) => {
						gameState.board[row][col] = gameState.userMark;
						gameState.status = checkWin(gameState.board);
						if (gameState.status === "playing") {
							gameState.currentTurn = gameState.agentMark;
						}
						component?.updateState(gameState);
						pi.appendEntry(SAVE_TYPE, getBoardDetails());

						if (gameState.status === "playing") {
							// IMPORTANT: user play does NOT touch the agent cursor.
							// The agent cursor is only reset after a successful agent play.
							// 重要：用户落子不会改动智能体光标。
							// 智能体光标只有在智能体成功落子之后才会被重置。
							const boardAscii = boardToAscii(
								gameState.board,
								gameState.agentCursorRow,
								gameState.agentCursorCol,
							);
							pi.sendMessage(
								{
									customType: MOVE_MESSAGE_TYPE,
									content:
										`Player X played at (row=${row}, col=${col}). It is now Player O's turn.\n\n` +
										`Board (your cursor marked with <>):\n${boardAscii}\n\n` +
										`Your cursor is at (row=${gameState.agentCursorRow}, col=${gameState.agentCursorCol}). ` +
										`Decide your target cell, then emit every move_* and the final play ` +
										`as separate tic_tac_toe tool calls in THIS response.`,
									display: true,
									details: getBoardDetails(),
								},
								{ triggerTurn: true },
							);
						} else {
							emitGameOverMessage();
							gameActive = false;
						}
					},
					gameState,
				);
				return component;
			});
		},
	});

	// -----------------------------------------------------------------------
	// tic_tac_toe tool - one action per call.
	// tic_tac_toe 工具 —— 每次调用只执行一个动作。
	// -----------------------------------------------------------------------

	type Action = "move_up" | "move_down" | "move_left" | "move_right" | "play";

	const ACTION_DELAYS: Record<Action, number> = {
		move_up: 300,
		move_down: 300,
		move_left: 300,
		move_right: 300,
		play: 0,
	};

	pi.registerTool({
		name: "tic_tac_toe",
		label: "Tic-Tac-Toe",
		description:
			"Execute ONE tic-tac-toe action as Player O. `action` is exactly one of: move_up, move_down, move_left, move_right (move YOUR cursor one cell, clamped at edges), or play (place O under YOUR cursor; errors if the cell is not empty). There is no batched form. To play at (r, c) from your current cursor (r0, c0), emit the required move_down/move_up and move_right/move_left calls, then play, all as separate tool_use blocks in the SAME assistant response. Do not split the sequence across responses and do not wait for a result before emitting the next call. Your cursor position persists between turns and is reset to (0,0) only after a successful play.",
		promptSnippet: "Play a tic-tac-toe action (move_up/down/left/right or play) as Player O",
		promptGuidelines: [
			"When it is your tic-tac-toe turn, decide the target cell first, then emit every move_* plus the final play as separate tic_tac_toe tool calls in a SINGLE assistant response. Never split them across responses or wait for intermediate results.",
			"Never ask the user for the board. The board and your cursor position are included in the user's move message; use tic_tac_toe_see_board if you need them restated.",
		],
		parameters: Type.Object({
			action: StringEnum(["move_up", "move_down", "move_left", "move_right", "play"] as const, {
				description:
					"The single action to perform this call. Emit multiple tic_tac_toe calls in one response to string actions together.",
			}),
		}),
		executionMode: "sequential" as ToolExecutionMode,

		async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
			const actionDelay = ACTION_DELAYS[params.action];
			if (actionDelay > 0) await delay(actionDelay);

			let result: string;

			switch (params.action) {
				case "move_up":
					if (gameState.agentCursorRow > 0) gameState.agentCursorRow--;
					result = `Moved up. Cursor: (${gameState.agentCursorRow}, ${gameState.agentCursorCol})`;
					break;
				case "move_down":
					if (gameState.agentCursorRow < 2) gameState.agentCursorRow++;
					result = `Moved down. Cursor: (${gameState.agentCursorRow}, ${gameState.agentCursorCol})`;
					break;
				case "move_left":
					if (gameState.agentCursorCol > 0) gameState.agentCursorCol--;
					result = `Moved left. Cursor: (${gameState.agentCursorRow}, ${gameState.agentCursorCol})`;
					break;
				case "move_right":
					if (gameState.agentCursorCol < 2) gameState.agentCursorCol++;
					result = `Moved right. Cursor: (${gameState.agentCursorRow}, ${gameState.agentCursorCol})`;
					break;
				case "play": {
					if (gameState.status !== "playing") {
						throw new TicTacToeError(`Game is over (${gameState.status}).`);
					}
					if (gameState.currentTurn !== gameState.agentMark) {
						throw new TicTacToeError("It is not your turn.");
					}
					const r = gameState.agentCursorRow;
					const c = gameState.agentCursorCol;
					if (gameState.board[r][c] !== " ") {
						// Do NOT reset the cursor on failure. The agent can retry
						// from the cursor's current position.
						// 失败时不要重置光标。智能体可以从光标的当前位置直接重试。
						component?.updateState(gameState);
						pi.appendEntry(SAVE_TYPE, getBoardDetails());
						throw new TicTacToeError(
							`Cell (${r},${c}) is already ${gameState.board[r][c]}. Your cursor is still at (${r},${c}). Move to an empty cell and retry play.`,
						);
					}
					gameState.board[r][c] = gameState.agentMark;
					gameState.status = checkWin(gameState.board);
					// Reset agent cursor to home ONLY on successful play.
					// 只有在成功落子时才把智能体光标重置回初始位置。
					gameState.agentCursorRow = AGENT_CURSOR_HOME_ROW;
					gameState.agentCursorCol = AGENT_CURSOR_HOME_COL;
					if (gameState.status === "playing") {
						gameState.currentTurn = gameState.userMark;
						result = `Placed O at (${r},${c}). Cursor reset to (${AGENT_CURSOR_HOME_ROW},${AGENT_CURSOR_HOME_COL}). Your turn, X!`;
					} else if (gameState.status === "win_O") {
						result = `Placed O at (${r},${c}). Player O wins!`;
						gameActive = false;
						emitGameOverMessage();
					} else if (gameState.status === "draw") {
						result = `Placed O at (${r},${c}). It's a draw!`;
						gameActive = false;
						emitGameOverMessage();
					} else {
						result = `Placed O at (${r},${c}).`;
					}
					break;
				}
			}

			component?.updateState(gameState);
			pi.appendEntry(SAVE_TYPE, getBoardDetails());

			return {
				content: [{ type: "text", text: result }],
				details: getBoardDetails(),
			};
		},

		renderCall(args, theme) {
			const action = typeof args.action === "string" ? args.action : "";
			return new Text(theme.fg("toolTitle", theme.bold("tic_tac_toe ")) + theme.fg("muted", action), 0, 0);
		},

		renderResult(result, { expanded }, theme, context) {
			const details = result.details as BoardDetails | undefined;
			const text = result.content[0];
			const msg = text?.type === "text" ? text.text : "";
			const prefix = context?.isError ? theme.fg("error", "\u2717 ") : theme.fg("success", "\u2713 ");
			const summary = prefix + theme.fg("muted", msg);

			if (expanded && details) {
				return new BannerMessageComponent(summary, details, true, theme);
			}
			return new Text(summary, 0, 0);
		},
	});

	// -----------------------------------------------------------------------
	// tic_tac_toe_see_board tool - inspect board + agent cursor.
	// tic_tac_toe_see_board 工具 —— 查看棋盘及智能体光标位置。
	// -----------------------------------------------------------------------
	pi.registerTool({
		name: "tic_tac_toe_see_board",
		label: "See Board",
		description:
			"Return the current tic-tac-toe board state and YOUR cursor position (Player O). Takes no arguments. Use this if you need the current state restated mid-turn (for example after a failed play). The user's cursor is never exposed.",
		promptSnippet: "Inspect the tic-tac-toe board and your cursor",
		parameters: Type.Object({}),

		async execute(_toolCallId, _params, _signal, _onUpdate, _ctx) {
			const boardAscii = boardToAscii(gameState.board, gameState.agentCursorRow, gameState.agentCursorCol);
			const text =
				`Board (your cursor marked with <>):\n${boardAscii}\n\n` +
				`Your cursor: (row=${gameState.agentCursorRow}, col=${gameState.agentCursorCol})\n` +
				`Status: ${gameState.status}\n` +
				`Turn: ${gameState.currentTurn === gameState.agentMark ? "Player O (you)" : "Player X"}`;
			return {
				content: [{ type: "text", text }],
				details: getBoardDetails(),
			};
		},

		renderCall(_args, theme) {
			return new Text(theme.fg("toolTitle", theme.bold("tic_tac_toe_see_board")), 0, 0);
		},

		renderResult(result, { expanded }, theme) {
			const details = result.details as BoardDetails | undefined;
			const summary =
				theme.fg("success", "\u2713 ") +
				theme.fg("muted", `cursor (${details?.agentCursorRow ?? 0},${details?.agentCursorCol ?? 0})`);
			if (expanded && details) {
				return new BannerMessageComponent(summary, details, true, theme);
			}
			return new Text(summary, 0, 0);
		},
	});
}
