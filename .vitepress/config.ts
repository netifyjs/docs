import { resolve } from 'node:path'

import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import ts from 'typescript'
import { defineConfig, type HeadConfig, type PageData } from 'vitepress'

import { NAV, SIDEBAR } from './navigation/index.ts'
import { THEME_DARK, THEME_LIGHT } from './shiki/index.ts'
import SOURCE from './source.json' with { type: 'json' }

/**
 * Where the docs are hosted
 */
const SITE = 'https://netifyjs.dev'

/**
 * The image shown when a page is shared
 */
const IMAGE = `${SITE}/og.png`

/**
 * What search engines read about the project on the home page
 */
const STRUCTURED = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'SoftwareSourceCode',
  name: 'Netify',
  description:
    'A Netty-inspired networking framework for Bun, for TCP, UDP, reliable UDP and WebSocket servers.',
  url: SITE,
  codeRepository: 'https://github.com/netifyjs/netify',
  programmingLanguage: 'TypeScript',
  runtimePlatform: 'Bun',
  license: 'https://opensource.org/licenses/MIT',
})

/**
 * The address of a page
 * @param page the page
 * @returns Its full URL
 */
const urlOf = (page: PageData): string => {
  const path = page.relativePath
    .replace(/(^|\/)index\.md$/, '$1')
    .replace(/\.md$/, '')

  return `${SITE}/${path}`
}

/**
 * Tags that differ on every page
 * @param page the page
 * @returns The head tags
 */
const headOf = (page: PageData): HeadConfig[] => {
  const url = urlOf(page)
  const title =
    page.relativePath === 'index.md'
      ? 'Netify | Netty-inspired networking for Bun'
      : `${page.title} | Netify`
  const description = page.description

  return [
    ['link', { rel: 'canonical', href: url }],
    ['meta', { property: 'og:url', content: url }],
    ['meta', { property: 'og:title', content: title }],
    ['meta', { property: 'og:description', content: description }],
    ['meta', { name: 'twitter:title', content: title }],
    ['meta', { name: 'twitter:description', content: description }],
    ...(page.relativePath === 'index.md'
      ? [['script', { type: 'application/ld+json' }, STRUCTURED] as HeadConfig]
      : []),
  ]
}

export default defineConfig({
  /**
   * The site title
   */
  title: 'Netify',
  /**
   * The page language
   */
  lang: 'en-GB',
  /**
   * The site description
   */
  description:
    'A Netty-inspired networking framework for Bun, for TCP, UDP, reliable UDP and WebSocket servers.',
  /**
   * Extra head tags
   */
  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['meta', { name: 'theme-color', content: '#000000' }],
    ['meta', { property: 'og:site_name', content: 'Netify' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:locale', content: 'en_GB' }],
    ['meta', { property: 'og:image', content: IMAGE }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    [
      'meta',
      {
        property: 'og:image:alt',
        content: "Netify. Netty's design at Bun's speed.",
      },
    ],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: IMAGE }],
  ],
  /**
   * Adds the tags that change from page to page
   * @param context the page being rendered
   * @returns Extra head tags
   */
  transformHead: (context: { pageData: PageData }): HeadConfig[] =>
    headOf(context.pageData),
  /**
   * The sitemap, written on build
   */
  sitemap: {
    /**
     * Where the site lives
     */
    hostname: SITE,
  },
  /**
   * The colour scheme
   */
  appearance: 'dark',
  /**
   * Whether links drop the .html
   */
  cleanUrls: true,
  /**
   * Whether pages show when they changed
   */
  lastUpdated: true,
  /**
   * The markdown settings
   */
  markdown: {
    /**
     * Black and white, keywords in bold
     */
    theme: { light: THEME_LIGHT, dark: THEME_DARK },
    /**
     * Type checks code blocks against the real source
     */
    codeTransformers: [
      transformerTwoslash({
        /**
         * The compiler settings
         */
        twoslashOptions: {
          /**
           * The TypeScript options
           */
          compilerOptions: {
            /**
             * The language target
             */
            target: ts.ScriptTarget.ESNext,
            /**
             * The module format
             */
            module: ts.ModuleKind.Preserve,
            /**
             * How modules resolve
             */
            moduleResolution: ts.ModuleResolutionKind.Bundler,
            /**
             * Whether to check strictly
             */
            strict: true,
            /**
             * Whether optional properties are exact
             */
            exactOptionalPropertyTypes: true,
            /**
             * Whether overrides need the keyword
             */
            noImplicitOverride: true,
            /**
             * Whether imports can end in .ts
             */
            allowImportingTsExtensions: true,
            /**
             * Whether to skip output
             */
            noEmit: true,
            /**
             * Whether to skip library checks
             */
            skipLibCheck: true,
            /**
             * The global types
             */
            types: ['bun'],
            /**
             * Where netify.js is
             */
            paths: {
              '@netifyjs/netify': [resolve(SOURCE.root, 'src/index.ts')],
            },
          },
        },
      }),
    ],
  },
  /**
   * The theme settings
   */
  themeConfig: {
    /**
     * The title beside the logo
     */
    siteTitle: 'Netify',
    /**
     * The links along the top
     */
    nav: NAV,
    /**
     * The links down the side
     */
    sidebar: SIDEBAR,
    /**
     * The social links
     */
    socialLinks: [
      { icon: 'github', link: 'https://github.com/netifyjs/netify' },
    ],
    /**
     * The link to edit a page
     */
    editLink: {
      /**
       * Where each page is edited
       */
      pattern: 'https://github.com/netifyjs/docs/edit/main/:path',
      /**
       * The link text
       */
      text: 'Edit this page on GitHub',
    },
    /**
     * The search box
     */
    search: { provider: 'local' },
    /**
     * The footer
     */
    footer: {
      message: 'Released under the MIT licence.',
    },
  },
})
