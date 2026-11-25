---
title: API reference
description: 'Every export of @netifyjs/netify grouped by area, with the main classes listed member by member.'
---

# API

Every export of `@netifyjs/netify` grouped by area, followed by the main classes member by member. Import everything from the package root, `@netifyjs/netify`. The options types have their own tables in [Options](/reference/options).

## Exports

### Bootstraps

Starting TCP servers and clients. See [How it works](/guide/how-it-works) and [TCP](/transports/tcp).

| Export               | Kind  | What it is                                          |
| -------------------- | ----- | --------------------------------------------------- |
| `ServerBootstrap`    | Class | Builds and binds a TCP or Unix socket server        |
| `Bootstrap`          | Class | Builds and connects a TCP or Unix client            |
| `ReconnectingClient` | Class | Client that reconnects with backoff                 |
| `Dispatcher`         | Class | Bun socket handler that turns sockets into channels |
| `BindOptions`        | Type  | `TcpBindOptions \| UnixBindOptions`                 |
| `TcpBindOptions`     | Type  | Host and port to listen on                          |
| `UnixBindOptions`    | Type  | Unix socket path to listen on                       |
| `ConnectOptions`     | Type  | `TcpConnectOptions \| UnixConnectOptions`           |
| `TcpConnectOptions`  | Type  | Host and port to connect to                         |
| `UnixConnectOptions` | Type  | Unix socket path to connect to                      |
| `ServerOptions`      | Type  | Settings for the listening socket                   |
| `ClientOptions`      | Type  | Socket settings for a client, with TLS              |
| `SocketOptions`      | Type  | Settings for each TCP connection                    |
| `ReconnectOptions`   | Type  | Backoff settings for `ReconnectingClient`           |
| `ReconnectEvents`    | Type  | Connect, disconnect and retry callbacks             |
| `DispatcherEvents`   | Type  | Callbacks a `Dispatcher` reports to                 |
| `SocketData`         | Type  | `Channel \| undefined`, the data on a Bun socket    |

### Buffers

Reading and writing bytes. See [ByteBuf](/guide/bytebuf), and [Games](/scaling/games) for bit packing and quantising.

| Export             | Kind  | What it is                                     |
| ------------------ | ----- | ---------------------------------------------- |
| `ByteBuf`          | Class | Growable buffer with reader and writer indexes |
| `ByteBufPool`      | Class | Free list that pooled buffers go back to       |
| `BitReader`        | Class | Reads values a few bits at a time              |
| `BitWriter`        | Class | Writes values a few bits at a time             |
| `Quantizer`        | Class | Packs a number range into a fixed bit width    |
| `Endian`           | Type  | `'big' \| 'little'`                            |
| `QuantizerOptions` | Type  | Range and bit width for a `Quantizer`          |

### Channels

Connections, pipelines and the pieces under them. See [How it works](/guide/how-it-works) and [Pipeline](/guide/pipeline).

| Export               | Kind  | What it is                                         |
| -------------------- | ----- | -------------------------------------------------- |
| `Channel`            | Class | One connection and its pipeline                    |
| `ServerChannel`      | Class | A listening server and its child channels          |
| `ShutdownEvent`      | Class | Fired on each channel by `shutdownGracefully`      |
| `Pipeline`           | Class | Ordered chain of handlers on a channel             |
| `HandlerContext`     | Class | A handler's link in the pipeline                   |
| `ChannelInitializer` | Class | Handler that runs a setup function once            |
| `ChannelGroup`       | Class | Set of channels for broadcasting                   |
| `AttributeKey`       | Class | Typed key for per channel state                    |
| `AttributeMap`       | Class | Per channel state store                            |
| `EventQueue`         | Class | Runs a channel's inbound events in order           |
| `OutboundBuffer`     | Class | Queued writes and writability tracking             |
| `WriteTracker`       | Class | Keeps flushes behind writes still in progress      |
| `HeadHandler`        | Class | First handler, hands bytes to the transport        |
| `TailHandler`        | Class | Last handler, logs anything left unhandled         |
| `SocketTransport`    | Class | `Transport` over a Bun TCP socket                  |
| `ChannelOptions`     | Type  | Logger and write limits for a channel              |
| `ChannelSetup`       | Type  | Function that builds a channel's pipeline          |
| `ChannelMatcher`     | Type  | Picks channels in a `ChannelGroup`                 |
| `GroupResult`        | Type  | Channels that succeeded and failed in a group call |
| `GroupFailure`       | Type  | One failed channel and its error                   |
| `OutboundOptions`    | Type  | Settings for an `OutboundBuffer`                   |
| `QueueEvents`        | Type  | Busy and idle callbacks for an `EventQueue`        |
| `ServerAddress`      | Type  | Host and port, or Unix path, of a server           |
| `Sink`               | Type  | Where a `HeadHandler` sends bytes                  |
| `Transport`          | Type  | The socket under a channel                         |

### Handlers

Handler types and the base classes to extend. See [Handlers](/guide/handlers).

| Export                   | Kind  | What it is                                      |
| ------------------------ | ----- | ----------------------------------------------- |
| `InboundHandlerAdapter`  | Class | Base for inbound handlers, forwards every event |
| `OutboundHandlerAdapter` | Class | Base for outbound handlers, forwards every call |
| `DuplexHandlerAdapter`   | Class | Base for handlers that do both                  |
| `SimpleInboundHandler`   | Class | Inbound base that only takes one message type   |
| `ChannelHandler`         | Type  | `InboundHandler \| OutboundHandler`             |
| `InboundHandler`         | Type  | Callbacks for inbound events                    |
| `OutboundHandler`        | Type  | Callbacks for write, flush and close            |
| `DuplexHandler`          | Type  | `InboundHandler & OutboundHandler`              |
| `LifecycleCallbacks`     | Type  | `handlerAdded` and `handlerRemoved`             |

### Built in handlers

Timeouts, batching, rate limits, metrics, logging and offloading. See [Safety](/scaling/safety) for limits, [Metrics](/scaling/metrics) for metrics and [Workers](/scaling/workers) for offloading.

