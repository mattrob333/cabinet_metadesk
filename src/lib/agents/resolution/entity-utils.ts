/**
 * Entity Utilities
 *
 * Shared helpers for extracting and validating named entities (token tickers,
 * protocol names, narrative slugs) from gap question/claim text.
 *
 * These are intentionally conservative: it's better to return "General" than
 * to record a text fragment like `" without seeing actual images"` in the
 * confidence ledger (which is the bug this file was written to prevent).
 */

// English stop-words and common all-caps acronyms that show up inside
// capitalized prose but are NOT project/token entities.
const ALL_CAPS_BLOCKLIST = new Set([
  // Common English words that appear in all-caps
  'A', 'AN', 'AND', 'AS', 'AT', 'BE', 'BY', 'BUT', 'DO', 'FOR', 'FROM', 'HAS',
  'HE', 'IF', 'IN', 'IS', 'IT', 'NO', 'NOR', 'NOT', 'OF', 'ON', 'OR', 'SHE',
  'SO', 'THE', 'THIS', 'THAT', 'THESE', 'THOSE', 'TO', 'UP', 'US', 'WE',
  'WHO', 'WHY', 'YOU', 'WHICH', 'WHAT', 'WHEN', 'WHERE', 'HOW',
  // Auxiliaries and copulas
  'WAS', 'WERE', 'ARE', 'ARENT', 'CANT', 'DIDNT', 'DONT', 'HASNT', 'HAVENT',
  'ISNT', 'WONT', 'WOULDNT', 'COULDNT', 'SHOULDNT',
  // Generic all-caps words in docs/briefs
  'TODO', 'FIXME', 'TBD', 'WIP', 'NOTE', 'WARN', 'INFO', 'DEBUG', 'TLDR',
  'FAQ', 'README', 'API', 'CLI', 'URL', 'URI', 'ID', 'UI', 'UX',
  // Things the debate workflow itself emits
  'PENDING', 'RESOLVED', 'UNRESOLVABLE', 'STATE', 'EVIDENCE', 'SOURCES', 'REASON',
  'SUMMARY', 'CONTEXT', 'ARTIFACT', 'DECISION', 'LEARNING', 'GOAL', 'MESSAGE',
  'FULL', 'PARTIAL', 'MINIMAL', 'PARTIALLY',
  // Generic sector/tech acronyms that aren't project-specific
  'AI', 'ML', 'NFT', 'DEX', 'DEFI', 'DAO', 'CEX', 'RPC', 'KYC', 'AML',
  'GDP', 'USD', 'EUR', 'JPY', 'GBP', 'BTC', 'ETH', 'SOL',
  // Regions / languages
  'EU', 'UK', 'USA', 'UN', 'CN', 'JP', 'KR', 'EN', 'FR', 'DE', 'ES',
]);

// Entities that are allowed even though they'd otherwise be too short.
// Kept small on purpose — meme tokens typically have ≥3-char tickers.
const SHORT_ENTITY_ALLOWLIST = new Set([
  'BTC', 'ETH', 'SOL', // Not "entities" in the Meta Desk sense, but harmless allowlist anchors.
]);

const MAX_ENTITY_LENGTH = 40;

/**
 * Normalize an entity candidate string.
 * Strips whitespace, trailing punctuation, and surrounding quotes.
 */
function normalize(raw: string): string {
  return raw
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[.,;:!?]+$/g, '')
    .trim();
}

/**
 * Return true if the given string looks like a real entity name (a ticker,
 * protocol, or short proper noun) rather than a sentence fragment.
 */
