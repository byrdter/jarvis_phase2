/**
 * Show JARVIS Heartbeat Status
 *
 * Usage:
 *   bun run heartbeat:status
 */

import { heartbeat } from '../src/heartbeat';

heartbeat.printStatus();
heartbeat.close();
