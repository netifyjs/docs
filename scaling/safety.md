---
title: Safety limits
description: 'Set frame sizes, buffered bytes, connection counts and timeouts before a Netify server goes public.'
---

# Safety limits

Every buffer Netify keeps for a client has a cap, but most defaults are high to stay out of your way while you develop. If your inputs are 200 bytes, there's no reason to accept a 16 MiB frame. Before going public, set the limits in this example to what your protocol needs.

```ts twoslash
import {
  DecoderError,
  InboundHandlerAdapter,
  LengthFieldBasedFrameDecoder,
  ReadTimeoutHandler,
  ServerBootstrap,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Hangs up on clients that send bad frames
 * @class
 */
class GuardHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Closes on any decoder error
   * @param context the connection
   * @param error what went wrong
   */
  public override exceptionCaught(
    context: HandlerContext,
    error: unknown,
  ): Promise<void> {
    if (error instanceof DecoderError) return context.close()

    return context.fireExceptionCaught(error)
  }
}

await new ServerBootstrap()
  .options({ maxConnections: 10_000, maxConnectionsPerAddress: 8 })
  .childOptions({
    maxPendingBytes: 1024 * 1024,
    highWaterMark: 64 * 1024,
    lowWaterMark: 32 * 1024,
  })
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addLast<ReadTimeoutHandler>('timeout', new ReadTimeoutHandler(30_000))
      .addLast<LengthFieldBasedFrameDecoder>(
        'framer',
        new LengthFieldBasedFrameDecoder({
          maxFrameLength: 4096,
          lengthFieldLength: 2,
          initialBytesToStrip: 2,
        }),
      )
      .addLast<GuardHandler>('guard', new GuardHandler())
  })
  .bind({ port: 7000 })
```

The frame limit matters most. Set `maxFrameLength` to the largest message your protocol can legitimately send, plus a bit of margin. A frame over the limit gets skipped. The decoder throws `Frame is too large` and carries on with the next frame.

::: warning
A decoder error doesn't close the connection. It goes to `exceptionCaught`. If nothing handles it, the tail of the pipeline logs `Error was not handled` and the client stays connected. Add a handler like `GuardHandler` that closes on `DecoderError`.
:::

Once `maxConnections` or `maxConnectionsPerAddress` is reached, new sockets get closed as they arrive. Both count per process. A [cluster](/scaling/clustering) of 4 allows four times as many. Give the per address limit some headroom. Everyone behind the same NAT shares one address, and with a limit of 1, one person in an office locks out the rest.

`ReadTimeoutHandler` closes a connection that's silent for 30 seconds. If your protocol should keep talking, use `IdleStateHandler` instead and decide for yourself. A common pattern is to ping the first time a connection goes quiet and close it the second time.

## Slow readers

The write queue limits cover a client that stops reading while you keep sending. Crossing `highWaterMark` only flips `channel.isWritable` to false and fires `channelWritabilityChanged`. It's up to your handler to stop sending or drop the client. `maxPendingBytes` is the hard cap. Writes past it fail with `Write queue is full`. A promise write rejects, and a sync write calls `exceptionCaught`.

The default hard cap is 64 MiB per channel. In a game, a client that stops reading has usually lost its connection, and a cap of a few snapshots catches them much sooner.

## Rate limits

`ChannelTrafficShapingHandler` holds each connection to a number of bytes a second in each direction. Messages over the limit wait their turn and go out in order. If the connection closes first, they fail with `Channel is closed`. On TCP the socket stops being read until it catches up. `GlobalTrafficShapingHandler` does the same with one limit shared by every connection it's added to. That stops one busy shard from taking more than its share of the link.

```ts twoslash
import {
  ChannelTrafficShapingHandler,
  GlobalTrafficShapingHandler,
  ServerBootstrap,
  type Channel,
} from '@netifyjs/netify'

const server = new GlobalTrafficShapingHandler({ writeLimit: 50_000_000 })

await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addLast<GlobalTrafficShapingHandler>('server', server)
      .addLast<ChannelTrafficShapingHandler>(
        'player',
        new ChannelTrafficShapingHandler({ readLimit: 16_000 }),
      )
  })
  .bind({ port: 7000 })
```

