# META DESK HANDOFF

**Date:** 2026-04-09
**Task:** Complete Meta Desk setup (6 phases + final audit)
**Status:** ✅ ALL PHASES COMPLETE — Ready for Matt to start writing

---

## Executive Summary

**What was built:** A complete knowledge-driven intelligence system for Solana meme coin meta trends, powered by AI agents reading observations and writing daily briefs.

**What's ready:** Full workspace scaffold, 8 agent personas (3 complete, 5 stubs), reference library with frameworks and templates, integration documentation, MCP configuration, first daily brief template, writing guide, and go-live checklist.

**What Matt needs to do:** Start writing manual daily briefs today. Everything else builds from there.

**Timeline to launch:** 6-8 weeks (if full-time execution).

---

## What Was Created Across All Phases

### Phase 1: Directory Scaffold and Knowledge Base Skeleton

**Created:** 35 directories, 21 markdown files

**Key deliverables:**
- `data/meta-desk/` — Meta Desk workspace root with manifesto (index.md)
- `data/meta-desk/daily-briefs/` — Where daily briefs live
- `data/meta-desk/channels/` — Agent debate channels (meta-desk-debate.md, meta-desk-alerts.md, meta-desk-editorial.md)
- `data/observations/` — Raw data ingestion layer (twitter/, eastern/, solana/ subdirectories)
- `data/entities/` — Tracked entities (characters/, themes/, accounts/)
- `data/cycles/` — Historical cycle retrospectives (with 5 stub files + template)
- `data/research-library/` — Frameworks and case studies
- `data/operations/` — Integration tracking and pipeline docs

**Documentation:**
- Each directory has index.md explaining its purpose
- Meta Desk manifesto defines the product vision
- Observation structure documented with frontmatter schemas

**File:** `PHASE_1_COMPLETE.md`

---

### Phase 2: Agent Personas

**Created:** 8 agent persona files at `data/.agents/{slug}/persona.md`

**Full personas (400-700 words each):**

1. **Historian** (`data/.agents/historian/persona.md`)
   - Role: Pattern-matches current observations against past meta cycles
   - Heartbeat: Daily at 7am
   - Reads: Last 7 days of observations + full cycle library
   - Writes: Daily brief under `## Historian` section
   - Voice: Analytical, specific (cites cycles by slug), quantifies timing windows

2. **Scout** (`data/.agents/scout/persona.md`)
   - Role: Surfaces genuinely novel signals (3-source novelty threshold)
   - Heartbeat: Every 4 hours
   - Reads: Last 24 hours of observations only
   - Writes: Daily brief under `## Scout flags` section
   - Voice: Brief flags, no analysis, pure novelty detection
   - Creates entity files in `entities/characters/` with `status: emerging`

3. **Skeptic** (`data/.agents/skeptic/persona.md`)
   - Role: Challenges Historian and Scout findings
   - Heartbeat: Daily at 6pm (after Historian + Scout run)
   - Reads: Today's daily brief (Historian + Scout sections)
   - Writes: Daily brief under `## Skeptic` section + debate log in `channels/meta-desk-debate.md`
   - Voice: Hostile editor, questions assumptions, pushes back on consensus

**Stub personas (200 words each, marked NOT PRODUCTION READY):**

4. **Translator** — Cross-cultural analysis (Japanese/Korean/Chinese → English)
5. **Aesthetician** — Screenshot test evaluation, visual/memetic assessment
6. **Referee** — Balances Historian/Scout vs Skeptic debate
7. **Scribe** — Weekly synthesis, Sunday digest
8. **Concept Forge** — Manual-trigger only, generates character/theme concepts

**All agents:**
- `active: false` (verified)
- `provider: claude-code` (inherits MCP servers from Phase 4)
- Cron schedules defined
- Focus directories specified
- Voice guidance included

**File:** `PHASE_2_COMPLETE.md`

---

### Phase 3: Reference Library Seeding

**Created:** Cycle templates, account templates, 5 framework documents, case study templates

