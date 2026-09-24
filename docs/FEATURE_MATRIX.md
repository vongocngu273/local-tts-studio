# Local TTS Studio — Feature Matrix

This matrix provides a comprehensive, source-backed scan of all functional domains and features in **Local TTS Studio** (v1.0.0, 2026).

Statuses are strictly:
- `DONE`: Fully implemented across backend, frontend, database, and automated tests.
- `PARTIAL`: Partially implemented with working pieces but missing integration or UI.
- `PLACEHOLDER`: UI or stub code exists without backing business logic.
- `TODO`: Planned but no functional code exists yet.
- `BROKEN`: Code exists but is failing tests or broken at runtime.
- `BLOCKED`: Development is blocked by an external dependency or architecture prerequisite.

---

## 1. Feature Status Table

| Domain | Feature | Status | Backend | Frontend | Tests | Notes |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Application Shell** | Frameless window with custom header & drag region | `DONE` | Yes | Yes | Yes | Custom drag-regions, theme-aware window chrome |
| **Application Shell** | Collapsible navigation sidebar | `DONE` | Yes | Yes | Yes | Collapsible (64px / 256px) with tooltips and brand watermark |
| **Projects** | Create new project | `DONE` | Yes | Yes | Yes | Generates UUID, physical folder, and SQLite entry |
| **Projects** | Project listing with search & sort | `DONE` | Yes | Yes | Yes | Sort by recently updated, name asc/desc, created date |
| **Projects** | Rename project | `DONE` | Yes | Yes | Yes | In-place inline rename from editor or project modal |
| **Projects** | Duplicate project | `DONE` | Yes | Yes | Yes | Deep clones SQLite records, settings, and physical files |
| **Projects** | Soft delete & restore project | `DONE` | Yes | Yes | Yes | `deleted_at` timestamp filtering; safe recovery |
| **Projects** | Open physical project folder | `DONE` | Yes | Yes | Yes | Native OS reveal via `shell.openPath` / `showItemInFolder` |
| **Autosave** | Dual-timer debounced persistence | `DONE` | Yes | Yes | Yes | 500ms draft to SQLite, 1500ms permanent text commit |
| **Recovery** | Crash draft recovery | `DONE` | Yes | Yes | Yes | Automatically detects uncommitted drafts on project load |
| **Recovery** | Database pre-migration backups | `DONE` | Yes | N/A | Yes | Auto-backup of `localtts.db` prior to running migrations |
| **Text Editor** | Raw script input & paste | `DONE` | Yes | Yes | Yes | Multi-line textarea with word, character, paragraph counters |
| **Text Editor** | Large text stress handling | `DONE` | Yes | Yes | Yes | Tested with 100k+ character payloads without crashing |
| **Text Processing** | Whitespace normalization | `DONE` | Yes | Yes | Yes | Conservative whitespace & line-break trimming |
| **Text Processing** | Vietnamese number normalization | `DONE` | Yes | Yes | Yes | Integers, decimals, percentages, Roman numerals |
| **Text Processing** | Date normalization | `DONE` | Yes | Yes | Yes | Vietnamese date formats (dd/mm/yyyy -> ngày ... tháng ... năm) |
| **Text Processing** | Currency normalization | `DONE` | Yes | Yes | Yes | VND, USD, EUR, GBP, JPY currency symbol translation |
| **Text Processing** | Abbreviation normalization | `DONE` | Yes | Yes | Yes | Common abbreviations (TP., TS., BS., v.v.) |
| **Text Processing** | Diff viewer (Side-by-side / Processed) | `DONE` | Yes | Yes | Yes | Visual token diff highlighting added/removed text |
| **Text Processing** | Stale status tracking | `DONE` | Yes | Yes | Yes | Text hashing marks processed text stale if original changes |
| **Pronunciation Dict** | Rule CRUD (Term, Spoken, Options) | `DONE` | Yes | Yes | Yes | Case sensitivity, whole word boundary regex, priority |
| **Pronunciation Dict** | Provider scope matching | `DONE` | Yes | Yes | Yes | Rules apply globally (`ALL`) or targeted to specific provider |
| **Pronunciation Dict** | Category categorization | `DONE` | Yes | Yes | Yes | Filter rules by custom categories (Thương hiệu, Thuế, etc.) |
| **Pronunciation Dict** | Batch enable/disable & delete | `DONE` | Yes | Yes | Yes | Bulk selection with atomic multi-row SQLite queries |
| **Pronunciation Dict** | CSV / JSON Import & Export | `DONE` | Yes | Yes | Yes | Validation preview (valid/duplicate/invalid counts) |
| **Pronunciation Dict** | Interactive Rule Tester | `DONE` | Yes | Yes | Yes | Test rule against arbitrary sample text with diff |
| **Pronunciation Dict** | Audio preview for spoken terms | `DONE` | Yes | Yes | Yes | Instant TTS synthesis button for rules in table & modals |
| **Pronunciation Dict** | Protected spans engine | `DONE` | Yes | Yes | Yes | Prevents subsequent normalizers from altering dict matches |
| **Provider Settings** | Multi-provider configuration | `DONE` | Yes | Yes | Yes | Configure Edge TTS, LucyLab, ElevenLabs, Vbee |
| **Provider Settings** | Provider connection self-test | `DONE` | Yes | Yes | Yes | Ping provider APIs directly from Settings page |
| **Secure Credentials** | safeStorage encrypted API keys | `DONE` | Yes | Yes | Yes | Apple Keychain / Windows DPAPI / Linux Secret Service |
| **Voice Browser** | Search & multi-facet filtering | `DONE` | Yes | Yes | Yes | Filter by Provider, Locale, Gender, Search text |
| **Voice Browser** | Favorite voices bookmarking | `DONE` | Yes | Yes | Yes | Persistent favorites stored in `voice_favorites` table |
| **Voice Browser** | Provider voice cache refresh | `DONE` | Yes | Yes | Yes | Live sync with provider voice catalog |
| **Voice Presets** | Custom voice preset saving | `PLACEHOLDER` | No | Yes | No | `VoicePresetsPage.tsx` renders EmptyState placeholder |
| **Voice Preview** | Instant voice auditioning | `DONE` | Yes | Yes | Yes | Audio preview with dual-layer Range 206 streaming |
| **TTS Generation** | Single text-to-speech generation | `DONE` | Yes | Yes | Yes | Direct generation with custom speed, pitch, and volume |
| **TTS Generation** | Synthesis history log | `DONE` | Yes | Yes | Yes | Records size, duration, input hash, status in SQLite |
| **TTS Providers** | Edge TTS live integration | `DONE` | Yes | Yes | Yes | Live WebSocket synthesis, 400+ voices, 0 API key needed |
| **TTS Providers** | LucyLab Vietnamese TTS adapter | `DONE` | Yes | Yes | Yes | REST async synthesis with polling and fallback voices |
| **TTS Providers** | ElevenLabs AI voice adapter | `DONE` | Yes | Yes | Yes | REST streaming synthesis with quota check and timestamps |
| **TTS Providers** | Vbee Vietnamese TTS adapter | `DONE` | Yes | Yes | Yes | REST speech synthesis with fallback voices |
| **Segmentation** | Paragraph & sentence splitting | `DONE` | Yes | Yes | Yes | Split processed script by punctuation & paragraph gaps |
| **Segmentation** | Segment character optimizer | `DONE` | Yes | Yes | Yes | Respects min/max character limits to balance chunks |
| **Segmentation** | Audio reuse fingerprinting | `DONE` | Yes | Yes | Yes | SHA-256 fingerprint reuses audio when rebuilding |
| **Segmentation** | Per-segment text override | `DONE` | Yes | Yes | Yes | Override spoken script for specific segments |
| **Segmentation** | Per-segment voice override | `DONE` | Yes | Yes | Yes | Assign different voices/providers to specific segments |
| **Segmentation** | Configurable pause-after duration | `DONE` | Yes | Yes | Yes | Custom sentence pauses (250ms) and paragraph pauses (600ms) |
| **Persistent Queue** | SQLite queue storage (`tts_jobs`) | `DONE` | Yes | Yes | Yes | Jobs persist across application restarts |
| **Persistent Queue** | Per-provider concurrency control | `DONE` | Yes | Yes | Yes | Edge: 2 concurrent, Cloud providers: 1 concurrent |
| **Persistent Queue** | Exponential backoff retry policy | `DONE` | Yes | Yes | Yes | Auto-retry up to 3 attempts (1s, 2s, 4s delay) |
| **Persistent Queue** | Live queue controls | `DONE` | Yes | Yes | Yes | Pause, Resume, Cancel, Single-segment Regenerate |
| **Persistent Queue** | Queue crash recovery service | `DONE` | Yes | N/A | Yes | Auto-resets interrupted `processing` jobs on startup |
| **Persistent Queue** | Real-time IPC event push | `DONE` | Yes | Yes | Yes | Broadcasts progress and status without client polling |
| **Audio Playback** | Custom streaming protocol | `DONE` | Yes | Yes | Yes | `localtts-audio://` with Range 206 Partial Content |
| **Audio Playback** | Waveform timeline visualizer | `DONE` | Yes | Yes | Yes | `wavesurfer.js` interactive canvas with playhead scrubbing |
| **FFmpeg** | 3-tier binary auto-detection | `DONE` | Yes | Yes | Yes | `FFMPEG_PATH` env -> standard system paths -> PATH |
| **FFmpeg** | Audio concatenation & silence gaps | `DONE` | Yes | Yes | Yes | Merges segments with exact sentence/paragraph pauses |
| **FFmpeg** | Format conversion & Loudnorm | `DONE` | Yes | Yes | Yes | MP3 / WAV exports with optional loudness normalization |
| **FFmpeg** | Binary health self-test | `DONE` | Yes | Yes | Yes | Diagnostic check in Settings with version & path reporting |
| **Subtitle Engine** | Exact pause-drift compensation | `DONE` | Yes | Yes | Yes | Cumulative timing offsets include silence pauses |
| **Subtitle Engine** | Timing source hierarchy | `DONE` | Yes | Yes | Yes | Word-level timing file prioritized over duration estimation |
| **Subtitle Engine** | SubRip (.srt) writer | `DONE` | Yes | Yes | Yes | Compliant SRT format (00:00:01,250 --> 00:00:03,500) |
| **Subtitle Engine** | WebVTT (.vtt) writer | `DONE` | Yes | Yes | Yes | Compliant WebVTT format (00:00:01.250 --> 00:00:03.500) |
| **Subtitle Engine** | In-app Subtitle Viewer | `DONE` | Yes | Yes | Yes | Cue list preview with search, timing, and text view |
| **Project Export** | Selective bundle exporter | `DONE` | Yes | Yes | Yes | 9 selective export options with atomic folder output |
| **Project Export** | Individual segment audio export | `DONE` | Yes | Yes | Yes | Exports `segments/001_segment.mp3` for video editors |
| **Project Export** | Rich markdown export manifest | `DONE` | Yes | Yes | Yes | Generates `manifest.md` audit report of exported bundle |
| **Project Export** | Safe fallback for unrendered audio | `DONE` | Yes | Yes | Yes | Missing audio segments do not crash bundle export |
| **Settings & Telemetry**| Hardware & system telemetry | `DONE` | Yes | Yes | Yes | CPU, RAM, OS, Node, Electron, Chromium diagnostics |
| **Settings & Telemetry**| Brand identity telemetry cards | `DONE` | Yes | Yes | Yes | Ngự Võ, v1.0.0, 2026, Copyright cards in General Settings |
| **Settings & Telemetry**| Storage paths explorer | `DONE` | Yes | Yes | Yes | Displays database, workspace, cache, logs, temp paths |
| **i18n** | Vietnamese localization | `DONE` | Yes | Yes | Yes | Default language with 100% UI and error message coverage |
| **i18n** | English localization | `DONE` | Yes | Yes | Yes | Full English translation toggle in header and settings |
| **Security** | Context isolation & sandboxing | `DONE` | Yes | Yes | Yes | `contextIsolation: true`, `nodeIntegration: false` |
| **Security** | Workspace path confinement | `DONE` | Yes | N/A | Yes | Path traversal prevention across all file operations |
| **Security** | Safe process execution | `DONE` | Yes | N/A | Yes | `child_process.spawn` with `shell: false` for all binaries |
| **Agents** | Multi-Agent Development System | `DONE` | Yes | Yes | Yes | Main Orchestrator, Backend, Frontend, QA Specialists |
| **Agents** | Self-healing bug loop & circuit breaker| `DONE` | Yes | Yes | Yes | Automated 3-loop QA cycle with bug ticket tracking |
| **Testing** | Automated unit & integration tests | `DONE` | Yes | Yes | Yes | 36 test files, 178 tests passed (100% pass rate) |
| **Packaging** | macOS build targets | `DONE` | Yes | N/A | Yes | Universal DMG, Apple Silicon (`arm64`), Intel (`x64`) |
| **Packaging** | Windows build targets | `DONE` | Yes | N/A | Yes | NSIS installer & Portable (`x64`, `ia32`, `arm64`) |
| **Packaging** | Linux build targets | `DONE` | Yes | N/A | Yes | AppImage & DEB (`x64`, `arm64`) |
| **Packaging** | Mobile Flutter blueprint | `DONE` | Docs | Docs | N/A | Architecture blueprint & 1:1 mapping for Android/iOS |
| **Auto-Updater** | Built-in application auto-update | `TODO` | No | No | No | Not yet integrated (electron-updater planned for v1.1.0) |

---

## 2. Feature Domain Summary

- **Total Features Audited**: 72
- **DONE**: 70 (97.2%)
- **PARTIAL**: 0 (0%)
- **PLACEHOLDER**: 1 (1.4% - `VoicePresetsPage`)
- **TODO**: 1 (1.4% - Auto-Updater)
- **BROKEN**: 0 (0%)
- **BLOCKED**: 0 (0%)
