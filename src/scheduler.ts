/**
 * JARVIS Scheduler
 *
 * Runs periodic jobs in-process using node-cron:
 *   - Weekly knowledge update (Sunday 2:00 AM local) — checks YouTube, ingests new videos
 *   - Weekly wiki reindex (Sunday 2:30 AM local) — rebuilds FTS5 search index
 *
 * Tracks last-run + next-run in a tiny JSON file so /api/scheduler/status can report it.
 */

import cron, { type ScheduledTask } from 'node-cron';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { updateKnowledgeBase } from './tasks/knowledge-update';
import { getWikiSearch } from './api/wiki-search';
import { CrawlingService } from './crawling/service';
import { runBatch, summarizeBatch } from './util/batch';
import type { CrawlRequest } from './crawling/types';
import { JarvisCLIClient } from './jarvis-cli-client';

const jarvis = new JarvisCLIClient();

const STATE_FILE = join(__dirname, '..', 'data', 'scheduler-state.json');

interface JobState {
  id: string;
  name: string;
  cron: string;
  enabled: boolean;
  last_run: string | null;
  last_result: string | null;
  last_error: string | null;
  running: boolean;
}

interface SchedulerState {
  jobs: Record<string, JobState>;
}

function loadState(): SchedulerState {
  if (!existsSync(STATE_FILE)) {
    return { jobs: {} };
  }
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return { jobs: {} };
  }
}

function saveState(state: SchedulerState) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

const state = loadState();

function upsertJob(id: string, name: string, cronExpr: string) {
  if (!state.jobs[id]) {
    state.jobs[id] = {
      id,
      name,
      cron: cronExpr,
      enabled: true,
      last_run: null,
      last_result: null,
      last_error: null,
      running: false,
    };
  } else {
    state.jobs[id].cron = cronExpr;
    state.jobs[id].name = name;
  }
  saveState(state);
}

async function runJob(id: string, fn: () => Promise<string>) {
  const job = state.jobs[id];
  if (!job) return;
  if (job.running) {
    console.log(`⏩ Job ${id} already running, skipping`);
    return;
  }
  job.running = true;
  saveState(state);
  console.log(`⏰ Running scheduled job: ${job.name}`);
  try {
    const result = await fn();
    job.last_run = new Date().toISOString();
    job.last_result = result;
    job.last_error = null;
    console.log(`✅ ${job.name}: ${result}`);
  } catch (err: any) {
    job.last_run = new Date().toISOString();
    job.last_error = err.message ?? String(err);
    job.last_result = null;
    console.error(`❌ ${job.name} failed:`, err);
  } finally {
    job.running = false;
    saveState(state);
  }
}

// ============================================================================
// JOB DEFINITIONS
// ============================================================================

/**
 * Default sources to re-crawl weekly. Edit this list (or move to settings table
 * later) to add/remove doc sites. Modular by design.
 */
export const DEFAULT_CRAWL_SOURCES: CrawlRequest[] = [
  {
    type: 'recursive',
    url: 'https://docs.anthropic.com/en/docs/claude-code',
    options: {
      maxPages: 50,
      maxDepth: 3,
      sameDomain: true,
      includePatterns: ['/docs/claude-code'],
      collection: 'anthropic-claude-code',
    },
  },
];

/**
 * Chris Vermeulen video checker.
 * Uses the existing check_new_videos.py script but copies transcripts
 * into operations-wiki/raw/transcripts/chris-vermeulen/ for wiki ingestion.
 */
