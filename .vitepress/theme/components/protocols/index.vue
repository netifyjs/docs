<script lang="ts" setup>
import { ArrowRight } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import { ref } from 'vue'

/**
 * One protocol in the list
 */
type Protocol = {
  /**
   * The slot with its example
   */
  readonly key: string

  /**
   * Its name
   */
  readonly title: string

  /**
   * The class that starts it
   */
  readonly entry: string

  /**
   * A sentence about it
   */
  readonly text: string

  /**
   * The page about it
   */
  readonly link: string
}

/**
 * Every protocol
 */
const PROTOCOLS: readonly Protocol[] = [
  {
    key: 'tcp',
    title: 'TCP',
    entry: 'ServerBootstrap',
    text: 'Length, line and delimiter framing. TLS and Unix sockets use the same code.',
    link: '/transports/tcp',
  },
  {
    key: 'udp',
    title: 'UDP',
    entry: 'DatagramBootstrap',
    text: 'Each packet carries its sender, and the replies to one read leave in a single sendMany.',
    link: '/transports/udp',
  },
  {
    key: 'reliable',
    title: 'Reliable UDP',
    entry: 'ReliableBootstrap',
    text: 'Acks, resends and fragmentation, with lanes that each pick their own delivery.',
    link: '/transports/reliable',
  },
  {
    key: 'websocket',
    title: 'WebSocket',
    entry: 'WebSocketBootstrap',
    text: "Bun's native server underneath, with topics that fan out to a room in native code.",
    link: '/transports/websocket',
  },
  {
    key: 'http',
    title: 'HTTP',
    entry: 'HttpServerCodec',
    text: 'Request and response codecs on the TCP pipeline, with keep-alive and pipelining.',
    link: '/transports/http',
  },
]

/**
 * The protocol on show
 */
const active = ref<string>('tcp')
</script>

<template>
  <section class="protocols">
    <div class="intro">
      <p class="label">Protocols</p>
      <h2 class="title">One pipeline for<br />every protocol</h2>
      <p class="lead">
        Handlers don't know which protocol they run on. Write the game logic
        once, then serve TCP to native clients, WebSocket to browsers and
        reliable UDP where latency matters.
      </p>
    </div>

    <div class="body">
      <ol class="list" role="tablist">
        <li
          v-for="protocol in PROTOCOLS"
          :key="protocol.key"
          class="row"
          :class="{ active: protocol.key === active }"
        >
          <button
            type="button"
            role="tab"
            class="item"
            :aria-selected="protocol.key === active"
            @click="active = protocol.key"
          >
            <span class="head">
              <span class="name">{{ protocol.title }}</span>
              <code class="entry">{{ protocol.entry }}</code>
            </span>
            <span class="text">{{ protocol.text }}</span>
          </button>
          <a
            v-if="protocol.key === active"
            class="more"
            :href="withBase(protocol.link)"
          >
            Read the {{ protocol.title }} guide
            <ArrowRight :size="14" />
          </a>
        </li>
      </ol>

      <div class="card">
        <div class="bar" aria-hidden="true">
          <span class="dots"><i /><i /><i /></span>
          <span class="file">server.ts</span>
        </div>
        <div
          v-for="protocol in PROTOCOLS"
          :key="protocol.key"
          class="code"
          :class="{ shown: protocol.key === active }"
        >
          <slot :name="protocol.key" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.label {
  margin: 0;
  color: var(--nf-muted);
  font-size: 20px;
  font-weight: 500;
}

.title {
  margin: 8px 0 24px;
  padding: 0;
  border: 0;
  color: var(--nf-fg);
  font-size: clamp(44px, 5vw, 64px);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.045em;
}

.lead {
  max-width: 640px;
  margin: 0;
  color: var(--nf-muted);
  font-size: 18px;
  line-height: 1.6;
  text-wrap: pretty;
}

.body {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  align-items: start;
  gap: clamp(32px, 5vw, 80px);
  margin-top: 64px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  border: 1px solid transparent;
  border-radius: 14px;
  transition:
    border-color 0.2s,
    background-color 0.2s,
    box-shadow 0.2s;
}

.row:hover {
  background: var(--nf-sunken);
}

.row.active {
  border-color: var(--nf-line-strong);
}

.item {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 8px;
  padding: 20px 4px 20px 20px;
  text-align: left;
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.name {
  color: var(--nf-muted);
  font-size: 19px;
  font-weight: 500;
  letter-spacing: -0.01em;
}

.active .name {
  color: var(--nf-fg);
}

.entry {
  padding: 1px 7px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 6px;
  color: var(--nf-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
}

.text {
  color: var(--nf-muted);
  font-size: 14.5px;
  line-height: 1.6;
}

.more {
  display: inline-flex;
  margin: -6px 0 20px 20px;
  align-items: center;
  gap: 6px;
  color: var(--nf-fg);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
}

.more:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.card {
  position: sticky;
  top: calc(var(--vp-nav-height) + 24px);
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--nf-line-strong);
  border-radius: 18px;
}

.bar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
  border-bottom: 1px solid var(--nf-line);
}

.dots {
  display: flex;
  gap: 6px;
}

.dots i {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--nf-line-strong);
}

.file {
  color: var(--nf-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}

.code {
  display: none;
}

.code.shown {
  display: block;
}

.code :deep(div[class*='language-']) {
  margin: 0;
  border-radius: 0;
  background: transparent;
}

.code :deep(div[class*='language-'] > span.lang),
.code :deep(div[class*='language-'] > button.copy) {
  display: none;
}

.code :deep(pre) {
  margin: 0;
  overflow-x: auto;
  padding: 28px 32px;
  background: transparent !important;
  scrollbar-width: thin;
}

.code :deep(pre code) {
  display: block;
  width: fit-content;
  min-width: 100%;
  font-family: var(--vp-font-family-mono);
  font-size: 13.5px;
  line-height: 1.75;
}

@media (max-width: 960px) {
  .body {
    grid-template-columns: minmax(0, 1fr);
  }

  .card {
    position: static;
  }
}
</style>
