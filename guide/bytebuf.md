---
title: ByteBuf
description: "ByteBuf is Netify's byte buffer, with reader and writer indexes, pooled frames, and bit packing for compact game state."
---

# ByteBuf

`ByteBuf` carries bytes through Netify. TCP reads arrive as one. Decoders read messages out of them and encoders write messages into them.

```ts twoslash
import { ByteBuf } from '@netifyjs/netify'

const out = ByteBuf.allocate()
  .writeUint8(1)
  .writeUint16(0)
  .writeUint32(42)
  .writeFloat32(103.5)

out.setUint16(1, out.readableBytes - 3)

const kind = out.readUint8()
const length = out.readUint16()
const id = out.readUint32()
console.log(kind, length, id, out.readFloat32())
```

A buffer tracks two positions. Writes go at `writerIndex` and reads come from `readerIndex`, and each moves its own index forward. Whatever sits between them is still to read. Writes return the buffer, which lets you chain them. A new buffer starts at 256 bytes and grows as needed.

`setUint16` and the other `set` and `get` methods take an index and leave both positions alone. The example writes a zero placeholder for the length and fills it in once the message is written. That's how you build a header that carries the size of what follows.

```text
      already read       readable          writable
  ├──────────────────┼───────────────┼─────────────────┤
  0             readerIndex     writerIndex        capacity
```