| Export                         | Kind  | What it is                                  |
| ------------------------------ | ----- | ------------------------------------------- |
| `IdleStateHandler`             | Class | Fires an `IdleStateEvent` after quiet time  |
| `IdleStateEvent`               | Class | Which side went idle                        |
| `ReadTimeoutHandler`           | Class | Closes a channel that stops reading         |
| `ReadTimeoutError`             | Class | Raised by `ReadTimeoutHandler`              |
| `WriteTimeoutHandler`          | Class | Closes a channel whose write takes too long |
| `WriteTimeoutError`            | Class | Raised by `WriteTimeoutHandler`             |
| `FlushConsolidationHandler`    | Class | Batches flushes to cut syscalls             |
| `LoggingHandler`               | Class | Logs every event that passes                |
| `MetricsHandler`               | Class | Counts connections, bytes and messages      |
| `ChannelTrafficShapingHandler` | Class | Limits one channel's bytes a second         |
| `GlobalTrafficShapingHandler`  | Class | Limits bytes a second across channels       |
| `TrafficShapingHandler`        | Class | Base of both traffic shaping handlers       |
| `TokenBucket`                  | Class | The rate a shaping handler spends against   |
| `OffloadHandler`               | Class | Sends messages to a `WorkerPool`            |
| `IdleState`                    | Type  | `'reader' \| 'writer' \| 'all'`             |
| `IdleOptions`                  | Type  | Timeouts for `IdleStateHandler`             |
| `FlushConsolidationOptions`    | Type  | Settings for `FlushConsolidationHandler`    |
| `OffloadOptions`               | Type  | Pool and limits for `OffloadHandler`        |
| `MetricsOptions`               | Type  | Settings for `MetricsHandler`               |
| `MetricsSnapshot`              | Type  | What `MetricsHandler.snapshot` returns      |
| `TrafficShapingOptions`        | Type  | Limits for the traffic shaping handlers     |

### Codecs

Framing and encoding. See [Codecs](/guide/codecs).

| Export                         | Kind  | What it is                                          |
| ------------------------------ | ----- | --------------------------------------------------- |
| `ByteToMessageDecoder`         | Class | Base for decoders that frame bytes                  |
| `MessageToByteEncoder`         | Class | Base for encoders that write bytes                  |
| `MessageToMessageDecoder`      | Class | Base for decoders that turn one message into others |
| `MessageToMessageEncoder`      | Class | Base for encoders that turn one message into others |
| `LengthFieldBasedFrameDecoder` | Class | Frames by a length field                            |
| `LengthFieldPrepender`         | Class | Writes a length field before each message           |
| `DelimiterBasedFrameDecoder`   | Class | Frames by delimiter bytes                           |
| `LineBasedFrameDecoder`        | Class | Frames by LF or CRLF                                |
| `FixedLengthFrameDecoder`      | Class | Frames by a fixed size                              |
| `StringDecoder`                | Class | Turns frames into strings                           |
| `StringEncoder`                | Class | Turns strings into UTF-8 bytes                      |
| `BinaryCodec`                  | Class | Encodes and decodes with your own functions         |
| `ProtobufCodec`                | Class | `BinaryCodec` for protobufjs types                  |
| `MessagePackCodec`             | Class | `BinaryCodec` for a MessagePack library             |
| `DecoderError`                 | Class | Raised when input can't be decoded                  |
| `EncoderError`                 | Class | Raised when a message can't be encoded              |
| `DecoderOptions`               | Type  | Cumulation limit for `ByteToMessageDecoder`         |
| `LengthFieldOptions`           | Type  | Layout of the length field                          |
| `LengthFieldLength`            | Type  | `1 \| 2 \| 3 \| 4 \| 8`                             |
| `PrependerOptions`             | Type  | Layout of the prepended length                      |
| `DelimiterOptions`             | Type  | Delimiters and frame limit                          |
| `LineOptions`                  | Type  | Line limit and stripping                            |
| `BinaryCodecOptions`           | Type  | Encode, decode and accepts functions                |
| `ProtobufType`                 | Type  | Shape of a protobufjs message type                  |
| `MessagePacker`                | Type  | Shape of a MessagePack library                      |

### HTTP codecs

HTTP/1.1 codecs and messages. See [HTTP](/transports/http).

| Export                 | Kind  | What it is                                       |
| ---------------------- | ----- | ------------------------------------------------ |
| `HttpServerCodec`      | Class | Request decoder and response encoder together    |
| `HttpClientCodec`      | Class | Request encoder and response decoder together    |
| `HttpRequestDecoder`   | Class | Bytes to requests and content                    |
| `HttpResponseDecoder`  | Class | Bytes to responses and content                   |
| `HttpObjectDecoder`    | Class | Base for both decoders                           |
| `HttpRequestEncoder`   | Class | Requests and content to bytes                    |
| `HttpResponseEncoder`  | Class | Responses and content to bytes                   |
| `HttpObjectEncoder`    | Class | Base for both encoders                           |
| `HttpObjectAggregator` | Class | Joins a message and its content into one         |
| `HttpMessage`          | Class | Base for requests and responses                  |
| `HttpRequest`          | Class | Request line and headers                         |
| `HttpResponse`         | Class | Status line and headers                          |
| `FullHttpRequest`      | Class | Request with its whole body                      |
| `FullHttpResponse`     | Class | Response with its whole body                     |
| `HttpContent`          | Class | A piece of a body                                |
| `LastHttpContent`      | Class | The last piece of a body, with trailers          |
| `HttpHeaders`          | Class | Case insensitive header list                     |
| `HttpMethod`           | Class | Request method, with constants like `GET`        |
| `HttpResponseStatus`   | Class | Status code and phrase, with constants like `OK` |
| `HttpVersion`          | Class | `HTTP_1_0` or `HTTP_1_1`                         |
| `HttpDecoderOptions`   | Type  | Line, header and chunk limits                    |
| `HttpObject`           | Type  | `HttpMessage \| HttpContent`                     |
| `FullHttpMessage`      | Type  | `FullHttpRequest \| FullHttpResponse`            |
| `ContentSource`        | Type  | `ByteBuf \| Uint8Array \| string`                |
| `HeaderEntry`          | Type  | A name and value pair                            |
| `HeaderValue`          | Type  | `string \| number`                               |

