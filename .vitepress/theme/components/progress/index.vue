<script lang="ts" setup>
import { ArrowUp } from 'lucide-vue-next'
import { useRoute } from 'vitepress'
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * A heading in the page
 */
type Heading = {
  /**
   * Its anchor
   */
  readonly id: string

  /**
   * What it says
   */
  readonly text: string

  /**
   * 2 or 3
   */
  readonly level: number
}

/**
 * A point on the rail
 */
type Point = {
  /**
   * Across in the drawing
   */
  readonly x: number

  /**
   * Down in the drawing
   */
  readonly y: number
}

/**
 * How far in nested headings sit
 */
const INDENT = 12

/**
 * Where the rail sits from the left edge
 */
const RAIL = 4

/**
 * Space the nav takes at the top of the window
 */
const TOP = 112

/**
 * Reading speed in words a minute
 */
const SPEED = 230

/**
 * Headings on this page
 */
const headings = ref<Heading[]>([])

/**
 * The heading being read
 */
const active = ref<number>(0)

/**
 * Minutes left at the reading speed
 */
const minutes = ref<number>(0)

/**
 * The rail as an SVG path
 */
const rail = ref<string>('')

/**
 * Total length of the rail
 */
const total = ref<number>(0)

/**
 * How much of the rail is filled
 */
const filled = ref<number>(0)

/**
 * Where the marker sits
 */
const marker = ref<Point>({ x: RAIL, y: 0 })

/**
 * Height of the drawing
 */
const height = ref<number>(0)

/**
 * The list of headings
 */
const list = ref<HTMLOListElement | null>(null)

/**
 * The corners of the rail, in order
 */
let corners: Point[] = []

/**
 * Rail length at each heading's dot
 */
let stops: number[] = []

/**
 * The heading elements in the page
 */
let targets: HTMLElement[] = []

/**
 * Words in the page
 */
let words = 0

/**
 * The pending animation frame, or 0
 */
let frame = 0

/**
 * The current route
 */
const route = useRoute()

/**
 * A heading's text without its anchor link
 * @param element the heading
 * @returns The text
 */
const textOf = (element: HTMLElement): string =>
  Array.from(element.childNodes)
    .filter(
      (node: ChildNode): boolean =>
        !(
          node instanceof HTMLElement &&
          node.classList.contains('header-anchor')
        ),
    )
    .map((node: ChildNode): string => node.textContent ?? '')
    .join('')
    .trim()

/**
 * Finds the headings and words on the page
 */
const collect = (): void => {
  targets = Array.from(
    document.querySelectorAll<HTMLElement>('.vp-doc h2[id], .vp-doc h3[id]'),
  )
  headings.value = targets.map(
    (element: HTMLElement): Heading => ({
      id: element.id,
      text: textOf(element),
      level: element.tagName === 'H3' ? 3 : 2,
    }),
  )
  words = (document.querySelector('.vp-doc')?.textContent ?? '')
    .split(/\s+/)
    .filter((word: string): boolean => word.length > 0).length
}

/**
 * Builds the rail from where each item landed in the list
 */
const draw = (): void => {
  const element = list.value
  if (element === null) return
  const items = Array.from(element.children) as HTMLElement[]
  if (items.length === 0) return

  const points: Point[] = []
  const at: number[] = []
  let length = 0
  let last: Point | null = null
  const add = (point: Point): void => {
    if (last !== null) length += Math.hypot(point.x - last.x, point.y - last.y)
    points.push(point)
    last = point
  }

  items.forEach((item: HTMLElement, index: number): void => {
    const x = RAIL + (headings.value[index]?.level === 3 ? INDENT : 0)
    const y = item.offsetTop + item.offsetHeight / 2
    if (last === null) {
      add({ x, y: item.offsetTop + 2 })
    } else if (last.x !== x) {
      add({ x: last.x, y: item.offsetTop - 6 })
      add({ x, y: item.offsetTop + 4 })
    }

    add({ x, y })
    at.push(length)
  })
  const end = items[items.length - 1]
  if (last !== null && end !== undefined) {
    add({ x: (last as Point).x, y: end.offsetTop + end.offsetHeight - 2 })
  }

  corners = points
  stops = at
  total.value = length
  height.value = element.offsetHeight
  rail.value = points
    .map(
      (point: Point, index: number): string =>
        `${index === 0 ? 'M' : 'L'}${String(point.x)} ${String(point.y)}`,
    )
    .join(' ')
}

/**
 * The point a given distance along the rail
 * @param distance how far along
 * @returns The point
 */
const pointAt = (distance: number): Point => {
  let travelled = 0
  for (let index = 1; index < corners.length; index++) {
    const from = corners[index - 1]
    const to = corners[index]
    if (from === undefined || to === undefined) continue
    const span = Math.hypot(to.x - from.x, to.y - from.y)
    if (travelled + span >= distance) {
      const share = span === 0 ? 0 : (distance - travelled) / span
      return {
        x: from.x + (to.x - from.x) * share,
        y: from.y + (to.y - from.y) * share,
      }
    }

    travelled += span
  }

  return corners[corners.length - 1] ?? { x: RAIL, y: 0 }
}

