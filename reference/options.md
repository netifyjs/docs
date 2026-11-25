---
title: Options reference
description: 'Every options type in @netifyjs/netify with its defaults, for bootstraps, channels, codecs and handlers.'
---

# Options

Every options type in `@netifyjs/netify`. "Default" is what you get when you leave the option out, and "Required" means there isn't one. Times are in milliseconds unless a row says otherwise.

## Channels and sockets

### `ChannelOptions`

Taken by every channel. Passed through `childOptions` on servers, `options` on clients and `DatagramBootstrap`, and `channelOptions` on `ReliableBootstrap`. See [How it works](/guide/how-it-works).

| Option            | Type     | Default             | What it does                                   |
| ----------------- | -------- | ------------------- | ---------------------------------------------- |
| `logger`          | `Logger` | `ConsoleLogger`     | Where the channel logs                         |
| `highWaterMark`   | `number` | `65536` (64 KiB)    | Queued bytes at which `isWritable` turns false |
| `lowWaterMark`    | `number` | `32768` (32 KiB)    | Queued bytes it drops below to turn true again |
| `maxPendingBytes` | `number` | `67108864` (64 MiB) | Queued bytes past which writes fail            |

### `SocketOptions`

TCP settings for each connection, plus every `ChannelOptions` field. Passed to `ServerBootstrap.childOptions`. See [TCP](/transports/tcp).

| Option        | Type      | Default | What it does                                                               |
| ------------- | --------- | ------- | -------------------------------------------------------------------------- |
| `noDelay`     | `boolean` | `true`  | Turns Nagle off                                                            |
| `keepAlive`   | `boolean` | `false` | Turns TCP keep alive on                                                    |
| `idleTimeout` | `number`  | `0`     | Silence before the socket closes, rounded up to whole seconds, `0` for off |

### `ServerOptions`

The listening socket. Passed to `ServerBootstrap.options`. See [TCP](/transports/tcp) and [Safety](/scaling/safety).

| Option                     | Type         | Default  | What it does                          |
| -------------------------- | ------------ | -------- | ------------------------------------- |
| `tls`                      | `TLSOptions` | None     | Certificates for TLS                  |
| `reusePort`                | `boolean`    | `false`  | Lets several processes share the port |
| `maxConnections`           | `number`     | No limit | Open connections at once              |
| `maxConnectionsPerAddress` | `number`     | No limit | Open connections from one IP          |

### `ClientOptions`

Client socket settings, plus every `SocketOptions` field. Passed to `Bootstrap.options`.

| Option | Type                    | Default | What it does                                    |
| ------ | ----------------------- | ------- | ----------------------------------------------- |
| `tls`  | `TLSOptions \| boolean` | None    | `true` for Bun's defaults, or your own settings |

### `BindOptions`

Passed to `ServerBootstrap.bind`. Either `TcpBindOptions` or `UnixBindOptions`.

| Option     | Type     | Default     | What it does                           |
| ---------- | -------- | ----------- | -------------------------------------- |
| `hostname` | `string` | `'0.0.0.0'` | Interface to bind                      |
| `port`     | `number` | Required    | Port, `0` for any free port            |
| `unix`     | `string` | Required    | Socket path, in place of the two above |

### `ConnectOptions`

Passed to `Bootstrap.connect`. Either `TcpConnectOptions` or `UnixConnectOptions`.

| Option     | Type     | Default  | What it does                           |
| ---------- | -------- | -------- | -------------------------------------- |
| `hostname` | `string` | Required | Server host name or IP                 |
| `port`     | `number` | Required | Server port                            |
| `unix`     | `string` | Required | Socket path, in place of the two above |

### `ReconnectOptions`

Backoff for `ReconnectingClient`. Bad values throw a `RangeError`.

