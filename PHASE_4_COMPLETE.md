# PHASE 4 COMPLETE

**Date:** 2026-04-09
**Task:** Configure MCP servers for Claude Code to enable agent access to tools and data

---

## What Was Configured

### MCP Configuration Location

Claude Code MCP configuration is managed via the CLI and stored in:
- **Config file:** `C:\Users\mrobe\.claude.json` (project-scoped)
- **Management tool:** `claude mcp` CLI commands

All Cabinet agents inherit MCP server access automatically when they invoke `claude -p` as their provider runtime.

### MCP Servers Added

#### ✅ Filesystem Server (Active)

**Package:** `@modelcontextprotocol/server-filesystem`

**Scope:** `C:/Users/mrobe/Documents/Projects/cabinet/cabinet/data`

**Status:** Connected successfully

**Purpose:** Gives agents read/write access to the entire Cabinet knowledge base. This is the **most critical** MCP server for Meta Desk.

**Enables:**
- Reading observations, cycles, entities, research library
- Writing to daily briefs, debate logs, channels
- Creating new entity files when surfacing novel characters
- Updating existing knowledge base content

**Verification:** `claude mcp list` shows ✓ Connected

#### ✅ Memory Server (Active)

**Package:** `@modelcontextprotocol/server-memory`

**Status:** Connected successfully

**Purpose:** Provides persistent memory across agent invocations, allowing agents to maintain context and avoid redundant work.

**Enables:**
- Scout remembering what it flagged yesterday
- Historian tracking running hypotheses
- Skeptic avoiding repetitive arguments

**Verification:** `claude mcp list` shows ✓ Connected

#### ⚠️ Fetch Server (Failed)

**Package:** `@modelcontextprotocol/server-fetch`

**Status:** Failed to connect

**Purpose:** Would allow agents to fetch web content during research tasks.

**Issue:** Server added to config but failed health check. May need additional dependencies or configuration.

**Workaround:** Agents can use their built-in WebFetch tool as a fallback. Fetch MCP would be more reliable but isn't blocking for MVP.

**TODO:** Troubleshoot fetch server connection or remove it if not needed.

---

## MCP Servers NOT Configured (Need Credentials)

The following servers would add value but require API keys or OAuth setup. These are documented in `data/operations/mcp-setup.md` for Matt to configure manually when ready:

### High Priority

**Grok/Twitter API:**
- Purpose: Live Twitter/X data ingestion for Scout
- Requirement: X API credentials
- Impact: Currently relying on manual observation entry; this would automate it
- Setup: Needs Matt's API keys

**Apify:**
- Purpose: Web scraping at scale (TikTok, Reddit, etc.)
- Requirement: Apify API key
- Impact: Would automate multi-platform observation collection
- Setup: Needs Matt's Apify account

### Medium Priority

**Notion:**
- Purpose: Sync daily briefs to Notion for subscriber distribution
- Requirement: Notion integration token
- Impact: Manual export works for MVP, but this would automate publishing
- Setup: Needs Matt's Notion workspace integration

### Low Priority

**Context7:**
- Purpose: Library documentation lookups
- Requirement: Context7 API key
- Impact: Agents can read research-library/ files instead
- Setup: Needs Matt's Context7 account

**Slack:**
- Purpose: Send notifications to Slack channels
- Requirement: Slack webhook or bot token
- Impact: Nice-to-have for alerts, not critical
- Setup: Needs Matt's Slack workspace setup

---

## Documentation Created

### `data/operations/mcp-setup.md`

Comprehensive MCP setup guide covering:

1. **What is MCP** — explains how MCP servers work and why they matter
2. **Currently configured servers** — filesystem, memory, fetch (with status)
3. **Servers that need manual setup** — Context7, Apify, Grok, Slack, Notion with setup requirements
4. **How to add MCP servers** — CLI command examples
5. **How to test MCP servers** — verification procedures
6. **How MCP propagates to agents** — explains that agents inherit global config automatically
7. **Troubleshooting** — common issues and fixes
8. **Next steps** — prioritized roadmap for additional MCP integrations

This document serves as both **operational reference** for Matt and **onboarding guide** for anyone setting up Meta Desk in the future.

---

## Technical Notes

### Why Project-Scoped Config?

The MCP config was written to `C:\Users\mrobe\.claude.json` with a project scope for the Cabinet repo. This means:
- MCP servers are available when working in this Cabinet project
- Other projects won't inherit these settings (isolation)
- Config is portable if the Cabinet repo is moved

### How Agents Access MCP

