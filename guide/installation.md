---
title: Installation
description: 'Install Netify with bun add and set up TypeScript. It needs Bun 1.2 or newer and has no runtime dependencies.'
---

# Installation

```sh
bun add @netifyjs/netify
bun add -d @types/bun typescript
```

You'll need Bun 1.2.0 or newer. Netify has no runtime dependencies. For the MessagePack or Protobuf codecs, install `msgpackr` or `protobufjs` yourself and pass in the packer or message type.

It ships as TypeScript source with no build output. Bun runs it directly and your type checker compiles it with your own files.

## TypeScript settings

Netify uses this config itself. Start from it.

::: code-group

```json [tsconfig.json]
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "Preserve",
    "moduleResolution": "bundler",
    "lib": ["ESNext"],
    "types": ["bun"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "noImplicitOverride": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "noEmit": true
  }
}
```

:::

With your own config, keep `allowImportingTsExtensions` and `noEmit`, since Netify's imports end in `.ts`. Keep `types: ["bun"]` too, for Bun's socket types. The rest is taste, but `noImplicitOverride` is worth having. It makes you write `override`, which turns a misspelt `channelRaed` into a compile error. Without it the method never runs and nothing tells you.

::: warning
Leave `noUnusedParameters` off. With it on, `tsc` reports errors inside Netify's own source.
:::

## Check it works

::: code-group

```ts twoslash [server.ts]
import { ServerBootstrap, type Channel } from '@netifyjs/netify'

const server = await new ServerBootstrap()
  .childHandler((channel: Channel): void => {
    console.log(
      `Connection #${String(channel.id)} from ${channel.remoteAddress}`,
    )
  })
  .bind({ port: 9000 })

console.log(`Listening on ${String(server.port)}`)
```

:::

```sh
bun server.ts
nc localhost 9000
```

You'll see a line per connection. Typing into `nc` does nothing yet because the pipeline is empty. [Your first server](./first-server) adds a handler that answers.
