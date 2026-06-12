import Anthropic from '@anthropic-ai/sdk'
import type { Suggestion } from '../../shared/types'
import { REVIEW_SYSTEM_PROMPT } from './reviewPrompt'

export class AnthropicService {
  private client: Anthropic
  private model: string

  constructor(apiKey: string, model = 'claude-sonnet-4-6') {
    this.client = new Anthropic({ apiKey })
    this.model = model
  }

  async review(
    diff: string,
    onSuggestion: (s: Suggestion) => void
  ): Promise<{ suggestions: Suggestion[]; raw: string }> {
    const suggestions: Suggestion[] = []
    let buffer = ''
    let raw = ''

    const stream = await this.client.messages.create({
      model: this.model,
      max_tokens: 30000,
      system: [
        {
          type: 'text',
          text: REVIEW_SYSTEM_PROMPT,
          // @ts-expect-error cache_control is valid in the API but not yet in the type defs
          cache_control: { type: 'ephemeral' }
        }
      ],
      messages: [{ role: 'user', content: `Review this diff:\n\n${diff}` }],
      stream: true
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta'
      ) {
        buffer += event.delta.text
        raw += event.delta.text
        const parsed = tryParsePartial(buffer)
        for (const s of parsed.complete) {
          const suggestion: Suggestion = { ...s, id: crypto.randomUUID(), source: 'ai', score: 0 }
          suggestions.push(suggestion)
          onSuggestion(suggestion)
        }
        buffer = parsed.remainder
      }
    }

    return { suggestions, raw }
  }
}

/* Stream-safe extraction of complete top-level {...} objects.
   String- and escape-aware so braces inside "body" code samples don't break it. */
function tryParsePartial(
  text: string
): { complete: Omit<Suggestion, 'id' | 'source' | 'score'>[]; remainder: string } {
  const complete: Omit<Suggestion, 'id' | 'source' | 'score'>[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false
  let lastEnd = 0

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]

    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }

    if (ch === '"') { inString = true; continue }
    if (ch === '{') {
      if (depth === 0) start = i
      depth++
    } else if (ch === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        try {
          const obj = JSON.parse(text.slice(start, i + 1))
          if (obj.filePath && obj.line && obj.severity && obj.title && obj.body) {
            complete.push(obj)
            lastEnd = i + 1
          }
        } catch {
          // invalid fragment — ignore
        }
        start = -1
      }
    }
  }

  return { complete, remainder: lastEnd > 0 ? text.slice(lastEnd) : text }
}
