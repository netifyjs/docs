<script lang="ts" setup>
import { withBase } from 'vitepress'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { data, type Measurement } from '#theme/results/index.data'
import { RuntimeLabel } from '#theme/utils/runtime/index'

/**
 * One test you can switch to
 */
type Test = {
  /**
   * Tab label
   */
  readonly label: string

  /**
   * What was measured
   */
  readonly detail: string

  /**
   * Unit after netify's value
   */
  readonly unit: string

  /**
   * The rows, fastest first
   */
  readonly rows: readonly Measurement[]

  /**
   * The same test on several cores, fastest first, empty if not measured
   */
  readonly coreRows: readonly Measurement[]

  /**
   * What was measured on several cores
   */
  readonly coreDetail: string
}

/**
 * A headline multiplier
 */
type Stat = {
  /**
   * How many times, like 22x
   */
  readonly times: string

  /**
   * What it's against
   */
  readonly text: string
}

/**
 * Raw APIs with no framework on top, left out so only frameworks are compared
 */
const RAW: ReadonlySet<string> = new Set<string>([
  'Bun.listen',
  'Bun.serve',
  'node:net',
  'node:http',
  'node:dgram',
  'Bun.udpSocket',
  'ws',
  'uWebSockets.js',
])

/**
 * Sorts frameworks fastest first, leaving out raw APIs
 * @param rows the results
 * @returns A sorted copy
 */
const sorted = (rows: readonly Measurement[] = []): readonly Measurement[] =>
  rows
    .filter((row: Measurement): boolean => !RAW.has(row.name))
    .sort(
      (first: Measurement, second: Measurement): number =>
        second.value - first.value,
    )

/**
 * Every test that has results
 */
const TESTS: readonly Test[] = [
  {
    label: 'TCP',
    detail: '64 clients, 32 framed messages each',
    unit: 'msg/s',
    rows: sorted(data.tcp?.echo),
    coreRows: sorted(data.tcpcores?.echo),
    coreDetail: '160 clients, 32 framed messages each',
  },
  {
    label: 'UDP',
    detail: '64 sockets, 32 datagrams each',
    unit: 'msg/s',
    rows: sorted(data.udp?.echo),
    coreRows: [],
    coreDetail: '',
  },
  {
    label: 'HTTP',
    detail: '64 connections, 16 pipelined requests each',
    unit: 'req/s',
    rows: sorted(data.http?.echo),
    coreRows: sorted(data.httpcores?.echo),
    coreDetail: '160 connections, 16 pipelined requests each',
  },
  {
    label: 'WebSocket',
    detail: '64 clients, 32 messages each',
    unit: 'msg/s',
    rows: sorted(data.websocket?.echo),
    coreRows: sorted(data.websocketcores?.echo),
    coreDetail: '160 clients, 32 messages each',
  },
  {
    label: 'Broadcast',
    detail: 'One room of 1,000 clients',
    unit: 'deliveries/s',
    rows: sorted(data.websocket?.broadcast),
    coreRows: [],
    coreDetail: '',
  },
].filter((test: Test): boolean => test.rows.length > 1)

/**
 * How many times faster netify was than a framework, rounded down
 * @param rows one test's rows
 * @param rival the framework
 * @param text what the stat says
 * @returns The stat, or null without both results
 */
const versus = (
  rows: readonly Measurement[] | undefined,
  rival: string,
  text: string,
): Stat | null => {
  const ours = rows?.find((row: Measurement): boolean => row.name === 'netify')
  const theirs = rows?.find((row: Measurement): boolean => row.name === rival)
  if (ours === undefined || theirs === undefined || theirs.value <= 0) {
    return null
  }

  return { times: `${String(Math.floor(ours.value / theirs.value))}x`, text }
}

/**
 * The headline multipliers
 */
const STATS: readonly Stat[] = [
  versus(data.tcp?.echo, 'NestJS', 'faster than NestJS over TCP'),
  versus(data.websocket?.broadcast, 'Colyseus', 'the broadcasts of Colyseus'),
].filter((stat: Stat | null): stat is Stat => stat !== null)

/**
 * Height that fits the test with the most rows, so switching doesn't move the page
 */
