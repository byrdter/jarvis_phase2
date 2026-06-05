#!/usr/bin/env bun
/**
 * Export Claude Code Knowledge Base to Wiki Format
 *
 * Exports all 125 videos from SQLite database to markdown files
 * in claude-code-wiki/raw/transcripts/ organized by channel
 */

import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const DB_PATH = join(import.meta.dir, '../data/ai-knowledge.db');
const OUTPUT_BASE = '/Users/terrybyrd/Library/CloudStorage/Dropbox/jarvis-private/claude-code-wiki/raw/transcripts';

const db = new Database(DB_PATH);

// Get all sources
const sources = db.query(`
  SELECT id, title, author, url, type, metadata, published_date, indexed_at
  FROM content_sources
  ORDER BY author, published_date
`).all();

console.log(`📚 Exporting ${sources.length} videos to wiki format...\n`);

let exported = 0;
let skipped = 0;

for (const source of sources as any[]) {
  try {
    // Get segments for this source
    const segments = db.query(`
      SELECT segment_index, text
      FROM segments
      WHERE source_id = ?
      ORDER BY segment_index
    `).all(source.id);

    // Get topics
    const topics = db.query(`
      SELECT t.name
      FROM topics t
      JOIN source_topics st ON t.id = st.topic_id
      WHERE st.source_id = ?
    `).all(source.id);

    // Determine channel folder
    const channelSlug = source.author
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const channelDir = join(OUTPUT_BASE, channelSlug);
    if (!existsSync(channelDir)) {
      mkdirSync(channelDir, { recursive: true });
    }

    // Create filename from title and video ID
    const metadata = source.metadata ? JSON.parse(source.metadata) : {};
    const videoId = metadata.video_id || source.url.split('v=')[1]?.split('&')[0] || `video-${source.id}`;
    const titleSlug = source.title
      .toLowerCase()
      .substring(0, 50)
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    const filename = `${videoId}-${titleSlug}.md`;
    const filepath = join(channelDir, filename);

    // Create markdown content
    const markdown = `---
title: "${source.title}"
author: ${source.author}
url: ${source.url}
video_id: ${videoId}
channel: ${channelSlug}
published: ${source.published_date || 'unknown'}
indexed: ${source.indexed_at}
topics: [${topics.map((t: any) => t.name).join(', ')}]
segments: ${segments.length}
type: youtube
---

# ${source.title}

**Channel:** ${source.author}
**URL:** ${source.url}
**Published:** ${source.published_date || 'Unknown'}
**Topics:** ${topics.map((t: any) => t.name).join(', ')}

---

## Transcript

${segments.map((seg: any, idx: number) => {
  return `### Segment ${seg.segment_index + 1}\n\n${seg.text}\n`;
}).join('\n')}

---

## Metadata

- **Video ID:** ${videoId}
- **Segments:** ${segments.length}
- **Source ID:** ${source.id}
- **Indexed:** ${source.indexed_at}
`;

    writeFileSync(filepath, markdown);
    exported++;

    if (exported % 10 === 0) {
      console.log(`   ✅ Exported ${exported}/${sources.length} videos...`);
    }

  } catch (error) {
    console.error(`   ❌ Error exporting "${source.title}":`, error);
    skipped++;
  }
}

db.close();

console.log(`\n✅ Export complete!`);
console.log(`   Exported: ${exported} videos`);
console.log(`   Skipped: ${skipped} videos`);
console.log(`   Location: ${OUTPUT_BASE}`);
console.log(`\nNext steps:`);
console.log(`1. Review exported markdown files in claude-code-wiki/raw/transcripts/`);
console.log(`2. Use wiki-ingest to import videos (interactive for quality)`);
console.log(`3. Start with high-priority videos (hooks, memory, skills)`);
