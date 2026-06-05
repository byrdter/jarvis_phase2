/**
 * Claude Code Knowledge Repository Database
 *
 * Multi-source knowledge base for:
 * - YouTube videos (transcripts)
 * - Workshops (2-hour sessions)
 * - Documentation (written guides)
 * - Articles (blog posts, tutorials)
 *
 * Uses hybrid vector + keyword search (Phase 2B infrastructure)
 */

import { Database } from 'bun:sqlite';
import { join } from 'path';

export interface ContentSource {
  id?: number;
  type: 'youtube' | 'workshop' | 'documentation' | 'article';
  title: string;
  url?: string;
  author?: string;
  published_date?: string;
  duration_seconds?: number;
  content_path?: string;
  transcript_path?: string;
  indexed_at?: string;
  last_updated?: string;
  metadata?: Record<string, any>;
}

export interface Segment {
  id?: number;
  source_id: number;
  segment_index: number;
  timestamp_start?: number;  // Seconds (for video content)
  timestamp_end?: number;
  text: string;
  embedding_path?: string;
}

export interface Topic {
  id?: number;
  name: string;
  category?: string;  // 'feature', 'technique', 'tool', 'workflow'
  description?: string;
  parent_topic_id?: number;
}

export interface SourceTopic {
  source_id: number;
  topic_id: number;
  relevance_score?: number;
  extracted_at?: string;
}

export interface Channel {
  id?: number;
  channel_id: string;
  name: string;
  url: string;
  last_checked?: string;
  check_frequency?: string;  // 'daily', 'weekly', 'monthly'
  active?: boolean;
}

export class KnowledgeDatabase {
  private db: Database;

  constructor(dbPath?: string) {
    const path = dbPath || join(__dirname, '../../data/ai-knowledge.db');
    this.db = new Database(path);
    this.initSchema();
  }

