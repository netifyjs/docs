---
title: Metrics
description: 'Count connections, bytes, messages and handler time on a Netify server with MetricsHandler, and read rates to decide when to add shards.'
---

# Metrics

`MetricsHandler` counts what passes through every channel it's in. Put one shared instance first in each pipeline and read it with `snapshot`.

```ts twoslash
import { MetricsHandler, ServerBootstrap, type Channel } from '@netifyjs/netify'

const metrics = new MetricsHandler({ timing: true })

await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline.addFirst<MetricsHandler>('metrics', metrics)
  })
  .bind({ port: 7000 })

setInterval((): void => {
  const now = metrics.snapshot()
  console.log(
    `${String(now.connections)} players`,
    `${(now.readRate / 1024).toFixed(0)} KiB/s in`,
    `${(now.writeRate / 1024).toFixed(0)} KiB/s out`,
    `${now.averageTime.toFixed(1)} µs per message`,
  )
}, 10_000)
```

## What it counts

| Field                       | What it is                                              |
| --------------------------- | ------------------------------------------------------- |
| `connections`               | Channels open now                                       |
| `opened`, `closed`          | Channels opened and closed since the start              |
| `bytesRead`, `bytesWritten` | Bytes from and to the socket since the start            |
| `messagesRead`              | Messages that reached the handler since the start       |
| `pendingBytes`              | Bytes queued for open sockets now                       |
| `readRate`, `writeRate`     | Bytes a second since the last snapshot                  |
| `messageRate`               | Messages a second since the last snapshot               |
| `averageTime`               | Microseconds per message in the handlers after this one |
| `slowestTime`               | The slowest message since the last snapshot, in µs      |

Byte counts come from the channel. They include writes that skip the pipeline, like `ChannelGroup.broadcastSync` and native WebSocket topics. The rates, `averageTime` and `slowestTime` cover the time since the last `snapshot`, which is why you read them on a timer. Each channel also has its own `bytesRead`, `bytesWritten` and `pendingBytes`.

## Timing handlers

With `timing: true` the handler measures how long the rest of the pipeline takes per message, including any promise a handler returns. That's two clock reads per message, which is why it's off by default. If `averageTime` keeps rising, your handlers are the bottleneck. [Worker threads](/scaling/workers) or more [shards](/scaling/sharding) will help. Rising `pendingBytes` with a low `averageTime` points at slow clients or a saturated network instead.

## In a cluster

Every worker keeps its own counters. Send their snapshots to one place on a timer, say to shard 0 over [`ShardLink`](/scaling/sharding), or straight to your monitoring system.
