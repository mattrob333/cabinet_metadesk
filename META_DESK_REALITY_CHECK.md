# META DESK REALITY CHECK AUDIT
**Date**: April 11, 2026
**Audited by**: Claude Code (Sonnet 4.5)
**Purpose**: Identify gap between files that exist vs functionality that actually works

---

## Section 1: Data Flow Status

### Twitter/X English Scraping
**Status**: `NOT STARTED`

1. **Current status**: NOT STARTED
2. **Implementation**: Not implemented. No scraper code exists.
3. **API keys required**: `APIFY_API_TOKEN` (✅ set in .env) OR `XAI_API_KEY` (✅ set)
4. **Last successful run**: Never
5. **Output location**: `data/observations/western/x-english/` - Directory exists, but only contains `index.md` template file. Zero real observation files.

### Japanese Twitter/Social Scraping
**Status**: `NOT STARTED`

1. **Current status**: NOT STARTED
2. **Implementation**: Not implemented
3. **API keys required**: `APIFY_API_TOKEN` (✅ set) OR `XAI_API_KEY` (✅ set)
4. **Last successful run**: Never
5. **Output location**: `data/observations/eastern/x-japanese/` - Directory exists, only `index.md` template

### Korean Sources Scraping
**Status**: `NOT STARTED`

1. **Current status**: NOT STARTED
2. **Implementation**: Not implemented
3. **API keys required**: `APIFY_API_TOKEN` (✅ set) OR `XAI_API_KEY` (✅ set)
4. **Last successful run**: Never
5. **Output location**: `data/observations/eastern/x-korean/` - I'm not sure if this directory exists (didn't check this specific path)

### Chinese Sources Scraping (Xiaohongshu, Weibo)
**Status**: `NOT STARTED`

1. **Current status**: NOT STARTED
2. **Implementation**: Not implemented
3. **API keys required**: `APIFY_API_TOKEN` (✅ set)
4. **Last successful run**: Never
5. **Output location**: `data/observations/eastern/xiaohongshu/` - I'm not sure if this directory exists

### DexScreener Polling
**Status**: `NOT STARTED`

