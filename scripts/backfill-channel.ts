/**
 * One-off YouTube channel backfill.
 *
 * Adds a new channel to the DB registry, scrapes its latest N videos,
 * ingests transcripts, exports to wiki. After this, the weekly Sunday
 * cron (scheduler.ts) picks up new videos automatically at numVideos=10.
 *
 * Usage:
 *   bun run scripts/backfill-channel.ts \
 *     --url https://www.youtube.com/@nateherk \
 *     --id UC2ojq-nuP8ceeHqiroeKhBA \
 *     --name "Nate Herk | AI Automation" \
 *     --count 64
 */

import { knowledgeDb } from '../src/knowledge/database';
import { youtubeScraper } from '../src/knowledge/youtube-scraper';
import { contentIngestor } from '../src/knowledge/ingest';
import { exportVideosToWiki } from '../src/knowledge/wiki-export';
import { Database } from 'bun:sqlite';
import { join } from 'path';

function parseArgs(): {
  url: string;
  id: string;
  name: string;
  count: number;
  skip: number;
  frequency: string;
  audioFallback: boolean;
} {
  const args = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const has = (flag: string): boolean => args.includes(flag);
  const url = get('--url');
  const id = get('--id');
  const name = get('--name');
  const count = parseInt(get('--count') ?? '25', 10);
  const skip = parseInt(get('--skip') ?? '0', 10);
  const frequency = get('--frequency') ?? 'weekly';
  const audioFallback = has('--audio-fallback');
  if (!url || !id || !name) {
    console.error('Missing required flags. Need --url, --id, --name');
    console.error('Optional: --count (default 25), --skip (default 0),');
    console.error('          --frequency (default weekly), --audio-fallback (use AssemblyAI for videos without captions)');
    process.exit(1);
  }
  return { url, id, name, count, skip, frequency, audioFallback };
}

async function main() {
  const { url, id, name, count, skip, frequency, audioFallback } = parseArgs();

  console.log(`\n📌 Registering channel: ${name}`);
  console.log(`   URL: ${url}`);
  console.log(`   Channel ID: ${id}`);
  console.log(`   Frequency: ${frequency}`);

  const existing = knowledgeDb.getAllChannels(false).find((c) => c.channel_id === id);
  if (existing) {
    console.log(`   (already in registry, reusing)`);
  } else {
    const rowId = knowledgeDb.insertChannel({
      channel_id: id,
      name,
      url,
      check_frequency: frequency,
      active: true,
    });
    console.log(`   ✓ Inserted as row ${rowId}`);
  }

  console.log(`\n🎥 Scraping ${count} videos (skip: ${skip})...`);
  if (audioFallback) console.log(`   Audio fallback: ON (AssemblyAI will handle rate-limited/missing transcripts)`);
  const scrapeResult = await youtubeScraper.scrapeChannel({
    channelUrl: url,
    numVideos: count,
    skip,
    audioFallback,
  });

  if (!scrapeResult.success) {
    console.error(`   ❌ Scrape failed: ${scrapeResult.errors.join(', ')}`);
    process.exit(1);
  }

  console.log(`   ✓ ${scrapeResult.transcriptsSuccess}/${scrapeResult.videosFound} transcripts`);
  console.log(`   Output: ${scrapeResult.outputFile}`);

  console.log(`\n📥 Ingesting transcripts into knowledge DB...`);
  const importResult = await contentIngestor.ingestYouTubeTranscripts({
    sourceType: 'youtube',
    sourcePath: scrapeResult.outputFile,
    extractTopics: true,
    generateEmbeddings: false,
    showProgress: true,
  });

  console.log(`   ✓ ${importResult.totalSources} sources, ${importResult.totalSegments} segments`);

  if (importResult.sources.length > 0) {
    console.log(`\n📝 Exporting to claude-code-wiki...`);
    const dbPath = join(import.meta.dir, '..', 'data', 'ai-knowledge.db');
    const db = new Database(dbPath);
    try {
      const sourceIds = importResult.sources.map((s) => s.id);
      await exportVideosToWiki(db, sourceIds);
      console.log(`   ✓ Exported ${sourceIds.length} videos to wiki`);
    } finally {
      db.close();
    }
  }

  knowledgeDb.updateChannelLastChecked(id);
  console.log(`\n✅ Done. Weekly Sunday cron will pick up new videos going forward.`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
