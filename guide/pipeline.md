---
title: Pipelines
description: 'Every Netify connection has a pipeline of handlers. Add, remove and replace them, and follow a message from the socket to your code.'
---

# Pipelines

A pipeline is the list of handlers every message on a connection passes through. You build one per connection in the bootstrap's setup function.

```ts twoslash
import {
  InboundHandlerAdapter,
  LineBasedFrameDecoder,
  ServerBootstrap,
  StringDecoder,
  StringEncoder,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Answers chat lines
 * @class
 */
export class ChatHandler extends InboundHandlerAdapter<string> {
  /**
   * Sends the line back
   * @param context The handler context
   * @param line The line
   */
  public override channelRead(
    context: HandlerContext,
    line: string,
  ): Promise<void> {
    return context.writeAndFlush(`You said ${line}\n`)
  }
}

const server = await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addLast<LineBasedFrameDecoder>(
        'lines',
        new LineBasedFrameDecoder({ maxLength: 1024 }),
      )
      .addLast<StringDecoder>('decoder', new StringDecoder())
      .addLast<StringEncoder>('encoder', new StringEncoder())
      .addLast<ChatHandler>('chat', new ChatHandler())
  })
  .bind({ port: 7000 })
```

Incoming data runs top to bottom. `lines` splits the bytes into lines, `decoder` turns each one into a string and `chat` gets one string at a time. Writes go the other way, and the string `chat` writes passes back up through `encoder` to become bytes. The decoders ignore writes and the encoder ignores reads, which is why they can sit side by side.

You'll use `addLast` for nearly everything. `addBefore` and `replace` are for changing a live pipeline, like swapping in a different codec after a handshake. All the methods are in the [reference](/reference/api#pipeline).

The setup function runs once per connection and can be async. The channel reads nothing until it's done and `channelActive` has run, which lets `handlerAdded` load state without racing the first message. Clients work the same way with `new Bootstrap().handler(setup)`.

