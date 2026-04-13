# First Slice Implementation Plan
**Scope**: DexScreener scraper → observations → API → MemeLabz (NO debate workflow)
**Estimated Total Time**: 2-3 hours
**Date**: April 11, 2026
**Revision**: Scope reduced - debate workflow deferred to separate task

---

## 1. Files to Create

### Scraper Layer
1. **`src/lib/scrapers/dex-trending-monitor.ts`** (NEW)
   - DexScreener API client
   - Polls trending Solana tokens
   - Writes observations to markdown files
   - ~150-200 lines

2. **`src/lib/scrapers/observation-writer.ts`** (NEW)
   - Shared utility for writing observation files
   - Handles frontmatter formatting
   - Ensures consistent observation structure
   - ~80-100 lines

3. **`scripts/run-dex-scraper.ts`** (NEW)
   - CLI entry point for manual scraper execution
   - Useful for testing before scheduling
   - ~30-40 lines

### API Layer
4. **`src/app/api/meta-desk/context-bundle/route.ts`** (NEW)
   - GET endpoint for latest intelligence package
   - Returns structured JSON for MemeLabz consumption
   - Includes CORS headers for cross-origin requests
   - ~80-100 lines (simplified without debate/ledger)

5. **`src/app/api/meta-desk/health/route.ts`** (NEW)
   - GET endpoint for health check
   - Returns scraper status and latest observation info
   - ~40-50 lines

6. **`src/lib/meta-desk/context-bundle-builder.ts`** (NEW)
   - Business logic for assembling context bundle
   - Reads latest DexScreener observation only (no brief, no ledger)
   - Formats for API response
   - ~60-80 lines (simplified)

### Configuration
7. **`src/lib/scrapers/types.ts`** (NEW)
   - TypeScript interfaces for scraper data
   - Observation types, DexScreener response types
   - ~50-70 lines

---

## 2. Files to Modify

1. **`.env`** (MODIFY - add example env var)
   - Add: `DEXSCREENER_POLL_INTERVAL_MINUTES=15`
   - Add: `DEXSCREENER_MIN_VOLUME_USD=10000`
   - Document: Free tier doesn't need API key

2. **`.env.example`** (MODIFY - document new vars)
   - Add DexScreener configuration section
   - Document polling interval and filtering options

3. **`package.json`** (MODIFY - add npm scripts)
   - Add: `"scrape:dex": "tsx scripts/run-dex-scraper.ts"`
   - Add: `"scrape:test": "tsx scripts/run-dex-scraper.ts --dry-run"`

4. **`data/observations/onchain/dexscreener/index.md`** (MODIFY - update template)
   - Currently: describes what SHOULD be collected
   - Update: add "Last scraped" timestamp
   - Add: link to latest observation files

---

## 3. API Contract: DexScreener Observation Format

### File Naming Convention
```
data/observations/onchain/dexscreener/2026-04-11T14-30-00.md
```
- ISO timestamp in filename
- One file per scraper run (batch of trending tokens)
- NOT one file per token (to avoid file explosion)

### Frontmatter Schema
```yaml
---
source: dexscreener
collected_at: "2026-04-11T14:30:00Z"
language: en
entities: ["WIF", "BONK", "POPCAT"]  # Token tickers found
confidence: 1.0                       # On-chain data is high confidence
scraper_version: "1.0"
tokens_found: 10
api_endpoint: "https://api.dexscreener.com/latest/dex/tokens/solana"
---
```

### Body Structure
```markdown
# DexScreener Trending - 2026-04-11 14:30 UTC

Scraped 10 trending Solana tokens with >$10K 24h volume.

## Trending Tokens (Top 10)

### 1. WIF (dogwifhat)
- **Contract**: `EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm`
- **Price**: $2.34 (+12.5% 24h)
- **Volume 24h**: $4.2M
- **Liquidity**: $1.8M
- **Market Cap**: $234M
- **Holders**: 45,231
- **Created**: 2023-11-20
- **DexScreener**: https://dexscreener.com/solana/...

**Why Trending**: Volume spike +180% vs 7-day avg. New CEX listing rumors on Twitter.

### 2. BONK
- **Contract**: `DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263`
- **Price**: $0.000021 (+8.3% 24h)
- **Volume 24h**: $12.1M
- **Liquidity**: $3.4M
- **Market Cap**: $1.2B
- **Holders**: 128,492
- **Created**: 2022-12-25
- **DexScreener**: https://dexscreener.com/solana/...

**Why Trending**: Steady accumulation. Community proposal for DAO grants passed.

[... 8 more tokens in same format ...]

---

## Metadata

- **Total Volume (all 10)**: $45.3M
- **Avg Price Change 24h**: +15.2%
- **New Tokens (< 7 days old)**: 2
- **Tokens w/ >100K holders**: 3
- **Next Scrape**: 2026-04-11T15:00:00Z
```

