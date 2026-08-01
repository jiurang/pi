# @earendil-works/pi-client

Transport-neutral client for remote pi sessions. `PiClient` exchanges length-prefixed CBOR messages through a small `ByteTransport` interface. The package has no Node-specific imports.
传输层无关的远程 pi 会话（session）客户端。`PiClient` 通过一个精简的 `ByteTransport` 接口收发带长度前缀的 CBOR 消息。本包不包含任何 Node 特有的导入。

```ts
import { PiClient, type ByteTransportFactory } from "@earendil-works/pi-client";

const transportFactory: ByteTransportFactory = async (handlers) => {
  // Connect using WebSocket, Unix socket, or another ordered byte transport.
  return {
    async send(chunk) {
      // Deliver chunks in invocation order and honor backpressure.
    },
    close() {},
  };
};

const client = new PiClient({ token: bearerToken, transportFactory });
await client.connect();
const session = await client.createSession({ cwd: "/workspace" });
const unsubscribe = session.subscribe((snapshot) => render(snapshot));
await session.prompt("Inspect this project");
unsubscribe();
```

Call `handlers.onData(chunk)` for inbound bytes, `handlers.onClose()` for an orderly terminal close, and `handlers.onError(error)` for transport failures. A factory must create a fresh transport for every connection attempt.
对于入站字节调用 `handlers.onData(chunk)`，对于有序的终止关闭调用 `handlers.onClose()`，对于传输失败调用 `handlers.onError(error)`。工厂函数必须为每一次连接尝试创建一个全新的传输实例。

`PiClient` does not reconnect automatically. Call `reconnect()` after disconnection. One connection can attach several sessions. Requests are correlated by ID. Server snapshots and successful response snapshots are authoritative, while progress events do not mutate snapshot state optimistically. Read cached session summaries from `client.snapshot?.sessions`; call `listSessions()` to request a refreshed list from the server.
`PiClient` 不会自动重连。断开连接后请调用 `reconnect()`。一个连接可以附着（attach）多个会话。请求通过 ID 进行关联匹配。服务端快照（snapshot）和成功响应中的快照具有权威性，而进度事件不会乐观地修改快照状态。可从 `client.snapshot?.sessions` 读取缓存的会话摘要；调用 `listSessions()` 可向服务端请求刷新后的列表。

`createSession()` and `attachSession()` return a `PiSessionHandle`; handles cannot be constructed directly. A returned handle is attached and remains a stable client-side reference for that session. Explicit detach, server removal, or disconnection makes a retained handle unavailable for commands. Its latest snapshot remains readable after detach or disconnection unless the server removes the session. Calling `attachSession()` again reacquires the session and returns the existing handle. Commands fail with `PiDisconnectedError` while the client is disconnected and `PiSessionDetachedError` when the client is connected but the session is detached.
`createSession()` 和 `attachSession()` 返回一个 `PiSessionHandle`；句柄无法直接构造。返回的句柄处于已附着状态，并作为该会话在客户端的稳定引用。显式分离（detach）、服务端移除或连接断开都会使持有的句柄无法再执行命令。除非服务端移除了该会话，否则在分离或断开连接后，其最新快照仍然可读。再次调用 `attachSession()` 会重新获取该会话并返回已有的句柄。当客户端处于断开状态时，命令会以 `PiDisconnectedError` 失败；当客户端已连接但会话已分离时，则以 `PiSessionDetachedError` 失败。

`subscribe()` observes authoritative snapshots. `onEvent()` observes protocol events. Both return an unsubscribe function. Structured errors returned by the server are exposed as `PiServerError`.
`subscribe()` 用于观察权威快照。`onEvent()` 用于观察协议事件。两者都会返回一个取消订阅函数。服务端返回的结构化错误以 `PiServerError` 的形式暴露。

## Limits and security 限制与安全

`PiClientOptions.maxFrameLength` bounds inbound and outbound CBOR payloads. Configure matching limits on the client and server. Transports should separately bound queued outbound bytes and preserve send order.
`PiClientOptions.maxFrameLength` 限制入站和出站 CBOR 载荷的大小。请在客户端和服务端配置一致的限制值。传输层应当另行限制排队的出站字节数，并保持发送顺序。

Treat peers as untrusted. Use a secure transport where required and protect the protocol bearer token.
应将对端视为不可信。必要时使用安全传输，并妥善保护协议的 bearer token。

Subscriber exceptions are isolated from protocol state. Set `onListenerError` in `PiClientOptions` to report them to application logging or diagnostics.
订阅者抛出的异常与协议状态相互隔离。可在 `PiClientOptions` 中设置 `onListenerError`，将这些异常上报到应用的日志或诊断系统。
