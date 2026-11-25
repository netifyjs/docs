---
title: Reliable UDP for games
description: 'Reliable UDP in Bun with acks, resends, ordering and fragmentation. Lanes keep chat reliable while position updates skip the resends.'
---

# Reliable UDP

Reliable UDP adds connections, acks, resends, ordering and fragmentation on top of a [DatagramChannel](/transports/udp). A connection is split into lanes, and each lane has its own delivery guarantee.

It's worth it when a game sends fast-changing state alongside messages that must arrive. On TCP, one lost packet holds up everything behind it, even the position update that would have replaced it. With lanes, chat waits for its resend while positions keep flowing. If everything has to arrive in order, TCP is simpler. Browsers can't send UDP, so a browser game needs [WebSocket](/transports/websocket).

## A server and a client

::: code-group

```ts twoslash [server.ts]
import {
  InboundHandlerAdapter,
  PeerConnected,
  PeerDisconnected,
  ReliableBootstrap,
  ReliableMessage,
  type DatagramChannel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Echoes chat and logs positions
 * @class
 */
class GameHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Handles a message from a player
   * @param context unused
   * @param message a message from a player
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (!(message instanceof ReliableMessage)) return

    if (message.lane === 0) message.reply(`echo: ${message.content.toString()}`)
    else console.log(`position ${message.content.toString()}`)
  }

  /**
   * Greets players and notes when they leave
   * @param context unused
   * @param event a peer event
   */
  public override userEventTriggered(
    context: HandlerContext,
    event: unknown,
  ): void {
    if (event instanceof PeerConnected) event.peer.send(0, 'welcome')
    if (event instanceof PeerDisconnected) console.log(`left: ${event.reason}`)
  }
}

const server = await new ReliableBootstrap()
  .options({
    lanes: [
      { delivery: 'reliable-ordered' },
      { delivery: 'unreliable-sequenced' },
    ],
  })
  .handler((channel: DatagramChannel): void => {
    channel.pipeline.addLast<GameHandler>('game', new GameHandler())
  })
  .bind({ hostname: '0.0.0.0', port: 7777 })

console.log(`${String(server.handler.peers.size)} players`)
```

```ts twoslash [client.ts]
import {
  InboundHandlerAdapter,
  ReliableBootstrap,
  ReliableMessage,
  type DatagramChannel,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Prints what the server sends
 * @class
 */
class PrintHandler extends InboundHandlerAdapter<unknown> {
  /**
   * Prints the text
   * @param context unused
   * @param message a message from the server
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (message instanceof ReliableMessage) {
      console.log(`server says ${message.content.toString()}`)
    }
  }
}

const { channel, peer } = await new ReliableBootstrap()
  .options({
    lanes: [
      { delivery: 'reliable-ordered' },
      { delivery: 'unreliable-sequenced' },
    ],
  })
  .handler((child: DatagramChannel): void => {
    child.pipeline.addLast<PrintHandler>('print', new PrintHandler())
  })
  .connect({ hostname: '127.0.0.1', port: 7777 })

peer.send(0, 'hello')
peer.send(1, '10,20')

console.log(`rtt ${peer.rtt.toFixed(1)} ms`)
await channel.close()
```

:::

`ReliableBootstrap` puts a `ReliableHandler` in front of your handlers. They get a `ReliableMessage` with the `peer` it came from, its `lane` and its `content`. Send with `peer.send(lane, content)`, or answer on the same lane with `message.reply(content)`. On the client, `connect` resolves after the handshake and hands you the server's peer.

Joins and leaves arrive as `PeerConnected` and `PeerDisconnected` user events. The disconnect has a `reason`:

- `'closed'`: the other side hung up, or reconnected from the same address
- `'timeout'`: nothing heard for `timeout` ms, which is how a dead connection usually ends
- `'resends'`: a message ran out of resends, usually because the two ends disagree on lanes or limits
- `'local'`: you called `peer.close()`

`peer.close()` sends what's queued one more time and hangs up. It doesn't wait for acks.

If nothing's getting through, resends back off, doubling up to a second apart. They count against `maxSendRate` too.

Peers also have a `data` field for your own things, like a player id.

Both ends must list the same lanes. A lane goes over the wire as a number and nothing checks that the sides agree. If they don't, messages arrive with the wrong guarantee.

## Lanes

If you don't set `lanes`, you get `reliable-ordered` on lane 0 and `unreliable` on lane 1. You can have up to 127, and a loss on one lane never holds up another.

| Delivery               | Arrives | Order                  | Good for                      |
| ---------------------- | ------- | ---------------------- | ----------------------------- |
| `reliable-ordered`     | Always  | Sent order             | Chat, inventory, RPCs         |
| `reliable-unordered`   | Always  | As it comes            | Asset loading, one-off events |
| `unreliable-sequenced` | Maybe   | Older ones are dropped | Positions, input              |
| `unreliable`           | Maybe   | As it comes            | Effects, voice                |