### Key Design Decisions
1. **Batch format**: One file per run (not per token) because:
   - Reduces file count (10 tokens/hour = 240 files/day is too many)
   - Captures market snapshot (comparative context matters)
   - Easier for agents to consume (one file = one market state)

2. **"Why Trending" field**: Not from DexScreener API - this is derived by:
   - Comparing 24h volume to 7-day average
   - Noting unusual price movements
   - Adding context from social signals (if available)

3. **Confidence always 1.0**: On-chain data is verifiable, so max confidence

---

## 4. API Contract: GET /api/meta-desk/context-bundle

### Endpoint
```
GET /api/meta-desk/context-bundle
GET /api/meta-desk/context-bundle?date=2026-04-11
```

### CORS Configuration
**Allowed Origins**:
- `https://memelabz.fun` (production)
- `https://*.memelabz.fun` (any subdomain)
- `http://localhost:*` (any local dev port)

**Headers Set**:
```
Access-Control-Allow-Origin: <matching origin>
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

### Query Parameters
- `date` (optional): YYYY-MM-DD format. Defaults to today.

### Response Schema (JSON)
```json
{
  "date": "2026-04-11",
  "generated_at": "2026-04-11T14:35:22Z",
  "status": "complete",
  "sections": {
    "brief": null,
    "trending": {
      "last_updated": "2026-04-11T14:30:00Z",
      "source": "dexscreener",
      "tokens": [
        {
          "rank": 1,
          "ticker": "WIF",
          "name": "dogwifhat",
          "contract": "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
          "price_usd": 2.34,
          "price_change_24h_pct": 12.5,
          "volume_24h_usd": 4200000,
          "market_cap_usd": 234000000,
          "liquidity_usd": 1800000,
          "holder_count": 45231,
          "dexscreener_url": "https://dexscreener.com/solana/...",
          "why_trending": "Volume spike +180% vs 7-day avg. New CEX listing rumors."
        },
        {
          "rank": 2,
          "ticker": "BONK",
          "name": "Bonk",
          "contract": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
          "price_usd": 0.000021,
          "price_change_24h_pct": 8.3,
          "volume_24h_usd": 12100000,
          "market_cap_usd": 1200000000,
          "liquidity_usd": 3400000,
          "holder_count": 128492,
          "dexscreener_url": "https://dexscreener.com/solana/...",
          "why_trending": "Steady accumulation. DAO grants proposal passed."
        }
        // ... up to 10 tokens
      ]
    },
    "ledger": null
  },
  "metadata": {
    "debate_workflow_status": "not_integrated",
    "observations_processed": 1,
    "last_scrape": "2026-04-11T14:30:00Z",
    "scraper_version": "1.0"
  }
}
```

### Response Status Codes
- `200 OK`: Context bundle successfully generated
- `404 Not Found`: No data for requested date
- `500 Internal Server Error`: Failed to read files or parse data

### Error Response Schema
```json
{
  "error": "No daily brief found for date 2026-04-10",
  "date": "2026-04-10",
  "suggestions": [
    "Try today's date (2026-04-11)",
    "Check if debate workflow has run today"
  ]
}
```

### Key Design Decisions
1. **Brief and ledger are null in this slice**: Debate workflow is not integrated yet. Set to null to make it explicit that these sections are not available. Metadata includes `debate_workflow_status: "not_integrated"` to explain why.

2. **Trending is the only populated section**: DexScreener data is real and available. This slice proves the scraper → API pipeline works end-to-end.

3. **`why_trending` field**: Added value - not just raw DexScreener data, but editorial context about why this token is moving.

4. **CORS enabled from day one**: MemeLabz will be hosted on a different origin than Cabinet, so cross-origin requests must work immediately.

---

## 4.1 API Contract: GET /api/meta-desk/health

### Endpoint
```
GET /api/meta-desk/health
```

### Purpose
Health check endpoint that returns scraper status. Always returns HTTP 200 (never 404 or 500) because its job is to report status, not to succeed at a business operation.

### Response Schema (JSON)
**Success Case** (observations exist):
```json
{
  "status": "ok",
  "last_scrape": "2026-04-11T14:30:00Z",
  "observations_count": 10,
  "latest_observation_file": "data/observations/onchain/dexscreener/2026-04-11T14-30-00.md"
}
```

**Pending Case** (no observations yet):
```json
{
  "status": "pending",
  "last_scrape": null,
  "observations_count": 0,
  "latest_observation_file": null,
  "message": "No observations collected yet. Run scraper first."
}
```

**Error Case** (cannot read directory):
```json
{
  "status": "error",
  "last_scrape": null,
  "observations_count": 0,
  "latest_observation_file": null,
  "reason": "Cannot read observations directory: ENOENT"
}
```

### HTTP Status
Always `200 OK` - even for error cases. This endpoint reports status, it doesn't fail.

---

## 5. Verification Steps (Concrete, Not Abstract)

### Step 1: DexScreener API Test (5 min)
**Action**:
```bash
curl "https://api.dexscreener.com/latest/dex/tokens/solana" | jq '.pairs[0:3]'
```

**Expected Result**: JSON response with Solana token pairs, including:
- `chainId: "solana"`
- `dexId: "raydium"` or `"orca"` etc.
- `priceUsd`, `volume.h24`, `liquidity.usd`

**Pass Criteria**: Response is 200 OK, contains at least 5 token pairs, data looks reasonable (prices > 0, volumes > 0)

**Fail**: If API is down or requires auth (it shouldn't), adjust to use free tier endpoints

---

### Step 2: Scraper Dry Run (10 min)
**Action**:
```bash
npm run scrape:test
```

**Expected Result**: Console output showing:
```
[DexScreener] Fetching trending Solana tokens...
[DexScreener] Found 47 pairs
[DexScreener] Filtered to 10 with volume >$10K
[DexScreener] Top token: WIF ($2.34, $4.2M vol)
[DRY RUN] Would write to: data/observations/onchain/dexscreener/2026-04-11T14-30-00.md
[DRY RUN] Observation preview:
---
source: dexscreener
collected_at: "2026-04-11T14:30:00Z"
...
```

**Pass Criteria**:
- No errors
- Shows 10 tokens
- File path is correct format
- Preview shows proper frontmatter + markdown body

**Fail**: If fewer than 10 tokens, lower volume threshold. If API errors, check endpoint URL.

---

### Step 3: Real Scraper Run (5 min)
**Action**:
```bash
npm run scrape:dex
```

**Expected Result**:
1. Console shows success message
2. File created at `data/observations/onchain/dexscreener/2026-04-11T14-XX-XX.md`

**Verification**:
```bash
ls -lah data/observations/onchain/dexscreener/
cat data/observations/onchain/dexscreener/2026-04-11T*.md | head -50
```

**Pass Criteria**:
- File exists with today's date
- File is >2KB (not empty or stub)
- Contains 10 token sections
- Each token has contract address, price, volume
- Frontmatter has `entities: [...]` with token tickers

**Fail**: If file is empty, check write permissions. If data is wrong, debug scraper logic.

---

### Step 4: API Health Check Test (3 min)
**Action**:
```bash
# Start dev server (if not running)
npm run dev