export function isPlausibleEntity(name: string): boolean {
  const n = normalize(name);
  if (!n) return false;
  if (n.length > MAX_ENTITY_LENGTH) return false;

  // Must start with a letter (tickers + proper nouns do; sentence fragments
  // like ` without seeing…` start with a space, which we trim, but the first
  // character of a real fragment like "without" would be lowercase).
  if (!/^[A-Za-z]/.test(n)) return false;

  // Sentence-fragment smell: contains English verbs/auxiliaries mid-string,
  // contains line-break-ish punctuation, or starts with a lowercase-only word.
  // Real entities are short proper nouns, all-caps tickers, or capitalized
  // multi-word names like "Agentic Payments".
  const words = n.split(/\s+/);
  if (words.length > 4) return false;

  // If it's a single word, be strict about character class.
  if (words.length === 1) {
    // Single-word entity: allow either ALL-CAPS ticker or PascalCase.
    if (/^[A-Z0-9]{2,}$/.test(n)) {
      if (ALL_CAPS_BLOCKLIST.has(n) && !SHORT_ENTITY_ALLOWLIST.has(n)) return false;
      return n.length >= 2;
    }
    // Mixed-case single word: must start with capital and be short.
    return /^[A-Z][A-Za-z0-9]{1,14}$/.test(n);
  }

  // Multi-word: every word must either be capitalized or an all-caps ticker,
  // and the phrase must not contain common English verbs/prepositions.
  const LOWERCASE_STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'for']);
  for (const w of words) {
    const lower = w.toLowerCase();
    // Allow small linking words between capitalized ones ("Bank of America").
    if (LOWERCASE_STOPWORDS.has(lower)) continue;
    // Each non-stopword must start with a capital letter and have no internal punctuation.
    if (!/^[A-Z][A-Za-z0-9-]*$/.test(w)) return false;
  }

  // Reject obvious sentence fragments — anything containing a verb-like
  // lowercase word (not in stopwords) already fails the loop above, so we're
  // safe here. Final guardrail: reject things that look like "… X".
  if (/\b(without|seeing|claim|actual|that|which|where|when|while|because)\b/i.test(n)) {
    return false;
  }

  return true;
}

/**
 * Clean up an entity name candidate. Returns the normalized string if it
 * passes `isPlausibleEntity`, otherwise returns null.
 */
export function sanitizeEntityName(raw: string): string | null {
  const n = normalize(raw);
  return isPlausibleEntity(n) ? n : null;
}

/**
 * Extract a likely entity name from free text (question + claim).
 * Returns 'General' if nothing plausible is found — same fallback contract
 * the old LedgerManager had, so callers can switch over without a nullcheck.
 *
 * Strategy, in order:
 *   1. Named patterns we've seen in practice ("Agentic Payments", "… Exploit").
 *   2. All-caps token tickers (3–10 chars, blocklist-filtered).
 *   3. PascalCase single words (short proper nouns).
 *   4. Fallback: 'General'.
 *
 * Note we deliberately DROPPED the old `"([^"]+)"` quoted-text fallback —
 * that was the source of entities like `" without seeing actual images"`.
 */
export function extractEntityFromText(question: string, claim: string): string {
  const text = `${question} ${claim}`;

  // 1. Known multi-word narratives/events.
  if (/agentic payments?/i.test(text)) return 'Agentic Payments';
  const exploitMatch = text.match(/\b([A-Z][A-Za-z0-9]{2,15})\s+Exploit\b/);
  if (exploitMatch) return `${exploitMatch[1]} Exploit`;

  // 2. All-caps ticker candidates, in order of appearance.
  const allCapsMatches = text.match(/\b[A-Z0-9]{3,10}\b/g) || [];
  for (const candidate of allCapsMatches) {
    if (!ALL_CAPS_BLOCKLIST.has(candidate)) return candidate;
  }

  // 3. PascalCase proper nouns — but only if they appear *outside* of
  //    sentence-start position (to avoid picking up "When", "What", etc.).
  //    We split on whitespace and skip the first word of each sentence.
  const sentences = text.split(/[.!?]\s+/);
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).slice(1); // skip sentence-start word
    for (const word of words) {
      const cleaned = word.replace(/[^A-Za-z0-9]/g, '');
      if (/^[A-Z][a-z]{2,14}$/.test(cleaned) && isPlausibleEntity(cleaned)) {
        // Skip common English PascalCase words that sneak through.
        if (/^(When|What|Where|Why|How|Which|The|This|That|These|Those|Can|Could|Would|Should)$/.test(cleaned)) continue;
        return cleaned;
      }
    }
  }

  return 'General';
}