Reliable lanes split big messages into fragments and rejoin them at the other end. Unreliable lanes don't, since losing one fragment would lose the whole message anyway. An unreliable message has to fit in one packet. With the default MTU that's 1179 bytes of payload, or 1155 with encryption.

`send` doesn't copy your buffer, and a reliable message may be resent from it later. Don't touch a buffer after sending it. If `send` can't take a message it throws a `RangeError`. Usually that's `Message is too large`, or `Send queue is full` when a lane already has `maxQueuedBytes` waiting.

## Encryption

Set `encryption: true` on both ends and every data packet is encrypted with AES-256-GCM. Replayed packets are dropped, and so is anything more than 2048 packets late. The keys are agreed over X25519 during the handshake. Nobody can read the traffic, but the server makes a fresh key pair each time it starts. A client can't tell the real server from someone in the middle. To fix that, give the server a fixed key pair and pin its public key on the client.

::: code-group

```ts twoslash [keys.ts]
import { ReliableHandler } from '@netifyjs/netify'

const keys = ReliableHandler.generateKeyPair()

await Bun.write('server.key', keys.privateKey)
await Bun.write('server.pub', keys.publicKey)
```

```ts twoslash [server.ts]
import { ReliableBootstrap } from '@netifyjs/netify'

const server = await new ReliableBootstrap()
  .options({
    encryption: {
      keyPair: {
        /**
         * Safe to hand out
         */
        publicKey: await Bun.file('server.pub').bytes(),
        /**
         * Keep it secret
         */
        privateKey: await Bun.file('server.key').bytes(),
      },
    },
  })
  .bind({ port: 7777 })
```

```ts twoslash [client.ts]
import { ReliableBootstrap } from '@netifyjs/netify'

const { peer } = await new ReliableBootstrap()
  .options({
    encryption: { serverPublicKey: await Bun.file('server.pub').bytes() },
  })
  .connect({ hostname: '127.0.0.1', port: 7777 })

peer.send(0, 'secret')
```

:::

A server with encryption on ignores plain connects, and the client gets `Connection failed` when `timeout` runs out. You'll see the same if the server's key doesn't match the pinned one. Packets grow by 24 bytes, and Netify takes that off the MTU when it packs messages.

## Testing with bad networks

`simulate` drops, delays and duplicates the packets this end sends. Turn it on in a test client to see how your game handles a poor connection.

```ts twoslash
import { ReliableBootstrap } from '@netifyjs/netify'

const { peer } = await new ReliableBootstrap()
  .options({
    simulate: { loss: 0.1, latency: 40, jitter: 20, duplicate: 0.01 },
  })
  .connect({ hostname: '127.0.0.1', port: 7777 })

for (let index = 0; index < 100; index++) peer.send(0, String(index))
```

`jitter` adds a random delay on top of `latency`, which also reorders packets. Keep `simulate` out of production. It hits handshake packets too, and a lossy setting makes connects slow or fail.

## Options

Most games set `lanes` and leave the rest alone.

Turn on `congestion` for clients on home or mobile connections. Peers then start with 64 messages in flight instead of the full `window` of 1024. The window grows on every ack and halves on loss. If you know roughly what clients can take, `maxSendRate` caps bytes per second per peer.

Leave `mtu` at 1200 unless you control the network, like a LAN or a data centre. It fits inside the IPv6 minimum of 1280 with room for tunnel headers. Bun's UDP sockets can't set the don't fragment bit, which rules out path MTU discovery. If you lower `mtu`, lower `maxMessageSize` with it. A message can have at most 255 fragments, and going over throws `Message size needs too many fragments`.

All the settings and defaults are in [`ReliableOptions`](/reference/options#reliableoptions). To run the protocol on your own `DatagramBootstrap`, add `new ReliableHandler({ role, server })` to its pipeline. See the [API](/reference/api#reliablehandler).

## How it works

You don't need this to use reliable UDP. It helps when you're reading a packet capture or tuning options.

Data packets have a 13 byte header with a session id, a 16 bit sequence number and an ack field covering the last 33 packets from the other side. Every packet repeats that field, so a lost ack costs nothing once a later packet gets through. Messages from all lanes are packed into a packet up to the MTU, with 8 bytes of header each. Resends go in first, then new messages.

A reliable message is resent after the smoothed round trip plus four times its variation, the formula TCP uses from RFC 6298. Netify clamps it between 30 ms and 1 second. If three later packets have been acked and one still hasn't, it's resent straight away. A lone ack waits up to `ackDelay` ms for a message to ride along with. After `keepalive` ms of not sending, Netify sends an empty packet to stop the other side timing out.

The handshake uses a stateless cookie, like a TCP SYN cookie. The client sends a connect padded to 64 bytes. The server replies with an HMAC of the client's address and the time, and keeps no state. It only creates a peer when the client sends the cookie back within 30 seconds. A forged source address never sees the cookie, so spoofed connects can't fill the peer table. No reply is ever bigger than the request behind it either, which keeps the server from being used for amplification.
