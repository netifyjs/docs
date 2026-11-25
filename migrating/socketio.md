---
title: Socket.IO alternative for Bun
description: 'Move a Socket.IO server to Netify on Bun. Events, rooms, middleware and broadcasts mapped to native WebSocket handlers and topics.'
---

# From Socket.IO

Socket.IO gives you named events, rooms and a client library with fallbacks. Netify's [`WebSocketBootstrap`](/transports/websocket) runs on Bun's native WebSocket server and gives you handlers, rooms and an upgrade hook. The event names and message format are yours to pick.

In the [framework benchmark](/scaling/performance#websocket), Netify echoed about 5 times as many messages as Socket.IO on Bun, and delivered about 20 times as many room broadcasts.

## What maps to what

| Socket.IO                  | Netify                                    |
| -------------------------- | ----------------------------------------- |
| `io.on('connection')`      | `childHandler`, then `channelActive`      |
| `socket.on('event')`       | `channelRead`, matching on your own field |
| `socket.emit(event, data)` | `context.writeAndFlushSync(json)`         |
| `socket.join(room)`        | `channel.subscribe(room)`                 |
| `socket.leave(room)`       | `channel.unsubscribe(room)`               |
| `socket.to(room).emit()`   | `channel.publish(room, json)`             |
| `io.to(room).emit()`       | `server.publish(room, json)`              |
| `io.use(middleware)`       | The `upgrade` hook                        |
| `socket.data`              | `channel.data`, set by the `upgrade` hook |
| `socket.on('disconnect')`  | `channelInactive`                         |

## A chat room

The Socket.IO version:

```ts
io.use((socket, next) => {
  if (socket.handshake.auth.token !== 'secret') return next(new Error('Nope'))
  next()
})

io.on('connection', (socket) => {
  socket.on('join', (room) => socket.join(room))
  socket.on('chat', (room, text) => socket.to(room).emit('chat', text))
})
```

The same server in Netify. Every message is JSON with an `event` field, which plays the part of the Socket.IO event name.

```ts twoslash
import {
  InboundHandlerAdapter,
  TextWebSocketFrame,
  WebSocketBootstrap,
  WebSocketChannel,
  type HandlerContext,
  type UpgradeVerdict,
} from '@netifyjs/netify'

/**
 * Anything a client can send
 */
type ClientMessage =
  | {
      /**
       * Joining a room
       */
      readonly event: 'join'
      /**
       * Which room
       */
      readonly room: string
    }
  | {
      /**
       * Talking in a room
       */
      readonly event: 'chat'
      /**
       * Which room
       */
      readonly room: string
      /**
       * What they said
       */
      readonly text: string
    }

/**
 * Routes each event to the right room
 * @class
 */
class ChatHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Handles one event
   * @param context the player's connection
   * @param message a frame from the browser
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (!(message instanceof TextWebSocketFrame)) return
    if (!(context.channel instanceof WebSocketChannel)) return

    const channel = context.channel
    const incoming = JSON.parse(message.text()) as ClientMessage

    switch (incoming.event) {
      case 'join':
        channel.subscribe(incoming.room)
        break
      case 'chat':
        channel.publish(
          incoming.room,
          JSON.stringify({ event: 'chat', text: incoming.text }),
        )
        break
    }
  }
}

/**
 * Lets in clients with the right token
 * @param request the upgrade request
 */
const authenticate = (request: Request): UpgradeVerdict => {
  const token = new URL(request.url).searchParams.get('token')
  if (token !== 'secret') return { accept: false, status: 401 }

  return { accept: true }
}

await new WebSocketBootstrap()
  .options({ path: '/chat', upgrade: authenticate })
  .childHandler((channel: WebSocketChannel): void => {
    channel.pipeline.addLast<ChatHandler>('chat', new ChatHandler())
  })
  .bind({ port: 8080 })
```

`channel.publish` skips the sender, like `socket.to(room)`. Closed channels leave their rooms on their own.

## The client

Browsers already have `WebSocket`, so there's no client library to ship.

```ts
const socket = new WebSocket('ws://localhost:8080/chat?token=secret')

socket.onopen = () => {
  socket.send(JSON.stringify({ event: 'join', room: 'lobby' }))
}

socket.onmessage = (message) => {
  console.log(JSON.parse(message.data))
}
```

## What you give up

- **Fallbacks.** Socket.IO drops to HTTP long polling where WebSocket is blocked. Netify is WebSocket only, which every current browser supports.
- **Reconnects.** The Socket.IO client reconnects for you. With a plain `WebSocket`, reconnect in `onclose`.
- **Acks.** There's no built in reply callback. Put an id on the message and send one back with the same id.
- **Adapters.** Socket.IO's Redis adapter spreads rooms across servers. Netify's [`ShardLink`](/scaling/sharding) links your own processes, and anything wider is up to you.

For games, a binary format cuts the size of every message. [Codecs](/guide/codecs) covers MessagePack, Protobuf and hand written binary codecs.
