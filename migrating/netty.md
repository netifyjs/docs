---
title: Migrating from Netty to Bun
description: 'Netify brings Netty channels, pipelines, handlers and codecs to Bun and TypeScript. The class names, what changed and how to port a handler.'
---

# From Netty

Netify keeps Netty's model. A connection is a channel, the channel has a pipeline, and handlers in the pipeline see every read, write and state change. If you've written a Netty server, you already know how a Netify one fits together.

## Names

Most class names carry over. Here's what changed:

| Netty                           | Netify                      |
| ------------------------------- | --------------------------- |
| `ChannelPipeline`               | `Pipeline`                  |
| `ChannelHandlerContext`         | `HandlerContext`            |
| `ChannelInboundHandlerAdapter`  | `InboundHandlerAdapter`     |
| `ChannelOutboundHandlerAdapter` | `OutboundHandlerAdapter`    |
| `ChannelDuplexHandler`          | `DuplexHandlerAdapter`      |
| `SimpleChannelInboundHandler`   | `SimpleInboundHandler`      |
| `ChannelFuture`                 | `Promise<void>`             |
| `EventLoop`                     | Each channel's `EventQueue` |

`ServerBootstrap`, `Bootstrap`, `ChannelInitializer`, `ChannelGroup`, `ByteBuf`, `AttributeKey`, `IdleStateHandler` and the frame decoders keep their Netty names.

## A handler, side by side

A Netty echo server:

```java
public class EchoHandler extends ChannelInboundHandlerAdapter {
  @Override
  public void channelRead(ChannelHandlerContext ctx, Object msg) {
    ctx.write(msg);
  }

  @Override
  public void channelReadComplete(ChannelHandlerContext ctx) {
    ctx.flush();
  }
}

new ServerBootstrap()
  .group(boss, workers)
  .channel(NioServerSocketChannel.class)
  .childHandler(new ChannelInitializer<SocketChannel>() {
    @Override
    public void initChannel(SocketChannel ch) {
      ch.pipeline()
        .addLast(new LengthFieldBasedFrameDecoder(4096, 0, 2, 0, 2))
        .addLast(new LengthFieldPrepender(2))
        .addLast(new EchoHandler());
    }
  })
  .bind(9000).sync();
```

The same server in Netify:

```ts twoslash
import {
  InboundHandlerAdapter,
  LengthFieldBasedFrameDecoder,
  LengthFieldPrepender,
  ServerBootstrap,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Bounces each frame back
 * @class
 */
class EchoHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Queues the frame
   * @param context the connection
   * @param message one whole frame
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    context.writeSync(message)
  }

  /**
   * Sends the batch
   * @param context the connection
   */
  public override channelReadComplete(context: HandlerContext): Promise<void> {
    return context.flush()
  }
}

await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline
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
      .addLast<EchoHandler>('echo', new EchoHandler())
  })
  .bind({ port: 9000 })
```

Worth noticing:

- There's no `group` or `channel` call. Bun owns the event loop and the socket type comes from the bootstrap.
- Codecs take an options object in place of positional arguments.
- Every handler gets a name, like Netty's `addLast(name, handler)` overload.
- `bind` returns a promise, so there's no `sync()`.

## Threads

Bun runs your code on one thread, which is why event loop groups are gone. Each channel keeps its own events in order through its `EventQueue`. For more cores, use [`Cluster`](/scaling/clustering) for processes or [`WorkerGroup`](/scaling/workers) for threads.

Nothing needs to be thread safe inside one process. A `Map` shared by every handler is fine.

## Async handlers

Handlers can be `async`. If `channelRead` awaits a database call, the next message on that connection waits for it. Other connections carry on. In Netty you'd hand that work to another executor to keep the event loop free.

Synchronous handlers pay nothing for this. [How it works](/guide/how-it-works#the-event-queue) explains why.

## Writes

`write`, `flush` and `writeAndFlush` work as in Netty and return a promise in place of a `ChannelFuture`. When you don't need to know the write finished, `writeSync` and `writeAndFlushSync` skip the promise. Errors still reach `exceptionCaught`.

## Buffers

Buffers are garbage collected. Ignore `retain` and `release` until you keep a decoded frame past `channelRead`, because decoders reuse frame objects. [Pooled frames](/guide/bytebuf#pooled-frames) shows how to keep one safely.

There's no direct and heap split. Every `ByteBuf` wraps a `Uint8Array`.

## Closing

One thing catches Netty users out: closing a channel doesn't call `handlerRemoved`. Put per connection cleanup in `channelInactive`.

## What else is there

Netify adds a few things Netty leaves to you. [Reliable UDP](/transports/reliable) gives games ordered and unordered lanes over one socket. [`WebSocketBootstrap`](/transports/websocket) runs WebSocket on Bun's native server, with rooms through topics. [`ShardLink`](/scaling/sharding) links processes for a game world split across cores.
