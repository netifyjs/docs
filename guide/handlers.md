---
title: Handlers
description: 'Write Netify handlers that read and write messages, pass events on, catch errors and keep async work in order on each connection.'
---

# Handlers

A handler is a class that reacts to what happens on a channel. This one writes back whatever it reads.

::: code-group

```ts twoslash [src/handlers/echo/index.ts]
import {
  InboundHandlerAdapter,
  type ByteBuf,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Sends every message back
 * @class
 */
export class EchoHandler extends InboundHandlerAdapter<ByteBuf> {
  /**
   * Writes the message back
   * @param context The handler context
   * @param message The message
   */
  public override channelRead(
    context: HandlerContext,
    message: ByteBuf,
  ): Promise<void> {
    return context.writeAndFlush(message)
  }
}
```

:::

`InboundHandlerAdapter` passes every event along, and you override the ones you care about. Most handlers extend it. `OutboundHandlerAdapter` lets you change or watch what goes out, and `DuplexHandlerAdapter` works both ways, like a codec. The handler types are in the [reference](/reference/api#handlers).

`context` is the handler's place in the [pipeline](/guide/pipeline). You write, close and pass events on through it. `context.channel` is the connection.

## The callbacks

All the inbound callbacks are optional.

| Callback                    | When it fires                                                  |
| --------------------------- | -------------------------------------------------------------- |
| `channelActive`             | Once, after the pipeline is set up and the connection is ready |
| `channelRead`               | Once for each message                                          |
| `channelReadComplete`       | After the messages from one socket chunk have all been read    |
| `channelWritabilityChanged` | When `channel.isWritable` flips                                |
| `userEventTriggered`        | When a handler fires an event of its own, like an idle notice  |
| `exceptionCaught`           | When a handler throws or rejects                               |
| `channelInactive`           | Once, after the socket has closed, if the channel was active   |

The first handler on a TCP channel gets raw `ByteBuf` chunks, which might hold half a message or several. Put a [codec](/guide/codecs) in front and your handler gets whole messages.

`handlerAdded` and `handlerRemoved` run as a handler goes into and out of a pipeline, which makes them the place for timers. Leave `override` off them, because the base classes don't define them.

```ts twoslash
import { InboundHandlerAdapter, type HandlerContext } from '@netifyjs/netify'

/**
 * Sends a ping every second
 * @class
 */
export class PingHandler extends InboundHandlerAdapter<unknown> {
  /**
   * The ping timer, or null
   */
  private timer: Timer | null

  /**
   * Starts with no timer
   */
  public constructor() {
    super()

    this.timer = null
  }

  /**
   * Starts the timer
   * @param context The handler context
   */
  public handlerAdded(context: HandlerContext): void {
    this.timer = setInterval((): void => {
      context.writeAndFlushSync('ping\n')
    }, 1000)
  }

  /**
   * Stops the timer
   */
  public handlerRemoved(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }
}
```

## Passing events on

An event stops at your handler unless you pass it on with the matching `fire` method, like `fireChannelRead` for `channelRead`. You can pass on a different value than you got, which is how decoders turn bytes into messages.

```ts twoslash
import { InboundHandlerAdapter, type HandlerContext } from '@netifyjs/netify'

/**
 * Drops empty lines and trims the rest
 * @class
 */
export class TrimHandler extends InboundHandlerAdapter<string> {
  /**
   * Passes on the trimmed line
   * @param context The handler context
   * @param line The line
   */
  public override channelRead(
    context: HandlerContext,
    line: string,
  ): Promise<void> | undefined {
    const trimmed = line.trim()
    if (trimmed === '') return

    return context.fireChannelRead(trimmed)
  }
}
```

Messages nobody takes reach the end of the pipeline and get logged at debug level. Unhandled errors get logged as warnings. Neither closes the channel.

## Typed messages

The type parameter on `InboundHandlerAdapter<string>` is only for the compiler. If an earlier handler passes on a `ByteBuf`, your `channelRead` gets it anyway. For a handler that only makes sense for one type, extend `SimpleInboundHandler` and write a type guard. Matching messages go to `messageReceived` and the rest carry on.

```ts twoslash
import { SimpleInboundHandler, type HandlerContext } from '@netifyjs/netify'

/**
 * Answers chat lines
 * @class
 */
export class ChatHandler extends SimpleInboundHandler<string> {
  /**
   * Takes strings
   * @param message The message
   */
  protected accepts(message: unknown): message is string {
    return typeof message === 'string'
  }

  /**
   * Sends the line back in capitals
   * @param context The handler context
   * @param line The line
   */
  protected messageReceived(
    context: HandlerContext,
    line: string,
  ): Promise<void> {
    return context.writeAndFlush(`${line.toUpperCase()}\n`)
  }
}
```

This works well when several handlers each pick their own type out of one stream.

## Async handlers and ordering

A channel handles its events one at a time, in order. If `channelRead` returns a promise, the next message waits until it settles.

```ts twoslash
import { InboundHandlerAdapter, type HandlerContext } from '@netifyjs/netify'

/**
 * Looks up the player for each request
 * @class
 */
export class LookupHandler extends InboundHandlerAdapter<string> {
  /**
   * Finds the player and sends the name back
   * @param context The handler context
   * @param id The player id
   */
  public override async channelRead(
    context: HandlerContext,
    id: string,
  ): Promise<void> {
    const response = await fetch(`http://localhost:8080/players/${id}`)

    await context.writeAndFlush(`${await response.text()}\n`)
  }
}
```

Replies go out in request order with no locking on your side. While a handler is busy the channel stops reading from its socket, and only that connection slows down.

This only works for promises you return. Fire off async work without returning it and the channel moves on, and replies can overtake each other. Return the promise from `fireChannelRead` too, and the channel also waits for the handlers after yours. Work from outside the pipeline, like a timer, can join the queue through [`channel.execute`](/guide/pipeline#running-work-in-line).

## Writes and flushes

`context.write` queues a message and `context.flush` sends the queue. A write's promise settles when the bytes reach the socket, which only happens on a flush. Awaiting a write nobody flushes hangs forever, and it's the most common way to stall a handler. Use `writeAndFlush` for a single message. For a burst, write each one and flush once at the end, or in `channelReadComplete`.

An outbound handler overrides `write` and passes the message on with `context.write`.

```ts twoslash
import {
  ByteBuf,
  OutboundHandlerAdapter,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Counts the bytes that go out
 * @class
 */
export class ByteCounter extends OutboundHandlerAdapter<unknown> {
  /**
   * Bytes written so far
   */
  public written: number

  /**
   * Starts at zero
   */
  public constructor() {
    super()

    this.written = 0
  }

  /**
   * Counts the bytes and passes the write on
   * @param context The handler context
   * @param message The message
   */
  public override write(
    context: HandlerContext,
    message: unknown,
  ): Promise<void> {
    if (message instanceof ByteBuf) this.written += message.readableBytes

    return context.write(message)
  }
}
```

## Errors

When a callback throws or rejects, the error goes to `exceptionCaught`. It starts with the handler that threw and moves towards the end of the pipeline until something handles it. End every pipeline with a handler that does.

```ts twoslash
import {
  DecoderError,
  InboundHandlerAdapter,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Logs errors and drops bad peers
 * @class
 */
export class ErrorHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Closes the channel on a decoding error
   * @param context The handler context
   * @param error The error
   */
  public override async exceptionCaught(
    context: HandlerContext,
    error: unknown,
  ): Promise<void> {
    console.warn(`Channel ${String(context.channel.id)} failed`, error)
    if (error instanceof DecoderError) await context.close()
  }
}
```

A failed write rejects its own promise and never reaches `exceptionCaught`. If you care whether a write worked, await it or attach a `catch`.

## User events

A user event is any value a handler sends down the pipeline with `context.fireUserEventTriggered(event)`. You'll probably meet them first through `IdleStateHandler`, which fires an `IdleStateEvent` when a connection goes quiet.

```ts twoslash
import {
  IdleStateEvent,
  IdleStateHandler,
  InboundHandlerAdapter,
  ServerBootstrap,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Drops clients that go quiet
 * @class
 */
export class ReaperHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Closes the channel on reader idle
   * @param context The handler context
   * @param event The event
   */
  public override async userEventTriggered(
    context: HandlerContext,
    event: unknown,
  ): Promise<void> {
    if (event instanceof IdleStateEvent && event.state === 'reader')
      await context.close()
  }
}

const server = await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addFirst<IdleStateHandler>(
        'idle',
        new IdleStateHandler({ readerIdle: 30_000 }),
      )
      .addLast<ReaperHandler>('reaper', new ReaperHandler())
  })
  .bind({ port: 7000 })
