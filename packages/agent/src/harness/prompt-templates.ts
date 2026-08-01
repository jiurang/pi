import { parse } from "yaml";
import { type ExecutionEnv, type FileInfo, type PromptTemplate, type Result, toError } from "./types.ts";

export type PromptTemplateDiagnosticCode = "file_info_failed" | "list_failed" | "read_failed" | "parse_failed";

/**
 * Warning produced while loading prompt templates.
 * 加载提示词模板（prompt template）过程中产生的警告。
 */
export interface PromptTemplateDiagnostic {
	/**
	 * Diagnostic severity. Currently only warnings are emitted.
	 * 诊断信息的严重级别。目前仅会产生警告（warning）。
	 */
	type: "warning";
	/**
	 * Stable diagnostic code.
	 * 稳定的诊断码。
	 */
	code: PromptTemplateDiagnosticCode;
	/**
	 * Human-readable diagnostic message.
	 * 可供人阅读的诊断消息。
	 */
	message: string;
	/**
	 * Path associated with the diagnostic.
	 * 与该诊断信息关联的路径。
	 */
	path: string;
}

interface PromptTemplateFrontmatter {
	description?: string;
	"argument-hint"?: string;
	[key: string]: unknown;
}

/**
 * Load prompt templates from one or more paths.
 * 从一个或多个路径加载提示词模板（prompt template）。
 *
 * Directory inputs load direct `.md` children non-recursively. File inputs load explicit `.md` files. Missing paths and
 * non-markdown files are skipped. Read and parse failures are returned as diagnostics.
 * 若输入为目录，则以非递归方式加载其直接子级的 `.md` 文件；若输入为文件，则加载指定的 `.md` 文件。不存在的路径和
 * 非 markdown 文件将被跳过。读取和解析失败会以诊断信息（diagnostics）的形式返回。
 */
export async function loadPromptTemplates(
	env: ExecutionEnv,
	paths: string | string[],
): Promise<{ promptTemplates: PromptTemplate[]; diagnostics: PromptTemplateDiagnostic[] }> {
	const promptTemplates: PromptTemplate[] = [];
	const diagnostics: PromptTemplateDiagnostic[] = [];
	for (const path of Array.isArray(paths) ? paths : [paths]) {
		const infoResult = await env.fileInfo(path);
		if (!infoResult.ok) {
			if (infoResult.error.code !== "not_found") {
				diagnostics.push({
					type: "warning",
					code: "file_info_failed",
					message: infoResult.error.message,
					path,
				});
			}
			continue;
		}
		const info = infoResult.value;
		const kind = await resolveKind(env, info, diagnostics);
		if (kind === "directory") {
			const result = await loadTemplatesFromDir(env, info.path);
			promptTemplates.push(...result.promptTemplates);
			diagnostics.push(...result.diagnostics);
		} else if (kind === "file" && info.name.endsWith(".md")) {
			const result = await loadTemplateFromFile(env, info.path);
			if (result.promptTemplate) promptTemplates.push(result.promptTemplate);
			diagnostics.push(...result.diagnostics);
		}
	}
	return { promptTemplates, diagnostics };
}

/**
 * Load prompt templates from source-tagged paths.
 * 从带有来源（source）标记的路径加载提示词模板。
 *
 * Source values are preserved exactly and attached to every loaded prompt template and diagnostic. The agent package does
 * not interpret source values; applications define their own provenance shape.
 * 来源值会被原样保留，并附加到每个加载出的提示词模板和诊断信息上。agent 包不会解释来源值；由应用自行定义其来源
 * 溯源（provenance）结构。
 */
export async function loadSourcedPromptTemplates<TSource, TPromptTemplate extends PromptTemplate = PromptTemplate>(
	env: ExecutionEnv,
	inputs: Array<{ path: string; source: TSource }>,
	mapPromptTemplate?: (promptTemplate: PromptTemplate, source: TSource) => TPromptTemplate,
): Promise<{
	promptTemplates: Array<{ promptTemplate: TPromptTemplate; source: TSource }>;
	diagnostics: Array<PromptTemplateDiagnostic & { source: TSource }>;
}> {
	const promptTemplates: Array<{ promptTemplate: TPromptTemplate; source: TSource }> = [];
	const diagnostics: Array<PromptTemplateDiagnostic & { source: TSource }> = [];
	for (const input of inputs) {
		const result = await loadPromptTemplates(env, input.path);
		for (const promptTemplate of result.promptTemplates) {
			promptTemplates.push({
				promptTemplate: mapPromptTemplate
					? mapPromptTemplate(promptTemplate, input.source)
					: (promptTemplate as TPromptTemplate),
				source: input.source,
			});
		}
		for (const diagnostic of result.diagnostics) diagnostics.push({ ...diagnostic, source: input.source });
	}
	return { promptTemplates, diagnostics };
}

async function loadTemplatesFromDir(
	env: ExecutionEnv,
	dir: string,
): Promise<{ promptTemplates: PromptTemplate[]; diagnostics: PromptTemplateDiagnostic[] }> {
	const promptTemplates: PromptTemplate[] = [];
	const diagnostics: PromptTemplateDiagnostic[] = [];
	const entriesResult = await env.listDir(dir);
	if (!entriesResult.ok) {
		diagnostics.push({
			type: "warning",
			code: "list_failed",
			message: entriesResult.error.message,
			path: dir,
		});
		return { promptTemplates, diagnostics };
	}
	const entries = entriesResult.value;

	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const kind = await resolveKind(env, entry, diagnostics);
		if (kind !== "file" || !entry.name.endsWith(".md")) continue;
		const result = await loadTemplateFromFile(env, entry.path);
		if (result.promptTemplate) promptTemplates.push(result.promptTemplate);
		diagnostics.push(...result.diagnostics);
	}
	return { promptTemplates, diagnostics };
}

