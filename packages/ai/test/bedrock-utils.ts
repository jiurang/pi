/**
 * Utility functions for Amazon Bedrock tests
 * Amazon Bedrock 测试的工具函数
 */

/**
 * Check if any valid AWS credentials are configured for Bedrock.
 * 检查是否为 Bedrock 配置了任何有效的 AWS 凭据。
 * Returns true if any of the following are set:
 * 如果设置了以下任意一项，则返回 true：
 * - AWS_PROFILE (named profile from ~/.aws/credentials)
 * - AWS_PROFILE（来自 ~/.aws/credentials 的命名配置文件）
 * - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY (IAM keys)
 * - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY（IAM 密钥）
 * - AWS_BEARER_TOKEN_BEDROCK (Bedrock API key)
 * - AWS_BEARER_TOKEN_BEDROCK（Bedrock API 密钥）
 */
export function hasBedrockCredentials(): boolean {
	return !!(
		process.env.AWS_PROFILE ||
		(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) ||
		process.env.AWS_BEARER_TOKEN_BEDROCK
	);
}
