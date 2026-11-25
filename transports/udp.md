---
title: UDP server in Bun
description: 'Send and receive UDP datagrams in Bun with DatagramBootstrap. Replies, connected sockets, sending to many players, broadcast and multicast.'
---

# UDP

`DatagramBootstrap` opens one socket with one channel. Every packet in or out goes through its pipeline as a `DatagramPacket`, and there are no connections to accept.

Plain UDP is good for discovery, metrics and protocols built to cope with loss. If messages have to arrive, or arrive in order, use [Reliable UDP](/transports/reliable) instead of writing your own acks.

## A server

```ts twoslash
import {
  DatagramBootstrap,
  DatagramPacket,
  InboundHandlerAdapter,
  type DatagramChannel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Answers each packet with the time
 * @class
 */
class TimeHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Replies to whoever sent the packet
   * @param context where the reply goes
   * @param message the packet that arrived
   */
  public override async channelRead(
    context: HandlerContext,
    message: unknown,
  ): Promise<void> {
    if (!(message instanceof DatagramPacket)) return

    await context.writeAndFlush(message.reply(new Date().toISOString()))
  }
}

const server = await new DatagramBootstrap()
  .handler((channel: DatagramChannel): void => {
    channel.pipeline.addLast<TimeHandler>('time', new TimeHandler())
  })
  .bind({ hostname: '127.0.0.1', port: 9000 })

console.log(`UDP on port ${String(server.localAddress.port)}`)
```

Packets carry their `sender`, and `reply` builds a packet addressed back to it. To build one yourself, pass the content and a recipient: `new DatagramPacket('hi', { hostname, port })`. Content can be a string, a `Uint8Array` or a `ByteBuf`.

If you write a packet with no recipient on a bound socket, you'll get `Recipient is missing`. Only a connected socket knows where to send it.

## A client

`connect` ties the socket to one peer, and packets can leave out the recipient.

```ts twoslash
import {
  DatagramBootstrap,
  DatagramPacket,
  LoggingHandler,
  type DatagramChannel,
} from '@netifyjs/netify'

const channel = await new DatagramBootstrap()
  .handler((child: DatagramChannel): void => {
    child.pipeline.addLast<LoggingHandler>('log', new LoggingHandler())
  })
  .connect({ remoteHostname: '127.0.0.1', remotePort: 9000 })

await channel.writeAndFlush(new DatagramPacket('time?'))
```

The address fields for `bind` and `connect` are in [Datagrams](/reference/options#datagrams). The channel's methods are in [`DatagramChannel`](/reference/api#datagramchannel).

## Sending to many players

A flush hands all the queued packets to Bun in one `sendMany` call, up to 1024 at a time. On a game server, write each player's packet for the tick and flush once at the end.

```ts twoslash
import {
  DatagramPacket,
  type DatagramChannel,
  type PacketAddress,
} from '@netifyjs/netify'

/**
 * Sends each player their own update
 * @class
 */
export class Broadcaster {
  /**
   * The UDP channel
   */
  private readonly channel: DatagramChannel

  /**
   * Takes the channel
   * @param channel the UDP channel
   */
  public constructor(channel: DatagramChannel) {
    this.channel = channel
  }

  /**
   * Queues every update, then flushes them in one go
   * @param players where each update goes
   * @param state what each one gets
   */
  public tick(players: readonly PacketAddress[], state: string): Promise<void> {
    for (const player of players) {
      this.channel.writeSync(new DatagramPacket(state, player))
    }

    return this.channel.flush()
  }
}
```

If everyone gets the same bytes, `channel.sendMany(content, recipients)` goes straight to Bun and skips the pipeline. It returns how many packets went out. It only works on a bound socket.

Sending to a closed port can come back as connection refused. Netify ignores that on UDP and carries on with the batch. It never reaches `exceptionCaught`.

## Broadcast and multicast

Broadcast needs `setBroadcast(true)` before the first send.

```ts twoslash
import {
  DatagramBootstrap,
  DatagramPacket,
  LoggingHandler,
  type DatagramChannel,
} from '@netifyjs/netify'

const channel = await new DatagramBootstrap()
  .handler((child: DatagramChannel): void => {
    child.pipeline.addLast<LoggingHandler>('log', new LoggingHandler())
  })
  .bind()

channel.setBroadcast(true)
await channel.writeAndFlush(
  new DatagramPacket('anyone there?', {
    hostname: '255.255.255.255',
    port: 9000,
  }),
)
```

For multicast, bind to the group's port and call `channel.joinGroup('239.1.2.3')`. The OS picks the interface unless you pass one as the second argument. `setTtl(1)` keeps your own sends on the local network.

## Before you ship

Bun can't pause reads on a UDP socket. Packets keep coming however far behind your pipeline gets, and your handlers have to shed load themselves.

Large payloads aren't split for you. Keep packets under about 1200 bytes to fit the path MTU on nearly every network.