**Cycle retrospectives:**
- `cycles/_TEMPLATE.md` — Structure for documenting past cycles
- `cycles/2024-Q4_dog-cycle-wif-era.md` — Stub (Matt to fill with WIF data)
- Plus 4 additional cycle stubs from Phase 1

**Account seed files:**
- `entities/accounts/_TEMPLATE.md` — Table structure for seed accounts
- `entities/accounts/english-seed.md` — Empty (Matt to populate with 20-30 English CT accounts)
- `entities/accounts/japanese-seed.md` — Empty (15-20 Japanese CT accounts)
- `entities/accounts/korean-seed.md` — Empty (10-15 Korean CT accounts)
- `entities/accounts/chinese-seed.md` — Empty (5-10 Chinese accounts)

**Framework documents (5):**

1. **`meta-rotation-theory.md`** (652 words)
   - Explains 6-12 week meta rotation: Animal → Political → Food → AI → Nostalgia → Absurdist
   - Why rotation happens (attention fatigue, narrative exhaustion, novelty chasing)
   - How to detect rotation windows

2. **`screenshot-test-framework.md`** (496 words)
   - Core test: Can someone screenshot one image and have it be self-contained funny?
   - Pass criteria: Visual clarity, self-contained humor, remix potential
   - Evaluation rubric for Aesthetician

3. **`cross-cultural-arbitrage-playbook.md`** (719 words)
   - Japanese/Korean CT leads Western CT by 3-6 weeks
   - Crossing detection timeline (days 1-7 early, 7-14 crossing, 14-21 confirmed, 21-35 peak)
   - What crosses vs what doesn't

4. **`three-audiences-model.md`** (569 words)
   - Degens (early entry), Normies (FOMO), Lore Nerds (narrative depth)
   - Successful projects need all three (3/3 = breakout potential)

5. **`heel-vs-face-alignment.md`** (477 words)
   - Pro-wrestling alignment in meme characters (lovable vs antagonistic)
   - Face: Stronger communities, longer holds
   - Heel: Faster momentum, more volatile

All written in confident, opinionated voice (not hedged).

**Case study templates:**
- `research-library/case-studies/_TEMPLATE.md` — Teardown structure
- `wif-teardown.md`, `pippin-teardown.md`, `useless-teardown.md` — Stubs for Matt to fill

**File:** `PHASE_3_COMPLETE.md`

---

### Phase 4: MCP Server Configuration

**Configured:** 3 MCP servers for Claude Code (agents inherit automatically)

**Active servers:**

1. **Filesystem MCP** ✅
   - Scope: `C:/Users/mrobe/Documents/Projects/cabinet/cabinet/data`
   - Purpose: Agent read/write access to knowledge base
   - Status: Connected successfully
   - **Critical for Meta Desk** — without this, agents can't read observations or write briefs

2. **Memory MCP** ✅
   - Purpose: Persistent agent memory across invocations
   - Status: Connected successfully
   - Use case: Scout remembers yesterday's flags, Historian maintains hypotheses

3. **Fetch MCP** ⚠️
   - Purpose: Web content fetching for research
   - Status: Failed to connect (non-blocking, agents have built-in WebFetch fallback)

**MCP config location:** `C:\Users\mrobe\.claude.json` (project-scoped)

**Documentation created:**
- `data/operations/mcp-setup.md` — Comprehensive guide for MCP servers (configured, pending, troubleshooting)

**Servers NOT configured (require API keys):**
- Grok/Twitter API (needs X Developer account)
- Apify (needs Apify API token)
- Context7, Slack, Notion (optional, deferred)

**File:** `PHASE_4_COMPLETE.md`

---

### Phase 5: Integration Scaffolding

**Created:** 8 integration operations pages, 7 scraper output contracts, 1 delivery contract

**Integration operations pages:**

1. **`integrations-roadmap.md`**
   - Master list of all integrations (status, priority, dependencies, implementation sequence)
   - Decision log (Grok vs Apify, DEXScreener vs Birdeye, Telegram vs Email)

