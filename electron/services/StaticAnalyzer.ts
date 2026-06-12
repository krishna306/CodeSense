import type { Suggestion } from '../../shared/types'

export class StaticAnalyzer {
  async analyze(_diff: string): Promise<Suggestion[]> {
    // TODO: integrate ESLint and Semgrep via child_process
    return []
  }
}