| Option         | Type     | Default  | What it does                         |
| -------------- | -------- | -------- | ------------------------------------ |
| `initialDelay` | `number` | `100`    | Wait before the first retry          |
| `maxDelay`     | `number` | `30000`  | Longest wait                         |
| `factor`       | `number` | `2`      | Multiplier per attempt, at least `1` |
| `jitter`       | `number` | `0.2`    | Random spread, `0` to `1`            |
| `maxAttempts`  | `number` | No limit | Failures in a row before giving up   |

## Datagrams

See [UDP](/transports/udp).

### `DatagramBindOptions`

Passed to `DatagramBootstrap.bind` and `ReliableBootstrap.bind`.

| Option     | Type     | Default     | What it does                |
| ---------- | -------- | ----------- | --------------------------- |
| `hostname` | `string` | `'0.0.0.0'` | Interface to bind           |
| `port`     | `number` | `0`         | Port, `0` for any free port |

### `DatagramConnectOptions`

Passed to `DatagramBootstrap.connect`, plus every `DatagramBindOptions` field.

| Option           | Type     | Default  | What it does         |
| ---------------- | -------- | -------- | -------------------- |
| `remoteHostname` | `string` | Required | Peer host name or IP |
| `remotePort`     | `number` | Required | Peer port            |

## Codecs

See [Codecs](/guide/codecs). Bad values throw a `RangeError` when the codec is built.

### `DecoderOptions`

Passed to the `ByteToMessageDecoder` constructor. Every built in framing decoder takes these as well.

| Option          | Type      | Default             | What it does                                                         |
| --------------- | --------- | ------------------- | -------------------------------------------------------------------- |
| `maxCumulation` | `number`  | `16777216` (16 MiB) | Bytes held while waiting for a frame                                 |
| `pooled`        | `boolean` | `true`              | Hands frames out from a pool and takes them back after `channelRead` |

### `LengthFieldOptions`

`LengthFieldBasedFrameDecoder`, plus everything in `DecoderOptions`.

| Option                | Type                | Default  | What it does                                 |
| --------------------- | ------------------- | -------- | -------------------------------------------- |
| `maxFrameLength`      | `number`            | Required | Largest frame                                |
| `lengthFieldOffset`   | `number`            | `0`      | Where the length field starts                |
| `lengthFieldLength`   | `LengthFieldLength` | Required | Length field size, `1`, `2`, `3`, `4` or `8` |
| `lengthAdjustment`    | `number`            | `0`      | Added to the length field                    |
| `initialBytesToStrip` | `number`            | `0`      | Bytes cut off the front of a frame           |
| `endian`              | `Endian`            | `'big'`  | Byte order of the length field               |

### `PrependerOptions`

`LengthFieldPrepender`.

| Option                            | Type                | Default  | What it does                   |
| --------------------------------- | ------------------- | -------- | ------------------------------ |
| `lengthFieldLength`               | `LengthFieldLength` | Required | Length field size              |
| `lengthAdjustment`                | `number`            | `0`      | Added to the body length       |
| `lengthIncludesLengthFieldLength` | `boolean`           | `false`  | Counts the field's own bytes   |
| `endian`                          | `Endian`            | `'big'`  | Byte order of the length field |

### `LineOptions`

`LineBasedFrameDecoder`.

| Option           | Type      | Default  | What it does              |
| ---------------- | --------- | -------- | ------------------------- |
| `maxLength`      | `number`  | Required | Longest line              |
| `stripDelimiter` | `boolean` | `true`   | Leaves the LF or CRLF off |

### `DelimiterOptions`

`DelimiterBasedFrameDecoder`. `DelimiterBasedFrameDecoder.nulDelimiter` and `DelimiterBasedFrameDecoder.lineDelimiter` are ready made lists.

| Option           | Type                    | Default  | What it does                    |
| ---------------- | ----------------------- | -------- | ------------------------------- |
| `maxFrameLength` | `number`                | Required | Longest frame                   |
| `delimiters`     | `readonly Uint8Array[]` | Required | Byte sequences that end a frame |
| `stripDelimiter` | `boolean`               | `true`   | Leaves the delimiter off        |