async function checkVermeulenVideos(): Promise<string> {
  const { spawn } = await import('child_process');
  const { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } = await import('fs');
  const { join, basename } = await import('path');

  const jarvisRoot = join(import.meta.dir, '../..');
  const scriptPath = join(jarvisRoot, 'skills', 'market-insights', 'check_new_videos.py');
  const transcriptsDir = join(jarvisRoot, 'skills', 'market-insights', 'transcripts');
  const opsWikiDst = '/Users/terrybyrd/Library/CloudStorage/Dropbox/jarvis-private/operations-wiki/raw/transcripts/chris-vermeulen';

  mkdirSync(opsWikiDst, { recursive: true });

  // Run the existing Python scraper
  const pythonPath = join(jarvisRoot, '.venv', 'bin', 'python3');
  return new Promise((resolve) => {
    let output = '';
    const proc = spawn(existsSync(pythonPath) ? pythonPath : 'python3', [scriptPath], { cwd: jarvisRoot });
    proc.stdout?.on('data', (d: Buffer) => { output += d.toString(); });
    proc.stderr?.on('data', (d: Buffer) => { output += d.toString(); });
    proc.on('close', () => {
      // Sync any new transcripts to operations-wiki
      let synced = 0;
      try {
        const existing = new Set(readdirSync(opsWikiDst));
        const srcFiles = readdirSync(transcriptsDir).filter((f: string) => f.startsWith('vermeulen-'));
        for (const file of srcFiles) {
          const slug = file.replace(/\.txt$/, '').toLowerCase().replace(/[^a-z0-9-]/g, '-') + '.md';
          if (!existing.has(slug)) {
            const content = readFileSync(join(transcriptsDir, file), 'utf-8');
            const dateMatch = file.match(/(\d{4}-\d{2}-\d{2})/);
            const fm = [
              '---',
              `title: "Chris Vermeulen — ${file.replace(/vermeulen-[\d-]+-/, '').replace(/\.txt$/, '').replace(/-/g, ' ')}"`,
              'source: youtube',
              'collection: chris-vermeulen',
              'channel: TheTechnicalTraders',
              `fetched_at: ${dateMatch ? dateMatch[1] : new Date().toISOString().slice(0, 10)}T00:00:00Z`,
              'author: "Chris Vermeulen"',
              'domain: investments',
              '---',
              '',
            ].join('\n');
            writeFileSync(join(opsWikiDst, slug), fm + content + '\n');
            synced++;
          }
        }
      } catch (e) {
        // transcripts dir may not exist yet
      }

      const hasNew = output.includes('New video found');
      resolve(hasNew
        ? `New Vermeulen video found. ${synced} transcript(s) synced to operations-wiki.`
        : `No new Vermeulen videos. ${synced} transcript(s) synced.`);
    });
  });
}

const crawlService = new CrawlingService();

// Phase 7B — detector runner is wired in from the server so the scheduler doesn't own the DB handle.
type DetectorRunner = () => Promise<Record<string, number>>;
let detectorRunner: DetectorRunner | null = null;
export function registerDetectorRunner(fn: DetectorRunner) {
  detectorRunner = fn;
}

// Phase 8 — auto-apply runner (low-risk drafted proposals get auto-approved + applied)
type AutoApplyRunner = () => Promise<Record<string, number>>;
let autoApplyRunner: AutoApplyRunner | null = null;
export function registerAutoApplyRunner(fn: AutoApplyRunner) {
  autoApplyRunner = fn;
}

// Phase 7D — extra crawl sources from the DB, unioned with DEFAULT_CRAWL_SOURCES at job time.
type ExtraSourcesProvider = () => CrawlRequest[];
let extraSourcesProvider: ExtraSourcesProvider = () => [];
export function registerExtraCrawlSources(fn: ExtraSourcesProvider) {
  extraSourcesProvider = fn;
}

