# PHASE 5 COMPLETE

**Date:** 2026-04-09
**Task:** Create integration scaffolding (documentation stubs, no actual integrations built)

---

## What Was Created

Phase 5 focused on **documenting** all external integrations Meta Desk will need, without actually configuring or running them. This creates the operational blueprint for Matt to execute when ready.

### 5.1 Integration Operations Pages (8 files)

Created in `data/operations/`:

#### **integrations-roadmap.md** (Master List)

Comprehensive roadmap of all integrations with:
- Status tracking (NOT STARTED / CONFIGURED / LIVE / BROKEN / DEFERRED)
- Priority levels (CRITICAL / HIGH / MEDIUM / LOW)
- Dependencies and target dates
- Implementation sequence (Phase 1: Manual MVP → Phase 2: Agent Activation → Phase 3: Data Automation → Phase 4: Delivery)
- Decision log (Grok vs Apify, DEXScreener vs Birdeye, Telegram vs Email)

**Key decisions documented:**
- Telegram as primary delivery (email deferred)
- Twitter/X via Grok or API as critical path
- Apify for multi-platform scraping (Twitter, Xiaohongshu, TikTok)
- DEXScreener vs Birdeye to be evaluated in week 3

---

#### **apify-setup.md**

**Status:** NOT STARTED
**Priority:** HIGH

Documents Apify scrapers for:
1. Twitter follower scraper (track who seed accounts follow)
2. Twitter advanced search (keyword/hashtag monitoring)
3. Xiaohongshu scraper (Chinese meme trends)
4. TikTok trends scraper (optional, deferred)

**Estimated cost:** $50-75/month depending on scraper tier

**Setup steps:** Account creation, API key, SDK install, actor configuration, scheduling, transformation pipeline

**Output destinations:** `data/observations/twitter/` and `data/observations/eastern/`

---

#### **grok-live-search.md**

**Status:** NOT STARTED
**Priority:** CRITICAL

Documents two integration options:
1. **Grok MCP server** (preferred, if available)
2. **X API v2** (fallback, well-documented)

**Planned use cases:**
- Daily trend scans (every 4 hours, English/Japanese/Korean CT)
- Seed account monitoring (hourly for tier-1, daily for tier-2)
- Cross-language crossing detection (every 6 hours)
- New token launch detection (every 2 hours)

**Cost:** $5,000/month (X API Pro tier) OR $100/month (Basic tier for MVP)

**Recommendation:** Start with Basic tier + targeted searches, upgrade to Pro when scaling.

**Setup steps:** X Developer account, API keys, tier selection, SDK install, query templates, rate limit management

---

#### **dexscreener-api.md**

**Status:** NOT STARTED
**Priority:** MEDIUM

Documents DEXScreener API for Solana token tracking:
- Latest pairs (new launches every 2 hours)
- Token search (lookup by name/ticker/contract)
- Trending pairs (daily trending scan)

**Cost:** Free tier (300 req/min, no auth), Pro tier TBD

**Rate limits:** 300 requests/minute (sufficient for MVP ~35 req/day)

**Recommendation:** Start with free tier, evaluate pro tier in week 3 if needed.

---

#### **birdeye-api.md**

**Status:** DEFERRED
**Priority:** MEDIUM

Documents Birdeye as alternative/complement to DEXScreener:
- Holder concentration analysis
- Wallet tracking (known degen wallets)
- Launch alerts
- Liquidity depth

**Decision:** Deferred until week 3. Evaluate after DEXScreener is working. May use one, both, or neither.

---

#### **telegram-delivery.md**

**Status:** NOT STARTED
**Priority:** HIGH (blocks subscriber delivery)

Documents Telegram as primary delivery channel:

**Architecture:** Two-channel setup (private brief channel + optional public preview)

**Setup steps:**
1. Create bot via BotFather
2. Create private channel ("Meta Desk Daily")
3. Add bot as admin
4. Get channel ID
5. Test posting
6. Format brief for Telegram markdown
7. Automate daily posting (manual first, then cron)

**Subscriber onboarding:** Payment received → Send invite link → Join channel → Receive daily briefs at 9am

