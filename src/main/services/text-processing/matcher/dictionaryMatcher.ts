import type { PronunciationRule, ProviderScope } from '@shared/types/dictionary.types';
import type { TextTransformation } from '@shared/types/textProcessing.types';

export interface MatcherSpan {
  start: number;
  end: number;
}

export interface MatchCandidate {
  rule: PronunciationRule;
  start: number;
  end: number;
  sourceText: string;
  replacementText: string;
  isProviderSpecific: boolean;
}

export interface DictionaryMatcherResult {
  text: string;
  transformations: TextTransformation[];
  protectedSpans: MatcherSpan[];
  matchCount: number;
}

const UNICODE_WORD_CHAR_REGEX = /[\p{L}\p{N}_]/u;

export class DictionaryMatcher {
  /**
   * Applies active pronunciation dictionary rules to text in a single, non-cascading pass
   * adhering strictly to precedence rules (position > length > provider > priority > tie-breaker).
   */
  public matchAndReplace(
    text: string,
    rules: PronunciationRule[],
    providerContext: ProviderScope = 'ALL'
  ): DictionaryMatcherResult {
    if (!text || rules.length === 0) {
      return {
        text,
        transformations: [],
        protectedSpans: [],
        matchCount: 0
      };
    }

    // 1. Filter applicable rules
    const applicableRules = rules.filter((rule) => {
      if (!rule.enabled) return false;
      if (rule.providerScope === 'ALL') return true;
      return rule.providerScope === providerContext;
    });

    if (applicableRules.length === 0) {
      return {
        text,
        transformations: [],
        protectedSpans: [],
        matchCount: 0
      };
    }

    // 2. Find all candidate matches across the text
    const candidates: MatchCandidate[] = [];
    const textLower = text.toLocaleLowerCase('vi-VN');

    for (const rule of applicableRules) {
      const term = rule.term;
      if (!term) continue;

      const termToSearch = rule.caseSensitive ? term : term.toLocaleLowerCase('vi-VN');
      const targetSource = rule.caseSensitive ? text : textLower;
      const termLen = term.length;

      let searchIndex = 0;
      while (searchIndex <= targetSource.length - termLen) {
        const foundIndex = targetSource.indexOf(termToSearch, searchIndex);
        if (foundIndex === -1) break;

        const endIndex = foundIndex + termLen;

        // Check whole-word boundary if configured (Section 12, 90)
        let isBoundaryValid = true;
        if (rule.wholeWord) {
          // Preceding char must not be unicode word char
          if (foundIndex > 0) {
            const prevChar = text[foundIndex - 1];
            if (UNICODE_WORD_CHAR_REGEX.test(prevChar)) {
              isBoundaryValid = false;
            }
          }
          // Following char must not be unicode word char
          if (isBoundaryValid && endIndex < text.length) {
            const nextChar = text[endIndex];
            if (UNICODE_WORD_CHAR_REGEX.test(nextChar)) {
              isBoundaryValid = false;
            }
          }
        }

        if (isBoundaryValid) {
          candidates.push({
            rule,
            start: foundIndex,
            end: endIndex,
            sourceText: text.slice(foundIndex, endIndex),
            replacementText: rule.spokenText,
            isProviderSpecific: rule.providerScope !== 'ALL'
          });
        }

        searchIndex = foundIndex + 1;
      }
    }

    if (candidates.length === 0) {
      return {
        text,
        transformations: [],
        protectedSpans: [],
        matchCount: 0
      };
    }

    // 3. Resolve overlaps according to Precedence Rules (Section 14, 15):
    //    1. Match starting earlier in text
    //    2. Longer match (term length desc)
    //    3. Provider-specific over ALL
    //    4. Higher priority
    //    5. Deterministic tie-breaker
    candidates.sort((a, b) => {
      // 1. Earlier start
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      // 2. Longer term length
      const lenA = a.end - a.start;
      const lenB = b.end - b.start;
      if (lenA !== lenB) {
        return lenB - lenA;
      }
      // 3. Provider-specific overrides ALL
      if (a.isProviderSpecific !== b.isProviderSpecific) {
        return a.isProviderSpecific ? -1 : 1;
      }
      // 4. Higher priority
      if (a.rule.priority !== b.rule.priority) {
        return b.rule.priority - a.rule.priority;
      }
      // 5. Deterministic tie-breaker (id)
      return a.rule.id.localeCompare(b.rule.id);
    });

    // Select greedy non-overlapping set of matches
    const selectedMatches: MatchCandidate[] = [];
    let lastAcceptedEnd = -1;

    for (const cand of candidates) {
      // If candidate starts at or after the previous match ended, it doesn't overlap
      if (cand.start >= lastAcceptedEnd) {
        selectedMatches.push(cand);
        lastAcceptedEnd = cand.end;
      }
    }

    // 4. Construct the transformed text in a single pass (Non-cascading)
    let result = '';
    let currentSourcePos = 0;
    const transformations: TextTransformation[] = [];
    const protectedSpans: MatcherSpan[] = [];

    for (const match of selectedMatches) {
      // Append text preceding this match
      if (match.start > currentSourcePos) {
        result += text.slice(currentSourcePos, match.start);
      }

      const replacementStart = result.length;
      result += match.replacementText;
      const replacementEnd = result.length;

      // Track protected span in resulting text
      protectedSpans.push({
        start: replacementStart,
        end: replacementEnd
      });

      // Track transformation trace
      transformations.push({
        stage: 'dictionary',
        sourceText: match.sourceText,
        resultText: match.replacementText,
        sourceStart: match.start,
        sourceEnd: match.end,
        ruleId: match.rule.id,
        category: match.rule.category || undefined
      });

      currentSourcePos = match.end;
    }

    // Append any remainder
    if (currentSourcePos < text.length) {
      result += text.slice(currentSourcePos);
    }

    return {
      text: result,
      transformations,
      protectedSpans,
      matchCount: selectedMatches.length
    };
  }
}

export const dictionaryMatcher = new DictionaryMatcher();
