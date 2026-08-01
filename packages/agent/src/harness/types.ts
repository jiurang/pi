import type {
	ImageContent,
	Model,
	Models,
	RetryPolicy,
	SimpleStreamOptions,
	TextContent,
	Transport,
	Usage,
} from "@earendil-works/pi-ai";
import type { Static, TSchema } from "typebox";
import type {
	AgentEvent,
	AgentMessage,
	AgentTool,
	AgentToolResult,
	AgentToolUpdateCallback,
	QueueMode,
	ThinkingLevel,
} from "../index.ts";
import type { Session } from "./session/session.ts";

/** Result of a fallible operation. Expected failures are returned as `ok: false` instead of thrown. */
/** 可能失败的操作的结果。预期内的失败以 `ok: false` 返回，而不是抛出异常。 */
export type Result<TValue, TError> = { ok: true; value: TValue } | { ok: false; error: TError };

/** Create a successful {@link Result}. */
/** 创建一个成功的 {@link Result}。 */
export function ok<TValue, TError>(value: TValue): Result<TValue, TError> {
	return { ok: true, value };
}

/** Create a failed {@link Result}. */
/** 创建一个失败的 {@link Result}。 */
export function err<TValue, TError>(error: TError): Result<TValue, TError> {
	return { ok: false, error };
}

/** Return the success value or throw the failure error. Intended for tests and explicit adapter boundaries. */
/** 返回成功值，或抛出失败错误。适用于测试以及明确的适配器边界。 */
export function getOrThrow<TValue, TError>(result: Result<TValue, TError>): TValue {
	if (!result.ok) throw result.error;
	return result.value;
}

/** Return the success value or `undefined`. Only object values are allowed to avoid truthiness bugs with primitives. */
/** 返回成功值或 `undefined`。仅允许对象类型的值，以避免原始类型带来的真值判断缺陷。 */
export function getOrUndefined<TValue extends object, TError>(result: Result<TValue, TError>): TValue | undefined {
	return result.ok ? result.value : undefined;
}

/** Normalize unknown thrown values into Error instances before using them as typed error causes. */
/** 在将抛出的未知值用作带类型的错误起因（cause）之前，将其归一化为 Error 实例。 */
export function toError(error: unknown): Error {
	if (error instanceof Error) return error;
	if (typeof error === "string") return new Error(error);
	try {
		return new Error(JSON.stringify(error));
	} catch {
		return new Error(String(error));
	}
}

/**
 * Skill loaded from a `SKILL.md` file or provided by an application.
 * 从 `SKILL.md` 文件加载或由应用提供的技能（skill）。
 *
 * `name`, `description`, and `filePath` are inserted into the system prompt in an XML-formatted block as suggested by agentskills.io.
 * `name`、`description` 和 `filePath` 会按 agentskills.io 的建议，以 XML 格式的区块插入系统提示词（system prompt）中。
 * Use {@link formatSkillsForSystemPrompt} to generate the spec-compatible system prompt block.
 * 使用 {@link formatSkillsForSystemPrompt} 生成符合规范的系统提示词区块。
 */
export interface Skill {
	/** Stable skill name used for lookup and model-visible listings. */
	/** 稳定的技能（skill）名称，用于查找以及在模型可见的列表中展示。 */
	name: string;
	/** Short model-visible description of when to use the skill. */
	/** 模型可见的简短描述，说明何时应使用该技能（skill）。 */
	description: string;
	/** Full skill instructions. */
	/** 完整的技能（skill）指令内容。 */
	content: string;
	/** Absolute path to the skill file. Used for model-visible location and resolving relative references. */
	/** 技能（skill）文件的绝对路径。用于向模型展示位置以及解析相对引用。 */
	filePath: string;
	/** Exclude this skill from model-visible skill lists while still allowing explicit application invocation. */
	/** 将该技能（skill）从模型可见的技能列表中排除，但仍允许应用显式调用。 */
	disableModelInvocation?: boolean;
}

/** Prompt template that can be formatted into a prompt for explicit invocation. */
/** 可格式化为提示词（prompt）以供显式调用的提示词模板。 */
export interface PromptTemplate {
	/** Stable template name used for lookup or application command routing. */
	/** 稳定的模板名称，用于查找或应用的命令路由。 */
	name: string;
	/** Optional description for command lists or autocomplete. */
	/** 可选描述，用于命令列表或自动补全。 */
	description?: string;
	/** Template content. Argument placeholders are formatted by `formatPromptTemplateInvocation`. */
	/** 模板内容。参数占位符由 `formatPromptTemplateInvocation` 负责格式化。 */
	content: string;
}

/** Resources made available to explicit invocation methods and system-prompt callbacks. */
/** 提供给显式调用方法与系统提示词（system prompt）回调使用的资源。 */
export interface AgentHarnessResources<
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
> {
	/** Prompt templates available for explicit invocation. */
	/** 可用于显式调用的提示词（prompt）模板。 */
	promptTemplates?: TPromptTemplate[];
	/** Skills available to the model and explicit skill invocation. */
	/** 可供模型使用以及显式调用的技能（skill）。 */
	skills?: TSkill[];
}

