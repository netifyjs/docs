<script lang="ts" setup>
import { Check, Copy } from 'lucide-vue-next'
import { withBase } from 'vitepress'
import { ref } from 'vue'

import Dither from '#theme/components/dither/index.vue'

/**
 * The install command
 */
const COMMAND = 'bun add @netifyjs/netify'

/**
 * Whether the command was just copied
 */
const copied = ref<boolean>(false)

/**
 * Copies the install command
 */
const copy = async (): Promise<void> => {
  await navigator.clipboard.writeText(COMMAND)

  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1500)
}
</script>

<template>
  <section class="hero">
    <div class="art" aria-hidden="true">
      <Dither />
    </div>

    <div class="copy">
      <span class="release">alpha · fast already, not done yet</span>
      <h1 class="title">
        Netty's design<br class="break" />
        at Bun's speed
      </h1>
      <p class="lead">
        Channels, pipelines and codecs for TCP, UDP and WebSocket, built for
        game servers.
      </p>
      <div class="actions">
        <a class="button primary" :href="withBase('/guide/introduction')">
          Get started
        </a>
        <button type="button" class="button command" @click="copy">
          <span class="prompt">$</span> {{ COMMAND }}
          <Check v-if="copied" :size="14" />
          <Copy v-else :size="14" />
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  overflow: hidden;
  display: flex;
  min-height: calc(100svh - var(--vp-nav-height));
  flex-direction: column;
  justify-content: center;
  padding: 0 0 6vh;
}

.art {
  position: absolute;
  overflow: hidden;
  inset: 0;
  mask-image: linear-gradient(to bottom, transparent 0, black 6%);
}

.copy {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  max-width: 1600px;
  flex-direction: column;
  align-items: flex-start;
  margin: 0 auto;
  padding: 0 clamp(24px, 5vw, 72px);
  text-align: left;
}

.release {
  display: inline-flex;
  height: 26px;
  align-items: center;
  margin-bottom: 22px;
  padding: 0 11px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 999px;
  background: var(--nf-surface);
  color: var(--nf-muted);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  letter-spacing: 0.02em;
}

.title {
  margin: 0;
  color: var(--nf-fg);
  font-size: clamp(44px, 7vw, 96px);
  font-weight: 600;
  line-height: 1.02;
  letter-spacing: -0.045em;
}

@media (max-width: 640px) {
  .break {
    display: none;
  }
}

.lead {
  max-width: 560px;
  margin: 22px 0 0;
  color: var(--nf-muted);
  font-size: 17px;
  line-height: 1.6;
  text-wrap: pretty;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 10px;
  margin-top: 30px;
}

.button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 6px;
  color: var(--nf-fg);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  transition:
    border-color 0.15s,
    opacity 0.15s;
}

.button:hover {
  border-color: var(--nf-faint);
}

.button.primary {
  border-color: var(--nf-fg);
  background: var(--nf-fg);
  color: var(--nf-surface);
}

.button.primary:hover {
  opacity: 0.88;
}

.command {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 400;
}

.prompt {
  color: var(--nf-faint);
}
</style>