const JOBS: Array<{ id: string; name: string; cron: string; fn: () => Promise<string>; tz?: string }> = [
  {
    id: 'weekly-knowledge-update',
    name: 'Weekly Knowledge Update',
    cron: '0 2 * * 0', // Sunday 2:00 AM
    fn: async () => {
      const result = await updateKnowledgeBase();
      const counts = getWikiSearch().reindexAll();
      return `${result} | Reindexed ${counts.claudeCode + counts.operations} wiki pages`;
    },
  },
  {
    id: 'weekly-docs-crawl',
    name: 'Weekly Documentation Crawl',
    cron: '0 3 * * 0', // Sunday 3:00 AM
    fn: async () => {
      const allSources = [...DEFAULT_CRAWL_SOURCES, ...extraSourcesProvider()];
      const batch = await runBatch(allSources, async (req) => {
        const report = await crawlService.crawl(req);
        const exportResult = await crawlService.exportToWiki(report);
        return { docs: report.docs.length, written: exportResult.written.length, collection: exportResult.collection };
      }, { stage: 'docs-crawl' });

      const totalDocs = batch.successes.reduce((s, { result: r }) => s + r.docs, 0);
      return `${totalDocs} docs fetched across ${batch.successes.length}/${allSources.length} sources. ${summarizeBatch(batch)}`;
    },
  },
  {
    id: 'daily-market-analysis',
    name: 'Daily Market Analysis',
    cron: '0 9 * * 1-5', // Weekdays 9:00 AM — pre-market scan
    fn: async () => {
      // Agent SDK approach: Claude has full JARVIS context (wiki, skills, memory)
      const response = await jarvis.ask(
        `You are running the Daily Market Analysis task. Do the following:

1. Run "jarvis-price stage SPY QQQ XLK SMH XOP TLT BIL --json" to get current stage readings for the core ETFs.
2. Read the Asset Revesting methodology from the operations wiki (wiki/investments/asset-revesting-methodology.md) to ground your analysis in the four-stage model.
3. For any ETF in Stage 2 with grade A or B, note it as a potential opportunity.
4. For any ETF showing Stage 3 or Stage 4, flag it as a risk.
5. Write a concise market analysis summary (200 words max) and save it to the reports directory.
6. Update the operations wiki hot.md with today's key finding (one sentence).

Be concise. This is an automated daily task, not a conversation.`,
        { autonomous: true, model: 'sonnet' }
      );
      return response.success
        ? `Agent analysis complete: ${response.text.slice(0, 200)}`
        : `Agent analysis failed: ${response.error ?? 'unknown'}`;
    },
  },
  {
    id: 'weekly-investment-update',
    name: 'Weekly Investment Update',
    cron: '0 4 * * 0', // Sunday 4:00 AM — after docs crawl
    fn: async () => {
      // Step 1: Mechanical — check for new videos and sync transcripts (no Claude needed)
      const syncResult = await checkVermeulenVideos();

      // Step 2: Agent SDK — if new transcripts arrived, have Claude synthesize them
      if (syncResult.includes('transcript(s) synced') && !syncResult.includes('0 transcript(s)')) {
        const response = await jarvis.ask(
          `New Chris Vermeulen transcripts have been synced to the operations wiki at raw/transcripts/chris-vermeulen/.

1. Read the new transcript(s).
2. Update wiki/investments/weekly-market-analysis.md with key takeaways from the latest video.
3. Cross-reference against the four-stage model (wiki/investments/four-stage-model.md).
4. Note any stage changes or actionable signals.
5. Update wiki/hot.md with a one-line summary of the latest analysis.

Be concise — update the existing pages, don't create new ones.`,
          { autonomous: true, model: 'sonnet' }
        );
        const counts = getWikiSearch().reindexAll();
        return `${syncResult} | Agent synthesis: ${response.success ? 'done' : response.error} | Reindexed ${counts.claudeCode + counts.operations} pages`;
      }

      // No new videos — just reindex in case manual edits happened
      const counts = getWikiSearch().reindexAll();
      return `${syncResult} | Reindexed ${counts.claudeCode + counts.operations} pages`;
    },
  },
  {
    id: 'weekly-wiki-reindex',
    name: 'Weekly Wiki Reindex',
    cron: '30 4 * * 0', // Sunday 4:30 AM — after all updates
    fn: async () => {
      const counts = getWikiSearch().reindexAll();
      return `Reindexed ${counts.claudeCode} claude-code, ${counts.operations} operations pages`;
    },
  },
  {
    id: 'daily-improvements-scan',
    name: 'Daily Improvements Scan',
    cron: '0 5 * * *', // 5:00 AM every day — after all wiki refreshes have settled
    fn: async () => {
      if (!detectorRunner) return 'Detector runner not registered';
      const r = await detectorRunner();
      return `stale:${r.stale_page} links:${r.broken_link} misses:${r.search_miss} bridges:${r.cross_wiki_bridge ?? 0} contradictions:${r.contradiction ?? 0} skipped:${r.skipped_existing}`;
    },
  },
  {
    // Phase 8 — auto-apply runs after the daily detector scan + drafter has had time to draft.
    id: 'daily-auto-apply',
    name: 'Daily Auto-Apply (low-risk only)',
    cron: '30 6 * * *', // 6:30 AM every day — 90 min after detector scan
    fn: async () => {
      if (!autoApplyRunner) return 'Auto-apply runner not registered';
      const r = await autoApplyRunner();
      return `considered:${r.considered ?? 0} auto-approved:${r.auto_approved ?? 0} auto-applied:${r.auto_applied ?? 0} failed:${r.failed ?? 0}`;
    },
  },
  {
    // Byrddynasty knowledge pipeline — daily digest of new AI-futures items.
    // 9:00 AM Europe/Madrid. Sweeps daily-cadence sources + weekday weekly/monthly
    // rotation, parses forwarded academic alert emails, then emails/Telegrams a digest.
    id: 'daily-ai-futures-digest',
    name: 'Daily AI-Futures Digest',
    cron: '0 9 * * *',
    tz: 'Europe/Madrid',
    fn: async () => {
      const { runSweep } = await import('./fetchers/sweep');
      const { buildDigest } = await import('./fetchers/digest');
      const { deliver } = await import('./fetchers/notify');
      // Daily every day; add weekly on Mondays, monthly on the 1st.
      const day = new Date();
      const cadences: Array<'daily' | 'weekly' | 'monthly'> = ['daily'];
      if (day.getDay() === 1) cadences.push('weekly');
      if (day.getDate() === 1) cadences.push('monthly');
      const items = [] as any[];
      for (const c of cadences) items.push(...(await runSweep(c)));
      // Fold in academic alert emails (no-op if Gmail not configured).
      try {
        const { parseAcademicAlerts } = await import('./fetchers/gmail-academic-alerts');
        items.push(...(await parseAcademicAlerts()));
      } catch (e: any) { /* gmail not configured yet */ }
      if (!items.length) return 'No new items — digest skipped.';
      const digest = buildDigest(items, cadences);
      const res = await deliver(digest);
      const counts = getWikiSearch().reindexAll();
      try { const { buildGraph } = await import('./fetchers/graph'); buildGraph(); } catch (e: any) { /* graph rebuild best-effort */ }
      return `${items.length} items via ${res.channel} (${res.ok ? 'ok' : res.detail}); reindexed ai-futures=${counts['ai-futures'] ?? 0}; graph rebuilt`;
    },
  },
  {
    // Auto-ingest any academic PDFs dropped into the library folders.
    id: 'daily-academic-ingest',
    name: 'Daily Academic Library Ingest',
    cron: '30 8 * * *', // 8:30 AM Madrid — before the 9:00 digest
    tz: 'Europe/Madrid',
    fn: async () => {
      const mod = await import('./fetchers/ingest-academic');
      const n = await (mod as any).ingestAcademicLibrary?.();
      const counts = getWikiSearch().reindexAll();
      return `academic ingest done; reindexed ai-futures=${counts['ai-futures'] ?? 0}`;
    },
  },
];

