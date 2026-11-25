---
title: Sharding game worlds
description: 'Split a game world over processes with ShardMap and ShardLink. Each shard gets its own port, and players move between shards with a token.'
---

# Sharding

[Clustering](/scaling/clustering) spreads connections over cores at random. That's fine when any process can handle any client, but a game world doesn't work like that. Players in the same zone have to be in the same process to see each other and share one `ChannelGroup`. Sharding gives each process its own part of the world and its own port.

There are two classes for it. `ShardMap` decides which shard owns a zone. `ShardLink` carries messages, requests and players between shards.

## Starting the shards

The parent is a normal `Cluster`. Each shard reads its index, gets its port from a `ShardMap` and opens a `ShardLink`.

::: code-group

```ts twoslash [cluster.ts]
import { Cluster } from '@netifyjs/netify'

new Cluster({
  script: `${import.meta.dir}/shard.ts`,
  workers: 4,
}).start()
```

```ts twoslash [shard.ts]
import {
  Cluster,
  ServerBootstrap,
  ShardLink,
  ShardMap,
  type Channel,
} from '@netifyjs/netify'

export const shards = new ShardMap({ count: 4, port: 7000 })
export const link = await ShardLink.open()

await new ServerBootstrap()
  .childHandler((channel: Channel): void => {})
  .bind({ port: shards.portOf(link.id) })

Cluster.ready()
```

:::

Shard 0 listens on 7000, shard 1 on 7001 and so on. Leave `reusePort` off, because each shard needs its own port. Pick ports below 32768. Linux uses 32768 and up for outgoing connections, and if one grabs a shard's port while it's down, the shard can't bind when it restarts. Deploy new code with `cluster.reload('stop-first')`, which lets each shard free its port before the new one binds.

## Finding a zone's shard

`shardOf` takes a zone id or name and returns the shard that owns it. Every process gets the same answer. A login server can use the same map to tell a client where to connect.

```ts twoslash
import { ShardMap } from '@netifyjs/netify'

const shards = new ShardMap({ count: 4, port: 7000 })

shards.shardOf('forest')
shards.portFor('forest')
shards.shardOf(12)
```

Numbers go round the shards in order. Zone 12 lands on shard 0 and zone 13 on shard 1. Strings get hashed.

## Messages

`send` goes to one shard and `broadcast` to all the others. Listeners get the data and the shard it came from.

```ts twoslash
import { ShardLink } from '@netifyjs/netify'

const link = await ShardLink.open()

link.on('chat', (data: unknown, from: number): void => {
  console.log(`shard ${String(from)} says`, data)
})

link.send(2, 'chat', { text: 'hello' })
link.broadcast('chat', { text: 'server restarting soon' })
```

Data is copied with structured clone. Plain objects, arrays, `Uint8Array` and `Map` arrive intact, and class instances turn into plain objects.

## Requests

`handle` answers a topic. `request` asks a shard and waits for the answer. Responders can return a value or a promise, and if one throws, the request rejects with the same message.

```ts twoslash
import { ShardLink } from '@netifyjs/netify'

const link = await ShardLink.open()

const online = new Set<string>(['ana'])

link.handle('online', (name: unknown): boolean => online.has(String(name)))

const found = await link.request<boolean>(3, 'online', 'ana')
```

A request fails with `Request timed out` after 5 seconds. If the target process isn't running, it fails with `Shard is down` straight away. Set `timeout` on the link to change the wait.

## Moving a player

Say a player walks into a zone on another shard. The old shard calls `handoff`, which keeps a copy of their state and returns a token. The old shard gives the client that token and the new port. The client reconnects and sends the token, and the new shard calls `claim` to fetch the state from the old shard.

```ts twoslash
import { ShardLink, ShardMap } from '@netifyjs/netify'

const shards = new ShardMap({ count: 4, port: 7000 })
const link = await ShardLink.open()

type Player = { name: string; x: number; y: number }

const player: Player = { name: 'ana', x: 10, y: 4 }
const target = shards.shardOf('desert')
const token = link.handoff(target, player)

const arrived = await link.claim<Player>(token)
```

`claim` works once per token, and only on the shard the player was sent to. After that, or after 30 seconds, it returns null. Set `handoffTimeout` on the link to change the time.

`handoff` copies the state when you call it. Changes you make to the object afterwards don't travel.

