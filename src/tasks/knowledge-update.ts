/**
 * Knowledge Base Auto-Update Task
 *
 * Checks all active YouTube channels for new videos weekly.
 * Updates BOTH SQLite knowledge base AND claude-code-wiki.
 *
 * Uses the `runBatch` helper so that a failure on one channel never aborts
 * the whole run (Archon's batch-failure pattern).
 */

import { knowledgeDb } from '../knowledge/database';
import { youtubeScraper } from '../knowledge/youtube-scraper';
import { contentIngestor } from '../knowledge/ingest';
import { exportVideosToWiki } from '../knowledge/wiki-export';
import { Database } from 'bun:sqlite';
import { join } from 'path';
import { runBatch, summarizeBatch } from '../util/batch';

interface ChannelOutcome {
  channel: string;
  newVideos: number;
  newSegments: number;
  wrote_to_wiki: boolean;
  skipped_reason?: string;
}

async function processOneChannel(channel: any): Promise<ChannelOutcome> {
  // Get most recent video for this channel
  const sources = knowledgeDb
    .getAllContentSources('youtube')
    .filter((s) => s.metadata && s.metadata.channel_name === channel.name);
  const lastVideoId = sources[0]?.metadata?.video_id || '';

  const checkResult = await youtubeScraper.checkForNewVideos(channel.url, lastVideoId);

  if (!checkResult.hasNew) {
    // Non-error: channel is up to date. Still mark it checked.
    knowledgeDb.updateChannelLastChecked(channel.channel_id);
    return {
      channel: channel.name,
      newVideos: 0,
      newSegments: 0,
      wrote_to_wiki: false,
      skipped_reason: 'no new videos',
    };
  }

  console.log(`      📹 ${channel.name}: ${checkResult.newCount} new video(s)`);

  const scrapeResult = await youtubeScraper.scrapeChannel({
    channelUrl: channel.url,
    numVideos: 10,
    audioFallback: false,
  });

  if (!scrapeResult.success) {
    throw new Error(`scrape failed: ${scrapeResult.errors.join(', ')}`);
  }

  const importResult = await contentIngestor.ingestYouTubeTranscripts({
    sourceType: 'youtube',
    sourcePath: scrapeResult.outputFile,
    extractTopics: true,
    generateEmbeddings: false,
    showProgress: false,
  });

  let wroteToWiki = false;
  if (importResult.sources.length > 0) {
    const dbPath = join(__dirname, '../../data/ai-knowledge.db');
    const db = new Database(dbPath);
    try {
      const sourceIds = importResult.sources.map((s) => s.id);
      await exportVideosToWiki(db, sourceIds);
      wroteToWiki = true;
    } finally {
      db.close();
    }
  }

  knowledgeDb.updateChannelLastChecked(channel.channel_id);
  // Polite delay between channels
  await new Promise((r) => setTimeout(r, 2000));

  return {
    channel: channel.name,
    newVideos: importResult.totalSources,
    newSegments: importResult.totalSegments,
    wrote_to_wiki: wroteToWiki,
  };
}

export async function updateKnowledgeBase(): Promise<string> {
  console.log('📚 Checking YouTube channels for new videos...');
  const channels = knowledgeDb.getAllChannels(true);

  if (channels.length === 0) {
    console.log('   No active channels to check');
    return 'No active channels';
  }

  console.log(`   Found ${channels.length} active channels`);

  const result = await runBatch(channels, (channel) => processOneChannel(channel), {
    stage: 'channel-check',
    onFailure: (f) => console.error(`      ❌ ${(f.item as any)?.name}: ${f.error}`),
    onProgress: (done, total) => {
      if (done % 5 === 0 || done === total) console.log(`   Progress: ${done}/${total}`);
    },
  });

  const totalVideos = result.successes.reduce((s, { result: r }) => s + r.newVideos, 0);
  const newOnly = result.successes.filter(({ result: r }) => r.newVideos > 0);

  const summary = totalVideos > 0
    ? `${totalVideos} new videos across ${newOnly.length} channel(s). ${summarizeBatch(result)}`
    : `No new videos. ${summarizeBatch(result)}`;

  console.log(`\n   ✅ ${summary}`);
  if (result.failures.length > 0) {
    console.log(`   Failed channels: ${result.failures.map((f) => (f.item as any)?.name).join(', ')}`);
  }
  return summary;
}
