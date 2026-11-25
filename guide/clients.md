---
title: TCP, UDP and WebSocket clients in Bun
description: 'Connect to servers from Bun with Netify. TCP clients with framing and replies, reconnecting, TLS, UDP, reliable UDP, WebSocket and HTTP.'
---

# Clients

Every transport that has a server also has a client, and the client uses the same pipeline. The codecs and handlers you put on a server work on a client too.

| Transport    | Client                                         |
| ------------ | ---------------------------------------------- |
| TCP and Unix | `Bootstrap`                                    |
| UDP          | `DatagramBootstrap` with `connect`             |
| Reliable UDP | `ReliableBootstrap` with `connect`             |
| WebSocket    | Bun's `WebSocket`, or the codec on `Bootstrap` |
| HTTP         | `HttpClientCodec` on `Bootstrap`               |

## TCP

`Bootstrap` is the client. Pass your setup to `handler` and call `connect`.

```ts twoslash
import {
  Bootstrap,
  ByteBuf,
  InboundHandlerAdapter,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Says hello and prints the answer
 * @class
 */
class HelloHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Greets the server once connected
   * @param context the connection
   */
  public override channelActive(context: HandlerContext): void {
    context.writeAndFlushSync(ByteBuf.fromString('hello'))
  }

  /**
   * Prints whatever comes back
   * @param context the connection
   * @param message bytes from the server
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (message instanceof ByteBuf) console.log(message.toString())
  }
}

const channel = await new Bootstrap()
  .handler((channel: Channel): void => {
    channel.pipeline.addLast<HelloHandler>('hello', new HelloHandler())
  })
  .connect({ hostname: '127.0.0.1', port: 9000 })
```

`connect` resolves once the connection's up and your setup has run. If nothing's listening, it rejects with `Connection failed` and the socket error in `cause`.

You can write from a handler or from the channel `connect` gave you. `channel.writeAndFlush('hi')` goes through the whole pipeline, encoders included.

## Waiting for a reply

Most clients send something and wait for the answer. Keep the waiting promises in the handler and settle them as replies come in. This one speaks lines of text, and the server answers each line in order.

```ts twoslash
import {
  Bootstrap,
  LineBasedFrameDecoder,
  SimpleInboundHandler,
  StringDecoder,
  StringEncoder,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Matches each reply to the question before it
 * @class
 */
class AskHandler extends SimpleInboundHandler<string> {
  /**
   * Questions still waiting, oldest first
   */
  private readonly waiting: PromiseWithResolvers<string>[]

  /**
   * Starts with nothing pending
   */
  public constructor() {
    super()

    this.waiting = []
  }

  /**
   * Sends a line and waits for the answer
   * @param channel where to ask
   * @param question one line of text
   */
  public ask(channel: Channel, question: string): Promise<string> {
    const answer = Promise.withResolvers<string>()
    this.waiting.push(answer)

    channel.writeAndFlushSync(`${question}\n`)
    return answer.promise
  }

  /**
   * Takes strings
   * @param message whatever the decoder passed on
   */
  protected override accepts(message: unknown): message is string {
    return typeof message === 'string'
  }

  /**
   * Hands the line to the oldest question
   * @param context the connection
   * @param line the answer
   */
  protected override messageReceived(
    context: HandlerContext,
    line: string,
  ): void {
    this.waiting.shift()?.resolve(line)
  }

  /**
   * Fails anything still waiting
   * @param context the connection
   */
  public override channelInactive(context: HandlerContext): void {
    for (const answer of this.waiting) {
      answer.reject(new Error('Connection closed'))
    }

    this.waiting.length = 0
  }
}

const asker = new AskHandler()
const channel = await new Bootstrap()
  .handler((channel: Channel): void => {
    channel.pipeline
      .addLast<LineBasedFrameDecoder>(
        'framer',
        new LineBasedFrameDecoder({ maxLength: 1024 }),
      )
      .addLast<StringDecoder>('decoder', new StringDecoder())
      .addLast<StringEncoder>('encoder', new StringEncoder())
      .addLast<AskHandler>('ask', asker)
  })
  .connect({ hostname: '127.0.0.1', port: 9000 })

console.log(await asker.ask(channel, 'time?'))
```

