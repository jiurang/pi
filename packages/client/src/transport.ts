export interface ByteTransport {
	/**
	 * Sends one byte chunk. Calls must be delivered in invocation order.
	 * 发送一个字节块。调用必须按发起顺序送达。
	 */
	send(chunk: Uint8Array): Promise<void>;
	/**
	 * Closes the transport. Implementations must make repeated calls harmless.
	 * 关闭传输层。实现必须保证重复调用是无害的。
	 */
	close(): void;
}

export interface ByteTransportHandlers {
	/**
	 * Delivers an arbitrary inbound byte chunk.
	 * 传递任意一个入站字节块。
	 */
	onData(chunk: Uint8Array): void;
	/**
	 * Reports an orderly terminal close.
	 * 报告一次正常的终止性关闭。
	 */
	onClose(): void;
	/**
	 * Reports a terminal transport failure.
	 * 报告一次终止性的传输层失败。
	 */
	onError(error: Error): void;
}

/**
 * Creates a fresh connected transport for each PiClient connection attempt. Exactly one terminal handler is expected.
 * 为每次 PiClient 连接尝试创建一个全新的已连接传输层。预期只会调用一次终止类处理器。
 */
export type ByteTransportFactory = (handlers: ByteTransportHandlers) => ByteTransport | Promise<ByteTransport>;