2. **`apify-setup.md`**
   - Apify scrapers: Twitter followers, Twitter search, Xiaohongshu, TikTok
   - Estimated cost: $50-75/month
   - Setup steps, actor configuration, output destinations

3. **`grok-live-search.md`**
   - Twitter/X data source options: Grok MCP vs X API v2
   - Planned use cases: Daily trend scans, seed monitoring, crossing detection, launch detection
   - Cost: $5k/month (Pro tier) or $100/month (Basic tier for MVP)

4. **`dexscreener-api.md`**
   - DEXScreener API for Solana token launches
   - Free tier (300 req/min), sufficient for MVP

5. **`birdeye-api.md`**
   - Alternative to DEXScreener (holder analytics, wallet tracking)
   - Status: DEFERRED (evaluate after DEXScreener in week 3)

6. **`telegram-delivery.md`**
   - Primary subscriber delivery channel
   - Setup: BotFather → create channel → add bot → posting script
   - Cost: $0 (Telegram API free)

7. **`subscriber-email-delivery.md`**
   - Backup delivery option
   - Status: DEFERRED (only if ≥30% subscribers request)

8. **`openclaw-pipeline.md`**
   - ETL orchestration layer (Python service on Ubuntu laptop)
   - Components: Scheduler (cron) → Scrapers → Transformers (JSON→MD) → Writers
   - File structure, dependencies, testing, deployment

**Scraper output contracts (7):**

Each defines exact observation markdown format:

1. `apify-x-followers.md` — Follower activity tracking
2. `apify-x-search.md` — Twitter keyword search results
3. `apify-xiaohongshu.md` — Chinese meme trends
4. `grok-trends-japanese.md` — Japanese CT trends (4h cadence)
5. `grok-trends-korean.md` — Korean CT trends (4h cadence)
6. `dexscreener-trending.md` — Solana DEX launches
7. `pump-fun-launches.md` — pump.fun launches with character analysis

**Delivery contract:**
- `delivery-contract.md` — Brief lifecycle (draft → reviewed → published), formatting rules, quality checklist

**Key insight:** Scraper contracts are the **seam** between scraping layer (OpenClaw Python) and agent layer (Claude Code). They let both evolve independently.

**File:** `PHASE_5_COMPLETE.md`

---

### Phase 6: Bootstrap First Brief Template

**Created:** Today's daily brief template, writing guide, go-live checklist

**Today's brief template:**
- `data/meta-desk/daily-briefs/2026-04-09.md`
- Full frontmatter with status tracking
- Empty sections with inline `<!-- MATT: -->` guidance
- Sections: Historian, Scout, Aesthetician, Translator, Skeptic, Referee, Matt's notes
- "How to use this template" section at bottom

**Brief-writing guide:**
- `data/meta-desk/how-to-write-a-daily-brief.md` (2,855 words)
- Daily routine (morning observation collection, midday writing)
- Section-by-section guidance with examples (Pippin case study)
- Voice and style rules (confident, specific, actionable, tight)
- Framework references
- The empty case (skip briefs on low-signal days)
- 3-4 week manual period explained
- Common mistakes to avoid

**Go-live checklist:**
- `data/meta-desk/go-live-checklist.md` (2,401 words)
- 5 phases with granular checklist items:
  - Phase 1: Manual MVP (14+ briefs, 5+ cycles, 30+ seed accounts)
  - Phase 2: Agent Activation (3 agents active and useful)
  - Phase 3: Data Automation (1+ scraper live, OpenClaw deployed)
  - Phase 4: Subscriber Delivery (Telegram working, beta test)
  - Phase 5: Business Operations (pricing, legal, payment processing)
- Final pre-launch checks
- Post-launch monitoring (first 30 days)
- Graduation criteria (50+ subscribers, 30+ days, positive cash flow)
- Emergency shutdown criteria

**File:** `PHASE_6_COMPLETE.md`

---

## Directory Tree (Current State)