/** Tool definition executed by an {@link AgentHarness} with an application-defined context. */
/** 由 {@link AgentHarness} 在应用自定义上下文中执行的工具（tool）定义。 */
export type AgentHarnessTool<
	TContext extends object | undefined,
	TParameters extends TSchema = TSchema,
	TDetails = unknown,
> = Omit<AgentTool<TParameters, TDetails>, "execute"> & {
	/** Execute the tool call with the context resolved for the current turn snapshot. */
	/** 使用为当前轮次（turn）快照解析出的上下文执行该工具调用（tool call）。 */
	execute(
		toolCallId: string,
		params: Static<TParameters>,
		signal: AbortSignal | undefined,
		onUpdate: AgentToolUpdateCallback<TDetails> | undefined,
		context: TContext,
	): Promise<AgentToolResult<TDetails>>;
};

/** Static tool context or zero-argument provider resolved for each turn snapshot. */
/** 静态的工具（tool）上下文，或为每个轮次（turn）快照解析的无参提供者函数。 */
export type AgentHarnessToolContextSource<TContext extends object | undefined> =
	| TContext
	| (() => TContext | Promise<TContext>);

/** Curated provider request options owned by the harness and snapshotted per turn. */
/** 由框架（harness）持有、并按轮次（turn）快照的精选提供方（provider）请求选项。 */
export interface AgentHarnessStreamOptions {
	/** Preferred transport forwarded to the stream function. */
	/** 转发给流式函数的首选传输方式（transport）。 */
	transport?: Transport;
	/** Provider request timeout in milliseconds. */
	/** 提供方（provider）请求超时时间，单位毫秒。 */
	timeoutMs?: number;
	/** Maximum provider retry attempts. */
	/** 提供方（provider）请求的最大重试次数。 */
	maxRetries?: number;
	/** Optional cap for provider-requested retry delays. */
	/** 对提供方（provider）请求的重试延迟的可选上限。 */
	maxRetryDelayMs?: number;
	/** Additional request headers merged with auth and lifecycle headers. */
	/** 附加的请求头，会与鉴权及生命周期请求头合并。 */
	headers?: Record<string, string>;
	/** Provider metadata forwarded with requests. */
	/** 随请求一并转发的提供方（provider）元数据。 */
	metadata?: SimpleStreamOptions["metadata"];
	/** Provider cache retention hint. */
	/** 提供方（provider）缓存保留策略提示。 */
	cacheRetention?: SimpleStreamOptions["cacheRetention"];
}

/** Per-request stream option patch returned by provider hooks. */
/** 由提供方（provider）钩子返回的、针对单次请求的流式选项补丁。 */
export interface AgentHarnessStreamOptionsPatch
	extends Omit<Partial<AgentHarnessStreamOptions>, "headers" | "metadata"> {
	/** Header patch. `undefined` values delete keys; explicit `headers: undefined` clears all headers. */
	/** 请求头补丁。值为 `undefined` 表示删除对应键；显式传入 `headers: undefined` 则清空全部请求头。 */
	headers?: Record<string, string | undefined>;
	/** Metadata patch. `undefined` values delete keys; explicit `metadata: undefined` clears all metadata. */
	/** 元数据补丁。值为 `undefined` 表示删除对应键；显式传入 `metadata: undefined` 则清空全部元数据。 */
	metadata?: Record<string, unknown | undefined>;
}

/** Kind of filesystem object as addressed by a {@link FileSystem}. Symlinks are not followed automatically. */
/** {@link FileSystem} 所寻址的文件系统对象类型。不会自动跟随符号链接（symlink）。 */
export type FileKind = "file" | "directory" | "symlink";

/** Stable, backend-independent file error codes returned by {@link FileSystem} file operations. */
/** 由 {@link FileSystem} 文件操作返回的、稳定且与后端无关的文件错误码。 */
export type FileErrorCode =
	| "aborted"
	| "not_found"
	| "permission_denied"
	| "not_directory"
	| "is_directory"
	| "invalid"
	| "not_supported"
	| "unknown";

/** Error returned by {@link FileSystem} file operations. */
/** 由 {@link FileSystem} 文件操作返回的错误。 */
export class FileError extends Error {
	/** Backend-independent error code. */
	/** 与后端无关的错误码。 */
	public code: FileErrorCode;
	/** Absolute addressed path associated with the failure, when available. */
	/** 与该失败相关的绝对寻址路径（如果可用）。 */
	public path?: string;

	constructor(code: FileErrorCode, message: string, path?: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "FileError";
		this.code = code;
		this.path = path;
	}
}

/** Stable, backend-independent execution error codes returned by {@link ExecutionEnv.exec}. */
/** 由 {@link ExecutionEnv.exec} 返回的、稳定且与后端无关的执行错误码。 */
export type ExecutionErrorCode =
	| "aborted"
	| "timeout"
	| "shell_unavailable"
	| "spawn_error"
	| "callback_error"
	| "unknown";

/** Error returned by {@link ExecutionEnv.exec}. */
/** 由 {@link ExecutionEnv.exec} 返回的错误。 */
export class ExecutionError extends Error {
	/** Backend-independent error code. */
	/** 与后端无关的错误码。 */
	public code: ExecutionErrorCode;

