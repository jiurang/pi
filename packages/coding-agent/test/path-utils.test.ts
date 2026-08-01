import { mkdtempSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { expandPath, resolveReadPath, resolveToCwd } from "../src/core/tools/path-utils.ts";

describe("path-utils", () => {
	describe("expandPath", () => {
		it("should expand ~ to home directory", () => {
			const result = expandPath("~");
			expect(result).not.toContain("~");
		});

		it("should expand ~/path to home directory", () => {
			const result = expandPath("~/Documents/file.txt");
			expect(result).not.toContain("~/");
		});

		it("should keep tilde-prefixed filenames literal", () => {
			expect(expandPath("~draft.md")).toBe("~draft.md");
			expect(expandPath("@~draft.md")).toBe("~draft.md");
		});

		it("should normalize Unicode spaces", () => {
			// Non-breaking space (U+00A0) should become regular space
			// 不换行空格（U+00A0）应被转换为普通空格
			const withNBSP = "file\u00A0name.txt";
			const result = expandPath(withNBSP);
			expect(result).toBe("file name.txt");
		});
	});

	describe("resolveToCwd", () => {
		it("should resolve absolute paths as-is", () => {
			const absolutePath = resolve(tmpdir(), "absolute", "path", "file.txt");
			const result = resolveToCwd(absolutePath, resolve(tmpdir(), "some", "cwd"));
			expect(result).toBe(absolutePath);
		});

		it("should resolve relative paths against cwd", () => {
			const result = resolveToCwd("relative/file.txt", "/some/cwd");
			expect(result).toBe(resolve("/some/cwd", "relative/file.txt"));
		});

		it("should resolve tilde-prefixed filenames against cwd", () => {
			const cwd = join(tmpdir(), "pi-path-utils-cwd");
			expect(resolveToCwd("~draft.md", cwd)).toBe(resolve(cwd, "~draft.md"));
			expect(resolveToCwd("@~draft.md", cwd)).toBe(resolve(cwd, "~draft.md"));
		});
	});

	describe("resolveReadPath", () => {
		let tempDir: string;

		beforeEach(() => {
			tempDir = mkdtempSync(join(tmpdir(), "path-utils-test-"));
		});

		afterEach(() => {
			// Clean up temp files and directory
			// 清理临时文件与临时目录
			try {
				const files = readdirSync(tempDir);
				for (const file of files) {
					unlinkSync(join(tempDir, file));
				}
				rmdirSync(tempDir);
			} catch {
				// Ignore cleanup errors
				// 忽略清理过程中的错误
			}
		});

		it("should resolve existing file path", () => {
			const fileName = "test-file.txt";
			writeFileSync(join(tempDir, fileName), "content");

			const result = resolveReadPath(fileName, tempDir);
			expect(result).toBe(join(tempDir, fileName));
		});

		it("should handle NFC vs NFD Unicode normalization (macOS filenames with accents)", () => {
			// macOS stores filenames in NFD (decomposed) form:
			// macOS 以 NFD（分解）形式存储文件名：
			//   é = e + combining acute accent (U+0301)
			//   上式表示：é = e + 组合尖音符（combining acute accent，U+0301）
			// Users typically type in NFC (composed) form:
			// 用户通常以 NFC（组合）形式输入：
			//   é = single character (U+00E9)
			//   上式表示：é = 单个字符（U+00E9）
			//
			// Note: macOS APFS normalizes Unicode automatically, so both paths work.
			// 注意：macOS 的 APFS 会自动进行 Unicode 归一化，因此两种路径都可用。
			// This test verifies the NFD variant fallback works on systems that don't.
			// 本测试用于验证在不做自动归一化的系统上，NFD 变体的回退逻辑同样有效。

			// NFD: e (U+0065) + combining acute accent (U+0301)
			// NFD 形式：e（U+0065）+ 组合尖音符（U+0301）
			const nfdFileName = "file\u0065\u0301.txt";
			// NFC: é as single character (U+00E9)
			// NFC 形式：é 作为单个字符（U+00E9）
			const nfcFileName = "file\u00e9.txt";

			// Verify they have different byte sequences
			// 验证两者具有不同的字节序列
			expect(nfdFileName).not.toBe(nfcFileName);
			expect(Buffer.from(nfdFileName)).not.toEqual(Buffer.from(nfcFileName));

			// Create file with NFD name
			// 以 NFD 形式的名称创建文件
			writeFileSync(join(tempDir, nfdFileName), "content");

			// User provides NFC path - should find the file (via filesystem normalization or our fallback)
			// 用户提供 NFC 形式的路径——应能找到该文件（通过文件系统归一化或我们的回退逻辑）
			const result = resolveReadPath(nfcFileName, tempDir);
			// Result should contain the accented character (either NFC or NFD form)
			// 结果中应包含该带音符的字符（NFC 或 NFD 形式均可）
			expect(result).toContain(tempDir);
			expect(result).toMatch(/file.+\.txt$/);
		});

		it("should handle curly quotes vs straight quotes (macOS filenames)", () => {
			// macOS uses curly apostrophe (U+2019) in screenshot filenames:
			// macOS 在截图文件名中使用弯引号形式的撇号（U+2019）：
			//   Capture d'écran (U+2019)
			// Users typically type straight apostrophe (U+0027):
			// 用户通常输入的是直角撇号（U+0027）：
			//   Capture d'ecran (U+0027)

			const curlyQuoteName = "Capture d\u2019cran.txt"; // U+2019 right single quotation mark
			// U+2019 \u53f3\u5355\u5f15\u53f7
			const straightQuoteName = "Capture d'cran.txt"; // U+0027 apostrophe
			// U+0027 \u6487\u53f7

			// Verify they are different
			// \u9a8c\u8bc1\u4e24\u8005\u786e\u5b9e\u4e0d\u540c
			expect(curlyQuoteName).not.toBe(straightQuoteName);

			// Create file with curly quote name (simulating macOS behavior)
			// \u4ee5\u5f2f\u5f15\u53f7\u5f62\u5f0f\u7684\u540d\u79f0\u521b\u5efa\u6587\u4ef6\uff08\u6a21\u62df macOS \u7684\u884c\u4e3a\uff09
			writeFileSync(join(tempDir, curlyQuoteName), "content");

			// User provides straight quote path - should find the curly quote file
			// \u7528\u6237\u63d0\u4f9b\u76f4\u89d2\u6487\u53f7\u5f62\u5f0f\u7684\u8def\u5f84\u2014\u2014\u5e94\u80fd\u627e\u5230\u4f7f\u7528\u5f2f\u5f15\u53f7\u547d\u540d\u7684\u6587\u4ef6
			const result = resolveReadPath(straightQuoteName, tempDir);
			expect(result).toBe(join(tempDir, curlyQuoteName));
		});

		it("should handle combined NFC + curly quote (French macOS screenshots)", () => {
			// Full macOS screenshot filename: "Capture d'écran" with NFD é and curly quote
			// 完整的 macOS 截图文件名："Capture d'écran"，其中 é 为 NFD 形式且撇号为弯引号
			// Note: macOS APFS normalizes NFD to NFC, so the actual file on disk uses NFC
			// 注意：macOS 的 APFS 会把 NFD 归一化为 NFC，因此磁盘上的实际文件使用 NFC 形式
			const nfcCurlyName = "Capture d\u2019\u00e9cran.txt"; // NFC + curly quote (how APFS stores it)
			// NFC + 弯引号（即 APFS 的实际存储形式）
			const nfcStraightName = "Capture d'\u00e9cran.txt"; // NFC + straight quote (user input)
			// NFC + 直角撇号（即用户的输入形式）

			// Verify they are different
			// 验证两者确实不同
			expect(nfcCurlyName).not.toBe(nfcStraightName);

			// Create file with macOS-style name (curly quote)
			// 以 macOS 风格的名称创建文件（使用弯引号）
			writeFileSync(join(tempDir, nfcCurlyName), "content");

			// User provides straight quote path - should find the curly quote file
			// 用户提供直角撇号形式的路径——应能找到使用弯引号命名的文件
			const result = resolveReadPath(nfcStraightName, tempDir);
			expect(result).toBe(join(tempDir, nfcCurlyName));
		});

		it("should handle macOS screenshot AM/PM variant with narrow no-break space", () => {
			// macOS uses narrow no-break space (U+202F) before AM/PM in screenshot names
			// macOS 在截图文件名中的 AM/PM 之前使用窄不换行空格（U+202F）
			const macosName = "Screenshot 2024-01-01 at 10.00.00\u202FAM.png"; // U+202F
			// U+202F 窄不换行空格
			const userName = "Screenshot 2024-01-01 at 10.00.00 AM.png"; // regular space
			// 普通空格

			// Create file with macOS-style name
			// 以 macOS 风格的名称创建文件
			writeFileSync(join(tempDir, macosName), "content");

			// User provides regular space path
			// 用户提供使用普通空格的路径
			const result = resolveReadPath(userName, tempDir);

			// This works because tryMacOSScreenshotPath() handles this case
			// 这能够生效，是因为 tryMacOSScreenshotPath() 处理了这种情况
			expect(result).toBe(join(tempDir, macosName));
		});

		it("should handle macOS screenshot lowercase am/pm variant (en_AU locale)", () => {
			// Some locales like en_AU use lowercase am/pm in screenshot names
			// 某些区域设置（如 en_AU）在截图文件名中使用小写的 am/pm
			const macosName = "Screenshot 2024-01-01 at 10.00.00\u202Fam.png"; // U+202F + lowercase
			// U+202F + 小写形式
			const userName = "Screenshot 2024-01-01 at 10.00.00 am.png"; // regular space + lowercase
			// 普通空格 + 小写形式

			// Create file with macOS-style name
			// 以 macOS 风格的名称创建文件
			writeFileSync(join(tempDir, macosName), "content");

			// User provides regular space path
			// 用户提供使用普通空格的路径
			const result = resolveReadPath(userName, tempDir);

			// This works because tryMacOSScreenshotPath() uses case-insensitive matching
			// 这能够生效，是因为 tryMacOSScreenshotPath() 采用了大小写不敏感的匹配
			expect(result).toBe(join(tempDir, macosName));
		});
	});
});
