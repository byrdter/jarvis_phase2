# JARVIS Voice Master Plan

**Created:** 2026-07-19
**Status:** Approved architecture, not yet implemented
**Supersedes:** `VOICE-IMPLEMENTATION-PLAN.md` and `VOICE-QUICK-START.md` (Phase 10 docs — only 10A-input ever shipped)

---

## The Goal

Talk to JARVIS like a person. Natural back-and-forth, interruptible mid-sentence,
no typing. **With zero loss of JARVIS's existing context system, skills, memory, or tools.**

## The Core Principle

> **The realtime voice model is the ears and mouth. It is NEVER the brain.**

JARVIS's intelligence is the `claude` CLI subprocess with the full context system.
That does not change, move, or get rebuilt. The voice layer is a *wrapper* around
the existing system.

**Explicitly rejected:** building a "second brain" and migrating JARVIS into it.
That is a months-long, high-risk detour that endangers everything already built,
to solve a problem that is actually a thin wrapper. Do not do this.

---

## Architecture

```
   You speak
       │
       ▼
┌──────────────────────────────────────────────┐
│  VOICE SHELL  (Gemini Live API)              │
│                                              │
│  Job: hold the conversational floor.         │
│   • listens (native VAD)                     │
│   • handles barge-in / interruption          │
│   • speaks (native audio out)                │
│   • emits conversational filler on tool call │
│                                              │
│  FORBIDDEN: answering substantive questions  │
│  from its own knowledge. It has exactly one  │
│  real tool.                                  │
└───────────────────┬──────────────────────────┘
                    │  ask_jarvis(query)
                    ▼
┌──────────────────────────────────────────────┐
│  THE BRIDGE  (new — the durable core)        │
│  agent-sdk/src/voice/bridge.ts               │
│                                              │
│  Streaming wrapper over JarvisCLIClient      │
└───────────────────┬──────────────────────────┘
                    │  spawn
                    ▼
┌──────────────────────────────────────────────┐
│  JARVIS  (unchanged)                         │
│  claude CLI  →  context system, memory,      │
│  skills, beads, market tools, everything     │
└──────────────────────────────────────────────┘
```

**Why this preserves everything:** JARVIS is not modified. It gains a caller.

---

## The Three Brains — resolved

The audit found `agent-sdk/src/llm/` (codex-client, gemini-client,
multi-model-router) is real code with **zero importers in `src/`** and **never
committed to git** (`?? src/llm/`). There is also a second, entirely unused router
at `src/router.ts` with speculative model IDs. It was built as the artifact backing
Video 14, not as infrastructure.

This plan makes "three brains" **true** without building a router nobody calls:

| Brain | Role | Mechanism |
|---|---|---|
| **Gemini** | Voice shell — ears, mouth, conversational floor | Live API (this plan) |
| **Claude** | Reasoning brain — all substantive answers | `claude` CLI subprocess (existing) |
| **Codex** | Code review / second opinion | `skills/three-brain-router/SKILL.md` (existing, prompt-level) |

**Actions:** delete `src/router.ts` (dead, speculative). Keep `src/llm/gemini-client.ts`
only if the CLI path proves useful; the Live API path does not use it. Do not build
the multi-model router — no live path needs it.

---

## The One Hard Problem: Latency Mismatch

| Layer | Expected response time |
|---|---|
| Realtime voice conversation | 300–500 ms |
| `claude` CLI subprocess | 3–30 s |

A 15-second silence kills the illusion of conversation. Two mitigations, both required:

1. **Conversational filler.** The voice shell speaks immediately on tool dispatch
   ("Let me pull that up…") while the bridge works. This is instructed in the shell's
   system prompt, not hardcoded.
2. **Streaming.** `JarvisCLIClient.ask()` currently blocks on `` await $`claude ...`.text() ``
   ([jarvis-cli-client.ts:49](src/jarvis-cli-client.ts:49)). The bridge must use
   `--output-format stream-json` and emit partial results so the shell can start
   speaking the answer before generation completes.

**Do not skip #2.** Blocking is the difference between "conversation" and "voice-activated batch job."

---

## Phases

### Phase 1 — The Bridge (no voice at all)
**Deliverable:** `agent-sdk/src/voice/bridge.ts` — a streaming `ask_jarvis(query)`
function, plus a text-mode test harness.

- Add streaming to `JarvisCLIClient` (`--output-format stream-json`)
- Session continuity: does a follow-up question keep context? (`--resume` / session id)
- **Measure real latency** on representative queries (portfolio check, memory lookup,
  simple factual). This number determines how aggressive the filler strategy must be.

**Gate:** if p50 latency is under ~4s with streaming, the design holds. If it's 20s+,
revisit before building any voice UI.
**Why first:** zero voice dependencies, fully testable with text, and it's the piece
both surfaces share. Nothing here is throwaway.