	constructor(code: ExecutionErrorCode, message: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "ExecutionError";
		this.code = code;
	}
}

/** Stable compaction error codes returned by compaction helpers. */
/** 由压缩（compaction）辅助函数返回的稳定压缩错误码。 */
export type CompactionErrorCode = "aborted" | "summarization_failed" | "invalid_session" | "unknown";

/** Error returned by compaction helpers. */
/** 由压缩（compaction）辅助函数返回的错误。 */
export class CompactionError extends Error {
	/** Backend-independent error code. */
	/** 与后端无关的错误码。 */
	public code: CompactionErrorCode;

	constructor(code: CompactionErrorCode, message: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "CompactionError";
		this.code = code;
	}
}

/** Stable branch-summary error codes returned by branch summarization helpers. */
/** 由分支摘要（branch summary）辅助函数返回的稳定分支摘要错误码。 */
export type BranchSummaryErrorCode = "aborted" | "summarization_failed" | "invalid_session";

/** Error returned by branch summarization helpers. */
/** 由分支摘要（branch summary）辅助函数返回的错误。 */
export class BranchSummaryError extends Error {
	/** Backend-independent error code. */
	/** 与后端无关的错误码。 */
	public code: BranchSummaryErrorCode;

	constructor(code: BranchSummaryErrorCode, message: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "BranchSummaryError";
		this.code = code;
	}
}

export type SessionErrorCode =
	| "not_found"
	| "invalid_session"
	| "invalid_entry"
	| "invalid_fork_target"
	| "storage"
	| "unknown";

/** Error thrown by session storage, repositories, and session tree operations. */
/** 由会话（session）存储、仓储以及会话树操作抛出的错误。 */
export class SessionError extends Error {
	/** Session subsystem error code. */
	/** 会话（session）子系统的错误码。 */
	public code: SessionErrorCode;

	constructor(code: SessionErrorCode, message: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "SessionError";
		this.code = code;
	}
}

export type AgentHarnessErrorCode =
	| "busy"
	| "invalid_state"
	| "invalid_argument"
	| "session"
	| "hook"
	| "auth"
	| "compaction"
	| "branch_summary"
	| "unknown";

/** Public AgentHarness failure with a stable top-level classification. */
/** 对外暴露的 AgentHarness 失败错误，带有稳定的顶层分类。 */
export class AgentHarnessError extends Error {
	public code: AgentHarnessErrorCode;

	constructor(code: AgentHarnessErrorCode, message: string, cause?: Error) {
		super(message, cause === undefined ? undefined : { cause });
		this.name = "AgentHarnessError";
		this.code = code;
	}
}

/** Metadata for one filesystem object in a {@link FileSystem}. */
/** {@link FileSystem} 中单个文件系统对象的元数据。 */
export interface FileInfo {
	/** Basename of {@link path}. */
	/** {@link path} 的基础名（basename）。 */
	name: string;
	/** Absolute, syntactically normalized addressed path in the execution environment. Symlinks are not followed. */
	/** 执行环境中经语法归一化的绝对寻址路径。不跟随符号链接（symlink）。 */
	path: string;
	/** Object kind. Symlink targets are not followed; use {@link FileSystem.canonicalPath} explicitly. */
	/** 对象类型。不会跟随符号链接（symlink）目标；如有需要请显式使用 {@link FileSystem.canonicalPath}。 */
	kind: FileKind;
	/** Size in bytes for the addressed filesystem object. */
	/** 所寻址文件系统对象的大小，单位字节。 */
	size: number;
	/** Modification time as milliseconds since Unix epoch. */
	/** 修改时间，以自 Unix 纪元起的毫秒数表示。 */
	mtimeMs: number;
}

/**
 * Filesystem capability used by the harness.
 * 框架（harness）所使用的文件系统能力。
 *
 * Paths passed to methods may be absolute or relative to {@link cwd}. Paths returned by file operations are addressed paths
 * in the filesystem namespace, but are not canonicalized through symlinks unless returned by {@link canonicalPath}.
 * 传入各方法的路径可以是绝对路径，也可以是相对于 {@link cwd} 的相对路径。文件操作返回的路径是文件系统命名空间中的
 * 寻址路径，但除非由 {@link canonicalPath} 返回，否则不会对符号链接（symlink）做规范化解析。
 *
 * Operation methods must never throw or reject. All filesystem failures, including unexpected backend failures, must be
 * encoded in the returned {@link Result}. Implementations must preserve this invariant.
 * 各操作方法绝不能抛出异常或 reject。所有文件系统失败（包括后端的意外故障）都必须编码在返回的 {@link Result} 中。
 * 实现必须始终维持这一不变式。
 */
export interface FileSystem {
	/** Current working directory for relative paths. */
	/** 解析相对路径时使用的当前工作目录。 */
	cwd: string;

