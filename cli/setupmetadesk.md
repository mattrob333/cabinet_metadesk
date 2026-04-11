=== BEGIN META DESK SETUP INSTRUCTIONS ===

# Meta Desk: Cabinet Environment Setup

You are Claude Code running inside a freshly-initialized Cabinet repository on the user's local machine. The user (Matt) is building a product called **Meta Desk** — a subscription intelligence product that detects and predicts Solana meme coin meta trends 24–72 hours before they become obvious. The product delivers daily briefs to paying subscribers via Telegram and email, powered by a team of AI agents that ingest data from multiple sources (Western + Eastern social, on-chain, scrapers) and produce calibrated, receipts-having analysis.

Your job in this session is to set up the Cabinet environment so Matt has a working harness to start operating from. You will NOT be running production workflows, ingesting live data, or shipping anything to subscribers in this session. You are building the *workspace* and the *team*, not the business.

You are going to do this in phases, verify your work at each phase, and pause for Matt's input at specific points. Do NOT skip phases. Do NOT try to do everything in one pass. After each phase, write a `PHASE_{n}_COMPLETE.md` file at the repo root listing what you did, what you verified, and any open questions, so Matt can audit your work before you proceed.

## Critical context before you start

Read these files to orient yourself:
1. `README.md` — understand what Cabinet is at the top level
2. `CLAUDE.md` — the project-level guidance for Cabinet itself  
3. `src/lib/agents/persona-manager.ts` — the AgentPersona interface, which is the schema for agent persona files (frontmatter fields)
4. `src/lib/jobs/job-library.ts` — examples of how scheduled job prompts are structured
5. `PRD.md` and `PROGRESS.md` if they exist — to understand where Cabinet itself is in its development arc

You need to understand the Cabinet data model before you touch anything:
- All state lives as markdown files under `data/`
- Agent personas live at `data/.agents/{slug}/index.md` with YAML frontmatter (AgentPersona schema) and markdown body (persona instructions)
- Scheduled "jobs" are cron-based and tied to agents
- The knowledge base is the shared memory between humans and agents — everything they produce is a file on disk
- Cabinet auto-commits to git on every save, so your work is version-controlled by default

DO NOT modify any files in `src/`, `server/`, `cli/`, or any other code directory. You are not modifying Cabinet itself. You are only populating the `data/` directory and the `.agents/` subdirectory, plus Claude Code's own MCP configuration file (which lives outside the Cabinet repo, in the user's Claude Code config).

If you are unsure whether something is safe to modify, STOP AND ASK.

## The vision you are building toward

This is the end-state of what Matt is building. You don't need to construct all of it in this session — most of it will be filled in by Matt and by the agents themselves over time — but you need to understand it so the scaffolding you create points in the right direction.

Meta Desk is a daily (eventually twice-daily) intelligence product about Solana meme coin meta. It has a team of AI agents working in a debate architecture:

- **The Historian** — pattern-matches current observations against past meta cycles stored in a curated library
- **The Scout** — surfaces novelty from the last 24–48 hours of raw observations across all sources
- **The Translator** — handles cross-cultural meaning transfer for Japanese/Korean/Chinese sources, which is the product's primary competitive edge
- **The Skeptic** — argues against the other agents' findings; its job is disagreement, not consensus
- **The Aesthetician** — judges whether surfaced characters/memes have visual and remix potential
- **The Referee** — synthesizes the day's debate into a final draft daily brief, preserving disagreements rather than resolving them
- **The Scribe** — writes weekly long-form deep dives from the week's accumulated material
- **The Concept Forge** — manually triggered; given a theme, generates hypothetical token concepts and logs them as predictions

Data flows in from multiple sources into an `observations/` folder (Apify scrapers for X/Twitter, 4chan /biz/, TikTok, Reddit; Grok live search for X trends including Japanese and Korean language; direct API calls to DexScreener, Birdeye, GeckoTerminal for on-chain data; eventually Telegram public channel monitoring). The observations get aggregated into tracked `entities/` (characters, themes, tokens, accounts). The agents read observations and entities, debate them, and produce daily briefs that get graded over time in a `track-record/` folder that serves as both calibration data and marketing (public receipts).

The product also includes a Concept Forge loop for pre-predicting token launches, so that when a real launch matches a pre-written thesis, Meta Desk has a ready-to-publish analysis.