const ROWS_HEIGHT = `${String(
  Math.max(
    ...TESTS.map((item: Test): number =>
      Math.max(item.rows.length, item.coreRows.length),
    ),
  ) * 52,
)}px`

/**
 * The open test
 */
const active = ref<number>(0)

/**
 * The open test's details
 */
const test = computed<Test | undefined>(() => TESTS[active.value])

/**
 * Whether the multi-core results are showing
 */
const multi = ref<boolean>(false)

/**
 * Whether the open test has multi-core results
 */
const hasCores = computed<boolean>(() => (test.value?.coreRows.length ?? 0) > 1)

/**
 * The rows on show, single or multi-core
 */
const rows = computed<readonly Measurement[]>(() =>
  multi.value && hasCores.value
    ? (test.value?.coreRows ?? [])
    : (test.value?.rows ?? []),
)

/**
 * The open test's fastest value
 */
const best = computed<number>(() => rows.value[0]?.value ?? 1)

/**
 * A value with thousands separators
 * @param value the measurement
 * @returns The value as it's shown
 */
const grouped = (value: number): string =>
  Math.round(value).toLocaleString('en-GB')

/**
 * A bar's width as a share of the fastest
 * @param value the measurement
 * @returns A CSS width
 */
const width = (value: number): string =>
  `${String(Math.max(1.5, (value / best.value) * 100))}%`

/**
 * The chart, watched so the bars grow once it's on screen
 */
const chart = ref<HTMLElement | null>(null)

/**
 * Set once the chart has scrolled into view
 */
const shown = ref<boolean>(false)

/**
 * Watches for the chart coming into view
 */
const observer = ref<IntersectionObserver | null>(null)

onMounted((): void => {
  if (chart.value === null || !('IntersectionObserver' in window)) {
    shown.value = true
    return
  }

  observer.value = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]): void => {
      const visible = entries.some(
        (entry: IntersectionObserverEntry): boolean => entry.isIntersecting,
      )
      if (!visible) return

      shown.value = true
      observer.value?.disconnect()
    },
    {
      /**
       * Starts a little before it's fully in
       */
      threshold: 0.2,
    },
  )
  observer.value.observe(chart.value)
})

onBeforeUnmount((): void => {
  observer.value?.disconnect()
})
</script>

<template>
  <section class="benchmarks">
    <p class="label">Benchmarks</p>

    <div class="stats">
      <div v-for="stat in STATS" :key="stat.text" class="stat">
        <span class="times">{{ stat.times }}</span>
        <span class="text">{{ stat.text }}</span>
      </div>
    </div>

    <div ref="chart" class="chart" :class="{ shown }">
      <div class="toolbar">
        <div class="tabs" role="tablist">
          <button
            v-for="(item, index) in TESTS"
            :key="item.label"
            type="button"
            role="tab"
            class="tab"
            :class="{ active: index === active }"
            :aria-selected="index === active"
            @click="active = index"
          >
            {{ item.label }}
          </button>
        </div>
        <div v-if="hasCores" class="tabs cores">
          <button
            type="button"
            class="tab"
            :class="{ active: !multi }"
            @click="multi = false"
          >
            1 core
          </button>
          <button
            type="button"
            class="tab"
            :class="{ active: multi }"
            @click="multi = true"
          >
            4 cores
          </button>
        </div>
        <span v-if="test !== undefined" class="unit">{{ test.unit }}</span>
      </div>

      <ol
        v-if="test !== undefined"
        class="rows"
        :style="{ height: ROWS_HEIGHT }"
      >
        <li
          v-for="(row, index) in rows"
          :key="row.name"
          class="row"
          :class="{ ours: row.name === 'netify' }"
          :style="{ '--delay': `${String(index * 60)}ms` }"
        >
          <span class="name">
            {{ row.name === 'netify' ? 'Netify' : row.name
            }}<small>{{ RuntimeLabel.of(row.runtime) }}</small>
          </span>
          <span class="track">
            <span class="bar" :style="{ '--width': width(row.value) }" />
          </span>
          <span class="value">{{ grouped(row.value) }}</span>
        </li>
      </ol>

      <p class="note">
        {{ multi && hasCores ? test?.coreDetail : test?.detail }} · median of 3
        runs ·
        <a :href="withBase('/scaling/performance#running-it')"
          >Run it yourself</a
        >
      </p>
    </div>
  </section>