# In another terminal:
curl http://localhost:3000/api/meta-desk/health | jq '.'
```

**Expected Result**:
```json
{
  "status": "ok",
  "last_scrape": "2026-04-11T14:30:00Z",
  "observations_count": 10,
  "latest_observation_file": "data/observations/onchain/dexscreener/2026-04-11T14-30-00.md"
}
```

**Pass Criteria**:
- HTTP 200 status (always, even if no data)
- `status` is "ok" (since we just ran scraper in step 3)
- `last_scrape` timestamp matches observation file from step 3
- `observations_count` is 10
- `latest_observation_file` path is correct

**Fail**: If 404, route file doesn't exist. If 500, check console error. If `status: "pending"`, scraper didn't write file.

---

### Step 5: API Context Bundle Test (5 min)
**Action**:
```bash
curl http://localhost:3000/api/meta-desk/context-bundle | jq '.'
```

**Expected Result**: JSON response matching schema

**Pass Criteria**:
- HTTP 200 status
- `sections.brief` is `null`
- `sections.ledger` is `null`
- `sections.trending.tokens` has 10 items
- `sections.trending.tokens[0].ticker` matches top DexScreener token (e.g., "WIF")
- `metadata.debate_workflow_status` is `"not_integrated"`
- `metadata.last_scrape` matches health endpoint timestamp

**Fail**: If 404, check route file exists. If 500, check console for error. If trending is empty, check file reading logic.

---

### Step 6: API Date Parameter Test (3 min)
**Action**:
```bash
curl "http://localhost:3000/api/meta-desk/context-bundle?date=2026-04-10" | jq '.date'
```

**Expected Result**: Returns data for April 10 (from previous test run)

**Pass Criteria**:
- Response date field shows "2026-04-10"
- Different tokens than today's query (if new tokens trending)

**Fail**: If 404, that's expected if no brief exists for that date.

---

### Step 7: CORS Headers Test (3 min)
**Action**: Test that CORS headers are present
```bash
curl -H "Origin: https://memelabz.fun" -H "Access-Control-Request-Method: GET" -X OPTIONS http://localhost:3000/api/meta-desk/context-bundle -v
```

**Expected Result**: Response headers include:
```
Access-Control-Allow-Origin: https://memelabz.fun
Access-Control-Allow-Methods: GET, OPTIONS
```

**Pass Criteria**:
- Preflight OPTIONS request returns 200
- CORS headers are present
- Origin is echoed back correctly

**Fail**: If no CORS headers, check route.ts for header configuration.

---

### Step 8: MemeLabz Integration Smoke Test (5 min)
**Action**: Create simple HTML test file:
```html
<!-- test-memelabz-context.html -->
<script>
fetch('http://localhost:3000/api/meta-desk/context-bundle')
  .then(r => r.json())
  .then(data => {
    console.log('Date:', data.date);
    console.log('Trending tokens:', data.sections.trending.tokens.length);
    console.log('Top token:', data.sections.trending.tokens[0].ticker);
    document.body.innerHTML = `
      <h1>Context Bundle Test</h1>
      <p>Date: ${data.date}</p>
      <p>Top Token: ${data.sections.trending.tokens[0].ticker} @ $${data.sections.trending.tokens[0].price_usd}</p>
      <pre>${JSON.stringify(data, null, 2)}</pre>
    `;
  });
