<script lang="ts" setup>
import Benchmarks from '#theme/components/benchmarks/index.vue'
import Closing from '#theme/components/closing/index.vue'
import Hero from '#theme/components/hero/index.vue'
import Netty from '#theme/components/netty/index.vue'
import Protocols from '#theme/components/protocols/index.vue'
import Tools from '#theme/components/tools/index.vue'
import { data } from '#theme/results/index.data'
import Why from '#theme/components/why/index.vue'
</script>

<template>
  <div class="landing">
    <Hero />

    <div class="section">
      <Why />
    </div>
    <div class="section">
      <Protocols>
        <template #tcp><slot name="tcp" /></template>
        <template #udp><slot name="udp" /></template>
        <template #reliable><slot name="reliable" /></template>
        <template #websocket><slot name="websocket" /></template>
        <template #http><slot name="http" /></template>
      </Protocols>
    </div>
    <div class="section"><Tools /></div>
    <div class="section"><Netty /></div>
    <div v-if="Object.keys(data).length > 0" class="section">
      <Benchmarks />
    </div>
    <div class="section last"><Closing /></div>
  </div>
</template>

<style scoped>
.section {
  max-width: 1600px;
  margin: 0 auto;
  padding: 140px clamp(24px, 5vw, 72px) 0;
}

.section.last {
  padding-bottom: 140px;
}
</style>
