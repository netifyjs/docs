import TwoslashFloatingVue from '@shikijs/vitepress-twoslash/client'
import { type Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'

import Chart from '#theme/components/chart/index.vue'
import Layout from '#theme/components/layout/index.vue'

import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@shikijs/vitepress-twoslash/style.css'
import '#theme/styles/index.css'

/**
 * The docs theme
 */
const theme: Theme = {
  extends: DefaultTheme,
  Layout,
  /**
   * Adds the type popups and the benchmark chart
   * @param context The app context
   */
  enhanceApp(context): void {
    context.app.use(TwoslashFloatingVue)
    context.app.component('BenchChart', Chart)
  },
}

export default theme