/**
 * Works out where the reader is and moves the fill and marker there
 */
const update = (): void => {
  frame = 0
  if (targets.length === 0) return

  const line = window.scrollY + TOP
  const tops = targets.map(
    (element: HTMLElement): number =>
      element.getBoundingClientRect().top + window.scrollY,
  )
  let index = 0
  for (let at = 0; at < tops.length; at++) {
    if ((tops[at] ?? 0) <= line) index = at
  }

  const start = tops[index] ?? 0
  const next = tops[index + 1] ?? document.documentElement.scrollHeight
  const share =
    line < start ? 0 : Math.min(1, Math.max(0, (line - start) / (next - start)))
  const from = stops[index] ?? 0
  const to = stops[index + 1] ?? total.value

  active.value = index
  filled.value = from + (to - from) * share
  marker.value = pointAt(filled.value)

  const room = document.documentElement.scrollHeight - window.innerHeight
  const read = room <= 0 ? 1 : Math.min(1, window.scrollY / room)
  minutes.value = Math.max(0, Math.ceil((words * (1 - read)) / SPEED))
}

/**
 * Asks for an update on the next frame
 */
const schedule = (): void => {
  if (frame === 0) frame = requestAnimationFrame(update)
}

/**
 * Rebuilds everything for the current page
 */
const setup = async (): Promise<void> => {
  collect()
  await nextTick()
  draw()
  update()
}

/**
 * Redraws after the layout changes
 */
const resize = (): void => {
  draw()
  schedule()
}

/**
 * Scrolls back to the top
 */
const top = (): void => {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  void setup()
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', resize)
  if (frame !== 0) cancelAnimationFrame(frame)
})

watch(
  () => route.path,
  () => {
    void setup()
  },
)
</script>

<template>
  <nav v-if="headings.length > 1" class="toc" aria-label="On this page">
    <header class="head">
      <span>On this page</span>
      <span class="left">{{ minutes }} min left</span>
    </header>

    <div class="body">
      <svg
        class="drawing"
        :width="RAIL + INDENT + 6"
        :height="height"
        aria-hidden="true"
      >
        <path class="rail" :d="rail" />
        <path
          class="fill"
          :d="rail"
          :stroke-dasharray="`${String(filled)} ${String(total + 1)}`"
        />
        <circle class="marker" :cx="marker.x" :cy="marker.y" r="3.5" />
      </svg>

      <ol ref="list" class="items">
        <li
          v-for="(heading, index) in headings"
          :key="heading.id"
          :class="{
            nested: heading.level === 3,
            active: index === active,
            passed: index < active,
          }"
        >
          <a :href="`#${heading.id}`">{{ heading.text }}</a>
        </li>
      </ol>
    </div>

    <footer class="foot">
      <p class="reading">
        Reading <strong>{{ headings[active]?.text }}</strong>
      </p>
      <button type="button" class="top" @click="top">
        Back to top <ArrowUp :size="13" />
      </button>
    </footer>
  </nav>
</template>

<style scoped>
.toc {
  padding-top: 4px;
  font-size: 13px;
}

.head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
  color: var(--nf-fg);
  font-weight: 500;
}

.left {
  color: var(--nf-faint);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

.body {
  position: relative;
}

.drawing {
  position: absolute;
  top: 0;
  left: 0;
  overflow: visible;
}

.rail,
.fill {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rail {
  stroke: var(--nf-line-strong);
  stroke-width: 1.5;
}

.fill {
  stroke: var(--nf-fg);
  stroke-width: 1.5;
  transition: stroke-dasharray 0.15s linear;
}

.marker {
  fill: var(--nf-fg);
  stroke: var(--nf-surface);
  stroke-width: 2;
  transition:
    cx 0.15s linear,
    cy 0.15s linear;
}

.items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.items li {
  padding: 3px 0 3px 20px;
}

.items li.nested {
  padding-left: 32px;
}

.items a {
  display: block;
  color: var(--nf-muted);
  line-height: 1.45;
  text-decoration: none;
  transition: color 0.15s;
}

.items a:hover {
  color: var(--nf-fg);
}

.items li.passed a {
  color: var(--nf-fg-soft);
}

.items li.active a {
  color: var(--nf-fg);
  font-weight: 500;
}

.foot {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--nf-line);
}

.reading {
  margin: 0;
  overflow: hidden;
  color: var(--nf-faint);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reading strong {
  color: var(--nf-fg-soft);
  font-weight: 500;
}

.top {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  align-self: flex-start;
  color: var(--nf-muted);
  font-size: 13px;
  transition: color 0.15s;
}

.top:hover {
  color: var(--nf-fg);
}

@media (prefers-reduced-motion: reduce) {
  .fill,
  .marker {
    transition: none;
  }
}
</style>