The handler is created outside `handler` so you can reach `ask`. That's fine on a client, since there's only one connection.

If the server can answer out of order, put an id on each request and keep the waiting promises in a `Map` keyed by it.

## Reconnecting

A client that has to stay connected, like a game server talking to a lobby service, should go through `ReconnectingClient`. It redials whenever the connection drops, with exponential backoff and jitter.

```ts twoslash
import {
  Bootstrap,
  ReconnectingClient,
  StringEncoder,
  type Channel,
} from '@netifyjs/netify'

const bootstrap = new Bootstrap().handler((channel: Channel): void => {
  channel.pipeline.addLast<StringEncoder>('encoder', new StringEncoder())
})

const client = new ReconnectingClient(
  bootstrap,
  { hostname: '127.0.0.1', port: 7000 },
  { initialDelay: 250, maxDelay: 10_000 },
)

await client.start()

const channel = await client.waitForChannel()
await channel.writeAndFlush('hello')
```

Every reconnect makes a new channel, so read `client.channel` or await `waitForChannel()` each time. [TCP](/transports/tcp#reconnecting) has the callbacks and the rest of the settings.

## TLS and Unix sockets

Turn on TLS with `options`. `tls: true` trusts the usual public authorities. For a self-signed certificate, pass it as `ca`.

```ts twoslash
import { Bootstrap, type Channel } from '@netifyjs/netify'

const channel = await new Bootstrap()
  .options({ tls: true })
  .handler((channel: Channel): void => {})
  .connect({ hostname: 'example.com', port: 443 })
```

For a Unix socket, connect with a path: `.connect({ unix: '/tmp/game.sock' })`. [TCP](/transports/tcp#tls) covers both.

## UDP

`DatagramBootstrap` connects a UDP socket to one server. Packets you write then go there without a recipient.

```ts twoslash
import {
  DatagramBootstrap,
  DatagramPacket,
  type DatagramChannel,
} from '@netifyjs/netify'

const channel = await new DatagramBootstrap()
  .handler((channel: DatagramChannel): void => {})
  .connect({ remoteHostname: '127.0.0.1', remotePort: 9000 })

await channel.writeAndFlush(new DatagramPacket('ping'))
```

Replies arrive in `channelRead` as `DatagramPacket`s. See [UDP](/transports/udp#a-client).

## Reliable UDP

`ReliableBootstrap` does a handshake on `connect` and hands back the server as a peer. Both sides must list the same lanes.

```ts twoslash
import { ReliableBootstrap, type DatagramChannel } from '@netifyjs/netify'

const { channel, peer } = await new ReliableBootstrap()
  .handler((channel: DatagramChannel): void => {})
  .connect({ hostname: '127.0.0.1', port: 7777 })

peer.send(0, 'hello')
```

[Reliable UDP](/transports/reliable#a-server-and-a-client) has the full client with a handler.

## WebSocket

`WebSocketBootstrap` is server only. In a browser, or for a quick script, use the built in `WebSocket`. Bun has one too.

```ts
const socket = new WebSocket('ws://localhost:8080/play')

socket.onmessage = (message) => console.log(message.data)
socket.onopen = () => socket.send('hello')
```

When you want a pipeline on the client, run the WebSocket codec on a `Bootstrap`. [WebSocket](/transports/websocket#a-client) shows the setup with `WebSocketClientProtocolHandler`.

## HTTP

For calling an API, use `fetch`. Netify's `HttpClientCodec` is for when HTTP sits inside your own protocol, or you need control of the connection. [HTTP](/transports/http#a-client) has an example.
