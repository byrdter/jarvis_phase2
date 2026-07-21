/**
 * Weekly Corpus Radar — the surfacing layer.
 *
 * Reads the ai-futures wiki graph (wiki-graph.db) and turns the last N days of
 * ingested articles into something Terry actually SEES: what's hot this week,
 * the rising entities/topics, the strongest headlines (with URLs), notable
 * quotes, and data-driven candidate video angles for the Byrddynasty
 * "Understanding AI" channel.
 *
 * Writes a markdown report to jarvis-private/reports/corpus-radar/ and prints a
 * compact summary (so a morning-brief job can capture it).
 *
 *   bun run scripts/weekly-corpus-radar.ts [days=7]
 */
import { Database } from 'bun:sqlite';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const WIKI_ROOT = join(process.env.HOME!, 'Library/CloudStorage/Dropbox/jarvis-private/ai-futures-wiki');
const DB_PATH = join(WIKI_ROOT, 'wiki-graph.db');
const OUT_DIR = join(process.env.HOME!, 'Library/CloudStorage/Dropbox/jarvis-private/reports/corpus-radar');
const DAYS = parseInt(process.argv[2] || '7') || 7;

// Dropbox files can throw EDEADLK on open; retry briefly.
function openDb(path: string): Database {
  for (let i = 0; i < 6; i++) {
    try { return new Database(path, { readonly: true }); }
    catch (e: any) {
      if (!['EDEADLK', 'EBUSY', 'EAGAIN'].includes(e?.code)) throw e;
      (globalThis as any).Bun?.sleepSync(60 * (i + 1));
    }
  }
  throw new Error(`could not open ${path}`);
}

const db = openDb(DB_PATH);
const since = `date('now','-${DAYS} days')`;

const recentCount = (db.query(
  `SELECT COUNT(*) AS n FROM items WHERE indexed >= ${since}`
).get() as any).n;

// Rising entities: most-mentioned among items indexed this week.
const risingEntities = db.query(`
  SELECT e.name, e.type, COUNT(DISTINCT i.id) AS docs, SUM(em.count) AS mentions
  FROM entity_mentions em
  JOIN items i ON i.id = em.item_id
  JOIN entities e ON e.id = em.entity_id
  WHERE i.indexed >= ${since}
  GROUP BY e.id
  ORDER BY docs DESC, mentions DESC
  LIMIT 15
`).all() as any[];

// Hot topics this week.
const hotTopics = db.query(`
  SELECT t.label, t.id AS slug, COUNT(DISTINCT ti.item_id) AS docs
  FROM topic_items ti
  JOIN items i ON i.id = ti.item_id
  JOIN topics t ON t.id = ti.topic_id
  WHERE i.indexed >= ${since}
  GROUP BY t.id
  ORDER BY docs DESC
  LIMIT 8
`).all() as any[];

// Strongest recent headlines per top topic (tier 1/2 preferred), with URLs.
function headlinesForTopic(slug: string, limit = 4): any[] {
  return db.query(`
    SELECT i.title, i.source, i.url, i.tier
    FROM topic_items ti
    JOIN items i ON i.id = ti.item_id
    JOIN topics t ON t.id = ti.topic_id
    WHERE t.id = ? AND i.indexed >= ${since} AND i.title IS NOT NULL
    ORDER BY (CASE i.tier WHEN '1' THEN 0 WHEN '2' THEN 1 ELSE 2 END), i.indexed DESC
    LIMIT ?
  `).all(slug, limit) as any[];
}

// Notable quotes surfaced this week (great for citation cards).
let recentQuotes: any[] = [];
try {
  recentQuotes = db.query(`
    SELECT q.quote, q.speaker, i.source, i.url
    FROM notable_quotes q JOIN items i ON i.id = q.item_id
    WHERE i.indexed >= ${since} AND length(q.quote) BETWEEN 40 AND 240
    ORDER BY i.indexed DESC LIMIT 6
  `).all() as any[];
} catch { /* table shape may vary */ }

