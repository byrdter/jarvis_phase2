/**
 * Voice Phase 1 — latency harness.
 *
 * Answers the gate question from VOICE-MASTER-PLAN.md: is the CLI fast enough
 * to feel conversational?
 *
 * The metric that matters is TTFT (time to first token), NOT total duration —
 * with streaming, TTS starts speaking at the first token, so total length is
 * hidden behind the speech itself. TTFT is the silence the user actually hears.
 *
 * Run:  bun run src/voice/measure.ts
 */

import { askJarvis, askJarvisStream } from './bridge.ts';

interface Case {
  name: string;
  query: string;
  model?: 'sonnet' | 'opus' | 'haiku';
}

const CASES: Case[] = [
  { name: 'trivial (baseline spawn cost)', query: 'Say exactly: ok. Nothing else.', model: 'haiku' },
  { name: 'conversational', query: 'In one sentence, what is asset revesting?', model: 'haiku' },
  { name: 'memory lookup', query: 'What phase is JARVIS currently in? One sentence.', model: 'sonnet' },
  { name: 'file/context read', query: 'What is the current runtime target for Byrddynasty videos? One sentence.', model: 'sonnet' },
  { name: 'tool use (market)', query: 'What is the current price of SPY? One sentence.', model: 'sonnet' },
];

function pct(values: number[], p: number): number {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

const ttfts: number[] = [];
const totals: number[] = [];

console.log('JARVIS Voice — Phase 1 latency measurement');
console.log('='.repeat(72));
console.log('TTFT = silence the user hears before JARVIS starts speaking.\n');

for (const c of CASES) {
  process.stdout.write(`  ${c.name.padEnd(32)} `);
  const { speech, metrics } = await askJarvis(c.query, { model: c.model });

  if (!metrics.success) {
    console.log(`FAILED — ${metrics.error?.slice(0, 60)}`);
    continue;
  }

  ttfts.push(metrics.ttftMs ?? metrics.totalMs);
  totals.push(metrics.totalMs);
  console.log(
    `TTFT ${String(metrics.ttftMs).padStart(6)}ms   total ${String(metrics.totalMs).padStart(6)}ms   ${metrics.charCount}ch`,
  );
  console.log(`  ${' '.repeat(32)} → "${speech.slice(0, 68).replace(/\n/g, ' ')}"`);
}

// Session continuity: does a follow-up turn keep context, and is resume faster?
console.log('\n  session continuity');
console.log('  ' + '-'.repeat(70));
const turn1 = await askJarvis('Remember the number 47. Reply with just: got it.', { model: 'haiku' });
console.log(`  turn 1  TTFT ${turn1.metrics.ttftMs}ms  session ${turn1.metrics.sessionId?.slice(0, 8)}  "${turn1.speech.slice(0, 40)}"`);

if (turn1.metrics.sessionId) {
  const turn2 = await askJarvis('What number did I ask you to remember? Reply with just the number.', {
    model: 'haiku',
    sessionId: turn1.metrics.sessionId,
  });
  const kept = turn2.speech.includes('47');
  console.log(`  turn 2  TTFT ${turn2.metrics.ttftMs}ms  context kept: ${kept ? 'YES' : 'NO'}  "${turn2.speech.slice(0, 40)}"`);
}

console.log('\n' + '='.repeat(72));
console.log(`TTFT   p50 ${pct(ttfts, 50)}ms   p90 ${pct(ttfts, 90)}ms   min ${Math.min(...ttfts)}ms   max ${Math.max(...ttfts)}ms`);
console.log(`TOTAL  p50 ${pct(totals, 50)}ms   p90 ${pct(totals, 90)}ms`);

const p50 = pct(ttfts, 50);
console.log('\nGATE (VOICE-MASTER-PLAN.md): p50 under ~4s → design holds as written.');
console.log(
  p50 < 4000
    ? `  ✅ p50 ${p50}ms — proceed to Phase 2.`
    : `  ⚠️  p50 ${p50}ms — exceeds gate. Filler alone will not cover this; revisit before building voice UI.`,
);
