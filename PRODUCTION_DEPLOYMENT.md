# Production Deployment Guide — Meta Desk Intelligence System

## Overview

This system delivers **daily meme token meta trend intelligence** with **verified research** and **confidence scoring**. Every claim is traced to primary sources, every gap is resolved or marked unresolvable, and every signal comes with quantified confidence.

---

## Architecture (Production Mode)

### Data Flow

```
1. Observation Collection
   ├─> Manual: .md files in data/observations/
   ├─> Automated: GMGN API, DexScreener, Twitter/X scraping
   └─> Output: data/observations/{region}/{date}_{source}.md

2. Agent Analysis
   ├─> Historian: Pattern matching against past cycles
   ├─> Scout: Novel signal detection
   ├─> Aesthetician: Visual/memetic evaluation
   └─> Translator: Cross-cultural signals
   └─> Output: data/meta-desk/daily-briefs/{date}.md

3. Skeptic Challenge
   ├─> Identifies unverified claims
   ├─> Flags missing data
   └─> Demands primary sources
   └─> Output: skeptic_challenges.md in daily brief

4. Resolution Round (THE CRITICAL LAYER) ⭐
   ├─> Gap Extraction: Parse Skeptic challenges
   ├─> Task Routing: Assign gaps to domain experts
   ├─> Bounded Research: Real web search + Claude analysis
   │   ├─> Tavily API: Web search (5 results per gap)
   │   ├─> Claude Sonnet 4.5: Analyze search results
   │   └─> Structured output: {state, evidence, sources}
   ├─> Skeptic Re-Challenge: Quality control
   └─> Output: data/runs/{run-id}/resolutions/

5. Referee Synthesis
   ├─> Read all resolutions
   ├─> Stratify by confidence (RESOLVED/PARTIAL/UNRESOLVABLE)
   └─> Output: Final daily brief with confidence levels

6. Confidence Ledger
   ├─> Track entities across runs
   ├─> Accumulate resolved facts
   └─> Output: data/ledger.md (persistent)
```

---

## Production Components

### 1. DirectResearchExecutor (NEW - Production Ready)

**Location:** `src/lib/agents/resolution/direct-research-executor.ts`

**What it does:**
- Calls Anthropic API directly (no PTY/daemon issues)
- Uses Tavily for web search (5 results per gap)
- Returns structured JSON (not text parsing)
- Tracks tokens and costs
- OS-independent, reliable

**API Calls per Gap:**
- 1× Tavily search API call (~$0.001)
- 1× Claude Sonnet 4.5 API call (~$0.01-0.05 depending on context)
- **Total per gap:** ~$0.02-0.06

**Example for 10 gaps:**
- 10 searches + 10 Claude calls
- **Estimated cost:** $0.20-0.60 per debate run
- **Time:** ~30-60 seconds (parallel execution)

**Output Format (Structured):**
```json
{
  "state": "RESOLVED|PARTIALLY_RESOLVED|UNRESOLVABLE",
  "evidence": "Found official BONK DAO treasury at address XYZ",
  "sources": [
    "https://bonkcoin.com/dao",
    "https://solscan.io/account/..."
  ],
  "reason": "Partially resolved because...",
  "search_count": 5,
  "tokens_used": 2500,
  "cost_usd": 0.0375
}
```

### 2. Old ResolutionExecutor (Simulation/Testing Only)

**Location:** `src/lib/agents/resolution/resolution-executor.ts`

**What it does:**
- Uses daemon/PTY sessions (unreliable on Windows)
- Falls back to simulation on timeout
- Good for testing workflow logic

**When to use:** `SIMULATION_MODE=true`

---

## API Keys Required

### Required for Production

1. **ANTHROPIC_API_KEY**
   - Get from: https://console.anthropic.com/
   - Cost: $3/million input tokens, $15/million output tokens
   - Model: claude-sonnet-4-5-20250929

2. **TAVILY_API_KEY**
   - Get from: https://tavily.com/
   - Cost: ~$0.001 per search (5 results)
   - Free tier: 1,000 searches/month

### Setup

