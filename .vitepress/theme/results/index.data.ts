import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { defineLoader } from 'vitepress'

import SNAPSHOT from './snapshot.json' with { type: 'json' }

/**
 * The results file in a benchmarks checkout next to the docs
 */
const LOCAL = fileURLToPath(
  new URL('../../../../benchmarks/frameworks/results.json', import.meta.url),
)

/**
 * The results file on GitHub
 */
const REMOTE =
  'https://raw.githubusercontent.com/netifyjs/benchmarks/HEAD/frameworks/results.json'

/**
 * One framework's measured figure
 */
export type Measurement = {
  /**
   * Framework name
   */
  readonly name: string

  /**
   * Runtime it ran on
   */
  readonly runtime: string

  /**
   * Messages or deliveries a second
   */
  readonly value: number
}

/**
 * Results for one transport
 */
export type Group = {
  /**
   * Pipelined echo
   */
  readonly echo: readonly Measurement[]

  /**
   * Room broadcast, WebSocket only
   */
  readonly broadcast: readonly Measurement[]
}

/**
 * Every transport from the framework suite
 */
export type Results = {
  /**
   * Length framed TCP
   */
  readonly tcp?: Group

  /**
   * Plain UDP datagrams
   */
  readonly udp?: Group

  /**
   * WebSocket
   */
  readonly websocket?: Group

  /**
   * HTTP plaintext
   */
  readonly http?: Group

  /**
   * Length framed TCP on several cores
   */
  readonly tcpcores?: Group

  /**
   * Datagram echo on several cores
   */
  readonly udpcores?: Group

  /**
   * HTTP plaintext on several cores
   */
  readonly httpcores?: Group

  /**
   * WebSocket echo on several cores
   */
  readonly websocketcores?: Group
}

/**
 * The type of the loaded data
 */
declare const data: Results
export { data }

/**
 * Finds the latest benchmark results
 * @class
 */
export class ResultsReader {
  /**
   * Reads BENCHMARKS_DIR or a checkout next to the docs, then GitHub, then the snapshot
   */
  public static async read(): Promise<Results> {
    const path = process.env['BENCHMARKS_DIR']
      ? `${process.env['BENCHMARKS_DIR']}/frameworks/results.json`
      : LOCAL

    try {
      return JSON.parse(await readFile(path, 'utf8')) as Results
    } catch {
      return ResultsReader.fetch()
    }
  }

  /**
   * Downloads the results, or falls back to the snapshot
   */
  private static async fetch(): Promise<Results> {
    try {
      const response = await fetch(REMOTE)
      if (!response.ok) return SNAPSHOT as Results

      return (await response.json()) as Results
    } catch {
      return SNAPSHOT as Results
    }
  }
}

/**
 * Loads the results when the site builds
 */
export default defineLoader({
  /**
   * Reads them, or returns nothing when there are none
   */
  async load(): Promise<Results> {
    return ResultsReader.read()
  },
})
