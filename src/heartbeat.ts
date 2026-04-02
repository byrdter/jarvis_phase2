/**
 * JARVIS Heartbeat Scheduler - EDUCATIONAL STUB
 *
 * ⚠️ THIS IS A TEMPLATE - YOU MUST IMPLEMENT YOUR OWN LOGIC
 *
 * This file shows the STRUCTURE of the heartbeat system we built,
 * but you need to implement the actual task logic for your domain.
 *
 * DESIGN PHILOSOPHY:
 * - CLI-first: Use Claude CLI for most tasks (free with Pro)
 * - Context-aware: Query memory search for vault context
 * - Proactive: Monitor your domain automatically
 * - Cost-conscious: Track every operation
 * - Resilient: Survive restarts, handle failures
 *
 * EXAMPLE SCHEDULED TASKS (Investment Domain):
 * - Daily (9am): ETF screening + market analysis
 * - Daily (4pm): Portfolio check + stop loss monitoring
 * - Weekly (Mon 9am): Performance review
 * - Monthly (1st, 9am): Deep analysis
 * - Hourly: Check for new content
 *
 * YOUR TASKS WILL BE DIFFERENT - customize for your domain!
 */

import { CronJob } from 'cron';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { Database } from 'bun:sqlite';

// ============================================================================
// TYPES - These show the data structures we used
// ============================================================================

interface Task {
  id: string;
  name: string;
  schedule: string; // Cron format (e.g., "0 9 * * *" = 9am daily)
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  failCount: number;
  avgDuration: number;
}

interface TaskExecution {
  taskId: string;
  timestamp: Date;
  duration: number;
  success: boolean;
  output?: string;
  error?: string;
  cost?: number;
}

// ============================================================================
// DATABASE SETUP - SQLite for execution tracking
// ============================================================================

const DB_PATH = join(process.cwd(), 'data', 'heartbeat.db');

// Ensure data directory exists
if (!existsSync(join(process.cwd(), 'data'))) {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
}

const db = new Database(DB_PATH);

// Create tables for tracking
db.run(`
  CREATE TABLE IF NOT EXISTS task_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    duration_ms INTEGER,
    success BOOLEAN,
    output TEXT,
    error TEXT,
    cost_usd REAL DEFAULT 0
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS task_config (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    schedule TEXT NOT NULL,
    enabled BOOLEAN DEFAULT 1,
    last_run DATETIME,
    run_count INTEGER DEFAULT 0,
    fail_count INTEGER DEFAULT 0,
    avg_duration_ms INTEGER DEFAULT 0
  )
`);

// ============================================================================
// TASK DEFINITIONS - CUSTOMIZE THESE FOR YOUR DOMAIN
// ============================================================================

/**
 * ⚠️ TODO: Define your own tasks
 *
 * Each task needs:
 * - id: Unique identifier
 * - name: Human-readable name
 * - schedule: Cron format string
 * - enabled: Boolean flag
 * - execute: Async function that does the work
 *
 * EXAMPLE (from our investment domain):
 */
const TASKS: Task[] = [
  {
    id: 'example-daily-task',
    name: 'Example Daily Task',
    schedule: '0 9 * * *', // 9am daily
    enabled: true,
    runCount: 0,
    failCount: 0,
    avgDuration: 0,
  },
  // Add your tasks here
];

// ============================================================================
// TASK EXECUTION LOGIC - IMPLEMENT YOUR OWN
// ============================================================================

/**
 * Execute a specific task
 *
 * ⚠️ TODO: Implement your task execution logic
 *
 * Our approach:
 * 1. Query memory search for relevant context
 * 2. Call Claude CLI with context + task prompt
 * 3. Parse output and save results
 * 4. Log execution to database
 * 5. Update task statistics
 */