1. Copy `.env.example` to `.env`
2. Add your API keys:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   TAVILY_API_KEY=tvly-...
   ```

3. Optional: Add meta desk data collection keys
   ```bash
   GMGN_API_KEY=...      # Solana token tracking
   XAI_API_KEY=...        # xAI Grok for web search
   APIFY_API_TOKEN=...    # Twitter/TikTok scraping
   ```

---

## Running the System

### Mode 1: Production (Real API Calls)

```bash
# Ensure API keys are set in .env
npm run debate 2026-04-10
```

This will:
- ✅ Use DirectResearchExecutor
- ✅ Make real Tavily searches
- ✅ Call Claude API for analysis
- ✅ Return verified, sourced results
- ✅ Track costs and tokens

### Mode 2: Simulation (No API Costs)

```bash
SIMULATION_MODE=true npm run debate 2026-04-10
```

This will:
- ✅ Use mock data (fast, free)
- ✅ Test workflow logic
- ❌ No real research
- ❌ Worthless for production

---

## Cost Analysis

### Per Debate Run (Typical)

**Assumptions:**
- 1 observation → 10 gaps extracted
- 10 gaps × $0.04 avg = **$0.40 per run**

**Monthly (Daily Runs):**
- 30 runs × $0.40 = **$12/month**

**Scaling:**
- 3 observations/day → 30 gaps/run → $1.20/run → **$36/month**
- 10 observations/day → 100 gaps/run → $4/run → **$120/month**

**ROI Calculation:**
If clients pay $50/month for intelligence:
- Break-even: 1 client covers 4 daily runs
- 10 clients = $500/month revenue - $36 cost = **$464 profit**

---

## Next Steps to Harden

### 1. Improve Gap Extraction ✅ DONE
- [x] Created GapExtractor with regex patterns
- [ ] TODO: Use LLM-based extraction for better quality

### 2. Add Data Verification
- [ ] Verify URLs exist before citing
- [ ] Check on-chain data (Solana RPC)
- [ ] Scrape images with Firecrawl
- [ ] Validate social media accounts

### 3. Implement Referee Synthesis
- [ ] Read all resolution outputs
- [ ] Stratify by confidence level
- [ ] Generate "What We Know" (high confidence)
- [ ] Generate "What We're Watching" (medium)
- [ ] Minimize "What We DON'T Know" (should be empty if Resolution worked)

### 4. Add Retry Logic
- [ ] Retry failed API calls (3× with backoff)
- [ ] Circuit breaker for repeated failures
- [ ] Graceful degradation to UNRESOLVABLE

### 5. Monitoring & Alerts
- [ ] Track resolution rate (target: >70%)
- [ ] Alert if cost spikes unexpectedly
- [ ] Monitor API latency
- [ ] Log all unresolvable gaps for manual review

### 6. Automated Observation Collection
- [ ] GMGN API integration for Solana tokens
- [ ] Twitter scraping via Apify
- [ ] DexScreener webhook for new launches
- [ ] Schedule daily collection (6 AM UTC)

---

## Production Checklist

Before going live with paying clients:

- [ ] API keys configured in .env
- [ ] Test run with real APIs (verify costs match estimates)
- [ ] Referee synthesis implemented
- [ ] Confidence ledger tested across multiple runs
- [ ] Resolution rate >70% on test data
- [ ] Cost monitoring in place
- [ ] Manual review process for UNRESOLVABLE gaps
- [ ] Client delivery mechanism (Telegram/email)
- [ ] Backup/disaster recovery for ledger data

---

## Troubleshooting

### "ANTHROPIC_API_KEY not found"
- Check `.env` file exists in `cabinet/` directory
- Verify key starts with `sk-ant-`

### "TAVILY_API_KEY not found"
- Add Tavily key to `.env`
- Or disable search: `needsWebSearch()` return false

### High API costs
- Check number of gaps extracted (should be <20 per run)
- Verify gaps aren't duplicated
- Consider caching search results

### Low resolution rate (<50%)
- Review unresolvable gaps manually
- Improve search query generation
- Add domain-specific search patterns

---

## Contact & Support

For production deployment assistance:
- Review PROGRESS.md for changelog
- Check data/runs/{latest}/resolutions/ for debug output
- Monitor console logs for API errors
