/**
 * Type-only compatibility entry point for coding-agent extension OAuth declarations.
 * 供 coding-agent 扩展的 OAuth 声明使用的仅类型（type-only）兼容入口点。
 */
export type {
	OAuthAuthInfo,
	OAuthCredentials,
	OAuthDeviceCodeInfo,
	OAuthLoginCallbacks,
	OAuthPrompt,
	OAuthSelectOption,
	OAuthSelectPrompt,
} from "./compat/extension-oauth-types.ts";
