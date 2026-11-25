import { exists, rm } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * The docs folder
 */
const DOCS = join(import.meta.dir, '../../..')

/**
 * Where the found location is written for the config
 */
const OUTPUT = join(DOCS, '.vitepress/source.json')

/**
 * The netify.js repository
 */
const REPOSITORY = 'https://github.com/netifyjs/netify'

/**
 * Where netify.js is cloned when there isn't a local copy
 */
const CLONE = join(DOCS, '.vitepress/cache/netify')

/**
 * Finds netify.js so code samples can be type checked against it
 * @class
 */
export class SourceLocator {
  /**
   * Uses NETIFY_DIR or a checkout next to the docs, otherwise clones it
   * @returns The netify.js folder
   */
  public static async locate(): Promise<string> {
    const local = process.env['NETIFY_DIR'] ?? join(DOCS, '../../netify.js')
    if (await exists(join(local, 'src/index.ts'))) return local

    await rm(CLONE, { recursive: true, force: true })
    await Bun.$`git clone --quiet --depth 1 ${REPOSITORY} ${CLONE}`.quiet()
    await Bun.$`bun install --frozen-lockfile --ignore-scripts`
      .cwd(CLONE)
      .quiet()
    return CLONE
  }

  /**
   * Writes where netify.js is
   */
  public static async run(): Promise<void> {
    const root = await SourceLocator.locate()

    await Bun.write(OUTPUT, `${JSON.stringify({ root }, null, 2)}\n`)
    console.log(`Using netify.js at ${root}`)
  }
}

await SourceLocator.run()
