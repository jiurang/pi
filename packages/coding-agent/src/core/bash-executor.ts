/**
 * Bash command execution with streaming support and cancellation.
 * 支持流式输出与取消的 bash 命令执行。
 *
 * This module provides a unified bash execution implementation used by:
 * 本模块提供统一的 bash 执行实现，被以下场景使用：
 * - AgentSession.executeBash() for interactive and RPC modes
 *   AgentSession.executeBash()，用于交互模式与 RPC 模式
 * - Direct calls from modes that need bash execution
 *   来自需要执行 bash 的各模式的直接调用
 */

import { randomBytes } from "node:crypto";
import { createWriteStream, type WriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripAnsi } from "../utils/ansi.ts";
import { sanitizeBinaryOutput } from "../utils/shell.ts";
import type { BashOperations } from "./tools/bash.ts";
import { DEFAULT_MAX_BYTES, truncateTail } from "./tools/truncate.ts";

// ============================================================================
// Types
// 类型定义
// ============================================================================

export interface BashExecutorOptions {
	/** Callback for streaming output chunks (already sanitized) 用于流式输出数据块的回调（内容已经过净化处理） */
	onChunk?: (chunk: string) => void;
	/** AbortSignal for cancellation 用于取消操作的 AbortSignal */
	signal?: AbortSignal;
}

export interface BashResult {
	/** Combined stdout + stderr output (sanitized, possibly truncated) 合并后的 stdout + stderr 输出（已净化，可能被截断） */
	output: string;
	/** Process exit code (undefined if killed/cancelled) 进程退出码（若被杀死/取消则为 undefined） */
	exitCode: number | undefined;
	/** Whether the command was cancelled via signal 命令是否通过信号（signal）被取消 */
	cancelled: boolean;
	/** Whether the output was truncated 输出是否被截断 */
	truncated: boolean;
	/** Path to temp file containing full output (if output exceeded truncation threshold) 保存完整输出的临时文件路径（当输出超过截断阈值时） */
	fullOutputPath?: string;
}

// ============================================================================
// Implementation
// 具体实现
// ============================================================================

/**
 * Execute a bash command using custom BashOperations.
 * 使用自定义的 BashOperations 执行 bash 命令。
 * Used for remote execution (SSH, containers, etc.).
 * 用于远程执行场景（SSH、容器等）。
 */
export async function executeBashWithOperations(
	command: string,
	cwd: string,
	operations: BashOperations,
	options?: BashExecutorOptions,
): Promise<BashResult> {
	const outputChunks: string[] = [];
	let outputBytes = 0;
	const maxOutputBytes = DEFAULT_MAX_BYTES * 2;

	let tempFilePath: string | undefined;
	let tempFileStream: WriteStream | undefined;
	let totalBytes = 0;

	const ensureTempFile = () => {
		if (tempFilePath) {
			return;
		}
		const id = randomBytes(8).toString("hex");
		tempFilePath = join(tmpdir(), `pi-bash-${id}.log`);
		tempFileStream = createWriteStream(tempFilePath);
		for (const chunk of outputChunks) {
			tempFileStream.write(chunk);
		}
	};

	const decoder = new TextDecoder();

	const onData = (data: Buffer) => {
		totalBytes += data.length;

		// Sanitize: strip ANSI, replace binary garbage, normalize newlines
		// 净化处理：剥离 ANSI 转义码、替换二进制乱码、规范化换行符
		const text = sanitizeBinaryOutput(stripAnsi(decoder.decode(data, { stream: true }))).replace(/\r/g, "");

		// Start writing to temp file if exceeds threshold
		// 若超过阈值则开始写入临时文件
		if (totalBytes > DEFAULT_MAX_BYTES) {
			ensureTempFile();
		}

		if (tempFileStream) {
			tempFileStream.write(text);
		}

		// Keep rolling buffer
		// 维护一个滚动缓冲区
		outputChunks.push(text);
		outputBytes += text.length;
		while (outputBytes > maxOutputBytes && outputChunks.length > 1) {
			const removed = outputChunks.shift()!;
			outputBytes -= removed.length;
		}

		// Stream to callback
		// 以流式方式推送给回调函数
		if (options?.onChunk) {
			options.onChunk(text);
		}
	};

	try {
		const result = await operations.exec(command, cwd, {
			onData,
			signal: options?.signal,
		});

		const fullOutput = outputChunks.join("");
		const truncationResult = truncateTail(fullOutput);
		if (truncationResult.truncated) {
			ensureTempFile();
		}
		if (tempFileStream) {
			tempFileStream.end();
		}
		const cancelled = options?.signal?.aborted ?? false;

		return {
			output: truncationResult.truncated ? truncationResult.content : fullOutput,
			exitCode: cancelled ? undefined : (result.exitCode ?? undefined),
			cancelled,
			truncated: truncationResult.truncated,
			fullOutputPath: tempFilePath,
		};
	} catch (err) {
		// Check if it was an abort
		// 检查是否为中止（abort）导致
		if (options?.signal?.aborted) {
			const fullOutput = outputChunks.join("");
			const truncationResult = truncateTail(fullOutput);
			if (truncationResult.truncated) {
				ensureTempFile();
			}
			if (tempFileStream) {
				tempFileStream.end();
			}
			return {
				output: truncationResult.truncated ? truncationResult.content : fullOutput,
				exitCode: undefined,
				cancelled: true,
				truncated: truncationResult.truncated,
				fullOutputPath: tempFilePath,
			};
		}

		if (tempFileStream) {
			tempFileStream.end();
		}

		throw err;
	}
}