Create a new `ChannelTrafficShapingHandler` per connection and share one `GlobalTrafficShapingHandler` across all of them. Put both first, where reads are still raw bytes and writes are already encoded. A single wait is capped at `maxDelay`, 15 seconds by default. Writes made with `writeEncoded` or `ChannelGroup.broadcastSync` skip the pipeline and don't get shaped. On UDP one channel carries every peer, which means the limit covers the whole socket.

## Timeouts in seconds and milliseconds

The TCP `idleTimeout` in `childOptions` is in milliseconds, rounded up to whole seconds. On `WebSocketBootstrap`, `idleTimeout` is in seconds because it goes straight to Bun. The timeout handlers are under [Timeouts](/reference/options#timeouts) and [`IdleOptions`](/reference/options#idleoptions).

## HTTP and WebSocket

`HttpObjectAggregator` has no default limit, so you have to pick one. A body past it gets a `413` and the rest is skipped. In front of the JavaScript WebSocket protocol handler, keep the limit small, because an upgrade request has almost no body. The decoder limits are under [`HttpDecoderOptions`](/reference/options#httpdecoderoptions).

On the native `WebSocketBootstrap`, lower `maxPayloadLength` from its 1 MiB default. Use the `upgrade` hook to turn clients away before they get a socket.

```ts twoslash
import {
  InboundHandlerAdapter,
  WebSocketBootstrap,
  WebSocketChannel,
  type HandlerContext,
  type UpgradeVerdict,
} from '@netifyjs/netify'

/**
 * Looks a session token up
 * @param token what the client sent
 */
const findUser = (token: string | null): string | null =>
  token === 'secret' ? 'alice' : null

/**
 * Greets the logged in user
 * @class
 */
class HelloHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Reads the user the hook attached
   * @param context the connection
   */
  public override channelActive(context: HandlerContext): void {
    if (context.channel instanceof WebSocketChannel) {
      console.log(`${String(context.channel.data)} joined`)
    }
  }
}

await new WebSocketBootstrap()
  .options({
    path: '/play',
    maxPayloadLength: 4096,
    maxConnections: 20_000,
    upgrade: (request: Request): UpgradeVerdict => {
      const token = new URL(request.url).searchParams.get('token')
      const user = findUser(token)

      return user === null
        ? { accept: false, status: 401 }
        : { accept: true, data: user }
    },
  })
  .childHandler((channel: WebSocketChannel): void => {
    channel.pipeline.addLast<HelloHandler>('hello', new HelloHandler())
  })
  .bind({ port: 8080 })
```

The hook runs on the HTTP request before any channel exists. A refusal gets its `status` as the response, or `403` if it has none. A hook that throws gives a `500`. Whatever you put in `data` shows up as `channel.data`. The other options, `backpressureLimit` among them, are under [`WebSocketBootstrapOptions`](/reference/options#websocketbootstrapoptions).

## Reliable UDP

Anyone can send a UDP packet that claims to come from any address. Reliable UDP has two protections against that, and you can't turn them off.

First, a new connect gets a challenge back with a cookie tied to the sender's address. Only a client that returns the cookie becomes a peer. The server stores nothing until then, and a flood of forged connects costs one small reply each.

Second, connect packets are padded to 64 bytes and shorter ones are ignored. The challenge is only 29 bytes. That way the server can't be used to amplify traffic at someone else.

The default `maxPeers` is 4096. Set it to the number of players you expect. With `encryption` on, have clients pin the server's key with `serverPublicKey`. That stops anyone in the middle posing as the server. [Reliable UDP](/transports/reliable) covers encryption, and the rest of the limits are under [`ReliableOptions`](/reference/options#reliableoptions).

## Checking what clients send

None of these limits catch a well formed frame full of nonsense. Check every field before it touches your state: positions inside the map, speeds under the limit, numbers that are finite. The handler on [Game servers](/scaling/games) clamps movement like this.
