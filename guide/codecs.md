---
title: Codecs and framing
description: 'Turn bytes into messages with length field, line, delimiter and fixed length decoders, then write your own encoders and decoders.'
---

# Codecs

A codec turns bytes into messages on the way in, and messages into bytes on the way out. Binary protocols usually start with a length prefix on every frame.

```ts twoslash
import {
  LengthFieldBasedFrameDecoder,
  LengthFieldPrepender,
  type Channel,
} from '@netifyjs/netify'

/**
 * Adds two byte length framing
 * @param channel The channel
 */
export function useFrames(channel: Channel): void {
  channel.pipeline
    .addLast<LengthFieldBasedFrameDecoder>(
      'framer',
      new LengthFieldBasedFrameDecoder({
        maxFrameLength: 4096,
        lengthFieldLength: 2,
        initialBytesToStrip: 2,
      }),
    )
    .addLast<LengthFieldPrepender>(
      'prepender',
      new LengthFieldPrepender({ lengthFieldLength: 2 }),
    )
}
```

TCP doesn't keep message boundaries. One read can hold half a message, or three and the start of a fourth. The framer reads the two byte length, waits for the whole frame, strips the length and passes the body on as a `ByteBuf`. The prepender does the reverse for each `ByteBuf` or `Uint8Array` you write. Handlers after these two get one whole message per `channelRead`.

Codecs are ordinary [handlers](/guide/handlers) with per-connection state. Create them in the setup function so every channel has its own.

## Framing

`LengthFieldBasedFrameDecoder` fits most binary protocols, even ones with a header before the length. Here are the settings for some common layouts.

| Wire format                                | Options                                                              |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `[length u16][body]`, pass on the body     | `lengthFieldLength: 2, initialBytesToStrip: 2`                       |
| `[length u16][body]`, keep the length      | `lengthFieldLength: 2`                                               |
| `[type u8][length u16][body]`              | `lengthFieldOffset: 1, lengthFieldLength: 2`                         |
| `[length u32][body]`, length counts itself | `lengthFieldLength: 4, lengthAdjustment: -4, initialBytesToStrip: 4` |

Set `maxFrameLength` to the largest message you actually send. Anything bigger raises a `DecoderError` with `Frame is too large`, and the decoder skips to the next frame. The connection stays open unless your error handler closes it, which on a public server it usually should.

