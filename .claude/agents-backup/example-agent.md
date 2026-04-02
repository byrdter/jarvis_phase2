# Example Agent - Template

> ⚠️ This is a template to show the structure of agent definitions.
> Customize this for your own domain and use cases.

## Agent Purpose

[Describe what this agent does - its specific responsibility and expertise]

Example: "Analyzes ETF technical indicators and classifies market stage"

## When to Use

[Describe when this agent should be invoked]

Example:
- Daily morning screening
- When user asks about specific ETF
- Before making allocation decisions

## Context Requirements

[What information this agent needs to function effectively]

Example:
- Recent price data (last 200 days minimum)
- Technical indicators (SMAs, RSI, MACD)
- Current stage classification rules
- Historical stage transitions

## Agent Configuration

```yaml
name: example-agent
description: Brief one-line description
maxTokens: 4000
temperature: 0.3
model: claude-sonnet-4
```

## System Prompt

```
You are [Agent Name], a specialized AI assistant focused on [domain].

Your role:
- [Primary responsibility]
- [Secondary responsibility]
- [Constraints or limitations]

Your expertise:
- [Domain knowledge area 1]
- [Domain knowledge area 2]
- [Domain knowledge area 3]

Analysis framework:
1. [Step or principle]
2. [Step or principle]
3. [Step or principle]

Output format:
- [Section 1]: [What to include]
- [Section 2]: [What to include]
- [Section 3]: [What to include]

Quality standards:
- Be specific and actionable
- Cite data when available
- Explain reasoning clearly
- Flag uncertainties
```

## Example Queries

**Query 1:**
```
[Example user query]
```

**Expected Output:**
```
[Example of what good output looks like]
```

**Query 2:**
```
[Another example query]
```

**Expected Output:**
```
[Another example output]
```

## Context Search Queries

When using memory search to get relevant context, use these queries:

- `[search term 1]` - To find [type of information]
- `[search term 2]` - To find [type of information]
- `[search term 3]` - To find [type of information]

## Integration Points

**Calls these agents:**
- `other-agent-1` - For [specific need]
- `other-agent-2` - For [specific need]

**Called by these agents:**
- `orchestrator-agent` - As part of [workflow]

## Performance Notes

**Token usage:**
- Average: ~3,000 tokens per execution
- With context: ~5,000 tokens
- Max: 8,000 tokens

**Execution time:**
- Typical: 2-4 seconds
- With context: 5-8 seconds

**Cost estimate (Claude Sonnet 4):**
- Per execution: ~$0.015
- Daily (if run daily): ~$0.45/month
- Note: Free if using Claude Code CLI with Pro subscription

## Refinement History

**Version 1.0** (Initial)
- [What worked / didn't work]
- [Lessons learned]

**Version 2.0** (After refinement)
- [Changes made]
- [Improvements observed]

## Notes

[Any additional context, gotchas, or tips for using this agent effectively]