	/** Return an absolute addressed path without requiring it to exist and without resolving symlinks. */
	/** 返回绝对寻址路径，不要求该路径存在，也不解析符号链接（symlink）。 */
	absolutePath(path: string, abortSignal?: AbortSignal): Promise<Result<string, FileError>>;
	/** Join path segments in the filesystem namespace without requiring the result to exist. */
	/** 在文件系统命名空间中拼接路径片段，不要求拼接结果存在。 */
	joinPath(parts: string[], abortSignal?: AbortSignal): Promise<Result<string, FileError>>;
	/** Read a UTF-8 text file. */
	/** 读取一个 UTF-8 文本文件。 */
	readTextFile(path: string, abortSignal?: AbortSignal): Promise<Result<string, FileError>>;
	/** Read UTF-8 text lines. Implementations should stop once `maxLines` lines have been read. */
	/** 按行读取 UTF-8 文本。实现应在读取到 `maxLines` 行后停止。 */
	readTextLines(
		path: string,
		options?: { maxLines?: number; abortSignal?: AbortSignal },
	): Promise<Result<string[], FileError>>;
	/** Read a binary file. */
	/** 读取一个二进制文件。 */
	readBinaryFile(path: string, abortSignal?: AbortSignal): Promise<Result<Uint8Array, FileError>>;
	/** Create or overwrite a file, creating parent directories when supported. */
	/** 创建或覆盖文件；在受支持时会同时创建父级目录。 */
	writeFile(path: string, content: string | Uint8Array, abortSignal?: AbortSignal): Promise<Result<void, FileError>>;
	/** Create or append to a file, creating parent directories when supported. */
	/** 创建文件或向文件追加内容；在受支持时会同时创建父级目录。 */
	appendFile(path: string, content: string | Uint8Array, abortSignal?: AbortSignal): Promise<Result<void, FileError>>;
	/** Return metadata for the addressed path without following symlinks. */
	/** 返回所寻址路径的元数据，不跟随符号链接（symlink）。 */
	fileInfo(path: string, abortSignal?: AbortSignal): Promise<Result<FileInfo, FileError>>;
	/** List direct children of a directory without following symlinks. */
	/** 列出目录的直接子项，不跟随符号链接（symlink）。 */
	listDir(path: string, abortSignal?: AbortSignal): Promise<Result<FileInfo[], FileError>>;
	/** Return the canonical path for an existing path, resolving symlinks where supported. */
	/** 返回已存在路径的规范路径；在受支持时会解析符号链接（symlink）。 */
	canonicalPath(path: string, abortSignal?: AbortSignal): Promise<Result<string, FileError>>;
	/** Return false for missing paths. Other errors, such as permission failures, return a {@link FileError}. */
	/** 路径不存在时返回 false。其他错误（如权限失败）则返回 {@link FileError}。 */
	exists(path: string, abortSignal?: AbortSignal): Promise<Result<boolean, FileError>>;
	/** Create a directory. Defaults: `recursive: true`, no abort signal. */
	/** 创建目录。默认值：`recursive: true`，且不带中止信号（abort signal）。 */
	createDir(
		path: string,
		options?: { recursive?: boolean; abortSignal?: AbortSignal },
	): Promise<Result<void, FileError>>;
	/** Remove a file or directory. Defaults: `recursive: false`, `force: false`, no abort signal. */
	/** 删除文件或目录。默认值：`recursive: false`、`force: false`，且不带中止信号（abort signal）。 */
	remove(
		path: string,
		options?: { recursive?: boolean; force?: boolean; abortSignal?: AbortSignal },
	): Promise<Result<void, FileError>>;
	/** Create a temporary directory and return its absolute path. Defaults: `prefix: "tmp-"`, no abort signal. */
	/** 创建临时目录并返回其绝对路径。默认值：`prefix: "tmp-"`，且不带中止信号（abort signal）。 */
	createTempDir(prefix?: string, abortSignal?: AbortSignal): Promise<Result<string, FileError>>;
	/** Create a temporary file and return its absolute path. Defaults: `prefix: ""`, `suffix: ""`, no abort signal. */
	/** 创建临时文件并返回其绝对路径。默认值：`prefix: ""`、`suffix: ""`，且不带中止信号（abort signal）。 */
	createTempFile(options?: {
		prefix?: string;
		suffix?: string;
		abortSignal?: AbortSignal;
	}): Promise<Result<string, FileError>>;

	/** Release filesystem resources. Must be best-effort and must not throw or reject. */
	/** 释放文件系统资源。必须尽力而为，且不得抛出异常或 reject。 */
	cleanup(): Promise<void>;
}

/** Options for {@link Shell.exec}. */
/** {@link Shell.exec} 的选项。 */
export interface ShellExecOptions {
	/** Working directory for the command. Relative paths are resolved against {@link ExecutionEnv.cwd}. Defaults to {@link ExecutionEnv.cwd}. */
	/** 命令的工作目录。相对路径将基于 {@link ExecutionEnv.cwd} 解析。默认为 {@link ExecutionEnv.cwd}。 */
	cwd?: string;
	/** Environment variables for the command. Values override inherited defaults when `inheritEnv` is true. */
	/** 命令的环境变量。当 `inheritEnv` 为 true 时，这些值会覆盖继承而来的默认值。 */
	env?: Record<string, string>;
	/** Whether to inherit the execution environment's default variables. Defaults to true. */
	/** 是否继承执行环境的默认变量。默认为 true。 */
	inheritEnv?: boolean;
	/** Timeout in seconds. Implementations should return a timeout error when the command exceeds this duration. Defaults to no timeout. */
	/** 超时时间，单位秒。当命令执行超过该时长时，实现应返回超时错误。默认不设超时。 */
	timeout?: number;
	/** Abort signal used to terminate the command. Defaults to no abort signal. */
	/** 用于终止命令的中止信号（abort signal）。默认不带中止信号。 */
	abortSignal?: AbortSignal;
	/** Called with stdout chunks as they are produced. */
	/** 在 stdout 数据块产生时被调用。 */
	onStdout?: (chunk: string) => void;
	/** Called with stderr chunks as they are produced. */
	/** 在 stderr 数据块产生时被调用。 */
	onStderr?: (chunk: string) => void;
}

