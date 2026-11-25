---
title: Worker threads
description: 'Move CPU heavy work off the event loop with WorkerPool and OffloadHandler, or run one server on several threads with WorkerGroup.'
---

# Worker threads

Every handler on a server runs on one thread. While one of them chews on CPU work, nothing else on that thread can read sockets, flush writes or fire timers. You have two ways out. `WorkerPool` with `OffloadHandler` keeps one server and sends the heavy jobs to other threads. `WorkerGroup` runs a whole server on each thread, like [Clustering](/scaling/clustering) does with processes.

It depends where the time goes. If a few message types do expensive work like pathfinding or image processing, offload them. If the load comes from lots of connections, run more copies, and prefer `Cluster` unless the copies need to share memory.

## WorkerPool

A pool starts a fixed number of threads, and each runs a script that answers jobs. The script wraps a task function in a `WorkerService`. On the main thread, `run` sends a job to the least busy thread and resolves with its answer.

::: code-group

```ts twoslash [main.ts]
import { WorkerPool } from '@netifyjs/netify'

/**
 * A path to find
 */
type Route = {
  /**
   * Start tile
   */
  readonly from: number
  /**
   * End tile
   */
  readonly to: number
}

const pool = new WorkerPool<Route, number[]>({
  script: `${import.meta.dir}/pathfinder.ts`,
  workers: 4,
})

const path = await pool.run({ from: 12, to: 840 })

await pool.close()
```

```ts twoslash [pathfinder.ts]
import { WorkerService } from '@netifyjs/netify'

/**
 * A path to find
 */
type Route = {
  /**
   * Start tile
   */
  readonly from: number
  /**
   * End tile
   */
  readonly to: number
}

new WorkerService<Route, number[]>((route: Route): number[] => [
  route.from,
  route.to,
]).listen()
```

:::

