/**
 * PKCE utilities using Web Crypto API.
 * 基于 Web Crypto API 实现的 PKCE 工具函数。
 * Works in both Node.js 20+ and browsers.
 * 可同时在 Node.js 20+ 与浏览器环境中运行。
 */

/**
 * Encode bytes as base64url string.
 * 将字节数组编码为 base64url 字符串。
 */
function base64urlEncode(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Generate PKCE code verifier and challenge.
 * 生成 PKCE 的 code verifier（校验码）与 challenge（挑战值）。
 * Uses Web Crypto API for cross-platform compatibility.
 * 使用 Web Crypto API 以获得跨平台兼容性。
 */
export async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
	// Generate random verifier
	// 生成随机的 verifier
	const verifierBytes = new Uint8Array(32);
	crypto.getRandomValues(verifierBytes);
	const verifier = base64urlEncode(verifierBytes);

	// Compute SHA-256 challenge
	// 计算 SHA-256 challenge
	const encoder = new TextEncoder();
	const data = encoder.encode(verifier);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const challenge = base64urlEncode(new Uint8Array(hashBuffer));

	return { verifier, challenge };
}