/** Shell execution capability used by the harness. */
/** 框架（harness）所使用的 shell 执行能力。 */
export interface Shell {
	/** Execute a shell command in {@link FileSystem.cwd} unless `options.cwd` is provided. */
	/** 在 {@link FileSystem.cwd} 中执行 shell 命令，除非提供了 `options.cwd`。 */
	exec(
		command: string,
		options?: ShellExecOptions,
	): Promise<Result<{ stdout: string; stderr: string; exitCode: number }, ExecutionError>>;
	/** Release shell resources. Must be best-effort and must not throw or reject. */
	/** 释放 shell 资源。必须尽力而为，且不得抛出异常或 reject。 */
	cleanup(): Promise<void>;
}

/** Filesystem and process execution environment used by the harness. */
/** 框架（harness）所使用的文件系统与进程执行环境。 */
export interface ExecutionEnv extends FileSystem, Shell {}

export interface SessionTreeEntryBase {
	type: string;
	id: string;
	parentId: string | null;
	timestamp: string;
}

export interface MessageEntry extends SessionTreeEntryBase {
	type: "message";
	message: AgentMessage;
}

export interface ThinkingLevelChangeEntry extends SessionTreeEntryBase {
	type: "thinking_level_change";
	thinkingLevel: string;
}

export interface ModelChangeEntry extends SessionTreeEntryBase {
	type: "model_change";
	provider: string;
	modelId: string;
}

export interface ActiveToolsChangeEntry extends SessionTreeEntryBase {
	type: "active_tools_change";
	activeToolNames: string[];
}

export interface CompactionEntry<T = unknown> extends SessionTreeEntryBase {
	type: "compaction";
	summary: string;
	firstKeptEntryId?: string;
	tokensBefore: number;
	retainedTail?: AgentMessage[];
	details?: T;
	usage?: Usage;
	fromHook?: boolean;
}

export interface BranchSummaryEntry<T = unknown> extends SessionTreeEntryBase {
	type: "branch_summary";
	fromId: string;
	summary: string;
	details?: T;
	usage?: Usage;
	fromHook?: boolean;
}

export interface CustomEntry<T = unknown> extends SessionTreeEntryBase {
	type: "custom";
	customType: string;
	data?: T;
}

export interface CustomMessageEntry<T = unknown> extends SessionTreeEntryBase {
	type: "custom_message";
	customType: string;
	content: string | (TextContent | ImageContent)[];
	details?: T;
	display: boolean;
}

export interface LabelEntry extends SessionTreeEntryBase {
	type: "label";
	targetId: string;
	label: string | undefined;
}

export interface SessionInfoEntry extends SessionTreeEntryBase {
	type: "session_info"; // legacy name, kept for backwards compatibility / 遗留名称，为向后兼容而保留
	name?: string;
}

export interface LeafEntry extends SessionTreeEntryBase {
	type: "leaf";
	targetId: string | null;
}

export type SessionTreeEntry =
	| MessageEntry
	| ThinkingLevelChangeEntry
	| ModelChangeEntry
	| ActiveToolsChangeEntry
	| CompactionEntry
	| BranchSummaryEntry
	| CustomEntry
	| CustomMessageEntry
	| LabelEntry
	| SessionInfoEntry
	| LeafEntry;

export interface SessionContext {
	messages: AgentMessage[];
	thinkingLevel: string;
	model: { provider: string; modelId: string } | null;
	activeToolNames: string[] | null;
}

export interface SessionStats {
	messageCount: number;
	cachedTokens: number;
	uncachedTokens: number;
	totalTokens: number;
	costTotal: number;
}

export interface SessionMetadata {
	id: string;
	createdAt: string;
}

export interface JsonlSessionMetadata extends SessionMetadata {
	cwd: string;
	path: string;
	parentSessionPath?: string;
	metadata?: Record<string, unknown>;
}

export interface SessionEntryCursorOptions {
	afterEntrySeq?: number;
	limit?: number;
}

export interface SessionSnapshot<TMetadata extends SessionMetadata = SessionMetadata> {
	metadata: TMetadata;
	leafId: string | null;
	entries: SessionTreeEntry[];
}

