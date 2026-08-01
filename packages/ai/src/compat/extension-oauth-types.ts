import type { OAuthCredentials } from "../auth/types.ts";

/**
 * Legacy extension OAuth prompt.
 * 遗留（legacy）扩展的 OAuth 输入提示。
 */
export interface OAuthPrompt {
	message: string;
	placeholder?: string;
	allowEmpty?: boolean;
}

/**
 * Legacy extension OAuth authorization link.
 * 遗留（legacy）扩展的 OAuth 授权链接。
 */
export interface OAuthAuthInfo {
	url: string;
	instructions?: string;
}

/**
 * Legacy extension OAuth device-code notification.
 * 遗留（legacy）扩展的 OAuth 设备码（device-code）通知。
 */
export interface OAuthDeviceCodeInfo {
	userCode: string;
	verificationUri: string;
	intervalSeconds?: number;
	expiresInSeconds?: number;
}

export interface OAuthSelectOption {
	id: string;
	label: string;
}

export interface OAuthSelectPrompt {
	message: string;
	options: OAuthSelectOption[];
}

/**
 * Callback surface retained only for coding-agent extension compatibility.
 * 仅为兼容（compat）coding-agent 扩展而保留的回调接口。
 */
export interface OAuthLoginCallbacks {
	onAuth(info: OAuthAuthInfo): void;
	onDeviceCode(info: OAuthDeviceCodeInfo): void;
	onPrompt(prompt: OAuthPrompt): Promise<string>;
	onProgress?(message: string): void;
	onManualCodeInput?(): Promise<string>;
	onSelect(prompt: OAuthSelectPrompt): Promise<string | undefined>;
	signal?: AbortSignal;
}

export type { OAuthCredentials };
