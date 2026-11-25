/**
 * Names for the runtimes a benchmark server ran on
 * @class
 */
export class RuntimeLabel {
  /**
   * How each runtime is written on the page
   */
  private static readonly names: Readonly<Record<string, string>> = {
    bun: 'Bun',
    node: 'Node',
    java: 'Java',
  }

  /**
   * Display name, or the raw id if it's new
   * @param runtime id from the results file
   */
  public static of(runtime: string): string {
    return RuntimeLabel.names[runtime] ?? runtime
  }
}