export interface SessionStorage<TMetadata extends SessionMetadata = SessionMetadata> {
	getMetadata(): Promise<TMetadata>;
	getLeafId(): Promise<string | null>;
	/** Persist a leaf entry that records the active session-tree leaf. */
	/** 持久化一条 leaf 条目，用于记录当前活跃的会话树（session tree）叶子节点。 */
	setLeafId(leafId: string | null): Promise<LeafEntry>;
	createEntryId(): Promise<string>;
	appendEntry(entry: SessionTreeEntry): Promise<void>;
	getEntry(id: string): Promise<SessionTreeEntry | undefined>;
	findEntries<TType extends SessionTreeEntry["type"]>(
		type: TType,
	): Promise<Array<Extract<SessionTreeEntry, { type: TType }>>>;
	getLabel(id: string): Promise<string | undefined>;
	getSessionName(): Promise<string | undefined>;
	getSessionStats(): Promise<SessionStats>;
	getPathToRootOrCompaction(leafId: string | null): Promise<SessionTreeEntry[]>;
	getEntries(options?: SessionEntryCursorOptions): Promise<SessionTreeEntry[]>;
}

export type { Session } from "./session/session.ts";

export interface SessionCreateOptions {
	id?: string;
}

export interface SessionSearchOptions {
	text: string;
	cwd?: string;
}

export interface SessionSearchHit<TMetadata extends SessionMetadata = SessionMetadata> {
	metadata: TMetadata;
	entryId: string;
	timestamp: string;
	snippet?: string;
	score?: number;
}

/** Maintains a derived search index. This is intentionally separate from query-only SessionSearch. */
/** 维护派生的搜索索引。此接口有意与仅负责查询的 SessionSearch 分离。 */
export interface SessionSearchIndex<TMetadata extends SessionMetadata = SessionMetadata> {
	upsertEntry(metadata: TMetadata, entry: SessionTreeEntry): Promise<void>;
	replaceSession(metadata: TMetadata, entries: readonly SessionTreeEntry[]): Promise<void>;
	deleteSession(metadata: TMetadata): Promise<void>;
}

/** Owns session search queries. Index maintenance is composed at the store/adapter boundary. */
/** 负责会话（session）搜索查询。索引维护则在存储/适配器边界处组合实现。 */
export interface SessionSearch<TMetadata extends SessionMetadata = SessionMetadata> {
	search(options: SessionSearchOptions): Promise<SessionSearchHit<TMetadata>[]>;
}

export interface SessionForkOptions {
	entryId?: string;
	position?: "before" | "at";
	id?: string;
}

export interface SessionStore<
	TMetadata extends SessionMetadata = SessionMetadata,
	TCreateOptions extends SessionCreateOptions = SessionCreateOptions,
	TListOptions = void,
> {
	create(options: TCreateOptions): Promise<TMetadata>;
	load(metadata: TMetadata): Promise<SessionSnapshot<TMetadata>>;
	list(options?: TListOptions): Promise<TMetadata[]>;
	getEntries(metadata: TMetadata, options?: SessionEntryCursorOptions): Promise<SessionTreeEntry[]>;
	createEntryId(metadata: TMetadata): Promise<string>;
	appendEntry(metadata: TMetadata, entry: SessionTreeEntry): Promise<void>;
	setLeafId(metadata: TMetadata, leafId: string | null): Promise<LeafEntry>;
	delete(metadata: TMetadata): Promise<void>;
	fork(source: TMetadata, options: SessionForkOptions & TCreateOptions): Promise<TMetadata>;
}

export interface JsonlSessionCreateOptions extends SessionCreateOptions {
	cwd: string;
	parentSessionPath?: string;
	metadata?: Record<string, unknown>;
}

export interface JsonlSessionListOptions {
	cwd?: string;
}

export type AgentHarnessPhase = "idle" | "turn" | "compaction" | "branch_summary" | "retry";

export type PendingSessionWrite = SessionTreeEntry extends infer TEntry
	? TEntry extends SessionTreeEntry
		? Omit<TEntry, "id" | "parentId" | "timestamp">
		: never
	: never;

export interface QueueUpdateEvent {
	type: "queue_update";
	steer: AgentMessage[];
	followUp: AgentMessage[];
	nextTurn: AgentMessage[];
}

export interface SavePointEvent {
	type: "save_point";
	hadPendingMutations: boolean;
}

export interface AbortEvent {
	type: "abort";
	clearedSteer: AgentMessage[];
	clearedFollowUp: AgentMessage[];
}

export interface SettledEvent {
	type: "settled";
	nextTurnCount: number;
}

export interface BeforeAgentStartEvent<
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
> {
	type: "before_agent_start";
	prompt: string;
	images?: ImageContent[];
	systemPrompt: string;
	resources: AgentHarnessResources<TSkill, TPromptTemplate>;
}

export interface ContextEvent {
	type: "context";
	messages: AgentMessage[];
}

export interface BeforeProviderRequestEvent {
	type: "before_provider_request";
	model: Model<any>;
	sessionId: string;
	streamOptions: AgentHarnessStreamOptions;
}

export interface BeforeProviderPayloadEvent {
	type: "before_provider_payload";
	model: Model<any>;
	payload: unknown;
}

export interface AfterProviderResponseEvent {
	type: "after_provider_response";
	status: number;
	headers: Record<string, string>;
}

export interface ToolCallEvent {
	type: "tool_call";
	toolCallId: string;
	toolName: string;
	input: Record<string, unknown>;
}

export interface ToolResultEvent {
	type: "tool_result";
	toolCallId: string;
	toolName: string;
	input: Record<string, unknown>;
	content: Array<TextContent | ImageContent>;
	details: unknown;
	isError: boolean;
	usage?: Usage;
}

