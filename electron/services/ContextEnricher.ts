const SECRET_PATTERN = /(?:token|key|password|secret|credential)\s*[:=]\s*\S+/gi

export class ContextEnricher {
  async enrich(rawDiff: string): Promise<string> {
    return rawDiff.replace(SECRET_PATTERN, '[REDACTED]')
  }
}
