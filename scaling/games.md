---
title: Game servers in JavaScript
description: 'Build a multiplayer game server on Bun with Netify. The tick loop, sync writes, packed state, picking a transport and sharding zones.'
---

# Game servers

Most real time game servers run the same loop. Player input changes the world as it arrives. A timer fires 20 or 30 times a second and sends each player the part of the world they can see. Input is cheap. Keeping the tick cheap is the hard part. The examples follow the `mmo` server in [netifyjs/benchmarks](https://github.com/netifyjs/benchmarks), which runs 5000 players in zones of 50 at 20 ticks a second.

## The tick

```ts twoslash
import {
  AttributeKey,
  BitWriter,
  ByteBuf,
  ChannelGroup,
  InboundHandlerAdapter,
  LengthFieldBasedFrameDecoder,
  Quantizer,
  ServerBootstrap,
  type Channel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Positions from -2048 to 2048 in 20 bits, about 4 mm a step
 */
const position = new Quantizer({ min: -2048, max: 2048, bits: 20 })

/**
 * Players who can see each other
 * @class
 */
class Zone {
  /**
   * Most players in one zone
   */
  public static readonly capacity: number = 50

  /**
   * The players' channels
   */
  public readonly group: ChannelGroup

  /**
   * The players
   */
  public readonly players: Set<Player>

  /**
   * Starts empty
   */
  public constructor() {
    this.group = new ChannelGroup()
    this.players = new Set<Player>()
  }

  /**
   * Packs every player into one frame and sends it to the zone
   */
  public broadcast(): void {
    const size = this.players.size * 7
    const snapshot = ByteBuf.allocate(4 + size)
    snapshot.writeUint16(2 + size).writeUint16(this.players.size)

    const bits = new BitWriter(snapshot)
    for (const player of this.players) {
      bits
        .write(player.id, 16)
        .write(position.encode(player.x), 20)
        .write(position.encode(player.z), 20)
    }
    bits.finish()

    this.group.broadcastSync(snapshot)
  }
}

/**
 * Where a player stands
 */
type Player = {
  /**
   * Id sent in snapshots
   */
  readonly id: number
  /**
   * The player's zone
   */
  readonly zone: Zone
  /**
   * East to west
   */
  x: number
  /**
   * North to south
   */
  z: number
}

/**
 * The player on each channel
 */
const playerKey = new AttributeKey<Player>('player')

/**
 * Joins players up and applies their movement
 * @class
 */
class GameHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Furthest a player may move in one input
   */
  private static readonly maxStep: number = 1

  /**
   * Every zone
   */
  private readonly zones: Zone[]

  /**
   * Next player id
   */
  private nextId: number

  /**
   * Shared by every connection
   * @param zones every zone
   */
  public constructor(zones: Zone[]) {
    super()

    this.zones = zones
    this.nextId = 0
  }

  /**
   * Puts the player in the first zone with room
   * @param context the player's context
   */
  public override channelActive(context: HandlerContext): void {
    let zone = this.zones.find(
      (zone: Zone): boolean => zone.players.size < Zone.capacity,
    )
    if (zone === undefined) {
      zone = new Zone()
      this.zones.push(zone)
    }

    const player: Player = { id: this.nextId++ & 0xffff, zone, x: 0, z: 0 }
    zone.group.add(context.channel)
    zone.players.add(player)
    context.channel.attributes.set<Player>(playerKey, player)
  }

  /**
   * Takes the player out again
   * @param context the player's context
   */
  public override channelInactive(context: HandlerContext): void {
    const player = context.channel.attributes.get<Player>(playerKey)

    player?.zone.players.delete(player)
  }

  /**
   * Moves the player by two float deltas
   * @param context the player's context
   * @param message one input frame
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    const player = context.channel.attributes.get<Player>(playerKey)
    if (player === null || !(message instanceof ByteBuf)) return
    if (message.readableBytes < 8) return

    player.x += GameHandler.clamp(message.readFloat32())
    player.z += GameHandler.clamp(message.readFloat32())
  }

  /**
   * Keeps a step within the speed limit
   * @param step what the client asked for
   */
  private static clamp(step: number): number {
    if (!Number.isFinite(step)) return 0

    return Math.max(-GameHandler.maxStep, Math.min(GameHandler.maxStep, step))
  }
}

const zones: Zone[] = []
const game = new GameHandler(zones)

await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    channel.pipeline
      .addLast<LengthFieldBasedFrameDecoder>(
        'framer',
        new LengthFieldBasedFrameDecoder({
          maxFrameLength: 1024,
          lengthFieldLength: 2,
          initialBytesToStrip: 2,
        }),
      )
      .addLast<GameHandler>('game', game)
  })
  .bind({ port: 7000 })

setInterval((): void => {
  for (const zone of zones) zone.broadcast()
}, 50)
```

Players only need to hear about who's near them. The world is split into zones of 50, each with a `ChannelGroup` and a set of players. Every 50 ms the server packs each zone into one snapshot and sends the same bytes to everyone in it.

One `GameHandler` serves every pipeline, and each player lives in their channel's attributes. Closed channels leave their `ChannelGroup` on their own, but the player set is your data. That's why `channelInactive` removes the player.

Input gets clamped before it moves anyone. The framer catches oversized frames, but only the game knows how far a player can move in one step. [Safety limits](/scaling/safety) covers the rest of what to check.

`broadcastSync` writes finished bytes straight to the socket and skips the pipeline, encoders included. That's why `broadcast` writes the `uint16` length prefix itself.

## Sync writes

`write` and `writeAndFlush` return a promise for every message. Send to thousands of players in a tick and you get thousands of promises nobody awaits. Use the sync versions in a game loop: `writeSync`, `writeAndFlushSync`, `writeAndFlushEncodedSync` for bytes that skip the pipeline, and `ChannelGroup.broadcastSync` for a whole group. `broadcastSync` returns how many channels it sent to. Pass it a matcher such as `ChannelGroup.except(channel)` to leave someone out.

With no promise to reject, a sync write sends its errors to `exceptionCaught`. The one you'll see is a channel over `maxPendingBytes`, usually a player whose connection has died. For replies to input, call `writeSync` in `channelRead` and flush once in `channelReadComplete`. [Performance](/scaling/performance#flush-once-per-read-batch) shows how.

## Packing state

```ts twoslash
import { BitReader, BitWriter, ByteBuf, Quantizer } from '@netifyjs/netify'

const position = new Quantizer({ min: -2048, max: 2048, bits: 20 })

const buffer = new BitWriter(ByteBuf.allocate(8))
  .write(position.encode(12.5), 20)
  .write(97, 7)
  .writeBoolean(true)
  .finish()

const reader = new BitReader(buffer)
const x = position.decode(reader.read(20))
const health = reader.read(7)
const crouching = reader.readBoolean()
```

Game state rarely needs whole bytes. A position on a 4 km map fits in 20 bits at about 4 mm a step. Health fits in 7 and a crouching flag in 1. `Quantizer` turns a float in a fixed range into an integer and back, and clamps anything outside the range. `BitWriter` packs fields of 1 to 32 bits into a `ByteBuf`. Call `finish` to write out the last partial byte. `BitReader` reads them back in the same order.

Those three fields take 4 bytes on the wire. As a `float32`, a `uint8` and a flag byte they'd take 6. The zone snapshot above packs each player into 7 bytes, which makes a full zone of 50 a 354 byte frame.

## Picking a transport

Browsers can't open raw sockets, which leaves browser games with the native WebSocket server and its topics. Native clients that send positions many times a second should use reliable UDP. TCP with a length framer, as in the tick example, is the simplest of the three and fine for slower games or players on good networks. The catch is that one lost packet holds up every snapshot behind it until it's resent. By then those snapshots are out of date.

### Reliable UDP

```ts twoslash
import {
  InboundHandlerAdapter,
  ReliableBootstrap,
  ReliableMessage,
  type DatagramChannel,
  type HandlerContext,
  type LaneOptions,
  type ReliableHandler,
} from '@netifyjs/netify'

/**
 * Lane 0 for positions, lane 1 for chat and events
 */
const lanes: readonly LaneOptions[] = [
  { delivery: 'unreliable-sequenced' },
  { delivery: 'reliable-ordered' },
]

/**
 * Relays chat to every peer
 * @class
 */
class ChatHandler extends InboundHandlerAdapter<unknown> {
  /**
   * The reliable handler, set once bound
   */
  public reliable: ReliableHandler | null

  /**
   * Starts unbound
   */
  public constructor() {
    super()

    this.reliable = null
  }

  /**
   * Sends chat on to everyone
   * @param context unused
   * @param message a message from a player
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (!(message instanceof ReliableMessage) || message.lane !== 1) return

    for (const peer of this.reliable?.peers ?? []) {
      peer.send(1, message.content.toUint8Array())
    }
  }
}

const chat = new ChatHandler()
const server = await new ReliableBootstrap()
  .options({ lanes, maxPeers: 1000 })
  .handler((channel: DatagramChannel): void => {
    channel.pipeline.addLast<ChatHandler>('chat', chat)
  })
  .bind({ port: 7777 })
chat.reliable = server.handler

setInterval((): void => {
  const snapshot = new Uint8Array(64)

  for (const peer of server.handler.peers) peer.send(0, snapshot)
}, 50)
```

Positions go on an `unreliable-sequenced` lane, which drops any snapshot that arrives after a newer one. Chat and game events go on a `reliable-ordered` lane. The client needs the same lanes. If you don't set any, you get `reliable-ordered` on lane 0 and `unreliable` on lane 1.

`ReliableBootstrap.bind` returns the channel and the `ReliableHandler`. Its `peers` set works as your player list. [Lanes](/transports/reliable#lanes) explains each delivery mode, and [Testing with bad networks](/transports/reliable#testing-with-bad-networks) shows how to fake loss and lag while you develop.

### WebSocket for browsers

```ts twoslash
import {
  ByteBuf,
  InboundHandlerAdapter,
  WebSocketBootstrap,
  WebSocketChannel,
  WebSocketHandshakeComplete,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Puts each player in zone 0
 * @class
 */
class ZoneHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Subscribes once the socket is up
   * @param context the player's context
   * @param event a user event
   */
  public override userEventTriggered(
    context: HandlerContext,
    event: unknown,
  ): void {
    if (!(event instanceof WebSocketHandshakeComplete)) return
    if (context.channel instanceof WebSocketChannel) {
      context.channel.subscribe('zone:0')
    }
  }
}

const server = await new WebSocketBootstrap()
  .options({ path: '/play', maxPayloadLength: 4096 })
  .childHandler((channel: WebSocketChannel): void => {
    channel.pipeline.addLast<ZoneHandler>('zone', new ZoneHandler())
  })
  .bind({ port: 8080 })

setInterval((): void => {
  const snapshot = ByteBuf.allocate(64)

  server.publish('zone:0', snapshot)
}, 50)
```

Each socket subscribes to its zone's topic and the tick publishes one snapshot per topic. Bun copies it to every subscriber in native code, with no call into JavaScript per socket. In the `websocket` benchmark that hit about 1.45M deliveries a second to a room of 1000. A `ChannelGroup` loop over the JavaScript codec managed 73k. Anything that fans out to browsers should use topics.

`server.publish` reaches every subscriber. `channel.publish` skips the sender, which is usually what you want for chat. Bytes go out as binary messages and strings as text. There's more on topics in [Rooms](/transports/websocket#rooms).

## Sharding zones across cores

Building snapshots is cheap. Sending them isn't. Every player costs a socket write per tick, and 5000 players at 20 Hz is 100,000 writes a second. Profiling the MMO benchmark on one shard put about 85% of the time in those writes. Faster JavaScript barely helps. More cores do. One shard took 43 to 50 ms of its 50 ms tick, and four shards brought the median down to 7 to 23 ms.

A zone has to live in one process, because its `ChannelGroup` only holds that process's channels. On a shared port, a zone's players would end up scattered across shards. Give each shard its own port instead. A `ShardMap` decides which shard owns each zone, and your login or lobby service sends each client to that shard's port.

```ts twoslash
import {
  ServerBootstrap,
  ShardLink,
  ShardMap,
  type Channel,
} from '@netifyjs/netify'

const shards = new ShardMap({ count: 4, port: 7000 })
const link = await ShardLink.open()

await new ServerBootstrap()
  .childHandler((channel: Channel): void => {})
  .bind({ port: shards.portOf(link.id) })
```

[Sharding](/scaling/sharding) covers messages between shards and moving players from one to another.

The `mmo` benchmark works this way. It runs one process per shard on consecutive ports and points a slice of the clients at each.

Size your zones by how far players can see. A tick costs roughly the number of players times the zone size, and smaller zones keep snapshots small. The shard count then sets how many zones each core carries.

## Gateways

Sharding means splitting the world up. If you want to keep it in one process, put the sockets somewhere else instead. With a `Gateway`, one process runs the game and the rest hold the connections. Each tick the world publishes every zone's snapshot once, and each gateway writes it to whichever of its players are in that zone.

```ts twoslash
import {
  Cluster,
  Gateway,
  ServerBootstrap,
  ShardLink,
  type Channel,
} from '@netifyjs/netify'

declare const snapshotOf: (zone: string) => Uint8Array
declare const zoneOf: (channel: Channel) => string
// ---cut---
const link = await ShardLink.open()
const gateway = new Gateway(link)

if (link.id === 0) {
  setInterval((): void => {
    gateway.publish('forest', snapshotOf('forest'))
  }, 50)
} else {
  await new ServerBootstrap()
    .options({ reusePort: true })
    .childHandler((channel: Channel): void => {
      gateway.subscribe(channel, zoneOf(channel))
    })
    .bind({ port: 7000 })
}

Cluster.ready()
```

A player can be on several topics at once, for example their grid cell plus the eight around it. Everything a gateway gets for one player in a tick goes out in a single write.

Start it with a `Cluster`. Worker 0 runs the world and doesn't listen on anything. The others share port 7000, so a zone's players get scattered across all the gateways. `publish` goes to every gateway anyway. It copies the frame, and you can reuse your buffer right after. Call `unsubscribe` when a player leaves a zone. Closed channels drop out by themselves. Each link can have one gateway.

Like `broadcastSync`, snapshots skip the pipelines. Add the length prefix yourself. Leave the bytes alone after publishing, because they only go out to the other shards at the end of the tick.

For inputs, have each gateway gather its players' moves and send the batch with `link.send(0, 'moves', batch)` once a tick. That's far cheaper than a message per input.

`mmo:gateway` runs 20 Hz ticks with zones of 50. The clients time each snapshot from the start of the tick until it lands.

| Players | Layout               | Delivery, median | Delivery, p99 |
| ------- | -------------------- | ---------------- | ------------- |
| 5000    | One process          | 46 ms            | 86 ms         |
| 5000    | World and 4 gateways | 8 ms             | 15 ms         |
| 10000   | One process          | 80 ms            | 138 ms        |
| 10000   | World and 4 gateways | 16 ms            | 31 ms         |

On its own, one process can't get through its writes in 50 ms and starts skipping ticks. With gateways the world sat at 5 to 9% of a core. The load ran on the same machine, and it couldn't drive 20,000 players.

Stick to one `Gateway` per link. A second one replaces the first one's listener.
