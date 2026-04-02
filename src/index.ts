/**
 * JARVIS Main Entry Point
 *
 * Registers and starts all scheduled tasks
 */

import { heartbeat } from './heartbeat';
import * as tasks from './tasks';

console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                                                                   ║
║     ▐▄▄▄        ▄▄▄  ▄▄▄   ▐▌  ▪  .▄▄ ·                          ║
║      ·██   ▄█▀▄ █▀▄ █▀▄  ·██  ██ ▐█ ▀.                          ║
║    ▪▄ ██ ▐█▌.▐▌▐▀▀▄▐▀▀▄  ▐█· ▐█·▄▀▀▀█▄                          ║
║    ▐▌▐█▌▐█▌.▐▌▐█•█▌▐█•█▌ ██. ▐█▌▐█▄▪▐█                          ║
║     ▀▀▀   ▀▀▀· .▀ ▀ .▀ ▀  ▀▀▀▀▀▀ ▀▀▀▀                           ║
║                                                                   ║
║            Just A Rather Very Intelligent System                 ║
║                                                                   ║
╚═══════════════════════════════════════════════════════════════════╝
`);

console.log('Phase 2: Autonomous Agent Layer\n');
console.log('━'.repeat(70));
console.log('Registering scheduled tasks...\n');

// ============================================================================
// Daily Tasks
// ============================================================================

heartbeat.registerTask(
  'morning-briefing',
  'Morning Briefing',
  '0 8 * * *', // 8:00 AM daily
  tasks.morningBriefing,
  true
);

heartbeat.registerTask(
  'etf-screening',
  'Daily ETF Screening',
  '0 9 * * *', // 9:00 AM daily
  tasks.dailyETFScreening,
  true
);

heartbeat.registerTask(
  'portfolio-check',
  'Daily Portfolio Check',
  '0 16 * * *', // 4:00 PM daily
  tasks.dailyPortfolioCheck,
  true
);

heartbeat.registerTask(
  'evening-summary',
  'Evening Summary',
  '0 20 * * *', // 8:00 PM daily
  tasks.eveningSummary,
  true
);

// ============================================================================
// Weekly Tasks
// ============================================================================

heartbeat.registerTask(
  'weekly-review',
  'Weekly Performance Review',
  '0 9 * * 1', // Monday 9:00 AM
  tasks.weeklyPerformanceReview,
  true
);

// ============================================================================
// Monthly Tasks
// ============================================================================

heartbeat.registerTask(
  'monthly-analysis',
  'Monthly Deep Analysis',
  '0 9 1 * *', // 1st of month, 9:00 AM
  tasks.monthlyDeepAnalysis,
  true
);

// ============================================================================
// Hourly Tasks (during market hours only)
// ============================================================================

heartbeat.registerTask(
  'video-check',
  'Chris Vermeulen Video Check',
  '0 * * * *', // Every hour
  tasks.hourlyVideoCheck,
  true
);

console.log('━'.repeat(70));
console.log('\n✅ All tasks registered\n');

// Start the heartbeat
heartbeat.start();

// Keep the process running
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT, shutting down gracefully...\n');
  heartbeat.stop();
  heartbeat.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM, shutting down gracefully...\n');
  heartbeat.stop();
  heartbeat.close();
  process.exit(0);
});

// Print status every 5 minutes
setInterval(() => {
  heartbeat.printStatus();
}, 5 * 60 * 1000);

console.log('💓 JARVIS is now running autonomously...\n');
console.log('Press Ctrl+C to stop.\n');
