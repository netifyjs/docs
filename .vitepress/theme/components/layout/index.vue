<script lang="ts" setup>
import { withBase } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

import Breadcrumb from '#theme/components/breadcrumb/index.vue'
import Progress from '#theme/components/progress/index.vue'

/**
 * The default layout
 */
const { Layout } = DefaultTheme
</script>

<template>
  <Layout>
    <template #nav-bar-content-after>
      <a class="start" :href="withBase('/guide/introduction')">Get started</a>
    </template>

    <template #doc-before>
      <Breadcrumb />
    </template>
    <template #aside-outline-before>
      <Progress />
    </template>
  </Layout>
</template>

<style scoped>
.start {
  display: inline-flex;
  height: 32px;
  align-items: center;
  margin-left: 16px;
  padding: 0 14px;
  border-radius: 7px;
  background: var(--nf-fg);
  color: var(--nf-surface);
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.15s;
}

.start:hover {
  opacity: 0.88;
}

@media (max-width: 767px) {
  .start {
    display: none;
  }
}
</style>