**Formatting rules:** Include Historian/Scout/Aesthetician/Translator, exclude Skeptic/Referee/Matt's notes. Keep tight (200-400 words).

**Cost:** $0 (Telegram API is free)

---

#### **subscriber-email-delivery.md**

**Status:** DEFERRED
**Priority:** LOW

Documents email delivery as backup option:

**Decision:** Start with Telegram only. Add email only if ≥30% of subscribers request it.

**Rationale:** Telegram wins on instant delivery, formatting, paywall, crypto audience fit, no spam issues, zero cost.

**Email providers:** SendGrid (recommended), Mailgun, Buttondown

**Setup deferred:** Revisit after 50+ subscribers.

---

#### **openclaw-pipeline.md**

**Status:** NOT STARTED
**Priority:** CRITICAL (orchestrates all data ingestion)

Comprehensive documentation of the ETL pipeline:

**What it is:** Python service on Ubuntu laptop that triggers scrapers, transforms JSON→markdown, writes to Cabinet.

**Components:**
1. **Scheduler** (cron triggers)
2. **Scrapers** (call external APIs)
3. **Transformers** (JSON → observation markdown per contracts)
4. **Writers** (write to `data/observations/`, deduplicate)
5. **Logger** (record runs and errors)

**File structure:**
```
~/openclaw/
  scrapers/       # grok_trends.py, apify_followers.py, etc.
  transformers/   # observation_builder.py
  writers/        # file_writer.py, deduplicator.py
  utils/          # api_clients.py, config.py
  openclaw.log
  requirements.txt
```

**Dependencies:** Python 3, virtual env, API keys (Apify, X, DEXScreener), Cabinet data dir access

**Testing:** Unit tests per scraper, integration tests end-to-end, dry-run mode

**Monitoring:** Daily health checks (verify scrapers wrote files in last 24h)

**Deployment:** Clone repo to Ubuntu laptop, setup env, test, schedule cron

---

### 5.2 Scraper Output Contracts (7 files)

Created in `data/operations/scrapers/`:

Each contract defines the **exact format** for observation markdown files:

#### **apify-x-followers.md**

**Target folder:** `observations/twitter/follower-activity/`

**Filename:** `{YYYY-MM-DD}_apify-followers_{account-handle}_{hash8}.md`

**Frontmatter:**
```yaml
source: apify-followers
collected_at: "2026-04-09T03:00:00Z"
source_account: "@seedaccount1"
language: en
follower_count: 1234
new_follows: 15
entities_mentioned: []
novelty_score: null
apify_run_id: "abc123xyz"
```

**Body:** Markdown table of new follows with bio snippet, follower count, likely relevance

**Deduplication:** One file per account per day (unique key: `{source_account}_{date}`)

---

#### **apify-x-search.md**

**Target folder:** `observations/twitter/search-results/`

**Filename:** `{YYYY-MM-DD_HHMM}_apify-search_{query-slug}_{hash8}.md`

**Body:** List of matching tweets (top 10 by engagement)

**Deduplication:** One file per query per 4-hour window

---

#### **apify-xiaohongshu.md**

**Target folder:** `observations/eastern/xiaohongshu/`

**Filename:** `{YYYY-MM-DD}_xiaohongshu_{hash8}.md`

**Body:** Posts with Chinese content + English translations, images, character detection

**Deduplication:** Post ID-based (store seen IDs)

---

#### **grok-trends-japanese.md**

**Target folder:** `observations/twitter/grok-trends/`

**Filename:** `{YYYY-MM-DD_HHMM}_grok-trends-ja_{hash8}.md`

**Body:** Top 5 Japanese CT trends with example tweets + translations

**Deduplication:** One file per language per 4-hour window

---

#### **grok-trends-korean.md**

**Target folder:** `observations/twitter/grok-trends/`

**Filename:** `{YYYY-MM-DD_HHMM}_grok-trends-ko_{hash8}.md`

**Body:** Top 5 Korean CT trends with example tweets + translations

**Deduplication:** One file per language per 4-hour window

---

#### **dexscreener-trending.md**

**Target folder:** `observations/solana/launches/`

**Filename:** `{YYYY-MM-DD_HHMM}_dexscreener_{hash8}.md`

