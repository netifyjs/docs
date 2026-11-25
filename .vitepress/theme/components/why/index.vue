<template>
  <section id="why" class="why">
    <div class="principle">
      <div class="intro">
        <p class="label">Why Netify</p>
        <h2 class="title">Less code between<br />the socket and your game</h2>
      </div>
      <div class="copy">
        <div class="point">
          <span class="index">01</span>
          <h3>The plumbing's done</h3>
          <p>
            Most network code is the same in every server. Split the byte stream
            into messages, encode the replies, keep track of connections, deal
            with clients that read too slowly. Netify gives you those parts, and
            your code only sees whole messages.
          </p>
        </div>
        <div class="point">
          <span class="index">02</span>
          <h3>One handler, any transport</h3>
          <p>
            Handlers are plain classes, and the same one runs over TCP, UDP or
            WebSocket. Moving a game from desktop to the browser doesn't mean
            rewriting the server. If you've used Netty, the names will be
            familiar.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.principle {
  display: flex;
  flex-direction: column;
  gap: 48px;
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

.copy {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

.point {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 30px 32px 32px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 18px;
}

.index {
  align-self: flex-start;
  padding: 1px 7px;
  border: 1px solid var(--nf-line-strong);
  border-radius: 6px;
  color: var(--nf-faint);
  font-family: var(--vp-font-family-mono);
  font-size: 11.5px;
}

.point h3 {
  margin: 6px 0 0;
  padding: 0;
  border: 0;
  color: var(--nf-fg);
  font-size: 22px;
  font-weight: 500;
  letter-spacing: -0.02em;
}

.copy p {
  max-width: 640px;
  margin: 0;
  color: var(--nf-muted);
  font-size: 17px;
  line-height: 1.65;
  text-wrap: pretty;
}

@media (max-width: 960px) {
  .copy {
    grid-template-columns: minmax(0, 1fr);
    gap: 22px;
  }
}
</style>
