---
title: How Netify works
description: "What happens between Bun's socket and your handler. Channels, the event queue, pipelines and where each message spends its time."
---

# How it works

You can skip this page and still build a server. Read it when you want to know why the API looks the way it does, or where the time goes.

## The pipeline

Each connection is a `Channel` with its own `Pipeline`. Here's the one from [Your first server](./first-server#lines-of-text):

```text
socket
  |
 head
  |      framer     LineBasedFrameDecoder   inbound
  |      decoder    StringDecoder           inbound
  |      encoder    StringEncoder           outbound
  |      shout      ShoutHandler            inbound
  |
 tail
```

Bytes enter at the head and move towards the tail. An inbound handler passes an event on with a `fire` method on its context, like `context.fireChannelRead(line)`. Skip the call and the event stops there. A decoder is an inbound handler that takes one type and fires another. Writes and closes go from the tail back to the head, which turns them into socket writes.

A handler sees the pipeline through its `HandlerContext`, and where a write starts matters. `context.write` starts at the current handler and only passes the outbound handlers between it and the head. `channel.write` starts at the tail and passes all of them. Handlers mostly use `context.write`, which is why encoders go before the handlers that rely on them. Add one after and your writes skip it.

When you add a handler, Netify records which callbacks it overrides and events skip the rest. The adapters' pass through methods never run and cost nothing.

### Errors

If a handler throws or its promise rejects, the error goes to `exceptionCaught`, starting at that handler and moving towards the tail until one overrides it. Unhandled errors get logged as a warning and the connection stays open. Give the last handler in each pipeline an `exceptionCaught` and decide there whether to close.

## The event queue

```ts twoslash
import { SimpleInboundHandler, type HandlerContext } from '@netifyjs/netify'

/**
 * Looks up players by name
 */
export type Players = {
  /**
   * Finds a player
   * @param name The name
   */
  readonly find: (name: string) => Promise<string | null>
}

/**
 * Logs a player in by name
 * @class
 */
export class LoginHandler extends SimpleInboundHandler<string> {
  /**
   * The players
   */
  private readonly players: Players

  /**
   * Creates the handler
   * @param players The players
   */
  public constructor(players: Players) {
    super()

    this.players = players
  }

  /**
   * Takes strings
   * @param message The message
   */
  protected override accepts(message: unknown): message is string {
    return typeof message === 'string'
  }

  /**
   * Finds the player and says hello
   * @param context The handler context
   * @param name The name
   */
  protected override async messageReceived(
    context: HandlerContext,
    name: string,
  ): Promise<void> {
    const player = await this.players.find(name)
    if (player === null) return context.close()

    await context.writeAndFlush(`Welcome back, ${player}\n`)
  }
}
```

The next line from this client won't reach `LoginHandler` until the lookup is done and the welcome has gone out. Each channel has an `EventQueue` that delivers events one at a time and waits on any promise a handler returns. Two messages from one client never run at once, which means no locks and no "logging in" flag. Other channels carry on meanwhile.

If data keeps arriving while a handler is busy, the queue holds it and the channel stops reading from the socket until the backlog drains. TCP flow control then slows the client down, and unread input can't pile up in memory.

The setup function runs inside the queue too. The pipeline is always complete before the first `channelActive` or `channelRead`, even when setup is async.

Code outside the pipeline, like a timer, can join the queue with `execute`. The task runs after the current event and before the next one.

```ts twoslash
import { type Channel } from '@netifyjs/netify'

declare const channel: Channel
// ---cut---
await channel.execute(async (): Promise<void> => {
  await channel.writeAndFlush(new Uint8Array([1, 2, 3]))
})
```

## The synchronous fast path

While handlers stay synchronous the queue is free. On an idle channel a new event runs straight away inside Bun's socket callback, and if no handler returns a promise, none is created or awaited. A backlog only forms when a handler is still busy as the next event arrives.

On hot paths like game state updates, keep `channelRead` synchronous and save `async` for handlers that really wait. An `async` handler only pays when it awaits.

## Writing

```ts twoslash
import { InboundHandlerAdapter, type HandlerContext } from '@netifyjs/netify'

/**
 * Replies to each message and flushes once per batch
 * @class
 */
export class BatchedHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Queues the reply
   * @param context The handler context
   * @param message The message
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    context.writeSync(message)
  }

  /**
   * Sends the batch
   * @param context The handler context
   */
  public override channelReadComplete(context: HandlerContext): Promise<void> {
    return context.flush()
  }
}
```

A write goes through the outbound handlers into the channel's outbound buffer. A flush hands the whole queue to the socket at once, copying small writes into one buffer. If a socket chunk holds fifty messages, this handler sees fifty `channelRead` calls and one `channelReadComplete`, and the fifty replies leave in one system call.

Use this pattern for request and reply protocols, and `writeAndFlush` for a one-off message outside a read. If you can't control where handlers flush, `FlushConsolidationHandler` batches flushes for you (see [Handlers](/guide/handlers)).

A write's promise settles when its bytes reach the socket, which only happens on a flush. An unflushed `write` stays pending forever.

`writeSync` and `writeAndFlushSync` skip the promise, for hot paths where you'd throw it away anyway. If one fails, you'll see it in `exceptionCaught`.

::: warning
A failed write only shows up through its promise. Drop the promise or use a sync form and you'll never see it. The usual culprit is a `string` written into a pipeline with no encoder for it. Await writes while you build a pipeline, then switch to the sync forms once it works.
:::

Sending the same bytes to many channels? Encode them once and send them with `writeEncoded` or `writeAndFlushEncoded`, which skip the pipeline.

### Backpressure on writes

If a handler sends faster than the client reads, bytes pile up. Past the high water mark (64 KiB by default) `channel.isWritable` goes false and `channelWritabilityChanged` fires. Below the low water mark it goes true again. If you stream a lot of data, stop producing while `isWritable` is false. Past `maxPendingBytes`, writes fail outright. The defaults are in [Options](/reference/options#channeloptions).

## Closing

```ts twoslash
import { type Channel } from '@netifyjs/netify'

declare const channel: Channel
// ---cut---
await channel.writeAndFlush(new TextEncoder().encode('Bye\n'))
await channel.close()
await channel.closed
```

Closing rejects any queued writes, runs `channelInactive` through the queue, then resolves `closed`. It works the same when the client hangs up first. If the last `writeAndFlush` has to arrive, await it before you close.

`close()` resolves once the socket's been told to end, before `channelInactive` runs. Await `closed` when cleanup has to be done, say before checking a player's state was saved. Put that cleanup in `channelInactive`, since closing never calls `handlerRemoved`.
