<script lang="ts" setup>
import { withBase } from 'vitepress'
</script>

<template>
  <section class="closing">
    <code class="install"><span>$</span> bun add @netifyjs/netify</code>
    <h2>Write your first server</h2>
    <p>The guide starts with a TCP echo server and builds up from there.</p>
    <div class="actions">
      <a class="button primary" :href="withBase('/guide/first-server')">
        Start the guide
      </a>
      <a class="button" href="https://github.com/netifyjs/netify">GitHub</a>
    </div>
  </section>
</template>

<style scoped>
.closing {
  position: relative;
  display: flex;
  overflow: hidden;
  flex-direction: column;
  align-items: center;
  padding: 88px 24px 92px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 24px;
  text-align: center;
}

.closing > * {
  position: relative;
  z-index: 1;
}

.install {
  margin-bottom: 22px;
  padding: 5px 12px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 999px;
  background: var(--nf-surface);
  color: var(--nf-fg-soft);
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
}

.install span {
  color: var(--nf-faint);
}

h2 {
  margin: 0;
  color: var(--nf-fg);
  font-size: clamp(30px, 4vw, 46px);
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -0.035em;
}

h2 span {
  color: var(--nf-faint);
}

p {
  margin: 16px 0 0;
  color: var(--nf-muted);
  font-size: 15px;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 26px;
}

.button {
  display: inline-flex;
  align-items: center;
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
</style>