### WebSocket codecs

WebSocket frames and protocol handlers for pipelines. See [WebSocket](/transports/websocket).

| Export                           | Kind     | What it is                                        |
| -------------------------------- | -------- | ------------------------------------------------- |
| `WebSocketServerProtocolHandler` | Class    | Server handshake and control frames               |
| `WebSocketClientProtocolHandler` | Class    | Client handshake and control frames               |
| `WebSocketProtocolHandler`       | Class    | Base for both protocol handlers                   |
| `WebSocketFrameDecoder`          | Class    | Bytes to frames                                   |
| `WebSocketFrameEncoder`          | Class    | Frames to bytes                                   |
| `WebSocketFrame`                 | Class    | Base for every frame                              |
| `TextWebSocketFrame`             | Class    | Text frame                                        |
| `BinaryWebSocketFrame`           | Class    | Binary frame                                      |
| `ContinuationWebSocketFrame`     | Class    | Next piece of a fragmented message                |
| `CloseWebSocketFrame`            | Class    | Close frame with status and reason                |
| `PingWebSocketFrame`             | Class    | Ping frame                                        |
| `PongWebSocketFrame`             | Class    | Pong frame                                        |
| `WebSocketHandshakeComplete`     | Class    | User event fired after the upgrade                |
| `WebSocketUpgrade`               | Class    | Swaps the HTTP codec for frame codecs             |
| `WebSocketKey`                   | Class    | `Sec-WebSocket-Key` and its accept value          |
| `WebSocketCloseStatus`           | Class    | Close codes, with constants like `NORMAL_CLOSURE` |
| `CorruptedFrameError`            | Class    | Raised on a bad frame, with a close code          |
| `HandshakeError`                 | Class    | Raised when the upgrade fails                     |
| `WebSocketOpcode`                | Constant | Frame opcodes by name                             |
| `WebSocketOpcodeValue`           | Type     | One of the `WebSocketOpcode` values               |
| `WebSocketServerOptions`         | Type     | Path, subprotocols and frame limit                |
| `WebSocketClientOptions`         | Type     | URL, subprotocols, headers and frame limit        |
| `WebSocketDecoderOptions`        | Type     | Masking rule and frame limit                      |
| `WebSocketEncoderOptions`        | Type     | Masking rule                                      |
| `FrameSource`                    | Type     | `ByteBuf \| Uint8Array \| string`                 |

### Datagrams

UDP channels. See [UDP](/transports/udp).

| Export                   | Kind  | What it is                            |
| ------------------------ | ----- | ------------------------------------- |
| `DatagramBootstrap`      | Class | Builds and binds a UDP channel        |
| `DatagramChannel`        | Class | Channel over a UDP socket             |
| `DatagramPacket`         | Class | Payload with sender and recipient     |
| `DatagramTransport`      | Class | `Transport` over a Bun UDP socket     |
| `DatagramBindOptions`    | Type  | Local host and port                   |
| `DatagramConnectOptions` | Type  | Remote host and port, plus local ones |
| `PacketAddress`          | Type  | Host and port of a packet             |
| `UdpHandle`              | Type  | A bound or connected Bun UDP socket   |

### Reliable UDP

Reliable UDP with lanes, acks and optional encryption. See [Reliable UDP](/transports/reliable).

| Export              | Kind     | What it is                                                                             |
| ------------------- | -------- | -------------------------------------------------------------------------------------- |
| `ReliableBootstrap` | Class    | Binds a reliable server or connects a client                                           |
| `ReliableHandler`   | Class    | Pipeline handler that runs the protocol                                                |
| `ReliablePeer`      | Class    | One connected peer                                                                     |
| `ReliableMessage`   | Class    | A message from a peer on a lane                                                        |
| `PeerConnected`     | Class    | User event when a peer connects                                                        |
| `PeerDisconnected`  | Class    | User event when a peer leaves                                                          |
| `PeerRegistry`      | Class    | Peers by address                                                                       |
| `Lane`              | Class    | Send and receive state for one lane                                                    |
| `PacketCipher`      | Class    | Seals and opens packets                                                                |
| `CookieJar`         | Class    | Issues and checks handshake cookies                                                    |
| `PacketKind`        | Constant | Packet type bytes by name                                                              |
| `connectPacket`     | Function | Builds a connect packet                                                                |
| `ReliableOptions`   | Type     | Every setting for `ReliableHandler`                                                    |
| `ReliableSettings`  | Type     | `ReliableOptions` without `role` and `server`                                          |
| `ReliableRole`      | Type     | `'server' \| 'client'`                                                                 |
| `ReliableServer`    | Type     | Channel and handler from `bind`                                                        |
| `ReliableClient`    | Type     | Channel, handler and peer from `connect`                                               |
| `LaneOptions`       | Type     | Delivery mode for a lane                                                               |
| `LaneLimits`        | Type     | Window and size limits for a `Lane`                                                    |
| `Delivery`          | Type     | `'reliable-ordered' \| 'reliable-unordered' \| 'unreliable-sequenced' \| 'unreliable'` |
| `Deliver`           | Type     | Callback that receives a whole message                                                 |
| `Outgoing`          | Type     | A queued message fragment                                                              |
| `EncryptionOptions` | Type     | Key pair and expected server key                                                       |
| `KeyPair`           | Type     | X25519 public and private key                                                          |
| `SimulateOptions`   | Type     | Fake loss, latency, jitter and duplicates                                              |
| `DisconnectReason`  | Type     | `'closed' \| 'timeout' \| 'resends' \| 'local'`                                        |
| `PeerOptions`       | Type     | Settings a `ReliablePeer` is built with                                                |
| `PeerState`         | Type     | `'connecting' \| 'connected' \| 'closed'`                                              |
| `PeerStats`         | Type     | Packet and resend counters                                                             |

