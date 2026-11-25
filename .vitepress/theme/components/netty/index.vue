<script lang="ts" setup>
import { ArrowRight } from 'lucide-vue-next'
import { withBase } from 'vitepress'

/**
 * One line of the comparison
 */
type Row = {
  /**
   * What's being compared
   */
  readonly topic: string

  /**
   * How Netty does it
   */
  readonly netty: string

  /**
   * How Netify does it
   */
  readonly netify: string
}

/**
 * Every line, top to bottom
 */
const ROWS: readonly Row[] = [
  {
    topic: 'Building blocks',
    netty: 'Channels, pipelines, handlers and codecs',
    netify: 'The same, and most class names carry over',
  },
  {
    topic: 'Threads',
    netty: 'An EventLoopGroup with a thread per core',
    netify:
      'One thread per process, with Cluster or WorkerGroup for more cores',
  },
  {
    topic: 'Slow handlers',
    netty: 'Blocking one stalls every channel on its event loop',
    netify:
      'Handlers can be async. That connection waits and the rest carry on',
  },
  {
    topic: 'Writes',
    netty: 'A ChannelFuture, or voidPromise to skip it',
    netify: 'A Promise, or writeSync to skip it',
  },
  {
    topic: 'Buffers',
    netty: 'Reference counted, and you release them',
    netify: 'Garbage collected. Only pooled frames you keep need retain',
  },
  {
    topic: 'WebSocket',
    netty: 'A codec in the pipeline',
    netify:
      "Bun's native server with topic publish, or a codec in the pipeline",
  },
  {
    topic: 'Reliable UDP',
    netty: 'QUIC through the incubator codec',
    netify: 'ReliableBootstrap, with acks, resends and ordering',
  },
  {
    topic: 'Scaling out',
    netty: 'Up to you',
    netify: 'Cluster for processes, ShardLink and ShardMap for shards',
  },
]
</script>

<template>
  <section class="netty">
    <div class="intro">
      <div>
        <p class="label">Netify and Netty</p>
        <h2 class="title">Same model,<br />different runtime</h2>
      </div>
      <div class="side">
        <p>
          If you know Netty, you already know how Netify fits together. These
          are the bits that work differently on Bun.
        </p>
        <a class="more" :href="withBase('/migrating/netty')">
          Coming from Netty
          <ArrowRight :size="14" class="arrow" />
        </a>
      </div>
    </div>

    <div class="compare">
      <div class="panel" aria-hidden="true"></div>

      <div class="corner"></div>
      <div class="column">
        <span class="name">Netty</span>
        <span class="runtime">Java · JVM</span>
      </div>
      <div class="column ours">
        <span class="name">Netify</span>
        <span class="runtime">TypeScript · Bun</span>
      </div>

      <div v-for="(row, index) in ROWS" :key="row.topic" class="line">
        <div class="topic">
          <span class="index">{{ String(index + 1).padStart(2, '0') }}</span>
          {{ row.topic }}
        </div>
        <div class="cell" data-name="Netty">{{ row.netty }}</div>
        <div class="cell ours" data-name="Netify">{{ row.netify }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.intro {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

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

.side p {
  max-width: 640px;
  margin: 0;
  color: var(--nf-muted);
  font-size: 18px;
  line-height: 1.6;
}

.more {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 18px;
  color: var(--nf-fg);
  font-size: 15px;
  font-weight: 500;
  text-decoration: none;
}

.more .arrow {
  transition: transform 0.15s;
}

.more:hover .arrow {
  transform: translateX(2px);
}

.compare {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 0.62fr) minmax(0, 1fr) minmax(0, 1fr);
  margin-top: 64px;
}

.panel {
  position: absolute;
  top: -1px;
  right: 0;
  bottom: -1px;
  width: calc((100% - 0px) * 1 / 2.62);
  overflow: hidden;
  border: 1px solid var(--nf-line-strong);
  border-radius: 18px;
}

.line {
  display: contents;
}

.corner,
.column,
.topic,
.cell {
  position: relative;
  z-index: 1;
}

.column {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 28px 28px 24px;
}

.name {
  color: var(--nf-fg);
  font-size: 24px;
  font-weight: 600;
  letter-spacing: -0.03em;
}

.column:not(.ours) .name {
  color: var(--nf-muted);
}

.runtime {
  color: var(--nf-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  letter-spacing: 0.04em;
}

.topic,
.cell {
  padding: 20px 28px;
  border-top: 1px solid var(--nf-line);
  font-size: 15px;
  line-height: 1.55;
}

.topic {
  display: flex;
  align-items: baseline;
  gap: 14px;
  padding-left: 0;
  color: var(--nf-fg);
  font-weight: 500;
}

.index {
  padding: 1px 6px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 5px;
  color: var(--nf-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 11px;
  font-weight: 400;
  transition:
    border-color 0.2s,
    color 0.2s;
}

.cell {
  color: var(--nf-faint);
  transition: color 0.2s;
}

.cell.ours {
  border-top-color: var(--nf-line-strong);
  color: var(--nf-fg-soft);
}

.line:hover .cell {
  color: var(--nf-muted);
}

.line:hover .cell.ours {
  color: var(--nf-fg);
}

.line:hover .index {
  border-color: var(--nf-faint);
  color: var(--nf-fg);
}

@media (max-width: 720px) {
  .compare {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
    margin-top: 48px;
  }

  .panel,
  .corner,
  .column {
    display: none;
  }

  .topic {
    margin-top: 24px;
    padding: 18px 0 10px;
    border-top-color: var(--nf-line-strong);
  }

  .cell {
    padding: 12px 16px;
    border: 1px solid var(--nf-line);
    border-radius: 10px;
  }

  .cell.ours {
    margin-top: 8px;
  }

  .cell::before {
    content: attr(data-name);
    display: block;
    margin-bottom: 4px;
    color: var(--nf-faint);
    font-family: var(--vp-font-family-mono);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
}
</style>