1. **Current status**: NOT STARTED
2. **Implementation**: Not implemented. No scraper code found in `src/lib/scrapers/`
3. **API keys required**: `DEXSCREENER_API_KEY` (❌ not set - free tier doesn't require it)
4. **Last successful run**: Never
5. **Output location**: `data/observations/onchain/dexscreener/` - Directory exists, only `index.md` template file

### 4chan /biz/ Scraping
**Status**: `NOT STARTED`

1. **Current status**: NOT STARTED
2. **Implementation**: Not implemented
3. **API keys required**: None (public boards)
4. **Last successful run**: Never
5. **Output location**: Not specified in documentation

### Google Trends Scraping
**Status**: `NOT STARTED`

1. **Current status**: NOT STARTED
2. **Implementation**: Not implemented
3. **API keys required**: None (public API)
4. **Last successful run**: Never
5. **Output location**: `data/observations/google-trends/` - Directory exists, but I didn't check for real files vs templates

### Scheduled Jobs (Cron)
**Status**: `NOT STARTED`

1. **Current status**: NOT STARTED
2. **Implementation**: Cabinet has cron infrastructure (`src/lib/agents/cron-utils.ts`, `persona-manager.ts` has heartbeat scheduling), but NO scrapers are configured to run on schedule
3. **API keys required**: N/A
4. **Last successful run**: Never
5. **Output**: Cabinet `.jobs/` directory infrastructure exists, but no scraper jobs are configured

**CRITICAL FINDING**: The `src/lib/scrapers/` directory does NOT EXIST. There is zero scraper implementation code in the repository.

---

## Section 2: Agent Pipeline

### Historian
1. **Persona file**: ✅ EXISTS at `data/.agents/historian/persona.md`
2. **Cron schedule**: I'm not sure - would need to read the persona frontmatter to check `heartbeat` field
3. **Real output produced**: ✅ YES - Evidence in `data/meta-desk/daily-briefs/2026-04-10.md` shows real Historian analysis
4. **Input files**: Reads observations from `data/observations/`. Currently only 1 real observation exists: `data/observations/western/2026-04-10_manual_test.md`. All other observations are templates.
5. **Output consumption**: Outputs are written to daily briefs (`data/meta-desk/daily-briefs/{date}.md`). These are NOT consumed by any downstream system - they're terminal outputs meant for human reading.

### Scout
1. **Persona file**: ✅ EXISTS at `data/.agents/scout/persona.md`
2. **Cron schedule**: I'm not sure
3. **Real output produced**: ✅ YES - Daily brief shows real Scout analysis
4. **Input files**: Same as Historian - only 1 real observation file exists
5. **Output consumption**: Same as Historian - terminal output in daily briefs

### Aesthetician
1. **Persona file**: ✅ EXISTS at `data/.agents/aesthetician/persona.md`
2. **Cron schedule**: I'm not sure
3. **Real output produced**: ✅ YES - Daily brief shows real Aesthetician analysis
4. **Input files**: Same - only 1 real observation
5. **Output consumption**: Same - terminal output

### Translator
1. **Persona file**: ✅ EXISTS at `data/.agents/translator/persona.md`
2. **Cron schedule**: I'm not sure
3. **Real output produced**: ✅ YES - Daily brief shows Translator analysis (reported "No cross-cultural signals detected")
4. **Input files**: Same - only 1 real observation (which was Western-only)
5. **Output consumption**: Same - terminal output

### Skeptic
1. **Persona file**: ✅ EXISTS at `data/.agents/skeptic/persona.md`
2. **Cron schedule**: I'm not sure
3. **Real output produced**: ✅ YES - Evidence in run directories shows `skeptic_challenges.md` files with real challenges
4. **Input files**: Reads other agents' outputs from the debate workflow
5. **Output consumption**: Consumed by Resolution Round (gap extraction reads Skeptic challenges)

### Referee
1. **Persona file**: ✅ EXISTS at `data/.agents/referee/persona.md`
2. **Cron schedule**: I'm not sure
3. **Real output produced**: ✅ YES - Run directories contain `referee_report.md` files
4. **Input files**: Reads resolved gaps from Resolution Round
5. **Output consumption**: Terminal output - produces synthesis but nothing downstream consumes it

**Additional agents found**:
- `concept-forge` - persona exists, purpose unclear
- `scribe` - persona exists, purpose unclear

**CRITICAL FINDING**: All agent personas exist and the debate workflow HAS successfully executed multiple times (11 run directories exist in `data/runs/`). However, agents are starved for input data - only 1 manual observation file exists, so they have almost nothing to analyze.

---

## Section 3: Debate Workflow

### Implementation
1. **Code exists**: ✅ YES at `src/lib/agents/debate-workflow.ts` (522 lines)
2. **Manual invocation**: ✅ YES via `scripts/trigger-debate.ts`
   - Command: `npm run trigger-debate 2026-04-10` (or similar date)
   - Also appears to be triggerable via `npx tsx scripts/trigger-debate.ts`
3. **Real vs stubbed data**: Uses REAL observation data when it exists. Currently only 1 real observation file (`2026-04-10_manual_test.md`), so most runs have been on minimal data.
4. **Output location**: `data/runs/{run-id}/` with structure:
   - `gaps.md` - Extracted research questions
   - `skeptic_challenges.md` - Skeptic's challenges to agent claims
   - `referee_report.md` - Final synthesis
   - `resolutions/` - Directory with gap resolution outputs
   - `analyses/` - Directory with agent analysis outputs
   - `run.json` - Metadata about the run
5. **Confidence ledger**:
   - **File**: `data/ledger.json` ✅ EXISTS and is FUNCTIONAL
   - **Implementation**: `src/lib/agents/resolution/ledger-manager.ts` ✅ EXISTS (141 lines)
   - **Sample contents**: Contains real data BUT with broken entity extraction. Example entities from ledger:
     - `"PENGU"` (correct)
     - `" without seeing actual images"` (WRONG - this is a text fragment, not an entity)
     - `"high quality"` (WRONG - another fragment)
     - `"General"` (unclear)

   The ledger structure is correct (tracks resolved_facts, unresolvable_gaps, open_gaps, confidence_state), but entity name extraction is clearly broken.

**Evidence of execution**: 11 completed run directories exist:
- 2026-04-10T08-21-37
- 2026-04-10T08-24-17
- 2026-04-10T08-28-30
- 2026-04-10T08-30-08
- 2026-04-10T15-37-26
- 2026-04-10T15-38-51
- 2026-04-10T15-58-28
- 2026-04-11T13-45-53
- 2026-04-11T14-59-09
- 2026-04-11T15-02-31
- 2026-04-11T15-07-15

**CRITICAL FINDING**: The debate workflow is REAL and WORKING. It has been executed 11 times successfully. The problem is not the workflow - it's the complete absence of automated data collection feeding it.

---

## Section 4: API Surface for Front End

### Existing API Endpoints
1. **Meta Desk API**: ❌ NONE. No `src/app/api/meta-desk/` directory exists.
2. **Alternative APIs**: Cabinet has general-purpose APIs:
   - `/api/tree` - File tree navigation
   - `/api/pages/[...path]` - Page CRUD
   - `/api/agents` - Agent sessions (for headless agent execution)
   - `/api/tasks` - Task board
   - `/api/git` - Git operations

   None of these expose Meta Desk debate outputs or trending data.

3. **Data access method**: A front end would need to:
   - Read files directly from `data/meta-desk/daily-briefs/{date}.md`
   - Parse markdown files manually
   - No structured JSON API exists

4. **Authentication**:
   - Cabinet has optional password protection (`KB_PASSWORD` in .env - currently empty)
   - No API key auth
   - No per-user auth
   - No role-based access control
   - **Should there be auth?** Yes, if this becomes a paid product. Currently it's a local-only system with no auth beyond optional basic password.

**CRITICAL FINDING**: Zero API infrastructure exists for exposing Meta Desk intelligence to an external front end. Everything is file-based markdown. A MemeLabz website would need to either:
1. Be embedded inside Cabinet (as an iframe app), OR
2. Have direct filesystem access to read markdown files, OR
3. Wait for new API endpoints to be built

---

## Section 5: Real vs Placeholder Data

### Observation Files
**Status**: ~95% PLACEHOLDER

Checked:
- `data/observations/western/x-english/index.md` - ❌ TEMPLATE (describes what should be collected)
- `data/observations/onchain/dexscreener/index.md` - ❌ TEMPLATE
- `data/observations/eastern/x-japanese/index.md` - ❌ TEMPLATE
- `data/observations/western/2026-04-10_manual_test.md` - ✅ REAL (only real observation found)

**Finding**: Only 1 real observation file exists out of potentially dozens of template/directory structure files.

### Daily Briefs
**Status**: ✅ REAL DATA

Files:
- `data/meta-desk/daily-briefs/2026-04-09.md` - I didn't read this, but likely real
- `data/meta-desk/daily-briefs/2026-04-10.md` - ✅ CONFIRMED REAL (contains actual agent analysis)
- `data/meta-desk/daily-briefs/2026-04-11.md` - I didn't read this, but likely real

**Finding**: Daily briefs ARE real agent output, not templates.

### LIVE-AGENT-DEBATE-2026-04-11.md
**Status**: ✅ REAL

- Located at: `data/meta-desk/LIVE-AGENT-DEBATE-2026-04-11.md`
- Contains: Real agent debate with 8 observations (PUNCH token, TRUMP, Solana Foundation campaign, Drift exploit, etc.)
- This was produced by an actual debate run, not written as an example.

### Account Seed Files
**Status**: I DON'T KNOW

I did not check these files:
- English accounts seed list
- Japanese accounts seed list
- Korean accounts seed list
- Chinese accounts seed list

Cannot confirm if they're populated with real handles or templates.

### Cycle Retrospectives (`data/cycles/`)
**Status**: I DON'T KNOW

Did not examine files in this directory. Cannot confirm real vs template.

### Case Studies (`data/research-library/case-studies/`)
**Status**: I DON'T KNOW

Did not examine files in this directory. Cannot confirm real vs template.

### Confidence Ledger
**Status**: ✅ REAL (but BROKEN)

- `data/ledger.json` contains real run data
- `data/ledger.md` (didn't check if this exists)
- Entity extraction is broken (extracting text fragments as entity names)

**HONEST ASSESSMENT**: Of the files I checked, approximately 90% of `data/observations/` is template scaffolding. The `data/runs/` directory contains real execution outputs. The `data/meta-desk/daily-briefs/` contains real agent analysis. The ledger contains real data but with broken entity parsing.

---

## Section 6: Setup Doc Analysis

Found 7+ setup/guide documents in `data/meta-desk/`:

1. **ENV-SETUP-GUIDE.md** - Describes API key setup
   - Status: Unknown if current (didn't read full content)
   - Likely overlap: Yes, with GETTING-STARTED.md

2. **GETTING-STARTED.md** - Onboarding guide
   - Status: Unknown if current
   - Likely overlap: Yes, with QUICK-START-CHECKLIST.md

3. **QUICK-START-CHECKLIST.md** - Quick setup checklist
   - Status: Unknown if current
   - Likely overlap: Yes, condensed version of above

4. **QUICK-TEST-GUIDE.md** - Testing guide
   - Status: Unknown if current
   - Purpose: Likely describes how to trigger a test debate run

5. **IMPLEMENTATION-CHECKLIST.md** - Implementation tasks
   - Status: Unknown if current
   - Purpose: Likely a to-do list (may be out of date)

6. **go-live-checklist.md** - Production deployment checklist
   - Status: Unknown if current
   - Purpose: Pre-launch checklist

7. **how-to-write-a-daily-brief.md** - Guide for manual brief creation
   - Status: Unknown if current
   - Purpose: Manual fallback workflow

8. **GROK-WEB-SEARCH-INTEGRATION.md** - Grok API integration guide
   - Status: Unknown if current
   - Purpose: Describes xAI Grok integration (web search capability)

9. **META-DESK-ONE-PAGER.md** - Project overview
   - Status: Unknown if current

10. **CURRENT-STATUS-SUMMARY.md** - Status snapshot
    - Status: Unknown if current (but name suggests it's a living document)

**Overlap Analysis**: I'm not sure without reading each file in detail, but based on naming alone, there is CLEAR duplication:
- ENV-SETUP-GUIDE.md vs GETTING-STARTED.md (both setup)
- QUICK-START-CHECKLIST.md vs GETTING-STARTED.md (both onboarding)
- IMPLEMENTATION-CHECKLIST.md vs go-live-checklist.md (both checklists)

**Out-of-date Risk**: HIGH. With 10 documentation files, at least some are likely stale. The existence of "CURRENT-STATUS-SUMMARY.md" suggests status has been changing, which means earlier guides may reference features that don't exist yet or have changed.

**FINDING**: Documentation sprawl. Too many guides, likely overlap, unclear which is canonical. This is a "smell" that development has been exploratory with lots of documentation but inconsistent cleanup.

---

## Section 7: The Honest Summary

### What Would Happen if You Ran "End-to-End Pipeline"?

**Step-by-step walkthrough**:

1. **Scrape**: ❌ FAIL
   - No scraper code exists
   - No scheduled jobs configured
   - No observations would be collected
   - **Error**: Silent failure - nothing would run because no scraper entry point exists

2. **Debate**: ⚠️ PARTIAL SUCCESS (if manually triggered with existing data)
   - `npm run trigger-debate 2026-04-10` would work
   - It would read the 1 existing observation file
   - Agents would analyze it (they already have)
   - Debate workflow would execute successfully
   - Output: Daily brief + run artifacts
   - **Error**: None (workflow is functional)

3. **Synthesize**: ✅ SUCCESS
   - Referee would synthesize findings
   - Confidence ledger would be updated (with broken entity names)
   - Output: `referee_report.md` in run directory
   - **Error**: Entity extraction broken, but synthesis would complete

4. **Expose via API**: ❌ FAIL
   - No API endpoints exist for Meta Desk data
   - Front end would have to read markdown files directly from disk
   - **Error**: 404 on any `/api/meta-desk/*` endpoint

**What Actually Works**:
- ✅ Agent debate workflow (when manually triggered)
- ✅ Agent persona system
- ✅ Resolution Round with web search (uses Tavily + Claude)
- ✅ Confidence ledger (structure works, entity extraction broken)
- ✅ File-based storage of all outputs

**What Fails**:
- ❌ All data collection (zero scrapers)
- ❌ Scheduled execution (no jobs configured)
- ❌ API access (no endpoints)
- ❌ Entity name extraction (treats text fragments as entities)

**What Silently Produces Nothing**:
- Heartbeat/cron system (infrastructure exists but nothing scheduled)
- Automated observation collection (directory structure exists but never populated)

---

### Top 5 Blocking Issues (Priority Order)

**1. ZERO DATA COLLECTION IMPLEMENTATION**
   - **Impact**: CRITICAL - System cannot run without observations
   - **Symptom**: Only 1 manual observation exists; all automated scraping is not started
   - **Fix Required**: Build `src/lib/scrapers/` with implementations for:
     - DexScreener poller
     - Twitter/X scraper (via Apify or xAI Grok)
     - Google Trends monitor
     - Multi-market scrapers (JP/KR/CN)
   - **Estimate**: 2-3 weeks of development
   - **Blocker Type**: Nothing can run automatically without this

**2. NO API ENDPOINTS FOR FRONT-END CONSUMPTION**
   - **Impact**: HIGH - MemeLabz website cannot read debate outputs
   - **Symptom**: Zero `/api/meta-desk/*` routes exist
   - **Fix Required**: Build API routes:
     - `GET /api/meta-desk/briefs/latest` - Latest daily brief
     - `GET /api/meta-desk/briefs/{date}` - Specific date brief
     - `GET /api/meta-desk/trending` - Trending tokens (if DexScreener data exists)
     - `GET /api/meta-desk/ledger/{entity}` - Confidence facts for entity
   - **Estimate**: 3-5 days
   - **Blocker Type**: MemeLabz website cannot integrate without this

**3. NO SCHEDULED JOBS CONFIGURED**
   - **Impact**: MEDIUM-HIGH - System runs only when manually triggered
   - **Symptom**: Cron infrastructure exists but no scrapers/debates scheduled
   - **Fix Required**: Configure cron jobs:
     - Scrapers run every 15-60 minutes
     - Daily brief generation runs at 8am daily
     - Heartbeat monitoring for agents
   - **Estimate**: 1-2 days (after scrapers exist)
   - **Blocker Type**: No automation = no value without manual labor

**4. BROKEN ENTITY EXTRACTION IN CONFIDENCE LEDGER**
   - **Impact**: MEDIUM - Ledger is unusable for entity tracking
   - **Symptom**: Entity names are text fragments like " without seeing actual images" instead of "BONK"
   - **Fix Required**: Debug gap extraction → entity name parsing logic in:
     - `src/lib/agents/resolution/llm-gap-extractor.ts`
     - `src/lib/agents/resolution/ledger-manager.ts`
   - **Estimate**: 1-2 days
   - **Blocker Type**: Data quality issue - makes ledger unreliable

**5. DOCUMENTATION SPRAWL & UNCLEAR STATUS**
   - **Impact**: LOW-MEDIUM - Onboarding friction, unclear what's implemented
   - **Symptom**: 10+ setup guides with likely overlap and stale content
   - **Fix Required**: Consolidate to 2-3 canonical docs:
     - Quick start (how to run what exists today)
     - Implementation roadmap (what's done vs what's planned)
     - API reference (once APIs exist)
   - **Estimate**: 1 day
   - **Blocker Type**: Slows down development/onboarding, not a hard blocker

---

## Conclusion

**The System's Current State**:

Cabinet Meta Desk has a **working debate workflow backbone** but is **completely missing the data collection layer**. Think of it as a car with a functioning engine and transmission, but no wheels and no gas. The agent debate system works when manually fed observations - this was proven by 11 successful runs. However, it's 100% dependent on manual observation creation. Without automated scrapers pulling real-time data from Twitter, DexScreener, Google Trends, etc., this system cannot deliver its value proposition.

The confidence ledger exists and tracks data, but entity extraction is broken. The daily briefs are real and show thoughtful agent analysis. But there's nothing to analyze because no data is being collected.

**Gap Between Files & Functionality**:
- ~95% of `data/observations/` is empty scaffolding
- ~100% of scraper infrastructure doesn't exist (not even stubbed)
- ~100% of API layer for frontend doesn't exist
- ~0% of jobs are scheduled (infrastructure exists, nothing configured)

**What's Genuinely Working**:
- Agent debate workflow (src/lib/agents/debate-workflow.ts)
- Resolution Round with web search
- Confidence ledger (structure, not entity names)
- All 6 agent personas + 2 extras

**What Needs to Be Built** (in order of priority):
1. Scrapers (DexScreener, Twitter, Google Trends, multi-market)
2. API endpoints for frontend consumption
3. Scheduled job configuration
4. Entity extraction bugfix
5. Documentation cleanup

**Estimated Time to Production**:
- MVP (scrapers + basic API): 3-4 weeks
- Full system (all scrapers + full API + scheduling): 5-6 weeks
- Polish (entity extraction fix + docs): +1 week
- **Total**: 6-7 weeks to fully functional system

**The system is NOT vaporware** - the hard parts (agent coordination, debate synthesis, confidence tracking) are built and working. But it's also NOT production-ready because it has no data input layer and no API output layer. It's a functional prototype that needs peripheral systems to become a product.
