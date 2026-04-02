# JARVIS Phase 2: Agent SDK Foundation

> **⚠️ IMPORTANT DISCLAIMER**  
> This code is provided **as an educational guide only**, not as a working demo. It shows the architecture and patterns used in Phase 2 of the JARVIS project. You will need to customize and complete the implementation for your specific use case.

## 🎯 What This Repository Contains

This is the **Phase 2 foundation** for JARVIS (Just A Rather Very Intelligent System) - an AI-powered second brain built in public. This phase adds:

- **Phase 2A:** Modern runtime with Bun + TypeScript
- **Phase 2B:** Semantic vector search (local embeddings)
- **Phase 2C:** Gmail + Calendar API integrations (OAuth 2.0)
- **Phase 2D:** Specialized subagents + execution framework

## 📺 Watch the Build

- **Video 1 (Phase 1):** [Building JARVIS Phase 1](#) - Investment automation
- **Video 2 (Phase 2):** [Building JARVIS Phase 2](#) - Intelligence & APIs
- **YouTube Channel:** [Byrddynasty](#)

## 🏗️ Architecture Overview

```
agent-sdk/
├── src/
│   ├── embeddings.ts          # ✅ Local vector embeddings (Transformers.js)
│   ├── memory-search.ts       # ✅ Hybrid search (70% vector + 30% keyword)
│   ├── heartbeat.ts           # ⚠️ Execution framework (STUB - customize this)
│   └── jarvis-brain.ts        # ⚠️ Agent orchestration (STUB - customize this)
├── integrations/
│   ├── gmail.ts               # ✅ Gmail API wrapper
│   └── calendar.ts            # ✅ Calendar API wrapper
├── scripts/
│   ├── google-oauth-token.ts  # ✅ OAuth 2.0 token generator
│   ├── index-vault.ts         # ✅ Index your notes for search
│   └── search.ts              # ✅ Search indexed notes
└── .claude/
    └── agents/                # ⚠️ Example agent definitions (customize)
```

**Legend:**
- ✅ **Complete code** - Ready to use as-is or customize
- ⚠️ **Stubs/Templates** - Shows structure, you implement the logic

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js 18+
- Google Cloud account (for Gmail/Calendar APIs)
- Claude API key (for agent features)

### Installation

```bash
# Clone and install
git clone <your-fork-url>
cd agent-sdk
bun install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# GOOGLE_CLIENT_ID=...
# GOOGLE_CLIENT_SECRET=...
# ANTHROPIC_API_KEY=...
```

### Phase 2B: Vector Search

```bash
# Index your notes (modify VAULT_PATH in scripts/index-vault.ts)
bun run scripts/index-vault.ts

# Search semantically
bun run scripts/search.ts "portfolio allocation"
```

### Phase 2C: Gmail & Calendar

```bash
# 1. Set up Google OAuth (follow GOOGLE-OAUTH-SETUP.md)
# 2. Generate refresh token
bun run scripts/google-oauth-token.ts

# 3. Test Gmail
bun run test-gmail.ts

# 4. Test Calendar
bun run test-calendar.ts
```

### Phase 2D: Agents (Requires Customization)

The agent implementations in `src/heartbeat.ts` and `src/jarvis-brain.ts` are **stubs**. You need to:

1. Define your agents in `.claude/agents/`
2. Implement your orchestration logic
3. Add your domain-specific prompts
4. Configure scheduling

See `PHASE-2D-COMPLETE.md` for the architecture we used.

## 📖 What You'll Learn

### Phase 2A: Modern Runtime
- Why Bun over Node.js (3x faster, native TypeScript)
- Project structure for autonomous agents
- Environment configuration

### Phase 2B: Semantic Search
- Local embeddings with Transformers.js (all-MiniLM-L6-v2)
- Hybrid search: 70% semantic + 30% keyword
- SQLite for vector storage
- Zero API costs, complete privacy

### Phase 2C: API Integrations
- OAuth 2.0 setup (one-time, 25 minutes)
- Gmail API: search emails, check broker alerts
- Calendar API: schedule awareness
- Read-only permissions for security

### Phase 2D: Autonomous Agents
- Specialized vs. general-purpose agents (3-5x efficiency)
- Execution logging and cost tracking
- Cron-based scheduling
- OS-level persistence (LaunchAgent/systemd)

## 🎓 Educational Guide, Not a Clone

**This code is intentionally incomplete.** We provide:

✅ **Foundational components** that are domain-agnostic  
✅ **Architecture patterns** we discovered through building  
✅ **Setup guides** to avoid common pitfalls  

⚠️ **You must implement:**
- Your own agent logic and prompts
- Your own domain-specific workflows
- Your own orchestration strategies
- Your own memory patterns

**Why?** Because building your second brain is about understanding the principles, not copying someone else's implementation.

## 📚 Documentation

- `GOOGLE-OAUTH-SETUP.md` - Complete OAuth 2.0 setup guide
- `PHASE-2B-VECTOR-SEARCH-COMPLETE.md` - Vector search deep dive
- `PHASE-2C-COMPLETE.md` - Gmail/Calendar integration guide
- `PHASE-2D-COMPLETE.md` - Agent architecture (our approach)
- `HYBRID-ARCHITECTURE.md` - Why we chose this stack

## ⚠️ What's NOT Included

To maintain the educational focus and protect our work:

- ❌ Complete agent implementations
- ❌ Specific prompts and strategies
- ❌ Domain-specific business logic
- ❌ Pre-populated databases
- ❌ Production configurations

## 🔑 Key Insights from Phase 2

1. **Local AI is production-ready** - Vector embeddings work great locally ($0 cost)
2. **OAuth is simpler than it looks** - 25 min setup, lifetime access
3. **Hybrid approaches win** - Combine semantic + keyword search
4. **Specialized beats general** - Focused agents outperform generic ones
5. **Build modular components** - Each piece works independently

## 🛠️ Tech Stack

- **Runtime:** Bun (3x faster than Node.js)
- **Language:** TypeScript (type safety, better tooling)
- **Vector Search:** Transformers.js (local, 23MB model)
- **Database:** SQLite (bun:sqlite, no dependencies)
- **APIs:** Google OAuth 2.0, Gmail, Calendar
- **AI:** Claude Code CLI + Anthropic SDK

## 🚧 What's Next (Phase 3)

- Agent SDK for persistent 24/7 execution
- Daily reflection and automatic memory updates
- Chat interface (Slack/Telegram)
- Voice interface (Whisper + ElevenLabs)

## 📖 Building in Public

Follow the journey:
- **YouTube:** [Byrddynasty](#) - Video build logs
- **Substack:** [Newsletter](#) - Deep dives and learnings
- **GitHub:** This repository - Code and architecture

## 🙏 Learn, Don't Copy

This project is about teaching you to build **your own** second brain, not cloning ours. 

- Use this code to understand the patterns
- Implement your own logic for your domain
- Share your learnings with the community
- Build something that works for YOU

## 📄 License

MIT License - See LICENSE file

**Attribution:** If you build on this work, please credit the JARVIS project and link to the YouTube series.

---

**Questions?** Open an issue or watch the YouTube videos for detailed walkthroughs.

**Want the complete implementation?** Subscribe to the [Byrddynasty YouTube channel](#) and [Substack](#) for advanced tutorials and courses.
