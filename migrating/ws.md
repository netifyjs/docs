---
title: Migrating from ws to Bun
description: 'Port a ws WebSocket server to Netify on Bun. Connections, messages, verifyClient and broadcasts mapped to handlers, the upgrade hook and native topics.'
---

# From ws

`ws` hands you a socket and some events. Netify's [`WebSocketBootstrap`](/transports/websocket) runs on Bun's native WebSocket server and gives each connection a pipeline. You get handler classes in place of callbacks, and native topics in place of a broadcast loop.

## What maps to what

| ws                                    | Netify                                    |
| ------------------------------------- | ----------------------------------------- |
| `new WebSocketServer({ port })`       | `new WebSocketBootstrap().bind({ port })` |
| `wss.on('connection')`                | `childHandler`, then `channelActive`      |
| `ws.on('message')`                    | `channelRead`                             |
| `ws.send(data)`                       | `context.writeAndFlushSync(data)`         |
| `ws.on('close')`                      | `channelInactive`                         |
| `ws.on('error')`                      | `exceptionCaught`                         |
| `ws.close()`                          | `context.close()`                         |
| `verifyClient`                        | The `upgrade` hook                        |
| `maxPayload`                          | `maxPayloadLength`                        |
| `wss.clients.forEach(c => c.send(m))` | `server.publish(topic, m)`                |

## Echo with a broadcast

The ws version:

```ts
const wss = new WebSocketServer({ port: 8080, maxPayload: 64 * 1024 })

wss.on('connection', (ws) => {
  ws.on('message', (data) => {
    ws.send(`echo: ${data}`)

    for (const client of wss.clients) {
      if (client !== ws) client.send(`someone said ${data}`)
    }
  })
})
```

The same server in Netify:

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
 * Echoes to the sender and tells everyone else
 * @class
 */
class EchoHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Joins the shared topic
   * @param context the new connection
   * @param event a user event
   */
  public override userEventTriggered(
    context: HandlerContext,
    event: unknown,
  ): void {
    if (!(event instanceof WebSocketHandshakeComplete)) return
    if (context.channel instanceof WebSocketChannel) {
      context.channel.subscribe('everyone')
    }
  }

  /**
   * Answers and passes the text on
   * @param context the sender
   * @param message a frame
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (!(message instanceof TextWebSocketFrame)) return
    if (!(context.channel instanceof WebSocketChannel)) return

    const text = message.text()

    context.writeAndFlushSync(`echo: ${text}`)
    context.channel.publish('everyone', `someone said ${text}`)
  }
}

await new WebSocketBootstrap()
  .options({ maxPayloadLength: 64 * 1024 })
  .childHandler((channel: WebSocketChannel): void => {
    channel.pipeline.addLast<EchoHandler>('echo', new EchoHandler())
  })
  .bind({ port: 8080 })
```

The loop over `wss.clients` becomes one `publish`. Bun sends it to every subscriber in native code, and `channel.publish` skips the sender.

## Things to know

- Messages arrive as `TextWebSocketFrame` or `BinaryWebSocketFrame`, never as a raw `Buffer`.
- Bun answers pings itself. There's no `ws.ping()` to call.
- `WebSocketBootstrap` is server only. For a client, use Bun's built in `WebSocket`.
- `ws` runs on Node. Netify needs Bun.

[Slow clients](/transports/websocket#slow-clients) covers backpressure, which `ws` leaves to `bufferedAmount`.