### Fixed length

`new FixedLengthFrameDecoder(frameLength)`.

| Option        | Type     | Default  | What it does        |
| ------------- | -------- | -------- | ------------------- |
| `frameLength` | `number` | Required | Size of every frame |

### String

`new StringDecoder(encoding)`. `StringEncoder` takes nothing and always writes UTF-8.

| Option     | Type       | Default   | What it does                  |
| ---------- | ---------- | --------- | ----------------------------- |
| `encoding` | `Encoding` | `'utf-8'` | Any label `TextDecoder` knows |

### `BinaryCodecOptions`

`BinaryCodec<T>`.

| Option    | Type                                 | Default  | What it does                   |
| --------- | ------------------------------------ | -------- | ------------------------------ |
| `encode`  | `(message: T) => Uint8Array`         | Required | Turns a message into bytes     |
| `decode`  | `(bytes: Uint8Array) => T`           | Required | Turns one frame into a message |
| `accepts` | `(message: unknown) => message is T` | Required | Picks the messages to encode   |

### Protobuf

`new ProtobufCodec<T>(type, accepts)`.

| Option    | Type                                 | Default  | What it does                 |
| --------- | ------------------------------------ | -------- | ---------------------------- |
| `type`    | `ProtobufType`                       | Required | A protobufjs message type    |
| `accepts` | `(message: unknown) => message is T` | Required | Picks the messages to encode |

### MessagePack

`new MessagePackCodec<T>(packer, accepts)`.

| Option    | Type                                 | Default  | What it does                    |
| --------- | ------------------------------------ | -------- | ------------------------------- |
| `packer`  | `MessagePacker`                      | Required | Object with `pack` and `unpack` |
| `accepts` | `(message: unknown) => message is T` | Required | Picks the messages to encode    |

### `HttpDecoderOptions`

`HttpRequestDecoder`, `HttpResponseDecoder`, `HttpServerCodec` and `HttpClientCodec`. See [HTTP](/transports/http).

| Option                 | Type     | Default | What it does                  |
| ---------------------- | -------- | ------- | ----------------------------- |
| `maxInitialLineLength` | `number` | `4096`  | Longest first line in bytes   |
| `maxHeaderSize`        | `number` | `8192`  | Largest header block in bytes |
| `maxChunkSize`         | `number` | `8192`  | Largest piece of a chunk      |

### HTTP aggregator

`new HttpObjectAggregator(maxContentLength)`.

| Option             | Type     | Default  | What it does          |
| ------------------ | -------- | -------- | --------------------- |
| `maxContentLength` | `number` | Required | Largest body in bytes |

### `WebSocketDecoderOptions`

`WebSocketFrameDecoder`. See [WebSocket](/transports/websocket).

| Option                  | Type      | Default          | What it does                    |
| ----------------------- | --------- | ---------------- | ------------------------------- |
| `expectMaskedFrames`    | `boolean` | Required         | `true` on servers               |
| `maxFramePayloadLength` | `number`  | `65536` (64 KiB) | Largest payload, at least `125` |

### `WebSocketEncoderOptions`

`WebSocketFrameEncoder`.

| Option        | Type      | Default  | What it does      |
| ------------- | --------- | -------- | ----------------- |
| `maskPayload` | `boolean` | Required | `true` on clients |

### `WebSocketServerOptions`

`WebSocketServerProtocolHandler`. A string on its own is taken as `path`.

| Option                  | Type                | Default          | What it does              |
| ----------------------- | ------------------- | ---------------- | ------------------------- |
| `path`                  | `string`            | Required         | Path to upgrade on        |
| `subprotocols`          | `readonly string[]` | `[]`             | Subprotocols it agrees to |
| `maxFramePayloadLength` | `number`            | `65536` (64 KiB) | Largest inbound payload   |

### `WebSocketClientOptions`