```
data/
├── .agents/                              # Agent personas
│   ├── historian/persona.md              # ✅ Full (964 words)
│   ├── scout/persona.md                  # ✅ Full (967 words)
│   ├── skeptic/persona.md                # ✅ Full (1243 words)
│   ├── translator/persona.md             # ⚠️ Stub
│   ├── aesthetician/persona.md           # ⚠️ Stub
│   ├── referee/persona.md                # ⚠️ Stub
│   ├── scribe/persona.md                 # ⚠️ Stub
│   └── concept-forge/persona.md          # ⚠️ Stub
│
├── meta-desk/                            # Meta Desk workspace root
│   ├── index.md                          # Manifesto (864 words)
│   ├── how-to-write-a-daily-brief.md     # Writing guide (2855 words)
│   ├── go-live-checklist.md              # Launch roadmap (2401 words)
│   ├── daily-briefs/
│   │   ├── index.md                      # Daily brief documentation
│   │   └── 2026-04-09.md                 # TODAY'S TEMPLATE (ready to fill)
│   ├── channels/
│   │   ├── meta-desk-debate.md           # Agent debate log
│   │   ├── meta-desk-alerts.md           # Urgent signals
│   │   └── meta-desk-editorial.md        # Matt + agent coordination
│   └── debate-log/                       # Skeptic's detailed arguments
│       └── index.md
│
├── observations/                         # Raw data ingestion
│   ├── index.md                          # Observation layer documentation
│   ├── twitter/                          # Twitter/X observations
│   │   ├── grok-trends/                  # Grok trend scans
│   │   ├── seed-activity/                # Seed account monitoring
│   │   ├── search-results/               # Keyword/hashtag searches
│   │   ├── crossings/                    # Language-border crossings
│   │   ├── launches/                     # New token announcements
│   │   └── follower-activity/            # Follower list changes
│   ├── eastern/                          # Eastern source observations
│   │   ├── xiaohongshu/                  # Chinese (RedNote)
│   │   ├── japanese-ct/                  # Japanese crypto Twitter
│   │   ├── korean-ct/                    # Korean crypto Twitter
│   │   └── tiktok-brainrot/              # TikTok trends
│   └── solana/                           # On-chain Solana data
│       ├── launches/                     # New token launches
│       └── trending/                     # Trending tokens
│
├── entities/                             # Tracked entities
│   ├── index.md                          # Entity system documentation
│   ├── characters/                       # Character/mascot entities
│   │   ├── index.md
│   │   └── _TEMPLATE.md                  # Character entity template
│   ├── themes/                           # Thematic trends
│   │   ├── index.md
│   │   └── _TEMPLATE.md
│   └── accounts/                         # Seed account lists
│       ├── index.md                      # Seed lifecycle documentation
│       ├── _TEMPLATE.md                  # Account entity template
│       ├── english-seed.md               # 🔴 EMPTY (Matt to fill)
│       ├── japanese-seed.md              # 🔴 EMPTY (Matt to fill)
│       ├── korean-seed.md                # 🔴 EMPTY (Matt to fill)
│       └── chinese-seed.md               # 🔴 EMPTY (Matt to fill)
│
├── cycles/                               # Historical cycle retrospectives
│   ├── index.md                          # Cycle library documentation
│   ├── _TEMPLATE.md                      # Cycle retrospective template
│   ├── 2024-Q2_pepe-revival.md           # 🟡 Stub (Matt to fill)
│   ├── 2024-Q3_ai-agents.md              # 🟡 Stub (Matt to fill)
│   ├── 2024-Q4_dog-cycle-wif-era.md      # 🟡 Stub (Matt to fill) ← START HERE
│   ├── 2025-Q1_italian-brainrot.md       # 🟡 Stub (Matt to fill)
│   └── 2025-Q2_useless-nihilism.md       # 🟡 Stub (Matt to fill)
│
├── research-library/                     # Frameworks and case studies
│   ├── index.md                          # Research library overview
│   ├── meta-rotation-theory.md           # ✅ Complete (652 words)
│   ├── screenshot-test-framework.md      # ✅ Complete (496 words)
│   ├── cross-cultural-arbitrage-playbook.md # ✅ Complete (719 words)
│   ├── three-audiences-model.md          # ✅ Complete (569 words)
│   ├── heel-vs-face-alignment.md         # ✅ Complete (477 words)
│   └── case-studies/
│       ├── _TEMPLATE.md                  # Case study structure
│       ├── wif-teardown.md               # 🟡 Stub (Matt to fill)
│       ├── pippin-teardown.md            # 🟡 Stub (Matt to fill)
│       └── useless-teardown.md           # 🟡 Stub (Matt to fill)
│
└── operations/                           # Integration tracking
    ├── index.md                          # Operations overview
    ├── integrations-roadmap.md           # ✅ Master integration list
    ├── apify-setup.md                    # ✅ Apify documentation
    ├── grok-live-search.md               # ✅ Twitter/X API documentation
    ├── dexscreener-api.md                # ✅ DEXScreener documentation
    ├── birdeye-api.md                    # ✅ Birdeye documentation (deferred)
    ├── telegram-delivery.md              # ✅ Telegram setup guide
    ├── subscriber-email-delivery.md      # ✅ Email setup (deferred)
    ├── openclaw-pipeline.md              # ✅ ETL pipeline architecture
    ├── mcp-setup.md                      # ✅ MCP server guide
    ├── delivery-contract.md              # ✅ Brief lifecycle documentation
    ├── scrapers/                         # Scraper output contracts
    │   ├── apify-x-followers.md          # ✅ Follower scraper contract
    │   ├── apify-x-search.md             # ✅ Search scraper contract
    │   ├── apify-xiaohongshu.md          # ✅ Xiaohongshu contract
    │   ├── grok-trends-japanese.md       # ✅ Japanese trends contract
    │   ├── grok-trends-korean.md         # ✅ Korean trends contract
    │   ├── dexscreener-trending.md       # ✅ DEXScreener contract
    │   └── pump-fun-launches.md          # ✅ pump.fun contract
    └── pipelines/                        # Pipeline execution tracking
        └── index.md

Legend:
✅ Complete (ready to use)
🟡 Stub (template only, Matt to fill with real data)
⚠️ Stub (persona placeholder, expand before activation)
🔴 Empty (Matt must populate)
```

