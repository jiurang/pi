import { Worker } from "node:worker_threads";
import { type ImageResizeOptions, type ResizedImage, resizeImageInProcess } from "./image-resize-core.ts";

export type { ImageResizeOptions, ResizedImage } from "./image-resize-core.ts";

interface ResizeImageWorkerResponse {
	result?: ResizedImage | null;
	error?: string;
}

function toTransferableBytes(input: Uint8Array): Uint8Array<ArrayBuffer> {
	// Transfer detaches the buffer, so transfer a worker-owned copy and leave the
	// caller's bytes intact.
	// 转移（transfer）会分离底层缓冲区，因此转移一份由 worker 持有的副本，
	// 从而保持调用方的字节数据完好无损。
	return new Uint8Array(input);
}

function isResizeImageWorkerResponse(value: unknown): value is ResizeImageWorkerResponse {
	return value !== null && typeof value === "object";
}

function createResizeWorker(workerSpecifier: string | URL): Worker {
	return new Worker(workerSpecifier);
}

async function resizeImageInWorker(
	workerSpecifier: string | URL,
	inputBytes: Uint8Array,
	mimeType: string,
	options?: ImageResizeOptions,
): Promise<ResizedImage | null> {
	const worker = createResizeWorker(workerSpecifier);
	try {
		const inputBytesForWorker = toTransferableBytes(inputBytes);
		return await new Promise<ResizedImage | null>((resolve, reject) => {
			let settled = false;
			const settle = (result: ResizedImage | null): void => {
				if (settled) return;
				settled = true;
				resolve(result);
			};
			const fail = (error: Error): void => {
				if (settled) return;
				settled = true;
				reject(error);
			};

			worker.once("message", (message: unknown) => {
				if (!isResizeImageWorkerResponse(message)) {
					fail(new Error("Invalid image resize worker response"));
					return;
				}
				if (message.error) {
					fail(new Error(message.error));
					return;
				}
				settle(message.result ?? null);
			});
			worker.once("error", fail);
			worker.once("exit", (code) => {
				if (!settled) {
					fail(new Error(`Image resize worker exited with code ${code}`));
				}
			});
			worker.postMessage(
				{
					inputBytes: inputBytesForWorker,
					mimeType,
					options,
				},
				[inputBytesForWorker.buffer],
			);
		});
	} finally {
		void worker.terminate().catch(() => undefined);
	}
}

/**
 * Resize an image to fit within the specified max dimensions and encoded file size.
 * 缩放图片，使其符合指定的最大尺寸和编码后文件大小限制。
 * Runs Photon in a worker thread so WASM decoding, resizing, and encoding do not
 * block the TUI event loop.
 * 在 worker 线程中运行 Photon，使 WASM 的解码、缩放和编码不会阻塞 TUI 事件循环。
 * If the worker cannot be loaded (for example in some
 * Bun compiled executable layouts), fall back to in-process resizing so image
 * reads still work.
 * 若 worker 无法加载（例如在某些 Bun 编译可执行文件的布局下），则回退到进程内缩放，
 * 以保证图片读取功能仍然可用。
 */
export async function resizeImage(
	inputBytes: Uint8Array,
	mimeType: string,
	options?: ImageResizeOptions,
): Promise<ResizedImage | null> {
	const isTypeScriptRuntime = import.meta.url.endsWith(".ts");
	const workerUrl = new URL(
		isTypeScriptRuntime ? "./image-resize-worker.ts" : "./image-resize-worker.js",
		import.meta.url,
	);

	// Bun compiled executables resolve worker entrypoints by string path, not via
	// new URL(..., import.meta.url). Try the string path first under Bun so the
	// release binary uses the embedded worker instead of falling back in-process.
	// Bun 编译出的可执行文件是按字符串路径解析 worker 入口的，而非通过
	// new URL(..., import.meta.url)。因此在 Bun 环境下优先尝试字符串路径，
	// 使发布版二进制文件使用内嵌的 worker，而不是回退到进程内执行。
	if (typeof process.versions.bun === "string") {
		try {
			return await resizeImageInWorker("./src/utils/image-resize-worker.ts", inputBytes, mimeType, options);
		} catch {}
	}

	try {
		return await resizeImageInWorker(workerUrl, inputBytes, mimeType, options);
	} catch {
		return resizeImageInProcess(inputBytes, mimeType, options);
	}
}

/**
 * Format a dimension note for resized images.
 * 为已缩放的图片生成尺寸说明文本。
 * This helps the model understand the coordinate mapping.
 * 这有助于模型理解坐标映射关系。
 */
export function formatDimensionNote(result: ResizedImage): string | undefined {
	if (!result.wasResized) {
		return undefined;
	}

	const scale = result.originalWidth / result.width;
	return `[Image: original ${result.originalWidth}x${result.originalHeight}, displayed at ${result.width}x${result.height}. Multiply coordinates by ${scale.toFixed(2)} to map to original image.]`;
}
