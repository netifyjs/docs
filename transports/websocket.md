---
title: WebSocket server in Bun
description: "Run a WebSocket server on Bun's native WebSocket with Netify handlers, rooms through topics, and an upgrade hook that checks clients first."
---

# WebSocket

There are two ways to run WebSockets. `WebSocketBootstrap` sits on `Bun.serve` and lets Bun do the protocol work natively. The WebSocket codec does it in JavaScript inside a normal TCP pipeline, the way Netty does.

Start with `WebSocketBootstrap`. On echo the two are close. Room broadcasts are about 20 times faster because Bun fans them out itself. You'll want the codec for a WebSocket client, a handler below the framing, or sharing a port with an existing HTTP pipeline.

## The native server

```ts twoslash
import {
  InboundHandlerAdapter,
  TextWebSocketFrame,
  WebSocketBootstrap,
  type HandlerContext,
  type WebSocketChannel,
} from '@netifyjs/netify'

/**
 * Sends text back with a prefix
 * @class
 */
class EchoHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Echoes text frames
   * @param context where the echo goes
   * @param message a frame from the client
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (!(message instanceof TextWebSocketFrame)) return

    context.writeAndFlushSync(`echo: ${message.text()}`)
  }
}

const server = await new WebSocketBootstrap()
  .options({ path: '/play', maxPayloadLength: 64 * 1024 })
  .childHandler((channel: WebSocketChannel): void => {
    channel.pipeline.addLast<EchoHandler>('echo', new EchoHandler())
  })
  .bind({ port: 8080 })

console.log(`ws://localhost:${String(server.port)}/play`)
```

Bun has already handled the upgrade, framing and pings, and your handlers get whole messages as `TextWebSocketFrame` or `BinaryWebSocketFrame`. For text, write a string or a text frame. For binary, write a `Uint8Array`, a `ByteBuf` or a binary frame. There's rarely anything to wait for, which makes `writeAndFlushSync` the usual pick.

Set `path`, and lower `maxPayloadLength` from its 1 MiB default to your largest expected message. The other settings are in [`WebSocketBootstrapOptions`](/reference/options#websocketbootstrapoptions).

A channel reuses one `BinaryWebSocketFrame` for all its binary messages. After `channelRead` returns, the next one arrives in the same object with new content. To keep a message, call `retain()` on its `content` and the channel switches to a fresh frame. `pooled: false` turns reuse off. See [Pooled frames](/guide/bytebuf#pooled-frames).

### Checking a client before it gets in

The `upgrade` hook sees the HTTP request before Bun creates the socket. Turn a client away here and it never gets a channel, so unauthenticated connections don't reach your pipeline.

```ts twoslash
import {
  InboundHandlerAdapter,
  WebSocketBootstrap,
  WebSocketChannel,
  WebSocketHandshakeComplete,
  type HandlerContext,
  type UpgradeVerdict,
} from '@netifyjs/netify'

/**
 * A signed in player
 */
type Player = {
  /**
   * The player's name
   */
  readonly name: string
}

/**
 * Greets the player by name
 * @class
 */
class GreetHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Says hello once the socket is up
   * @param context the player's context
   * @param event a user event
   */
  public override userEventTriggered(
    context: HandlerContext,
    event: unknown,
  ): void {
    if (!(event instanceof WebSocketHandshakeComplete)) return
    if (!(context.channel instanceof WebSocketChannel)) return

    const player = context.channel.data as Player
    context.writeAndFlushSync(`hello ${player.name}`)
  }
}

/**
 * Lets in requests with a known token
 * @param request the upgrade request
 */
const authenticate = (request: Request): UpgradeVerdict => {
  const token = new URL(request.url).searchParams.get('token')
  if (token !== 'secret') return { accept: false, status: 401 }

  return { accept: true, data: { name: 'alice' } }
}

await new WebSocketBootstrap()
  .options({ path: '/play', upgrade: authenticate })
  .childHandler((channel: WebSocketChannel): void => {
    channel.pipeline.addLast<GreetHandler>('greet', new GreetHandler())
  })
  .bind({ port: 8080 })