Frames come from a pool and go back when your `channelRead` finishes. Reading one and returning is always safe. To keep one for later, call `retain()` first, as [Pooled frames](/guide/bytebuf#pooled-frames) explains.

For text, split on line endings with `LineBasedFrameDecoder`, or on bytes of your choice with `DelimiterBasedFrameDecoder`. `FixedLengthFrameDecoder` handles the rare protocol where every message is the same size. All the options are in the [options reference](/reference/options#codecs).

## Strings

A line protocol needs a framer, a string decoder and a string encoder.

```ts twoslash
import {
  LineBasedFrameDecoder,
  StringDecoder,
  StringEncoder,
  type Channel,
} from '@netifyjs/netify'

/**
 * Adds a text line protocol
 * @param channel The channel
 */
export function useLines(channel: Channel): void {
  channel.pipeline
    .addLast<LineBasedFrameDecoder>(
      'framer',
      new LineBasedFrameDecoder({ maxLength: 1024 }),
    )
    .addLast<StringDecoder>('decoder', new StringDecoder())
    .addLast<StringEncoder>('encoder', new StringEncoder())
}
```

Without the framer, `StringDecoder` decodes raw socket chunks, which can end mid-line or even halfway through a multi-byte character. `StringEncoder` doesn't add a line ending. Put the `\n` in the strings you write.

## Binary messages

Once frames arrive whole, `BinaryCodec` turns them into messages using two functions you write. It's the quickest way to get your own format on the wire.

```ts twoslash
import {
  BinaryCodec,
  ByteBuf,
  LengthFieldBasedFrameDecoder,
  LengthFieldPrepender,
  type Channel,
} from '@netifyjs/netify'

/**
 * A movement update
 */
export type Move = {
  /**
   * The player id
   */
  readonly id: number
  /**
   * Position across
   */
  readonly x: number
  /**
   * Position along
   */
  readonly z: number
}

/**
 * Checks for a move
 * @param message The message
 */
export function isMove(message: unknown): message is Move {
  return typeof message === 'object' && message !== null && 'id' in message
}

/**
 * The move codec
 */
export const codec: BinaryCodec<Move> = new BinaryCodec<Move>({
  /**
   * Writes the move
   * @param move The move
   */
  encode: (move: Move): Uint8Array =>
    ByteBuf.allocate(12)
      .writeUint32(move.id)
      .writeFloat32(move.x)
      .writeFloat32(move.z)
      .toUint8Array(),
  /**
   * Reads the move
   * @param bytes The frame
   */
  decode: (bytes: Uint8Array): Move => {
    const input = ByteBuf.wrap(bytes)

    return {
      id: input.readUint32(),
      x: input.readFloat32(),
      z: input.readFloat32(),
    }
  },
  /**
   * Takes moves
   */
  accepts: isMove,
})

/**
 * Adds framing and the move codec
 * @param channel The channel
 */
export function useMoves(channel: Channel): void {
  channel.pipeline
    .addLast<LengthFieldBasedFrameDecoder>(
      'framer',
      new LengthFieldBasedFrameDecoder({
        maxFrameLength: 4096,
        lengthFieldLength: 2,
        initialBytesToStrip: 2,
      }),
    )
    .addLast<LengthFieldPrepender>(
      'prepender',
      new LengthFieldPrepender({ lengthFieldLength: 2 }),
    )
    .addLast<BinaryCodec<Move>>('codec', codec)
}
```

`BinaryCodec` keeps no state, which is why one instance can serve every channel. A handler after it reads `Move` objects and writes them with `context.writeAndFlush(move)`. On the way out `codec` encodes the move and `prepender` adds the length. That only works because the prepender was added first. Swap them and the peer gets frames with no length.

The array passed to `decode` is a view of a pooled frame. Copy it if you need the bytes after `decode` returns.

### Protocol Buffers and MessagePack

Already using protobufjs or msgpackr? `ProtobufCodec` and `MessagePackCodec` are `BinaryCodec`s set up for them. Netify depends on neither. Add the one you use to your project.

```ts twoslash
declare class Packr {
  public constructor(options: { useRecords: boolean })
  public pack(value: unknown): Uint8Array
  public unpack(bytes: Uint8Array): unknown
}
// ---cut---
import { MessagePackCodec, type Channel } from '@netifyjs/netify'

/**
 * A chat message
 */
export type Chat = {
  /**
   * What they said
   */
  readonly text: string
}

/**
 * Checks for a chat message
 * @param message The message
 */
export function isChat(message: unknown): message is Chat {
  return typeof message === 'object' && message !== null && 'text' in message
}

/**
 * Adds MessagePack after the framer
 * @param channel The channel
 */
export function usePack(channel: Channel): void {
  channel.pipeline.addLast<MessagePackCodec<Chat>>(
    'codec',
    new MessagePackCodec<Chat>(new Packr({ useRecords: true }), isChat),
  )
}
```

`ProtobufCodec` takes a protobufjs `Type`, or a class generated by `pbjs`, and the same kind of guard.

### Does binary pay off

On CPU time for small messages, less than you'd think. In the Netify codec benchmark, a five field move message made a round trip through a channel in about 255 ns with Bun's JSON. A hand-written `ByteBuf` codec took about 291 ns.

The win is size. The `ByteBuf` encoding is 17 bytes against 45 for the JSON, and a server sending every position to every player 20 times a second pays for that gap many times over. Start with what's easiest and move your most frequent messages to a packed format once bandwidth matters. [Packing bits](/guide/bytebuf#packing-bits) shrinks them further, and [Performance](/scaling/performance) has the full numbers.

## Writing a decoder

If none of the framers fit, extend `ByteToMessageDecoder`. It buffers incoming bytes and calls your `decode` with everything it has so far.

::: code-group

```ts twoslash [src/codec/packet/index.ts]
import {
  ByteBuf,
  ByteToMessageDecoder,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * One frame off the wire
 */
export type Packet = {
  /**
   * The packet type
   */
  readonly type: number
  /**
   * The body
   */
  readonly body: ByteBuf
}

/**
 * Reads packets from the stream
 * @class
 */
export class PacketDecoder extends ByteToMessageDecoder<Packet> {
  /**
   * Buffers at most 64 KiB
   */
  public constructor() {
    super({ maxCumulation: 64 * 1024 })
  }

  /**
   * Reads every whole packet
   * @param context The handler context
   * @param input The bytes so far
   * @param out The packets
   */
  protected decode(
    context: HandlerContext,
    input: ByteBuf,
    out: Packet[],
  ): void {
    while (input.isReadable(3)) {
      const length = input.getUint16(input.readerIndex + 1)
      if (!input.isReadable(3 + length)) return

      const type = input.readUint8()
      input.skipBytes(2)
      out.push({ type, body: input.readSlice(length) })
    }
  }
}
```

:::

Each frame here is a type byte, a two byte length and the body. `getUint16` peeks at the length without moving the reader index. If the frame isn't complete, the decoder returns without reading and `decode` runs again when more bytes arrive. Pushing a message without consuming bytes would loop forever, and the base class throws `Decoder did not read` to stop it.

Set `maxCumulation` on anything facing the internet. Otherwise a peer can promise a huge body and trickle bytes in, and the decoder keeps buffering up to the 16 MiB default. The most you can set is 64 MiB, and a frame limit above that throws. Leave it out and the frame decoders raise the default to fit `maxFrameLength`. [Safety limits](/scaling/safety) covers the other limits worth setting.

## Writing an encoder

`MessageToByteEncoder` is the outbound side. Its `accepts` guard picks the messages it handles and lets the rest pass, which lets several encoders sit side by side.

```ts twoslash
import {
  ByteBuf,
  MessageToByteEncoder,
  type HandlerContext,
} from '@netifyjs/netify'

/**
 * A chat message
 */
export type Chat = {
  /**
   * Who sent it
   */
  readonly from: number
  /**
   * What they said
   */
  readonly text: string
}

/**
 * Writes chat messages
 * @class
 */
export class ChatEncoder extends MessageToByteEncoder<Chat> {
  /**
   * Takes chat messages
   * @param message The message
   */
  protected accepts(message: unknown): message is Chat {
    return typeof message === 'object' && message !== null && 'text' in message
  }

  /**
   * Writes the sender and the text
   * @param context The handler context
   * @param message The message
   */
  protected encode(context: HandlerContext, message: Chat): ByteBuf {
    const out = ByteBuf.allocate().writeVarUint(message.from)

    out.writeString(message.text)
    return out
  }
}
```

Errors from `encode` reject the write with an `EncoderError`. Errors from `decode` reach `exceptionCaught` as a `DecoderError`. Both keep your original error as `cause`.

`MessageToMessageDecoder` and `MessageToMessageEncoder` do the same for messages that are already whole, like frames from a framer. They cover what `BinaryCodec` can't, like a frame that decodes to several messages or none.
