export interface SearchField {
  text: string;
  weight: number;
}

const EXACT = 1;
const PREFIX = 0.9;
const WORD_PREFIX = 0.8;
const SUBSTRING = 0.6;
const FUZZY_MAX = 0.4;
/** A multi-word query matched word by word ranks below the same words as one phrase. */
const TOKEN_PENALTY = 0.9;

function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

function isWordStart(text: string, index: number): boolean {
  return index === 0 || !/[\p{L}\p{N}]/u.test(text[index - 1] ?? '');
}

/** Below this share of matched characters in its span, a fuzzy match is noise. */
const MIN_FUZZY_COMPACTNESS = 0.5;

function fuzzyScoreFrom(
  haystack: string,
  needle: string,
  start: number,
): number {
  let hi = start;
  let wordStarts = 0;

  for (const ch of needle) {
    const found = haystack.indexOf(ch, hi);
    if (found === -1) return 0;
    if (isWordStart(haystack, found)) wordStarts++;
    hi = found + 1;
  }

  const compactness = needle.length / (hi - start);
  if (compactness < MIN_FUZZY_COMPACTNESS) return 0;

  const wordStartRatio = wordStarts / needle.length;
  return FUZZY_MAX * (0.7 * compactness + 0.3 * wordStartRatio);
}

/**
 * Scores an in-order, possibly gapped match of `needle` in `haystack`, so
 * typos by omission ("stngs") still find their target. Tighter spans and
 * characters landing on word starts score higher.
 */
function fuzzyScore(haystack: string, needle: string): number {
  const first = needle[0];
  if (!first) return 0;

  let best = 0;
  let start = haystack.indexOf(first);
  while (start !== -1) {
    best = Math.max(best, fuzzyScoreFrom(haystack, needle, start));
    start = haystack.indexOf(first, start + 1);
  }
  return best;
}

/** Short queries tolerate no wrong letters: "ma" would match nearly anything. */
function allowedTypos(needleLength: number): number {
  if (needleLength < 4) return 0;
  if (needleLength < 8) return 1;
  return 2;
}

/**
 * The fewest edits (wrong, missing, extra or swapped letters) that turn
 * `needle` into some substring of `haystack`, or Infinity above `maxEdits`.
 * Sellers' algorithm with the optimal-string-alignment transposition.
 */
function substringEditDistance(
  haystack: string,
  needle: string,
  maxEdits: number,
): number {
  const width = haystack.length + 1;
  let beforePrevious = new Array<number>(width).fill(0);
  let previous = new Array<number>(width).fill(0);

  for (let i = 1; i <= needle.length; i++) {
    const current = new Array<number>(width);
    current[0] = i;
    let rowMin = i;

    for (let j = 1; j < width; j++) {
      const substitution = needle[i - 1] === haystack[j - 1] ? 0 : 1;
      let edits = Math.min(
        previous[j - 1]! + substitution,
        previous[j]! + 1,
        current[j - 1]! + 1,
      );
      if (
        i > 1 &&
        j > 1 &&
        needle[i - 1] === haystack[j - 2] &&
        needle[i - 2] === haystack[j - 1]
      ) {
        edits = Math.min(edits, beforePrevious[j - 2]! + 1);
      }
      current[j] = edits;
      rowMin = Math.min(rowMin, edits);
    }

    if (rowMin > maxEdits) return Infinity;
    beforePrevious = previous;
    previous = current;
  }

  return Math.min(...previous);
}

/** Scores a match with a few typos, so "brsve" still finds "brave". */
function typoScore(haystack: string, needle: string): number {
  const maxEdits = allowedTypos(needle.length);
  if (maxEdits === 0) return 0;

  const edits = substringEditDistance(haystack, needle, maxEdits);
  if (edits > maxEdits) return 0;
  return FUZZY_MAX * (1 - edits / needle.length);
}

function scoreText(haystack: string, needle: string): number {
  if (haystack === needle) return EXACT;
  if (haystack.startsWith(needle)) return PREFIX;

  let index = haystack.indexOf(needle);
  if (index !== -1) {
    while (index !== -1) {
      if (isWordStart(haystack, index)) return WORD_PREFIX;
      index = haystack.indexOf(needle, index + 1);
    }
    return SUBSTRING;
  }

  return Math.max(fuzzyScore(haystack, needle), typoScore(haystack, needle));
}

function bestFieldScore(fields: SearchField[], needle: string): number {
  let best = 0;
  for (const field of fields) {
    best = Math.max(best, scoreText(field.text, needle) * field.weight);
  }
  return best;
}

/** How well `query` matches an item described by `fields`, from 0 (no match) upwards. */
export function searchScore(rawFields: SearchField[], query: string): number {
  const phrase = normalizeSearchText(query);
  if (!phrase) return 1;

  const fields = rawFields.map((f) => ({
    ...f,
    text: normalizeSearchText(f.text),
  }));
  const phraseScore = bestFieldScore(fields, phrase);

  const tokens = phrase.split(/\s+/);
  if (tokens.length < 2) return phraseScore;

  let tokenTotal = 0;
  for (const token of tokens) {
    const score = bestFieldScore(fields, token);
    if (score === 0) return phraseScore;
    tokenTotal += score;
  }

  return Math.max(phraseScore, (tokenTotal / tokens.length) * TOKEN_PENALTY);
}

/**
 * Filters `items` to those matching `query` and sorts them best match first.
 * Ties keep their original order, and an empty query returns `items` as is.
 */
export function rankByQuery<T>(
  items: readonly T[],
  query: string,
  fields: (item: T) => SearchField[],
): T[] {
  if (!normalizeSearchText(query)) return [...items];

  return items
    .map((item, index) => ({
      item,
      index,
      score: searchScore(fields(item), query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}