export interface SessionBeforeCompactEvent {
	type: "session_before_compact";
	preparation: CompactionPreparation;
	branchEntries: SessionTreeEntry[];
	customInstructions?: string;
	signal: AbortSignal;
}

export interface SessionCompactEvent {
	type: "session_compact";
	compactionEntry: CompactionEntry;
	fromHook: boolean;
}

export interface SessionBeforeTreeEvent {
	type: "session_before_tree";
	preparation: TreePreparation;
	signal: AbortSignal;
}

export interface SessionTreeEvent {
	type: "session_tree";
	newLeafId: string | null;
	oldLeafId: string | null;
	summaryEntry?: BranchSummaryEntry;
	fromHook?: boolean;
}

export interface RetryScheduledEvent {
	type: "retry_scheduled";
	operation: "compaction" | "branch_summary";
	attempt: number;
	maxAttempts: number;
	delayMs: number;
	errorMessage: string;
}

export interface RetryAttemptStartEvent {
	type: "retry_attempt_start";
	operation: "compaction" | "branch_summary";
}

export interface RetryFinishedEvent {
	type: "retry_finished";
	operation: "compaction" | "branch_summary";
}

export interface ModelUpdateEvent {
	type: "model_update";
	model: Model<any>;
	previousModel: Model<any> | undefined;
	source: "set" | "restore";
}

export interface ThinkingLevelUpdateEvent {
	type: "thinking_level_update";
	level: ThinkingLevel;
	previousLevel: ThinkingLevel;
}

export interface ToolsUpdateEvent {
	type: "tools_update";
	toolNames: string[];
	previousToolNames: string[];
	activeToolNames: string[];
	previousActiveToolNames: string[];
	source: "set" | "restore";
}

export interface ResourcesUpdateEvent<
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
> {
	type: "resources_update";
	resources: AgentHarnessResources<TSkill, TPromptTemplate>;
	previousResources: AgentHarnessResources<TSkill, TPromptTemplate>;
}

export type AgentHarnessOwnEvent<
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
> =
	| QueueUpdateEvent
	| SavePointEvent
	| AbortEvent
	| SettledEvent
	| BeforeAgentStartEvent<TSkill, TPromptTemplate>
	| ContextEvent
	| BeforeProviderRequestEvent
	| BeforeProviderPayloadEvent
	| AfterProviderResponseEvent
	| ToolCallEvent
	| ToolResultEvent
	| SessionBeforeCompactEvent
	| SessionCompactEvent
	| SessionBeforeTreeEvent
	| SessionTreeEvent
	| RetryScheduledEvent
	| RetryAttemptStartEvent
	| RetryFinishedEvent
	| ModelUpdateEvent
	| ThinkingLevelUpdateEvent
	| ResourcesUpdateEvent<TSkill, TPromptTemplate>
	| ToolsUpdateEvent;

export type AgentHarnessEvent<TSkill extends Skill = Skill, TPromptTemplate extends PromptTemplate = PromptTemplate> =
	| AgentEvent
	| AgentHarnessOwnEvent<TSkill, TPromptTemplate>;

export interface BeforeAgentStartResult {
	messages?: AgentMessage[];
	systemPrompt?: string;
}

export interface ContextResult {
	messages: AgentMessage[];
}

export interface BeforeProviderRequestResult {
	streamOptions?: AgentHarnessStreamOptionsPatch;
}

export interface BeforeProviderPayloadResult {
	payload: unknown;
}

export interface ToolCallResult {
	block?: boolean;
	reason?: string;
}

export interface ToolResultPatch {
	content?: Array<TextContent | ImageContent>;
	details?: unknown;
	isError?: boolean;
	usage?: Usage;
	terminate?: boolean;
}

export interface SessionBeforeCompactResult {
	cancel?: boolean;
	compaction?: CompactResult;
}

export interface SessionBeforeTreeResult {
	cancel?: boolean;
	summary?: {
		summary: string;
		details?: unknown;
		/** Usage from the LLM call that generated this summary, if available. */
		/** 生成该摘要的那次 LLM 调用的用量（usage）信息，若可用的话。 */
		usage?: Usage;
	};
	customInstructions?: string;
	replaceInstructions?: boolean;
	label?: string;
}

export type AgentHarnessEventResultMap = {
	before_agent_start: BeforeAgentStartResult | undefined;
	context: ContextResult | undefined;
	before_provider_request: BeforeProviderRequestResult | undefined;
	before_provider_payload: BeforeProviderPayloadResult | undefined;
	after_provider_response: undefined;
	tool_call: ToolCallResult | undefined;
	tool_result: ToolResultPatch | undefined;
	session_before_compact: SessionBeforeCompactResult | undefined;
	session_compact: undefined;
	session_before_tree: SessionBeforeTreeResult | undefined;
	session_tree: undefined;
	retry_scheduled: undefined;
	retry_attempt_start: undefined;
	retry_finished: undefined;
	model_update: undefined;
	thinking_level_update: undefined;
	resources_update: undefined;
	tools_update: undefined;
	queue_update: undefined;
	save_point: undefined;
	abort: undefined;
	settled: undefined;
};

