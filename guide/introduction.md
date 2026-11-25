---
title: Introduction
description: 'Netify is a networking framework for Bun modelled on Netty. Build TCP, UDP and WebSocket servers out of channels, pipelines and handlers.'
---

# Introduction

Netify is a networking framework for Bun, modelled on Netty. Here's a complete TCP echo server:

```ts twoslash
import {
  InboundHandlerAdapter,
  ServerBootstrap,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Sends back whatever it gets
 * @class
 */
class EchoHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Writes the bytes straight back
   * @param context The handler context
   * @param message The bytes
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    void context.writeAndFlush(message)
  }
}

const server = await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline.addLast<EchoHandler>('echo', new EchoHandler())
  })
  .bind({ port: 9000 })
```

Each connection has a pipeline of small handler classes, and every read, write and state change goes through it. This one has a single handler that echoes. A real server puts codecs in front to turn bytes into lines, frames or objects. [Your first server](./first-server) builds this up step by step.

It's TypeScript on Bun's own sockets, with no runtime dependencies. It's at `1.0.0-alpha.6` and the API may still change before 1.0.

## What's in it

Most people start with TCP or Unix sockets, with or without TLS, through `ServerBootstrap` and `Bootstrap`. There's also UDP, reliable UDP with per lane delivery modes for games, and WebSocket as either TCP codecs or a `Bun.serve` server with rooms. HTTP/1.1 is codecs only, with no router. The [transport pages](/transports/tcp) cover each one.

Codecs cover the usual framing (lines, delimiters, fixed length and length fields) plus strings, MessagePack and Protobuf. Built-in handlers deal with idle detection, timeouts, flush batching and logging. `Cluster` and `WorkerGroup` spread a server across cores.

## Who it's for

It's for people who design their own protocols: game servers, chat, proxies, device gateways. If you've written a `data` callback that slices buffers by hand and holds on to half a message, Netify replaces that code.

For a website or a JSON API, use a web framework. The HTTP codecs are for when HTTP is one protocol among several, or a game server needs a small endpoint on the side.

## Coming from Netty

Most class names carry over. [From Netty](/migrating/netty) has the full mapping and the few things that behave differently.
