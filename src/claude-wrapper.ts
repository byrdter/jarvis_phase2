/**
 * Claude Code CLI Wrapper
 *
 * Uses the Claude Code CLI programmatically to leverage subscription authentication.
 * This avoids API charges by using the installed CLI that's already authenticated
 * with your Claude Pro subscription.
 */

import { spawn } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface ClaudeQueryOptions {
  prompt: string;
  cwd?: string;
  model?: string;
  dangerMode?: boolean;
}

export class ClaudeWrapper {
  /**
   * Execute a Claude Code query using the CLI
   */
  async query(options: ClaudeQueryOptions): Promise<string> {
    const {
      prompt,
      cwd = process.cwd(),
      model = 'sonnet',
      dangerMode = true
    } = options;

    return new Promise((resolve, reject) => {
      const args = [
        '--prompt', prompt,
        '--model', model,
      ];

      if (dangerMode) {
        args.push('--dangerously-skip-permissions');
      }

      console.log(`🤖 Running: claude ${args.join(' ')}`);

      const claude = spawn('claude', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      claude.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        console.log(text);
      });

      claude.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude CLI exited with code ${code}\n${stderr}`));
        }
      });

      claude.on('error', (err) => {
        reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
      });
    });
  }

  /**
   * Execute a Claude Code query from a file (for complex prompts)
   */
  async queryFromFile(promptFile: string, options?: Omit<ClaudeQueryOptions, 'prompt'>): Promise<string> {
    return new Promise((resolve, reject) => {
      const {
        cwd = process.cwd(),
        model = 'sonnet',
        dangerMode = true
      } = options || {};

      const args = [
        '--prompt-file', promptFile,
        '--model', model,
      ];

      if (dangerMode) {
        args.push('--dangerously-skip-permissions');
      }

      const claude = spawn('claude', args, {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      claude.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        console.log(text);
      });

      claude.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      claude.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Claude CLI exited with code ${code}\n${stderr}`));
        }
      });

      claude.on('error', (err) => {
        reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
      });
    });
  }
}

export const claude = new ClaudeWrapper();