  private initSchema(): void {
    // Content sources (unified table for all types)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS content_sources (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK(type IN ('youtube', 'workshop', 'documentation', 'article')),
        title TEXT NOT NULL,
        url TEXT,
        author TEXT,
        published_date TEXT,
        duration_seconds INTEGER,
        content_path TEXT,
        transcript_path TEXT,
        indexed_at TEXT,
        last_updated TEXT,
        metadata TEXT  -- JSON string for flexible metadata
      )
    `);

    // Segments (chunked content for precise search)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS segments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id INTEGER NOT NULL,
        segment_index INTEGER NOT NULL,
        timestamp_start INTEGER,
        timestamp_end INTEGER,
        text TEXT NOT NULL,
        embedding_path TEXT,
        FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE
      )
    `);

    // Topics (auto-extracted + manual)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        category TEXT CHECK(category IN ('feature', 'technique', 'tool', 'workflow', 'concept')),
        description TEXT,
        parent_topic_id INTEGER,
        FOREIGN KEY (parent_topic_id) REFERENCES topics(id) ON DELETE SET NULL
      )
    `);

    // Source-topic relationships
    this.db.run(`
      CREATE TABLE IF NOT EXISTS source_topics (
        source_id INTEGER NOT NULL,
        topic_id INTEGER NOT NULL,
        relevance_score REAL DEFAULT 0.5,
        extracted_at TEXT,
        PRIMARY KEY (source_id, topic_id),
        FOREIGN KEY (source_id) REFERENCES content_sources(id) ON DELETE CASCADE,
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
      )
    `);

    // Channels (YouTube specific)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS channels (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        channel_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        last_checked TEXT,
        check_frequency TEXT DEFAULT 'weekly' CHECK(check_frequency IN ('daily', 'weekly', 'monthly')),
        active INTEGER DEFAULT 1
      )
    `);

    // Indexes for performance
    this.db.run('CREATE INDEX IF NOT EXISTS idx_content_type ON content_sources(type)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_content_published ON content_sources(published_date)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_segments_source ON segments(source_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_topics_category ON topics(category)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_source_topics_relevance ON source_topics(relevance_score)');
  }

  // ============================================================================
  // Content Sources
  // ============================================================================

  insertContentSource(source: ContentSource): number {
    const result = this.db.run(`
      INSERT INTO content_sources
      (type, title, url, author, published_date, duration_seconds, content_path, transcript_path, indexed_at, last_updated, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'), ?)
    `, [
      source.type,
      source.title,
      source.url || null,
      source.author || null,
      source.published_date || null,
      source.duration_seconds || null,
      source.content_path || null,
      source.transcript_path || null,
      source.metadata ? JSON.stringify(source.metadata) : null
    ]);

    return Number(result.lastInsertRowid);
  }

  getContentSource(id: number): ContentSource | null {
    const row = this.db.query('SELECT * FROM content_sources WHERE id = ?').get(id) as any;
    if (!row) return null;

    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    };
  }

  getAllContentSources(type?: string): ContentSource[] {
    const query = type
      ? 'SELECT * FROM content_sources WHERE type = ? ORDER BY published_date DESC'
      : 'SELECT * FROM content_sources ORDER BY published_date DESC';

    const rows = type
      ? this.db.query(query).all(type) as any[]
      : this.db.query(query).all() as any[];

    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  // ============================================================================
  // Segments
  // ============================================================================

  insertSegment(segment: Segment): number {
    const result = this.db.run(`
      INSERT INTO segments
      (source_id, segment_index, timestamp_start, timestamp_end, text, embedding_path)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [
      segment.source_id,
      segment.segment_index,
      segment.timestamp_start || null,
      segment.timestamp_end || null,
      segment.text,
      segment.embedding_path || null
    ]);

    return Number(result.lastInsertRowid);
  }

  getSegmentsBySource(sourceId: number): Segment[] {
    return this.db.query('SELECT * FROM segments WHERE source_id = ? ORDER BY segment_index').all(sourceId) as Segment[];
  }

  // ============================================================================
  // Topics
  // ============================================================================

  insertTopic(topic: Topic): number {
    try {
      const result = this.db.run(`
        INSERT INTO topics (name, category, description, parent_topic_id)
        VALUES (?, ?, ?, ?)
      `, [
        topic.name,
        topic.category || null,
        topic.description || null,
        topic.parent_topic_id || null
      ]);

      return Number(result.lastInsertRowid);
    } catch (error: any) {
      // If topic already exists, return existing ID
      if (error.message?.includes('UNIQUE constraint')) {
        const existing = this.db.query('SELECT id FROM topics WHERE name = ?').get(topic.name) as { id: number };
        return existing.id;
      }
      throw error;
    }
  }

  getTopic(id: number): Topic | null {
    return this.db.query('SELECT * FROM topics WHERE id = ?').get(id) as Topic | null;
  }

  getTopicByName(name: string): Topic | null {
    return this.db.query('SELECT * FROM topics WHERE name = ?').get(name) as Topic | null;
  }

  getAllTopics(): Topic[] {
    return this.db.query('SELECT * FROM topics ORDER BY name').all() as Topic[];
  }

  // ============================================================================
  // Source-Topic Relationships
  // ============================================================================

  linkSourceToTopic(sourceId: number, topicId: number, relevanceScore: number = 0.5): void {
    this.db.run(`
      INSERT OR REPLACE INTO source_topics (source_id, topic_id, relevance_score, extracted_at)
      VALUES (?, ?, ?, datetime('now'))
    `, [sourceId, topicId, relevanceScore]);
  }

  getTopicsForSource(sourceId: number): Array<Topic & { relevance_score: number }> {
    return this.db.query(`
      SELECT t.*, st.relevance_score
      FROM topics t
      JOIN source_topics st ON t.id = st.topic_id
      WHERE st.source_id = ?
      ORDER BY st.relevance_score DESC
    `).all(sourceId) as Array<Topic & { relevance_score: number }>;
  }

  getSourcesForTopic(topicId: number): ContentSource[] {
    const rows = this.db.query(`
      SELECT cs.*
      FROM content_sources cs
      JOIN source_topics st ON cs.id = st.source_id
      WHERE st.topic_id = ?
      ORDER BY st.relevance_score DESC
    `).all(topicId) as any[];

    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined
    }));
  }

  // ============================================================================
  // Channels
  // ============================================================================

  insertChannel(channel: Channel): number {
    try {
      const result = this.db.run(`
        INSERT INTO channels (channel_id, name, url, check_frequency, active)
        VALUES (?, ?, ?, ?, ?)
      `, [
        channel.channel_id,
        channel.name,
        channel.url,
        channel.check_frequency || 'weekly',
        channel.active !== false ? 1 : 0
      ]);

      return Number(result.lastInsertRowid);
    } catch (error: any) {
      // If channel already exists, return existing ID
      if (error.message?.includes('UNIQUE constraint')) {
        const existing = this.db.query('SELECT id FROM channels WHERE channel_id = ?').get(channel.channel_id) as { id: number };
        return existing.id;
      }
      throw error;
    }
  }

  getChannel(id: number): Channel | null {
    const row = this.db.query('SELECT * FROM channels WHERE id = ?').get(id) as any;
    if (!row) return null;
    return { ...row, active: Boolean(row.active) };
  }

  getAllChannels(activeOnly: boolean = true): Channel[] {
    const query = activeOnly
      ? 'SELECT * FROM channels WHERE active = 1 ORDER BY name'
      : 'SELECT * FROM channels ORDER BY name';

    const rows = this.db.query(query).all() as any[];
    return rows.map(row => ({ ...row, active: Boolean(row.active) }));
  }

  updateChannelLastChecked(channelId: string): void {
    this.db.run(`
      UPDATE channels SET last_checked = datetime('now') WHERE channel_id = ?
    `, [channelId]);
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  getStats(): {
    totalSources: number;
    totalSegments: number;
    totalTopics: number;
    totalChannels: number;
    byType: Record<string, number>;
  } {
    const totalSources = (this.db.query('SELECT COUNT(*) as count FROM content_sources').get() as { count: number }).count;
    const totalSegments = (this.db.query('SELECT COUNT(*) as count FROM segments').get() as { count: number }).count;
    const totalTopics = (this.db.query('SELECT COUNT(*) as count FROM topics').get() as { count: number }).count;
    const totalChannels = (this.db.query('SELECT COUNT(*) as count FROM channels WHERE active = 1').get() as { count: number }).count;

    const byTypeRows = this.db.query('SELECT type, COUNT(*) as count FROM content_sources GROUP BY type').all() as Array<{ type: string; count: number }>;
    const byType: Record<string, number> = {};
    byTypeRows.forEach(row => {
      byType[row.type] = row.count;
    });

    return {
      totalSources,
      totalSegments,
      totalTopics,
      totalChannels,
      byType
    };
  }

  // ============================================================================
  // Utility
  // ============================================================================

  close(): void {
    this.db.close();
  }

  clear(): void {
    this.db.run('DELETE FROM source_topics');
    this.db.run('DELETE FROM segments');
    this.db.run('DELETE FROM content_sources');
    this.db.run('DELETE FROM topics');
    this.db.run('DELETE FROM channels');
  }
}

// Export singleton instance
export const knowledgeDb = new KnowledgeDatabase();
