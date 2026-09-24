# Local Text Processing Engine Specification

## 1. Overview
The Local Text Processing Engine is a pure, deterministic, and isolated pipeline in **Local TTS Studio** that transforms raw script into normalized speech-ready text before audio synthesis in Phase 4.

The engine guarantees:
1. **Original Text Immutability**: `original_text` is NEVER modified during text processing.
2. **Deterministic Output**: Given the same text, settings, and dictionary revision, the output is 100% reproducible.
3. **Traceability**: Every transformation records its stage, original span, replacement text, and rule identifier.

---

## 2. Pipeline Sequence & Normalizers

The processing pipeline executes in the following sequence:

```text
Raw Text Input
      ↓
[Stage 1: Pronunciation Dictionary] → Generates Protected Spans
      ↓
[Stage 2: Whitespace Normalizer]    → Normalizes in-line spaces & line breaks
      ↓
[Stage 3: Date Normalizer]          → Normalizes valid calendar DD/MM/YYYY
      ↓
[Stage 4: Vietnamese Number Engine] → Converts numbers to natural words
      ↓
[Stage 5: Currency Normalizer]      → Expands VNĐ, VND, ₫, đ amounts
      ↓
[Stage 6: Abbreviation Normalizer]  → Expands standard Vietnamese acronyms
      ↓
Final Normalized Output + SHA-256 Fingerprint + Transformation Trace
```

### Stage 1: Pronunciation Dictionary (User Authority)
- Highest priority in the pipeline.
- Matches user-defined terminology, brand names, and phonetic replacements.
- All replacements generate **Protected Spans** `[start, end]`. Subsequent normalizers bypass these ranges completely.

### Stage 2: Whitespace Normalizer
- Converts `\r\n` and `\r` into standard `\n`.
- Collapses consecutive horizontal whitespace (`[ \t]+`) into single spaces.
- Preserves paragraph delimiters (`\n\n`).
- Trims trailing line spaces.

### Stage 3: Date Normalizer
- Regex pattern matching `DD/MM/YYYY` and `DD-MM-YYYY`.
- Validates calendar dates (e.g. `31/02/2026` is rejected as invalid and left intact).
- Supports leap years (`29/02/2024` valid, `29/02/2025` invalid).
- Handles natural Vietnamese phrasing: avoids duplicate `ngày ngày` when preceding context already contains `ngày`.

### Stage 4: Vietnamese Number Normalizer
- Full natural speech synthesis for integers up to hundreds of billions.
- Handles Vietnamese numerical nuances:
  - `15` → `mười lăm`
  - `21` → `hai mươi mốt`
  - `25` → `hai mươi lăm`
  - `55` → `năm mươi lăm`
  - `105` → `một trăm lẻ năm`
  - `115` → `một trăm mười lăm`
  - `1.500` → `một nghìn năm trăm`
  - `2026` → `hai nghìn không trăm hai mươi sáu`
- **Boundary Safety**: Lookbehind and lookahead patterns prevent modifying numbers inside product IDs, URLs, or hyphenated codes (e.g. `TS24`, `ISO-9001`, `12/2026/TT-BTC`).

### Stage 5: Currency Normalizer
- Converts currency symbols and notations (`VNĐ`, `VND`, `₫`, `đ`) into `[words] đồng`.
- Example: `50.000 VNĐ` → `năm mươi nghìn đồng`.

### Stage 6: Abbreviation Normalizer
- Conservative Vietnamese abbreviations:
  - `TP.HCM` / `TPHCM` → `thành phố Hồ Chí Minh`
  - `VN` → `Việt Nam`
  - `USD` → `đô la Mỹ`

---

## 3. Protected Spans Architecture

To prevent interference between normalizers and user dictionary rules:
1. Dictionary replacement records `{ start, end }` for every substituted token.
2. When normalizers (Dates, Numbers, Currencies) search for tokens, any match overlapping an existing protected span is skipped.
3. When a normalizer performs a valid substitution outside protected spans, it recalculates downstream span offsets and adds its own protected span.

---

## 4. Stale Detection & Concurrency

Projects track two critical versioning numbers in `settings.textProcessing`:
- `processedFromRevision`: The `revision` of `original_text` when processed.
- `processedWithDictionaryRevision`: The `pronunciation_dictionary_revision` when processed.

The UI displays a **Needs Refresh** banner whenever:
- Current `project.revision > processedFromRevision` (original text was edited).
- Current `dictionaryRevision > processedWithDictionaryRevision` (a dictionary rule was added, edited, or deleted).
- Any normalization toggle in settings is modified by the user.

---

## 5. Persistence & File Safety

- `processed_text` is stored directly in SQLite without modifying `original_text` or bumping the editing revision.
- `script-processed.txt` is written atomically in the project's folder using temporary files (`.tmp.<timestamp>`) and rename operations, ensuring zero data loss on unexpected system crashes.
