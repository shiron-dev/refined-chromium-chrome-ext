export interface FuzzyOptions {
  caseSensitive?: boolean;
}

// Scoring constants
const BONUS_START = 15;
const BONUS_WORD_BOUNDARY = 10;
const BONUS_CONSECUTIVE_BASE = 5;
const BONUS_EXACT = 100;
const PENALTY_GAP = 0.5;
const PENALTY_LENGTH = 0.1;
const PENALTY_PATH_DEPTH = 2;

/**
 * Returns true if position `pos` in string `str` is at a word boundary.
 * Word boundaries occur at:
 *   - Start of string (pos === 0)
 *   - After whitespace, hyphen, underscore, slash, or dot
 *   - camelCase transitions: lowercase/digit → uppercase
 */
function isWordBoundary(str: string, pos: number): boolean {
  if (pos === 0) return true;
  const prev = str[pos - 1];
  const curr = str[pos];
  if (/[\s\-_/.]/.test(prev)) return true;
  if (/[a-z0-9]/.test(prev) && /[A-Z]/.test(curr)) return true;
  return false;
}

/**
 * Scores a single token against a single candidate using fuzzy subsequence
 * matching. Returns null if the token cannot be found as a subsequence.
 */
function scoreToken(
  token: string,
  candidate: string,
  caseSensitive: boolean,
): number | null {
  // NFKC normalizes full-width chars (ＡＢＣ→ABC) and combining forms
  const cOrig = candidate.normalize("NFKC");
  const q = caseSensitive
    ? token.normalize("NFKC")
    : token.normalize("NFKC").toLowerCase();
  const c = caseSensitive ? cOrig : cOrig.toLowerCase();

  if (q.length === 0) return 0;
  if (c.length === 0) return null;

  // Greedy forward scan for subsequence
  let qi = 0;
  const positions: number[] = [];
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) {
      positions.push(ci);
      qi++;
    }
  }
  if (qi < q.length) return null; // token is not a subsequence

  let score = 0;
  let run = 1;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i];
    score += 1; // base per-match point

    if (pos === 0) score += BONUS_START;
    // Use cOrig (case-preserved, NFKC-normalized) for camelCase detection
    if (isWordBoundary(cOrig, pos)) score += BONUS_WORD_BOUNDARY;

    if (i > 0 && positions[i] === positions[i - 1] + 1) {
      run++;
      score += BONUS_CONSECUTIVE_BASE * run;
    } else {
      run = 1;
    }
  }

  // Exact match bonus (after case/normalization)
  if (c === q) score += BONUS_EXACT;

  // Prefer compact (dense) matches
  const span = positions[positions.length - 1] - positions[0] + 1;
  score -= (span - positions.length) * PENALTY_GAP;

  // Prefer shorter candidates
  score -= cOrig.length * PENALTY_LENGTH;

  // Prefer shallower paths
  score -= (cOrig.match(/\//g)?.length ?? 0) * PENALTY_PATH_DEPTH;

  return score;
}

/**
 * Fuzzy-matches a (space-separated) query against a single candidate string.
 *
 * - Each whitespace-delimited token must independently match the candidate
 *   as a subsequence; if any token fails, returns null.
 * - An empty / whitespace-only query always matches with score 0.
 * - null / undefined inputs are handled gracefully.
 */
export function fuzzyScore(
  query: string,
  candidate: string,
  options: FuzzyOptions = {},
): number | null {
  if (candidate == null) return null;
  const trimmed = (query ?? "").trim();
  if (trimmed === "") return 0;

  const caseSensitive = options.caseSensitive ?? false;
  const tokens = trimmed.split(/\s+/);

  let total = 0;
  for (const token of tokens) {
    const s = scoreToken(token, candidate, caseSensitive);
    if (s === null) return null;
    total += s;
  }
  return total;
}

/**
 * Filters an array of items by fuzzy score and returns them sorted
 * highest-score first.  Items that don't match are excluded.
 * When the query is empty, all items are returned in their original order.
 */
export function fuzzyFilter<T>(
  query: string,
  items: T[],
  getKey: (item: T) => string,
  options: FuzzyOptions = {},
): T[] {
  if (!query.trim()) return items;

  const scored: Array<{ item: T; score: number }> = [];
  for (const item of items) {
    const score = fuzzyScore(query, getKey(item), options);
    if (score !== null) scored.push({ item, score });
  }
  return scored.sort((a, b) => b.score - a.score).map(e => e.item);
}
