# PHASE 6 COMPLETE

**Date:** 2026-04-09
**Task:** Bootstrap the first daily brief template and create operational guides

---

## What Was Created

Phase 6 focused on **getting Matt ready to start writing** — creating the first brief template, teaching him how to write briefs, and giving him a clear roadmap to launch.

### 6.1 Today's Daily Brief Template

Created `data/meta-desk/daily-briefs/2026-04-09.md`:

**Structure:**
- Full frontmatter schema with all status tracking fields
- Empty sections with inline guidance:
  - `## Historian` — Pattern matching instructions
  - `## Scout flags` — Novelty surfacing instructions
  - `## Aesthetician` — Visual evaluation instructions
  - `## Translator` — Cross-cultural analysis instructions
  - `## Skeptic` — Counter-argument instructions (internal only)
  - `## Referee synthesis` — Balanced take instructions (internal only)
  - `## Matt's editorial notes` — Operational notes section

**Key features:**
- Inline `<!-- MATT: -->` comments explain what to write in each section
- Placeholder text shows expected format
- "How to use this template" section at bottom explains first-brief workflow
- Marked clearly as "DAY ONE TEMPLATE" so Matt knows it's for learning

**Purpose:** Matt can open this file right now and start writing his first manual brief. No need to invent structure — just fill in the placeholders.

---

### 6.2 Brief-Writing Guide

Created `data/meta-desk/how-to-write-a-daily-brief.md` (2,855 words):

**Contents:**

#### Daily Routine (Morning + Midday)
- **Morning observation collection** (30-60 min): Scroll Twitter, check DEXScreener, take bullet-point notes
- **Midday brief writing** (30-45 min): Fill in template sections

#### Section-by-Section Guidance

**Historian:**
- Question: Do observations match past cycles?
- Process: Read cycle retrospectives, look for pattern matches, be specific
- Example: "Pippin matches dog cycle day 7 pattern, timing window April 13-17"
- Length: 2-3 paragraphs (100-150 words)

**Scout:**
- Question: What's genuinely NEW in last 24 hours?
- Criteria: 3+ unrelated sources, cross-language crossing, thematic shift
- NOT novel: Same character in one community, derivatives, continuation of known trend
- Format: Bulleted list, 3-5 items max
- Example provided

**Aesthetician:**
- Question: Do characters pass screenshot test?
- Evaluation: Visual clarity, self-contained humor, remix potential (Pass 3/3, Conditional 2/3, Fail 0-1/3)
- Also: Alignment (face/heel/neutral), Audience appeal (degens/normies/lore nerds)
- Example: Pippin scores 2/3 (visual clear, remix yes, humor requires Italian context)

**Translator:**
- Question: Will Eastern signals cross to Western CT?
- Evaluation: Humor translate? Western equivalent? Crossing probability? Lead time?
- Example: Italian Pippin has medium-high crossing probability, 2-3 week lead time

**Skeptic (Internal):**
- Question: What's the strongest counter-argument?
- Challenge: Pattern match too loose? Novelty actually selection bias? Visual assessment generous?
- Example: "Historian assumes character type matters more than macro context"

**Referee (Internal):**
- Question: Balanced take after debate?
- Synthesis: Where is evidence strongest? Uncertainty highest? What would change my mind?
- Example: "Strong evidence: Visual clarity. Weak evidence: Timing prediction speculative."

#### Voice and Style Guidance
- Confident, not hedged (✅ "This is" vs ❌ "This might be")
- Specific, not vague (✅ "6 accounts in 24h" vs ❌ "Some accounts")
- Actionable, not academic
- Tight, not verbose (300-500 words for subscriber-facing sections)

#### Framework References
- Lists all research library docs to reference while writing
- Screenshot test, three audiences, meta rotation, cross-cultural arbitrage, etc.

#### The Empty Case
- Critical rule: If nothing interesting, skip the brief
- Low-signal days are normal
- Better to skip than publish noise

#### 3-4 Week Manual Period
- Why write 20-30 manual briefs before activating agents
- Phased agent activation: Historian → Scout → Skeptic
- By week 6, agents produce 80% of brief