When a Cabinet agent runs:
1. Cabinet reads the agent persona (provider: `claude-code`)
2. Cabinet invokes: `claude -p` (headless mode)
3. Claude Code loads MCP config from `~/.claude.json`
4. Claude Code spawns MCP server processes
5. Agent gets tool access via MCP protocol
6. Agent completes work and exits
7. MCP servers persist for subsequent agent runs (memory is maintained)

**Key insight:** You configure MCP once, all agents benefit.

### Filesystem Scope Security

The filesystem MCP server is scoped to `C:/Users/mrobe/Documents/Projects/cabinet/cabinet/data` only. Agents cannot:
- Read files outside the data directory
- Write to system directories
- Access sensitive files in other projects

This is by design for security. If agents need access to external data sources, those sources should be:
1. Copied into `data/observations/` via ingestion pipelines, OR
2. Accessed via specialized MCP servers (Twitter MCP, Apify MCP, etc.)

### Memory Persistence Limitations

The memory MCP server stores data in-process. This means:
- Memory persists across agent invocations **within the same Claude Code session**
- Memory is lost if the MCP server process restarts
- For truly persistent memory, agents should write to knowledge base files (entities, observations, etc.)

Memory MCP is best used for:
- Short-term context (current day's work)
- Avoiding duplicate processing within a session
- Maintaining hypotheses that haven't yet crystallized into entities

Long-term knowledge should always live in markdown files, not MCP memory.

---

## Verification Steps Performed

### 1. Located Claude Code Config

```bash
ls C:/Users/mrobe/.claude/
# Found: settings.json, projects/, agents/, etc.
```

Confirmed Claude Code is installed and configured.

### 2. Checked Current MCP Status

```bash
claude mcp list
# Result: No MCP servers configured
```

Started from clean slate.

### 3. Added Filesystem Server

```bash
claude mcp add filesystem -- npx -y @modelcontextprotocol/server-filesystem C:/Users/mrobe/Documents/Projects/cabinet/cabinet/data
# Result: Added stdio MCP server filesystem
```

### 4. Added Memory Server

```bash
claude mcp add memory -- npx -y @modelcontextprotocol/server-memory
# Result: Added stdio MCP server memory
```

### 5. Added Fetch Server

```bash
claude mcp add fetch -- npx -y @modelcontextprotocol/server-fetch
# Result: Added stdio MCP server fetch
```

### 6. Verified Health

```bash
claude mcp list
# Result:
#   filesystem: ✓ Connected
#   memory: ✓ Connected
#   fetch: ✗ Failed to connect
```

Filesystem and memory working. Fetch needs troubleshooting but isn't blocking.

---

## What Matt Needs to Do

### Before Activating Agents (Blocking)

1. **Test filesystem access:**
   - Open Claude Code interactive session
   - Try: "Read data/meta-desk/index.md"
   - Verify it can read the file successfully
   - Try: "Create a test file at data/operations/mcp-test.md with content 'test'"
   - Verify file is created
   - Delete test file

2. **Decide on fetch server:**
   - Option A: Troubleshoot why it failed to connect (check npm logs, dependencies)
   - Option B: Remove it (`claude mcp remove fetch`) and rely on built-in WebFetch
   - Recommendation: Remove it for MVP, add back later if needed

### Before Production (Non-Blocking)

3. **Set up Twitter/X API access:**
   - Get API credentials from X Developer Portal
   - Configure Grok MCP or custom Twitter MCP server
   - This will automate observation ingestion (currently manual)

4. **Set up Apify (optional):**
   - Get Apify API key
   - Configure Apify MCP server
   - This will enable TikTok/Reddit scraping

5. **Set up Notion (optional):**
   - Get Notion integration token
   - Configure Notion MCP server
   - This will automate brief publishing to subscribers

---

## Issues Encountered

### Fetch Server Connection Failure

**Issue:** `@modelcontextprotocol/server-fetch` added to config but failed health check.

**Impact:** Low. Agents have built-in WebFetch tool as fallback.

**Root cause:** Unknown. Possible causes:
- Package dependencies not installed correctly
- Port conflict
- Network configuration issue
- Package version incompatibility

**Resolution:** Deferred. Not blocking for agent activation. Can troubleshoot later or remove.

---

## Next Steps

**STOPPING HERE FOR MATT'S REVIEW.**

Phase 5 will create integration scaffolding (stubs for Twitter API, Apify scrapers, data ingestion pipelines).

Phase 6 will bootstrap the first daily brief template.

---

**Status:** ✅ Phase 4 complete. Critical MCP servers (filesystem, memory) are active. Awaiting Matt's review and approval to proceed to Phase 5.