Jobs and results cross between threads by structured clone. To hand over a buffer you're done with without copying it, pass it in the second argument: `pool.run(input, [input.buffer])`. If the task throws, `run` rejects with the same message. If the input or output can't be cloned, it rejects with `Input is invalid` or `Output is invalid`. A thread that dies fails its jobs with `Worker failed`, and the pool starts a new one. It waits longer between tries if they keep dying. Once `maxQueued` jobs are in flight (1024 by default), the pool rejects with `Pool is full`. The other options are under [`WorkerPoolOptions`](/reference/options#workerpooloptions).

## OffloadHandler

In a server you'll rarely call `run` yourself. `OffloadHandler` sits in the pipeline and sends each message that passes its `accepts` guard to the pool. The result carries on down the pipeline in place of the message.

```ts twoslash
import {
  ByteBuf,
  InboundHandlerAdapter,
  LengthFieldBasedFrameDecoder,
  LengthFieldPrepender,
  OffloadHandler,
  ServerBootstrap,
  WorkerPool,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Copies frames out so they can cross to a thread
 * @class
 */
class BytesHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Hands on a plain copy of the frame
   * @param context where to pass it
   * @param message a frame
   */
  public override channelRead(
    context: HandlerContext,
    message: unknown,
  ): void | Promise<void> {
    if (!(message instanceof ByteBuf)) return context.fireChannelRead(message)

    return context.fireChannelRead(message.readBytes(message.readableBytes))
  }
}

/**
 * Sends the results back
 * @class
 */
class ReplyHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Queues a result
   * @param context the connection
   * @param message what the thread sent back
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    context.writeSync(message)
  }

  /**
   * One flush per batch
   * @param context the connection
   */
  public override channelReadComplete(context: HandlerContext): Promise<void> {
    return context.flush()
  }
}

const pool = new WorkerPool<Uint8Array, Uint8Array>({
  script: `${import.meta.dir}/work.ts`,
  workers: 4,
  maxQueued: 64 * 1024,
})

await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addLast<LengthFieldBasedFrameDecoder>(
        'framer',
        new LengthFieldBasedFrameDecoder({
          maxFrameLength: 64 * 1024,
          lengthFieldLength: 4,
          initialBytesToStrip: 4,
        }),
      )
      .addLast<LengthFieldPrepender>(
        'prepender',
        new LengthFieldPrepender({ lengthFieldLength: 4 }),
      )
      .addLast<BytesHandler>('bytes', new BytesHandler())
      .addLast<OffloadHandler<Uint8Array, Uint8Array>>(
        'work',
        new OffloadHandler<Uint8Array, Uint8Array>({
          pool,
          accepts: (message: unknown): message is Uint8Array =>
            message instanceof Uint8Array,
          maxInFlight: 64,
        }),
      )
      .addLast<ReplyHandler>('reply', new ReplyHandler())
  })
  .bind({ port: 7000 })
```

Results come out in the order their messages went in, even if a later job finishes first. Messages that fail the guard pass straight through, but they still wait behind any jobs ahead of them. A failed job goes to `exceptionCaught`. The `offload` server in [netifyjs/benchmarks](https://github.com/netifyjs/benchmarks) is laid out like this.

Share one pool across the server, but give each channel its own `OffloadHandler`. The handler tracks order for one connection. A `ByteBuf` can't cross to another thread, which is why `BytesHandler` copies each frame into a `Uint8Array` first.

Watch out for `maxQueued`. It counts jobs across the whole pool. `maxInFlight` counts them per connection and pauses reads when it's hit. With the defaults of 1024 and 16, 64 busy connections fill the pool and the next job fails with `Pool is full`. Set `maxQueued` to at least your connection count times `maxInFlight`, like the example does.

Offloading pays off when each job is expensive. With 200 µs of work per message, 4 workers took the server from 5k to 18.3k messages a second, and 8 workers got it to 36.4k. For a job of a few microseconds, the copy there and back costs more than the work. Profile first.

## WorkerGroup

`WorkerGroup` runs one server script on several threads in the same process. The script binds with `reusePort: true`, same as in a cluster. What you get from threads is shared memory through a `SharedArrayBuffer`.

::: code-group

```ts twoslash [main.ts]
import { WorkerGroup } from '@netifyjs/netify'

const shared = new SharedArrayBuffer(4)

const group = new WorkerGroup({
  script: `${import.meta.dir}/server.ts`,
  workers: 4,
  shared,
  env: { PORT: '7000' },
}).start()

setInterval((): void => {
  console.log(`${String(Atomics.load(new Int32Array(shared), 0))} connections`)
}, 1000)
```

```ts twoslash [server.ts]
import {
  ByteBuf,
  Cluster,
  InboundHandlerAdapter,
  ServerBootstrap,
  WorkerGroup,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

const counter = new Int32Array(await WorkerGroup.shared())

/**
 * Counts connections across every thread
 * @class
 */
class CountHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Bumps the shared counter and says hello
   * @param context the connection
   */
  public override channelActive(context: HandlerContext): Promise<void> {
    Atomics.add(counter, 0, 1)

    return context.writeAndFlush(
      ByteBuf.fromString(`thread ${String(Cluster.workerId)}\n`),
    )
  }
}

await new ServerBootstrap()
  .options({ reusePort: true })
  .childHandler((channel: Channel): void => {
    channel.pipeline.addLast<CountHandler>('count', new CountHandler())
  })
  .bind({ port: Number(Bun.env.PORT) })
```

:::

Inside a thread, `WorkerGroup.shared()` resolves with the buffer once the parent sends it. Only call it if the group was given `shared`, or the promise never settles. Anything more than one thread writes to needs `Atomics`. `Cluster.workerId` and `Cluster.workerCount` work in threads too.

When a thread dies, the group logs it and starts a new one with the same id and shared memory. If it keeps dying within ten seconds of starting, the group waits between tries, from 250 ms up to 10 s. Pass `restart: false` to turn that off, or a `logger` to send the reports somewhere other than the console.

`group.stop()` terminates threads straight away. If a thread needs to clean up first, register a callback with `WorkerGroup.onStop`. It gets `stopTimeout` (10 seconds by default) before it's terminated.

```ts
WorkerGroup.onStop((): Promise<void> => server.shutdownGracefully(8000))
```

Shared memory is raw bytes. It's good for counters, rate limits and lookup tables. You can't put a `ChannelGroup` or any other object in it, and players on different threads still can't share a broadcast group. [Game servers](/scaling/games#sharding-zones-across-cores) shows how to keep players who see each other together.

## Threads or processes

On the framed TCP benchmark, 4 threads ran about 2% behind 4 processes. The bigger difference shows up when something breaks. A crashed process only takes itself down, and `Cluster` starts it again. `WorkerGroup` restarts a thread that throws, but a thread that takes the runtime down takes every other thread with it. Default to `Cluster`. Switch to `WorkerGroup` if you need the shared memory or want to deploy a single process. The benchmark commands are on [Performance](/scaling/performance#running-the-benchmarks).