```

Whatever you return as `data` ends up on `channel.data`. The hook can be async. If it throws, the client gets a 500.

`WebSocketHandshakeComplete` fires once the socket is open and your setup has run. It carries the `uri`, the request `headers` and the agreed `subprotocol`. The codec fires the same event, and handlers that wait for it work on both servers.

### Rooms

Rooms are Bun's pub/sub topics. A channel joins with `subscribe`, and one `publish` reaches every subscriber natively.

```ts twoslash
import {
  InboundHandlerAdapter,
  TextWebSocketFrame,
  WebSocketBootstrap,
  WebSocketChannel,
  WebSocketHandshakeComplete,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Puts each player in the lobby and relays chat
 * @class
 */
class LobbyHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Joins the lobby once the socket is up
   * @param context the player's context
   * @param event a user event
   */
  public override userEventTriggered(
    context: HandlerContext,
    event: unknown,
  ): void {
    if (!(event instanceof WebSocketHandshakeComplete)) return
    if (context.channel instanceof WebSocketChannel) {
      context.channel.subscribe('lobby')
    }
  }

  /**
   * Relays chat to the rest of the lobby
   * @param context the player's context
   * @param message a frame
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (!(message instanceof TextWebSocketFrame)) return
    if (context.channel instanceof WebSocketChannel) {
      context.channel.publish('lobby', message.text())
    }
  }
}

const server = await new WebSocketBootstrap()
  .options({ path: '/play' })
  .childHandler((channel: WebSocketChannel): void => {
    channel.pipeline.addLast<LobbyHandler>('lobby', new LobbyHandler())
  })
  .bind({ port: 8080 })

setInterval((): void => {
  server.publish('lobby', `${String(server.subscriberCount('lobby'))} online`)
}, 5000)
```

`channel.publish` skips the sender. `server.publish` reaches everyone. Published messages skip the pipelines on both sides, so your encoders won't run on them. Publish a string or bytes you've already encoded. Closed channels leave their topics on their own.

### Slow clients

If a client reads slowly, Bun's queue for that socket grows past `backpressureLimit`. Netify then queues further sends itself, in order, and hands them to Bun as the socket drains. While that's happening `channel.isWritable` is false and `channelWritabilityChanged` fires, as on [TCP](/transports/tcp). A handler can hold off sending until it clears.

`channel.close()` and `server.close()` send what's queued, then close with code 1000. `server.close()` waits up to 10 seconds for slow clients, or whatever timeout you give it. After `channel.close()`, a client that isn't reading gets `closeTimeout` (10 seconds by default) before the socket is cut.

Netify's queue tops out at `maxPendingBytes` in `childOptions`, 64 MiB by default. Sends past that fail with `Write queue is full`. To drop slow clients instead of buffering for them, set `closeOnBackpressureLimit`.

### What Bun handles for you

Bun owns the socket, and a few things differ from Netty because of it:

- The pipeline starts at whole messages. Nothing sits below the framing, and you'll never see a `ContinuationWebSocketFrame`.
- Bun answers pings itself. `controlFrames: true` only lets you see them.
- Reads can't be paused.
- `remotePort` is always 0 because Bun doesn't expose it.

Prefer writing strings to `TextWebSocketFrame`s. Bun's `sendText` takes a string and the frame holds bytes, which costs a decode.

`WebSocketBootstrap` is server only. For a client, use Bun's built in `WebSocket` or the codec below.

## The WebSocket codec

The codec runs on a `ServerBootstrap`. The pipeline starts out speaking HTTP. When an upgrade request comes in, the protocol handler does the handshake and swaps the HTTP handlers for frame codecs.

```ts twoslash
import {
  HttpObjectAggregator,
  HttpServerCodec,
  InboundHandlerAdapter,
  ServerBootstrap,
  TextWebSocketFrame,
  WebSocketServerProtocolHandler,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Bounces text frames back
 * @class
 */
class EchoHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Echoes text frames
   * @param context where the echo goes
   * @param message a frame from the client
   */
  public override async channelRead(
    context: HandlerContext,
    message: unknown,
  ): Promise<void> {
    if (!(message instanceof TextWebSocketFrame)) return

    await context.writeAndFlush(
      new TextWebSocketFrame(`echo: ${message.text()}`),
    )
  }
}

await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addLast<HttpServerCodec>('codec', new HttpServerCodec())
      .addLast<HttpObjectAggregator>(
        'aggregator',
        new HttpObjectAggregator(64 * 1024),
      )
      .addLast<WebSocketServerProtocolHandler>(
        'websocket',
        new WebSocketServerProtocolHandler({
          path: '/echo',
          subprotocols: ['game.v1'],
          maxFramePayloadLength: 64 * 1024,
        }),
      )
      .addLast<EchoHandler>('echo', new EchoHandler())
  })
  .bind({ port: 8080 })
```

Other paths carry on down the pipeline as plain HTTP, which lets one port serve both. After the upgrade, the protocol handler answers pings and close frames, closes with 1007 on bad UTF-8, and your handlers get text, binary and continuation frames. A frame over `maxFramePayloadLength` closes the connection with code 1009.

Fragmented messages aren't joined for you. If a client splits one, the first frame has `finalFragment` false, followed by `ContinuationWebSocketFrame`s until one has it set.

### A client

`WebSocketClientProtocolHandler` sends the upgrade request as soon as the TCP channel is active.

```ts twoslash
import {
  Bootstrap,
  HttpClientCodec,
  HttpObjectAggregator,
  InboundHandlerAdapter,
  TextWebSocketFrame,
  WebSocketClientProtocolHandler,
  WebSocketHandshakeComplete,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Says hello once the upgrade is done
 * @class
 */
class HelloHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Sends the greeting after the handshake
   * @param context where the greeting goes
   * @param event the user event
   */
  public override async userEventTriggered(
    context: HandlerContext,
    event: unknown,
  ): Promise<void> {
    if (!(event instanceof WebSocketHandshakeComplete)) {
      await context.fireUserEventTriggered(event)
      return
    }

    await context.writeAndFlush(new TextWebSocketFrame('hello'))
  }

  /**
   * Prints what comes back
   * @param context unused
   * @param message a frame from the server
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (message instanceof TextWebSocketFrame) console.log(message.text())
  }
}

await new Bootstrap()
  .handler((channel: Channel): void => {
    channel.pipeline
      .addLast<HttpClientCodec>('codec', new HttpClientCodec())
      .addLast<HttpObjectAggregator>(
        'aggregator',
        new HttpObjectAggregator(64 * 1024),
      )
      .addLast<WebSocketClientProtocolHandler>(
        'websocket',
        new WebSocketClientProtocolHandler('ws://127.0.0.1:8080/echo'),
      )
      .addLast<HelloHandler>('hello', new HelloHandler())
  })
  .connect({ hostname: '127.0.0.1', port: 8080 })
```

Two things catch people out. First, the URL only builds the upgrade request. It doesn't pick the host or turn on TLS. Connect the bootstrap to the right address yourself, and set `tls` for a `wss` server. Second, you can't send anything before `WebSocketHandshakeComplete`, because the frame codecs only join the pipeline then.

For auth headers or subprotocols, pass an options object instead of the URL. The protocol handlers and frame classes are in the [API](/reference/api#websocket-codecs), and their options are in [`WebSocketClientOptions`](/reference/options#websocketclientoptions).