The moat is not the tooling. The moat is: (1) the accumulating `cycles/` library that the Historian references, which takes months to build and cannot be copied; (2) the editorial voice of the daily briefs, which must be developed by Matt writing by hand for several weeks before agents can imitate it; (3) the Eastern-source coverage that Western competitors don't have; (4) the public track record of hits and misses; and (5) the subscriber community itself becoming a distributed intelligence network over time.

With that context locked in, here's what you're going to do.

---

## Phase 1: Directory scaffold and knowledge base skeleton

Goal: Create the full `data/` directory structure for Meta Desk with empty `index.md` files containing useful placeholder content that explains what each folder is for.

### 1.1 Create the directory structure

Create the following directory tree under `data/`. Each directory gets an `index.md` file as described in 1.2.
data/
├── meta-desk/
│   ├── daily-briefs/
│   ├── weekly-deep-dives/
│   ├── debate-log/
│   └── track-record/
│       ├── hits/
│       └── misses/
├── observations/
│   ├── western/
│   │   ├── x-english/
│   │   ├── 4chan-biz/
│   │   ├── reddit/
│   │   └── farcaster/
│   ├── eastern/
│   │   ├── x-japanese/
│   │   ├── x-korean/
│   │   ├── tiktok-brainrot/
│   │   └── xiaohongshu/
│   ├── onchain/
│   │   ├── dexscreener/
│   │   ├── pump-fun-launches/
│   │   └── smart-money-wallets/
│   └── google-trends/
├── entities/
│   ├── characters/
│   ├── themes/
│   ├── tokens/
│   └── accounts/
├── cycles/
├── research-library/
│   └── case-studies/
├── subscribers/
└── operations/
├── scrapers/
└── pipelines/

Also, if any of Cabinet's default onboarding content exists under `data/` from the `create-cabinet` template (e.g., example pages, getting-started content, default agents), MOVE it to `data/_cabinet-defaults-archive/` rather than deleting it. Matt may want to reference the defaults later. Do not delete anything without explicit permission.

### 1.2 Populate each directory's index.md

For each directory you created, write an `index.md` file that serves as a "what is this folder" explainer. These should be short (100–300 words each), written in clear prose, and explain:
- What the folder contains
- Who writes to it (humans, specific agents, or scrapers)
- Who reads from it (specific agents, Matt, both)
- The file naming convention for files inside it
- Any frontmatter conventions for files inside it

Use these naming conventions throughout:

- **Daily briefs:** `YYYY-MM-DD.md` (e.g., `2026-04-09.md`)
- **Weekly deep dives:** `YYYY-WNN.md` where NN is the ISO week number
- **Debate log entries:** `YYYY-MM-DD.md` matching the daily brief
- **Observations:** `YYYY-MM-DD_{source}_{hash8}.md` where source is the subfolder name and hash8 is a short deterministic hash of the content (for deduplication) — when Matt hooks up real scrapers later, they'll follow this convention
- **Entities:** `{slug-of-entity-name}.md` (e.g., `pippin.md`, `italian-brainrot-cycle.md`)
- **Cycles:** `YYYY-QN_{slug}.md` (e.g., `2024-Q4_dog-cycle.md`)

Use this frontmatter convention for observation files:
```yaml
---
source: x-japanese
collected_at: 2026-04-09T14:32:00Z
language: ja
entities: [character-name, theme-slug]
confidence: 0.7
url: https://...
---
```

Use this frontmatter convention for entity files:
```yaml
---
name: Pippin
slug: pippin
type: character
first_seen: 2026-04-09
status: emerging  # emerging | accelerating | peaking | declining | dead
sources: [x-english, tiktok-brainrot]
mention_count: 0
related_entities: []
notes_last_updated: 2026-04-09
---
```

Use this frontmatter convention for daily briefs:
```yaml
---
date: 2026-04-09
status: draft  # draft | reviewed | published
agents_contributed: [historian, scout, skeptic, referee]
themes_flagged: []
predictions_made: []
edited_by_matt: false
---
```

Include these frontmatter conventions in the relevant `index.md` explainers so future agents and future Matt can find them.

### 1.3 Write the root Meta Desk manifesto

Create `data/meta-desk/index.md` as a more substantial document (600–900 words) that:
- States what Meta Desk is and who it's for
- Describes the daily brief as the core deliverable
- Describes the debate architecture at a high level
- References the other top-level folders and how they fit together
- Includes a "How to read this knowledge base" section for future agents who will be reading it for the first time
- Includes a "Current status" section that says "Phase 1 scaffolding complete, awaiting content population" so Matt can see where the project is

