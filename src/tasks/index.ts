/**
 * JARVIS Scheduled Tasks
 *
 * All automated monitoring and analysis tasks
 *
 * COST: All tasks use CLI (FREE with Pro subscription)
 */

import { jarvis } from '../jarvis-brain';
import { memorySearch } from '../memory-search';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const VAULT_PATH = process.env.VAULT_PATH || join(process.env.HOME!, 'Obsidian');
const REPORTS_PATH = join(VAULT_PATH, 'JARVIS', 'Reports');

// Ensure reports directory exists
if (!existsSync(REPORTS_PATH)) {
  mkdirSync(REPORTS_PATH, { recursive: true });
}

/**
 * Daily ETF Screening (9:00 AM)
 *
 * Screen 14 ETFs for Stage 2 opportunities with news context
 * Uses: @etf-screener subagent + Memory search + CLI analysis + Yahoo Finance news
 * Cost: $0.00 (CLI)
 */
export async function dailyETFScreening(): Promise<string> {
  console.log('📊 Running daily ETF screening...');

  // Get context from previous analysis
  const previousAnalysis = await memorySearch.search({
    query: 'recent ETF screening top opportunities',
    maxResults: 3,
    useAI: false, // Fast keyword search
  });

  const context = previousAnalysis.length > 0
    ? `Previous analysis found: ${previousAnalysis.map(r => r.path).join(', ')}`
    : 'No previous analysis found';

  // Run ETF screening via CLI with @etf-screener subagent (FREE!)
  const prompt = `@etf-screener Run daily screening of 14 ETFs (SPY, QQQ, IWM, DIA, GLD, SLV, USO, UNG, TLT, HYG, EFA, EEM, FXI, VNQ).

For top 3 Stage 2 candidates:
1. Get technical analysis using: jarvis-price indicators SYMBOL --json
2. Get recent news using: jarvis-price news SYMBOL --count 3 --json
3. Assess if technical + fundamental context align

Previous context: ${context}

Generate a concise report with:
- Stage 2 rankings (A/B/C grades)
- Technical + News summary for top 3
- Any stage transitions to watch
- Overall market sentiment from news

Format for Obsidian with clear sections.`;

  const result = await jarvis.think({
    prompt,
    model: 'sonnet',
    preferCLI: true, // FREE!
  });

  // Save report to Obsidian
  const date = new Date().toISOString().split('T')[0];
  const reportPath = join(REPORTS_PATH, `ETF-Screening-${date}.md`);

  const report = `# ETF Screening Report - ${date}

Generated: ${new Date().toLocaleString()}

${result}

---
#jarvis #etf-screening #automated #technical-fundamental
`;

  writeFileSync(reportPath, report);

  return `ETF screening complete. Report saved to: ${reportPath}`;
}

/**
 * Daily Portfolio Check (4:00 PM)
 *
 * Check current positions, stops, performance with news monitoring
 * Uses: @portfolio-monitor subagent + Memory search + CLI analysis + Yahoo Finance news
 * Cost: $0.00 (CLI)
 */
export async function dailyPortfolioCheck(): Promise<string> {
  console.log('💼 Running daily portfolio check...');

  // Find latest portfolio snapshot
  const portfolioNotes = await memorySearch.search({
    query: 'current portfolio positions allocation',
    maxResults: 1,
    useAI: false,
  });

  const portfolioContext = portfolioNotes.length > 0
    ? portfolioNotes[0].excerpt
    : 'No portfolio snapshot found';

  const prompt = `@portfolio-monitor Perform daily 4 PM portfolio check.

Current Portfolio Context:
${portfolioContext}

For each position:
1. Get current technical status: jarvis-price indicators SYMBOL --json
2. Check for news affecting position: jarvis-price news SYMBOL --count 2 --json
3. Compare price to stop loss
4. Assess stage (still Stage 2 or transitioning?)

Generate status report with:
- 🟢 Healthy Stage 2 positions (HOLD)
- 🟡 Watch list (approaching stops or Stage 3 signs)
- 🔴 Action Required (stop violations or Stage 4)
- 📰 News impacts (any position affected by headlines?)
- Portfolio metrics (total P/L, risk exposure)

Format for Obsidian with clear action items.`;

  const result = await jarvis.think({
    prompt,
    model: 'sonnet',
    preferCLI: true,
  });

  // Save to daily note
  const date = new Date().toISOString().split('T')[0];
  const reportPath = join(REPORTS_PATH, `Portfolio-Check-${date}.md`);

  const report = `# Portfolio Check - ${date}

Generated: ${new Date().toLocaleString()}

${result}

---
#jarvis #portfolio #daily-check #automated #risk-management
`;

  writeFileSync(reportPath, report);

  return `Portfolio check complete. Report saved to: ${reportPath}`;
}

/**
 * Weekly Performance Review (Monday 9:00 AM)
 *
 * Review last week's performance and strategy
 * Uses: Memory search + CLI analysis
 * Cost: $0.00 (CLI)
 */
export async function weeklyPerformanceReview(): Promise<string> {
  console.log('📈 Running weekly performance review...');

  // Get last week's reports
  const lastWeek = await memorySearch.search({
    query: 'portfolio performance last week trades decisions',
    maxResults: 5,
    useAI: true, // Use AI ranking for relevance
  });

  const weekContext = lastWeek.map(r => `- ${r.path}: ${r.excerpt.substring(0, 100)}`).join('\n');

  const prompt = `Perform weekly performance review:

Last Week's Activity:
${weekContext}

Analyze:
1. Portfolio performance vs benchmarks
2. Trades executed (entries/exits)
3. Strategy adherence (Asset Revesting)
4. Lessons learned
5. Adjustments needed

Provide a comprehensive weekly summary.`;

  const result = await jarvis.think({
    prompt,
    model: 'sonnet',
    preferCLI: true,
  });

  // Save weekly report
  const date = new Date();
  const weekNumber = Math.ceil(date.getDate() / 7);
  const reportPath = join(REPORTS_PATH, `Weekly-Review-${date.getFullYear()}-W${weekNumber}.md`);

  const report = `# Weekly Performance Review - Week ${weekNumber}

Generated: ${new Date().toLocaleString()}

${result}

---
#jarvis #weekly-review #performance #automated
`;

  writeFileSync(reportPath, report);

  return `Weekly review complete. Report saved to: ${reportPath}`;
}

