<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { data, type Measurement, type Results } from '#theme/results/index.data'
import { RuntimeLabel } from '#theme/utils/runtime/index'

/**
 * What the chart shows
 */
type ChartProps = {
  /**
   * Results group, like tcp or tcpcores
   */
  readonly group: keyof Results
  /**
   * Heading above the bars
   */
  readonly title: string
  /**
   * Echo or broadcast results
   */
  readonly kind?: 'echo' | 'broadcast'
  /**
   * Unit after each value
   */
  readonly unit?: string
  /**
   * Raw APIs to show as baselines
   */
  readonly baselines?: readonly string[]
  /**
   * Line under the heading
   */
  readonly caption?: string
}

const props = withDefaults(defineProps<ChartProps>(), {
  kind: 'echo',
  unit: 'msg/s',
  baselines: (): readonly string[] => [],
  caption: '',
})

/**
 * Raw APIs with no framework on top
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
 * Frameworks plus any baselines asked for, fastest first
 */
const rows = computed<readonly Measurement[]>(() =>
  (data[props.group]?.[props.kind] ?? [])
    .filter(
      (row: Measurement): boolean =>
        !RAW.has(row.name) || props.baselines.includes(row.name),
    )
    .toSorted(
      (first: Measurement, second: Measurement): number =>
        second.value - first.value,
    ),
)

/**
 * Fastest value on show
 */
const best = computed<number>(() => rows.value[0]?.value ?? 1)

/**
 * Whether any striped rows are on show
 */
const hasBaselines = computed<boolean>(() =>
  rows.value.some((row: Measurement): boolean => RAW.has(row.name)),
)

/**
 * The figure, watched so the bars grow once it's on screen
 */
const figure = ref<HTMLElement | null>(null)

/**
 * Set once the chart has scrolled into view
 */
const shown = ref<boolean>(false)

/**
 * Watches for the chart coming into view
 */
const observer = ref<IntersectionObserver | null>(null)

onMounted((): void => {
  if (figure.value === null || !('IntersectionObserver' in window)) {
    shown.value = true
    return
  }

  observer.value = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]): void => {
      if (
        !entries.some(
          (entry: IntersectionObserverEntry): boolean => entry.isIntersecting,
        )
      )
        return
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
  observer.value.observe(figure.value)
})

onBeforeUnmount((): void => {
  observer.value?.disconnect()
})

/**
 * A value with thousands separators
 * @param value the measurement
 */
const grouped = (value: number): string =>
  Math.round(value).toLocaleString('en-GB')

/**
 * Bar width as a share of the fastest
 * @param value the measurement
 */
const width = (value: number): string =>
  `${String(Math.max(1.5, (value / best.value) * 100))}%`
</script>

<template>
  <figure ref="figure" class="chart" :class="{ shown }">
    <header class="head">
      <div>
        <p class="title">{{ props.title }}</p>
        <p v-if="props.caption !== ''" class="caption">{{ props.caption }}</p>
      </div>
      <span class="unit">{{ props.unit }}</span>
    </header>

    <ol class="rows">
      <li
        v-for="(row, index) in rows"
        :key="row.name"
        class="row"
        :class="{
          ours: row.name === 'netify',
          baseline: RAW.has(row.name),
        }"
        :style="{ '--delay': `${String(index * 60)}ms` }"
      >
        <span class="name">
          {{ row.name === 'netify' ? 'Netify' : row.name }}
          <small>{{ RuntimeLabel.of(row.runtime) }}</small>
        </span>
        <span class="track">
          <span class="bar" :style="{ '--width': width(row.value) }" />
        </span>
        <span class="value">{{ grouped(row.value) }}</span>
      </li>
    </ol>

    <footer class="foot">
      <span class="key"><i class="swatch" />Framework</span>
      <span v-if="hasBaselines" class="key"
        ><i class="swatch striped" />Raw API, for reference</span
      >
      <span class="median">Median of three runs</span>
    </footer>
  </figure>
</template>

<style scoped>
.chart {
  margin: 24px 0 32px;
  overflow: hidden;
  border: 1px solid var(--nf-line-strong);
  border-radius: 14px;
  background: var(--nf-surface);
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 22px 14px;
  border-bottom: 1px solid var(--nf-line);
}

.title {
  margin: 0;
  color: var(--nf-fg);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
}

.caption {
  margin: 2px 0 0;
  color: var(--nf-muted);
  font-size: 13px;
  line-height: 1.5;
}

.unit {
  flex: none;
  padding: 2px 8px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 999px;
  color: var(--nf-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
}

.rows {
  margin: 0;
  padding: 8px 10px;
  list-style: none;
}

.row {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr) 92px;
  align-items: center;
  gap: 14px;
  height: 42px;
  margin: 0;
  padding: 0 12px;
  border-radius: 9px;
}

.row.ours {
  background: var(--nf-sunken);
}

.name {
  display: flex;
  overflow: hidden;
  align-items: baseline;
  gap: 7px;
  color: var(--nf-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 13.5px;
  white-space: nowrap;
}

.name small {
  color: var(--nf-faint);
  font-size: 11px;
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

.value {
  color: var(--nf-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.ours .name,
.ours .value {
  color: var(--nf-fg);
  font-weight: 600;
}

.ours .track {
  height: 12px;
}

.ours .bar {
  background: var(--nf-fg);
  box-shadow: 0 0 18px -2px color-mix(in srgb, var(--nf-fg) 35%, transparent);
}

.baseline .bar,
.swatch.striped {
  background: repeating-linear-gradient(
    -45deg,
    var(--nf-faint) 0 4px,
    transparent 4px 7px
  );
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 18px;
  padding: 11px 22px 13px;
  border-top: 1px solid var(--nf-line);
  color: var(--nf-faint);
  font-size: 12px;
}

.key {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.swatch {
  display: inline-block;
  width: 18px;
  height: 8px;
  border-radius: 999px;
  background: var(--nf-faint);
}

.median {
  margin-left: auto;
}

@media (prefers-reduced-motion: reduce) {
  .bar {
    transition: none;
  }
}

@media (max-width: 640px) {
  .head {
    padding: 14px 14px 12px;
  }

  .rows {
    padding: 6px 4px;
  }

  .row {
    grid-template-columns: 100px minmax(0, 1fr) 74px;
    gap: 8px;
    padding: 0 10px;
  }

  .name small {
    display: none;
  }

  .foot {
    padding: 10px 14px 12px;
  }

  .median {
    margin-left: 0;
  }
}
</style>
