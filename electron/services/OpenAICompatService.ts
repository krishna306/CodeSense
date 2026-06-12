import type { Suggestion } from '../../shared/types'
import { randomUUID } from 'crypto'
import { REVIEW_SYSTEM_PROMPT } from './reviewPrompt'

const BASE_URLS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  xai: 'https://api.x.ai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai'
}

/* Per-provider output-token ceilings (capped at each provider's max) */
const MAX_TOKENS: Record<string, number> = {
  openai: 16384,   // GPT-4o hard limit
  xai: 30000,
  gemini: 30000
}

export class OpenAICompatService {
  private apiKey: string
  private model: string
  private baseUrl: string
  private maxTokens: number

  constructor(provider: 'openai' | 'xai' | 'gemini', apiKey: string, model: string) {
    this.apiKey = apiKey
    this.model = model
    this.baseUrl = BASE_URLS[provider]
    this.maxTokens = MAX_TOKENS[provider] ?? 16384
  }

  async review(
    diff: string,
    onSuggestion: (s: Suggestion) => void
  ): Promise<{ suggestions: Suggestion[]; raw: string }> {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: [
          { role: 'system', content: REVIEW_SYSTEM_PROMPT },
          { role: 'user', content: `Review this diff:\n\n${diff}` }
        ]
      })
    })

    if (!res.ok) {
      throw new Error(`AI provider error ${res.status}: ${await res.text()}`)
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[]
    }

    const text = data.choices[0]?.message?.content ?? '[]'
    const suggestions = parseSuggestions(text)
    suggestions.forEach(onSuggestion)
    return { suggestions, raw: text }
  }
}

function parseSuggestions(text: string): Suggestion[] {
  // strip markdown fences if the model added them despite instructions
  const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim()

  let raw: unknown
  try {
    raw = JSON.parse(cleaned)
  } catch {
    // Salvage mode: extract every COMPLETE top-level object, even from a
    // truncated response. Tracks brace depth and respects JSON strings/escapes,
    // so braces inside body code examples don't break extraction.
    raw = salvageObjects(cleaned)
    if ((raw as unknown[]).length > 0) {
      console.warn(
        `[OpenAICompatService] response was malformed/truncated — salvaged ${(raw as unknown[]).length} complete object(s)`
      )
    } else {
      console.error('[OpenAICompatService] unparseable response:', text.slice(0, 400))
    }
  }
  if (!Array.isArray(raw)) return []

  return raw
    .filter(
      (o): o is Record<string, unknown> =>
        !!o && typeof o === 'object' &&
        'filePath' in o && 'line' in o && 'severity' in o && 'title' in o && 'body' in o
    )
    .map((o) => ({
      id: randomUUID(),
      filePath: String(o.filePath),
      line: Number(o.line),
      severity: o.severity as Suggestion['severity'],
      title: String(o.title),
      body: String(o.body),
      source: 'ai' as const,
      score: 0
    }))
}

/* Extract complete top-level {...} objects from possibly-truncated JSON text.
   String- and escape-aware so braces inside "body" code samples are handled. */
function salvageObjects(text: string): unknown[] {
  const objects: unknown[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false

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
          objects.push(JSON.parse(text.slice(start, i + 1)))
        } catch {
          // incomplete or invalid object — skip it
        }
        start = -1
      }
    }
  }
  return objects
}
