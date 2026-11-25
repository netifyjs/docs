---
title: Netify
titleTemplate: Netty-inspired networking for Bun
description: 'A Netty-inspired networking framework for Bun. TCP, UDP, reliable UDP and WebSocket servers with one handler model, built for game servers.'
layout: page
sidebar: false
aside: false
---

<script setup>
import Landing from './.vitepress/theme/components/landing/index.vue'
</script>

<Landing>
<template #tcp>

```ts twoslash
import {
  InboundHandlerAdapter,
  LineBasedFrameDecoder,
  ServerBootstrap,
  StringDecoder,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

class Chat extends InboundHandlerAdapter<string> {
  public override channelRead(context: HandlerContext, line: string): void {
    context.writeAndFlushSync(`${line}\n`)
  }
}

await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addLast<LineBasedFrameDecoder>(
        'lines',
        new LineBasedFrameDecoder({ maxLength: 512 }),
      )
      .addLast<StringDecoder>('text', new StringDecoder())
      .addLast<Chat>('chat', new Chat())
  })
  .bind({ port: 7000 })
```

</template>
<template #udp>

```ts twoslash
import {
  DatagramBootstrap,
  DatagramPacket,
  InboundHandlerAdapter,
  type DatagramChannel,
  type HandlerContext,
} from '@netifyjs/netify'

class Ping extends InboundHandlerAdapter<DatagramPacket> {
  public override channelRead(
    context: HandlerContext,
    packet: DatagramPacket,
  ): void {
    context.writeSync(packet.reply('pong'))
  }

  public override channelReadComplete(context: HandlerContext): Promise<void> {
    return context.flush()
  }
}

await new DatagramBootstrap()
  .handler((channel: DatagramChannel): void => {
    channel.pipeline.addLast<Ping>('ping', new Ping())
  })
  .bind({ port: 9000 })
```

</template>
<template #reliable>

```ts twoslash
import {
  InboundHandlerAdapter,
  ReliableBootstrap,
  ReliableMessage,
  type DatagramChannel,
  type HandlerContext,
} from '@netifyjs/netify'

class Game extends InboundHandlerAdapter<ReliableMessage> {
  public override channelRead(
    context: HandlerContext,
    message: ReliableMessage,
  ): void {
    if (message.lane === 0) message.reply('got it')
  }
}

await new ReliableBootstrap()
  .options({
    lanes: [
      { delivery: 'reliable-ordered' },
      { delivery: 'unreliable-sequenced' },
    ],
  })
  .handler((channel: DatagramChannel): void => {
    channel.pipeline.addLast<Game>('game', new Game())
  })
  .bind({ port: 7777 })
```

</template>
<template #websocket>

```ts twoslash
import {
  InboundHandlerAdapter,
  TextWebSocketFrame,
  WebSocketBootstrap,
  type HandlerContext,
  type WebSocketChannel,
} from '@netifyjs/netify'

class Lobby extends InboundHandlerAdapter<TextWebSocketFrame> {
  public override channelActive(context: HandlerContext): void {
    const channel = context.channel as WebSocketChannel
    channel.subscribe('lobby')
  }

  public override channelRead(
    context: HandlerContext,
    frame: TextWebSocketFrame,
  ): void {
    const channel = context.channel as WebSocketChannel
    channel.publish('lobby', frame.text())
  }
}

await new WebSocketBootstrap()
  .options({ path: '/play' })
  .childHandler((channel: WebSocketChannel): void => {
    channel.pipeline.addLast<Lobby>('lobby', new Lobby())
  })
  .bind({ port: 8080 })
```

</template>
<template #http>

```ts twoslash
import {
  FullHttpRequest,
  FullHttpResponse,
  HttpObjectAggregator,
  HttpResponseStatus,
  HttpServerCodec,
  InboundHandlerAdapter,
  ServerBootstrap,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

class Hello extends InboundHandlerAdapter<FullHttpRequest> {
  public override channelRead(
    context: HandlerContext,
    request: FullHttpRequest,
  ): void {
    const response = new FullHttpResponse(HttpResponseStatus.OK, 'hello')
    response.setContentLength(response.content.readableBytes)
    response.setKeepAlive(request.isKeepAlive())
    context.writeAndFlushSync(response)
  }
}

await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addLast<HttpServerCodec>('http', new HttpServerCodec())
      .addLast<HttpObjectAggregator>(
        'body',
        new HttpObjectAggregator(65536),
      )
      .addLast<Hello>('hello', new Hello())
  })
  .bind({ port: 8000 })
```

</template>
</Landing>
