# Pronunciation Dictionary Architecture & Specification

## 1. Overview
The Pronunciation Dictionary in **Local TTS Studio** empowers users to define custom phonetic substitutions, brand pronunciations, acronym expansions, and dialect overrides. It serves as the highest-authority stage in the Text Processing Pipeline.

---

## 2. SQLite Database Schema & Indexes

All pronunciation rules are persisted locally in SQLite (`pronunciation_dictionary` table) in WAL mode via Migration 002.

```sql
CREATE TABLE IF NOT EXISTS pronunciation_dictionary (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL,
  spoken_text TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  case_sensitive INTEGER NOT NULL DEFAULT 0,
  whole_word INTEGER NOT NULL DEFAULT 1,
  provider_scope TEXT NOT NULL DEFAULT 'ALL',
  category TEXT,
  priority INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_pronunciation_term ON pronunciation_dictionary(term);
CREATE INDEX idx_pronunciation_enabled ON pronunciation_dictionary(enabled);
CREATE INDEX idx_pronunciation_provider ON pronunciation_dictionary(provider_scope);
CREATE INDEX idx_pronunciation_category ON pronunciation_dictionary(category);
CREATE INDEX idx_pronunciation_updated ON pronunciation_dictionary(updated_at);
```

### Metadata Versioning
An incremental counter `pronunciation_dictionary_revision` is maintained in `app_metadata`. Every mutation (`create`, `update`, `delete`, `bulkInsert`) increments this revision by 1. Projects record the dictionary revision they were processed with to detect stale states.

---

## 3. Matching Semantics & Precedence Resolution

When text is processed, applicable rules are matched and applied deterministically following strict rules:

### A. Precedence Sorting Order
1. **Priority**: Higher numerical `priority` executes before lower priority.
2. **Longest Match**: If two rules match at overlapping positions, the longer term takes precedence (e.g. `TS24` takes precedence over `TS`).
3. **Provider Context Specificity**: A rule targeted for a specific provider (e.g. `EDGE`) overrides a generic `ALL` rule for the same term.
4. **Recency / Tie-breaker**: `updated_at DESC`.

### B. Unicode-Aware Word Boundary
Standard ASCII `\b` fails on Vietnamese diacritics (e.g., treating accented letters like `ế`, `ộ`, `à` as word boundaries). The engine uses Unicode Property Escapes:
```regex
(?<![\p{L}\p{N}_])term(?![\p{L}\p{N}_])
```
This ensures terms like `bảo hiểm` or `thuế` are only replaced when surrounded by spaces or punctuation, without corrupting compound words.

### C. Non-Cascading Replacement (Single-Pass Guarantee)
Replacements are executed in a strictly **single pass**:
- If Rule 1 replaces `A` with `B`, and Rule 2 replaces `B` with `C`:
- Input string `"A"` becomes `"B"`. It **never** cascades into `"C"`.
- This eliminates infinite recursion loops, unexpected dialect compounding, and non-deterministic text corruption.

### D. Protected Spans Generation
Whenever a dictionary term is substituted, the exact index range `[start, end]` of the replacement in the transformed string is recorded as a **Protected Span**. Downstream normalizers (numbers, dates, currencies) cannot inspect or mutate characters inside protected spans.

---

## 4. Import & Export Formats

### A. JSON Format
Exported JSON includes schema metadata and an array of rule definitions:
```json
{
  "format": "local-tts-pronunciation-dictionary",
  "version": 1,
  "exportedAt": "2026-09-22T14:00:00.000Z",
  "rules": [
    {
      "term": "TS24",
      "spokenText": "ti ét hai bốn",
      "enabled": true,
      "caseSensitive": false,
      "wholeWord": true,
      "providerScope": "ALL",
      "category": "Tax Software",
      "priority": 0,
      "note": "Software brand name"
    }
  ]
}
```

### B. CSV Format
CSV exports are generated with a UTF-8 BOM (`\uFEFF`) to guarantee seamless opening in Microsoft Excel and spreadsheet tools without accented character corruption. Double quotes and commas in spoken text are RFC 4180 escaped.

```csv
term,spoken_text,enabled,case_sensitive,whole_word,provider_scope,category,priority,note
TS24,"ti ét hai bốn",1,0,1,ALL,"Tax Software",0,"Software brand name"
```

### C. Conflict Resolution Policies
When importing from JSON or CSV:
- `skip`: Preserves existing rules in the local database and inserts only new rules.
- `replace`: Overwrites existing rules with incoming definitions while preserving non-conflicting records.