#### Common Mistakes to Avoid
1. Too much lore, not enough signal
2. Hedging everything
3. Reporting without analysis
4. Fabricating signals when there are none
5. Ignoring the Skeptic

**Purpose:** This is Matt's onboarding manual. After reading this, he should know exactly how to write his first brief and what good looks like.

---

### 6.3 Go-Live Checklist

Created `data/meta-desk/go-live-checklist.md` (2,401 words):

**Structure:** 5 phases with granular checklist items, each with verification criteria.

#### Phase 1: Manual MVP (Weeks 1-3)
- [ ] 14+ manual briefs written
- [ ] 5+ cycle retrospectives filled in
- [ ] 30+ seed accounts populated
- [ ] Screenshot test framework battle-tested
- [ ] Three audiences model applied consistently
- [ ] Pattern match attempted in briefs

**Validates:** Matt can maintain daily cadence, format works, frameworks are useful

---

#### Phase 2: Agent Activation (Weeks 3-5)
- [ ] Historian agent active and useful
- [ ] Scout agent flagging genuinely novel signals
- [ ] Skeptic agent challenging (not agreeing)
- [ ] Agent hallucinations rare (<1 per week)
- [ ] Agent voice matches Matt's voice
- [ ] Agents cite sources

**Validates:** Agents add value, not noise

---

#### Phase 3: Data Automation (Weeks 4-6)
- [ ] At least one scraper live
- [ ] OpenClaw pipeline deployed
- [ ] Scraper deduplication working
- [ ] Observation quality acceptable
- [ ] Agents reading automated observations
- [ ] Observation volume sustainable (20-50/day)

**Validates:** Observation flow automated, agents process it correctly

---

#### Phase 4: Subscriber Delivery (Weeks 5-7)
- [ ] Telegram channel created
- [ ] Telegram bot configured
- [ ] Posting script works
- [ ] Brief formatting correct
- [ ] Test brief delivered to beta group (5+ people)

**Validates:** Delivery mechanism reliable

---

#### Phase 5: Business Operations (Weeks 6-8)
- [ ] Pricing decided ($20-50/month recommended)
- [ ] Payment processor chosen (Stripe/Gumroad/crypto)
- [ ] Subscription management plan
- [ ] Legal disclaimer drafted
- [ ] Refund policy defined
- [ ] Terms of service written
- [ ] First 5-10 beta subscribers identified
- [ ] Value proposition clear (one-sentence pitch)
- [ ] Sample brief public

**Validates:** Business operations ready for paying subscribers

---

#### Final Pre-Launch Checks
- [ ] 7-day test run with beta subscribers
- [ ] Agent failure handling tested
- [ ] Scraper failure handling tested
- [ ] Onboarding flow smooth (<5 min payment → first brief)
- [ ] Brief delivery time consistent (same time daily)

---

#### Launch Decision
- **All items checked?** Ready to launch
- **Missing items?** Do NOT launch yet
- **Minimum viable:** Phases 1, 2, 4 complete (content, agents, delivery)
- **Recommended:** All 5 phases complete + 7-day beta test

---

#### Post-Launch Monitoring (First 30 Days)
- [ ] Delivery success rate (100% target)
- [ ] Subscriber retention (>80% target)
- [ ] Agent output quality (>80% kept vs rewritten)
- [ ] Observation volume (20-50/day)
- [ ] Subscriber growth (5-10 new/week)

---

#### Graduation Criteria (Truly "Live")
- 50+ paying subscribers
- 30+ consecutive days of briefs
- Agents writing 80%+ of content
- Zero manual observations
- Delivery automated
- Positive cash flow

---

#### Emergency Shutdown Criteria
- Miss 3+ briefs in 14 days
- Retention <50% after 30 days
- Agents hallucinate >3x per week
- Matt dreads writing (burnout)
- Legal issues

**Better to shut down gracefully than deliver low-quality product.**

---

**Purpose:** This is Matt's north star. When he wonders "am I ready?" he re-reads this. Clear success criteria, clear failure criteria, clear timeline.

---

## File Verification

All Phase 6 files verified present:

