/**
 * Strip `//` line comments and trailing commas from JSON, leaving string literals untouched.
 * 移除 JSON 中的 `//` 行注释与尾随逗号，同时保持字符串字面量不受影响。
 */
export function stripJsonComments(input: string): string {
	return input
		.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*/g, (m) => (m[0] === '"' ? m : ""))
		.replace(/"(?:\\.|[^"\\])*"|,(\s*[}\]])/g, (m, tail) => tail ?? (m[0] === '"' ? m : ""));
}
