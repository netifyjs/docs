---
title: TCP server and client in Bun
description: 'Run a TCP server with ServerBootstrap and connect with Bootstrap. Covers reconnecting clients, connection limits, TLS and Unix sockets.'
---

# TCP

`ServerBootstrap` accepts connections and `Bootstrap` dials out. They sit on `Bun.listen` and `Bun.connect`, which is why TLS and Unix sockets work with the same code.

## A server

```ts twoslash
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
class EchoHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Queues the bytes without flushing yet
   * @param context where to write back
   * @param message the raw buffer that came in
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    context.writeSync(message)
  }

  /**
   * Flushes once per read batch
   * @param context the connection to flush
   */
  public override channelReadComplete(context: HandlerContext): Promise<void> {
    return context.flush()
  }
}

const server = await new ServerBootstrap()
  .options({ maxConnections: 10_000, maxConnectionsPerAddress: 16 })
  .childOptions({ idleTimeout: 60_000 })
  .childHandler((channel: Channel): void => {
    channel.pipeline.addLast<EchoHandler>('echo', new EchoHandler())
  })
  .bind({ hostname: '127.0.0.1', port: 7000 })

console.log(`Listening on ${server.hostname}:${String(server.port)}`)
```

The `childHandler` function runs for each accepted connection and builds its pipeline. `options` sets up the listening socket and `childOptions` sets up each connection. `bind` gives you a `ServerChannel`, and `server.close()` stops listening and waits for open connections to close.

The handler queues reads with `writeSync` and flushes once per read batch. That saves a system call per message. `writeSync` returns no promise. Use `write` or `writeAndFlush` when you need to know the bytes went out.

If the server faces the internet, set `maxConnections` and `maxConnectionsPerAddress`. Connections over either limit are dropped before a channel exists, and your handlers never see them. You'll usually want an `idleTimeout` too. `noDelay` is on by default. Bun counts idle time in whole seconds and Netify rounds up. For finer timing, use `IdleStateHandler` from [Handlers](/guide/handlers).

A second call to `options` or `childOptions` replaces the first object instead of merging with it. All the settings are in [`ServerOptions`](/reference/options#serveroptions) and [`SocketOptions`](/reference/options#socketoptions).

`childHandler` also takes a `ChannelInitializer` or a handler instance. An instance is shared by every connection, which is only safe if it keeps no state. You'll almost always pass a function.

## A client

```ts twoslash
import {
  Bootstrap,
  ByteBuf,
  InboundHandlerAdapter,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Prints what the server sends
 * @class
 */
class PrintHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Prints the bytes as text
   * @param context unused
   * @param message the buffer that came in
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (message instanceof ByteBuf) console.log(message.toString())
  }
}

const channel = await new Bootstrap()
  .handler((child: Channel): void => {
    child.pipeline.addLast<PrintHandler>('print', new PrintHandler())
  })
  .connect({ hostname: '127.0.0.1', port: 7000 })

await channel.writeAndFlush(ByteBuf.fromString('hello'))
```

On the client it's `handler` instead of `childHandler`. `connect` resolves once the channel is active and your setup has run. If either fails, it rejects with `Connection failed`. `options` takes the same socket settings as `childOptions`, plus `tls`.

## Reconnecting

For a client that should stay connected, like a game server talking to a lobby service, wrap the bootstrap in `ReconnectingClient`. It redials whenever the connection drops, with exponential backoff and jitter.

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
  {
    /**
     * Logs each connect
     * @param channel the new channel
     */
    onConnect: (channel: Channel): void => {
      console.log(`connected as ${String(channel.id)}`)
    },
    /**
     * Logs each retry
     * @param attempt counts from 1
     * @param delay the wait in ms
     */
    onRetry: (attempt: number, delay: number): void => {
      console.log(`retry ${String(attempt)} in ${String(delay)} ms`)
    },
  },
)

const channel = await client.start()
await channel.writeAndFlush('hello')
await client.stop()
```

Set the handler on the bootstrap before you pass it in. Without `maxAttempts` it retries forever. A successful connect resets the count.

Don't hold on to the channel from `start`. Every reconnect makes a new one. Read `client.channel` when you need it, or await `client.waitForChannel()`. The backoff settings are in [`ReconnectOptions`](/reference/options#reconnectoptions).

## TLS

Pass Bun's TLS settings to `options` on either side. Your pipeline doesn't change.

::: code-group

```ts twoslash [server.ts]
import {
  LineBasedFrameDecoder,
  ServerBootstrap,
  StringDecoder,
  StringEncoder,
  type Channel,
} from '@netifyjs/netify'

const server = await new ServerBootstrap()
  .options({
    tls: {
      /**
       * Private key, PEM encoded
       */
      key: Bun.file('key.pem'),
      /**
       * Certificate chain, PEM encoded
       */
      cert: Bun.file('cert.pem'),
    },
  })
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addLast<LineBasedFrameDecoder>(
        'framer',
        new LineBasedFrameDecoder({ maxLength: 1024 }),
      )
      .addLast<StringDecoder>('decoder', new StringDecoder())
      .addLast<StringEncoder>('encoder', new StringEncoder())
  })
  .bind({ port: 7443 })
```

```ts twoslash [client.ts]
import { Bootstrap, StringEncoder, type Channel } from '@netifyjs/netify'

const channel = await new Bootstrap()
  .options({
    tls: {
      /**
       * Trust our own certificate
       */
      ca: Bun.file('cert.pem'),
      /**
       * Name the certificate was issued for
       */
      serverName: 'localhost',
    },
  })
  .handler((child: Channel): void => {
    child.pipeline.addLast<StringEncoder>('encoder', new StringEncoder())
  })
  .connect({ hostname: '127.0.0.1', port: 7443 })

await channel.writeAndFlush('encrypted hello\n')
```

:::

The client trusts a self-signed certificate through `ca`. If the server's certificate comes from a public authority, `tls: true` is enough.

## Unix sockets

Pass a `unix` path instead of a host and port.

```ts twoslash
import {
  Bootstrap,
  ServerBootstrap,
  StringDecoder,
  StringEncoder,
  type Channel,
} from '@netifyjs/netify'

const server = await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline.addLast<StringDecoder>('decoder', new StringDecoder())
  })
  .bind({ unix: '/tmp/game.sock' })

const client = await new Bootstrap()
  .handler((channel: Channel): void => {
    channel.pipeline.addLast<StringEncoder>('encoder', new StringEncoder())
  })
  .connect({ unix: '/tmp/game.sock' })

await client.close()
await server.close()
```

On a Unix socket server, `server.address` is `{ unix }`. Reading `hostname` or `port` throws.
