# JARVIS Hybrid Architecture Guide

> **Philosophy:** CLI-first for cost savings, Agent SDK for programmatic power when needed.

## Overview

JARVIS uses a **hybrid architecture** that combines:

1. **Claude Code CLI** (free with Pro subscription) - handles 80-90% of tasks
2. **Agent SDK** (paid, tracked) - reserved for complex programmatic tasks
3. **Real-time cost monitoring** - budget controls and alerts
4. **Model-agnostic design** - easy to add Kimi, OpenAI, etc.

## Cost Estimates

### Anthropic Pricing (as of March 2026)

| Model  | Input (per 1M tokens) | Output (per 1M tokens) | Typical Task |
|--------|----------------------|----------------------|--------------|
| Sonnet | $3                   | $15                  | ~$0.045      |
| Opus   | $15                  | $75                  | ~$0.225      |
| Haiku  | $0.25                | $1.25                | ~$0.004      |

**Estimated monthly costs:**
- 1000 tasks/month at $0.045 each = ~$45
- With 90% handled by CLI (free) = **~$4.50/month**
- Heavy usage (10,000 tasks) with 90% CLI = **~$45/month**

### Alternative Models (Cheaper)

| Provider    | Model      | Cost vs Anthropic | Monthly (1K tasks) |
|-------------|------------|-------------------|-------------------|
| Anthropic   | Sonnet 4.5 | 1x (baseline)     | ~$45              |
| Kimi        | K2.5       | **10x cheaper**   | ~$4.50            |
| DeepSeek    | V3         | **15x cheaper**   | ~$3.00            |
| Local LLM   | DeepSeek-R1| **FREE**          | $0 (hardware only)|

## How It Works

### 1. Smart Routing

```typescript
// JARVIS automatically chooses CLI (free) vs Agent SDK (paid)
const result = await jarvis.think({
  prompt: 'Analyze market data',
  preferCLI: true,  // Default: use free CLI
});
```

**Decision logic:**
- Simple tasks → CLI (free)
- Complex tools needed (WebSearch, MCP, etc.) → Agent SDK (paid)
- Budget exceeded → Force CLI or error

### 2. Real-Time Cost Tracking

```typescript
// Get cost report anytime
const report = jarvis.getCostReport();

console.log(`Today: $${report.today}`);
console.log(`This Month: $${report.thisMonth} / $${report.budgetRemaining} remaining`);
```

**Database tracking:**
- Every task logged with timestamp, model, tokens, cost
- SQLite database: `data/costs.db`
- Automatic budget warnings at 80% and 95%

### 3. Budget Protection

Set in `.env`:
```bash
MONTHLY_BUDGET=50  # Default $50/month
```

**What happens:**
- Budget at 80% → Warning printed
- Budget at 95% → Critical alert
- Budget exceeded → Tasks fail with error (unless `preferCLI=true`)

## Adding Alternative Models

### Example: Adding Kimi K2.5 (10x cheaper)

**Step 1:** Add to `.env`
```bash
KIMI_API_KEY=your_kimi_api_key_here
```

**Step 2:** Update `jarvis-brain.ts` pricing table:
```typescript
const pricing: Record<string, { input: number; output: number }> = {
  'sonnet': { input: 3, output: 15 },
  'opus': { input: 15, output: 75 },
  'haiku': { input: 0.25, output: 1.25 },

  // Add Kimi pricing (10x cheaper)
  'kimi': { input: 0.3, output: 1.5 },
};
```

**Step 3:** Update `thinkWithAgentSDK()` to support Kimi:
```typescript
private async thinkWithAgentSDK(
  prompt: string,
  model: string,
  allowedTools: string[],
  maxCost: number
): Promise<string> {
  // Check if using Kimi
  if (model === 'kimi') {
    return this.thinkWithKimi(prompt, allowedTools);
  }

  // ... existing Anthropic code
}

private async thinkWithKimi(
  prompt: string,
  allowedTools: string[]
): Promise<string> {
  const response = await fetch('https://api.moonshot.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.KIMI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'moonshot-v1-32k',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();

  // Record cost with Kimi pricing
  this.recordCost({
    timestamp: new Date().toISOString(),
    taskType: 'agent-sdk',
    model: 'kimi',
    inputTokens: data.usage.prompt_tokens,
    outputTokens: data.usage.completion_tokens,
    costUSD: this.calculateCost('kimi', data.usage.prompt_tokens, data.usage.completion_tokens),
    prompt: prompt.substring(0, 100),
  });

  return data.choices[0].message.content;
}
```

**Step 4:** Use it!
```typescript
const result = await jarvis.think({
  prompt: 'Your task here',
  model: 'kimi',  // 10x cheaper!
  preferCLI: false,
});
```

## Usage Examples

### Example 1: Investment Analysis (CLI - Free)

```typescript
// Daily portfolio check - uses CLI (free)
const analysis = await jarvis.think({
  prompt: 'Run ETF screener skill and summarize top opportunities',
  model: 'sonnet',
  preferCLI: true,  // Free!
});

// Update Obsidian vault
// ...
```