`WebSocketClientProtocolHandler`. A string on its own is taken as `uri`.

| Option                  | Type                | Default          | What it does                               |
| ----------------------- | ------------------- | ---------------- | ------------------------------------------ |
| `uri`                   | `string`            | Required         | Server URL, `ws`, `wss`, `http` or `https` |
| `subprotocols`          | `readonly string[]` | `[]`             | Subprotocols to ask for, in order          |
| `headers`               | `HttpHeaders`       | Empty            | Extra headers on the upgrade request       |
| `maxFramePayloadLength` | `number`            | `65536` (64 KiB) | Largest inbound payload                    |

## Handlers

See [Handlers](/guide/handlers) and [Safety](/scaling/safety).

### `IdleOptions`

`IdleStateHandler`. A negative value throws a `RangeError`.

| Option       | Type     | Default | What it does                                     |
| ------------ | -------- | ------- | ------------------------------------------------ |
| `readerIdle` | `number` | `0`     | Quiet reads before an event, `0` for off         |
| `writerIdle` | `number` | `0`     | Quiet writes before an event, `0` for off        |
| `allIdle`    | `number` | `0`     | Quiet on both sides before an event, `0` for off |

### Timeouts

`new ReadTimeoutHandler(timeout)` and `new WriteTimeoutHandler(timeout)`. A value that isn't positive and finite, or is above 2147483647 ms, throws a `RangeError`. `IdleStateHandler` has the same upper limit.

| Option    | Type     | Default  | What it does                                       |
| --------- | -------- | -------- | -------------------------------------------------- |
| `timeout` | `number` | Required | Quiet reads, or time for one write, before closing |

### `FlushConsolidationOptions`

`FlushConsolidationHandler`.

| Option                            | Type      | Default | What it does                                       |
| --------------------------------- | --------- | ------- | -------------------------------------------------- |
| `explicitFlushAfterFlushes`       | `number`  | `256`   | Flushes held during a read before one goes through |
| `consolidateWhenNoReadInProgress` | `boolean` | `false` | Also batches flushes outside reads                 |

### `TrafficShapingOptions`

