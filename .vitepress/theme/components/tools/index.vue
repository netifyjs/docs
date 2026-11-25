<script lang="ts" setup>
import { ArrowRight } from 'lucide-vue-next'
import { withBase } from 'vitepress'

/**
 * One tool in a group
 */
type Tool = {
  /**
   * Its name
   */
  readonly title: string

  /**
   * The class behind it
   */
  readonly entry: string

  /**
   * A sentence about it
   */
  readonly text: string

  /**
   * A measured result, or null
   */
  readonly figure: string | null

  /**
   * The page about it
   */
  readonly link: string
}

/**
 * A set of tools under one heading
 */
type Group = {
  /**
   * The heading
   */
  readonly title: string

  /**
   * A sentence under the heading
   */
  readonly text: string

  /**
   * Its tools
   */
  readonly tools: readonly Tool[]
}

/**
 * Every group
 */
const GROUPS: readonly Group[] = [
  {
    title: 'Across cores',
    text: 'A Bun process runs on one core. These spread a server over the rest.',
    tools: [
      {
        title: 'Clustering',
        entry: 'Cluster',
        text: 'Runs the same server in several processes that share one port, with graceful stops and rolling reloads.',
        figure: '7.2M msg/s TCP echo on 4 cores',
        link: '/scaling/clustering',
      },
      {
        title: 'Sharding',
        entry: 'ShardLink',
        text: 'Gives each process its own zones and port, links them directly, and moves players between them.',
        figure: '3M messages a second between two shards',
        link: '/scaling/sharding',
      },
      {
        title: 'Worker threads',
        entry: 'WorkerGroup',
        text: 'Runs a server on several threads in one process, with shared memory between them.',
        figure: null,
        link: '/scaling/workers#workergroup',
      },
      {
        title: 'Offloading',
        entry: 'OffloadHandler',
        text: 'Sends slow work from the pipeline to a pool of threads and passes the result on.',
        figure: '3.7x the throughput on 4 threads',
        link: '/scaling/workers#offloadhandler',
      },
    ],
  },
  {
    title: 'On every core',
    text: 'Each message takes a short path, and these keep it short in your code too.',
    tools: [
      {
        title: 'Pooled buffers',
        entry: 'ByteBufPool',
        text: 'Decoders reuse frame objects, so steady traffic makes almost no garbage.',
        figure: null,
        link: '/guide/bytebuf#pooled-frames',
      },
      {
        title: 'Bit packing',
        entry: 'BitWriter',
        text: 'Writes fields of 1 to 32 bits, with Quantizer for floats in a known range.',
        figure: null,
        link: '/guide/bytebuf#packing-bits',
      },
      {
        title: 'Flush batching',
        entry: 'FlushConsolidationHandler',
        text: 'Merges the flushes made during one read into a single write.',
        figure: null,
        link: '/guide/handlers#built-in-handlers',
      },
      {
        title: 'Rate limits',
        entry: 'GlobalTrafficShapingHandler',
        text: 'Holds each player, or the whole server, to a byte rate and slows senders down instead of dropping them.',
        figure: null,
        link: '/scaling/safety#rate-limits',
      },
      {
        title: 'Metrics',
        entry: 'MetricsHandler',
        text: 'Counts connections, bytes, messages and handler time, so you add shards when the numbers say so.',
        figure: null,
        link: '/scaling/metrics',
      },
      {
        title: 'Broadcasts',
        entry: 'ChannelGroup',
        text: 'Encodes a message once and sends the same bytes to every player.',
        figure: null,
        link: '/scaling/performance#fan-out-once',
      },
    ],
  },
]
</script>

<template>
  <section class="tools">
    <div class="intro">
      <p class="label">Built for performance</p>
      <h2 class="title">From one core<br />to all of them</h2>
    </div>

    <div v-for="group in GROUPS" :key="group.title" class="group">
      <div class="side">
        <h3>{{ group.title }}</h3>
        <p>{{ group.text }}</p>
      </div>

      <div class="grid">
        <a
          v-for="tool in group.tools"
          :key="tool.title"
          class="tool"
          :href="withBase(tool.link)"
        >
          <span class="head">
            <span class="name">{{ tool.title }}</span>
            <ArrowRight :size="14" class="arrow" />
          </span>
          <code class="entry">{{ tool.entry }}</code>
          <span class="text">{{ tool.text }}</span>
          <span v-if="tool.figure !== null" class="figure">
            {{ tool.figure }}
          </span>
        </a>
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
  margin: 8px 0 0;
  padding: 0;
  border: 0;
  color: var(--nf-fg);
  font-size: clamp(44px, 5vw, 64px);
  font-weight: 600;
  line-height: 1;
  letter-spacing: -0.045em;
}

.group {
  display: grid;
  grid-template-columns: minmax(0, 0.42fr) minmax(0, 1fr);
  gap: 48px;
  margin-top: 64px;
  padding-top: 40px;
  border-top: 1px solid var(--nf-line-strong);
}

.side h3 {
  margin: 0 0 10px;
  color: var(--nf-fg);
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.side p {
  max-width: 320px;
  margin: 0;
  color: var(--nf-muted);
  font-size: 15px;
  line-height: 1.6;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.tool {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 22px 22px 20px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 16px;
  text-decoration: none;
  transition:
    border-color 0.2s,
    transform 0.2s,
    box-shadow 0.2s;
}

.tool:hover {
  border-color: var(--nf-faint);
  transform: translateY(-2px);
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.name {
  color: var(--nf-fg);
  font-size: 18px;
  font-weight: 500;
  letter-spacing: -0.015em;
}

.arrow {
  color: var(--nf-faint);
  transition:
    color 0.2s,
    transform 0.2s;
}

.tool:hover .arrow {
  color: var(--nf-fg);
  transform: translateX(3px);
}

.entry {
  align-self: flex-start;
  padding: 2px 8px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 6px;
  background: var(--nf-sunken);
  color: var(--nf-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
}

.text {
  color: var(--nf-muted);
  font-size: 14.5px;
  line-height: 1.6;
}

.figure {
  display: inline-flex;
  align-self: flex-start;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding: 5px 11px 5px 9px;
  border-radius: 999px;
  background: var(--nf-sunken-strong);
  color: var(--nf-fg);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}

.figure::before {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--nf-fg);
  box-shadow: 0 0 10px var(--nf-fg);
  content: '';
}

@media (max-width: 960px) {
  .group {
    grid-template-columns: minmax(0, 1fr);
    gap: 28px;
  }
}

@media (max-width: 560px) {
  .grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