### 1.4 Create the root data/index.md

If it doesn't already exist (or if the Cabinet default is generic), write a top-level `data/index.md` that points to `meta-desk/` as the main workspace and briefly describes the other top-level folders.

### 1.5 Verify and report

After completing Phase 1, verify:
- Every directory listed above exists
- Every directory has an `index.md` file
- The manifesto is in place
- No Cabinet code files were modified
- Git status shows only additions under `data/`

Write `PHASE_1_COMPLETE.md` at the repo root summarizing what you created, file counts, and any deviations from the spec. Then STOP and wait for Matt to say "proceed to phase 2."

---

## Phase 2: Agent personas (skeleton pass)

Goal: Create persona files for all eight agents, with the Historian, Scout, and Skeptic fully fleshed out and the other five as high-quality stubs that Matt can refine later.

### 2.1 Agent roster and slugs

Create persona files at these locations:

- `data/.agents/historian/index.md`
- `data/.agents/scout/index.md`
- `data/.agents/skeptic/index.md`
- `data/.agents/translator/index.md`
- `data/.agents/aesthetician/index.md`
- `data/.agents/referee/index.md`
- `data/.agents/scribe/index.md`
- `data/.agents/concept-forge/index.md`

### 2.2 Frontmatter schema

Each persona file MUST have YAML frontmatter matching the AgentPersona interface you found in `src/lib/agents/persona-manager.ts`. Required fields based on that schema:
```yaml
---
name: "The Historian"
role: "Pattern-matches current observations against past meta cycles"
provider: claude
heartbeat: "0 7 * * *"
budget: 60
active: false  # IMPORTANT: start all agents inactive so they don't run until Matt says go
workdir: "meta-desk"
focus:
  - "observations/"
  - "cycles/"
  - "entities/"
  - "meta-desk/daily-briefs/"
tags:
  - "meta-desk"
  - "research"
emoji: "📚"
department: "Meta Desk"
type: scheduled
goals:
  - metric: "pattern matches logged"
    target: 100
channels:
  - "meta-desk-debate"
workspace: "meta-desk/"
setupComplete: false
---
```

Check the actual AgentPersona interface and use the correct field names. If the schema requires fields I haven't listed, fill them in with sensible defaults. If you find fields in the interface I've listed that don't exist, drop them and note it in your phase completion report.

**Crucial:** Set `active: false` for ALL agents. Matt will activate them manually after reviewing each persona. You are building the team; he's hiring them.

### 2.3 Cron schedules (use these exact values)

- Historian: `"0 7 * * *"` (daily at 7am)
- Scout: `"0 */4 * * *"` (every 4 hours)
- Translator: `"30 */6 * * *"` (every 6 hours, offset by 30 min so Scout has already run)
- Aesthetician: `"15 */4 * * *"` (every 4 hours, offset by 15 min from Scout)
- Skeptic: `"0 18 * * *"` (daily at 6pm, after Historian + Scout have filed)
- Referee: `"0 20 * * *"` (daily at 8pm, after Skeptic)
- Scribe: `"0 9 * * 0"` (Sunday 9am)
- Concept Forge: `"0 0 31 2 *"` (effectively never — only triggered manually. This is a valid cron that never fires because Feb never has 31 days.)

### 2.4 Fully-fleshed personas (write these in detail, 400–700 words of markdown body each)

For **Historian**, **Scout**, and **Skeptic**, write complete persona markdown bodies. Each should include sections for:

1. **Identity** — who the agent is in one paragraph
2. **What you do each run** — step-by-step numbered instructions for what the agent does when its cron fires
3. **How you think** — the mental model and priors the agent operates from
4. **What you are not** — explicit delineation from the other agents' jobs, to prevent role drift
5. **Voice** — how the agent writes; what kind of language it uses; what it avoids
6. **Your outputs** — exactly which files it writes to, with explicit paths and the exact section headers to use within those files
7. **How to handle the empty case** — what the agent does when there's nothing interesting to report (this is critical — agents that hallucinate findings when there are none are useless)

