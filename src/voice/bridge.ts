/**
 * JARVIS Voice Bridge — Phase 1
 *
 * The durable core of the voice system. Contains NO voice dependencies.
 *
 * Job: expose `ask_jarvis(query)` as a STREAMING call over the Claude Code CLI,
 * so a voice shell can begin speaking before generation completes.
 *
 * Design principle (see agent-sdk/VOICE-MASTER-PLAN.md):
 *   The voice model is the ears and mouth. THIS is the path to the brain.
 *   JARVIS itself is unmodified — full context system, memory, skills, tools.
 *
 * Why not reuse JarvisCLIClient.ask()? It blocks on `.text()`, so nothing is
 * available until the entire response is generated. For voice that is the
 * difference between "conversation" and "voice-activated batch job."
 */

import { randomUUID } from 'crypto';

export interface StreamChunk {
  type: 'text' | 'session' | 'done' | 'error';
  text?: string;
  sessionId?: string;
  /** ms from spawn to this chunk */
  elapsedMs?: number;
}

export interface AskOptions {
  model?: 'sonnet' | 'opus' | 'haiku';
  /** Resume an existing conversation for multi-turn continuity. */
  sessionId?: string;
  /** Ask JARVIS to keep it short — the default for spoken replies. */
  brief?: boolean;
  /** Abort in-flight generation (barge-in). */
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface AskMetrics {
  /** Time to first spoken-able token. THE number that matters for voice. */
  ttftMs: number | null;
  totalMs: number;
  sessionId: string | null;
  charCount: number;
  success: boolean;
  error?: string;
}

/**
 * Strip markdown so a TTS engine doesn't read punctuation aloud.
 *
 * JARVIS replies in markdown (headers, bullets, code fences, links). Spoken
 * verbatim that becomes "asterisk asterisk QQQ asterisk asterisk". Code blocks
 * are dropped entirely rather than read — nobody wants a shell script narrated.
 */
export function toSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' (code omitted) ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/(^|\s)\*([^*\n]+)\*/g, '$1$2')
    .replace(/(^|\s)_([^_\n]+)_/g, '$1$2')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*\|.*\|\s*$/gm, '')
    .replace(/^\s*[-:|\s]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Ask JARVIS, streaming text as it is generated.
 *
 * Yields StreamChunks. The caller (voice shell, terminal, web UI) decides what
 * to do with partial text — typically feed it to TTS sentence by sentence.
 */
export async function* askJarvisStream(
  query: string,
  opts: AskOptions = {},
): AsyncGenerator<StreamChunk> {
  const start = Date.now();
  const sessionId = opts.sessionId ?? randomUUID();
  const timeoutMs = opts.timeoutMs ?? 120_000;

  const flags = [
    '-p',
    '--dangerously-skip-permissions',
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
  ];

  // Resume keeps prior turns in context; session-id names a fresh conversation.
  if (opts.sessionId) flags.push('--resume', opts.sessionId);
  else flags.push('--session-id', sessionId);

  if (opts.model) flags.push('--model', opts.model);
  if (opts.brief !== false) flags.push('--brief');

  const proc = Bun.spawn(['claude', ...flags, query], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const timer = setTimeout(() => proc.kill(), timeoutMs);
  const onAbort = () => proc.kill();
  opts.signal?.addEventListener('abort', onAbort, { once: true });

  let ttft: number | null = null;
  let buffer = '';
  let emitted = false;

  try {
    const decoder = new TextDecoder();

    for await (const bytes of proc.stdout) {
      buffer += decoder.decode(bytes, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        let evt: any;
        try {
          evt = JSON.parse(trimmed);
        } catch {
          continue; // partial or non-JSON noise
        }

        // Token-level deltas — the fast path that lets TTS start early.
        if (evt.type === 'stream_event') {
          const delta = evt.event?.delta;
          if (delta?.type === 'text_delta' && delta.text) {
            if (ttft === null) ttft = Date.now() - start;
            emitted = true;
            yield { type: 'text', text: delta.text, elapsedMs: Date.now() - start };
          }
          continue;
        }

        // Whole assistant message — fallback if partials aren't emitted.
        if (evt.type === 'assistant' && !emitted) {
          const parts = evt.message?.content ?? [];
          for (const part of parts) {
            if (part.type === 'text' && part.text) {
              if (ttft === null) ttft = Date.now() - start;
              yield { type: 'text', text: part.text, elapsedMs: Date.now() - start };
            }
          }
          continue;
        }

        if (evt.type === 'system' && evt.session_id) {
          yield { type: 'session', sessionId: evt.session_id };
          continue;
        }

        if (evt.type === 'result') {
          // Only surface the aggregate if streaming produced nothing.
          if (!emitted && typeof evt.result === 'string' && evt.result.trim()) {
            if (ttft === null) ttft = Date.now() - start;
            yield { type: 'text', text: evt.result, elapsedMs: Date.now() - start };
          }
          yield {
            type: 'done',
            sessionId: evt.session_id ?? sessionId,
            elapsedMs: Date.now() - start,
          };
        }
      }
    }

    const code = await proc.exited;
    if (code !== 0 && !emitted) {
      const stderr = await new Response(proc.stderr).text();
      yield { type: 'error', text: stderr.trim() || `claude exited ${code}` };
    }
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener('abort', onAbort);
  }
}

/**
 * Non-streaming convenience wrapper. Collects the stream and reports metrics.
 * Used by the test harness and by callers that don't need incremental output.
 */
export async function askJarvis(
  query: string,
  opts: AskOptions = {},
): Promise<{ text: string; speech: string; metrics: AskMetrics }> {
  const start = Date.now();
  let text = '';
  let ttft: number | null = null;
  let sessionId: string | null = opts.sessionId ?? null;
  let error: string | undefined;

  for await (const chunk of askJarvisStream(query, opts)) {
    if (chunk.type === 'text' && chunk.text) {
      if (ttft === null) ttft = chunk.elapsedMs ?? Date.now() - start;
      text += chunk.text;
    } else if (chunk.type === 'session' || chunk.type === 'done') {
      sessionId = chunk.sessionId ?? sessionId;
    } else if (chunk.type === 'error') {
      error = chunk.text;
    }
  }

  return {
    text,
    speech: toSpeech(text),
    metrics: {
      ttftMs: ttft,
      totalMs: Date.now() - start,
      sessionId,
      charCount: text.length,
      success: !error && text.length > 0,
      error,
    },
  };
}
