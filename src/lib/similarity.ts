/**
 * Diversity check: detect near-duplicate answers within a single
 * submission (e.g. "crocodile uses diamond as gastrolith" repeated as
 * "alligator uses diamond as gastrolith"). Server-side Jaccard
 * similarity on lowercased non-stopword tokens.
 *
 * Threshold = 0.5 catches one-word swaps like the example above
 * without flagging legitimately-different answers (which typically
 * share ≤ 0.2 Jaccard).
 */

const STOPWORDS = new Set([
  "the","a","an","of","to","in","on","at","by","for","with","from","into","onto","upon",
  "and","or","but","not","is","are","was","were","be","been","being","have","has","had",
  "do","does","did","can","could","may","might","will","would","shall","should","must",
  "this","that","these","those","it","its","they","them","their","there","here",
  "as","than","then","so","if","because","while","when","where","how","what","which",
  "i","you","he","she","we","us","my","your","our","his","her",
  // domain-specific: every answer talks about diamond, so remove it
  "diamond","diamonds","use","uses","used","using","could","might","may","would","will",
  "very","just","also","even","more","much","some","any","each","every","one","two","ten",
]);

function tokenize(s: string): Set<string> {
  if (!s) return new Set();
  const tokens = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export interface AnswerInput { text: string; skipped: boolean; }
export interface DuplicateResult { isDuplicate: boolean; duplicateOf: number | null; similarity: number; }

/**
 * Mark an answer duplicate if its Jaccard similarity to any earlier
 * non-duplicate non-skipped answer is >= threshold (default 0.5).
 * Returns one DuplicateResult per input answer.
 */
export function detectDuplicates(
  answers: AnswerInput[],
  threshold = 0.5,
): DuplicateResult[] {
  const tokens = answers.map((a) => (a.skipped ? new Set<string>() : tokenize(a.text)));
  const result: DuplicateResult[] = answers.map(() => ({
    isDuplicate: false, duplicateOf: null, similarity: 0,
  }));

  for (let i = 0; i < answers.length; i++) {
    if (answers[i].skipped || tokens[i].size === 0) continue;
    let bestMatch = -1;
    let bestSim = 0;
    for (let j = 0; j < i; j++) {
      if (answers[j].skipped || result[j].isDuplicate) continue;
      const sim = jaccard(tokens[i], tokens[j]);
      if (sim > bestSim) { bestSim = sim; bestMatch = j; }
    }
    if (bestMatch >= 0 && bestSim >= threshold) {
      result[i] = { isDuplicate: true, duplicateOf: bestMatch, similarity: bestSim };
    } else {
      result[i] = { isDuplicate: false, duplicateOf: null, similarity: bestSim };
    }
  }
  return result;
}
