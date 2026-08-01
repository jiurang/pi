# @earendil-works/pi-protocol

Runtime-neutral schemas, types, CBOR encoding, and byte-stream framing for the experimental pi protocol.
面向实验性 pi 协议的运行时无关（runtime-neutral）模式定义、类型、CBOR 编码与字节流分帧（framing）。

Protocol version `2` uses binary messages with this wire layout:
协议版本 `2` 使用二进制消息，其传输层（wire）布局如下：

1. A four-byte unsigned big-endian payload length.
   四字节无符号大端序（big-endian）载荷长度。
2. One definite-length CBOR item containing the message.
   一个包含该消息的确定长度（definite-length）CBOR 项。

The first client message is always `hello`, containing `PROTOCOL_VERSION` and a bearer token. Subsequent messages use correlated request/response envelopes and server event envelopes. Session and server snapshots are authoritative. Progress events are transient UI hints and must not be reduced into authoritative state.
客户端的第一条消息始终是 `hello`，其中包含 `PROTOCOL_VERSION` 与一个 bearer token。后续消息使用相互关联的请求/响应信封（envelope）以及服务端事件信封。会话快照与服务端快照具有权威性。进度事件只是临时的 UI 提示，不得被归并（reduce）进权威状态。

## Validated message API 经校验的消息 API

`encodeClientMessage()` and `encodeServerMessage()` validate a message and return a complete framed `Uint8Array`. The incremental decoders accept arbitrary fragmentation or coalescing, so they work with streams, sockets, and custom byte transports.
`encodeClientMessage()` 与 `encodeServerMessage()` 会校验消息并返回完整的已分帧 `Uint8Array`。增量解码器可接受任意的分片或合并，因此可用于流、套接字（socket）以及自定义字节传输。

```ts
import {
  PROTOCOL_VERSION,
  createServerMessageDecoder,
  encodeClientMessage,
  type ClientHello,
} from "@earendil-works/pi-protocol";

const hello: ClientHello = {
  type: "hello",
  version: PROTOCOL_VERSION,
  token: bearerToken,
};

transport.send(encodeClientMessage(hello));

const decoder = createServerMessageDecoder({ maxFrameLength: 1024 * 1024 });
for (const message of decoder.push(incomingChunk)) {
  handleServerMessage(message);
}
decoder.end(); // Call when the byte stream closes to detect truncation.
```

`ClientMessageDecoder` and `ServerMessageDecoder` are also available directly. Schema violations, malformed CBOR, and invalid framing throw `ProtocolValidationError`. Validation errors do not retain rejected payloads.
`ClientMessageDecoder` 与 `ServerMessageDecoder` 也可直接使用。模式（schema）违规、格式错误的 CBOR 以及无效分帧都会抛出 `ProtocolValidationError`。校验错误不会保留被拒绝的载荷。

`parseClientMessage()` and `parseServerMessage()` only validate already-decoded values. They do not parse JSON strings.
`parseClientMessage()` 与 `parseServerMessage()` 只校验已解码的值，它们不会解析 JSON 字符串。

## Transport support 传输支持

Every transport carries the same complete bytes: `[uint32-be CBOR length][CBOR payload]`. Transports may split or coalesce those bytes arbitrarily.
每种传输都承载相同的完整字节：`[uint32-be CBOR length][CBOR payload]`。传输层可以任意拆分或合并这些字节。

This package does not bundle a transport. Consumers provide a byte-stream transport that preserves byte order and reports stream closure. Custom transports must handle arbitrary frame fragmentation and coalescing.
本包不内置任何传输实现。使用方需自行提供一个能保持字节顺序并上报流关闭的字节流传输。自定义传输必须能处理任意的帧分片与合并。

All transports are untrusted. Configure matching frame limits and enforce the authentication and access controls appropriate for the transport.
所有传输都被视为不可信。请配置相匹配的帧长度上限，并实施适合该传输的认证与访问控制。

## Encoding and framing 编码与分帧

`encodeCbor()` and `decodeCbor()` implement the protocol's strict RFC 8949 subset. `encodeFrame()` and `FrameDecoder` handle framing independently of schemas and CBOR.
`encodeCbor()` 与 `decodeCbor()` 实现了该协议严格的 RFC 8949 子集。`encodeFrame()` 与 `FrameDecoder` 独立于模式定义与 CBOR 处理分帧。

The CBOR subset supports:
该 CBOR 子集支持：

- `null` and booleans
  `null` 与布尔值
- finite numbers, with integers restricted to JavaScript's safe range and non-integers encoded as float64
  有限数值，其中整数限制在 JavaScript 的安全范围内，非整数以 float64 编码
- UTF-8 strings
  UTF-8 字符串
- `Uint8Array` byte strings
  `Uint8Array` 字节串
- definite-length arrays
  确定长度的数组
- definite-length maps represented by objects with unique string keys
  由具有唯一字符串键的对象表示的确定长度映射（map）

Undefined object properties are omitted. JSON-valued protocol fields reject CBOR byte strings and non-plain objects. Top-level undefined, undefined array entries, sparse arrays, non-finite or unsafe numbers, tags, indefinite-length items, malformed UTF-8, trailing data, excessive nesting, and oversized values are rejected.
值为 undefined 的对象属性会被省略。取值为 JSON 的协议字段会拒绝 CBOR 字节串与非普通对象（non-plain object）。顶层 undefined、undefined 数组元素、稀疏数组、非有限或不安全数值、标签（tag）、不定长项、格式错误的 UTF-8、尾部多余数据、过深嵌套以及超大值都会被拒绝。

Default limits are 16 MiB per CBOR payload/frame, 1,000,000 array elements or map entries, and 64 nested item levels. Options can configure these limits. A frame decoder validates the declared length before buffering payload bytes.
默认限制为：每个 CBOR 载荷/帧 16 MiB、1,000,000 个数组元素或映射条目、64 层嵌套。可通过选项配置这些限制。帧解码器会在缓冲载荷字节之前先校验声明的长度。

All schemas reject unknown object properties. The protocol is experimental and has no compatibility guarantees.
所有模式定义都会拒绝未知的对象属性。该协议尚处实验阶段，不提供任何兼容性保证。
