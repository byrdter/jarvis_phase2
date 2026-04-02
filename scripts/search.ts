/**
 * JARVIS Memory Search CLI
 *
 * Quick command-line interface for searching Obsidian vault
 *
 * Usage:
 *   bun run search "investment strategy"
 *   bun run search "market analysis" --fast
 *   bun run search "portfolio" --max-results 10
 */

import { memorySearch } from '../src/memory-search';

const args = process.argv.slice(2);

if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(`
🔍 JARVIS Memory Search

Usage:
  bun run search "your query"
  bun run search "your query" [options]

Options:
  --fast              Keyword-only search (no AI ranking, faster)
  --max-results N     Maximum results to return (default: 5)
  --min-score N       Minimum relevance score 0.0-1.0 (default: 0.5)
  --no-archived       Exclude archived notes
  --stats             Show vault statistics only

Examples:
  bun run search "investment strategy"
  bun run search "market analysis" --fast
  bun run search "portfolio risk" --max-results 10 --min-score 0.7
  bun run search --stats
  `);
  process.exit(0);
}

async function main() {
  try {
    // Parse arguments
    const query = args.find(a => !a.startsWith('--')) || '';
    const fast = args.includes('--fast');
    const showStats = args.includes('--stats');
    const maxResults = parseInt(args[args.indexOf('--max-results') + 1] || '5');
    const minScore = parseFloat(args[args.indexOf('--min-score') + 1] || '0.5');
    const includeArchived = !args.includes('--no-archived');

    // Show stats only
    if (showStats) {
      console.log('\n📊 Vault Statistics\n');
      const stats = memorySearch.getVaultStats();
      console.log(`Total Notes:  ${stats.totalNotes}`);
      console.log(`Total Size:   ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Folders:      ${stats.folders}`);
      console.log(`Unique Tags:  ${stats.tags.size}`);
      console.log('');
      console.log('Vector Index:');
      console.log(`  Indexed:    ${stats.indexed.totalDocuments} documents`);
      console.log(`  Coverage:   ${((stats.indexed.totalDocuments / stats.totalNotes) * 100).toFixed(1)}%`);
      if (stats.indexed.lastUpdated) {
        console.log(`  Updated:    ${stats.indexed.lastUpdated.toLocaleString()}`);
      }

      if (stats.tags.size > 0) {
        console.log(`\nTop 20 Tags:`);
        Array.from(stats.tags)
          .slice(0, 20)
          .forEach(tag => console.log(`  ${tag}`));
      }

      console.log('\n💡 To re-index vault: bun run scripts/index-vault.ts');
      console.log();
      return;
    }

    if (!query) {
      console.error('❌ Error: Please provide a search query');
      process.exit(1);
    }

    // Perform search
    console.log(`🔍 Searching for: "${query}"\n`);

    const results = await memorySearch.search({
      query,
      maxResults,
      minScore,
      includeArchived,
      useAI: !fast,
    });

    // Display results
    if (results.length === 0) {
      console.log('No results found.\n');
      return;
    }

    console.log(`📝 Found ${results.length} result(s):\n`);

    results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.path}`);
      console.log(`   Relevance: ${(r.score * 100).toFixed(0)}%`);

      if (r.context) {
        console.log(`   Context: ${r.context}`);
      }

      console.log(`   Excerpt: "${r.excerpt.substring(0, 150)}${r.excerpt.length > 150 ? '...' : ''}"`);

      if (r.metadata?.tags && r.metadata.tags.length > 0) {
        console.log(`   Tags: ${r.metadata.tags.join(', ')}`);
      }

      if (r.metadata?.modified) {
        const daysAgo = Math.floor((Date.now() - new Date(r.metadata.modified).getTime()) / (1000 * 60 * 60 * 24));
        console.log(`   Modified: ${daysAgo} days ago`);
      }

      console.log();
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