**Body:** Table of new Solana token launches with ticker, contract, DEX, liquidity, character type

**Deduplication:** Contract address-based (store seen contracts)

---

#### **pump-fun-launches.md**

**Target folder:** `observations/solana/launches/`

**Filename:** `{YYYY-MM-DD_HHMM}_pumpfun_{hash8}.md`

**Body:** pump.fun launches with character analysis (screenshot test, alignment, cultural context)

**Deduplication:** Contract address-based (shared with DEXScreener)

---

### 5.3 Delivery Contract (1 file)

Created `data/operations/delivery-contract.md`:

Defines the **daily brief lifecycle** from draft to published:

**States:**
1. **draft** — Agents wrote it, Matt hasn't reviewed
2. **reviewed** — Matt approved, ready to publish
3. **published** — Delivered to subscribers via Telegram
4. **skipped** — Drafted but not published (low quality/signal)

**Triggers:**
- **Manual (MVP):** Matt runs `python post_brief_to_telegram.py {date}` after reviewing
- **Automated (future):** Cron checks for `status: reviewed` at 8am, auto-publishes

**Formatting rules:**
- Include: Historian, Scout, Aesthetician, Translator
- Exclude: Skeptic, Referee, Matt's notes (internal only)
- Length: 200-400 words (Telegram-optimized)

**Quality control checklist:**
- Historian cites specific cycles (not vague)
- Scout flags genuinely novel (not already-known)
- No hallucinations
- No duplicate flags
- Right tone (confident, not hedged)

**Metrics to track:** Date, status, subscriber count, delivery time, sections included, word count

---

## File Verification

All Phase 5 files verified present:

**Operations pages (8):**
```
data/operations/
  integrations-roadmap.md
  apify-setup.md
  grok-live-search.md
  dexscreener-api.md
  birdeye-api.md
  telegram-delivery.md
  subscriber-email-delivery.md
  openclaw-pipeline.md
```

**Scraper contracts (7):**
```
data/operations/scrapers/
  apify-x-followers.md
  apify-x-search.md
  apify-xiaohongshu.md
  grok-trends-japanese.md
  grok-trends-korean.md
  dexscreener-trending.md
  pump-fun-launches.md
```

**Delivery contract (1):**
```
data/operations/
  delivery-contract.md
```

---

## Design Decisions

### Integration Sequencing

**Phase 1 (Weeks 1-3): Manual MVP**
- No external integrations
- Manual observation entry
- Manual brief writing
- Goal: Validate frameworks

**Phase 2 (Weeks 2-4): Agent Activation**
- Agents process manual observations
- Still no automated scraping
- Goal: Agents produce useful output

**Phase 3 (Weeks 3-5): Data Automation**
- Twitter/X API or Grok integration
- Apify scrapers
- OpenClaw pipeline
- Goal: Automated observation flow

**Phase 4 (Weeks 4-6): Delivery Automation**
- Telegram channel + bot
- Automated posting
- Beta subscribers
- Goal: End-to-end automation

**Rationale:** Incremental validation. Don't build scrapers before proving agents add value. Don't build delivery before proving briefs are worth subscribing to.

---

### Scraper Contract Design

**Why contracts matter:**

The scraper contracts are the **seam** between:
- **Scraping layer** (Python on Ubuntu, OpenClaw)
- **Agent layer** (Claude Code agents reading observations)

**Design principles:**

1. **Strict frontmatter schemas** — Agents know exactly what fields exist
2. **Consistent filename patterns** — Agents can glob for specific sources/dates
3. **Deduplication strategies** — Prevent writing same content twice
4. **Clear body formats** — Agents can parse without ambiguity

