/**
 * JARVIS Memory Search System
 *
 * Efficiently search and retrieve information from Obsidian vault
 *
 * APPROACH:
 * - Phase 2B: Hybrid Vector + Keyword Search
 * - 70% semantic similarity (vector embeddings, local, no API cost)
 * - 30% keyword matching (fast grep-style)
 * - Combines both for best results
 *
 * PERFORMANCE:
 * - Vector search: ~100-200ms (all local)
 * - Keyword search: ~50-100ms
 * - Hybrid merge: ~10ms
 * - Total: ~200-300ms per search
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { jarvis } from './jarvis-brain.FULL';
import { EmbeddingService } from './embeddings';

export interface SearchResult {
  path: string;
  score: number;
  excerpt: string;
  context: string;
  metadata?: {
    created?: Date;
    modified?: Date;
    tags?: string[];
    links?: string[];
  };
}

export interface SearchOptions {
  query: string;
  maxResults?: number;
  minScore?: number;
  searchPath?: string;
  includeArchived?: boolean;
  fileTypes?: string[];
  useAI?: boolean; // Default true, set false for faster keyword-only
}

export class MemorySearch {
  private vaultPath: string;
  private cacheEnabled: boolean;
  private cache: Map<string, { content: string; mtime: number }>;
  private embeddings: EmbeddingService;
  private useVectorSearch: boolean;

  constructor(vaultPath?: string, cacheEnabled: boolean = true, useVectorSearch: boolean = true) {
    this.vaultPath = vaultPath || process.env.VAULT_PATH || join(process.env.HOME!, 'Obsidian');
    this.cacheEnabled = cacheEnabled;
    this.cache = new Map();
    this.useVectorSearch = useVectorSearch;

    // Initialize embedding service
    const embeddingDbPath = process.env.MEMORY_DB_PATH || join(__dirname, '../data/embeddings.db');
    this.embeddings = new EmbeddingService(embeddingDbPath, this.vaultPath);
  }

  /**
   * Search Obsidian vault with hybrid vector + keyword search
   */
  async search(options: SearchOptions): Promise<SearchResult[]> {
    const {
      query,
      maxResults = 5,
      minScore = 0.5,
      searchPath = this.vaultPath,
      includeArchived = false,
      fileTypes = ['.md'],
      useAI = true
    } = options;

    console.log(`🔍 Searching vault for: "${query}"`);

    // Use hybrid vector + keyword search if enabled
    if (this.useVectorSearch) {
      return await this.hybridSearch(query, maxResults, minScore, searchPath, fileTypes, includeArchived);
    }

    // Fallback to keyword + AI ranking (old method)
    const candidates = await this.keywordFilter(query, searchPath, fileTypes, includeArchived);

    console.log(`   Found ${candidates.length} candidate files`);

    if (candidates.length === 0) {
      return [];
    }

    if (useAI) {
      return await this.aiRanking(query, candidates, maxResults, minScore);
    } else {
      return candidates.slice(0, maxResults).map((c, i) => ({
        path: c.path,
        score: 1 - (i / candidates.length),
        excerpt: c.content.substring(0, 200),
        context: '',
        metadata: c.metadata
      }));
    }
  }

  /**
   * Hybrid search: 70% vector similarity + 30% keyword matching
   */
  private async hybridSearch(
    query: string,
    maxResults: number,
    minScore: number,
    searchPath: string,
    fileTypes: string[],
    includeArchived: boolean
  ): Promise<SearchResult[]> {
    const startTime = Date.now();

    // Run vector and keyword searches in parallel
    const [vectorResults, keywordCandidates] = await Promise.all([
      this.embeddings.search(query, maxResults * 3), // Get more candidates
      this.keywordFilter(query, searchPath, fileTypes, includeArchived)
    ]);

    console.log(`   Vector: ${vectorResults.length} results, Keyword: ${keywordCandidates.length} candidates`);

    // Create score maps
    const vectorScores = new Map<string, number>();
    const keywordScores = new Map<string, number>();

    // Normalize vector scores
    vectorResults.forEach((result, index) => {
      vectorScores.set(result.path, result.score);
    });

    // Normalize keyword scores (based on rank)
    keywordCandidates.forEach((candidate, index) => {
      const score = 1 - (index / keywordCandidates.length);
      keywordScores.set(candidate.path, score);
    });

    // Combine scores: 70% vector + 30% keyword
    const combinedScores = new Map<string, number>();
    const allPaths = new Set([...vectorScores.keys(), ...keywordScores.keys()]);

    for (const path of allPaths) {
      const vectorScore = vectorScores.get(path) || 0;
      const keywordScore = keywordScores.get(path) || 0;
      const combinedScore = (vectorScore * 0.7) + (keywordScore * 0.3);

      if (combinedScore >= minScore) {
        combinedScores.set(path, combinedScore);
      }
    }

    // Sort by combined score
    const sortedResults = Array.from(combinedScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxResults);

    // Build final results with excerpts
    const results: SearchResult[] = sortedResults.map(([path, score]) => {
      // Path is already absolute from database
      const fullPath = path;
      const content = this.readFile(fullPath);
      const excerpt = this.extractRelevantExcerpt(content, query);

      return {
        path: relative(this.vaultPath, fullPath),
        score,
        excerpt,
        context: `Vector: ${(vectorScores.get(path) || 0).toFixed(2)}, Keyword: ${(keywordScores.get(path) || 0).toFixed(2)}`,
        metadata: this.extractMetadata(content, fullPath)
      };
    });

    const searchTime = Date.now() - startTime;
    console.log(`   ✅ Hybrid search completed in ${searchTime}ms (${results.length} results)`);

    return results;
  }

  /**
   * Extract relevant excerpt from document based on query
   */
  private extractRelevantExcerpt(content: string, query: string, maxLength: number = 200): string {
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    // Find the paragraph with most query words
    const paragraphs = content.split('\n\n');
    let bestParagraph = paragraphs[0] || '';
    let maxMatches = 0;

    for (const para of paragraphs) {
      const paraLower = para.toLowerCase();
      const matches = queryWords.filter(word => paraLower.includes(word)).length;

      if (matches > maxMatches) {
        maxMatches = matches;
        bestParagraph = para;
      }
    }

    // Clean and truncate
    const cleaned = bestParagraph.replace(/\n/g, ' ').trim();
    return cleaned.length > maxLength
      ? cleaned.substring(0, maxLength) + '...'
      : cleaned;
  }

  /**
   * Fast keyword filter using grep
   */
  private async keywordFilter(
    query: string,
    searchPath: string,
    fileTypes: string[],
    includeArchived: boolean
  ): Promise<Array<{ path: string; content: string; metadata: any }>> {
    const results: Array<{ path: string; content: string; metadata: any }> = [];

    // Extract keywords from query
    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length > 2);

    // Walk vault directory
    const files = this.walkDirectory(searchPath, fileTypes, includeArchived);

    for (const file of files) {
      const content = this.readFile(file);
      const contentLower = content.toLowerCase();

      // Check if any keyword matches
      const matches = keywords.filter(k => contentLower.includes(k));

      if (matches.length > 0) {
        results.push({
          path: file,
          content,
          metadata: this.extractMetadata(content, file)
        });
      }
    }

    // Sort by number of keyword matches
    return results.sort((a, b) => {
      const aMatches = keywords.filter(k => a.content.toLowerCase().includes(k)).length;
      const bMatches = keywords.filter(k => b.content.toLowerCase().includes(k)).length;
      return bMatches - aMatches;
    });
  }

  /**
   * AI-powered relevance ranking using Claude
   */
  private async aiRanking(
    query: string,
    candidates: Array<{ path: string; content: string; metadata: any }>,
    maxResults: number,
    minScore: number
  ): Promise<SearchResult[]> {
    // Prepare context for AI
    const candidateList = candidates.slice(0, 20).map((c, i) => {
      const preview = c.content.substring(0, 500).replace(/\n/g, ' ');
      return `[${i}] ${relative(this.vaultPath, c.path)}\n${preview}\n---`;
    }).join('\n\n');

    const prompt = `You are helping search an Obsidian knowledge vault.

USER QUERY: "${query}"

CANDIDATE NOTES (top 20 by keyword match):
${candidateList}

Analyze which notes are most relevant to answer the query. Return a JSON array of results, ordered by relevance.

For each relevant note (score >= ${minScore}), include:
{
  "index": <note index 0-19>,
  "score": <relevance 0.0-1.0>,
  "reason": "<why it's relevant in 1 sentence>",
  "key_excerpt": "<most relevant 1-2 sentences from the note>"
}

Return ONLY the JSON array, no other text. If no notes are relevant, return [].`;

    try {
      // Use CLI for AI ranking (FREE!)
      const response = await jarvis.think({
        prompt,
        model: 'sonnet',
        preferCLI: true, // FREE with Pro subscription
      });

      // Parse JSON response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn('⚠️  AI did not return valid JSON, falling back to keyword ranking');
        return this.fallbackRanking(candidates, maxResults);
      }

      const rankings = JSON.parse(jsonMatch[0]);

      // Convert to SearchResult format
      const results: SearchResult[] = rankings
        .filter((r: any) => r.score >= minScore)
        .slice(0, maxResults)
        .map((r: any) => {
          const candidate = candidates[r.index];
          return {
            path: relative(this.vaultPath, candidate.path),
            score: r.score,
            excerpt: r.key_excerpt || candidate.content.substring(0, 200),
            context: r.reason,
            metadata: candidate.metadata
          };
        });

      console.log(`   ✅ Ranked ${results.length} relevant results`);
      return results;

    } catch (error) {
      console.warn('⚠️  AI ranking failed, falling back to keyword ranking:', error);
      return this.fallbackRanking(candidates, maxResults);
    }
  }

  /**
   * Fallback to simple keyword ranking if AI fails
   */
  private fallbackRanking(
    candidates: Array<{ path: string; content: string; metadata: any }>,
    maxResults: number
  ): SearchResult[] {
    return candidates.slice(0, maxResults).map((c, i) => ({
      path: relative(this.vaultPath, c.path),
      score: 1 - (i / candidates.length),
      excerpt: c.content.substring(0, 200),
      context: 'Keyword match',
      metadata: c.metadata
    }));
  }

  /**
   * Walk directory recursively
   */
  private walkDirectory(dir: string, fileTypes: string[], includeArchived: boolean): string[] {
    const files: string[] = [];

    try {
      const entries = readdirSync(dir);

      for (const entry of entries) {
        const fullPath = join(dir, entry);

        // Skip archived if not included
        if (!includeArchived && (entry === 'Archive' || entry === '.archive')) {
          continue;
        }

        // Skip hidden files/folders
        if (entry.startsWith('.') && entry !== '.') {
          continue;
        }

        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          files.push(...this.walkDirectory(fullPath, fileTypes, includeArchived));
        } else if (stat.isFile()) {
          const hasValidType = fileTypes.some(ext => entry.endsWith(ext));
          if (hasValidType) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️  Could not read directory ${dir}:`, error);
    }

    return files;
  }

  /**
   * Read file with caching
   */
  private readFile(path: string): string {
    try {
      // Check cache
      if (this.cacheEnabled && this.cache.has(path)) {
        const cached = this.cache.get(path)!;
        const stat = statSync(path);

        // Return cached if not modified
        if (stat.mtimeMs === cached.mtime) {
          return cached.content;
        }
      }

      // Read from disk
      const content = readFileSync(path, 'utf-8');

      // Update cache
      if (this.cacheEnabled) {
        const stat = statSync(path);
        this.cache.set(path, { content, mtime: stat.mtimeMs });
      }

      return content;
    } catch (error) {
      console.warn(`⚠️  Could not read file ${path}:`, error);
      return '';
    }
  }

  /**
   * Extract metadata from Obsidian note
   */
  private extractMetadata(content: string, path: string): any {
    const metadata: any = {};

    // Extract frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];

      // Parse YAML-like frontmatter (simple version)
      const lines = frontmatter.split('\n');
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length > 0) {
          const value = valueParts.join(':').trim();
          metadata[key.trim()] = value;
        }
      }
    }

    // Extract tags
    const tagMatches = content.match(/#[\w-]+/g);
    if (tagMatches) {
      metadata.tags = [...new Set(tagMatches)];
    }

    // Extract wikilinks
    const linkMatches = content.match(/\[\[([^\]]+)\]\]/g);
    if (linkMatches) {
      metadata.links = linkMatches.map(l => l.slice(2, -2));
    }

    // File stats
    try {
      const stat = statSync(path);
      metadata.created = stat.birthtime;
      metadata.modified = stat.mtime;
    } catch (error) {
      // Ignore
    }

    return metadata;
  }

  /**
   * Index entire vault for vector search
   */
  async indexVault(showProgress: boolean = true): Promise<{
    indexed: number;
    skipped: number;
    failed: number;
  }> {
    if (showProgress) {
      console.log('📚 Indexing vault for vector search...');
    }

    // Get all markdown files
    const files = this.walkDirectory(this.vaultPath, ['.md'], false);

    if (showProgress) {
      console.log(`   Found ${files.length} markdown files`);
    }

    // Index with embeddings
    const result = await this.embeddings.indexFiles(files, showProgress);

    if (showProgress) {
      console.log(`   ✅ Indexed ${result.indexed} files, skipped ${result.skipped}, failed ${result.failed}`);
    }

    return result;
  }

  /**
   * Get vault and index statistics
   */
  getVaultStats(): {
    totalNotes: number;
    totalSize: number;
    folders: number;
    tags: Set<string>;
    indexed: {
      totalDocuments: number;
      totalSize: number;
      lastUpdated: Date | null;
    };
  } {
    const files = this.walkDirectory(this.vaultPath, ['.md'], true);
    const tags = new Set<string>();
    let totalSize = 0;
    const folders = new Set<string>();

    for (const file of files) {
      try {
        const stat = statSync(file);
        totalSize += stat.size;

        const content = this.readFile(file);
        const fileTags = content.match(/#[\w-]+/g);
        if (fileTags) {
          fileTags.forEach(tag => tags.add(tag));
        }

        const dir = file.substring(0, file.lastIndexOf('/'));
        folders.add(dir);
      } catch (error) {
        // Ignore
      }
    }

    return {
      totalNotes: files.length,
      totalSize,
      folders: folders.size,
      tags,
      indexed: this.embeddings.getStats()
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const memorySearch = new MemorySearch();