For the **Historian** specifically:
- It reads the last 7 days of `observations/` and the entire `cycles/` library
- It writes to today's daily brief at `meta-desk/daily-briefs/{YYYY-MM-DD}.md` under a `## Historian` section
- If the file doesn't exist yet, it creates it with the daily brief frontmatter schema
- If there are no clean pattern matches, it writes exactly that: "No strong pattern match today" plus one sentence on what it watched for
- It should cite specific past cycles by slug when making a match, not gesture vaguely
- It should quantify expected timing windows when possible ("the pre-WIF pattern took 11 days to manifest")

For the **Scout** specifically:
- It reads only the last 24 hours of `observations/` (check frontmatter `collected_at`)
- Its job is pure novelty surfacing — things that don't match any existing entity in `entities/`, things appearing in 3+ unrelated sources for the first time, cross-language crossings
- It writes to today's daily brief under a `## Scout flags` section
- It does NOT explain or synthesize — it flags
- It creates draft entity files in `entities/characters/` or `entities/themes/` for brand-new things it surfaces, using the entity frontmatter schema with `status: emerging`
- Empty case: if nothing novel, it writes "Nothing novel today" and nothing else

For the **Skeptic** specifically:
- It runs after Historian and Scout
- It reads their sections in today's brief
- It argues against them in a `## Skeptic` section AND writes a longer debate entry at `meta-desk/debate-log/{YYYY-MM-DD}.md`
- Explicit instruction: "If you cannot find something to push back on, you are failing. Re-read more aggressively. Question assumptions, timing windows, cultural translation claims, and evidence strength. The Referee will balance you — your job is the strongest possible counter."
- It should be specifically trained to challenge: timing calls, cross-cultural claims that might not translate, pattern matches that are too loose, and anything that sounds like consensus

All three should include a voice section tuned to a distinctive personality — Historian writes like a historian, Scout writes like a scanner with no opinions, Skeptic writes like a hostile editor. Read the existing job-library.ts prompts for tone calibration (Cabinet's defaults are quite neutral/corporate; Meta Desk's agents should feel more distinctive than that).

### 2.5 Stub personas (write these as shorter drafts, ~200 words each)

For **Translator**, **Aesthetician**, **Referee**, **Scribe**, and **Concept Forge**, write stub personas with:
- Complete frontmatter (same schema, active: false)
- A brief Identity section
- A rough What you do section
- A TODO list section at the bottom flagging what needs to be expanded before activation

These are placeholders. Matt will flesh them out after he sees how the first three behave in practice. Mark them clearly as stubs in the markdown so it's obvious they're not production-ready.

### 2.6 Create the shared channels

Agents reference channels in their `channels` frontmatter field. Create a `data/meta-desk/channels/` directory with these initial channel pages:
- `meta-desk-debate.md` — where agents debate current observations
- `meta-desk-alerts.md` — where urgent signals get surfaced
- `meta-desk-editorial.md` — where Matt and agents coordinate on what ships to subscribers

Each gets a short `index.md`-style explainer (not an index.md, since these are the leaf files themselves — just `{channel-name}.md`).

### 2.7 Verify and report