**Evolution allowed:** Contracts can be updated, but:
- Add fields with defaults (don't break existing parsers)
- Never remove required fields
- Version contracts if breaking changes needed

**Benefits:**
- Scraping layer can be rewritten in any language (Python → Rust) without touching agents
- Agents can evolve prompts without touching scrapers
- Easy to add new scrapers (follow contract template)

---

### Telegram vs Email Decision

**Why Telegram primary:**
- Crypto audience already there
- Instant delivery (no spam filters)
- Better markdown formatting
- Easier paywall (private channel)
- Zero cost

**Why email deferred:**
- Higher friction (spam, HTML templates)
- Unclear demand (no one asked for it)
- Adds complexity (SMTP, unsubscribe, list management)
- Not aligned with crypto culture

**Decision:** Telegram only for MVP. Add email only if ≥30% of subscribers explicitly request it.

---

### OpenClaw Architecture

**Why separate Python service:**

1. **Language fit:** Python excels at API wrappers (Apify SDK, Tweepy)
2. **Independence:** OpenClaw can run on different machine than Cabinet
3. **Testability:** Easy to test scrapers in isolation
4. **Deployment:** Cron on Ubuntu laptop (no server costs)

**Why not Cabinet-native:**

1. Cabinet is Next.js (TypeScript) — less mature API client ecosystem
2. Scraping is CPU-intensive (don't block Cabinet web server)
3. Separation of concerns (data ingestion vs knowledge management)

**Interface:** Filesystem. OpenClaw writes markdown files, Cabinet reads them. Simple, robust, no API coupling.

---

## What Matt Needs to Do

### Before Agent Activation (Blocking)

**None** — Phase 5 was documentation only. No actual integrations were configured.

### Before Data Automation (Week 3)

1. **Choose Twitter data source:**
   - Option A: X API Pro tier ($5k/month) — comprehensive, high limits
   - Option B: X API Basic tier ($100/month) — MVP-viable, limited
   - Option C: Grok MCP — investigate availability and cost
   - **Decision:** Recommend Basic tier for MVP, upgrade when scaling

2. **Get Apify account:**
   - Sign up at apify.com
   - Purchase $50 credits (starting tier)
   - Get API key
   - Store in OpenClaw `.env` file

3. **Build OpenClaw pipeline:**
   - Create git repo for OpenClaw
   - Write first scraper (recommend: `dexscreener_launches.py` — simplest, no auth)
   - Write transformer + writer
   - Test end-to-end (scrape → transform → write → verify in Cabinet)
   - Deploy to Ubuntu laptop
   - Schedule cron

4. **Test with sample data:**
   - Run scrapers in dry-run mode (no file writes)
   - Verify observation format matches contracts
   - Run once manually to write real observations
   - Check that agents (once activated) can read them

### Before Subscriber Launch (Week 4-6)

5. **Set up Telegram:**
   - Create bot via BotFather
   - Create private channel
   - Add bot as admin
   - Test posting script
   - Document subscriber onboarding flow

6. **Define pricing:**
   - Free tier? (Preview briefs only)
   - Paid tier? ($X/month for daily briefs)
   - Beta pricing? (Discount for first 10 subscribers)

7. **Legal:**
   - Draft disclaimer (consult crypto attorney)
   - "Not financial advice" language
   - Subscription terms
   - Refund policy

8. **Recruit beta subscribers:**
   - Identify first 5-10 people to test
   - Free or discounted for beta period
   - Gather feedback before public launch

---

## Issues Encountered

**None.** Phase 5 was pure documentation. No integrations were attempted, so no integration issues.

**Potential future issues documented:**

1. **Rate limits** — X API, Apify, DEXScreener all have limits. Contracts and setup docs include rate limit management strategies.

2. **API costs** — X API Pro tier is $5k/month. Setup docs recommend starting with Basic tier ($100/month) to validate before scaling.

3. **Scraper reliability** — External APIs can fail. OpenClaw docs include error handling, retry logic, health monitoring.

4. **Deduplication complexity** — Some scrapers need content-based dedup (hashing), others need ID-based (tweet IDs, contract addresses). Contracts specify strategy per scraper.

5. **Translation accuracy** — Japanese/Korean → English translation may lose context. Translator agent will need to validate before relying on auto-translations.

---

## Next Steps

**STOPPING HERE FOR MATT'S REVIEW.**

Phase 6 will:
1. Create today's daily brief template
2. Write brief-writing guide for Matt
3. Create go-live checklist

---

**Status:** ✅ Phase 5 complete. All integration scaffolding documented. No actual integrations built (by design). Awaiting Matt's review and approval to proceed to Phase 6.