### WebSocket server

WebSocket servers on `Bun.serve`. See [WebSocket](/transports/websocket).

| Export                      | Kind  | What it is                                  |
| --------------------------- | ----- | ------------------------------------------- |
| `WebSocketBootstrap`        | Class | Builds and binds a WebSocket server         |
| `WebSocketServer`           | Class | A running server and its channels           |
| `WebSocketChannel`          | Class | Channel over a Bun `ServerWebSocket`        |
| `WebSocketFrameWriter`      | Class | Outbound handler that sends frames natively |
| `WebSocketOutbox`           | Class | Queue for sends Bun can't take yet          |
| `WebSocketTransport`        | Class | `Transport` over a `ServerWebSocket`        |
| `WebSocketBootstrapOptions` | Type  | Path, TLS, limits and upgrade hook          |
| `WebSocketBindOptions`      | Type  | Host and port to listen on                  |
| `UpgradeHandler`            | Type  | Decides whether to accept an upgrade        |
| `UpgradeVerdict`            | Type  | Accept with data, or refuse with a status   |
| `WebSocketState`            | Type  | Data kept on each Bun socket                |
| `OutgoingMessage`           | Type  | A binary, text, ping, pong or close send    |
| `SendResult`                | Type  | `'sent' \| 'queued' \| 'full' \| 'closed'`  |
| `OutboxEvents`              | Type  | Blocked and cleared callbacks               |

### Workers

Worker threads. See [Workers](/scaling/workers).

| Export               | Kind  | What it is                                |
| -------------------- | ----- | ----------------------------------------- |
| `WorkerPool`         | Class | Runs jobs on a pool of threads            |
| `WorkerService`      | Class | Answers pool jobs inside a thread         |
| `WorkerGroup`        | Class | Starts the same script on several threads |
| `WorkerPoolOptions`  | Type  | Script, thread count and queue limit      |
| `WorkerGroupOptions` | Type  | Script, thread count and shared memory    |
| `WorkerTask`         | Type  | Function a `WorkerService` runs           |
| `WorkerRequest`      | Type  | Job sent to a thread                      |
| `WorkerReply`        | Type  | Answer from a thread                      |

### Cluster

Processes sharing a port. See [Clustering](/scaling/clustering).

| Export           | Kind  | What it is                                  |
| ---------------- | ----- | ------------------------------------------- |
| `Cluster`        | Class | Starts, stops and reloads worker processes  |
| `ClusterOptions` | Type  | Script, worker count, restarts and timeouts |
| `ReloadOrder`    | Type  | `'start-first' \| 'stop-first'`             |

### Sharding

Zones split over processes. See [Sharding](/scaling/sharding).

| Export             | Kind  | What it is                                |
| ------------------ | ----- | ----------------------------------------- |
| `ShardMap`         | Class | Maps zones to shards and ports            |
| `ShardMapOptions`  | Type  | Shard count and first port                |
| `ShardLink`        | Class | Messages, requests, handoffs and recalls  |
| `ShardLinkOptions` | Type  | Id, peers, timeouts and message size      |
| `ShardPeer`        | Type  | Where a shard listens, TCP or Unix socket |
| `ShardListener`    | Type  | Gets a message from another shard         |
| `ShardResponder`   | Type  | Answers a request from another shard      |
| `Gateway`          | Class | Topics with subscribers on any shard      |

### Logging

| Export          | Kind  | What it is                            |
| --------------- | ----- | ------------------------------------- |
| `ConsoleLogger` | Class | Default logger, writes to the console |
| `Logger`        | Type  | `debug` and `warn` with fields        |
| `LogFields`     | Type  | `Record<string, unknown>`             |

Any logger with these two methods works, like pino. Pass it as `logger` in `ChannelOptions`.

## Classes

Signatures leave out `public`. `get` marks a getter and `static` a static member.

### Channel

| Member                           | Signature                                            | What it does                            |
| -------------------------------- | ---------------------------------------------------- | --------------------------------------- |
| `id`                             | `readonly number`                                    | Unique id in this process               |
| `pipeline`                       | `readonly Pipeline`                                  | The handler chain                       |
| `attributes`                     | `readonly AttributeMap`                              | Per channel state                       |
| `closed`                         | `readonly Promise<void>`                             | Resolves once the channel has shut down |
| `isActive`                       | `get boolean`                                        | Connected and set up                    |
| `isWritable`                     | `get boolean`                                        | False above the high water mark         |
| `pendingBytes`                   | `get number`                                         | Bytes waiting for the socket            |
| `remoteAddress`                  | `get string`                                         | Peer IP                                 |
| `remotePort`                     | `get number`                                         | Peer port                               |
| `write`                          | `(message: unknown): Promise<void>`                  | Writes through the pipeline             |
| `flush`                          | `(): Promise<void>`                                  | Sends what's been written               |
| `writeAndFlush`                  | `(message: unknown): Promise<void>`                  | Writes and flushes                      |
| `writeSync`                      | `(message: unknown): void`                           | Write with no promise                   |
| `writeAndFlushSync`              | `(message: unknown): void`                           | Write and flush with no promise         |
| `writeEncoded`                   | `(bytes: Uint8Array \| ByteBuf): Promise<void>`      | Writes bytes past every handler         |
| `writeAndFlushEncoded`           | `(bytes: Uint8Array \| ByteBuf): Promise<void>`      | `writeEncoded` plus a flush             |
| `writeAndFlushEncodedSync`       | `(bytes: Uint8Array \| ByteBuf): void`               | Same with no promise                    |
| `writeEncodedSync`               | `(bytes: Uint8Array \| ByteBuf): void`               | Queues encoded bytes, no flush          |
| `close`                          | `(): Promise<void>`                                  | Closes through the outbound handlers    |
| `execute`                        | `(task: () => void \| Promise<void>): Promise<void>` | Runs a task in line with inbound events |
| `activate`                       | `(setup?: ChannelSetup \| null): Promise<void>`      | Runs setup and fires `channelActive`    |
| `handleData`                     | `(bytes: Uint8Array): Promise<void>`                 | Transport hook for incoming bytes       |
| `handleMessage`                  | `(message: unknown): Promise<void>`                  | Transport hook for incoming messages    |
| `handleDrain`                    | `(): void`                                           | Transport hook for socket drain         |
| `handleClose`                    | `(): Promise<void>`                                  | Transport hook for socket close         |
| `handleError`                    | `(error: unknown): Promise<void>`                    | Transport hook for socket errors        |
| `Channel.defaultHighWaterMark`   | `static number`                                      | `65536`                                 |
| `Channel.defaultLowWaterMark`    | `static number`                                      | `32768`                                 |
| `Channel.defaultMaxPendingBytes` | `static number`                                      | `67108864`                              |