export interface AgentHarnessPromptOptions {
	images?: ImageContent[];
}

export interface AbortResult {
	clearedSteer: AgentMessage[];
	clearedFollowUp: AgentMessage[];
}

export interface CompactResult {
	summary: string;
	firstKeptEntryId?: string;
	tokensBefore: number;
	/** Usage from the LLM call(s) that generated this summary, if available. */
	/** 生成该摘要的一次或多次 LLM 调用的用量（usage）信息，若可用的话。 */
	usage?: Usage;
	retainedTail?: AgentMessage[];
	details?: unknown;
}

export interface NavigateTreeResult {
	cancelled: boolean;
	editorText?: string;
	summaryEntry?: BranchSummaryEntry;
}

export interface CompactionSettings {
	enabled: boolean;
	reserveTokens: number;
	keepRecentTokens: number;
}

export interface CompactionPreparation {
	firstKeptEntryId: string;
	messagesToSummarize: AgentMessage[];
	turnPrefixMessages: AgentMessage[];
	retainedTail: AgentMessage[];
	isSplitTurn: boolean;
	tokensBefore: number;
	previousSummary?: string;
	fileOps: FileOperations;
	settings: CompactionSettings;
}

export interface FileOperations {
	read: Set<string>;
	written: Set<string>;
	edited: Set<string>;
}

export interface TreePreparation {
	targetId: string;
	oldLeafId: string | null;
	commonAncestorId: string | null;
	entriesToSummarize: SessionTreeEntry[];
	userWantsSummary: boolean;
	customInstructions?: string;
	replaceInstructions?: boolean;
	label?: string;
}

export interface GenerateBranchSummaryOptions {
	model: Model<any>;
	apiKey: string;
	headers?: Record<string, string>;
	signal: AbortSignal;
	customInstructions?: string;
	replaceInstructions?: boolean;
	reserveTokens?: number;
}

export interface BranchSummaryResult {
	summary: string;
	usage?: Usage;
	readFiles: string[];
	modifiedFiles: string[];
}

export type AgentHarnessSystemPrompt<
	TContext extends object | undefined = undefined,
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
	TTool extends AgentHarnessTool<TContext> = AgentHarnessTool<TContext>,
> =
	| string
	| ((context: {
			session: Session;
			model: Model<any>;
			thinkingLevel: ThinkingLevel;
			activeTools: TTool[];
			resources: AgentHarnessResources<TSkill, TPromptTemplate>;
	  }) => string | Promise<string>);

interface AgentHarnessOptionsBase<
	TContext extends object | undefined,
	TSkill extends Skill,
	TPromptTemplate extends PromptTemplate,
	TTool extends AgentHarnessTool<TContext>,
> {
	session: Session;
	/**
	 * Provider collection used for all model requests (turn streaming,
	 * compaction, branch summarization). Auth resolves through the providers'
	 * auth.
	 * 用于所有模型请求（轮次（turn）流式输出、压缩（compaction）、分支摘要（branch summary））的
	 * 提供方（provider）集合。鉴权通过各提供方自身的鉴权机制解析。
	 */
	models: Models;
	tools?: TTool[];
	/**
	 * Concrete resources available to explicit invocation methods and system-prompt callbacks.
	 * 可供显式调用方法与系统提示词（system prompt）回调使用的具体资源。
	 * Applications own loading/reloading resources and should call `setResources()` with new values.
	 * 资源的加载/重新加载由应用负责，应用应调用 `setResources()` 传入新的资源值。
	 */
	resources?: AgentHarnessResources<TSkill, TPromptTemplate>;
	systemPrompt?: AgentHarnessSystemPrompt<TContext, TSkill, TPromptTemplate, TTool>;
	/** Curated stream/provider request options. Snapshotted at turn start. */
	/** 精选的流式/提供方（provider）请求选项。在轮次（turn）开始时生成快照。 */
	streamOptions?: AgentHarnessStreamOptions;
	/** Optional retry policy for generated compaction and branch-summary requests. */
	/** 针对生成压缩（compaction）与分支摘要（branch summary）请求的可选重试策略。 */
	retry?: RetryPolicy;
	model: Model<any>;
	thinkingLevel?: ThinkingLevel;
	activeToolNames?: string[];
	steeringMode?: QueueMode;
	followUpMode?: QueueMode;
}

export type AgentHarnessOptions<
	TContext extends object | undefined = undefined,
	TSkill extends Skill = Skill,
	TPromptTemplate extends PromptTemplate = PromptTemplate,
	TTool extends AgentHarnessTool<TContext> = AgentHarnessTool<TContext>,
> = AgentHarnessOptionsBase<TContext, TSkill, TPromptTemplate, TTool> &
	([TContext] extends [undefined]
		? {
				/** Context-free harnesses do not need a tool context. */
				/** 无上下文的框架（harness）不需要工具（tool）上下文。 */
				toolContext?: undefined;
			}
		: {
				/** Static context or zero-argument context provider resolved for each turn snapshot. */
				/** 静态上下文，或为每个轮次（turn）快照解析的无参上下文提供者函数。 */
				toolContext: AgentHarnessToolContextSource<TContext>;
			});

export type { AgentHarness } from "./agent-harness.ts";
