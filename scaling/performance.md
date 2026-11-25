---
title: Performance and benchmarks
description: 'Netify measured against Netty, ZeroMQ, gRPC, Moleculer, NestJS, Colyseus and Socket.IO, with the commands to run the benchmarks yourself.'
---

# Performance

## The machine

Every number here comes from one machine. Run the benchmarks on your own hardware before you plan capacity around them.

| Part     | What                                    |
| -------- | --------------------------------------- |
| CPU      | AMD Ryzen 7 7800X3D                     |
| OS       | Windows with WSL2                       |
| Runtime  | Bun 1.4.x                               |
| Messages | 64 bytes unless it says otherwise       |
| Load     | Bun load generators on the same machine |

WSL2 loopback adds kernel cost, and the load generators eat cores the server could use. A dedicated Linux box would do better on both counts.

## Against other frameworks

The framework suite in [netifyjs/benchmarks](https://github.com/netifyjs/benchmarks) writes each server the usual way for its framework, and the same Bun load generator drives them all. Every figure is the median of three runs. ZeroMQ runs on Node 24 because its native addon won't load in Bun. Netty runs on Java 21. Everything else runs on Bun with compression off.

Striped bars are raw APIs like `Bun.listen` and `node:net`. They don't do framing, routing or connection handling, and they're there to show the ceiling.

### TCP

64 clients each keep 32 length framed messages of 64 bytes in flight. When the replies come back, they send the next batch in one write, much like a busy game client sending several updates per tick.

<BenchChart group="tcp" title="TCP echo on one core" :baselines="['Bun.listen', 'node:net']" caption="64 clients with 32 length framed messages in flight" />

Netify's side is a full pipeline: a length field decoder, a prepender and an echo handler. That comes to 88% of a hand-written `Bun.listen` server doing the same framing, about 17 times ZeroMQ and 23 times NestJS.

On 4 cores, ten load processes drive 160 clients. Netify runs 4 processes sharing the port through [`Cluster`](/scaling/clustering). Netty runs 4 event loops in one JVM, and `node:net` and perfect-net use `node:cluster`.

<BenchChart group="tcpcores" title="TCP echo on 4 cores" :baselines="['Bun.listen', 'node:net']" caption="160 clients from ten load processes, 32 messages in flight" />

### Netty

Netify copies Netty's design, so this is the comparison that matters most. The server is Netty 4.2.21 on Java 21 with native epoll, the same three handlers as Netify's server, and void promises for its writes. You can read it in [`Server.java`](https://github.com/netifyjs/benchmarks/blob/main/frameworks/servers/tcp/netty/Server.java). It gets 5 seconds of warm-up against 1 for everything else, so the JIT has settled before counting starts. The JVM runs with its default flags.

On this machine Netify came out about 1.6 times ahead of Netty, on one core and on four. Read that carefully. The load generator is Bun on the same machine, and on WSL2 loopback the kernel is the biggest cost for every server. Netty has years of tuning for big Linux servers with real network cards, and on that kind of hardware the gap could shrink or flip. It's also one test of small messages. If Netty runs your stack today, measure your own workload before you switch.

perfect-net is a networking library built on the Effect-style runtime from `@spilne/perfect-core`. Every message goes through its stream and effect machinery, and that shows on an echo of tiny messages. Its strengths are typed messages and testing against a simulated network.

### WebSocket

Echo uses 64 clients, each with 32 binary messages of 64 bytes in flight.

<BenchChart group="websocket" title="WebSocket echo" :baselines="['uWebSockets.js', 'ws']" caption="64 clients with 32 binary messages in flight" />

Broadcast sends 64 byte messages to one room of 1000 clients for three seconds and counts what arrives. Netify publishes to a native topic and Bun fans it out in native code. Colyseus and Socket.IO loop over their sockets in JavaScript. Broadcast results move by about 20% from one run to the next, so read them as a range.

<BenchChart group="websocket" kind="broadcast" title="Room broadcast" unit="deliveries/s" :baselines="['uWebSockets.js', 'ws']" caption="One room of 1000 clients, counted on arrival" />

### UDP and HTTP

Nothing in the same class exists for UDP or plain HTTP, so these sit next to the raw APIs. UDP echo keeps 32 datagrams of 64 bytes in flight on each of 64 sockets. Netify matches a raw `Bun.udpSocket` server that batches its replies the same way.

<BenchChart group="udp" title="UDP echo" :baselines="['Bun.udpSocket', 'node:dgram']" caption="64 sockets with 32 datagrams in flight" />

HTTP keeps 16 pipelined `GET /` requests in flight on each of 64 keep-alive connections, the same shape as the TechEmpower plaintext test. The server runs `HttpServerCodec`, `HttpObjectAggregator` and a handler that checks the method and path.

<BenchChart group="http" title="HTTP plaintext" unit="req/s" :baselines="['Bun.serve', 'node:http']" caption="64 keep-alive connections with 16 pipelined requests" />

### Running it

```sh
git clone https://github.com/netifyjs/benchmarks
cd benchmarks
bun install
BENCH_LOADS=6 bun run frameworks
```

The README there shows how to run them against a local copy of Netify.

Pass `tcp`, `udp`, `http`, `websocket`, `tcpcores`, `httpcores` or `websocketcores` to run one group, or a list like `tcp/netify,tcp/netty` to pick servers. `BENCH_RUNS` sets the runs behind each median (3 by default). `NODE_BIN` points the Node servers at a different `node` from the one on your path. Results go to `frameworks/results.json`, which this site reads at build time.

Netty needs Java 21 and its jars. The setup script downloads them from Maven Central.

```sh
bun frameworks/servers/tcp/netty/setup.ts
JAVA_BIN=/path/to/java bun run frameworks tcp/netty,tcpcores/netty
```

## Across cores

Netify on 4 processes sharing one port with [`Cluster`](/scaling/clustering). Ten load processes drive 160 connections to give the extra cores work.

| Test           | 1 core      | 4 cores     |
| -------------- | ----------- | ----------- |
| TCP echo       | 2.48M msg/s | 7.25M msg/s |
| UDP echo       | 154k msg/s  | 746k msg/s  |
| HTTP plaintext | 231k req/s  | 819k req/s  |
| WebSocket echo | 1.22M msg/s | 1.70M msg/s |

The load generators share the machine with the server, which is why 4 cores give about three times one core for TCP, and three and a half for HTTP. WebSocket gains less because its clients cost more to run, and on this machine they run out of steam first. UDP runs one port per worker, since Bun's UDP socket can't share a port between processes. The load spreads its sockets over the four ports.

## Between shards

Two shards on one machine, linked by [`ShardLink`](/scaling/sharding) over Unix sockets.

| Test                             | Result       |
| -------------------------------- | ------------ |
| Messages, one way                | About 3M/s   |
| Requests with many in flight     | About 470k/s |
| One request waiting on its reply | About 95 µs  |

Most of that throughput comes from batching. Messages sent in the same tick go out as one frame per shard.

## Threads and offloading

| Setup                               | Result                      |
| ----------------------------------- | --------------------------- |
| 4 `WorkerGroup` threads, framed     | About 2% behind 4 processes |
| 200 µs of work per message, inline  | 5.0k/s                      |
| Same, `OffloadHandler` on 4 workers | 18.3k/s                     |
| Same, on 8 workers                  | 36.4k/s                     |

[Worker threads](/scaling/workers) explains both setups and when each one fits.

## WebSocket

Netify's two WebSocket modes side by side, from the `websocket` benchmark. It drives one server with a lighter load than the framework suite.

| Server                                       | Echo          |
| -------------------------------------------- | ------------- |
| Netify `WebSocketBootstrap` (native)         | About 0.83M/s |
| Netify JavaScript codec on `ServerBootstrap` | About 0.84M/s |

Bare `Bun.serve` got the same on this load, which means the load generator is the limit here. The framework suite above pushes harder.

Broadcasting to a room of 1000 sockets, native topics reached about 1.45M deliveries a second. A `ChannelGroup` loop over the JavaScript codec reached 73k. Anything that fans out to browsers should use topics.

## Reliable UDP

| Test                                         | Result                         |
| -------------------------------------------- | ------------------------------ |
| One process, no loss                         | About 1.30M/s                  |
| One process, 5% simulated loss               | About 380k/s                   |
| Same, with congestion control                | About 686k/s                   |
| Median round trip                            | 17 µs                          |
| One process, encrypted                       | About 851k/s                   |
| 4000 peers at 30 Hz, load in other processes | About 109k/s on about one core |

In the 4000 peer run, each echoed message cost 9.7 µs of CPU, about half of it in the kernel.

## Game ticks

The `mmo` benchmark runs 5000 TCP players in zones of 50 at 20 Hz. Every tick builds a snapshot per zone and sends it with `broadcastSync`.

| Shards | Median tick |
| ------ | ----------- |
| 1      | 37 ms       |
| 4      | 13 to 16 ms |

A 20 Hz tick gets 50 ms. With one shard, about 85% of the time goes on kernel writes, one per player per tick. Faster JavaScript won't fix that. You need more cores, whether that's shards or gateways.

`mmo:gateway` keeps the world in one process and moves the sockets out to gateways. The clients time each snapshot from the start of the tick until it lands.

| Players | Layout               | Delivery, median | Delivery, p99 |
| ------- | -------------------- | ---------------- | ------------- |
| 5000    | One process          | 46 ms            | 86 ms         |
| 5000    | World and 4 gateways | 8 ms             | 15 ms         |
| 10000   | One process          | 80 ms            | 138 ms        |
| 10000   | World and 4 gateways | 16 ms            | 31 ms         |

With gateways the world only used 5 to 9% of a core.

`BENCH_REACH=1` puts each player in their zone and the two either side. Gateways send one write per player per tick however many zones they're in. Before that change, 5000 players with 4 gateways had a delivery p99 of 34 to 40 ms, and now it's about 18 ms. There's more on both layouts in [Game servers](/scaling/games#gateways).

## Running the benchmarks

They live in [netifyjs/benchmarks](https://github.com/netifyjs/benchmarks). Every benchmark runs its server in its own process, away from the load's event loop.

| Command                  | What it runs                                                      |
| ------------------------ | ----------------------------------------------------------------- |
| `bun run frameworks`     | Netify against other frameworks over TCP, UDP, WebSocket and HTTP |
| `bun run echo`           | TCP echo: raw Bun, Netify, then Netify framed                     |
| `bun run micro`          | Micro benchmarks for buffers, codecs and the pipeline             |
| `bun run cluster`        | The TCP server on several processes or threads                    |
| `bun run mmo`            | The game tick benchmark                                           |
| `bun run mmo:gateway`    | The same game with one world and gateway processes                |
| `bun run reliable`       | Reliable UDP in one process, with and without loss                |
| `bun run reliable:scale` | Many reliable UDP peers spread over load processes                |
| `bun run chaos`          | Bots handing off between shards while shards get killed           |
| `bun run websocket`      | WebSocket echo: bare Bun, native, and the JavaScript codec        |
| `bun run offload`        | `OffloadHandler` with 200 µs of work per message                  |

Most take arguments after the script name.

```sh
bun run echo raw,netify,framed 64
bun run micro buffer
bun run cluster framed 4 8 processes
bun run cluster framed 4 8 threads
bun run mmo 5000 4
bun run mmo:gateway 5000 4
bun run reliable:scale 4000 30 4
bun run websocket bun,native,netify 4
bun run offload 4
```

| Benchmark        | Arguments                                                  |
| ---------------- | ---------------------------------------------------------- |
| `echo`           | Variants, then message size in bytes                       |
| `micro`          | A pattern to filter benchmarks by name                     |
| `cluster`        | Variant, workers, load processes, `processes` or `threads` |
| `mmo`            | Players, shards                                            |
| `mmo:gateway`    | Players, gateways, `0` for one process                     |
| `reliable:scale` | Peers, messages a second per peer, load processes          |
| `chaos`          | Shards, players, ms between kills, `0` for none            |
| `websocket`      | Variants, load processes                                   |
| `offload`        | Workers, `0` for inline                                    |

`echo` opens 64 connections with 32 messages in flight on each. It warms up for a second, then measures for 5. `BENCH_ENCRYPT=1` turns on encryption for `reliable:scale`.

### CPU profiles

Set `BENCH_PROFILE` to a folder and the server runs under Bun's CPU profiler. The profiles land in that folder as Markdown.

```sh
BENCH_PROFILE=./profiles bun run echo netify
BENCH_PROFILE=./profiles bun run mmo 5000 1
```

It works with `echo`, `mmo`, `websocket` and `reliable:scale`. To profile your own server, point `BENCH_SERVER` at its script. `echo` then starts yours in place of the built in one.

## Hot paths

Each of these rules came out of a profile. Netify's own code sticks to them, and your handlers should too.

### Flush once per read batch

Every flush is a syscall, and one read from Bun often carries several messages. Queue replies in `channelRead` and flush them together in `channelReadComplete`.

```ts twoslash
import { InboundHandlerAdapter, type HandlerContext } from '@netifyjs/netify'

/**
 * Echoes with one flush per batch
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
   * Sends the batch
   * @param context the connection
   */
  public override channelReadComplete(context: HandlerContext): Promise<void> {
    return context.flush()
  }
}
```

If you can't change a handler, `FlushConsolidationHandler` batches its flushes for you.

### Use sync writes

`write` and `writeAndFlush` create a promise for every message. If nothing's going to await it, use `writeSync`, `writeAndFlushSync` or `writeAndFlushEncodedSync`. Errors still reach `exceptionCaught`.

### Stay synchronous

When a handler returns without awaiting, Netify passes the message on without creating a promise. An `async` method creates one on every call, even if it never awaits anything. Return `void` where you can. Save `async` for handlers that do real I/O.

### Read sizes without copying

Use `buffer.readableBytes`. It reads a number stored on the buffer, while `buffer.toUint8Array().length` builds a view first.

### Avoid small subarrays

A `subarray` call on Bun takes about 25 to 30 ns. That's longer than allocating a small new `Uint8Array`, and cutting lots of tiny views off a big array adds up. `ByteBuf.readSlice` shares memory without calling `subarray`. `readBytes` makes a copy.

### Fan out once

Encode a broadcast once and send the same bytes to everyone. On TCP that's `ChannelGroup.broadcastSync`, and on native WebSocket topics it's `server.publish`. Calling `writeAndFlush` in a loop runs the encoder and creates a promise for every player.

### Shard across cores

One process uses one core. [Clustering](/scaling/clustering) gives you more processes and [Worker threads](/scaling/workers) more threads. [Game servers](/scaling/games#sharding-zones-across-cores) covers splitting a game world across them.