### Pipeline

| Member                          | Signature                                                          | What it does                            |
| ------------------------------- | ------------------------------------------------------------------ | --------------------------------------- |
| `channel`                       | `readonly Channel`                                                 | Channel it belongs to                   |
| `logger`                        | `readonly Logger`                                                  | Logger for unhandled events             |
| `tracker`                       | `readonly WriteTracker`                                            | Write and flush ordering                |
| `syncing`                       | `boolean`                                                          | Set during a sync write                 |
| `addFirst`                      | `<T>(name: string, handler: T): this`                              | Adds next to the head                   |
| `addLast`                       | `<T>(name: string, handler: T): this`                              | Adds next to the tail                   |
| `addBefore`                     | `<T>(base: string, name: string, handler: T): this`                | Adds on the head side of `base`         |
| `addAfter`                      | `<T>(base: string, name: string, handler: T): this`                | Adds on the tail side of `base`         |
| `remove`                        | `<T>(name: string): T`                                             | Removes and returns a handler           |
| `replace`                       | `<T>(base: string, name: string, handler: T): ChannelHandler`      | Swaps a handler and returns the old one |
| `get`                           | `<T>(name: string): T \| null`                                     | Handler by name                         |
| `find`                          | `<T>(type: abstract new (...parameters: never[]) => T): T \| null` | Handler by class                        |
| `context`                       | `(name: string): HandlerContext \| null`                           | Context by name                         |
| `names`                         | `(): string[]`                                                     | Handler names in order                  |
| `settle`                        | `(): Promise<void>`                                                | Waits for every add and remove hook     |
| `fireChannelActive`             | `(): Promise<void>`                                                | Starts `channelActive` at the head      |
| `fireChannelInactive`           | `(): Promise<void>`                                                | Starts `channelInactive` at the head    |
| `fireChannelRead`               | `(message: unknown): Promise<void>`                                | Starts a read at the head               |
| `fireChannelReadComplete`       | `(): Promise<void>`                                                | Starts `channelReadComplete`            |
| `fireChannelWritabilityChanged` | `(): Promise<void>`                                                | Starts `channelWritabilityChanged`      |
| `fireUserEventTriggered`        | `(event: unknown): Promise<void>`                                  | Sends a user event through              |
| `fireExceptionCaught`           | `(error: unknown): Promise<void>`                                  | Sends an error through                  |
| `write`                         | `(message: unknown): Promise<void>`                                | Writes from the tail                    |
| `writeSync`                     | `(message: unknown): void`                                         | Write with no promise                   |
| `flush`                         | `(): Promise<void>`                                                | Flushes from the tail                   |
| `writeAndFlush`                 | `(message: unknown): Promise<void>`                                | Writes and flushes                      |
| `writeAndFlushSync`             | `(message: unknown): void`                                         | Write and flush with no promise         |
| `close`                         | `(): Promise<void>`                                                | Closes from the tail                    |

`T` extends `ChannelHandler` throughout.

### HandlerContext

| Member                          | Signature                           | What it does                       |
| ------------------------------- | ----------------------------------- | ---------------------------------- |
| `name`                          | `readonly string`                   | Name in the pipeline               |
| `pipeline`                      | `readonly Pipeline`                 | Pipeline it belongs to             |
| `previous`                      | `HandlerContext \| null`            | Neighbour towards the head         |
| `next`                          | `HandlerContext \| null`            | Neighbour towards the tail         |
| `handler`                       | `get ChannelHandler`                | The handler it wraps               |
| `channel`                       | `get Channel`                       | The channel                        |
| `fireChannelActive`             | `(): Promise<void>`                 | Passes `channelActive` on          |
| `fireChannelInactive`           | `(): Promise<void>`                 | Passes `channelInactive` on        |
| `fireChannelRead`               | `(message: unknown): Promise<void>` | Passes a message on                |
| `fireChannelReadComplete`       | `(): Promise<void>`                 | Passes `channelReadComplete` on    |
| `fireChannelWritabilityChanged` | `(): Promise<void>`                 | Passes a writability change on     |
| `fireUserEventTriggered`        | `(event: unknown): Promise<void>`   | Passes a user event on             |
| `fireExceptionCaught`           | `(error: unknown): Promise<void>`   | Passes an error on                 |
| `write`                         | `(message: unknown): Promise<void>` | Writes from this point             |
| `flush`                         | `(): Promise<void>`                 | Flushes from this point            |
| `writeAndFlush`                 | `(message: unknown): Promise<void>` | Writes and flushes from this point |
| `writeSync`                     | `(message: unknown): void`          | Write with no promise              |
| `writeAndFlushSync`             | `(message: unknown): void`          | Write and flush with no promise    |
| `close`                         | `(): Promise<void>`                 | Closes from this point             |

### ByteBuf

#### Creating

