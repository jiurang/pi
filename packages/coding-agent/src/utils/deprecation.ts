import chalk from "chalk";

const emittedDeprecationWarnings = new Set<string>();

export function warnDeprecation(message: string): void {
	if (emittedDeprecationWarnings.has(message)) return;
	emittedDeprecationWarnings.add(message);
	console.warn(chalk.yellow(`Deprecation warning: ${message}`));
}

/**
 * Clear deprecation warning state. Exported for tests.
 * 清空废弃（deprecation）警告的状态。仅为测试而导出。
 */
export function clearDeprecationWarningsForTests(): void {
	emittedDeprecationWarnings.clear();
}
