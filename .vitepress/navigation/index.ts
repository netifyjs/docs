import { type DefaultTheme } from 'vitepress'

/**
 * The links along the top
 */
export const NAV: DefaultTheme.NavItem[] = [
  { text: 'Guide', link: '/guide/introduction' },
  { text: 'Transports', link: '/transports/tcp' },
  { text: 'Scaling', link: '/scaling/games' },
  { text: 'Reference', link: '/reference/api' },
]

/**
 * The links down the side
 */
export const SIDEBAR: DefaultTheme.Sidebar = [
  {
    text: 'Getting started',
    items: [
      { text: 'Introduction', link: '/guide/introduction' },
      { text: 'Installation', link: '/guide/installation' },
      { text: 'Your first server', link: '/guide/first-server' },
      { text: 'Clients', link: '/guide/clients' },
      { text: 'How it works', link: '/guide/how-it-works' },
    ],
  },
  {
    text: 'Building blocks',
    items: [
      { text: 'Handlers', link: '/guide/handlers' },
      { text: 'Pipelines', link: '/guide/pipeline' },
      { text: 'ByteBuf', link: '/guide/bytebuf' },
      { text: 'Codecs', link: '/guide/codecs' },
    ],
  },
  {
    text: 'Transports',
    items: [
      { text: 'TCP', link: '/transports/tcp' },
      { text: 'UDP', link: '/transports/udp' },
      { text: 'Reliable UDP', link: '/transports/reliable' },
      { text: 'WebSocket', link: '/transports/websocket' },
      { text: 'HTTP', link: '/transports/http' },
    ],
  },
  {
    text: 'Scaling',
    items: [
      { text: 'Game servers', link: '/scaling/games' },
      { text: 'Clustering', link: '/scaling/clustering' },
      { text: 'Sharding', link: '/scaling/sharding' },
      { text: 'Worker threads', link: '/scaling/workers' },
      { text: 'Safety limits', link: '/scaling/safety' },
      { text: 'Metrics', link: '/scaling/metrics' },
      { text: 'Performance', link: '/scaling/performance' },
    ],
  },
  {
    text: 'Migrating',
    items: [
      { text: 'From Netty', link: '/migrating/netty' },
      { text: 'From Socket.IO', link: '/migrating/socketio' },
      { text: 'From ws', link: '/migrating/ws' },
      { text: 'From node:net', link: '/migrating/net' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'API', link: '/reference/api' },
      { text: 'Options', link: '/reference/options' },
    ],
  },
]