</script>
```

Open in browser: `test-memelabz-context.html`

**Pass Criteria**:
- Page loads
- Shows today's date
- Shows top token ticker and price
- Full JSON appears below

**Fail**: If CORS error, need to add CORS headers to API route. If fetch fails, check API URL.

---

## 6. Estimated Time Per Step

| Step | Task | Time | Cumulative |
|------|------|------|------------|
| 1 | Create `dex-trending-monitor.ts` | 40 min | 0:40 |
| 2 | Create `observation-writer.ts` | 25 min | 1:05 |
| 3 | Create `run-dex-scraper.ts` script | 10 min | 1:15 |
| 4 | Test scraper dry run (verification step 2) | 10 min | 1:25 |
| 5 | Debug scraper if issues found | 15 min | 1:40 |
| 6 | Real scraper run + verify observation file | 10 min | 1:50 |
| 7 | Create `context-bundle-builder.ts` (simplified) | 25 min | 2:15 |
| 8 | Create API route `context-bundle/route.ts` + CORS | 25 min | 2:40 |
| 9 | Create API route `health/route.ts` | 15 min | 2:55 |
| 10 | Test health endpoint (verification step 4) | 5 min | 3:00 |
| 11 | Test context-bundle endpoint (verification steps 5-6) | 10 min | 3:10 |
| 12 | Test CORS headers (verification step 7) | 5 min | 3:15 |
| 13 | Debug API if issues | 15 min | 3:30 |
| 14 | MemeLabz integration smoke test | 10 min | 3:40 |
| 15 | Update FIRST_SLICE_PLAN.md + cleanup | 10 min | 3:50 |

**Total Estimated Time**: 2.5-3 hours (accounting for debugging)

**Optimistic Case** (no issues): 2 hours
**Realistic Case** (minor debugging): 2.5-3 hours
**Pessimistic Case** (DexScreener API quirks, CORS issues): 3.5 hours

**Time Saved**: 2-3 hours by removing debate workflow (Windows PTY debugging, brief parsing, ledger integration)

---

## 7. The ONE Thing I'm Most Worried About

**DexScreener API Rate Limiting or Schema Changes**

**The Problem**:
- DexScreener API is free and public (no auth required)
- This means rate limits could be strict
- API schema could change without warning (no versioning)
- If API returns unexpected structure, our parser could break

**Why This Could Break the Slice**:
- Scraper depends entirely on DexScreener API response shape
- If response is missing expected fields (`priceUsd`, `volume.h24`, etc.), observation file will be incomplete
- If we hit rate limit (even during testing), we can't generate observations
- MemeLabz gets empty trending data or stale data

**Likelihood**: Medium
- DexScreener is a public service, widely used
- Free tier likely has reasonable limits (100+ requests/day)
- Schema stability is unknown - could change anytime

**Mitigation Plan**:
1. **Graceful degradation**: If API call fails, write an observation with error message instead of crashing
   - Observation frontmatter: `confidence: 0.0`, `entities: []`
   - Body: "DexScreener API unavailable. Retry in 15 minutes."
   - API still returns something (empty trending list + error message)

2. **Schema validation**: Add TypeScript interfaces for expected API response
   - Use Zod or similar to validate response before parsing
   - Log warnings if unexpected fields are missing
   - Fall back to partial data if possible

3. **Caching**: After first successful scrape, cache response for 15 minutes
   - If API fails, return cached data with `stale: true` flag
   - MemeLabz can show "Last updated 15 minutes ago" message

4. **Alternative data source**: If DexScreener is completely down
   - Could fall back to Birdeye API (already have `BIRDEYE_API_KEY` in .env)
   - Birdeye has similar trending endpoint for Solana
   - Requires API key but has better reliability

**How to Know if This Is Happening**:
During verification step 1 (API test):
```bash
curl "https://api.dexscreener.com/latest/dex/tokens/solana"
```
If this returns 429 (rate limit) or 5xx (server error), we have a problem.

If response shape is wrong (missing `pairs` array or `priceUsd` field), parser will throw.

**Decision Point**:
After step 1 (DexScreener API test), we'll know if API is accessible and stable. If it's down or rate-limited, we can either:
- Wait and retry (if temporary)
- Switch to Birdeye API (requires different parser but same concept)
- Use mock data for testing (proves pipeline works, integrate real API later)

---

## Summary

**What We're Building** (Revised Scope):
A complete, testable slice from raw data → API (NO debate workflow):
1. DexScreener scraper pulls trending tokens
2. Writes structured observations to markdown
3. Exposes latest trending data via REST API with CORS
4. Health check endpoint reports scraper status
5. MemeLabz consumes JSON and displays to users

**What We're NOT Building** (deferred to later):
- Debate workflow integration (separate task after Windows PTY fix)
- Daily brief generation (depends on debate)
- Confidence ledger consumption (depends on debate)
- Twitter scraper (next slice)
- Scheduled cron jobs (manual runs prove it works)
- Authentication (local dev only)
- Rate limiting (local dev only)

**Success Criteria**:
By end of this slice, you should be able to:
1. Run `npm run scrape:dex` and see a new observation file with 10 tokens
2. Hit `GET /api/meta-desk/health` and get scraper status
3. Hit `GET /api/meta-desk/context-bundle` and get JSON with 10 trending tokens
4. Fetch API from MemeLabz test page (cross-origin) and see today's top token
5. Verify CORS headers allow MemeLabz domains

**What Could Go Wrong**:
DexScreener API rate limiting or schema changes is the #1 risk. Mitigation: Graceful degradation, caching, fallback to Birdeye API.

**Time Estimate**: 2.5-3 hours (down from 5-6 hours by removing debate workflow)

**Next Step**:
Review this updated plan. If approved, I'll implement in order (scraper → observation → API → health check → verification).
