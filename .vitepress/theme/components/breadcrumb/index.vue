<script lang="ts" setup>
import { ChevronRight } from 'lucide-vue-next'
import { type DefaultTheme, useData, withBase } from 'vitepress'
import { computed } from 'vue'

/**
 * One step in the trail
 */
type Crumb = {
  /**
   * What it says
   */
  readonly text: string

  /**
   * Where it goes, or null for the current page
   */
  readonly link: string | null
}

/**
 * The page and theme data
 */
const data = useData<DefaultTheme.Config>()

/**
 * The group and page the reader is on
 */
const crumbs = computed<readonly Crumb[]>(() => {
  const path = `/${data.page.value.relativePath.replace(/\.md$/, '')}`
  const sidebar = data.theme.value.sidebar
  const groups = Array.isArray(sidebar) ? sidebar : []

  for (const group of groups) {
    const items = group.items ?? []
    const page = items.find((item) => item.link === path)
    if (page === undefined) continue
    return [
      { text: group.text ?? '', link: items[0]?.link ?? null },
      { text: page.text ?? '', link: null },
    ]
  }

  return []
})
</script>

<template>
  <nav v-if="crumbs.length > 0" class="breadcrumb" aria-label="Breadcrumb">
    <template v-for="(crumb, index) in crumbs" :key="crumb.text">
      <ChevronRight v-if="index > 0" :size="14" class="chevron" />
      <a v-if="crumb.link" class="crumb" :href="withBase(crumb.link)">
        {{ crumb.text }}
      </a>
      <span v-else class="crumb current" aria-current="page">
        {{ crumb.text }}
      </span>
    </template>
  </nav>
</template>

<style scoped>
.breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 18px;
  font-size: 14px;
}

.crumb {
  color: var(--nf-muted);
  text-decoration: none;
  transition: color 0.15s;
}

.crumb:hover {
  color: var(--nf-fg);
}

.current {
  color: var(--nf-fg);
  font-weight: 500;
}

.chevron {
  color: var(--nf-faint);
}
</style>