The old shard decides who has the player. It keeps the state until the new shard says it arrived. If `claim` returns null or rejects, send the player back to the old shard with the same token and call `recall`.

```ts twoslash
import { ShardLink } from '@netifyjs/netify'

const link = await ShardLink.open()

type Player = { name: string; x: number; y: number }

declare const token: string
// ---cut---
const player = await link.recall<Player>(token)
```

Whichever of `claim` and `recall` reaches the old shard first gets the player, and the other gets null. Nobody ends up on two shards, even if the network between them drops.

If the new shard took the player and then crashed, `recall` waits for it to restart and gives the player back. It rejects with `Shard is down` if the new shard stays unreachable for the request `timeout`. The old shard can't tell a dead shard from a cut cable, and it won't guess.

## Stopping a shard

A shard has to stay up until the players it handed off have been claimed. Wait for `drain` before you close the link.

```ts twoslash
import { Cluster, ShardLink } from '@netifyjs/netify'

const link = await ShardLink.open()
// ---cut---
Cluster.onStop(async (): Promise<void> => {
  await link.drain()
  await link.close()
})
```

`drain` resolves once every handed off player has arrived, been recalled or timed out.

## When a shard crashes

`Cluster` brings a crashed shard back straight away, but it comes back empty. Its players get disconnected, and when they reconnect the new process has never heard of them. Anything you can't afford to lose, like inventory, belongs in a database you load from on rejoin.

Requests to a dead shard fail with `Shard is down` the moment its connection drops. Anything still queued for it is thrown away.

`handoff` doesn't talk to the new shard, and it works even if that shard is down. The player finds out when they can't connect or `claim` returns null, and `recall` puts them back where they were.

If the old shard dies before the claim, the player goes down with it like everyone else there, and `claim` rejects with `Shard is down`. If the new shard dies partway through a claim, `recall` brings the player back to the old one.

Recalling after a crash relies on each shard address belonging to one live process. `Cluster` restarts a shard only after the old process has gone. If you run shards yourself, don't start a replacement on the same address while the old one might still be running.

A player who's fully arrived lives on the new shard, and goes down with it like everyone else there.

The `chaos` benchmark checks all of this. Bots walk between zones and compare their state after every handoff while random shards get `SIGKILL`ed. One run had 2000 players on 4 shards for 30 seconds, with a shard killed every second and almost every step crossing into another shard. That came to about 440,000 handoffs at a 7 ms median. A few thousand per run were caught by a kill on the new shard and recalled by the old one. A few hundred were waiting on an old shard that got killed and went down with it, and under 100 had finished arriving when their new shard was killed. Both are the same as any crash. No state came back wrong, and nobody turned up on two shards. Disconnected players were back in about 250 ms.

## Gateways

If you'd rather keep the whole world in one process, a [`Gateway`](/scaling/games#gateways) spreads just the socket writes over the other shards.

## Across machines

By default each shard listens on a Unix socket named after its cluster. Shards connect to each other directly the first time they send. To spread a world over several machines, give every shard the same list of addresses and its own `id`. Each one listens on its own entry and dials the rest.

```ts twoslash
import { ShardLink, type ShardPeer } from '@netifyjs/netify'

const peers: ShardPeer[] = [
  { hostname: '10.0.0.1', port: 7400 },
  { hostname: '10.0.0.1', port: 7401 },
  { hostname: '10.0.0.2', port: 7400 },
  { hostname: '10.0.0.2', port: 7401 },
]

const link = await ShardLink.open({ id: Number(Bun.env.SHARD), peers })
```

`send`, `request` and `handoff` work as they do on one machine. Requests to a shard that can't be reached fail with `Shard is down`, and the next message tries to connect again. The links aren't encrypted. Keep them on a private network.

## Cost

Messages sent in the same tick go out together as one frame per shard. On the benchmark machine, two shards on one host passed about 3 million messages a second one way. With many requests in flight they answered about 470,000 a second. A single request waiting on its reply takes about 95 µs. That's plenty for handoffs, chat, lookups and events between zones. Per tick game state should still stay inside the shard that owns it.

Outside a cluster and without `peers`, `ShardLink` runs as a lone shard 0 and delivers messages to itself in the same process. The same code runs on your laptop and on a server with 16 shards.