</template>

<style scoped>
.benchmarks {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 0.42fr) minmax(0, 1fr);
  align-items: center;
  gap: 48px;
  padding: 48px 0;
}

.benchmarks::before {
  position: absolute;
  z-index: -1;
  inset: 0 -60px;
  background-image:
    linear-gradient(var(--nf-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--nf-line) 1px, transparent 1px);
  background-position: center;
  background-size: 60px 60px;
  content: '';
  mask-image: radial-gradient(ellipse at center, black 40%, transparent 85%);
}

.label {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--nf-muted);
  font-size: 20px;
  font-weight: 500;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 40px;
  padding-left: 8px;
}

.stat {
  display: flex;
  flex-direction: column;
}

.times {
  color: var(--nf-fg);
  font-size: clamp(56px, 6vw, 88px);
  font-weight: 700;
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.stat:last-child .times {
  font-size: clamp(44px, 4.6vw, 68px);
}

.text {
  margin-top: 6px;
  color: var(--nf-muted);
  font-size: 18px;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 18px;
}

.toolbar .tabs {
  margin-bottom: 0;
}

.tabs {
  display: inline-flex;
  gap: 2px;
  margin-bottom: 18px;
  padding: 3px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 8px;
  background: var(--nf-surface);
}

.tab {
  padding: 5px 12px;
  border-radius: 5px;
  color: var(--nf-muted);
  font-size: 13px;
  font-weight: 500;
  transition:
    background-color 0.15s,
    color 0.15s;
}

.tab:hover {
  color: var(--nf-fg);
}

.tab.active {
  background: var(--nf-sunken-strong);
  color: var(--nf-fg);
}

.unit {
  align-self: center;
  margin-left: auto;
  padding: 3px 10px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 999px;
  color: var(--nf-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
}

.rows {
  margin: 0;
  padding: 8px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 16px;
  list-style: none;
  box-sizing: content-box;
}

.row {
  display: grid;
  grid-template-columns: 200px minmax(0, 1fr) 110px;
  align-items: center;
  gap: 18px;
  height: 52px;
  padding: 0 16px;
  border-radius: 10px;
}

.row.ours {
  background: var(--nf-sunken);
}

.name {
  display: flex;
  overflow: hidden;
  align-items: baseline;
  gap: 8px;
  color: var(--nf-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 15px;
  white-space: nowrap;
}

.name small {
  color: var(--nf-faint);
  font-size: 12px;
}

.ours .name,
.ours .value {
  color: var(--nf-fg);
  font-weight: 600;
}

.track {
  position: relative;
  height: 10px;
  border-radius: 999px;
  background: var(--nf-line);
}

.bar {
  position: absolute;
  inset: 0 auto 0 0;
  width: 0;
  border-radius: inherit;
  background: var(--nf-faint);
  transition: width 0.9s cubic-bezier(0.22, 1, 0.36, 1) var(--delay);
}

.shown .bar {
  width: var(--width);
}

.ours .track {
  height: 14px;
}

.ours .bar {
  background: var(--nf-fg);
  box-shadow: 0 0 22px -2px color-mix(in srgb, var(--nf-fg) 40%, transparent);
}

.value {
  color: var(--nf-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.note {
  margin: 18px 0 0;
  color: var(--nf-muted);
  font-size: 14px;
  line-height: 1.6;
}

.note a {
  color: var(--nf-fg);
  text-decoration: underline;
  text-underline-offset: 3px;
}

@media (max-width: 960px) {
  .benchmarks {
    grid-template-columns: minmax(0, 1fr);
  }

  .stats {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .row {
    grid-template-columns: 104px minmax(0, 1fr) 82px;
    gap: 10px;
    padding: 0 10px;
  }

  .name {
    font-size: 14px;
  }

  .name small {
    display: none;
  }

  .value {
    font-size: 12.5px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bar {
    transition: none;
  }
}
</style>
