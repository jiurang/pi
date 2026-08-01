/**
 * Removes unpaired Unicode surrogate characters from a string.
 * 从字符串中移除未配对的 Unicode 代理项（surrogate）字符。
 *
 * Unpaired surrogates (high surrogates 0xD800-0xDBFF without matching low surrogates 0xDC00-0xDFFF,
 * or vice versa) cause JSON serialization errors in many API providers.
 * 未配对的代理项（高位代理项 0xD800-0xDBFF 没有匹配的低位代理项 0xDC00-0xDFFF，或反之）
 * 会导致许多 API 提供商出现 JSON 序列化错误。
 *
 * Valid emoji and other characters outside the Basic Multilingual Plane use properly paired
 * surrogates and will NOT be affected by this function.
 * 有效的 emoji 以及其他位于基本多文种平面（BMP）之外的字符使用正确配对的代理项，
 * 不会受到本函数的影响。
 *
 * @param text - The text to sanitize
 *               需要清理的文本
 * @returns The sanitized text with unpaired surrogates removed
 *          移除未配对代理项后的清理结果文本
 *
 * @example
 * // Valid emoji (properly paired surrogates) are preserved
 * // 有效的 emoji（正确配对的代理项）会被保留
 * sanitizeSurrogates("Hello 🙈 World") // => "Hello 🙈 World"
 *
 * // Unpaired high surrogate is removed
 * // 未配对的高位代理项会被移除
 * const unpaired = String.fromCharCode(0xD83D); // high surrogate without low
 * sanitizeSurrogates(`Text ${unpaired} here`) // => "Text  here"
 */
export function sanitizeSurrogates(text: string): string {
	// Replace unpaired high surrogates (0xD800-0xDBFF not followed by low surrogate)
	// 替换未配对的高位代理项（0xD800-0xDBFF 后面没有跟随低位代理项）
	// Replace unpaired low surrogates (0xDC00-0xDFFF not preceded by high surrogate)
	// 替换未配对的低位代理项（0xDC00-0xDFFF 前面没有高位代理项）
	return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "");
}
