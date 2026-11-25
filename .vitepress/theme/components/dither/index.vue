<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'

/**
 * Pixel size in CSS pixels
 */
const CELL = 4

/**
 * Seconds the motion takes to ease in
 */
const EASE_IN = 4

/**
 * Draws a full screen triangle
 */
const VERTEX = `
attribute vec2 position;
void main() { gl_Position = vec4(position, 0.0, 1.0); }
`

/**
 * One fragment per cell: a tilted ring of streaming dots with a bright rim, dithered into four tones
 */
const FRAGMENT = `
precision highp float;
uniform vec2 size;
uniform float time;
uniform float dark;

const vec2 centre = vec2(0.98, 0.2);
const vec2 axis = vec2(0.98, -0.198);
const vec2 radii = vec2(0.91, 0.11);
const float spin = 0.35;
const float sheet = 1.1;
const float falloff = 0.7;

float bayer2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a) { return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a) { return bayer4(0.5 * a) * 0.25 + bayer2(a); }

float hash(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 uv = (cell + 0.5) / size;
  float aspect = size.x / size.y;
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

  vec2 q = p - vec2(centre.x * aspect / 1.78, centre.y);
  q = vec2(dot(q, axis), dot(q, vec2(-axis.y, axis.x)));
  vec2 r = q / radii;
  float e = length(r);
  float angle = atan(r.y, r.x);

  float streak = noise(vec2(angle * 60.0 - time * spin * 6.0, e * 18.0));
  float grain = hash(cell + floor(time * 3.0) * 0.01);
  float front = smoothstep(0.5, -3.0, r.y);
  float outside = step(1.0, e) * exp(-(e - 1.0) * falloff);
  float dots = outside * front * sheet * (0.35 + 0.9 * streak) * (0.55 + 0.6 * grain);

  float rim = exp(-pow((e - 1.0) / 0.035, 2.0));
  float inner = 0.45 * exp(-pow((e - 0.86) / 0.025, 2.0));

  float star = step(0.9975, hash(cell * 1.37)) * (0.35 + 0.45 * sin(time * 1.7 + hash(cell) * 40.0));

  vec2 text = (uv - vec2(0.26, 0.5)) / vec2(0.5, 0.34);
  float clear = mix(0.3, 1.0, smoothstep(0.55, 1.25, length(text)));

  float shape = clamp((dots + rim + inner) * clear + star, 0.0, 1.0);
  float level = clamp(floor(shape * 4.0 + bayer8(cell)), 0.0, 4.0);

  float alpha = level < 0.5 ? 0.0 : level < 1.5 ? 0.12 : level < 2.5 ? 0.34 : level < 3.5 ? 0.66 : 1.0;
  gl_FragColor = vec4(vec3(dark) * alpha, alpha);
}
`

/**
 * The canvas, one pixel per cell
 */
const canvas = ref<HTMLCanvasElement | null>(null)

/**
 * Stops everything on unmount
 */
let stop: (() => void) | null = null

/**
 * Compiles one shader stage, or null if it fails
 * @param gl the context
 * @param type vertex or fragment
 * @param source the GLSL
 * @returns The shader, or null
 */
const compile = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null => {
  const shader = gl.createShader(type)
  if (shader === null) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS) === true) return shader

  gl.deleteShader(shader)
  return null
}

/**
 * Sets up WebGL and runs the animation, returning a function that stops it
 * @param element the canvas
 * @returns The stop function, or null without WebGL
 */
const start = (element: HTMLCanvasElement): (() => void) | null => {
  const gl = element.getContext('webgl', {
    /**
     * Pixels stay hard edged
     */
    antialias: false,
    /**
     * The fragment shader writes premultiplied colour
     */
    premultipliedAlpha: true,
  })
  if (gl === null) return null

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  if (vertex === null || fragment === null) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (gl.getProgramParameter(program, gl.LINK_STATUS) !== true) return null
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  )
  const position = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

  const size = gl.getUniformLocation(program, 'size')
  const time = gl.getUniformLocation(program, 'time')
  const dark = gl.getUniformLocation(program, 'dark')
  const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let elapsed = 0
  let previous: number | null = null
  let began: number | null = null
  let frame = 0
  let visible = true

  const resize = (): void => {
    const parent = element.parentElement
    const width = Math.max(1, parent?.clientWidth ?? 1)
    const height = Math.max(1, parent?.clientHeight ?? 1)
    const cols = Math.ceil(width / CELL)
    const rows = Math.ceil(height / CELL)
    element.width = cols
    element.height = rows
    element.style.width = `${String(cols * CELL)}px`
    element.style.height = `${String(rows * CELL)}px`
    gl.viewport(0, 0, cols, rows)
    gl.uniform2f(size, cols, rows)
  }

  const render = (): void => {
    gl.uniform1f(time, elapsed)
    gl.uniform1f(
      dark,
      document.documentElement.classList.contains('dark') ? 1 : 0,
    )
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  const tick = (now: number): void => {
    began ??= now
    const ease = Math.min(1, (now - began) / (EASE_IN * 1000))
    const step = previous === null ? 0 : Math.min(now - previous, 100)
    elapsed += (step / 1000) * ease * ease * (3 - 2 * ease)
    previous = now
    render()
    frame = requestAnimationFrame(tick)
  }

  const play = (): void => {
    cancelAnimationFrame(frame)
    previous = null
    if (still || !visible) {
      render()
      return
    }

    frame = requestAnimationFrame(tick)
  }

  const resizes = new ResizeObserver((): void => {
    resize()
    render()
  })
  if (element.parentElement !== null) resizes.observe(element.parentElement)
  const views = new IntersectionObserver(([entry]): void => {
    visible = entry?.isIntersecting ?? true
    play()
  })
  views.observe(element)
  const themes = new MutationObserver(render)
  themes.observe(document.documentElement, {
    /**
     * The dark class lives here
     */
    attributeFilter: ['class'],
  })

  resize()
  play()
  return (): void => {
    cancelAnimationFrame(frame)
    resizes.disconnect()
    views.disconnect()
    themes.disconnect()
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}

onMounted(() => {
  if (canvas.value !== null) stop = start(canvas.value)
})

onBeforeUnmount(() => {
  stop?.()
})
</script>

<template>
  <canvas ref="canvas" class="dither" aria-hidden="true" />
</template>

<style scoped>
.dither {
  position: absolute;
  bottom: 0;
  left: 0;
  image-rendering: pixelated;
}
</style>
