/**
 * JARVIS Brain - Agent Orchestration - EDUCATIONAL STUB
 *
 * ⚠️ THIS IS A TEMPLATE - YOU MUST IMPLEMENT YOUR OWN LOGIC
 *
 * This file shows the STRUCTURE of how we orchestrate different agents,
 * but you need to implement the actual agent logic and prompts for your domain.
 *
 * DESIGN PHILOSOPHY:
 * - Specialized agents > General-purpose agents (3-5x more efficient)
 * - Each agent has focused expertise and context
 * - Agents can call other agents for complex tasks
 * - All interactions logged for learning and debugging
 *
 * EXAMPLE AGENTS (Investment Domain):
 * - @etf-screener: Analyzes ETFs using Asset Revesting
 * - @portfolio-monitor: Tracks positions and stops
 * - @market-analyst: Deep market research
 *
 * YOUR AGENTS WILL BE DIFFERENT - customize for your domain!
 */

import { memorySearch } from './memory-search';

// ============================================================================
// TYPES - Agent interface and message structures
// ============================================================================

interface Agent {
  name: string;
  description: string;
  systemPrompt: string;
  maxTokens: number;
  temperature: number;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AgentResponse {
  agent: string;
  response: string;
  tokensUsed: number;
  cost: number;
  duration: number;
  timestamp: Date;
}

// ============================================================================
// AGENT DEFINITIONS - CUSTOMIZE FOR YOUR DOMAIN
// ============================================================================

/**
 * ⚠️ TODO: Define your specialized agents
 *
 * Each agent should:
 * - Have a focused expertise area
 * - Load only relevant context
 * - Use domain-specific system prompts
 * - Be optimized for efficiency (fewer tokens = lower cost)
 *
 * EXAMPLE (from our investment domain):
 */
const AGENTS: Record<string, Agent> = {
  'example-agent': {
    name: 'Example Agent',
    description: 'An example agent to show structure',
    systemPrompt: `You are an example agent.

Your role: [Define the agent's specific responsibility]
Your expertise: [Define the domain knowledge]
Your constraints: [Define any limitations or rules]

When responding:
1. [Step or guideline]
2. [Step or guideline]
3. [Step or guideline]

Output format: [Describe expected output format]
`,
    maxTokens: 4000,
    temperature: 0.3,
  },
  // Add your agents here
};

// ============================================================================
// MEMORY-ENHANCED PROMPTING - Context from your vault
// ============================================================================

/**
 * Get relevant context from memory search before calling agent
 *
 * This is one of the key efficiency improvements:
 * - Don't load entire vault
 * - Search for relevant context only
 * - Reduces token usage significantly
 */
async function getRelevantContext(query: string, limit: number = 5): Promise<string> {
  try {
    // Use memory search to find relevant vault content
    const results = await memorySearch(query, {
      minScore: 0.3,
      limit,
      includeContent: true,
    });

    if (results.length === 0) {
      return 'No relevant context found in vault.';
    }

    // Format results for agent context
    let context = '=== Relevant Context from Your Vault ===\n\n';
    for (const result of results) {
      context += `File: ${result.path}\n`;
      context += `Relevance: ${(result.score * 100).toFixed(1)}%\n`;
      context += `Content:\n${result.content}\n\n`;
      context += '---\n\n';
    }

    return context;
  } catch (error) {
    console.error('[JARVIS Brain] Error getting context:', error);
    return 'Error retrieving context.';
  }
}

// ============================================================================
// AGENT EXECUTION - IMPLEMENT YOUR OWN
// ============================================================================

/**
 * Execute a specific agent with a query
 *
 * ⚠️ TODO: Implement your agent execution logic
 *
 * Our approach:
 * 1. Get relevant context from memory search
 * 2. Build full prompt with system + context + query
 * 3. Call Claude API or CLI
 * 4. Parse and return response
 * 5. Log for cost tracking and learning
 */
async function executeAgent(
  agentName: string,
  query: string,
  options: {
    includeContext?: boolean;
    contextQuery?: string;
    contextLimit?: number;
  } = {}
): Promise<AgentResponse> {
  const startTime = Date.now();

  // Get agent definition
  const agent = AGENTS[agentName];
  if (!agent) {
    throw new Error(`Unknown agent: ${agentName}`);
  }

  console.log(`[JARVIS Brain] Executing agent: ${agent.name}`);

  try {
    // Step 1: Get relevant context if requested
    let context = '';
    if (options.includeContext) {
      const searchQuery = options.contextQuery || query;
      context = await getRelevantContext(searchQuery, options.contextLimit || 5);
    }

    // Step 2: Build full prompt
    const messages: Message[] = [
      { role: 'system', content: agent.systemPrompt },
    ];

    if (context) {
      messages.push({ role: 'system', content: context });
    }

    messages.push({ role: 'user', content: query });

    // Step 3: Call AI (Claude API or CLI)
    // ⚠️ TODO: Implement your AI call here
    //
    // Option A: Use Claude API directly
    // Option B: Use Claude Code CLI
    // Option C: Use Agent SDK
    //
    // We used mostly Claude Code CLI (free with Pro subscription)
    //
    const response = `STUB: Agent ${agentName} would execute here.

Your query: ${query}

To implement:
1. Call your AI provider (Claude API, OpenAI, etc.)
2. Pass the messages array
3. Set max_tokens: ${agent.maxTokens}
4. Set temperature: ${agent.temperature}
5. Parse and return the response

See PHASE-2D-COMPLETE.md for our implementation approach.`;

    const duration = Date.now() - startTime;

    // Step 4: Log execution
    const agentResponse: AgentResponse = {
      agent: agentName,
      response,
      tokensUsed: 0, // TODO: Get from API response
      cost: 0, // TODO: Calculate based on model pricing
      duration,
      timestamp: new Date(),
    };

    console.log(`[JARVIS Brain] Agent completed in ${duration}ms`);

    return agentResponse;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[JARVIS Brain] Agent failed:`, error);
    throw error;
  }
}

// ============================================================================
// MULTI-AGENT ORCHESTRATION - Advanced pattern
// ============================================================================

/**
 * Orchestrate multiple agents for complex tasks
 *
 * Example: Portfolio analysis might use:
 * 1. @market-analyst - Get current market context
 * 2. @etf-screener - Find opportunities
 * 3. @portfolio-monitor - Check current positions
 * 4. Final synthesis - Combine all insights
 */
async function orchestrateAgents(
  task: string,
  agents: string[]
): Promise<AgentResponse[]> {
  console.log(`[JARVIS Brain] Orchestrating ${agents.length} agents for: ${task}`);

  const responses: AgentResponse[] = [];

  for (const agentName of agents) {
    try {
      // Each agent can see previous agents' responses
      let query = task;
      if (responses.length > 0) {
        query += '\n\nPrevious agents said:\n';
        for (const prev of responses) {
          query += `\n${prev.agent}: ${prev.response.substring(0, 200)}...\n`;
        }
      }

      const response = await executeAgent(agentName, query, {
        includeContext: true,
      });

      responses.push(response);
    } catch (error) {
      console.error(`[JARVIS Brain] Agent ${agentName} failed:`, error);
      // Continue with other agents or fail entire orchestration
    }
  }

  return responses;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { executeAgent, orchestrateAgents, AGENTS, getRelevantContext };

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: Single agent execution
 *
 * const response = await executeAgent('etf-screener', 'Analyze QQQ');
 * console.log(response.response);
 *
 *
 * Example 2: Agent with context from vault
 *
 * const response = await executeAgent('portfolio-monitor', 'Check my positions', {
 *   includeContext: true,
 *   contextQuery: 'current portfolio allocation',
 *   contextLimit: 3
 * });
 *
 *
 * Example 3: Multi-agent orchestration
 *
 * const responses = await orchestrateAgents(
 *   'Should I buy more QQQ?',
 *   ['market-analyst', 'etf-screener', 'portfolio-monitor']
 * );
 *
 * for (const r of responses) {
 *   console.log(`${r.agent}: ${r.response}`);
 * }
 */

/**
 * HOW WE ACTUALLY IMPLEMENTED THIS:
 *
 * We used Claude Code CLI for 90% of agent calls because:
 * - Free with Claude Pro subscription ($20/month)
 * - Already has great context management
 * - Subagents via @agent-name syntax
 * - No API costs for daily tasks
 *
 * Only used Claude API directly for:
 * - Custom workflows needing programmatic control
 * - High-frequency tasks (hourly checks)
 * - Integration with other services
 *
 * See PHASE-2D-COMPLETE.md for our full implementation strategy.
 */