```
data/meta-desk/
  daily-briefs/
    2026-04-09.md          ✓ Today's template
  how-to-write-a-daily-brief.md  ✓ Writing guide
  go-live-checklist.md           ✓ Launch roadmap
```

---

## Design Decisions

### Why Manual Briefs First (3-4 Weeks)

**Critical decision:** Don't activate agents until Matt has written 20-30 manual briefs.

**Rationale:**
1. **Matt learns the patterns** — Can't teach agents until he knows what matters
2. **Builds cycle library** — Agents need retrospectives to match against
3. **Defines the voice** — Agents learn from Matt's writing style
4. **Tests frameworks** — Fix screenshot test now, before agents learn it wrong
5. **Validates product** — If writing briefs feels like drudgery, product might not work

**Agent activation sequence:**
- Week 4: Historian (pattern matching most valuable)
- Week 5: Scout (novelty detection)
- Week 6: Skeptic (counter-arguments)
- Later: Translator, Aesthetician, Referee, Scribe as needed

**By week 6, agents produce 80% of brief.** Matt edits, synthesizes, publishes.

---

### Template Design Philosophy

**Inline guidance over separate docs:**

The daily brief template includes `<!-- MATT: -->` comments directly in each section explaining what to write. This is better than separate documentation because:
- Context is immediate (no context-switching to read docs)
- Can delete comments as he learns (template evolves)
- Shows expected format (example text embedded)

**Sections ordered by workflow:**