| Member                       | Signature                                                                                       | What it does               |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------- |
| `ByteBuf.allocate`           | `static (capacity?: number, maxCapacity?: number): ByteBuf`                                     | Empty buffer               |
| `ByteBuf.wrap`               | `static (bytes: Uint8Array): ByteBuf`                                                           | Buffer over existing bytes |
| `ByteBuf.fromString`         | `static (value: string): ByteBuf`                                                               | Buffer holding UTF-8 text  |
| `ByteBuf.copyBytes`          | `static (source: Uint8Array, from: number, target: Uint8Array, to: number, size: number): void` | Copies between arrays      |
| `ByteBuf.defaultCapacity`    | `static number`                                                                                 | `256`                      |
| `ByteBuf.defaultMaxCapacity` | `static number`                                                                                 | `67108864`                 |

#### Indexes and capacity

| Member             | Signature                  | What it does                      |
| ------------------ | -------------------------- | --------------------------------- |
| `readerIndex`      | `get set number`           | Next byte to read                 |
| `writerIndex`      | `get set number`           | Next byte to write                |
| `readableBytes`    | `get number`               | Bytes between the indexes         |
| `writableBytes`    | `get number`               | Room before capacity              |
| `capacity`         | `get number`               | Current size                      |
| `maxCapacity`      | `get number`               | Size it can grow to               |
| `array`            | `get Uint8Array`           | Backing array                     |
| `arrayOffset`      | `get number`               | Start of this buffer in `array`   |
| `isReadable`       | `(size?: number): boolean` | Has at least `size` bytes to read |
| `ensureWritable`   | `(size: number): this`     | Grows to fit `size` more bytes    |
| `clear`            | `(): this`                 | Resets both indexes               |
| `markReaderIndex`  | `(): this`                 | Saves the reader index            |
| `resetReaderIndex` | `(): this`                 | Goes back to the mark             |
| `skipBytes`        | `(size: number): this`     | Moves the reader index on         |
| `discardReadBytes` | `(): this`                 | Drops bytes already read          |

#### Reading and writing

Each number type comes in four forms. `getX(index)` and `setX(index, value)` work at an absolute index and don't move the reader or writer index. `readX()` and `writeX(value)` do. Multi byte forms take an optional `endian`, `'big'` by default.

| Type               | Value    | Bytes |
| ------------------ | -------- | ----- |
| `Int8` / `Uint8`   | `number` | 1     |
| `Int16` / `Uint16` | `number` | 2     |
| `Uint24`           | `number` | 3     |
| `Int32` / `Uint32` | `number` | 4     |
| `Int64` / `Uint64` | `bigint` | 8     |
| `Float32`          | `number` | 4     |
| `Float64`          | `number` | 8     |

| Member         | Signature                                                           | What it does                        |
| -------------- | ------------------------------------------------------------------- | ----------------------------------- |
| `readBytes`    | `(size: number): Uint8Array`                                        | Reads bytes into a copy             |
| `readSlice`    | `(size: number): ByteBuf`                                           | Reads bytes as a shared view        |
| `slice`        | `(index: number, size: number): ByteBuf`                            | Shared view, reader stays put       |
| `sliceInto`    | `(index: number, size: number, target: ByteBuf): ByteBuf`           | Points `target` at a shared view    |
| `writeBytes`   | `(source: Uint8Array \| ByteBuf): this`                             | Writes bytes                        |
| `writeBytes`   | `(source: ByteBuf, index: number, length: number): this`            | Writes part of another buffer       |
| `readString`   | `(size: number): string`                                            | Reads `size` bytes of UTF-8         |
| `writeString`  | `(value: string): number`                                           | Writes UTF-8, returns bytes written |
| `readVarUint`  | `(): number`                                                        | Reads an unsigned varint            |
| `writeVarUint` | `(value: number): this`                                             | Writes an unsigned varint           |
| `readVarInt`   | `(): number`                                                        | Reads a zigzag varint               |
| `writeVarInt`  | `(value: number): this`                                             | Writes a zigzag varint              |
| `indexOf`      | `(value: number \| Uint8Array, from?: number, to?: number): number` | Finds a byte or sequence            |
| `toUint8Array` | `(): Uint8Array`                                                    | Readable bytes as a view            |
| `copy`         | `(): ByteBuf`                                                       | Independent copy                    |
| `duplicate`    | `(): ByteBuf`                                                       | Shared bytes, own indexes           |
| `toString`     | `(): string`                                                        | Readable bytes as UTF-8             |

#### Reference counts

