/**
 * Claude Agent SDK Client Configuration
 *
 * This replicates Cole's approach: use CLAUDE_TOKEN (subscription token)
 * instead of ANTHROPIC_API_KEY to avoid per-call API charges.
 */

import 'dotenv/config';
import { query, ClaudeAgentOptions } from '@anthropic-ai/claude-agent-sdk';

/**
 * Initialize Claude subscription token
 *
 * Cole's modification: Read CLAUDE_TOKEN and set it as ANTHROPIC_API_KEY
 * so the SDK picks it up automatically.
 */
function initializeAuth(): void {
  // Read CLAUDE_TOKEN from environment
  const claudeToken = process.env.CLAUDE_TOKEN;

  if (!claudeToken) {
    throw new Error(
      'CLAUDE_TOKEN environment variable not set.\n' +
      'Run: claude setup-token\n' +
      'Then set CLAUDE_TOKEN in your .env file'
    );
  }

  // THIS IS THE KEY: Set CLAUDE_TOKEN as ANTHROPIC_API_KEY
  // The SDK reads ANTHROPIC_API_KEY internally, so we override it
  process.env.ANTHROPIC_API_KEY = claudeToken;

  console.log('✅ Using Claude subscription token (no API charges)');
}

/**
 * Create a Claude Agent SDK query with subscription authentication
 */
export async function* claudeQuery(
  prompt: string,
  options?: ClaudeAgentOptions
) {
  // Initialize auth before querying
  initializeAuth();

  // Execute query - SDK will use ANTHROPIC_API_KEY (which we set to CLAUDE_TOKEN)
  yield* query({
    prompt,
    options: {
      model: 'claude-sonnet-4-5-20250929',
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'],
      ...options
    }
  });
}

/**
 * Simple wrapper for one-off queries
 */
export async function askClaude(prompt: string, options?: ClaudeAgentOptions): Promise<string> {
  initializeAuth();

  let result = '';

  for await (const message of query({ prompt, options })) {
    if ('result' in message) {
      result = message.result;
    } else if ('type' in message && message.type === 'text') {
      result += message.text;
    }
  }

  return result;
}