async function loadTemplateFromFile(
	env: ExecutionEnv,
	filePath: string,
): Promise<{ promptTemplate: PromptTemplate | null; diagnostics: PromptTemplateDiagnostic[] }> {
	const diagnostics: PromptTemplateDiagnostic[] = [];
	const rawContent = await env.readTextFile(filePath);
	if (!rawContent.ok) {
		diagnostics.push({
			type: "warning",
			code: "read_failed",
			message: rawContent.error.message,
			path: filePath,
		});
		return { promptTemplate: null, diagnostics };
	}

	const parsed = parseFrontmatter<PromptTemplateFrontmatter>(rawContent.value);
	if (!parsed.ok) {
		diagnostics.push({
			type: "warning",
			code: "parse_failed",
			message: parsed.error.message,
			path: filePath,
		});
		return { promptTemplate: null, diagnostics };
	}

	const { frontmatter, body } = parsed.value;
	const firstLine = body.split("\n").find((line) => line.trim());
	let description = typeof frontmatter.description === "string" ? frontmatter.description : "";
	if (!description && firstLine) {
		description = firstLine.slice(0, 60);
		if (firstLine.length > 60) description += "...";
	}
	return {
		promptTemplate: {
			name: basenameEnvPath(filePath).replace(/\.md$/i, ""),
			description,
			content: body,
		},
		diagnostics,
	};
}

async function resolveKind(
	env: ExecutionEnv,
	info: FileInfo,
	diagnostics: PromptTemplateDiagnostic[],
): Promise<"file" | "directory" | undefined> {
	if (info.kind === "file" || info.kind === "directory") return info.kind;
	const canonicalPath = await env.canonicalPath(info.path);
	if (!canonicalPath.ok) {
		if (canonicalPath.error.code !== "not_found") {
			diagnostics.push({
				type: "warning",
				code: "file_info_failed",
				message: canonicalPath.error.message,
				path: info.path,
			});
		}
		return undefined;
	}
	const target = await env.fileInfo(canonicalPath.value);
	if (!target.ok) {
		if (target.error.code !== "not_found") {
			diagnostics.push({
				type: "warning",
				code: "file_info_failed",
				message: target.error.message,
				path: info.path,
			});
		}
		return undefined;
	}
	return target.value.kind === "file" || target.value.kind === "directory" ? target.value.kind : undefined;
}

function parseFrontmatter<T extends Record<string, unknown>>(
	content: string,
): Result<{ frontmatter: T; body: string }, Error> {
	try {
		const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
		if (!normalized.startsWith("---")) return { ok: true, value: { frontmatter: {} as T, body: normalized } };
		const endIndex = normalized.indexOf("\n---", 3);
		if (endIndex === -1) return { ok: true, value: { frontmatter: {} as T, body: normalized } };
		const yamlString = normalized.slice(4, endIndex);
		const body = normalized.slice(endIndex + 4).trim();
		return { ok: true, value: { frontmatter: (parse(yamlString) ?? {}) as T, body } };
	} catch (error) {
		return { ok: false, error: toError(error) };
	}
}

function basenameEnvPath(path: string): string {
	const normalized = path.replace(/\/+$/, "");
	const slashIndex = normalized.lastIndexOf("/");
	return slashIndex === -1 ? normalized : normalized.slice(slashIndex + 1);
}

/**
 * Parse an argument string using simple shell-style single and double quotes.
 * 按照简单的 shell 风格单引号和双引号规则解析参数字符串。
 */
export function parseCommandArgs(argsString: string): string[] {
	const args: string[] = [];
	let current = "";
	let inQuote: string | null = null;

	for (let i = 0; i < argsString.length; i++) {
		const char = argsString[i]!;
		if (inQuote) {
			if (char === inQuote) inQuote = null;
			else current += char;
		} else if (char === '"' || char === "'") {
			inQuote = char;
		} else if (char === " " || char === "\t") {
			if (current) {
				args.push(current);
				current = "";
			}
		} else {
			current += char;
		}
	}
	if (current) args.push(current);
	return args;
}

/**
 * Substitute prompt template placeholders (`$1`, `$@`, `$ARGUMENTS`, `${@:N}`, `${@:N:L}`) with command arguments.
 * 使用命令参数替换提示词模板中的占位符（`$1`、`$@`、`$ARGUMENTS`、`${@:N}`、`${@:N:L}`）。
 */
export function substituteArgs(content: string, args: string[]): string {
	let result = content;
	result = result.replace(/\$(\d+)/g, (_, num: string) => args[parseInt(num, 10) - 1] ?? "");
	result = result.replace(/\$\{@:(\d+)(?::(\d+))?\}/g, (_, startStr: string, lengthStr?: string) => {
		let start = parseInt(startStr, 10) - 1;
		if (start < 0) start = 0;
		if (lengthStr) return args.slice(start, start + parseInt(lengthStr, 10)).join(" ");
		return args.slice(start).join(" ");
	});
	const allArgs = args.join(" ");
	result = result.replace(/\$ARGUMENTS/g, allArgs);
	result = result.replace(/\$@/g, allArgs);
	return result;
}

/**
 * Format a prompt template invocation with positional arguments.
 * 使用位置参数格式化一次提示词模板调用。
 */
export function formatPromptTemplateInvocation(template: PromptTemplate, args: string[] = []): string {
	return substituteArgs(template.content, args);
}
