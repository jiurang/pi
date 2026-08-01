/**
 * Test for BMP to PNG conversion in clipboard image handling.
 * 针对剪贴板图片处理中 BMP 到 PNG 转换的测试。
 * Separate from clipboard-image.test.ts due to different mocking requirements.
 * 因 mock 需求不同，故从 clipboard-image.test.ts 中拆分出来。
 *
 * This tests the fix for WSL2/WSLg where clipboard often provides image/bmp
 * instead of image/png.
 * 本测试验证针对 WSL2/WSLg 的修复：在这些环境下，剪贴板常常提供 image/bmp 而非 image/png。
 */
import { describe, expect, test, vi } from "vitest";

function createTinyBmp1x1Red24bpp(): Uint8Array {
	// Minimal 1x1 24bpp BMP (BGR + row padding to 4 bytes)
	// 最小化的 1x1 24bpp BMP 图（BGR 排列 + 行填充至 4 字节）
	// File size = 14 (BMP header) + 40 (DIB header) + 4 (pixel row) = 58
	// 文件大小 = 14（BMP 文件头） + 40（DIB 信息头） + 4（像素行） = 58
	const buffer = Buffer.alloc(58);

	// BITMAPFILEHEADER
	// BITMAPFILEHEADER（位图文件头）
	buffer.write("BM", 0, "ascii");
	buffer.writeUInt32LE(buffer.length, 2); // file size 文件大小
	buffer.writeUInt16LE(0, 6); // reserved1 保留字段 1
	buffer.writeUInt16LE(0, 8); // reserved2 保留字段 2
	buffer.writeUInt32LE(54, 10); // pixel data offset 像素数据偏移量

	// BITMAPINFOHEADER
	// BITMAPINFOHEADER（位图信息头）
	buffer.writeUInt32LE(40, 14); // DIB header size DIB 信息头大小
	buffer.writeInt32LE(1, 18); // width 宽度
	buffer.writeInt32LE(1, 22); // height (positive = bottom-up) 高度（正值 = 自下而上存储）
	buffer.writeUInt16LE(1, 26); // planes 颜色平面数
	buffer.writeUInt16LE(24, 28); // bits per pixel 每像素位数
	buffer.writeUInt32LE(0, 30); // compression (BI_RGB) 压缩方式（BI_RGB，即不压缩）
	buffer.writeUInt32LE(4, 34); // image size (incl. padding) 图像数据大小（含填充字节）
	buffer.writeInt32LE(0, 38); // x pixels per meter 水平分辨率（每米像素数）
	buffer.writeInt32LE(0, 42); // y pixels per meter 垂直分辨率（每米像素数）
	buffer.writeUInt32LE(0, 46); // colors used 使用的颜色数
	buffer.writeUInt32LE(0, 50); // important colors 重要颜色数

	// Pixel data (B, G, R) + 1 byte padding
	// 像素数据（B、G、R） + 1 字节填充
	buffer[54] = 0x00; // B 蓝色分量
	buffer[55] = 0x00; // G 绿色分量
	buffer[56] = 0xff; // R 红色分量
	buffer[57] = 0x00; // padding 填充字节

	return new Uint8Array(buffer);
}

// Mock wl-paste to return BMP
// mock wl-paste 使其返回 BMP 格式
vi.mock("child_process", async () => {
	const actual = await vi.importActual<typeof import("child_process")>("child_process");
	return {
		...actual,
		spawnSync: vi.fn((command: string, args: string[]) => {
			if (command === "wl-paste" && args.includes("--list-types")) {
				return { status: 0, stdout: Buffer.from("image/bmp\n"), error: null };
			}
			if (command === "wl-paste" && args.includes("image/bmp")) {
				return { status: 0, stdout: Buffer.from(createTinyBmp1x1Red24bpp()), error: null };
			}
			return { status: 1, stdout: Buffer.alloc(0), error: null };
		}),
	};
});

// Mock the native clipboard (not used in Wayland path, but needs to be mocked)
// mock 原生剪贴板（Wayland 路径下并不会用到，但仍需进行 mock）
vi.mock("@mariozechner/clipboard", () => ({
	default: {
		hasImage: vi.fn(() => false),
		getImageBinary: vi.fn(() => Promise.resolve(null)),
	},
}));

describe("readClipboardImage BMP conversion", () => {
	test("converts BMP to PNG on Wayland/WSLg", async () => {
		const { readClipboardImage } = await import("../src/utils/clipboard-image.ts");

		// Simulate Wayland session (WSLg)
		// 模拟 Wayland 会话（WSLg）
		const image = await readClipboardImage({
			env: { WAYLAND_DISPLAY: "wayland-0" },
			platform: "linux",
		});

		expect(image).not.toBeNull();
		expect(image!.mimeType).toBe("image/png");

		// Verify PNG magic bytes
		// 校验 PNG 的魔数字节（magic bytes）
		expect(image!.bytes[0]).toBe(0x89);
		expect(image!.bytes[1]).toBe(0x50); // P 字符 P
		expect(image!.bytes[2]).toBe(0x4e); // N 字符 N
		expect(image!.bytes[3]).toBe(0x47); // G 字符 G
	});
});
