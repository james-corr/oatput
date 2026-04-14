import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// Regex patterns for Pass 1 scan
const ACTION_PATTERNS: RegExp[] = [
  /^action\s*:/im,
  /^todo\s*:/im,
  /^follow[\s-]?up\b/im,
  /^\s*[-*•]\s+(send|schedule|review|create|update|book|prepare|write|share|confirm|check|follow|reach|set up|organize|draft|assign|complete|finalize|submit|arrange)\b/im,
  /^\s*\[[ x]\]\s+.+/im,     // checkbox: [ ] or [x]
  /^\s*\d+\.\s+(send|schedule|review|create|update|book|prepare|write|share|confirm|check|follow|reach|set up|organize|draft|assign|complete|finalize|submit|arrange)\b/im,
];

// Pass 1: fast regex scan. Returns candidate lines from the note text.
export function regexScanForActionItems(text: string): string[] {
  const candidates = new Set<string>();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const pattern of ACTION_PATTERNS) {
      if (pattern.test(trimmed)) {
        candidates.add(trimmed);
        break;
      }
    }
  }

  return Array.from(candidates);
}

const SYSTEM_PROMPT = `You are an expert at extracting action items from meeting notes and transcripts.

Given meeting text and a list of regex-detected candidates, return ONLY a JSON array of strings — each string is a clean, actionable task. Do not include markdown, explanations, or any text outside the JSON array.

Rules:
- Include items from the candidates list that are genuine action items
- Also include action items you find in the full text that the regex missed
- Deduplicate — do not include the same item twice
- Clean up the text: remove bullet markers, checkbox brackets, "Action:", "TODO:" prefixes
- If there are no action items, return an empty array: []
- Return valid JSON only`;

// Pass 2: Claude extraction. Falls back to regexCandidates on any error.
export async function llmExtractActionItems(
  noteText: string,
  regexCandidates: string[]
): Promise<string[]> {
  const userContent = `Meeting notes:
---
${noteText}
---

Regex-detected candidates:
${regexCandidates.length > 0 ? regexCandidates.map((c) => `- ${c}`).join('\n') : '(none)'}

Return a JSON array of all action items.`;

  try {
    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content.find((b) => b.type === 'text')?.text ?? '';
    // Strip any markdown code fences if the model adds them
    const json = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const parsed = JSON.parse(json);

    if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string')) {
      return parsed;
    }

    console.warn('[extractor] LLM returned unexpected shape — falling back to regex candidates');
    return regexCandidates;
  } catch (err) {
    console.error('[extractor] LLM extraction failed:', (err as Error).message);
    return regexCandidates;
  }
}

// Main entry point: runs both passes and returns final deduplicated list.
export async function extractActionItems(noteText: string): Promise<string[]> {
  if (!noteText.trim()) return [];

  const regexCandidates = regexScanForActionItems(noteText);
  return llmExtractActionItems(noteText, regexCandidates);
}