#### ✅ Phase 1 RESULT (measured 2026-07-19) — GATE PASSED

`src/voice/bridge.ts` + `src/voice/measure.ts`. Re-run anytime: `bun run src/voice/measure.ts`

| Metric | p50 | p90 |
|---|---|---|
| **TTFT** (silence the user hears) | **2,638 ms** | 5,369 ms |
| Total generation | 6,490 ms | 8,514 ms |

**TTFT is the metric, not total.** With streaming, TTS starts speaking at the first
token, so total duration hides behind the speech. Only TTFT is audible silence.

- ✅ **Full JARVIS context confirmed intact through the bridge.** It correctly
  answered "what phase is JARVIS in" (Phase 3C) and "Byrddynasty runtime target"
  (~8 min, from the retention docs) — memory system and skills both reachable.
  This was the core risk and it is retired.
- ✅ **Session continuity works.** Turn 2 with `--resume` recalled turn 1's content,
  and resume was *not* slower (3.2s TTFT).
- ⚠️ **~2.5s is an irreducible floor** — spawn + context load, not generation. A
  trivial "say ok" query still costs 2,638ms. Filler is therefore **mandatory**,
  not optional. There is no prompt tuning that gets below this.

**Follow-up defect found (not a voice bug):** the market query returned a
hallucinated SPY price with the admission *"I don't have live market data access"* —
the `jarvis-price` tool was not invoked in `-p` subprocess mode. Tracked separately.
**This matters more for voice than for text:** a spoken number carries no visual
hedge, so a confident wrong price is materially more dangerous out loud.

### Phase 2 — Voice Shell, Web UI
**Deliverable:** browser page — mic in, JARVIS speaks back, interruptible.

- Gemini Live over WebSocket, **ephemeral tokens** (never ship the API key to the browser;
  mint tokens from an existing server endpoint)
- Register `ask_jarvis` as the single function-calling tool
- System prompt: butler persona + hard constraint that all substantive content comes
  from the tool
- Handle `ToolCallCancellation` on barge-in
- Filler-phrase tuning

**Why the web UI before terminal:** browser owns mic/speaker cleanly, it's the surface
where barge-in actually works well, and it's filmable for Byrddynasty.

### Phase 3 — Terminal `/voice` mode
Same bridge, local audio I/O (mic capture + playback) instead of browser. This is the
"do away with typing" surface for daily driving.

### Phase 4 — Refinement
- Voice/persona lock-in (see below)
- Conversation memory: should spoken sessions write to the memory system?
- Wake word / always-on (optional)

---

## Voice Selection — the real tradeoff

| Option | Character | Interruption quality | Latency |
|---|---|---|---|
| **Gemini Live native voices** | Limited preset set | Excellent — native, single stream | Best |
| **ElevenLabs** (key already in `.env`) | Full control, true butler voice | Degraded — extra hop, harder barge-in | +200–400ms |

**Recommendation:** start native. Natural conversation depends far more on clean
interruption than on voice character. Revisit ElevenLabs in Phase 4 once the loop feels right.

**Note:** `.env` already has `ELEVENLABS_API_KEY` + voice ID + full tuning params
(stability, similarity, style, speed) and `CARTESIA_API_KEY` — **all currently
orphaned, no code reads them.** They stay available for Phase 4.

---

## What Already Exists (do not rebuild)

| Asset | Location | State |
|---|---|---|
| STT (Groq `whisper-large-v3`) | [telegram-phase10.ts:356](integrations/telegram-phase10.ts) | ✅ Working — Telegram voice notes |
| Claude CLI subprocess client | `src/jarvis-cli-client.ts` | ✅ Working, needs streaming |
| HTTP/WS server | `src/server.ts` (port 3000) | ✅ WS is broadcast-only; no inbound handling yet |
| Command center server | `src/server-command-center.ts` | ✅ Has real `/ws` upgrade path |
| ElevenLabs / Cartesia keys | root `.env` | ⚠️ Provisioned, zero code reads them |
| TTS of any kind | — | ❌ Does not exist |
| Three-brain router | `src/llm/`, `src/router.ts` | ⚠️ Untracked, zero importers |

**Note:** `agent-sdk/.env` lacks `GROQ_API_KEY` — the bot depends on root `.env` loading.

---

## Cost

Gemini Live: ~$3 / 1M audio input tokens, ~$12 / 1M audio output.
Rough order of magnitude: **well under $1 per hour of conversation.**
Claude CLI calls remain $0 (OAuth token). Compare GPT Realtime at ~$32/$64 —
roughly 10x more for the same job.

---

## Open Questions

1. Should spoken conversations write to the memory system, or stay ephemeral?
2. Does the voice shell get read-only JARVIS access, or can it trigger actions
   (trades, sends, commits)? **Default: read-only + explicit confirmation for
   anything side-effectful.** Voice is a bad interface for irreversible actions.
3. Butler persona voice character — defer to Phase 4.
