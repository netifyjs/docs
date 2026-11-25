---
title: Migrating from node:net to Bun
description: 'Replace a node:net TCP server with Netify on Bun. Data events, hand rolled framing, timeouts and clients mapped to pipelines, codecs and handlers.'
---

# From node:net

A `node:net` server gives you a `data` event with whatever came off the socket. That might be half a message or three of them, and you write the code that stitches them back together. Netify puts a [codec](/guide/codecs) in front of your handler, and the handler gets one whole message per call.

## What maps to what

| node:net                | Netify                               |
| ----------------------- | ------------------------------------ |
| `net.createServer()`    | `new ServerBootstrap()`              |
| `server.listen(port)`   | `.bind({ port })`                    |
| `socket.on('data')`     | `channelRead`, after a frame decoder |
| `socket.write(data)`    | `context.writeAndFlush(data)`        |
| `socket.on('close')`    | `channelInactive`                    |
| `socket.on('error')`    | `exceptionCaught`                    |
| `socket.setTimeout(ms)` | `IdleStateHandler`                   |
| `socket.end()`          | `context.close()`                    |
| `net.connect(port)`     | `new Bootstrap().connect({ port })`  |
| `node:cluster`          | [`Cluster`](/scaling/clustering)     |

## A length prefixed server

The usual `node:net` version, with a two byte length in front of each message:

```ts
net
  .createServer((socket) => {
    let pending = Buffer.alloc(0)

    socket.on('data', (chunk) => {
      pending = Buffer.concat([pending, chunk])

      while (pending.length >= 2) {
        const length = pending.readUInt16BE(0)
        if (pending.length < 2 + length) break

        const message = pending.subarray(2, 2 + length)
        pending = pending.subarray(2 + length)
        handle(socket, message)
      }
    })
  })
  .listen(9000)
```

In Netify, `LengthFieldBasedFrameDecoder` does the buffering, and `LengthFieldPrepender` adds the length on the way out.

```ts twoslash
import {
  ByteBuf,
  IdleStateEvent,
  IdleStateHandler,
  LengthFieldBasedFrameDecoder,
  LengthFieldPrepender,
  ServerBootstrap,
  SimpleInboundHandler,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Answers each message and drops quiet clients
 * @class
 */
class MessageHandler extends SimpleInboundHandler<ByteBuf> {
  /**
   * Takes whole frames
   * @param message whatever the decoder passed on
   */
  protected override accepts(message: unknown): message is ByteBuf {
    return message instanceof ByteBuf
  }

  /**
   * Replies with the size
   * @param context the connection
   * @param message one message, without its length
   */
  protected override messageReceived(
    context: HandlerContext,
    message: ByteBuf,
  ): void {
    context.writeAndFlushSync(
      ByteBuf.fromString(`got ${String(message.readableBytes)} bytes`),
    )
  }

  /**
   * Hangs up on clients that go quiet
   * @param context the connection
   * @param event a user event
   */
  public override async userEventTriggered(
    context: HandlerContext,
    event: unknown,
  ): Promise<void> {
    if (event instanceof IdleStateEvent) await context.close()
  }
}

await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addLast<IdleStateHandler>(
        'idle',
        new IdleStateHandler({ readerIdle: 30_000 }),
      )
      .addLast<LengthFieldBasedFrameDecoder>(
        'decoder',
        new LengthFieldBasedFrameDecoder({
          maxFrameLength: 4096,
          lengthFieldLength: 2,
          initialBytesToStrip: 2,
        }),
      )
      .addLast<LengthFieldPrepender>(
        'prepender',
        new LengthFieldPrepender({ lengthFieldLength: 2 }),
      )
      .addLast<MessageHandler>('messages', new MessageHandler())
  })
  .bind({ port: 9000 })
```

`maxFrameLength` matters. The hand written version above buffers forever if a client claims a 60 KB message and never sends it. The decoder rejects anything over the limit and sends a `DecoderError` to `exceptionCaught`.

Line based and delimited protocols work the same way with `LineBasedFrameDecoder` and `DelimiterBasedFrameDecoder`. [Your first server](/guide/first-server#lines-of-text) has a line example.

## Clients

`Bootstrap` builds client connections with the same pipelines. For a client that comes back after the server restarts, `ReconnectingClient` retries with backoff. [TCP](/transports/tcp) covers both.

## Things to know

- Netify runs on Bun, on `Bun.listen` and `Bun.connect`. It doesn't run on Node.
- TLS is a bind option, not a separate `tls` module. [TCP](/transports/tcp) shows the settings.
- Unix sockets use the same bootstraps with a `unix` path.
- There's no `pause()`. Reads stop on their own while a connection's handlers are behind, and start again once they catch up.