Subscriber-facing sections first (Historian → Scout → Aesthetician → Translator), then internal sections (Skeptic → Referee → Matt's notes). This matches the writing flow.

**Explicit "empty case" handling:**

Many sections include "If no X, write 'Nothing to report' or delete this section." This prevents forcing signals when none exist — critical for maintaining subscriber trust.

---

### Voice Guidance Strategy

**Three-part voice definition:**

1. **Positive examples** ("Do this: 'This is happening'")
2. **Negative examples** ("Not this: 'This might be happening'")
3. **Real examples** (Pippin case study showing good vs bad)

This teaches voice more effectively than abstract rules like "be confident."

**Voice training happens through manual writing:**

Matt writes 20-30 briefs in his voice → Agents read those briefs → Agents learn voice. We can't define "confident, specific, actionable" in a prompt; agents learn it from examples.

---

### Checklist Design: Granular + Verifiable

**Every checklist item has:**
1. **Clear deliverable** (14+ manual briefs, 5+ cycle retrospectives)
2. **Validation criteria** (how to verify it's done)
3. **Success threshold** (>80% retention, <1 hallucination/week)

**Why granular:**
- "Agents are ready" is too vague
- "Agents hallucinate <1x per week for 7 consecutive days" is measurable

**Why verification matters:**
- Easy to think something is done when it's not
- "How to verify" forces Matt to prove completion

---

### Timeline Realism

**6-8 weeks from today to launch:**

- Weeks 1-3: Manual MVP (21 days × 1 brief/day = 21 briefs)
- Weeks 3-5: Agent activation (14 days testing agents)
- Weeks 4-6: Data automation (14 days building scrapers)
- Weeks 5-7: Delivery setup (14 days Telegram + testing)
- Weeks 6-8: Business ops (14 days legal + pricing + beta)

Phases overlap (agent activation starts while still writing manual briefs). This is realistic if full-time. Longer if part-time.

**Emergency fast-track:**
- Skip Phase 3 (automation) initially — sustain manual observations
- Launch with manual + agents only (Phases 1, 2, 4, 5)
- Add automation post-launch

**Not recommended:** Launching without manual period (agents have nothing to learn from).

---

## What Matt Needs to Do

Phase 6 is the bridge between "infrastructure ready" and "Matt starts working." Everything from this point forward is Matt's work, not agent setup work.

---

## What Matt Should Do Next

**Priority order for the first hour after reading this:**

### 1. Read the Brief-Writing Guide (10 minutes)

Open `data/meta-desk/how-to-write-a-daily-brief.md` and read it fully. This teaches you the format, voice, and workflow.

**Don't skim.** The examples (Pippin case study) show you what good looks like.

---

### 2. Open Today's Brief Template (2 minutes)

Open `data/meta-desk/daily-briefs/2026-04-09.md` in Cabinet UI.

This is your workspace for today. You'll write your first brief here.

---

### 3. Gather Observations (30-60 minutes)

**Do this right now, today:**

1. **Scroll Twitter/X** — English CT, Japanese CT (if you follow any), Korean CT (optional)
   - Look for: New characters, token launches, trending themes
   - Take notes: Character names, account handles, tweet links

2. **Check DEXScreener** — New Solana token launches
   - Filter: pump.fun, Raydium (last 24 hours)
   - Note: Ticker, contract, liquidity, character theme

3. **Check pump.fun** — Meme coin launches specifically
   - Note any with clear character mascots

**Write quick bullet points in a scratch file:**
- "Pippin — 6 Italian CT mentions, hobbit theme, @user1 @user2 @user3"
- "Dog with hat derivative — $DOGHAT2, contract 8yj...def, $15k liq"

**Target:** 10-15 raw observations. Most will be noise. That's fine.

---

### 4. Write Your First Brief (30-45 minutes)

Using your bullet-point observations and the template:

1. **Historian section:** Do any observations match past cycles?
   - Read `cycles/2024-Q4_dog-cycle-wif-era.md` (you haven't filled this yet, but skim the template)
   - If nothing matches, write: "No strong pattern match today. Watching for character consolidation signals before calling a match."

2. **Scout section:** What's genuinely novel?
   - Of your 10-15 observations, which are appearing in 3+ unrelated sources?
   - Format as bulleted list
   - If nothing is truly novel, write: "Nothing novel today."

3. **Aesthetician section:** (If Scout flagged a character)
   - Apply screenshot test: Visual clarity? Self-contained humor? Remix potential?
   - Score it
   - If no characters, skip this section

4. **Translator section:** (If any Eastern signals)
   - Does it translate? Crossing probability?
   - If no Eastern signals, skip this section

5. **Skeptic section:** Challenge yourself
   - What's weak about your analysis above?
   - Is the pattern match too loose?
   - Are you calling something "novel" that's just newly visible to you?

6. **Referee section:** Balanced take
   - Synthesize Historian/Scout vs Skeptic
   - Where is evidence strong? Where is uncertainty high?

7. **Matt's notes:** Operational TODOs
   - "Need to fill in dog cycle retrospective"
   - "Should find more Japanese CT accounts to follow"

**Don't aim for perfect.** Your first brief will be rough. That's expected.

**Target length:** 300-500 words for subscriber sections (Historian + Scout + Aesthetician + Translator). Internal sections can be longer.

---

### 5. Save and Review (5 minutes)

1. **Save the file** in Cabinet (auto-saves, but verify)
2. **Read it out loud** — Does it sound like you? Or like ChatGPT?
3. **Check the voice** — Did you hedge? ("might," "could," "possibly")
4. **If you hedged:** Rewrite more confidently

**Mark as draft:** Change `status: draft` in frontmatter (leave it as draft, don't publish yet)

---

### 6. Read the Go-Live Checklist (10 minutes)

Open `data/meta-desk/go-live-checklist.md` and skim it.

**Purpose:** See the full roadmap. You're at day 1 of Phase 1 (Manual MVP). You have 6-8 weeks of work ahead.

**Don't be overwhelmed.** You don't need to do everything today. Just:
- Day 1: Write first brief
- Week 1: Write 5-7 briefs (practice the format)
- Week 2-3: Write 10-15 more briefs (build momentum)
- Week 4: Activate Historian agent (let it write alongside you)

**One day at a time.**

---

### 7. Fill in One Cycle Retrospective (Optional, 30-60 minutes)

If you have time today, fill in `cycles/2024-Q4_dog-cycle-wif-era.md` with real WIF data:

- **When did WIF launch?** (date)
- **What were the leading indicators?** (dog memes trending before launch)
- **Peak dynamics?** (price, community size, normie onboarding)
- **Death signals?** (or is it still alive?)
- **Accounts that called it early?** (who tweeted about it before consensus?)

**Why now:** This gives Historian something to pattern-match against when you activate it in week 4.

**If you don't know WIF history:** Skip this for now. Research it later or do a different cycle you know better.

---

### 8. Populate Seed Account List (Optional, 30 minutes)

Open `data/entities/accounts/english-seed.md` and add 10-15 English CT accounts you already follow:

| Handle | Tier | Track Record | Notes |
|--------|------|--------------|-------|
| @account1 | seed | Called WIF early | Good degen radar |
| @account2 | seed | - | Japanese CT bridge |

**Why now:** Scout (when activated) uses seed lists to prioritize observations. More seeds = better signal.

**Start small:** 10-15 accounts is fine for day 1. You'll add more as you find them.

---

## Summary: Your First Day Checklist

**Do today (3-4 hours total):**

- [x] Read brief-writing guide (10 min)
- [x] Open today's brief template (2 min)
- [ ] Gather observations (30-60 min) ← **START HERE**
- [ ] Write first brief (30-45 min) ← **DO THIS**
- [ ] Save and review (5 min)
- [ ] Read go-live checklist (10 min)

**Optional today:**
- [ ] Fill in WIF cycle retrospective (30-60 min)
- [ ] Add 10-15 seed accounts (30 min)

**Tomorrow:**
- [ ] Gather observations again
- [ ] Write second brief (will be faster, ~30 min)

**This week:**
- [ ] Write 5-7 briefs total (practice the format)
- [ ] Fill in 2-3 cycle retrospectives (pattern-match fuel for Historian)
- [ ] Add 20-30 total seed accounts (observation sources)

**By end of week 1, you'll know:**
- Can you maintain daily cadence? (if yes, continue; if no, rethink)
- Are frameworks useful? (screenshot test, three audiences, etc.)
- Is this fun or drudgery? (if drudgery, product might not work)

---

## What's Done vs What's Next

### What's Done (Phases 1-6 Complete)

✅ **Meta Desk workspace scaffolded** (35 directories, 60+ markdown files)

✅ **8 agent personas created** (3 full: Historian, Scout, Skeptic; 5 stubs: Translator, Aesthetician, Referee, Scribe, Concept Forge)

✅ **Reference library seeded** (5 frameworks, cycle templates, case study templates, account templates)

✅ **MCP servers configured** (Filesystem, Memory active; Fetch failed but non-blocking)

✅ **Integration scaffolding documented** (8 operations pages, 7 scraper contracts, delivery contract)

✅ **First brief template ready** (2026-04-09.md with inline guidance)

✅ **Brief-writing guide written** (2,855 words teaching Matt the format)

✅ **Go-live checklist created** (2,401 words with 5 phases, granular items, verification criteria)

**Infrastructure is ready.** Everything from here is Matt's work.

---

### What's Next (Matt's Work)

**Week 1 (This Week):**
- Write 5-7 manual briefs
- Fill in 2-3 cycle retrospectives
- Add 20-30 seed accounts

**Weeks 2-3:**
- Write 10-15 more manual briefs (total: 20-30)
- Refine frameworks based on what's working
- Test observation collection workflow (is it sustainable?)

**Week 4:**
- Activate Historian agent (`active: true`)
- Let Historian write alongside you
- Compare outputs (agent vs manual)
- Edit agent persona if output is weak

**Week 5:**
- Activate Scout agent
- Activate Skeptic agent
- Refine all three agent personas based on output quality

**Week 6:**
- Build first scraper (recommend: DEXScreener launches — simplest)
- Deploy OpenClaw pipeline
- Test automated observations

**Week 7:**
- Set up Telegram delivery
- Test posting script
- Invite 5 beta subscribers

**Week 8:**
- 7-day beta test run
- Finalize pricing and legal
- Launch to first paid subscribers

**Timeline:** 8 weeks if full-time. Longer if part-time. Adjust as needed.

---

**Status:** ✅ Phase 6 complete. Meta Desk infrastructure is ready. Matt can start writing his first brief today.

**Next major milestone:** 14 manual briefs written (end of week 2-3).