```

`IdleStateHandler` goes first so it sees every read and write. It keeps firing while the channel stays quiet, with `event.first` false on repeats. Writes only count as activity once flushed.

Your own events work the same way. Fire an instance of your own class, like a `LoggedIn` event after a player authenticates, and check for it with `instanceof`. Pass on anything you don't recognise, or later handlers never see it.

## Sharing a handler

Handlers created inside the setup function are fresh for each connection. You want that for anything with fields that track a single connection.

```ts twoslash
import {
  InboundHandlerAdapter,
  ServerBootstrap,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Counts the messages on one channel
 * @class
 */
export class CountHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Messages so far
   */
  private count: number

  /**
   * Starts at zero
   */
  public constructor() {
    super()

    this.count = 0
  }

  /**
   * Counts the message and passes it on
   * @param context The handler context
   * @param message The message
   */
  public override channelRead(
    context: HandlerContext,
    message: unknown,
  ): Promise<void> {
    this.count += 1

    return context.fireChannelRead(message)
  }
}

const server = await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline.addLast<CountHandler>('count', new CountHandler())
  })
  .bind({ port: 7000 })
```

Pass `childHandler` a handler object instead of a function and that one instance goes into every pipeline. Only do that for handlers with no per-connection state, or when sharing is the point, like a handler that owns a room's `ChannelGroup`. Netify doesn't mark handlers as shareable. Every decoder, and every built-in handler that runs a timer, keeps state and needs its own instance.

## Built-in handlers

On a public server, add `IdleStateHandler` or `ReadTimeoutHandler` with `addFirst` to drop dead connections. If you only want to close, `ReadTimeoutHandler` is shorter. It raises a `ReadTimeoutError` and closes with no handler of your own. `IdleStateHandler` lets you send a ping first or decide for yourself. Idle time starts after the last read finishes, and a slow handler doesn't count as silence. Make a new one for each connection.

`LoggingHandler` logs every event that passes it at debug level. Put one each side of a codec to see what goes in and what comes out. `FlushConsolidationHandler` merges the flushes from one read into a single syscall, which helps protocols that flush after every message. Add it with `addFirst` so it sits closer to the socket than the handlers that flush. If a read handler awaits something, its flushes go out straight away. `OffloadHandler` moves CPU-heavy messages to worker threads, covered in [Worker threads](/scaling/workers). Settings for all of them are in the [options reference](/reference/options#handlers).
