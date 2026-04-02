#!/usr/bin/env bun
/**
 * Index Obsidian vault for vector search
 *
 * Usage:
 *   bun run scripts/index-vault.ts
 */

import { MemorySearch } from '../src/memory-search';

async function main() {
  console.log('='.repeat(60));
  console.log('JARVIS Vector Index Builder');
  console.log('='.repeat(60));
  console.log('');

  const search = new MemorySearch();

  // Get current stats
  console.log('📊 Current vault statistics:');
  const statsBefore = search.getVaultStats();
  console.log(`   Total notes: ${statsBefore.totalNotes}`);
  console.log(`   Total size: ${(statsBefore.totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Folders: ${statsBefore.folders}`);
  console.log(`   Tags: ${statsBefore.tags.size}`);
  console.log('');
  console.log(`   Currently indexed: ${statsBefore.indexed.totalDocuments} documents`);
  if (statsBefore.indexed.lastUpdated) {
    console.log(`   Last updated: ${statsBefore.indexed.lastUpdated.toLocaleString()}`);
  }
  console.log('');

  // Index vault
  const startTime = Date.now();
  const result = await search.indexVault(true);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ Indexing complete!');
  console.log('='.repeat(60));
  console.log(`   Duration: ${duration} seconds`);
  console.log(`   Indexed: ${result.indexed} files`);
  console.log(`   Skipped: ${result.skipped} files (no changes)`);
  console.log(`   Failed: ${result.failed} files`);
  console.log('');

  // Show updated stats
  const statsAfter = search.getVaultStats();
  console.log('📊 Updated vault statistics:');
  console.log(`   Indexed documents: ${statsAfter.indexed.totalDocuments}`);
  console.log(`   Coverage: ${((statsAfter.indexed.totalDocuments / statsAfter.totalNotes) * 100).toFixed(1)}%`);
  console.log('');

  console.log('💡 Next steps:');
  console.log('   • Test search: bun run search "your query"');
  console.log('   • Re-index anytime: bun run scripts/index-vault.ts');
  console.log('');
}

main().catch(console.error);