Every number type from `Int8` to `Float64` has the same four methods, and the 64 bit ones use `bigint`. Multi-byte values are big endian, the usual network order. Pass `'little'` as the last argument for the other order. The full list is in the [reference](/reference/api#bytebuf).

`ByteBuf.wrap(bytes)` wraps an existing `Uint8Array` without copying, and `ByteBuf.fromString(text)` encodes text as UTF-8. A wrapped buffer shares memory with its array, and changes through one show up in the other.

## Varints

Ids, counts and lengths are usually small, and a varint stores them in as few bytes as needed. Up to 127 takes one byte, up to 16383 takes two.

```ts twoslash
import { ByteBuf } from '@netifyjs/netify'

const buffer = ByteBuf.allocate().writeVarUint(300).writeVarInt(-2)

console.log(buffer.readableBytes, buffer.readVarUint(), buffer.readVarInt())
```

Use `writeVarUint` for values that are never negative. `writeVarInt` zigzag encodes first, which keeps small negatives small, and -1 still fits in one byte. `readVarUint` gives up after 8 bytes, which stops a peer stalling a decoder with an endless varint. It also throws `Varint is too large` past `Number.MAX_SAFE_INTEGER`.

## Strings

`readString` needs a length in bytes. Usually you send that ahead of the string.

```ts twoslash
import { ByteBuf } from '@netifyjs/netify'

const name = 'Zoë'
const bytes = new TextEncoder().encode(name)

const out = ByteBuf.allocate().writeVarUint(bytes.length).writeBytes(bytes)

console.log(out.readString(out.readVarUint()))
```

Send the byte length, which can differ from the string's `length`. `Zoë` is three characters but four bytes. `writeString` returns the byte count instead of the buffer, which means it has to come last in a chain.

## Sharing memory

Some methods return a view over the same bytes and others a copy. That matters once you keep a buffer after the handler that got it returns.

| Method               | Gives you    | Shares memory |
| -------------------- | ------------ | ------------- |
| `readSlice(size)`    | `ByteBuf`    | Yes           |
| `slice(index, size)` | `ByteBuf`    | Yes           |
| `duplicate()`        | `ByteBuf`    | Yes           |
| `toUint8Array()`     | `Uint8Array` | Yes           |
| `readBytes(size)`    | `Uint8Array` | No            |
| `copy()`             | `ByteBuf`    | No            |

Framers hand out frames made with `readSlice`, which saves a copy per message. A view is fine if you only read the frame inside `channelRead`. If you store it, `copy()` it. `toUint8Array` is for passing the readable bytes to an API that wants an array, and you shouldn't keep the result.

A buffer that grows moves to a new array and stops sharing memory with anything. If you know how much you'll write, `ensureWritable(size)` grows it once up front.

## Pooled frames

The framing decoders don't allocate a new `ByteBuf` per frame. Each keeps a pool and takes a frame back once your `channelRead` returns, or once its promise settles. The native WebSocket server does the same with each channel's binary frames, where the object to retain is `frame.content`. At tens of thousands of messages a second this saves the garbage collector a lot of work.

Most handlers never notice. Reading the frame and returning is safe, and so is an async handler, because the decoder waits for its promise. Writing the frame on is safe too. An encoder that copies the bytes out straight away, like `LengthFieldPrepender`, lets the frame go back to the pool. Any other write takes it out of the pool for good. A queued write never points at a reused object.

Keeping a frame after `channelRead` finishes needs care. Call `retain()` to hold it and `release()` when you're done.

```ts twoslash
import {
  ByteBuf,
  InboundHandlerAdapter,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * Sends a batch of frames back once a read ends
 * @class
 */
export class Batcher extends InboundHandlerAdapter<unknown> {
  /**
   * Frames held until the read ends
   */
  private readonly frames: ByteBuf[]

  /**
   * Starts with no frames
   */
  public constructor() {
    super()

    this.frames = []
  }

  /**
   * Keeps the frame
   * @param context The handler context
   * @param message The message
   */
  public override channelRead(context: HandlerContext, message: unknown): void {
    if (!(message instanceof ByteBuf)) return

    this.frames.push(message.retain())
  }

  /**
   * Writes the frames back and lets them go
   * @param context The handler context
   */
  public override channelReadComplete(context: HandlerContext): void {
    for (const frame of this.frames) {
      context.writeSync(frame.copy())
      frame.release()
    }
    this.frames.length = 0
  }
}
```

Without `retain()` a kept frame gets reused, and later it holds another message's bytes. Forgetting `release()` is harmless by comparison. The frame never returns to the pool and the garbage collector reclaims it as usual.

Buffers you make with `allocate` or `wrap` are never pooled, and `retain` and `release` only change their count. Pass `pooled: false` to turn pooling off for a decoder.

::: tip Debugging
Set `NETIFY_DEBUG_FRAMES=1` in development. Using a frame after the decoder has taken it back then throws `Frame was released`, which is far easier to track down than a handler quietly reading another message's bytes.
:::

## Packing bits

Game state is full of fields smaller than a byte. A flag needs one bit and a heading is precise enough at ten. `BitWriter` packs fields of 1 to 32 bits into a `ByteBuf`, and `BitReader` reads them back in the same order. A `Quantizer` maps a float in a known range onto an integer with a given number of bits, clamping anything out of range.

This player update uses all three. After the varint id come 20 bits per position axis, 10 for the heading and one per flag. That's 9 bytes on top of the id.

```ts twoslash
import { BitReader, BitWriter, ByteBuf, Quantizer } from '@netifyjs/netify'

/**
 * One player's state
 */
export type Player = {
  /**
   * The player id
   */
  readonly id: number
  /**
   * Position across
   */
  readonly x: number
  /**
   * Position up
   */
  readonly y: number
  /**
   * Position along
   */
  readonly z: number
  /**
   * Heading in radians
   */
  readonly heading: number
  /**
   * Whether the player is crouching
   */
  readonly crouching: boolean
  /**
   * Whether the player is firing
   */
  readonly firing: boolean
}

/**
 * Packs players into a few bytes
 * @class
 */
export class PlayerCodec {
  /**
   * Positions to about 4 mm
   */
  private readonly position: Quantizer

  /**
   * Headings to about a third of a degree
   */
  private readonly heading: Quantizer

  /**
   * Sets up the ranges
   */
  public constructor() {
    this.position = new Quantizer({ min: -2048, max: 2048, bits: 20 })
    this.heading = new Quantizer({ min: -Math.PI, max: Math.PI, bits: 10 })
  }

  /**
   * Writes a player
   * @param out The buffer
   * @param player The player
   */
  public encode(out: ByteBuf, player: Player): void {
    out.writeVarUint(player.id)

    new BitWriter(out)
      .write(this.position.encode(player.x), this.position.bits)
      .write(this.position.encode(player.y), this.position.bits)
      .write(this.position.encode(player.z), this.position.bits)
      .write(this.heading.encode(player.heading), this.heading.bits)
      .writeBoolean(player.crouching)
      .writeBoolean(player.firing)
      .finish()
  }

  /**
   * Reads a player
   * @param input The buffer
   */
  public decode(input: ByteBuf): Player {
    const id = input.readVarUint()

    const reader = new BitReader(input)
    return {
      id,
      x: this.position.decode(reader.read(this.position.bits)),
      y: this.position.decode(reader.read(this.position.bits)),
      z: this.position.decode(reader.read(this.position.bits)),
      heading: this.heading.decode(reader.read(this.heading.bits)),
      crouching: reader.readBoolean(),
      firing: reader.readBoolean(),
    }
  }
}
```

Don't forget `finish()`, or up to seven trailing bits never reach the buffer. A quantizer's `precision` is the gap between neighbouring values, about 4 mm here if the units are metres. As four `Float32`s and a byte of flags, the same player would take 17 bytes plus the id. [Game servers](/scaling/games) shows how an encoder like this fits into a tick loop.
