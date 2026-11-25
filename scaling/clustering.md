---
title: Clustering
description: 'Run a Netify server on every CPU core with Cluster. The processes share one port and come back when they crash.'
---

# Clustering

A Bun process runs your JavaScript on one core. `Cluster` starts your server script several times, one process per core by default, and they all listen on the same port.

::: code-group

```ts twoslash [cluster.ts]
import { Cluster } from '@netifyjs/netify'

const cluster = new Cluster({
  script: `${import.meta.dir}/server.ts`,
  workers: 4,
}).start()

process.on('SIGTERM', (): void => {
  void cluster.stop()
})
```

```ts twoslash [server.ts]
import {
  Cluster,
  InboundHandlerAdapter,
  ServerBootstrap,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Echoes everything back
 * @class
 */
class EchoHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Queues the reply
   * @param context the connection
   * @param message what came in
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    context.writeSync(message)
  }

  /**
   * One flush per read batch
   * @param context the connection
   */
  public override channelReadComplete(context: HandlerContext): Promise<void> {
    return context.flush()
  }
}

await new ServerBootstrap()
  .options({ reusePort: true })
  .childHandler((channel: Channel): void => {
    channel.pipeline.addLast<EchoHandler>('echo', new EchoHandler())
  })
  .bind({ port: 7000 })

console.log(
  `worker ${String(Cluster.workerId)} of ${String(Cluster.workerCount)}`,
)
```

:::

Run `bun cluster.ts`. The parent only starts and stops processes. The server is a normal Netify server with one change: it binds with `reusePort: true`. Leave that out and the first worker gets the port while the rest fail to bind. `WebSocketBootstrap` takes the same option.

A worker can read its index from `Cluster.workerId` and the total from `Cluster.workerCount`. Both are null when you run `server.ts` on its own, which means the same file works locally and in production. The index is handy for tagging log lines, or for picking a single worker to run a scheduled job. The other options are under [`ClusterOptions`](/reference/options#clusteroptions).

## Restarts

If a worker dies, the cluster starts a new one with the same index, whatever the exit code. `stop` switches that off first, which is why nothing comes back afterwards.

The first crash brings the worker back straight away. If it keeps dying within ten seconds of starting, like when its port is taken, the cluster waits between tries. It starts at 250 ms and doubles up to 10 s, and resets after a worker has stayed up for ten seconds. `Cluster.ready()` has no say in this.

While you're developing, `restart: false` shows you the first error without the repeats.

## Stopping without dropping players

`stop` sends each worker `SIGTERM`, then kills any still running after `stopTimeout` (10 seconds by default). Workers hear about it through `Cluster.onStop`. From there, `shutdownGracefully` stops taking connections and fires a `ShutdownEvent` on every channel. Anything still open when time runs out gets closed.

```ts twoslash
import {
  Cluster,
  InboundHandlerAdapter,
  ServerBootstrap,
  ShutdownEvent,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Warns players before the server goes
 * @class
 */
class Goodbye extends InboundHandlerAdapter<unknown> {
  /**
   * Sends the warning and leaves
   * @param context the connection
   * @param event what happened
   */
  public override userEventTriggered(
    context: HandlerContext,
    event: unknown,
  ): void {
    if (!(event instanceof ShutdownEvent)) return

    context.writeAndFlushSync('server restarting\n')
    void context.close()
  }
}

const server = await new ServerBootstrap()
  .options({ reusePort: true })
  .childHandler((channel: Channel): void => {
    channel.pipeline.addLast<Goodbye>('goodbye', new Goodbye())
  })
  .bind({ port: 7000 })

Cluster.ready()
Cluster.onStop((): Promise<void> => server.shutdownGracefully(8000))
```

Keep the graceful timeout below `stopTimeout`, or the parent kills the worker before it's done. If the callback throws or rejects, the worker logs `Stop callback failed` and exits with code 1. `WebSocketServer` has the same `shutdownGracefully`.

## Deploying new code

`reload` swaps the workers one at a time. By default it starts the new worker, waits for it to call `Cluster.ready()`, then stops the old one. That way the shared port always has someone listening.

```ts
process.on('SIGHUP', (): void => {
  cluster.reload().catch((error: unknown): void => {
    console.error(error)
  })
})
```

If each worker has its own port, as with [sharding](/scaling/sharding) or UDP, the new worker can't bind until the old one is gone. Pass `'stop-first'` there. Players on that worker reconnect and the other workers carry on.

If a new worker crashes, or doesn't call `Cluster.ready()` within `readyTimeout` (10 seconds by default), `reload` stops and rejects with `Worker is not ready`. With the default order the old worker is still running and the other slots aren't touched. A bad build leaves you where you started. With `'stop-first'` the old worker's already gone, and the normal restarts keep trying that slot. `reload` needs your workers to call `Cluster.ready()`.

Calling `reload` while one's running rejects with `Cluster is reloading`. Calling `stop` mid-reload makes it reject with `Cluster is not running`.

`cluster.whenReady()` waits for every worker the same way, which is handy in a start script.

## Workers share nothing

The kernel picks which worker accepts a connection, and the connection stays on that worker for life. Workers are separate processes. A `ChannelGroup`, channel attribute or room in one knows nothing about the others.

Games usually put everyone who interacts on the same worker. Give each worker its own port and have the lobby tell clients where to connect. When workers need to message each other, use [`ShardLink`](/scaling/sharding).

## UDP on several cores

Bun's UDP socket can't share a port between processes. Each worker binds its own, and clients either pick one from the list or get one from the lobby.

```ts twoslash
import {
  Cluster,
  DatagramBootstrap,
  type DatagramChannel,
} from '@netifyjs/netify'

await new DatagramBootstrap()
  .handler((channel: DatagramChannel): void => {})
  .bind({ port: 9000 + (Cluster.workerId ?? 0) })

Cluster.ready()
```

Reliable UDP works the same. Restart these workers with `reload('stop-first')`.

## When to use it

`Cluster` helps once one core can't keep up and your workers don't need to share memory. On the test machine, 4 processes gave about 2.9 times the length framed throughput of one. The full numbers are on [Performance](/scaling/performance#across-cores). If workers do need shared state, [`WorkerGroup`](/scaling/workers#workergroup) runs the same layout as threads in one process. It came in about 2% slower.