const tasks = new Map<string, ScheduledTask>();

export function startScheduler() {
  for (const job of JOBS) {
    upsertJob(job.id, job.name, job.cron);
    const tz = job.tz || 'America/New_York';
    const task = cron.schedule(job.cron, () => runJob(job.id, job.fn), { timezone: tz });
    tasks.set(job.id, task);
    console.log(`📅 Scheduled "${job.name}" [${job.cron} ${tz}]`);
  }
}

export async function runJobNow(id: string): Promise<{ ok: boolean; message: string }> {
  const jobDef = JOBS.find((j) => j.id === id);
  if (!jobDef) {
    return { ok: false, message: `Unknown job: ${id}` };
  }
  // Fire-and-forget — return immediately so the HTTP call doesn't block
  runJob(id, jobDef.fn).catch(() => {});
  return { ok: true, message: `Started ${jobDef.name}` };
}

export function getSchedulerStatus() {
  const out = loadState();
  // Enrich with next_run from cron expression (approximate)
  const enriched: Record<string, JobState & { next_run?: string }> = {};
  for (const [id, job] of Object.entries(out.jobs)) {
    let next_run: string | undefined;
    try {
      const task = tasks.get(id);
      if (task) {
        // node-cron v4 has getNextRun()
        const next = (task as any).nextDate?.() ?? (task as any).getNextRun?.();
        if (next) {
          next_run = next.toISOString ? next.toISOString() : String(next);
        }
      }
    } catch {}
    enriched[id] = { ...job, ...(next_run ? { next_run } : {}) };
  }
  return { jobs: Object.values(enriched) };
}

// HTTP handler for scheduler API
export async function handleSchedulerRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);

  if (url.pathname === '/api/scheduler/status' && req.method === 'GET') {
    return Response.json(getSchedulerStatus());
  }

  const runMatch = url.pathname.match(/^\/api\/scheduler\/run\/([^/]+)$/);
  if (runMatch && req.method === 'POST') {
    const id = runMatch[1] ?? '';
    if (!id) return Response.json({ ok: false, message: 'Missing job id' }, { status: 400 });
    const result = await runJobNow(id);
    return Response.json(result, { status: result.ok ? 200 : 404 });
  }

  return Response.json({ error: 'Not found' }, { status: 404 });
}