// Candidate angles: fuse the top rising entity with a hot topic (the
// "combination titling → paradox" rule). These are seeds for Claude/Terry to
// sharpen into a real hook, each backed by real corpus headlines.
const candidates: { angle: string; why: string }[] = [];
const usedEntities = new Set<string>();
for (let i = 0; i < Math.min(5, hotTopics.length); i++) {
  const topic = hotTopics[i];
  const topicLower = topic.label.toLowerCase();
  // Pick the highest-ranked rising entity that isn't already used and isn't a
  // degenerate self-pair (its name subsumed by the topic label).
  const ent = risingEntities.find((e) =>
    !usedEntities.has(e.name) &&
    !topicLower.includes(e.name.toLowerCase()) &&
    !e.name.toLowerCase().includes(topicLower.split(/[\s&]/)[0]));
  if (!ent) continue;
  usedEntities.add(ent.name);
  candidates.push({
    angle: `${ent.name} × "${topic.label}"`,
    why: `${ent.docs} recent docs mention ${ent.name}; "${topic.label}" is the week's #${i + 1} topic (${topic.docs} docs). Look for the paradox where these two collide.`,
  });
}

// ---- Render markdown ----
const stamp = new Date().toISOString().slice(0, 10);
const L: string[] = [];
L.push(`# Weekly Corpus Radar — ${stamp}`);
L.push('');
L.push(`_${recentCount} articles ingested in the last ${DAYS} days. Source: ai-futures knowledge base. This is a triage sheet — pick what earns a video._`);
L.push('');
L.push('## 🔥 Rising entities this week');
L.push('');
L.push('| Entity | Type | Recent docs | Mentions |');
L.push('|---|---|---|---|');
for (const e of risingEntities.slice(0, 12)) L.push(`| ${e.name} | ${e.type} | ${e.docs} | ${e.mentions ?? ''} |`);
L.push('');
L.push('## 📊 Hot topics this week');
L.push('');
for (const t of hotTopics) {
  L.push(`### ${t.label} — ${t.docs} articles`);
  for (const h of headlinesForTopic(t.slug)) {
    const tier = h.tier ? ` _(tier ${h.tier})_` : '';
    L.push(`- [${h.title}](${h.url}) — ${h.source}${tier}`);
  }
  L.push('');
}
if (recentQuotes.length) {
  L.push('## 💬 Notable quotes (citation-card candidates)');
  L.push('');
  for (const q of recentQuotes) {
    L.push(`> "${q.quote}"`);
    L.push(`> — ${q.speaker || 'unattributed'}, ${q.source} · [source](${q.url})`);
    L.push('');
  }
}
L.push('## 🎬 Candidate video angles (seeds — sharpen into a hook)');
L.push('');
L.push('_Per the hooks playbook: fuse two proven concepts into a paradox the viewer can\'t resolve alone. Each seed is backed by the real headlines above._');
L.push('');
for (const c of candidates) L.push(`- **${c.angle}** — ${c.why}`);
L.push('');
L.push('---');
L.push('_Search the full corpus: `cd agent-sdk && bun run search "your topic"`._');

const md = L.join('\n');
mkdirSync(OUT_DIR, { recursive: true });
const outPath = join(OUT_DIR, `radar-${stamp}.md`);
writeFileSync(outPath, md);
writeFileSync(join(OUT_DIR, 'latest.md'), md);

// Compact stdout summary (morning-brief can capture this).
console.log(`\n📡 Weekly Corpus Radar — ${recentCount} articles / ${DAYS}d`);
console.log(`   Rising: ${risingEntities.slice(0, 6).map((e) => e.name).join(', ')}`);
console.log(`   Hot topics: ${hotTopics.slice(0, 5).map((t) => t.label).join(' · ')}`);
console.log(`   Report: ${outPath}`);
db.close();