Verify that:
- All 8 persona files exist with valid frontmatter matching the AgentPersona schema
- All agents are set to `active: false`
- Historian, Scout, Skeptic have complete personas
- The other 5 are clearly marked as stubs
- Channel files exist
- Cabinet's agent loading doesn't throw errors on the new personas (check by running the dev server's agent listing API if possible, or by reading the persona-manager code to see what validation runs)

Write `PHASE_2_COMPLETE.md` summarizing what was created, which personas are complete vs stub, and any issues encountered. STOP and wait for Matt to review and say "proceed to phase 3."

---

## Phase 3: Seed the reference library

Goal: Give the Historian and the future Scout something to actually reference. Cabinet is useless on day one if the `cycles/`, `entities/accounts/`, and `research-library/` folders are empty, because the agents have nothing to pattern-match against.

You do NOT need to be factually accurate about the meme coin world in this phase — Matt will correct and refine all of this. Your job is to create well-structured *templates* with placeholder content that make the format clear, so Matt can fill in real content quickly.

### 3.1 Create cycle retrospective templates

Create these files under `data/cycles/`:

- `2024-Q2_pepe-revival.md`
- `2024-Q3_ai-agents.md`
- `2024-Q4_dog-cycle-wif-era.md`
- `2025-Q1_italian-brainrot.md`
- `2025-Q2_useless-nihilism.md`
- `_TEMPLATE.md`

Each cycle file should follow the same template and include:
- Frontmatter: slug, name, start_date, peak_date, end_date, dominant_tickers, leading_indicators, death_signals, accounts_that_called_it_early
- Sections: Summary, Timeline, Leading indicators, Peak dynamics, Death signals, Notable tokens, Accounts that called it early, Post-mortem lessons

Populate each cycle with PLACEHOLDER content clearly marked as `<!-- MATT: fill in -->`. Do not fabricate specific dates, prices, or ticker details — you'll get them wrong and it'll contaminate the Historian's reference library. Write enough to show Matt the structure, and stop.

The `_TEMPLATE.md` file should be a pure template with instructions at the top for how to write a new cycle retrospective.

### 3.2 Create the accounts seed file

Create `data/entities/accounts/_TEMPLATE.md` showing the format for an account entity file with frontmatter:
```yaml
---
handle: "@example"
platform: x
language: en
follower_count: 0
tier: seed  # seed | expansion | watchlist | archived
track_record: []  # list of tokens/themes this account called early
last_audited: 2026-04-09
notes: ""
---
```

Also create `data/entities/accounts/index.md` explaining the seed → expansion → watchlist → archived lifecycle, and noting that the seed list will be populated by Matt manually in week 1.

Create four placeholder files — `english-seed.md`, `japanese-seed.md`, `korean-seed.md`, `chinese-seed.md` — each as an empty table with columns for handle, tier, track record, notes. These are lists Matt will populate by hand; you're just making the tables.

### 3.3 Populate research-library with framework documents

Create these documents in `data/research-library/`:

- `meta-rotation-theory.md` — a 400–600 word framework piece explaining how meme coin meta rotates through categories (animal → political → food → AI → nostalgia → absurdist → back to animal), typical cycle duration (6–12 weeks), the concept of "early emergence → acceleration → peak → normie arrival → decline," and how to tell which phase a theme is in. This is the theoretical underpinning for how the Historian and Scout reason. Write it cleanly and don't hedge — it's a working hypothesis, not a peer-reviewed paper.
- `screenshot-test-framework.md` — 300 words on the screenshot test: "can someone screenshot one image (mascot, chart, or tweet) and have it be self-contained funny?" This is how the Aesthetician will judge character potential. Include examples of what passes and what fails.
- `cross-cultural-arbitrage-playbook.md` — 400–500 words explaining the cross-cultural arbitrage thesis: that Japanese, Korean, and Chinese meme culture is typically 3–6 weeks ahead of Western crypto Twitter on character and aesthetic trends, and that detecting language-border crossings is one of the strongest leading indicators available. This is the Translator's operating manual.
- `three-audiences-model.md` — 300 words on the "degens / normies / lore nerds" framework for judging whether a concept has legs across all the audiences that matter.
- `heel-vs-face-alignment.md` — 250 words on pro-wrestling-style alignment in meme coin design (lovable vs antagonistic) and why this matters for community formation.

These are Matt's operating frameworks expressed in prose. Write them in a confident, opinionated voice — these are working hypotheses, not hedged essays. If you find yourself writing "some argue that..." or "it could be said that..." stop and rewrite more directly.

### 3.4 Create case-study templates

Create `data/research-library/case-studies/_TEMPLATE.md` with a structure for teardowns of successful tokens: what worked, timing, character design, lore architecture, community seeding, launch mechanics, death (or peak) dynamics.

Create stub files (just the template with the token name filled in) for: `wif-teardown.md`, `pippin-teardown.md`, `useless-teardown.md`. Mark them clearly as stubs for Matt to fill in.

### 3.5 Verify and report

Verify all files exist and follow their templates. Write `PHASE_3_COMPLETE.md`. STOP for review.

---

## Phase 4: MCP configuration for Claude Code

Goal: Configure MCP servers in Claude Code itself (not in Cabinet) so that when Cabinet's agents invoke Claude Code as their provider runtime, they have access to the tools they need.

**CRITICAL:** This phase modifies Claude Code's configuration, which lives OUTSIDE the Cabinet repo. Find the user's Claude Code config file (typically at `~/.config/claude-code/` or `~/.claude/` on Linux/Mac — check what exists). Do NOT put MCP config inside the Cabinet repo.

### 4.1 Identify Claude Code's MCP config location

Check these paths in order:
- `~/.config/claude-code/mcp.json`
- `~/.claude/mcp_settings.json`
- Anything else that the `claude` CLI documentation describes as the MCP config file

Run `claude --help` or `claude mcp --help` if those commands exist to confirm the correct path. If you cannot determine the correct path, STOP and ask Matt where his Claude Code MCP config lives.

### 4.2 MCP servers to configure

Matt already has several MCP servers connected in his Claude.ai environment. The ones most relevant to Meta Desk are:
- **Context7** — for library documentation lookups when agents need to understand an API
- **Fireflies** — probably not needed for Meta Desk but Matt uses it for other things
- **Notion** — Matt may want to sync briefs there later
- **Slack** — Matt may want notifications there

For Meta Desk specifically, the MCP servers that would add the most value once configured:
- **Filesystem** (official MCP server) — pointed at the Cabinet `data/` directory so Claude Code can read/write knowledge base files reliably when invoked by agents. This is the single most important one for Meta Desk.
- **Fetch** (official MCP server) — for pulling web content during research tasks
- **Memory** (official MCP server) — optional, for agent memory beyond what files provide

Do NOT auto-install any MCP server that requires OAuth or API keys without asking Matt first. Filesystem and Fetch can be set up without credentials; everything else needs his input.

### 4.3 Configure what's configurable, stub what isn't

For filesystem and fetch MCP servers, write the appropriate config entries to the Claude Code MCP config file. Use the current working directory (the Cabinet repo root) as the filesystem scope, OR more specifically `{repo_root}/data` if that's more appropriate.

For any MCP server that requires credentials, write a stub entry with a `# TODO: set {env_var}` comment so Matt can see what he needs to fill in.

### 4.4 Write an MCP setup guide for Matt

Create `data/operations/mcp-setup.md` documenting:
- What MCP servers are configured and what they do
- Which ones Matt still needs to set up manually (Apify, Grok via API, etc.)
- How to test that MCP servers are working from within Claude Code
- How MCP configuration propagates to Cabinet agents (i.e., it propagates automatically because Cabinet agents invoke `claude` CLI under the hood)

### 4.5 Verify and report

Try to list configured MCP servers via whatever command Claude Code provides. Confirm filesystem access works by attempting a read on a data file through the MCP interface if possible. Write `PHASE_4_COMPLETE.md` including the list of configured servers, which ones need manual setup, and any issues.

STOP for review.

---

## Phase 5: Integration scaffolding (stubs only)

Goal: Create placeholder documentation and directory structure for the external integrations Matt will need. You are NOT installing, configuring, or running any of these — you are creating the operations pages that will track them.

### 5.1 Create operations pages for each integration

In `data/operations/`, create the following pages as tracking documents:

- `integrations-roadmap.md` — master list of all external integrations with status (not started / configured / live / broken) and priority
- `apify-setup.md` — which scrapers Matt plans to use (reference: kaitoeasyapi Follower Scraper, api-ninja Advanced Search Scraper, Twitter trends scraper, RedNote/Xiaohongshu scraper), estimated monthly cost, and status
- `grok-live-search.md` — planned use cases, prompt templates to develop, API key status
- `dexscreener-api.md` — endpoints to use, rate limits, refresh cadence
- `birdeye-api.md` — API key status, what data to pull
- `telegram-delivery.md` — channel setup (not started), bot token, delivery cadence
- `subscriber-email-delivery.md` — mailer provider (TBD), list management
- `openclaw-pipeline.md` — the local Python services that will eventually run on Matt's Ubuntu laptops to orchestrate scraping and feed observations into `data/observations/`

Each of these should be a real page with:
- Status at the top (NOT STARTED for all of them initially)
- What it's for
- Dependencies (what needs to be true before it can be set up)
- Setup steps (even if just a TODO list)
- Links to the relevant observation folder or delivery folder where its outputs will land

### 5.2 Create the scraper output contracts

In `data/operations/scrapers/`, create one file per planned scraper documenting the EXACT format of the markdown files it will write into `data/observations/`. This is the contract between the scraping layer (which Matt will build in Python outside Cabinet) and the agent layer (which reads the files Cabinet-side).

For each scraper, specify:
- Target folder under `data/observations/`
- Filename pattern
- Frontmatter schema (fields, types, required vs optional)
- Body format (what goes in the markdown body — raw content, transformed, etc.)
- Deduplication strategy (how the scraper knows whether an item has already been written)

Do at least these:
- `apify-x-followers.md`
- `apify-x-search.md`
- `apify-xiaohongshu.md`
- `grok-trends-japanese.md`
- `grok-trends-korean.md`
- `dexscreener-trending.md`
- `pump-fun-launches.md`

These contracts are the seam between the two halves of Matt's system. They matter more than the agent personas in some ways, because they're what lets the scraping layer and the agent layer evolve independently.

### 5.3 Create the delivery contract

Create `data/operations/delivery-contract.md` documenting:
- How a daily brief graduates from `draft` status to `reviewed` status to `published` status (the `status` field in the frontmatter)
- What triggers the subscriber delivery (answer: a manual step by Matt initially, later automated)
- What format subscribers receive (telegram markdown, email HTML, etc.)
- What gets stripped from the published version vs the full internal brief (e.g., debate log might stay internal)

### 5.4 Verify and report

Write `PHASE_5_COMPLETE.md` with the list of operations pages created and a summary of what integrations are now documented (even if not live).

STOP for review.

---

## Phase 6: Bootstrap the first daily brief template

Goal: Create today's daily brief as a template file so Matt has an example of the format and can start writing his first manual brief immediately.

### 6.1 Create today's daily brief stub

At `data/meta-desk/daily-briefs/{today's date}.md`, create a file with:
- Full frontmatter per the schema
- Empty `## Historian` section with a placeholder
- Empty `## Scout flags` section with a placeholder
- Empty `## Aesthetician` section
- Empty `## Translator` section
- Empty `## Skeptic` section
- Empty `## Referee synthesis` section
- A `## Matt's editorial notes` section at the bottom for his human edits

Mark the file clearly as the day-one template. Matt will write his first manual brief into this file using observations he's gathered by hand.

### 6.2 Create the brief-writing guide

Create `data/meta-desk/how-to-write-a-daily-brief.md` — a 500–700 word guide for Matt on how to write his first several manual briefs. This should reference:
- The voice guidance from the agent personas (since his voice will eventually train theirs)
- The screenshot test framework
- The three audiences model
- How to use the daily brief template
- The importance of writing 3–4 weeks of manual briefs before activating the agents

This document is critical. It's the bridge between "infrastructure is ready" and "Matt starts doing the actual work." Write it like you're onboarding a writer, because you are.

### 6.3 Create the go-live checklist

Create `data/meta-desk/go-live-checklist.md` — an ordered list of everything that has to be true before Meta Desk can launch to paying subscribers. This should include:
- Matt has written at least 14 manual daily briefs
- At least 3 agents are active and producing output Matt finds useful
- At least one scraper is wired in and populating `observations/`
- At least 5 cycle retrospectives are filled in with real content
- Seed list of at least 30 verified English CT accounts
- Delivery mechanism is working (Telegram channel exists, test brief delivered successfully)
- Pricing is set
- Legal disclaimer drafted (consult crypto attorney)
- First 5 beta subscribers identified

This is Matt's north star. When he wonders "am I ready," he re-reads this.

### 6.4 Verify and report

Write `PHASE_6_COMPLETE.md`. Include a final summary section at the bottom titled "What Matt should do next" with concrete suggested next actions in priority order.

---

## Final phase: Self-audit and handoff

After Phase 6, do one more pass:

1. Walk the entire `data/` directory and verify every file you created is syntactically valid (YAML frontmatter parses, markdown renders)
2. Check that no Cabinet code files were modified (run `git status` and verify only additions/modifications under `data/` and possibly the Claude Code MCP config outside the repo)
3. Check that all agents are set to `active: false`
4. Start the Cabinet dev server (or assume Matt has it running, since he told you he does) and verify via the agents API that your new personas load without errors
5. Write a final `META_DESK_HANDOFF.md` at the repo root containing:
   - A summary of everything you created across all phases
   - The directory tree of `data/` (as it now stands)
   - A list of open questions and decisions Matt needs to make
   - A list of the top 5 things Matt should do in his first hour after you hand back control
   - Anything you're uncertain about or anything you noticed about Cabinet's code that might affect Meta Desk later

Then STOP. Do not proceed past this point without explicit direction from Matt.

---

## Guardrails that apply throughout this entire task

- **Do not modify Cabinet's source code.** Only touch `data/` and (in Phase 4) the user-level Claude Code MCP config outside the repo.
- **Do not delete anything without explicit permission.** Archive instead.
- **Do not fabricate specific facts about the meme coin market.** When you need to include specific tokens, dates, prices, or accounts, use placeholders and mark them as `<!-- MATT: fill in -->`. The reference library is Matt's taste expressed in prose; it is not something you are qualified to invent for him.
- **Do not activate any agents.** All personas get `active: false`.
- **Do not install any MCP server that requires credentials without asking.**
- **When in doubt, stop and ask.** The penalty for asking is a slightly longer session. The penalty for guessing wrong is polluting the knowledge base with garbage that Matt has to clean up.
- **Commit frequently and write good commit messages.** Cabinet's auto-commit will handle most of this, but if you manually commit, use messages like `phase 1: scaffold meta-desk directory structure`.
- **Between phases, STOP and write the PHASE_{n}_COMPLETE.md file.** Do not proceed to the next phase without explicit "proceed to phase N" from Matt. This is non-negotiable. Matt needs to audit your work at each phase boundary.

## Success criteria

When you are done with all six phases and the final handoff, Matt should be able to:
1. Open the Cabinet web UI and see a clean Meta Desk workspace
2. See 8 agents listed, all inactive, with 3 of them having substantial personas and 5 marked as stubs
3. Read a clear manifesto explaining what Meta Desk is
4. Read a brief-writing guide explaining what he should do next
5. Read a go-live checklist showing what has to be true before he can launch to subscribers
6. See clear operations pages tracking every external integration he needs to set up
7. Have a well-structured place to put his first manual daily brief TODAY

If at the end Matt feels like he knows exactly what to do next, you succeeded. If he feels overwhelmed or confused, you failed — come back to me (via a note in the handoff document) with specific questions.

Begin with Phase 1. Read the orientation files first, then start creating the directory scaffold. Take your time. This is foundational work and it deserves care.

=== END META DESK SETUP INSTRUCTIONS ===

=== ADDENDUM: UI-INFORMED CLARIFICATIONS ===

I (Matt) just showed Vibe a screenshot of Cabinet's "Edit your own agent" 
creation dialog. Based on what we learned from the UI, apply these 
clarifications to the phases above — especially Phase 2.

1. **Avatar field constraint.** The avatar is a picker from a fixed set 
   of options, not arbitrary emoji. Before writing any persona frontmatter, 
   inspect whatever file in `src/` defines the available avatar options 
   (look for an array or enum of avatar identifiers — probably in 
   `components/agents/` or a constants file). Pick avatars from that list 
   for each agent. If you can't find the list, use plain emoji that are 
   most likely supported (📚 🔭 🗡️ 🌐 🎨 ⚖️ ✍️ 🔨) and flag in the phase 
   report that avatar selection may need manual adjustment.

2. **Active flag is critical.** The UI defaults "Start active" to CHECKED, 
   which means the system's default assumption is that new agents should 
   run. Override this explicitly in every persona file by setting 
   `active: false` in the frontmatter, and after writing all 8 personas, 
   do a grep across `data/.agents/*/index.md` to confirm zero instances 
   of `active: true`. Include this grep result in the Phase 2 completion 
   report. This is the single most important verification in Phase 2 — 
   we absolutely do not want agents running on cron schedules before 
   Matt has reviewed them.

3. **Heartbeat preset vs custom cron.** The UI offers preset heartbeats 
   (5m / 15m / 30m / 1h / 4h / Daily 9am / Weekdays / Weekly) and a 
   "Show cron expression" toggle for custom schedules. My earlier phase-2 
   schedule spec uses several custom cron expressions. That's fine — 
   they'll work via the file-based frontmatter regardless of what the UI 
   exposes. But ALSO, for each agent, note in a comment at the top of 
   the persona file which preset the agent's schedule maps to (or "custom" 
   if it doesn't). This helps Matt understand the UI↔file relationship 
   when he's editing.

4. **Provider should be "Claude Code Max".** The UI showed "Claude Code 
   Max" as a provider option. Use that as the provider value for all 8 
   agents unless you find evidence in the code that it should be spelled 
   differently (e.g., "claude-code-max", "claude_code_max"). Inspect the 
   provider registry code to confirm the exact string, then use it 
   consistently across all personas.

5. **Instruction field shape.** The persona markdown body shows up in a 
   single textarea in the UI. This doesn't change the content, but keep 
   personas scannable — use clear section headers and avoid walls of 
   unbroken text. Your Phase 2 persona bodies should already be like 
   this, but double-check before you finalize.

Everything else in the original instructions stands. Proceed with 
Phase 1 as originally specified. Acknowledge receipt of this addendum 
before beginning work.

=== END ADDENDUM ===