See [Pooled frames](/guide/bytebuf#pooled-frames).

| Member            | Signature                             | What it does                              |
| ----------------- | ------------------------------------- | ----------------------------------------- |
| `retain`          | `(): this`                            | Adds an owner                             |
| `release`         | `(): boolean`                         | Drops an owner, true if it was the last   |
| `refCnt`          | `number`                              | Owners it has                             |
| `pooled`          | `boolean`                             | Whether `release` hands it back to a pool |
| `detach`          | `(): this`                            | Leaves its pool for good                  |
| `ByteBuf.forPool` | `static (pool: ByteBufPool): ByteBuf` | Empty buffer that belongs to a pool       |

### ByteBufPool

| Member                     | Signature                 | What it does                       |
| -------------------------- | ------------------------- | ---------------------------------- |
| `constructor`              | `(limit?: number)`        | Keeps at most `limit` free buffers |
| `take`                     | `(): ByteBuf \| null`     | A free buffer, or null             |
| `give`                     | `(buffer: ByteBuf): void` | Keeps a released buffer            |
| `ByteBufPool.defaultLimit` | `static number`           | `1024`                             |

### ChannelGroup

| Member                | Signature                                                                        | What it does                            |
| --------------------- | -------------------------------------------------------------------------------- | --------------------------------------- |
| `size`                | `get number`                                                                     | Member count                            |
| `[Symbol.iterator]`   | `(): Iterator<Channel>`                                                          | Iterates the members                    |
| `add`                 | `(channel: Channel): this`                                                       | Adds a channel until it closes          |
| `remove`              | `(channel: Channel): boolean`                                                    | Removes without closing                 |
| `has`                 | `(channel: Channel): boolean`                                                    | Checks membership                       |
| `find`                | `(id: number): Channel \| null`                                                  | Member by id                            |
| `write`               | `(message: unknown, matcher?: ChannelMatcher): Promise<GroupResult>`             | Writes to each match                    |
| `flush`               | `(matcher?: ChannelMatcher): Promise<GroupResult>`                               | Flushes each match                      |
| `writeAndFlush`       | `(message: unknown, matcher?: ChannelMatcher): Promise<GroupResult>`             | Writes and flushes each match           |
| `broadcast`           | `(bytes: Uint8Array \| ByteBuf, matcher?: ChannelMatcher): Promise<GroupResult>` | Sends encoded bytes past the pipelines  |
| `broadcastSync`       | `(bytes: Uint8Array \| ByteBuf, matcher?: ChannelMatcher \| null): number`       | Same with no promise, returns the count |
| `close`               | `(matcher?: ChannelMatcher): Promise<GroupResult>`                               | Closes each match                       |
| `ChannelGroup.all`    | `static (): ChannelMatcher`                                                      | Matches everyone                        |
| `ChannelGroup.except` | `static (excluded: Channel): ChannelMatcher`                                     | Matches everyone but one                |

### ServerBootstrap

| Member                            | Signature                                        | What it does                 |
| --------------------------------- | ------------------------------------------------ | ---------------------------- |
| `childHandler`                    | `<T extends ChannelHandler>(handler: T): this`   | Handler for each connection  |
| `childHandler`                    | `(setup: ChannelSetup): this`                    | Setup for each connection    |
| `options`                         | `(options: ServerOptions): this`                 | Listening socket settings    |
| `childOptions`                    | `(options: SocketOptions): this`                 | Settings for each connection |
| `bind`                            | `(address: BindOptions): Promise<ServerChannel>` | Starts listening             |
| `ServerBootstrap.defaultHostname` | `static string`                                  | `'0.0.0.0'`                  |

#### ServerChannel

| Member     | Signature                | What it does                         |
| ---------- | ------------------------ | ------------------------------------ |
| `closed`   | `readonly Promise<void>` | Resolves once every child has closed |
| `address`  | `get ServerAddress`      | Host and port, or Unix path          |
| `hostname` | `get string`             | Bound host, throws on Unix sockets   |
| `port`     | `get number`             | Bound port, throws on Unix sockets   |
| `isOpen`   | `get boolean`            | False once closing starts            |
| `channels` | `get readonly Channel[]` | Snapshot of open connections         |
| `close`    | `(): Promise<void>`      | Stops listening and closes children  |

### Bootstrap

| Member    | Signature                                      | What it does            |
| --------- | ---------------------------------------------- | ----------------------- |
| `handler` | `<T extends ChannelHandler>(handler: T): this` | Handler for the channel |
| `handler` | `(setup: ChannelSetup): this`                  | Setup for the channel   |
| `options` | `(options: ClientOptions): this`               | Socket settings         |
| `connect` | `(address: ConnectOptions): Promise<Channel>`  | Connects                |

#### ReconnectingClient

`new ReconnectingClient(bootstrap: Bootstrap, address: ConnectOptions, options?: ReconnectOptions, events?: ReconnectEvents)`

| Member           | Signature              | What it does                    |
| ---------------- | ---------------------- | ------------------------------- |
| `channel`        | `get Channel \| null`  | Current channel, or null        |
| `isRunning`      | `get boolean`          | Started and not given up        |
| `start`          | `(): Promise<Channel>` | Connects and keeps reconnecting |
| `waitForChannel` | `(): Promise<Channel>` | Resolves on the next connection |
| `stop`           | `(): Promise<void>`    | Stops retrying and closes       |

### DatagramBootstrap

| Member                              | Signature                                                     | What it does                |
| ----------------------------------- | ------------------------------------------------------------- | --------------------------- |
| `handler`                           | `<T extends ChannelHandler>(handler: T): this`                | Handler for the channel     |
| `handler`                           | `(setup: ChannelSetup<DatagramChannel>): this`                | Setup for the channel       |
| `options`                           | `(options: ChannelOptions): this`                             | Channel settings            |
| `bind`                              | `(options?: DatagramBindOptions): Promise<DatagramChannel>`   | Binds a socket for any peer |
| `connect`                           | `(options: DatagramConnectOptions): Promise<DatagramChannel>` | Binds a socket for one peer |
| `DatagramBootstrap.defaultHostname` | `static string`                                               | `'0.0.0.0'`                 |

### DatagramChannel

Extends `Channel`. Writes take a `DatagramPacket`, or bytes on a connected channel.

| Member         | Signature                                                                        | What it does                             |
| -------------- | -------------------------------------------------------------------------------- | ---------------------------------------- |
| `localAddress` | `get PacketAddress`                                                              | Bound host and port                      |
| `isConnected`  | `get boolean`                                                                    | Tied to one peer                         |
| `sendMany`     | `(content: ByteBuf \| Uint8Array, recipients: readonly PacketAddress[]): number` | One payload to many peers in one syscall |
| `setBroadcast` | `(enabled: boolean): this`                                                       | Allows broadcast addresses               |
| `setTtl`       | `(ttl: number): this`                                                            | Sets the hop limit                       |
| `joinGroup`    | `(group: string, interfaceAddress?: string \| null): boolean`                    | Joins a multicast group                  |
| `leaveGroup`   | `(group: string, interfaceAddress?: string \| null): boolean`                    | Leaves a multicast group                 |

### ReliableBootstrap

| Member           | Signature                                                 | What it does                     |
| ---------------- | --------------------------------------------------------- | -------------------------------- |
| `options`        | `(options: ReliableSettings): this`                       | Protocol settings                |
| `channelOptions` | `(options: ChannelOptions): this`                         | Channel settings                 |
| `handler`        | `(setup: ChannelSetup<DatagramChannel>): this`            | Setup after the reliable handler |
| `bind`           | `(address: DatagramBindOptions): Promise<ReliableServer>` | Starts a server                  |
| `connect`        | `(server: PacketAddress): Promise<ReliableClient>`        | Connects to a server             |

#### ReliableHandler

| Member                            | Signature                       | What it does                             |
| --------------------------------- | ------------------------------- | ---------------------------------------- |
| `connected`                       | `get Promise<ReliablePeer>`     | Server peer, on a client                 |
| `peers`                           | `get ReadonlySet<ReliablePeer>` | Every known peer                         |
| `publicKey`                       | `get Uint8Array \| null`        | Own public key, or null                  |
| `ReliableHandler.generateKeyPair` | `static (): KeyPair`            | New key pair for a fixed server identity |
| `ReliableHandler.defaultLanes`    | `static readonly LaneOptions[]` | Reliable ordered, then unreliable        |
| `ReliableHandler.connectInterval` | `static number`                 | `100` ms between connect packets         |

### ReliablePeer

| Member           | Signature                                                        | What it does                     |
| ---------------- | ---------------------------------------------------------------- | -------------------------------- |
| `address`        | `readonly PacketAddress`                                         | Peer address                     |
| `salt`           | `readonly number`                                                | Handshake salt                   |
| `session`        | `number`                                                         | Session id                       |
| `state`          | `PeerState`                                                      | Where it is in its life          |
| `stats`          | `readonly PeerStats`                                             | Packet and resend counters       |
| `lastReceivedAt` | `number`                                                         | Last packet in                   |
| `lastSentAt`     | `number`                                                         | Last packet out                  |
| `failed`         | `boolean`                                                        | A message ran out of resends     |
| `closing`        | `boolean`                                                        | Set by `close`                   |
| `data`           | `unknown`                                                        | Your own data                    |
| `cipher`         | `PacketCipher \| null`                                           | Packet cipher, or null           |
| `rtt`            | `get number`                                                     | Smoothed round trip in ms        |
| `send`           | `(lane: number, content: ByteBuf \| Uint8Array \| string): void` | Queues a message on a lane       |
| `close`          | `(): void`                                                       | Hangs up on the next tick        |
| `receive`        | `(bytes: Uint8Array, now: number, out: ReliableMessage[]): void` | Handler hook for a data packet   |
| `pack`           | `(now: number, out: Uint8Array[], force: boolean): void`         | Handler hook that builds packets |
| `isDue`          | `(now: number): boolean`                                         | Has work on this tick            |
| `hasWork`        | `get boolean`                                                    | Has something to send now        |
| `owesAck`        | `get boolean`                                                    | Waiting to send an ack           |

`ReliableMessage` has `peer`, `lane`, `content` and `reply(content)`, which sends back on the same lane.

### WebSocketBootstrap

| Member                                       | Signature                                                   | What it does              |
| -------------------------------------------- | ----------------------------------------------------------- | ------------------------- |
| `childHandler`                               | `<T extends ChannelHandler>(handler: T): this`              | Handler for each socket   |
| `childHandler`                               | `(setup: ChannelSetup<WebSocketChannel>): this`             | Setup for each socket     |
| `options`                                    | `(options: WebSocketBootstrapOptions): this`                | Server settings           |
| `childOptions`                               | `(options: ChannelOptions): this`                           | Settings for each channel |
| `bind`                                       | `(address: WebSocketBindOptions): Promise<WebSocketServer>` | Starts listening          |
| `WebSocketBootstrap.defaultMaxPayloadLength` | `static number`                                             | `1048576`                 |

### WebSocketServer

| Member            | Signature                                                           | What it does                   |
| ----------------- | ------------------------------------------------------------------- | ------------------------------ |
| `server`          | `readonly Server<WebSocketState>`                                   | The Bun server                 |
| `port`            | `get number`                                                        | Bound port                     |
| `hostname`        | `get string`                                                        | Bound host                     |
| `channels`        | `get ReadonlySet<WebSocketChannel>`                                 | Every open channel             |
| `publish`         | `(topic: string, content: ByteBuf \| Uint8Array \| string): number` | Sends to everyone on a topic   |
| `subscriberCount` | `(topic: string): number`                                           | Sockets on a topic             |
| `close`           | `(): Promise<void>`                                                 | Stops and closes every channel |

### WebSocketChannel

Extends `Channel`. Writes take frames, strings, `Uint8Array` or `ByteBuf`.

| Member           | Signature                                                           | What it does                        |
| ---------------- | ------------------------------------------------------------------- | ----------------------------------- |
| `socket`         | `readonly ServerWebSocket<WebSocketState>`                          | The Bun socket                      |
| `data`           | `get unknown`                                                       | Data from the upgrade hook, or null |
| `uri`            | `get string`                                                        | Requested path and query            |
| `isWritable`     | `get boolean`                                                       | False while Bun is backed up        |
| `pendingBytes`   | `get number`                                                        | Bytes queued in Netify              |
| `bufferedAmount` | `get number`                                                        | Bytes queued in Bun                 |
| `subscribe`      | `(topic: string): boolean`                                          | Joins a topic                       |
| `unsubscribe`    | `(topic: string): boolean`                                          | Leaves a topic                      |
| `isSubscribed`   | `(topic: string): boolean`                                          | Checks a topic                      |
| `publish`        | `(topic: string, content: ByteBuf \| Uint8Array \| string): number` | Sends to everyone else on a topic   |
| `sendNative`     | `(message: OutgoingMessage): SendResult`                            | Sends now or queues in order        |

### Gateway

| Member            | Signature                                               | What it does                                  |
| ----------------- | ------------------------------------------------------- | --------------------------------------------- |
| `constructor`     | `(link: ShardLink)`                                     | Listens for publishes from other shards       |
| `subscribe`       | `(channel: Channel, topic: string): void`               | Puts a local channel on a topic               |
| `unsubscribe`     | `(channel: Channel, topic: string): boolean`            | Takes it off again                            |
| `isSubscribed`    | `(channel: Channel, topic: string): boolean`            | Checks a local channel                        |
| `subscriberCount` | `(topic: string): number`                               | Local channels on a topic                     |
| `publish`         | `(topic: string, bytes: Uint8Array \| ByteBuf): number` | Sends to every shard, returns the local count |
