/**
 * Academic Radar — weekly new-titles+abstracts triage from peer-reviewed journals.
 *
 * Terry has Auburn library access (EBSCO / Business Source Premier), so full text
 * of these journals is a DOI lookup away. This script proactively pulls the week's
 * NEW titles + abstracts from a curated journal list via the free Crossref API
 * (no auth, no manual alert setup), and produces a triage sheet: read title +
 * abstract → decide → pull full text via Auburn → drop the PDF in the
 * ai-futures-wiki academic library (ingest-academic.ts embeds it).
 *
 *   bun run scripts/academic-radar.ts [days=14]
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DAYS = parseInt(process.argv[2] || '14') || 14;
const MAILTO = 'byrdter@auburn.edu'; // Crossref "polite pool"
const OUT_DIR = join(process.env.HOME!, 'Library/CloudStorage/Dropbox/jarvis-private/reports/academic-radar');

// Curated journals relevant to Byrddynasty "Understanding AI" (AI + tech + business/econ).
// name, ISSN (Crossref), tier label. Edit freely.
const JOURNALS: { name: string; issn: string; tier: string }[] = [
  // Information Systems (rigor / evidence)
  { name: 'MIS Quarterly', issn: '0276-7783', tier: 'IS-A' },
  { name: 'Information Systems Research', issn: '1047-7047', tier: 'IS-A' },
  { name: 'Journal of MIS', issn: '1557-928X', tier: 'IS-A' },
  { name: 'Journal of the AIS', issn: '1536-9323', tier: 'IS' },
  { name: 'European Journal of IS', issn: '0960-085X', tier: 'IS' },
  { name: 'Information & Management', issn: '0378-7206', tier: 'IS' },
  // Management / strategy (AI-and-work, org impact)
  { name: 'Management Science', issn: '0025-1909', tier: 'Mgmt-A' },
  { name: 'Organization Science', issn: '1047-7039', tier: 'Mgmt-A' },
  { name: 'Academy of Management Journal', issn: '0001-4273', tier: 'Mgmt-A' },
  { name: 'Academy of Management Review', issn: '0363-7425', tier: 'Mgmt-A' },
  { name: 'Strategic Management Journal', issn: '0143-2095', tier: 'Mgmt-A' },
  { name: 'Academy of Management Perspectives', issn: '1558-9080', tier: 'Mgmt' },
  // Practitioner / bridge (closest to video ideas)
  { name: 'MIT Sloan Management Review', issn: '1532-9194', tier: 'Practitioner' },
  // Econ of AI
  { name: 'Journal of Economic Perspectives', issn: '0895-3309', tier: 'Econ' },
];

function fromDate(days: number): string {
  // No Date.now-in-workflow constraints here (plain script); compute normally.
  const d = new Date(Date.now() - days * 86400_000);
  return d.toISOString().slice(0, 10);
}

function stripJats(s: string): string {
  if (!s) return '';
  return s
    .replace(/<jats:title>.*?<\/jats:title>/gis, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJournal(issn: string, from: string): Promise<any[]> {
  const url = `https://api.crossref.org/journals/${issn}/works?filter=from-pub-date:${from}` +
    `&rows=25&sort=published&order=desc&mailto=${MAILTO}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': `JARVIS-AcademicRadar/1.0 (${MAILTO})` } });
      if (!r.ok) { await Bun.sleep(500 * (attempt + 1)); continue; }
      const j = await r.json() as any;
      return j?.message?.items || [];
    } catch { await Bun.sleep(500 * (attempt + 1)); }
  }
  return [];
}

const from = fromDate(DAYS);
const stamp = new Date().toISOString().slice(0, 10);
const L: string[] = [];
let totalNew = 0;
const sections: string[] = [];

for (const jrnl of JOURNALS) {
  const items = await fetchJournal(jrnl.issn, from);
  // Keep genuine articles (drop editorials/errata w/o abstract when possible).
  const papers = items
    .filter((it) => (it.title && it.title.length))
    .map((it) => ({
      title: (it.title || ['(untitled)'])[0],
      authors: (it.author || []).slice(0, 4).map((a: any) =>
        [a.given, a.family].filter(Boolean).join(' ')).join(', ') + ((it.author || []).length > 4 ? ' et al.' : ''),
      abstract: stripJats(it.abstract || ''),
      doi: it.DOI,
      date: (it.published?.['date-parts']?.[0] || []).join('-'),
    }));
  if (!papers.length) continue;
  totalNew += papers.length;
  const s: string[] = [];
  s.push(`### ${jrnl.name} — ${papers.length} new _(${jrnl.tier})_`);
  for (const p of papers) {
    s.push(`- **${p.title}**${p.date ? ` _(${p.date})_` : ''}`);
    if (p.authors) s.push(`  ${p.authors}`);
    if (p.abstract) s.push(`  > ${p.abstract.slice(0, 600)}${p.abstract.length > 600 ? '…' : ''}`);
    s.push(`  🔑 DOI: [${p.doi}](https://doi.org/${p.doi}) · pull full text via Auburn EBSCO / Business Source Premier`);
  }
  s.push('');
  sections.push(s.join('\n'));
  await Bun.sleep(300); // be polite to Crossref
}

L.push(`# Academic Radar — ${stamp}`);
L.push('');
L.push(`_${totalNew} new papers across ${JOURNALS.length} journals in the last ${DAYS} days. Triage: read the abstract → if useful for a video, open the DOI and pull the full text via Auburn (EBSCO / Business Source Premier), then drop the PDF into the ai-futures academic library to be embedded._`);
L.push('');
L.push('_Journals covered: ' + JOURNALS.map((j) => j.name).join(', ') + '._');
L.push('');
L.push(...sections);
L.push('---');
L.push('_Source: Crossref API (free). Edit the journal list in `agent-sdk/scripts/academic-radar.ts`._');

const md = L.join('\n');
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(join(OUT_DIR, `academic-${stamp}.md`), md);
writeFileSync(join(OUT_DIR, 'latest.md'), md);

console.log(`\n🎓 Academic Radar — ${totalNew} new papers / ${DAYS}d across ${JOURNALS.length} journals`);
console.log(`   Report: ${join(OUT_DIR, `academic-${stamp}.md`)}`);