async function executeTask(task: Task): Promise<TaskExecution> {
  const startTime = Date.now();

  try {
    console.log(`[Heartbeat] Starting task: ${task.name}`);

    // TODO: Your task logic goes here
    // Example steps:
    // 1. Get context from memory search
    // 2. Prepare prompt/data
    // 3. Execute via CLI or API
    // 4. Process results
    // 5. Save output

    const output = `STUB: Task ${task.id} would run here. Implement your logic!`;

    const duration = Date.now() - startTime;

    // Log successful execution
    logExecution({
      taskId: task.id,
      timestamp: new Date(),
      duration,
      success: true,
      output,
      cost: 0, // Track API costs if using paid APIs
    });

    // Update task stats
    updateTaskStats(task.id, true, duration);

    return {
      taskId: task.id,
      timestamp: new Date(),
      duration,
      success: true,
      output,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log failed execution
    logExecution({
      taskId: task.id,
      timestamp: new Date(),
      duration,
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });

    // Update task stats
    updateTaskStats(task.id, false, duration);

    throw error;
  }
}

// ============================================================================
// DATABASE HELPERS - These are complete, use as-is
// ============================================================================

function logExecution(execution: TaskExecution): void {
  db.run(
    `INSERT INTO task_executions (task_id, timestamp, duration_ms, success, output, error, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      execution.taskId,
      execution.timestamp.toISOString(),
      execution.duration,
      execution.success ? 1 : 0,
      execution.output || null,
      execution.error || null,
      execution.cost || 0,
    ]
  );
}

function updateTaskStats(taskId: string, success: boolean, duration: number): void {
  const task = db
    .query('SELECT * FROM task_config WHERE id = ?')
    .get(taskId) as any;

  if (!task) {
    // Initialize task config
    db.run(
      `INSERT INTO task_config (id, name, schedule, enabled, run_count, fail_count, avg_duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [taskId, taskId, '0 0 * * *', 1, 1, success ? 0 : 1, duration]
    );
  } else {
    const newRunCount = task.run_count + 1;
    const newFailCount = success ? task.fail_count : task.fail_count + 1;
    const newAvgDuration = Math.round(
      (task.avg_duration_ms * task.run_count + duration) / newRunCount
    );

    db.run(
      `UPDATE task_config
       SET run_count = ?, fail_count = ?, avg_duration_ms = ?, last_run = ?
       WHERE id = ?`,
      [newRunCount, newFailCount, newAvgDuration, new Date().toISOString(), taskId]
    );
  }
}

function getTaskStats(taskId: string): any {
  return db.query('SELECT * FROM task_config WHERE id = ?').get(taskId);
}

function getRecentExecutions(taskId: string, limit: number = 10): any[] {
  return db
    .query(
      `SELECT * FROM task_executions
       WHERE task_id = ?
       ORDER BY timestamp DESC
       LIMIT ?`
    )
    .all(taskId, limit) as any[];
}

// ============================================================================
// SCHEDULER - Cron job setup
// ============================================================================

/**
 * ⚠️ TODO: Customize scheduler for your tasks
 */
const jobs: CronJob[] = [];

export function startHeartbeat(): void {
  console.log('[Heartbeat] Starting scheduler...');

  for (const task of TASKS) {
    if (!task.enabled) {
      console.log(`[Heartbeat] Skipping disabled task: ${task.name}`);
      continue;
    }

    const job = new CronJob(task.schedule, async () => {
      try {
        await executeTask(task);
      } catch (error) {
        console.error(`[Heartbeat] Task failed: ${task.name}`, error);
      }
    });

    job.start();
    jobs.push(job);

    console.log(`[Heartbeat] Scheduled: ${task.name} (${task.schedule})`);
  }

  console.log(`[Heartbeat] ${jobs.length} tasks scheduled`);
}

export function stopHeartbeat(): void {
  console.log('[Heartbeat] Stopping scheduler...');
  for (const job of jobs) {
    job.stop();
  }
  jobs.length = 0;
  console.log('[Heartbeat] Scheduler stopped');
}

// ============================================================================
// EXPORTS
// ============================================================================

export { executeTask, getTaskStats, getRecentExecutions, TASKS };

// ============================================================================
// USAGE EXAMPLE
// ============================================================================

/**
 * To use this in your application:
 *
 * 1. Define your tasks in TASKS array
 * 2. Implement executeTask logic for each task type
 * 3. Start the heartbeat:
 *
 *    import { startHeartbeat } from './heartbeat';
 *    startHeartbeat();
 *
 * 4. For OS-level persistence (survives reboots):
 *    - macOS: Create LaunchAgent plist file
 *    - Linux: Create systemd service file
 *    See PHASE-2D-COMPLETE.md for details
 */
