---
title: Your first TCP server in Bun
description: 'Build a TCP echo server and client in Bun with Netify, then change the server to read lines of text.'
---

# Your first server

Start with a TCP echo server, then add a client and switch to lines of text.

::: code-group

```ts twoslash [server.ts]
import {
  InboundHandlerAdapter,
  ServerBootstrap,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Sends back whatever bytes it gets
 * @class
 */
class EchoServerHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Queues the bytes to go back
   * @param context The handler context
   * @param message The bytes
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    void context.write(message)
  }

  /**
   * Sends everything queued so far
   * @param context The handler context
   */
  public override channelReadComplete(context: HandlerContext): Promise<void> {
    return context.flush()
  }

  /**
   * Logs the error and hangs up
   * @param context The handler context
   * @param error The error
   */
  public override exceptionCaught(
    context: HandlerContext,
    error: unknown,
  ): void {
    console.error(error)
    void context.close()
  }
}

const server = await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline.addLast<EchoServerHandler>('echo', new EchoServerHandler())
  })
  .bind({ hostname: '127.0.0.1', port: 9000 })

console.log(`Echo server on ${String(server.port)}`)
```

:::

```sh
bun server.ts
nc localhost 9000
```

Type into `nc` and it comes straight back.

The function you pass to `childHandler` builds the pipeline for each accepted connection, with a fresh `EchoServerHandler` every time. Once a handler keeps per-connection state, a shared instance would mix that state up between clients. Create handlers inside the setup function unless you know they're stateless.

`InboundHandlerAdapter` passes every event along, and you override the ones you care about. At the front of a TCP pipeline, `channelRead` gets a `ByteBuf` of whatever came off the socket. The handler writes it straight back, since the socket end takes `ByteBuf` and `Uint8Array` as is.

