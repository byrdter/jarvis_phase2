/**
 * JARVIS Vector Embeddings Service
 *
 * Local embeddings using Transformers.js (no API costs!)
 * Model: all-MiniLM-L6-v2 (384 dimensions, 23MB, very fast)
 *
 * Features:
 * - Runs entirely locally (no API calls)
 * - Fast inference (~50ms per document)
 * - Persistent caching
 * - Cosine similarity search
 */

import { pipeline, cos_sim } from '@xenova/transformers';
import { Database } from 'bun:sqlite';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';

export interface EmbeddingResult {
  path: string;
  embedding: number[];
  checksum: string;
  updated: Date;
}

export interface SimilarityResult {
  path: string;
  score: number;
  excerpt?: string;
}

export class EmbeddingService {
  private db: Database;
  private embedder: any = null;
  private modelLoaded: boolean = false;
  private vaultPath: string;

  constructor(dbPath: string, vaultPath: string) {
    this.vaultPath = vaultPath;
    this.db = new Database(dbPath);
    this.initDatabase();
  }

  /**
   * Initialize SQLite database for embeddings
   */
  private initDatabase(): void {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS embeddings (
        path TEXT PRIMARY KEY,
        embedding BLOB NOT NULL,
        checksum TEXT NOT NULL,
        updated TEXT NOT NULL,
        file_size INTEGER,
        file_modified TEXT
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_checksum ON embeddings(checksum)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_updated ON embeddings(updated)
    `);
  }

  /**
   * Load the embedding model (lazy loading)
   */
  private async loadModel(): Promise<void> {
    if (this.modelLoaded) return;

    console.log('📦 Loading embedding model (all-MiniLM-L6-v2)...');
    const startTime = Date.now();

    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    this.modelLoaded = true;
    const loadTime = Date.now() - startTime;
    console.log(`   ✅ Model loaded in ${loadTime}ms`);
  }

  /**
   * Generate embedding for a text
   */
  async embed(text: string): Promise<number[]> {
    await this.loadModel();

    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }

  /**
   * Calculate simple checksum for change detection
   */
  private checksum(content: string): string {
    // Simple hash - first 100 chars + length + last 100 chars
    const len = content.length;
    const start = content.substring(0, 100);
    const end = content.substring(Math.max(0, len - 100));
    return `${start}_${len}_${end}`;
  }

  /**
   * Index a single markdown file
   */
  async indexFile(filePath: string): Promise<boolean> {
    try {
      // Read file
      const content = readFileSync(filePath, 'utf-8');
      const stat = statSync(filePath);
      const checksum = this.checksum(content);

      // Check if already indexed and unchanged
      const existing = this.db.query(`
        SELECT checksum FROM embeddings WHERE path = ?
      `).get(filePath) as { checksum: string } | null;

      if (existing && existing.checksum === checksum) {
        return false; // Already indexed, no change
      }

      // Generate embedding
      const embedding = await this.embed(content);

      // Store in database
      const embeddingBlob = Buffer.from(new Float32Array(embedding).buffer);

      this.db.run(`
        INSERT OR REPLACE INTO embeddings
        (path, embedding, checksum, updated, file_size, file_modified)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        filePath,
        embeddingBlob,
        checksum,
        new Date().toISOString(),
        stat.size,
        stat.mtime.toISOString()
      ]);

      return true; // Newly indexed or updated
    } catch (error) {
      console.error(`❌ Failed to index ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Index multiple files
   */
  async indexFiles(filePaths: string[], showProgress: boolean = true): Promise<{
    indexed: number;
    skipped: number;
    failed: number;
  }> {
    let indexed = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];

      if (showProgress && i % 10 === 0) {
        console.log(`   Processing ${i + 1}/${filePaths.length}...`);
      }

      try {
        const wasIndexed = await this.indexFile(filePath);
        if (wasIndexed) {
          indexed++;
        } else {
          skipped++;
        }
      } catch (error) {
        failed++;
      }
    }

    return { indexed, skipped, failed };
  }

  /**
   * Search for similar documents using vector similarity
   */
  async search(query: string, topK: number = 10): Promise<SimilarityResult[]> {
    // Generate query embedding
    const queryEmbedding = await this.embed(query);

    // Get all embeddings from database
    const allEmbeddings = this.db.query(`
      SELECT path, embedding FROM embeddings
    `).all() as Array<{ path: string; embedding: Buffer }>;

    if (allEmbeddings.length === 0) {
      return [];
    }

    // Calculate cosine similarity for each
    const results: SimilarityResult[] = [];

    for (const row of allEmbeddings) {
      const embedding = new Float32Array(row.embedding.buffer);
      const score = this.cosineSimilarity(queryEmbedding, Array.from(embedding));

      results.push({
        path: row.path,
        score: score
      });
    }

    // Sort by score (descending) and return top K
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get index statistics
   */
  getStats(): {
    totalDocuments: number;
    totalSize: number;
    lastUpdated: Date | null;
  } {
    const stats = this.db.query(`
      SELECT
        COUNT(*) as count,
        SUM(file_size) as total_size,
        MAX(updated) as last_updated
      FROM embeddings
    `).get() as { count: number; total_size: number; last_updated: string };

    return {
      totalDocuments: stats.count || 0,
      totalSize: stats.total_size || 0,
      lastUpdated: stats.last_updated ? new Date(stats.last_updated) : null
    };
  }

  /**
   * Clear all embeddings
   */
  clear(): void {
    this.db.run('DELETE FROM embeddings');
  }

  /**
   * Close database
   */
  close(): void {
    this.db.close();
  }
}
