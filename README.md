# Netify docs

Source for [netifyjs.dev](https://netifyjs.dev), built with VitePress.

## Running locally

```sh
bun install
bun run dev
```

`bun run build` builds the site into `.vitepress/dist`, and `bun run preview` serves the build.

## Source and benchmarks

Code samples are checked against `../../netify.js`. Set `NETIFY_DIR` to use another copy.

Benchmark numbers come from `../benchmarks`. Set `BENCHMARKS_DIR` to use another copy.

If either is missing, the build pulls it from GitHub.

## Layout

| Folder       | What's in it                               |
| ------------ | ------------------------------------------ |
| `guide`      | Getting started and the core concepts      |
| `transports` | TCP, UDP, reliable UDP, WebSocket and HTTP |
| `scaling`    | Clustering, sharding, workers and tuning   |
| `reference`  | Every export and every options type        |
| `public`     | Static files like the share image          |
| `.vitepress` | Config, theme, components and scripts      |

## Deploying

The site is served by Cloudflare. Build it, then deploy with Wrangler.

```sh
bun run build
bunx wrangler deploy
```