/**
 * Monthly Deep Analysis (1st of month, 9:00 AM)
 *
 * Comprehensive monthly analysis and strategy validation
 * Uses: Memory search + CLI analysis
 * Cost: $0.00 (CLI)
 */
export async function monthlyDeepAnalysis(): Promise<string> {
  console.log('🔍 Running monthly deep analysis...');

  // Get last month's data
  const lastMonth = await memorySearch.search({
    query: 'monthly performance portfolio trades strategy validation',
    maxResults: 10,
    useAI: true,
  });

  const monthContext = lastMonth.map(r => `- ${r.path}`).join('\n');

  const prompt = `Perform comprehensive monthly analysis:

Last Month's Context:
${monthContext}

Deep dive into:
1. Monthly performance (returns, drawdown, Sharpe)
2. Trade analysis (win rate, avg gain/loss)
3. Asset Revesting strategy validation
4. Risk management effectiveness
5. Market regime assessment
6. Adjustments for next month

Provide detailed monthly report with specific recommendations.`;

  const result = await jarvis.think({
    prompt,
    model: 'sonnet',
    preferCLI: true,
  });

  // Save monthly report
  const date = new Date();
  const month = date.toLocaleString('default', { month: 'long' });
  const reportPath = join(REPORTS_PATH, `Monthly-Analysis-${date.getFullYear()}-${month}.md`);

  const report = `# Monthly Deep Analysis - ${month} ${date.getFullYear()}

Generated: ${new Date().toLocaleString()}

${result}

---
#jarvis #monthly-analysis #strategy-validation #automated
`;

  writeFileSync(reportPath, report);

  return `Monthly analysis complete. Report saved to: ${reportPath}`;
}

/**
 * Hourly Video Check (Every hour during market hours)
 *
 * Check for new Chris Vermeulen videos
 * Uses: Existing Python script
 * Cost: $0.00
 */
export async function hourlyVideoCheck(): Promise<string> {
  console.log('🎥 Checking for new Chris Vermeulen videos...');

  // Run existing Python script
  const { spawn } = await import('child_process');

  return new Promise((resolve, reject) => {
    const scriptPath = join(process.cwd(), '..', 'skills', 'market-insights', 'check_new_videos.py');

    const python = spawn('python3', [scriptPath]);

    let output = '';
    let error = '';

    python.stdout?.on('data', (data) => {
      output += data.toString();
    });

    python.stderr?.on('data', (data) => {
      error += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        resolve(output.includes('New video') ? output : 'No new videos found');
      } else {
        reject(new Error(`Video check failed: ${error}`));
      }
    });
  });
}

/**
 * Morning Briefing (8:00 AM)
 *
 * Daily summary of overnight markets, news, and agenda
 * Uses: Memory search + CLI analysis
 * Cost: $0.00 (CLI)
 */
export async function morningBriefing(): Promise<string> {
  console.log('☀️ Generating morning briefing...');

  const prompt = `Generate a concise morning briefing:

1. Overnight market moves (futures, Asia, Europe)
2. Key economic events today
3. JARVIS agenda (scheduled tasks)
4. Portfolio status snapshot
5. Top focus areas for today

Format as a quick morning read (2-3 minutes).`;

  const result = await jarvis.think({
    prompt,
    model: 'haiku', // Use faster/cheaper Haiku for simple tasks
    preferCLI: true,
  });

  const date = new Date().toISOString().split('T')[0];
  const reportPath = join(REPORTS_PATH, `Morning-Briefing-${date}.md`);

  const report = `# Morning Briefing - ${date}

Generated: ${new Date().toLocaleString()}

${result}

---
#jarvis #morning-briefing #automated
`;

  writeFileSync(reportPath, report);

  return `Morning briefing ready: ${reportPath}`;
}

/**
 * Evening Summary (8:00 PM)
 *
 * End of day recap and preparation for tomorrow
 * Uses: Memory search + CLI analysis
 * Cost: $0.00 (CLI)
 */
export async function eveningSummary(): Promise<string> {
  console.log('🌙 Generating evening summary...');

  // Get today's activities
  const todayReports = await memorySearch.search({
    query: 'today JARVIS reports portfolio analysis',
    maxResults: 5,
    useAI: false,
  });

  const todayContext = todayReports.map(r => `- ${r.path}`).join('\n');

  const prompt = `Generate evening summary:

Today's Activity:
${todayContext}

Summarize:
1. Market performance today
2. JARVIS tasks completed
3. Portfolio changes (if any)
4. Key takeaways
5. Tomorrow's focus areas

Keep concise (2-3 minutes read).`;

  const result = await jarvis.think({
    prompt,
    model: 'haiku',
    preferCLI: true,
  });

  const date = new Date().toISOString().split('T')[0];
  const reportPath = join(REPORTS_PATH, `Evening-Summary-${date}.md`);

  const report = `# Evening Summary - ${date}

Generated: ${new Date().toLocaleString()}

${result}

---
#jarvis #evening-summary #automated
`;

  writeFileSync(reportPath, report);

  return `Evening summary ready: ${reportPath}`;
}