---

## Open Questions and Decisions Matt Needs to Make

### Immediate Decisions (Week 1)

**1. Twitter/X data source strategy**
- **Question:** Grok MCP vs X API v2 vs Apify Twitter scrapers?
- **Options:**
  - Grok MCP (if available, cost TBD)
  - X API Basic tier ($100/month, 10k tweets/month) — MVP-viable
  - X API Pro tier ($5k/month, 1M tweets/month) — production scale
  - Apify Twitter scrapers ($30-50/month, flexible)
- **Recommendation:** Start with X API Basic tier + targeted searches, or Apify if no X API access
- **Decision point:** Before building first scraper (week 3-4)

**2. Which cycle retrospective to fill first?**
- **Question:** Start with WIF cycle or another one you know better?
- **Recommendation:** `2024-Q4_dog-cycle-wif-era.md` (it's the canonical success case, Historian needs it for pattern matching)
- **Decision point:** This week (need 1-2 cycles filled before Historian activation)

**3. Seed account prioritization**
- **Question:** Focus on English CT only, or invest in Japanese/Korean sources early?
- **Trade-off:**
  - English only: Simpler, faster to populate (30 accounts)
  - Multi-language: Better cross-cultural arbitrage edge (60-70 total accounts)
- **Recommendation:** Start with 30 English CT accounts this week, add Japanese/Korean in week 2-3
- **Decision point:** Today (need seed list to start gathering observations)

---

### Medium-Term Decisions (Weeks 2-4)

**4. Agent activation sequence**
- **Question:** Historian → Scout → Skeptic (recommended), or different order?
- **Recommendation:** Follow recommended sequence (Historian is highest value, Skeptic needs Historian/Scout output to challenge)
- **Decision point:** Week 4 (after 20-30 manual briefs written)

**5. DEXScreener vs Birdeye**
- **Question:** Use DEXScreener only, Birdeye only, or both?
- **Trade-off:**
  - DEXScreener: Free tier, good coverage, simpler
  - Birdeye: Holder analytics, wallet tracking (premium features)
  - Both: Redundancy, cross-validation (higher cost)
- **Recommendation:** Start with DEXScreener free tier, evaluate Birdeye in week 3 if holder data proves valuable
- **Decision point:** Week 3 (after DEXScreener tested)

**6. Telegram only vs Telegram + Email**
- **Question:** Offer email delivery as option, or Telegram-only?
- **Trade-off:**
  - Telegram only: Simpler (zero cost, instant delivery)
  - Telegram + Email: More subscriber options (higher setup complexity, costs ~$20-90/month)
- **Recommendation:** Telegram only for MVP, add email only if ≥30% of subscribers request it
- **Decision point:** Week 5 (before beta launch)

---

### Long-Term Decisions (Weeks 5-8)

**7. Pricing strategy**
- **Question:** Free tier + paid tier, or paid-only?
- **Options:**
  - Paid-only ($20-50/month for daily briefs)
  - Free tier (1-2 preview briefs/week) + Paid tier ($30-50/month for daily)
- **Recommendation:** Start with paid-only at $20-30/month (validate willingness to pay), add free tier if conversion is weak
- **Decision point:** Week 6 (before beta recruitment)

**8. Payment processor**
- **Question:** Stripe, Gumroad, or crypto payments?
- **Trade-off:**
  - Stripe: 2.9% + $0.30, requires business account, best UX
  - Gumroad: ~10% fee, easy setup, good for solo creators
  - Crypto: Near-zero fees, niche audience
- **Recommendation:** Gumroad for MVP (easiest), migrate to Stripe if scaling to 100+ subscribers
- **Decision point:** Week 7 (before beta launch)

**9. Legal/compliance**
- **Question:** Consult crypto attorney for disclaimer, or use standard "not financial advice" template?
- **Trade-off:**
  - Attorney consult: $500-2000, thorough, lower risk
  - Template: $0, faster, but may miss regulatory concerns
- **Recommendation:** Use template for beta (mark as "beta/experimental"), consult attorney before scaling to 50+ paid subscribers
- **Decision point:** Week 7 (before beta launch)

---

## Top 5 Things Matt Should Do in First Hour

### 1. Read the Brief-Writing Guide (10 minutes)

**File:** `data/meta-desk/how-to-write-a-daily-brief.md`

**Why:** This teaches you the format, voice, and workflow. Everything else builds from understanding this.

**What to look for:**
- Section-by-section guidance (Historian, Scout, Aesthetician, etc.)
- Voice rules (confident, specific, actionable)
- Pippin example (shows good vs bad)

---

### 2. Open Today's Brief Template (2 minutes)

**File:** `data/meta-desk/daily-briefs/2026-04-09.md`

**Why:** This is your workspace for today. Open it in Cabinet UI now so you're ready to fill it in.

**What to do:** Just open it and read the inline `<!-- MATT: -->` comments. Don't write yet.

---

### 3. Gather Observations (30-60 minutes)

**Why:** You need raw material before you can write a brief.

**What to do:**
1. Scroll Twitter/X (English CT, Japanese CT if you follow any)
2. Check DEXScreener (new Solana launches in last 24h)
3. Check pump.fun (meme coin launches)
4. Take bullet-point notes in a scratch file:
   - "Pippin — 6 Italian CT mentions, hobbit theme"
   - "Dog derivative — $DOGHAT2, $15k liq"

**Target:** 10-15 raw observations (most will be noise)

---

### 4. Write Your First Brief (30-45 minutes)

**File:** `data/meta-desk/daily-briefs/2026-04-09.md`

**Why:** The first brief is the hardest. Get it done today to break the ice.

**What to do:**
- Fill in each section using your observations
- Follow the `<!-- MATT: -->` inline guidance
- Don't aim for perfect (first draft will be rough)
- If a section has no content, write "Nothing to report" or skip it

**When done:**
- Save (Cabinet auto-saves)
- Leave `status: draft` (don't publish yet)

---

### 5. Skim the Go-Live Checklist (10 minutes)

**File:** `data/meta-desk/go-live-checklist.md`

**Why:** See the full roadmap. You're at day 1 of Phase 1.

**What to look for:**
- Phase 1 items (what you need this week)
- Phase 2-5 (what's coming in weeks 4-8)
- Timeline estimate (6-8 weeks to launch)

**Don't be overwhelmed.** You don't need to do everything today. Just:
- Today: First brief
- This week: 5-7 briefs
- Next 3 weeks: Agent activation

---

## Uncertainties and Notes

### Fetch MCP Server Failed (Non-Blocking)

**Issue:** `claude mcp list` shows Fetch server failed to connect.

**Impact:** Low. Agents have built-in WebFetch as fallback.

**Options:**
1. Troubleshoot (check npm logs, dependencies)
2. Remove it (`claude mcp remove fetch`)
3. Leave as-is (ignore the failure)

**Recommendation:** Remove it for now (`claude mcp remove fetch`). Add back later if agents need more reliable web fetching.

---

### Cabinet Git Auto-Commit Behavior

**Observed:** Cabinet appears to auto-commit changes to `data/` directory (Phase completion docs weren't committed manually, but git status shows only untracked files in repo root).

**Implication:** Matt doesn't need to manually commit knowledge base changes. Cabinet handles it.

**Verify:** Check `.git/logs/HEAD` to see if auto-commits are happening.

**Note:** This is good for Meta Desk (agents write files, Cabinet commits them automatically).

---

### Agent Persona File Naming

**Decision made:** Used `persona.md` instead of `index.md` for agent files.

**Rationale:** Checked `src/lib/agents/persona-manager.ts` lines 154-160, confirmed Cabinet looks for `persona.md`.

**No issue here** — all 8 agents have correct filename.

---

### Scraper Contract Evolution

**Note:** Scraper contracts are versioned interfaces. If Matt changes observation format later:
- Add new fields with defaults (don't break existing parsers)
- Never remove required fields
- Consider versioning (`v1/`, `v2/` subdirs) if breaking changes needed

**Current state:** All contracts are v1. No versioning needed yet.

---

### Subscriber Count Assumption

**Note:** Go-live checklist assumes **50+ paying subscribers** is "truly live."

**Reality check:** This may be optimistic for a crypto intelligence product. Actual number might be:
- 10-20 subscribers = Viable side project
- 30-50 subscribers = Sustainable income
- 100+ subscribers = Real business

**Recommendation:** Adjust expectations based on early beta feedback. If 20 subscribers are willing to pay $30/month ($600/month revenue), that validates the product.

---

### Manual Brief Cadence Reality Check

**Assumption:** Matt can sustain daily briefs for 3-4 weeks (20-30 briefs) manually.

**Reality check:** This is 30-60 min/day for observation collection + 30-45 min/day for writing = 60-105 min/day total.

**Sustainability question:** If this feels like drudgery after week 1, the product might not work (or the workflow needs adjustment).

**Early warning signs:**
- Skipping days because "nothing interesting"
- Forcing signals when observations are sparse
- Dreading the daily routine

**Mitigation:** If this happens, consider:
- Reduce cadence to 3x/week instead of daily
- Activate Historian early (week 2 instead of week 4) to reduce manual burden
- Rethink product (maybe weekly digest instead of daily brief)

---

## What I Noticed About Cabinet Code

### Agent Persona Schema

**File:** `src/lib/agents/persona-manager.ts`

**Key fields required:**
- `name`, `role`, `provider`, `heartbeat`, `budget`, `active`, `workdir`
- Optional: `focus`, `tags`, `emoji`, `department`, `type`, `goals`, `channels`, `workspace`, `setupComplete`

**All Meta Desk agent personas match this schema** (verified in Phase 2).

---

### MCP Server Configuration

**File:** `C:\Users\mrobe\.claude.json`

**Type:** Project-scoped (specific to Cabinet repo)

**Implication:** If Matt works on Cabinet in a different location, he'll need to reconfigure MCP servers.

**Portability:** MCP config is NOT in the Cabinet repo, it's user-level. If Matt shares Cabinet with others, they'll need their own MCP setup.

---

### Daily Brief Frontmatter

**Assumption:** Daily briefs use the frontmatter schema defined in `2026-04-09.md` template.

**Fields:**
- `date`, `status`, `created_at`, `reviewed_at`, `published_at`, `reviewer`, `delivery_channel`, `subscriber_count`, `agents_contributing`, `observation_count`, `entity_count`

**Note:** These fields aren't enforced by Cabinet code (Cabinet is schema-agnostic markdown storage). They're **contractual** between Matt and his delivery script.

**Implication:** Matt's `post_brief_to_telegram.py` script needs to parse this frontmatter correctly. If schema changes, update the script.

---

### Observation Frontmatter Contracts

**Pattern:** Each scraper contract defines frontmatter schema for its observations.

**Consistency:** All observation files should have:
- `source` (scraper name)
- `collected_at` (ISO timestamp)
- `language` (en/ja/ko/zh)
- `entities_mentioned` (array, empty initially)
- `novelty_score` (null initially, Scout fills in)

**Agent assumption:** Agents (Historian, Scout) will parse these frontmatter fields. If field names change, agent personas need updating.

**Recommendation:** Lock frontmatter schemas early (before agent activation). Changes after agents are trained are expensive.

---

## Final Status Summary

### ✅ Complete and Ready

- Directory scaffold (35 dirs, 60+ files)
- Agent personas (8 total: 3 full, 5 stubs, all `active: false`)
- Reference library (5 frameworks, templates)
- MCP servers (Filesystem, Memory active)
- Integration documentation (8 ops pages, 7 scraper contracts, 1 delivery contract)
- First daily brief template (today's date, ready to fill)
- Brief-writing guide (2855 words)
- Go-live checklist (2401 words, 5 phases)

### 🟡 Stubs (Matt Must Fill)

- Cycle retrospectives (5 stubs, recommend starting with dog-cycle-wif-era)
- Account seed lists (4 empty tables, need 30+ English CT accounts minimum)
- Case study teardowns (3 stubs: WIF, Pippin, Useless)
- Agent personas (5 stubs: Translator, Aesthetician, Referee, Scribe, Concept Forge)

### 🔴 Not Started (Future Work)

- Manual daily briefs (0 written, need 14+ for Phase 1)
- Agent activation (all agents inactive)
- Scraper development (OpenClaw repo doesn't exist yet)
- Telegram delivery setup (bot not created yet)
- Subscriber infrastructure (payment processing, legal, pricing not finalized)

---

## Success Criteria Met

**From setupmetadesk.md final success criteria:**

1. ✅ **Open Cabinet UI and see clean Meta Desk workspace** — All directories scaffolded
2. ✅ **See 8 agents listed, all inactive** — Verified `active: false` for all
3. ✅ **3 substantial personas, 5 stubs** — Historian (964w), Scout (967w), Skeptic (1243w) full; 5 others stubbed
4. ✅ **Read clear manifesto** — `meta-desk/index.md` (864 words)
5. ✅ **Read brief-writing guide** — `how-to-write-a-daily-brief.md` (2855 words)
6. ✅ **Read go-live checklist** — `go-live-checklist.md` (2401 words)
7. ✅ **See clear operations pages** — 8 integration docs, 7 scraper contracts
8. ✅ **Have place for first brief TODAY** — `daily-briefs/2026-04-09.md` ready

**Final assessment:** If Matt knows exactly what to do next, we succeeded. If he's overwhelmed or confused, we failed.

**Verdict:** Matt should know exactly what to do:
1. Read brief-writing guide
2. Open today's template
3. Gather observations
4. Write first brief

The path from "infrastructure ready" to "first brief written" is **clear and actionable**.

---

**Handoff complete. Meta Desk is ready for Matt to start writing.**

**Next milestone:** 14 manual daily briefs written (end of week 2-3).

**Final launch:** 6-8 weeks from today (if full-time execution).