**Cost:** $0.00 (uses Claude Pro subscription)

### Example 2: Complex Research (Agent SDK - Paid)

```typescript
// Research requiring web searches and MCP tools
const research = await jarvis.think({
  prompt: 'Research latest AI models and compare pricing',
  model: 'sonnet',
  preferCLI: false,  // Needs Agent SDK
  allowedTools: ['WebSearch', 'WebFetch', 'Read', 'Write'],
  maxCost: 0.50,  // Max $0.50 for this task
});
```

**Cost:** ~$0.10-$0.50 depending on complexity

### Example 3: Cost-Conscious Mode

```typescript
// Always use CLI unless absolutely necessary
const result = await jarvis.think({
  prompt: 'Your task',
  preferCLI: true,  // Will error if complex tools needed
});
```

**Cost:** $0.00 in most cases

## Monitoring Costs

### Command Line
```bash
# Show cost report
bun run costs

# Output:
# ═══════════════════════════════════════
# Today:      $0.15
# This Week:  $2.34
# This Month: $12.50 / $50.00
# Remaining:  $37.50 (75%)
# ═══════════════════════════════════════
```

### Programmatic
```typescript
import { jarvis } from './src/jarvis-brain';

const report = jarvis.getCostReport();

// Check if over budget
if (report.budgetPercent > 80) {
  console.warn('⚠️  Approaching budget limit!');
}

// See breakdown
report.breakdown.forEach(b => {
  console.log(`${b.taskType}: ${b.count}x at $${b.cost}`);
});
```

## Architecture Benefits

### ✅ Cost Savings
- 80-90% of tasks handled by free CLI
- Only pay for complex programmatic tasks
- Estimated: $4.50-$45/month (vs $200+ for heavy API usage)

### ✅ Programmatic Power
- Agent SDK available when needed
- Full tool orchestration capabilities
- MCP server support

### ✅ Flexibility
- Easy to add alternative models (Kimi, DeepSeek, etc.)
- Can switch models based on task complexity
- Budget controls prevent runaway costs

### ✅ Monitoring
- Real-time cost tracking
- Detailed breakdown by task type and model
- Budget alerts and protection

## Best Practices

### 1. Default to CLI
```typescript
// ✅ Good - uses free CLI
const result = await jarvis.think({ prompt, preferCLI: true });

// ❌ Bad - pays for simple task
const result = await jarvis.think({ prompt, preferCLI: false });
```

### 2. Set Task Budgets
```typescript
// Prevent expensive tasks
const result = await jarvis.think({
  prompt,
  preferCLI: false,
  maxCost: 0.10,  // Error if exceeds $0.10
});
```

### 3. Monitor Regularly
```typescript
// Check costs daily
const report = jarvis.getCostReport();
if (report.budgetPercent > 50) {
  console.log('Consider using more CLI tasks');
}
```

### 4. Use Cheaper Models for Simple Tasks
```typescript
// Use Haiku for simple tasks
const result = await jarvis.think({
  prompt: 'Simple task',
  model: 'haiku',  // 90% cheaper than Sonnet
});
```

## Phase 2 Implementation

### Current Status: Phase 2A Complete ✅

- [x] Runtime & Environment (Bun installed)
- [x] Hybrid architecture implemented
- [x] Cost tracking database
- [x] Budget controls
- [x] Model-agnostic design

### Next Steps: Phase 2B

1. **Memory Search System** - Query Obsidian vault efficiently
2. **Heartbeat Scheduler** - Automated market monitoring
3. **Multi-domain Support** - Beyond investments
4. **Alternative Model Integration** - Add Kimi, DeepSeek, etc.

## Troubleshooting

### "Monthly budget exceeded" error

**Solution 1:** Increase budget in `.env`:
```bash
MONTHLY_BUDGET=100  # Increase to $100/month
```

**Solution 2:** Force CLI usage:
```typescript
const result = await jarvis.think({
  prompt,
  preferCLI: true,  // Use free CLI
});
```

**Solution 3:** Reset costs (new month):
```bash
bun run costs:reset
```

### CLI not working

**Check:**
1. Claude Code CLI installed: `claude --version`
2. Logged in: `claude setup-token`
3. Pro subscription active

### Agent SDK errors

**Check:**
1. `ANTHROPIC_API_KEY` set in `.env`
2. API key valid: https://console.anthropic.com/settings/keys
3. Budget not exceeded: `bun run costs`

## Resources

- **Anthropic API Pricing:** https://www.anthropic.com/pricing
- **Kimi API:** https://platform.moonshot.cn/
- **DeepSeek API:** https://platform.deepseek.com/
- **Claude Agent SDK Docs:** https://platform.claude.com/docs/en/agent-sdk/overview

---

**Questions?** Check `test-hybrid.ts` for working examples or run `bun run test:hybrid` to see the system in action.