Pass the bootstrap a handler object instead of a function and that one instance goes into every pipeline. [Sharing a handler](/guide/handlers#sharing-a-handler) covers when that's safe.

## Where a write starts

`context.write` starts at the handler that called it and only visits the outbound handlers between it and the socket. `context.channel.write` starts at the far end and visits all of them. In the example above both work for `chat`, because `encoder` is between `chat` and the socket either way.

Encoders must write through the context, or their output loops back into them. The usual mistake is adding an encoder after the handler that writes to it. The write never reaches the encoder, and the socket rejects it with `Message type is not supported`.

## Changing the pipeline at runtime

You can add and remove handlers at any time, even from inside another handler. A typical case is a login step that replaces itself once the player is in.

```ts twoslash
import { InboundHandlerAdapter, type HandlerContext } from '@netifyjs/netify'

/**
 * Handles game commands
 * @class
 */
export class GameHandler extends InboundHandlerAdapter<string> {
  /**
   * Answers a command
   * @param context The handler context
   * @param line The command
   */
  public override channelRead(
    context: HandlerContext,
    line: string,
  ): Promise<void> {
    return context.writeAndFlush(`You said ${line}\n`)
  }
}

/**
 * Waits for the password, then steps aside
 * @class
 */
export class AuthHandler extends InboundHandlerAdapter<string> {
  /**
   * Swaps itself for the game handler on the right password
   * @param context The handler context
   * @param line The password
   */
  public override async channelRead(
    context: HandlerContext,
    line: string,
  ): Promise<void> {
    if (line !== 'hunter2') {
      await context.close()
      return
    }

    context.pipeline.replace<GameHandler>(
      context.name,
      'game',
      new GameHandler(),
    )
    await context.writeAndFlush('Welcome\n')
  }
}
```

`AuthHandler` can still write through its context after being replaced, which lets it finish the call it's in. The new handler's `handlerAdded` runs first, then the old one's `handlerRemoved`. Anything the old one passes on after that goes through the new one. A removed decoder hands any bytes it was holding to the handler after it.

## Running work in line

Inbound events on a channel run one at a time, but a timer or a message from another channel can fire mid-event. `channel.execute(task)` puts the task in the same queue as the events, and the two never overlap.

```ts twoslash
import { type Channel } from '@netifyjs/netify'

/**
 * Sends a tick every 50 ms
 * @param channel The channel
 */
export function tick(channel: Channel): void {
  const timer = setInterval((): void => {
    void channel.execute((): Promise<void> => channel.writeAndFlush('tick\n'))
  }, 50)

  void channel.closed.then((): void => {
    clearInterval(timer)
  })
}
```

If the task throws, the error goes to `exceptionCaught` like any other handler error. `channel.closed` resolves after `channelInactive` has run, whichever side hung up. That makes it the easiest place to stop timers like this one.

## Attributes

For per-connection state that several handlers share, like a session, use `channel.attributes`. Create each `AttributeKey` once and export it. Keys compare by identity, and two keys with the same name are still different keys.

```ts twoslash
import {
  AttributeKey,
  InboundHandlerAdapter,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * A logged in player
 */
export type Session = {
  /**
   * The player name
   */
  readonly name: string
}

/**
 * Where the session is kept
 */
export const SESSION: AttributeKey<Session> = new AttributeKey<Session>(
  'session',
)

/**
 * Logs players in
 * @class
 */
export class LoginHandler extends InboundHandlerAdapter<string> {
  /**
   * Keeps the session, or replies to a known player
   * @param context The handler context
   * @param line The line
   */
  public override channelRead(
    context: HandlerContext,
    line: string,
  ): Promise<void> {
    const attributes = context.channel.attributes

    const session = attributes.get<Session>(SESSION)
    if (session !== null)
      return context.writeAndFlush(`${session.name}: ${line}\n`)

    attributes.set<Session>(SESSION, { name: line })
    return context.writeAndFlush(`Hello, ${line}\n`)
  }
}
```

If only one handler uses the state, a field on it is simpler, as long as each connection has its own instance.

## Slow readers

Writes queue until the socket takes them. A slow reader makes the queue grow, and a handler that keeps writing ends up holding the backlog in memory. `channel.isWritable` goes false past the high water mark, and `channelWritabilityChanged` fires each time it flips.

```ts twoslash
import {
  InboundHandlerAdapter,
  ServerBootstrap,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Stops streaming while the peer catches up
 * @class
 */
export class StreamHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Sends more once the channel can take it
   * @param context The handler context
   */
  public override channelWritabilityChanged(context: HandlerContext): void {
    if (context.channel.isWritable) this.sendMore(context.channel)
  }

  /**
   * Writes until the channel is full
   * @param channel The channel
   */
  private sendMore(channel: Channel): void {
    while (channel.isWritable) channel.writeAndFlushSync(new Uint8Array(1024))
  }
}

const server = await new ServerBootstrap()
  .childOptions({ highWaterMark: 128 * 1024, lowWaterMark: 64 * 1024 })
  .childHandler((channel: Channel): void => {
    channel.pipeline.addLast<StreamHandler>('stream', new StreamHandler())
  })
  .bind({ port: 7000 })
```

The defaults are 64 KiB high and 32 KiB low, and at 64 MiB writes fail with `Write queue is full`. Most request and reply protocols never get close. Check `isWritable` when you stream lots of data or push to clients on a timer. The limits are under [ChannelOptions](/reference/options#channeloptions).

## Writing without promises

Every write has a `Sync` twin, like `writeAndFlushSync`, that skips the promise. A game server writing to thousands of channels every tick saves a lot of allocation this way. The catch is you hear nothing back, except for a full write queue, which still reaches `exceptionCaught`. Stick to promises by default and switch hot paths once you've measured them.

`channel.writeEncoded(bytes)` goes further and puts bytes straight into the write queue, past every handler. Encode a message once and send the same bytes to many channels. The bytes need whatever framing the pipeline would add, like a length prefix.

## ChannelGroup

A `ChannelGroup` is a set of channels you write to in one call, like a chat room or a match. Closed channels leave every group on their own, and a disconnect needs no cleanup from you.

```ts twoslash
import {
  ChannelGroup,
  InboundHandlerAdapter,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Relays each line to the rest of the room
 * @class
 */
export class RoomHandler extends InboundHandlerAdapter<string> {
  /**
   * Everyone in the room
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
   * Joins the room
   * @param context The handler context
   */
  public override channelActive(context: HandlerContext): Promise<void> {
    this.room.add(context.channel)

    return context.fireChannelActive()
  }

  /**
   * Sends the line to everyone else
   * @param context The handler context
   * @param line The line
   */
  public override async channelRead(
    context: HandlerContext,
    line: string,
  ): Promise<void> {
    const result = await this.room.writeAndFlush(
      `${line}\n`,
      ChannelGroup.except(context.channel),
    )

    if (result.failed.length > 0)
      console.warn(`${String(result.failed.length)} sends failed`)
  }
}
```

The second argument filters members. `ChannelGroup.except(channel)` leaves out the sender, and any function from channel to boolean works too. Leave it out to send to everyone. The result lists the channels that `succeeded` and those that `failed`, with each failure's error. A `ByteBuf` you pass is duplicated per channel, which keeps one channel's reads from moving another's indexes.

For game state, `broadcast` and `broadcastSync` send the same encoded bytes to everyone. They skip the pipelines, which means the frame needs its length prefix already.

```ts twoslash
import { ByteBuf, ChannelGroup, type Channel } from '@netifyjs/netify'

/**
 * Sends the tick number to players who can keep up
 * @param match The players
 * @param tick The tick number
 */
export function sendTick(match: ChannelGroup, tick: number): number {
  const frame = ByteBuf.allocate(6).writeUint16(4).writeUint32(tick)

  return match.broadcastSync(
    frame,
    (channel: Channel): boolean => channel.isWritable,
  )
}
```

[Game servers](/scaling/games) covers tick loops and fan-out in more depth.