`ChannelTrafficShapingHandler` and `GlobalTrafficShapingHandler`. See [Safety](/scaling/safety#rate-limits).

| Option       | Type     | Default | What it does                                |
| ------------ | -------- | ------- | ------------------------------------------- |
| `readLimit`  | `number` | `0`     | Bytes read a second, `0` for no limit       |
| `writeLimit` | `number` | `0`     | Bytes written a second, `0` for no limit    |
| `maxDelay`   | `number` | `15000` | Longest a single read or write waits, in ms |

### `MetricsOptions`

`MetricsHandler`. See [Metrics](/scaling/metrics).

| Option   | Type      | Default | What it does                      |
| -------- | --------- | ------- | --------------------------------- |
| `timing` | `boolean` | `false` | Times the handlers after this one |

### Logging

`new LoggingHandler(logger)`.

| Option   | Type             | Default             | What it does  |
| -------- | ---------------- | ------------------- | ------------- |
| `logger` | `Logger \| null` | The pipeline logger | Where it logs |

### `OffloadOptions`

`OffloadHandler<I, O>`. See [Workers](/scaling/workers).

| Option        | Type                                 | Default  | What it does                           |
| ------------- | ------------------------------------ | -------- | -------------------------------------- |
| `pool`        | `WorkerPool<I, O>`                   | Required | Threads that do the work               |
| `accepts`     | `(message: unknown) => message is I` | Required | Picks the messages to offload          |
| `maxInFlight` | `number`                             | `16`     | Jobs per connection before reads pause |

## Workers and processes

### `WorkerPoolOptions`

`WorkerPool`. See [Workers](/scaling/workers).

| Option      | Type            | Default      | What it does                         |
| ----------- | --------------- | ------------ | ------------------------------------ |
| `script`    | `string \| URL` | Required     | Script that starts a `WorkerService` |
| `workers`   | `number`        | One per core | Threads to start                     |
| `maxQueued` | `number`        | `1024`       | Jobs in flight across the pool       |

### `WorkerGroupOptions`

`WorkerGroup`. See [Workers](/scaling/workers).

| Option        | Type                               | Default         | What it does                             |
| ------------- | ---------------------------------- | --------------- | ---------------------------------------- |
| `script`      | `string \| URL`                    | Required        | Script each thread runs                  |
| `workers`     | `number`                           | One per core    | Threads to start                         |
| `shared`      | `SharedArrayBuffer`                | None            | Memory every thread can see              |
| `env`         | `Readonly<Record<string, string>>` | None            | Extra environment variables              |
| `argv`        | `readonly string[]`                | `[]`            | Extra arguments at the end of `Bun.argv` |
| `restart`     | `boolean`                          | `true`          | Start dead threads again                 |
| `stopTimeout` | `number`                           | `10000`         | Time a stopping thread gets, in ms       |
| `logger`      | `Logger`                           | `ConsoleLogger` | Hears about dead threads                 |

### `ClusterOptions`

`Cluster`. See [Clustering](/scaling/clustering).

| Option         | Type                               | Default      | What it does                                          |
| -------------- | ---------------------------------- | ------------ | ----------------------------------------------------- |
| `script`       | `string`                           | Required     | Entry file, run with `bun`                            |
| `workers`      | `number`                           | One per core | Processes to start                                    |
| `restart`      | `boolean`                          | `true`       | Restarts workers that exit                            |
| `argv`         | `readonly string[]`                | `[]`         | Arguments after the script path                       |
| `env`          | `Readonly<Record<string, string>>` | None         | Merged over the parent's environment                  |
| `stopTimeout`  | `number`                           | `10000`      | Time a stopping worker gets before it's killed, in ms |
| `readyTimeout` | `number`                           | `10000`      | Time `reload` waits for `Cluster.ready()`, in ms      |

Each worker gets `NETIFY_WORKER`, `NETIFY_WORKERS` and `NETIFY_CLUSTER`, read back with `Cluster.workerId`, `Cluster.workerCount` and `Cluster.clusterId`.

### `ShardLinkOptions`

`ShardLink.open`. See [Sharding](/scaling/sharding).

| Option           | Type                   | Default                      | What it does                                        |
| ---------------- | ---------------------- | ---------------------------- | --------------------------------------------------- |
| `id`             | `number`               | `Cluster.workerId`, or `0`   | This shard                                          |
| `peers`          | `readonly ShardPeer[]` | Unix sockets for the cluster | Every shard's address, by id                        |
| `timeout`        | `number`               | `5000`                       | Time a request waits for its reply, in ms           |
| `handoffTimeout` | `number`               | `30000`                      | Time a handed off player waits to be claimed, in ms |
| `maxMessageSize` | `number`               | `16777216`                   | Biggest frame of messages in bytes                  |

## Reliable UDP

See [Reliable UDP](/transports/reliable). Bad values throw a `RangeError` when the handler is built.

### `ReliableOptions`

`ReliableHandler`.

| Option           | Type                           | Default                        | What it does                                         |
| ---------------- | ------------------------------ | ------------------------------ | ---------------------------------------------------- |
| `role`           | `ReliableRole`                 | Required                       | `'server'` or `'client'`                             |
| `server`         | `PacketAddress`                | Required on clients            | Server to connect to                                 |
| `lanes`          | `readonly LaneOptions[]`       | `ReliableHandler.defaultLanes` | Lanes, the same on both ends, `1` to `127`           |
| `mtu`            | `number`                       | `1200`                         | Largest packet, `256` to `65507`                     |
| `timeout`        | `number`                       | `10000`                        | Silence before a peer is dropped                     |
| `keepalive`      | `number`                       | `1000`                         | Idle time before an empty packet                     |
| `tick`           | `number`                       | `10`                           | How often resends and timeouts run                   |
| `ackDelay`       | `number`                       | `1`                            | Longest a lone ack waits                             |
| `maxPeers`       | `number`                       | `4096`                         | Peers at once                                        |
| `maxMessageSize` | `number`                       | `262144` (256 KiB)             | Largest message after joining fragments              |
| `maxQueuedBytes` | `number`                       | `4194304` (4 MiB)              | Bytes queued per lane before `send` throws           |
| `maxResends`     | `number`                       | `64`                           | Sends of one message before the peer is dropped      |
| `window`         | `number`                       | `1024`                         | Reliable messages in flight per lane, `1` to `16384` |
| `congestion`     | `boolean`                      | `false`                        | Halves the window on loss                            |
| `maxSendRate`    | `number`                       | `0`                            | Bytes a second per peer, `0` for no limit            |
| `encryption`     | `boolean \| EncryptionOptions` | `false`                        | Encrypts data packets on both ends                   |
| `simulate`       | `SimulateOptions`              | Off                            | Fakes loss and lag                                   |

`ReliableHandler.defaultLanes` is `reliable-ordered` on lane 0 and `unreliable` on lane 1.

### `ReliableSettings`

Passed to `ReliableBootstrap.options`. It's `ReliableOptions` minus `role` and `server`, which the bootstrap fills in from `bind` or `connect`. Every field is optional and uses the defaults above.

### `LaneOptions`

| Option     | Type       | Default  | What it does                                                                             |
| ---------- | ---------- | -------- | ---------------------------------------------------------------------------------------- |
| `delivery` | `Delivery` | Required | `'reliable-ordered'`, `'reliable-unordered'`, `'unreliable-sequenced'` or `'unreliable'` |

### `EncryptionOptions`

Passing `true` for `encryption` is the same as passing `{}`.

| Option            | Type         | Default      | What it does                            |
| ----------------- | ------------ | ------------ | --------------------------------------- |
| `keyPair`         | `KeyPair`    | A fresh pair | Own X25519 keys                         |
| `serverPublicKey` | `Uint8Array` | None         | Key a client expects the server to have |

### `SimulateOptions`

Each field falls back to `0` once `simulate` is set.

| Option      | Type     | Default | What it does                            |
| ----------- | -------- | ------- | --------------------------------------- |
| `loss`      | `number` | `0`     | Share of packets dropped, `0` to `1`    |
| `latency`   | `number` | `0`     | Delay added to every packet             |
| `jitter`    | `number` | `0`     | Extra random delay up to this           |
| `duplicate` | `number` | `0`     | Share of packets sent twice, `0` to `1` |

## WebSocket server

See [WebSocket](/transports/websocket).

### `WebSocketBootstrapOptions`

Passed to `WebSocketBootstrap.options`.

| Option                     | Type             | Default             | What it does                                        |
| -------------------------- | ---------------- | ------------------- | --------------------------------------------------- |
| `path`                     | `string`         | Any path            | Only upgrades requests for this path                |
| `tls`                      | `TLSOptions`     | None                | Certificates for `wss`                              |
| `reusePort`                | `boolean`        | `false`             | Lets several processes share the port               |
| `maxConnections`           | `number`         | No limit            | Open connections, extras get a `503`                |
| `maxPayloadLength`         | `number`         | `1048576` (1 MiB)   | Largest message a client can send                   |
| `idleTimeout`              | `number`         | `120`               | Seconds of silence before Bun closes the socket     |
| `backpressureLimit`        | `number`         | `16777216` (16 MiB) | Bytes Bun queues before Netify holds sends          |
| `closeOnBackpressureLimit` | `boolean`        | `false`             | Closes a socket past the limit                      |
| `closeTimeout`             | `number`         | `10000`             | Time a closing socket gets to send its queue, in ms |
| `perMessageDeflate`        | `boolean`        | `false`             | Compresses messages                                 |
| `sendPings`                | `boolean`        | `true`              | Pings idle sockets                                  |
| `upgrade`                  | `UpgradeHandler` | Accepts everyone    | Checks each request before upgrading                |
| `controlFrames`            | `boolean`        | `false`             | Passes pings and pongs to the pipeline              |
| `pooled`                   | `boolean`        | `true`              | Reuses each channel's binary frame                  |

### `WebSocketBindOptions`

Passed to `WebSocketBootstrap.bind`.

| Option     | Type     | Default     | What it does                |
| ---------- | -------- | ----------- | --------------------------- |
| `hostname` | `string` | `'0.0.0.0'` | Interface to bind           |
| `port`     | `number` | Required    | Port, `0` for any free port |

### `UpgradeVerdict`

Returned from the `upgrade` hook. `accept` picks which set of fields applies.

| Option    | Type          | Default  | What it does                                   |
| --------- | ------------- | -------- | ---------------------------------------------- |
| `accept`  | `boolean`     | Required | Lets the client in or turns it away            |
| `data`    | `unknown`     | `null`   | Kept as `WebSocketChannel.data`, when accepted |
| `headers` | `HeadersInit` | None     | Extra headers on the `101`, when accepted      |
| `status`  | `number`      | `403`    | Status to answer with, when refused            |

## Buffers

See [ByteBuf](/guide/bytebuf) and [Games](/scaling/games).

### `QuantizerOptions`

`Quantizer`. Bad values throw a `RangeError`.

| Option | Type     | Default  | What it does                           |
| ------ | -------- | -------- | -------------------------------------- |
| `min`  | `number` | Required | Smallest value, lower ones are clamped |
| `max`  | `number` | Required | Largest value, higher ones are clamped |
| `bits` | `number` | Required | Bit width, `1` to `32`                 |

### `ByteBuf.allocate`

| Option        | Type     | Default             | What it does        |
| ------------- | -------- | ------------------- | ------------------- |
| `capacity`    | `number` | `256`               | Starting size       |
| `maxCapacity` | `number` | `67108864` (64 MiB) | Size it can grow to |

## Internal

These are exported but built by the framework. Every field is required.

### `OutboundOptions`

`OutboundBuffer`, built by `Channel`.

| Option                 | Type                          | Default  | What it does                           |
| ---------------------- | ----------------------------- | -------- | -------------------------------------- |
| `highWaterMark`        | `number`                      | Required | Queued bytes that turn writability off |
| `lowWaterMark`         | `number`                      | Required | Queued bytes that turn it back on      |
| `maxPendingBytes`      | `number`                      | Required | Queued bytes past which writes fail    |
| `onWritabilityChanged` | `(writable: boolean) => void` | Required | Called on each change                  |
| `onSyncRefused`        | `(error: Error) => void`      | None     | Called when a sync write fails         |

### `PeerOptions`

`ReliablePeer`, built by `ReliableHandler` from the resolved `ReliableOptions`.

| Option           | Type                     | Default  | What it does                         |
| ---------------- | ------------------------ | -------- | ------------------------------------ |
| `address`        | `PacketAddress`          | Required | Where its packets go                 |
| `session`        | `number`                 | Required | Session id                           |
| `salt`           | `number`                 | Required | Handshake salt                       |
| `lanes`          | `readonly LaneOptions[]` | Required | Lane settings                        |
| `mtu`            | `number`                 | Required | Largest packet                       |
| `window`         | `number`                 | Required | Reliable messages in flight per lane |
| `keepalive`      | `number`                 | Required | Idle time before an empty packet     |
| `maxMessageSize` | `number`                 | Required | Largest message                      |
| `maxQueuedBytes` | `number`                 | Required | Bytes queued before `send` throws    |
| `maxResends`     | `number`                 | Required | Sends before giving up               |
| `congestion`     | `boolean`                | Required | Congestion control                   |
| `maxSendRate`    | `number`                 | Required | Bytes a second, `0` for no limit     |
