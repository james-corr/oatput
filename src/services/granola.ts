const GRANOLA_BASE_URL = 'https://public-api.granola.ai';
const FETCH_TIMEOUT_MS = 15_000;

export interface GranolaNote {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

interface GranolaNoteRaw {
  id?: unknown;
  title?: unknown;
  content?: unknown;
  transcript?: unknown;
  notes?: unknown;
  created_at?: unknown;
  [key: string]: unknown;
}

// Resolves text content from a raw note object.
// Granola's individual note endpoint returns: summary_markdown, summary_text, transcript (structured object).
// We prioritise the user-editable summary fields, then fall back to extracting transcript text.
function resolveNoteText(raw: GranolaNoteRaw): string {
  // User-editable notes — best source for action items
  for (const field of ['summary_markdown', 'summary_text']) {
    const val = raw[field];
    if (typeof val === 'string' && val.trim().length > 0) return val;
  }

  // Transcript may be a plain string or a structured array of segments
  const transcript = raw['transcript'];
  if (typeof transcript === 'string' && transcript.trim().length > 0) return transcript;
  if (Array.isArray(transcript)) {
    const text = transcript
      .map((seg: unknown) => {
        if (typeof seg === 'object' && seg !== null) {
          const s = seg as Record<string, unknown>;
          return typeof s.text === 'string' ? s.text : '';
        }
        return '';
      })
      .filter(Boolean)
      .join(' ');
    if (text.trim().length > 0) return text;
  }

  return '';
}

// Fetches the full content of a single note by ID.
// Returns empty string on any error so callers can proceed gracefully.
async function fetchNoteContent(apiKey: string, noteId: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${GRANOLA_BASE_URL}/v1/notes/${noteId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[granola] note ${noteId}: content fetch failed — ${res.status} ${res.statusText}`);
      return '';
    }

    const data = await res.json() as GranolaNoteRaw;
    const text = resolveNoteText(data);
    if (text.length > 50_000) {
      console.warn(`[granola] note ${noteId}: content is ${text.length} chars — large transcript`);
    }
    return text;
  } catch (err) {
    clearTimeout(timer);
    console.warn(`[granola] note ${noteId}: content fetch error — ${(err as Error).message}`);
    return '';
  }
}

// Fetches notes created after `createdAfter`, skipping IDs in `alreadyProcessedIds`,
// and fetches full content for each via a second API call.
// Throws on network error or non-2xx auth failure — caller must catch.
export async function fetchNewNotes(
  apiKey: string,
  createdAfter: Date,
  alreadyProcessedIds: Set<string>
): Promise<GranolaNote[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  const url = new URL(`${GRANOLA_BASE_URL}/v1/notes`);

  let raw: unknown;
  try {
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Granola API error: ${res.status} ${res.statusText}`);
    }

    raw = await res.json();
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }

  // The API may return { notes: [...] } or a top-level array
  let items: GranolaNoteRaw[];
  if (Array.isArray(raw)) {
    items = raw as GranolaNoteRaw[];
  } else if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).notes)) {
    items = (raw as Record<string, unknown>).notes as GranolaNoteRaw[];
  } else {
    console.warn('[granola] Unexpected response shape — no notes array found');
    return [];
  }

  // Filter to new notes only, then fetch full content for each
  const notes: GranolaNote[] = [];
  for (const item of items) {
    const id = typeof item.id === 'string' ? item.id : String(item.id ?? '');
    if (!id) continue;
    if (alreadyProcessedIds.has(id)) continue;

    // Client-side date filter: skip notes created before our watermark
    const noteDate = typeof item.created_at === 'string' ? new Date(item.created_at) : null;
    if (noteDate && noteDate <= createdAfter) continue;

    // List endpoint returns metadata only — fetch full content separately
    const content = await fetchNoteContent(apiKey, id);

    notes.push({
      id,
      title: typeof item.title === 'string' ? item.title : '(untitled)',
      content,
      created_at: typeof item.created_at === 'string' ? item.created_at : new Date().toISOString(),
    });
  }

  return notes;
}