`write` only queues. Nothing hits the socket until a flush. `channelReadComplete` runs once after all the reads from one socket chunk, and flushing there sends every reply in one socket write. Most handlers use this write then flush pattern. [How it works](./how-it-works#writing) explains the batching.

Give your last handler an `exceptionCaught`. Errors from any handler end up there. Without one they get logged and the connection stays open.

`bind` resolves once the socket is listening. In tests, pass `port: 0` to get a free port from the OS and read it back from `server.port`. Leave out `hostname` to listen on every interface.

## A client

`Bootstrap` is the client. It works like the server, but the setup function goes to `handler` and you call `connect`.

::: code-group

```ts twoslash [client.ts]
import {
  Bootstrap,
  ByteBuf,
  InboundHandlerAdapter,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Says hello and waits for the echo
 * @class
 */
class EchoClientHandler extends InboundHandlerAdapter<unknown> {
  /**
   * The echoed text
   */
  public readonly reply: Promise<string>

  /**
   * Resolves the reply
   */
  private readonly replying: PromiseWithResolvers<string>

  /**
   * Creates the handler
   */
  public constructor() {
    super()

    this.replying = Promise.withResolvers<string>()
    this.reply = this.replying.promise
  }

  /**
   * Sends the greeting
   * @param context The handler context
   */
  public override channelActive(context: HandlerContext): void {
    void context.writeAndFlush(ByteBuf.fromString('Hello, netify'))
  }

  /**
   * Takes the first reply
   * @param context The handler context
   * @param message The bytes
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (message instanceof ByteBuf) this.replying.resolve(message.toString())
  }
}

const client = new EchoClientHandler()
const channel = await new Bootstrap()
  .handler((child: Channel): void => {
    child.pipeline.addLast<EchoClientHandler>('client', client)
  })
  .connect({ hostname: '127.0.0.1', port: 9000 })

console.log(`Reply: ${await client.reply}`)
await channel.close()
```

:::

`channelActive` fires once the connection is up and the pipeline is built, which makes it a good spot for a greeting or handshake. `writeAndFlush` is `write` plus `flush`, handy for a one-off message like this.

If nothing's listening, `connect` rejects with the socket error in `cause`.

## Closing

`channel.close()` hangs up one connection. `server.close()` stops listening and closes every open connection. It resolves after the last one has closed.

```ts twoslash
import { ServerBootstrap, type Channel } from '@netifyjs/netify'

const server = await new ServerBootstrap()
  .childHandler((channel: Channel): void => {})
  .bind({ port: 0 })
// ---cut---
await server.close()
await server.closed
```

`close()` resolves as soon as the socket's been told to end, before `channelInactive` runs. If you need cleanup to be finished, say in a test that checks it, await `closed` too.

::: warning
Writes still queued when a channel closes are rejected. If the last message matters, await its `writeAndFlush` before you close.
:::

## Lines of text

TCP doesn't keep message boundaries. If a client sends `hello\n` then `world\n`, you might get one read, two, or `hello\nwor` followed by `ld\n`. The echo server doesn't care, but nearly every real protocol does. Codecs fix this, and they go in the pipeline ahead of your handler.

::: code-group

```ts twoslash [server.ts]
import {
  LineBasedFrameDecoder,
  ServerBootstrap,
  SimpleInboundHandler,
  StringDecoder,
  StringEncoder,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Shouts each line back
 * @class
 */
class ShoutHandler extends SimpleInboundHandler<string> {
  /**
   * Takes strings
   * @param message The message
   */
  protected override accepts(message: unknown): message is string {
    return typeof message === 'string'
  }

  /**
   * Sends the line back in capitals
   * @param context The handler context
   * @param line The line
   */
  protected override messageReceived(
    context: HandlerContext,
    line: string,
  ): void {
    void context.writeAndFlush(`${line.toUpperCase()}\n`)
  }
}

const server = await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addLast<LineBasedFrameDecoder>(
        'framer',
        new LineBasedFrameDecoder({ maxLength: 1024 }),
      )
      .addLast<StringDecoder>('decoder', new StringDecoder())
      .addLast<StringEncoder>('encoder', new StringEncoder())
      .addLast<ShoutHandler>('shout', new ShoutHandler())
  })
  .bind({ port: 9000 })
```

:::

`LineBasedFrameDecoder` holds bytes until it has a whole line. `StringDecoder` turns that line into a `string`, and `StringEncoder` turns the strings you write back into bytes. Your handler sees one `string` per line.

Reads run top to bottom, from the framer down to `ShoutHandler`. Writes go the other way. The string `ShoutHandler` writes passes back through `StringEncoder` on its way out, which is why the encoder goes before the handler that writes. Put it after and your writes skip it, and the socket end rejects a raw `string`.

Most handlers that sit after a decoder should extend `SimpleInboundHandler`. Messages that match `accepts` arrive in `messageReceived` already typed. Anything else carries on down the pipeline.

The framer strips the line ending, which is why the reply adds `\n` back. Always set `maxLength`, or a client that never sends a newline makes the server buffer forever. An overlong line gets dropped and a `DecoderError` lands in `exceptionCaught`, where closing the connection is usually right. [Safety limits](/scaling/safety) covers the other caps.

::: tip
Prefer pipeline setup in a class? Pass `new ChannelInitializer<Channel>(setup)` to `childHandler`. It behaves the same as the function.
:::

## Talking to everyone

A `ChannelGroup` holds a set of channels and writes to all of them in one call. Closed channels drop out on their own. This handler relays each line to everyone else in a chat room.

```ts twoslash
import {
  ChannelGroup,
  SimpleInboundHandler,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Passes each line on to everyone else
 * @class
 */
export class ChatHandler extends SimpleInboundHandler<string> {
  /**
   * Everyone connected
   */
  private readonly room: ChannelGroup

  /**
   * Creates the handler
   * @param room The room
   */
  public constructor(room: ChannelGroup) {
    super()

    this.room = room
  }

  /**
   * Adds the newcomer to the room
   * @param context The handler context
   */
  public override channelActive(context: HandlerContext): void {
    this.room.add(context.channel)
  }

  /**
   * Takes strings
   * @param message The message
   */
  protected override accepts(message: unknown): message is string {
    return typeof message === 'string'
  }

  /**
   * Sends the line to everyone but the sender
   * @param context The handler context
   * @param line The line
   */
  protected override messageReceived(
    context: HandlerContext,
    line: string,
  ): void {
    const relayed = `[#${String(context.channel.id)}] ${line}\n`

    void this.room.writeAndFlush(relayed, ChannelGroup.except(context.channel))
  }
}
```

Create one `ChannelGroup` outside `childHandler` and pass it to each new `ChatHandler`, and every connection shares the room. Give it the same framer and string codecs as `ShoutHandler`.
