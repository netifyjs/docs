---
title: HTTP codecs
description: "Netify's HTTP/1.x codecs for Bun, modelled on Netty's, with keep-alive, pipelining, streamed bodies and size limits."
---

# HTTP

The HTTP/1.x codecs turn bytes into requests and responses and back, like Netty's. They don't come with a router or middleware.

For a web API, use `Bun.serve`. The codecs make sense when HTTP is one protocol among several, under the WebSocket [codec](/transports/websocket#the-websocket-codec), or for an HTTP client that runs through a pipeline.

## A server

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

/**
 * Says hello with the path that was asked for
 * @class
 */
class HelloHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Answers with a plain text 200
   * @param context where the response goes
   * @param message the aggregated request
   */
  public override async channelRead(
    context: HandlerContext,
    message: unknown,
  ): Promise<void> {
    if (!(message instanceof FullHttpRequest)) return

    const response = new FullHttpResponse(
      HttpResponseStatus.OK,
      `Hello from ${message.uri}\n`,
    )
    response.headers.set('Content-Type', 'text/plain; charset=utf-8')
    response.setContentLength(response.content.readableBytes)
    response.setKeepAlive(message.isKeepAlive())
    await context.writeAndFlush(response)

    if (!message.isKeepAlive()) await context.close()
  }

  /**
   * Drops the connection on a bad request
   * @param context the connection
   * @param error what went wrong
   */
  public override async exceptionCaught(
    context: HandlerContext,
    error: unknown,
  ): Promise<void> {
    console.error(error)
    await context.close()
  }
}

await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addLast<HttpServerCodec>('codec', new HttpServerCodec())
      .addLast<HttpObjectAggregator>(
        'aggregator',
        new HttpObjectAggregator(64 * 1024),
      )
      .addLast<HelloHandler>('hello', new HelloHandler())
  })
  .bind({ port: 8080 })
```

`HttpServerCodec` decodes requests and encodes responses. `HttpObjectAggregator` joins each request's head and body into one `FullHttpRequest`. Its argument is the largest body it'll accept. Anything bigger gets a `413` and the connection closes. Keep the limit as small as you can.

The encoder only writes the headers you set, which means every response needs `setContentLength` or a chunked body. The codec also never closes a connection by itself. If a request isn't keep-alive, close the channel once the response is written.

Bad input reaches `exceptionCaught` as a `DecoderError`. The decoder ignores the rest of the connection after that, so close the channel there.

## A client

```ts twoslash
import {
  Bootstrap,
  FullHttpRequest,
  FullHttpResponse,
  HttpClientCodec,
  HttpMethod,
  HttpObjectAggregator,
  InboundHandlerAdapter,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Prints each response
 * @class
 */
class PrintHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Prints the status and body
   * @param context unused
   * @param message the aggregated response
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (!(message instanceof FullHttpResponse)) return

    console.log(message.status.toString())
    console.log(message.content.toString())
  }
}

const channel = await new Bootstrap()
  .handler((child: Channel): void => {
    child.pipeline
      .addLast<HttpClientCodec>('codec', new HttpClientCodec())
      .addLast<HttpObjectAggregator>(
        'aggregator',
        new HttpObjectAggregator(1024 * 1024),
      )
      .addLast<PrintHandler>('print', new PrintHandler())
  })
  .connect({ hostname: '127.0.0.1', port: 8080 })

const request = new FullHttpRequest(HttpMethod.GET, '/greeting')
request.headers.set('Host', '127.0.0.1:8080')
await channel.writeAndFlush(request)
```

The client codec remembers each request's method. That's how it copes with a `HEAD` response that has a `Content-Length` and no body. You can pipeline requests on one connection, and responses match up in order. The encoder doesn't add a `Host` header for you.

## Streaming a body

Without the aggregator, a message arrives in pieces. First an `HttpRequest` or `HttpResponse` with the head, then any number of `HttpContent` chunks, then a `LastHttpContent`. You always get a `LastHttpContent`, even with no body. Handle the pieces yourself when bodies are too big to hold in memory.

Writing works the same way.

```ts twoslash
import {
  HttpContent,
  HttpResponse,
  HttpResponseStatus,
  LastHttpContent,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Streams a body in three chunks
 * @param context where the response goes
 */
export const stream = async (context: HandlerContext): Promise<void> => {
  const head = new HttpResponse(HttpResponseStatus.OK)
  head.headers.set('Transfer-Encoding', 'chunked')

  await context.write(head)
  await context.write(new HttpContent('one '))
  await context.write(new HttpContent('two '))
  await context.writeAndFlush(new LastHttpContent('three'))
}
```

With `Transfer-Encoding: chunked` on the head, each `HttpContent` goes out as a chunk and `LastHttpContent` ends the body. Without it, the pieces go out back to back and the head needs a `Content-Length`.

## Messages and headers

```ts twoslash
import {
  FullHttpRequest,
  FullHttpResponse,
  HttpMethod,
  HttpResponseStatus,
} from '@netifyjs/netify'

const request = new FullHttpRequest(HttpMethod.POST, '/scores', '{"score":10}')
request.headers.set('Content-Type', 'application/json')
request.setContentLength(request.content.readableBytes)

const created = new FullHttpResponse(HttpResponseStatus.valueOf(201))
console.log(created.status.reasonPhrase, request.isKeepAlive())
```

Constructors take the required parts first. The version defaults to HTTP/1.1. A body can be a string, a `Uint8Array` or a `ByteBuf`. `HttpResponseStatus` has constants for common codes, and `valueOf` covers the rest with the standard reason phrase.

`HttpHeaders` keeps headers in arrival order, with case-insensitive names. `set` and `add` throw a `TypeError` if a value has a line break or a null byte. That blocks header injection from user input.

The full list of classes is in [HTTP codecs](/reference/api#http-codecs).

## Limits

```ts twoslash
import { HttpServerCodec } from '@netifyjs/netify'

const codec = new HttpServerCodec({
  maxInitialLineLength: 2048,
  maxHeaderSize: 4096,
  maxChunkSize: 64 * 1024,
})
```

Both codecs take these limits. The defaults are in [`HttpDecoderOptions`](/reference/options#httpdecoderoptions). `maxChunkSize` caps each piece the decoder passes on. Bigger chunks get split into several pieces, like Netty does.

The decoder rejects requests that could be read two ways. That means an empty or non-numeric `Content-Length`, a broken `Transfer-Encoding`, either header folded onto a second line, or control characters in the target. If a request has both `Transfer-Encoding: chunked` and `Content-Length`, it's read as chunked and gets `Connection: close`. After the aggregator sends a 413, nothing more from that connection reaches your handlers.

The decoders also reject a `Content-Length` that isn't a number or shows up twice with different values. On a request, they reject any `Transfer-Encoding` other than chunked. Request smuggling happens when a server and a proxy read an ambiguous length differently. For limits on the rest of the stack, see [Safety limits](/scaling/safety).
