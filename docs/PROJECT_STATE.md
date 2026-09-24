# Local TTS Studio — Project State

## 1. Metadata

```text
Last Updated: 2026-09-24T13:30:00+07:00
Git Branch: main
Git Commit: 17b6bb9
Application Version: 1.0.0
Documentation Version: 1.0.0
Author / Brand: Ngự Võ
Release Year: 2026
App Identifier: com.localtts.studio
```

---

## 2. Current Development Status

- **Current Stage**: Production Voice Project Engine & Multi-Platform Desktop Architecture
- **Milestones Completed**:
  - Phase 1: Electron Desktop Foundation, SQLite Database, Filesystem Storage, IPC Layer, System Info & Diagnostics.
  - Phase 2: Project Management, Autosave, Draft Recovery, Script Editor, Physical Project Storage.
  - Phase 3: Text Processing Pipeline (7-stage deterministic normalizers) & Authoritative Pronunciation Dictionary.
  - Phase 4: Multi-Provider TTS Integration (Edge TTS, LucyLab, ElevenLabs, Vbee), Voice Library, safeStorage Secrets, Voice Preview Playback.
  - Phase 5: Segment Engine, Persistent SQLite TTS Queue, FFmpeg Audio Composition, Waveform Timeline, Subtitle Engine (SRT/VTT), Project Export Bundle.
  - Hardening: Dual-layer Audio Preview Playback Fix (Range 206 HTTP streaming), Dictionary Rule Audio Preview comparison, Brand Ownership stamping, Multi-Platform packaging configurations.
- **Overall Status**: **STABLE & PRODUCTION-READY**
- **Quality Gates Status**: **100% PASS** (0 Typecheck errors, 0 ESLint warnings/errors, 36/36 test suites passed, 178/178 tests green, production build compiles in ~1s).

---

## 3. Technology Stack

Source of truth: [`package.json`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/package.json) and config files.

| Layer / Technology | Package & Version | Role in Architecture |
| :--- | :--- | :--- |
| **Desktop Runtime** | `electron` ^33.2.1 | Host environment, window lifecycle, OS integration, safeStorage, protocol schemes |
| **UI Framework** | `react` ^18.3.1, `react-dom` ^18.3.1 | Component-based renderer UI |
| **Language** | `typescript` ^5.7.2 | Strict end-to-end type safety across Main, Preload, Renderer, Shared |
| **Bundler & Tooling** | `vite` ^5.4.11, `electron-vite` ^2.3.0 | Fast HMR dev server and multi-target production bundler |
| **Database** | `better-sqlite3` ^11.10.0 | High-performance synchronous SQLite engine with WAL mode |
| **Native Rebuilder** | `@electron/rebuild` ^3.7.2 | Compiles native C++ addons (`better-sqlite3`) against Electron ABI |
| **Packaging & Distribution**| `electron-builder` ^25.1.8 | Multi-platform desktop installer/bundle packager (macOS, Windows, Linux) |
| **State Management** | `zustand` ^5.0.2 | Reactive, decoupled state stores in Renderer |
| **Schema Validation** | `zod` ^3.24.1 | Runtime payload contracts for IPC channels and domain entities |
| **Audio Visualization** | `wavesurfer.js` ^7.12.12 | Canvas-based waveform renderer and interactive timeline |
| **WebSocket** | `ws` ^8.21.3 | Low-latency binary communication for Edge TTS live synthesis |
| **Styling** | `tailwindcss` ^3.4.16, `postcss` ^8.4.49, `autoprefixer` ^10.4.20 | Utility-first responsive CSS styling with dark/light themes |
| **CSS Utilities** | `clsx` ^2.1.1, `tailwind-merge` ^2.5.5 | Conditional class merging |
| **Icons** | `lucide-react` ^0.468.0 | Vector iconography across all UI pages and components |
| **IDs** | `uuid` ^11.1.1 | RFC 4122 v4 UUID generation for projects, segments, jobs, rules |
| **Audio Processing** | System `ffmpeg` & `ffprobe` (via `child_process.spawn`) | Audio concatenation, silence generation, format conversion, loudnorm |
| **Testing** | `vitest` ^2.1.8 | Fast unit, integration, and QA automated test runner |
| **Linting** | `eslint` ^8.57.1 | Strict code style and static error detection |

---

## 4. Application Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        REACT RENDERER PROCESS                          │
│  8 Pages (Dashboard, TTS Studio, Projects, History, Voices, Presets,  │
│           Dictionary, Settings)                                        │
│  9 Zustand Stores (app, projectEditor, textProcessing, dictionary,    │
│                    provider, voice, generation, segment, composition) │
│  UI Components (WaveformTimeline, SubtitleViewer, ExportPanel, etc.)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         Preload ContextBridge
                        (window.localTTS API)
                                    │
                               Typed IPC
                       (64 Channels, Zod Schema)
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                         ELECTRON MAIN PROCESS                          │
│                                                                        │
│  IPC Handlers: 13 handler modules registered in registerIpcHandlers   │
│                                                                        │
│  Core Services:                                                        │
│  ├── ProjectService & ProjectFilesystemService                         │
│  ├── TextProcessingService (7 Normalizers + Protected Spans Matcher)   │
│  ├── PronunciationDictionaryService                                    │
│  ├── ProviderRegistry (Edge TTS, LucyLab, ElevenLabs, Vbee)            │
│  ├── TTSGenerationService & VoiceManagerService                        │
│  ├── SegmentEngine (Paragraph/Sentence splitters, Stale validation)   │
│  ├── JobQueueService (Persistent SQLite queue, concurrency, retry)     │
│  ├── FFmpegService & FFprobeService & FFmpegBinaryService              │
│  ├── AudioCompositionService & AudioStorageService                     │
│  ├── SubtitleTimingService, SrtWriter, VttWriter                       │
│  ├── ExportService (MP3, WAV, SRT, VTT, segments/, manifest.md)        │
│  ├── SecretStorageService (Electron safeStorage API)                   │
│  ├── Custom Audio Protocol (localtts-audio:// with Range 206)          │
│  └── SystemInfoService & Logger                                        │
│                                                                        │
│  Repositories (12 Repositories):                                       │
│  project, projectDraft, pronunciationDictionary, providerSettings,    │
│  providerSecrets, voiceCache, generation, voiceFavorites, segment,     │
│  job, composition, subtitle, appMetadata                               │
└──────────────────────────────┬──────────────────┬──────────────────────┘
                               │                  │
                    better-sqlite3 WAL    Direct Filesystem
                               │                  │
                ┌──────────────▼─────┐      ┌─────▼──────────────────────┐
                │ SQLite Database    │      │ User Workspace             │
                │ 14 Tables          │      │ - projects/{id}/           │
                │ Schema Version 4   │      │ - audio/, subtitles/,      │
                │ Automatic Backups  │      │   exports/, temp/          │
                └────────────────────┘      └────────────────────────────┘
```

---

## 5. Current User Workflow

The application supports an end-to-end production voice workflow:

```text
1. Dashboard / Projects
   ├── Create new project or open recent project
   └── Automatic crash recovery check (restores dirty unsaved text from SQLite draft)
          ↓
2. Script Editing (TextToSpeechPage - "Kịch bản" tab)
   ├── Input or paste original script
   ├── Word count, character count, paragraph telemetry
   └── Automatic debounced draft autosave (500ms draft, 1500ms permanent revision)
          ↓
3. Text Processing & Normalization
   ├── Configure toggles (Whitespace, Numbers, Dates, Currency, Abbreviations)
   ├── Automatic Pronunciation Dictionary substitution with Protected Spans
   ├── Side-by-side or processed-only Diff Viewer
   └── Commit processed script to project
          ↓
4. Pronunciation Dictionary Management (PronunciationDictionaryPage)
   ├── Create/edit phonetic rules with category, priority, whole-word, case-sensitive
   ├── Instant audio preview of spoken terms ("Nghe thử" with selected voice)
   ├── Test rules against arbitrary sample text with side-by-side audio comparison
   └── Import / Export CSV & JSON dictionaries
          ↓
5. Segment Engine (TextToSpeechPage - "Phân đoạn" tab)
   ├── Build segments from processed script (Sentence/Paragraph boundaries)
   ├── Fingerprint generation (SHA-256) for instant audio reuse on rebuilds
   ├── Custom per-segment text override & per-segment voice override
   └── Configurable pause-after duration (sentence pause vs paragraph pause)
          ↓
6. Persistent Local Queue Generation
   ├── Start queue synthesis (all segments or selected subset)
   ├── Per-provider concurrency management (Edge: 2, Cloud: 1)
   ├── Exponential backoff auto-retry (up to 3 attempts)
   ├── Live queue controls: Pause, Resume, Cancel, Single-segment Regenerate
   └── Real-time queue event push over IPC (`queue:event`)
          ↓
7. Audio Composition & Waveform (TextToSpeechPage - "Âm thanh" tab)
   ├── Merge segment audio files using FFmpeg with exact silence gaps
   ├── Interactive Wavesurfer.js timeline visualizer
   └── Seamless playback of merged track or individual segments
          ↓
8. Subtitle Engine (TextToSpeechPage - "Phụ đề" tab)
   ├── Subtitle cues generated with exact millisecond pause offsets
   ├── Word-level timing priority with proportional character fallback
   └── Real-time subtitle cue table preview
          ↓
9. Project Export (TextToSpeechPage - "Xuất bản" tab)
   ├── Select custom target export folder
   ├── 9 selective export artifacts:
   │   ├── Merged MP3 audio
   │   ├── Merged WAV audio (uncompressed)
   │   ├── SubRip Subtitle (.srt)
   │   ├── WebVTT Subtitle (.vtt)
   │   ├── Original script (.txt)
   │   ├── Processed script (.txt)
   │   ├── Project metadata (.json)
   │   ├── Individual segments audio (segments/001_segment.mp3...)
   │   └── Project manifest report (manifest.md)
   └── Atomic export with total size and file list telemetry
```

---

## 6. Implemented Features by Domain

### Project Management
- **Project Creation**: Generates unique UUID, physical folder, and SQLite entry.
- **Project Renaming**: In-place inline rename from editor or projects list.
- **Project Duplication**: Deep clones project record, settings, text, and physical folder.
- **Soft Deletion & Restore**: `deleted_at` timestamp filtering; safe recovery.
- **Autosave Engine**: Dual-timer debounced persistence (500ms draft in `project_drafts`, 1500ms full commit).
- **Crash Recovery**: Auto-detects uncommitted drafts on project open with recovery/discard prompt.
- **Physical Workspace Opening**: Native OS reveal via Electron `shell.showItemInFolder` / `shell.openPath`.

### Text Processing
- **Deterministic 7-Stage Pipeline**: Whitespace -> Pronunciation Dictionary -> Dates -> Currencies -> Numbers -> Abbreviations -> Cleanup.
- **Protected Spans Engine**: Spans replaced by the pronunciation dictionary are protected from subsequent numeric/date transformations.
- **Diff Viewer**: Visual side-by-side or processed-only comparison with added/removed highlight tags.
- **Processing Fingerprint**: SHA-256 content hashing to determine staleness when original script changes.

### Pronunciation Dictionary
- **Rule Management**: Term, Spoken text, Case sensitivity, Whole word regex boundaries, Provider scope (`ALL`, `edge-tts`, `lucylab`, `elevenlabs`, `vbee`), Category, Priority, Notes.
- **Audio Preview Integration**: Direct audio synthesis for spoken pronunciation terms in Rule Editor, Rule Tester, and Dictionary Table.
- **Batch Operations**: Bulk enable/disable, bulk deletion.
- **Import / Export**: JSON and CSV parser with validation preview (valid, duplicate, invalid counts) and merge/replace modes.
- **Revision Counter**: Atomic `app_metadata` revision bump invalidates processed text cache.

### TTS Providers & Voices
- **Multi-Provider Registry**: Extensible `ITTSProvider` interface and centralized registry.
- **Edge TTS**: Zero-config, live WebSocket client (`edgeTtsClient.ts`), 400+ voices, direct synthesis.
- **LucyLab**: REST adapter for Vietnamese neural speech API with asynchronous job polling and fallback voices.
- **ElevenLabs**: REST adapter with API quota inspection, timestamp extraction, and fallback voices.
- **Vbee**: REST adapter for Vietnamese conversational speech platform with fallback voices.
- **Voice Browser**: Filter by Provider, Locale, Gender, Search text, and Favorites.
- **Voice Cache**: SQLite-backed voice metadata cache with manual provider refresh.
- **Voice Preview**: Streaming synthesis with custom protocol audio player.

### Segmentation Engine
- **Boundary Splitting**: Paragraph-level and Sentence-level rule-based splitting with Vietnamese punctuation heuristics (`.`, `!`, `?`, `...`, `\n`).
- **Segment Optimizer**: Configurable min/max character thresholds to prevent awkward sentence fragments.
- **Audio Reuse**: SHA-256 fingerprinting hashes segment text, voice, provider, and settings. Rebuilding segments preserves existing generated audio if content is unchanged.
- **Per-Segment Customization**: Text override, voice override, custom pause duration.

### Job Queue
- **Persistent SQLite Storage**: Queue items stored in `tts_jobs` table; survives application restart.
- **Worker Concurrency**: Per-provider rate limiting (Edge: 2 concurrent requests, Cloud: 1).
- **Retry Policy**: Exponential backoff (1s, 2s, 4s) up to 3 attempts.
- **Queue Controls**: Start, Pause, Resume, Cancel, Single-segment Regenerate.
- **Queue Recovery Service**: Auto-detects interrupted jobs on startup and resets orphaned `processing` records.
- **IPC Event Streaming**: Reactive queue event broadcasts to the renderer without client polling.

### Audio & Visualization
- **Custom Audio Protocol**: `localtts-audio://` registered with `bypassCSP`, handling HTTP 206 Partial Content range requests and proper MIME types (`audio/mpeg`, `audio/wav`).
- **Waveform Timeline**: `wavesurfer.js` interactive canvas with playhead scrubbing, zoom controls, and time indicators.
- **Global Audio Coordinator**: Prevents conflicting concurrent audio streams when previewing voices or dictionary rules.

### FFmpeg Audio Pipeline
- **Auto Binary Discovery**: 3-tier lookup (`FFMPEG_PATH` env -> standard system paths -> PATH).
- **Audio Merging**: Direct `child_process.spawn` execution (no shell security risks).
- **Silence Insertion**: Accurate silence gap generation between sentences (250ms) and paragraphs (600ms).
- **Offset Calculation**: Generates millisecond offsets for waveform regions and subtitle cues.
- **Audio Normalization**: Optional FFmpeg `loudnorm` filter integration.

### Subtitle Engine
- **Timing Sources**: Word/character timing files (`timingPath`) prioritized over duration-based character distribution.
- **Pause Drift Compensation**: Sentence and paragraph pauses are included in cue offset calculations to ensure subtitles never drift from merged audio.
- **Exporters**: SubRip (`.srt`) and WebVTT (`.vtt`) compliant format writers.

### Project Export
- **Export Bundle**: Exports into user-selected directory with selective options:
  - `includeMp3` & `includeWav`
  - `includeSrt` & `includeVtt`
  - `includeScriptOriginal` & `includeScriptProcessed`
  - `includeProjectJson` (Full project backup)
  - `includeIndividualSegments` (Creates `segments/` folder with individual MP3s)
  - `includeMarkdownManifest` (Creates comprehensive `manifest.md` audit report)
- **Safe Fallbacks**: Missing or unrendered audio segments do not crash the export bundle.

### Settings & System Diagnostics
- **General Tab**: Brand telemetry cards (Author: Ngự Võ, Version: v1.0.0, Year: 2026, Copyright).
- **Storage Tab**: Paths to database, workspace, cache, logs, and temp directory with native "Open Folder" action.
- **Providers Tab**: Manage credentials, default voices, and test connection buttons.
- **Appearance Tab**: Light, Dark, System theme switcher; Vietnamese and English localization.
- **System Tab**: CPU, RAM, OS, Node, Electron, Chromium telemetry, and FFmpeg binary status check.

### Security
- **Context Isolation**: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` (required for safeStorage and protocol registration).
- **Secret Encryption**: API keys encrypted via Electron native `safeStorage` (Keychain on macOS, DPAPI on Windows, Secret Service on Linux).
- **Path Confinement**: `isPathWithinWorkspace` guards prevent directory traversal attacks.
- **Safe Execution**: All external binaries (FFmpeg/FFprobe) spawned with array arguments and `shell: false`.

---

## 7. Provider Status

| Provider | Implementation | Voice Discovery | Preview | Generation | Timing Sync | Live Status | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Edge TTS** | Complete | Live API | Live Audio | Live Audio | Exact / Word | **PASS (LIVE)** | Free, zero API key required, 400+ voices |
| **LucyLab** | Complete | REST API | REST / Fallback | Async Job / REST | Srt Sync | **PASS (CONFIG)** | Requires API key; fallback voices offline |
| **ElevenLabs** | Complete | REST API | REST / Fallback | REST Stream | Timestamp API | **PASS (CONFIG)** | Requires API key; quota inspection active |
| **Vbee** | Complete | REST API | REST / Fallback | REST Audio | Estimated | **PASS (CONFIG)** | Requires API token; fallback voices offline |

---

## 8. Database Architecture & Schema

### Current State
- **Schema Version**: `4`
- **Latest Migration**: `004_segment_queue_audio_pipeline`
- **Migration Runner**: [`src/main/database/migrations/migrationRunner.ts`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/src/main/database/migrations/migrationRunner.ts)
- **Pre-Migration Safety**: Automatic timestamped database file backup before applying pending migrations.

### Table Inventory (14 Tables)

| Table Name | Primary Key | Foreign Keys | Purpose |
| :--- | :--- | :--- | :--- |
| `schema_migrations` | `id` (AUTOINCREMENT) | None | Migration audit log with applied timestamps |
| `projects` | `id` (UUID) | None | Project metadata, original/processed text, voice/settings JSON |
| `project_drafts` | `project_id` | `projects(id)` ON DELETE CASCADE | Uncommitted editor drafts for crash recovery |
| `app_metadata` | `key` | None | Key-value store for app state, dictionary revision counters |
| `pronunciation_dictionary` | `id` (UUID) | None | Phonetic replacement rules, regex flags, categories, priorities |
| `provider_settings` | `provider_id` | None | Enabled flag, default voice, default model, custom config JSON |
| `provider_secrets` | `(provider_id, secret_name)`| None | safeStorage encrypted API credentials |
| `tts_voice_cache` | `(provider_id, voice_id)` | None | Cached voice definitions with locale, gender, metadata |
| `voice_favorites` | `(provider_id, voice_id)` | None | User bookmarked favorite voices |
| `tts_generations` | `id` (UUID) | `projects(id)` ON DELETE SET NULL | Synthesis history records, paths, hashes, duration, errors |
| `project_segments` | `id` (UUID) | `projects(id)` ON DELETE CASCADE | Individual script segments, text hashes, audio paths, offsets |
| `tts_jobs` | `id` (UUID) | `projects(id)` ON DELETE CASCADE,<br>`segments(id)` ON DELETE SET NULL | Persistent synthesis queue tasks, attempts, payloads, status |
| `audio_compositions` | `id` (UUID) | `projects(id)` ON DELETE CASCADE | Merged project audio compositions, fingerprints, file paths |
| `subtitle_exports` | `id` (UUID) | `projects(id)` ON DELETE CASCADE,<br>`compositions(id)` ON DELETE SET NULL | Generated SRT/VTT subtitle records, cue counts, paths |

### Key Database Indexes
- `idx_projects_updated_at`, `idx_projects_deleted_at`, `idx_projects_name`
- `idx_pronunciation_term`, `idx_pronunciation_enabled`, `idx_pronunciation_category`
- `idx_voice_provider`, `idx_voice_locale`, `idx_voice_gender`
- `idx_generation_project`, `idx_generation_status`, `idx_generation_hash`
- `idx_segments_project_index` (UNIQUE), `idx_segments_project_status`, `idx_segments_hash`
- `idx_jobs_queue_pickup` (`status, priority DESC, available_at ASC, created_at ASC`)
- `idx_compositions_project`, `idx_compositions_fingerprint`
- `idx_subtitles_project`

---

## 9. Filesystem Layout

```text
userData/
├── localtts.db                      # Primary SQLite database
├── localtts.db-wal                  # SQLite Write-Ahead Log
├── localtts.db-shm                  # SQLite Shared Memory
├── backups/                         # Pre-migration database safety backups
│   └── localtts_backup_vX_*.db
├── cache/
│   ├── voices/                      # Voice cache JSON snapshots
│   └── previews/                    # Voice & dictionary preview audio MP3s
├── logs/
│   └── app.log                      # Application runtime rotating log file
└── projects/
    └── {PROJECT_UUID}/              # Dedicated physical project folder
        ├── project.json             # Canonical project descriptor snapshot
        ├── script-original.txt      # Plaintext raw original script
        ├── script-processed.txt     # Normalized/processed script
        ├── audio/
        │   ├── segments/            # Individual segment audio files
        │   │   ├── {segmentId}.mp3
        │   │   └── {segmentId}.json # Timing data
        │   ├── full-composition.mp3 # Merged project audio (MP3)
        │   └── full-composition.wav # Merged project audio (WAV)
        ├── subtitles/
        │   ├── subtitles.srt        # SubRip subtitle
        │   └── subtitles.vtt        # WebVTT subtitle
        ├── exports/                 # User-generated export bundles
        └── temp/                    # Intermediate FFmpeg concat lists & chunks
```

---

## 10. IPC Surface

The IPC interface between Renderer and Main process is strongly typed and guarded:

| Group | Methods / Channels | Direction | Purpose |
| :--- | :--- | :--- | :--- |
| **App** | `app:get-info`, `app:get-paths`, `app:open-workspace` | Renderer -> Main | Retrieve app metadata, paths, open user directory |
| **System** | `system:get-info`, `system:get-ffmpeg-status` | Renderer -> Main | Hardware telemetry and FFmpeg binary health check |
| **Projects** | `project:create`, `project:get`, `project:list`, `project:update`, `project:rename`, `project:duplicate`, `project:delete`, `project:restore`, `project:save-text`, `project:save-draft`, `project:open-folder`, `project:check-recovery`, `project:recover-draft`, `project:discard-draft` | Renderer -> Main | Full project CRUD, debounced text saving, crash draft recovery |
| **Dictionary**| `dictionary:create`, `dictionary:get`, `dictionary:list`, `dictionary:update`, `dictionary:delete`, `dictionary:delete-many`, `dictionary:set-enabled`, `dictionary:set-enabled-many`, `dictionary:get-categories`, `dictionary:get-revision`, `dictionary:test-rule`, `dictionary:select-import-file`, `dictionary:import-preview`, `dictionary:import-execute`, `dictionary:export-file` | Renderer -> Main | Pronunciation rules CRUD, batch actions, rule testing, CSV/JSON import/export |
| **Text** | `text:process-preview`, `text:process-project` | Renderer -> Main | Text normalization preview and persistent commit |
| **Providers** | `provider:get-all`, `provider:update-settings`, `provider:set-secret`, `provider:delete-secret`, `provider:test-connection` | Renderer -> Main | Provider registry, safeStorage credentials, connection check |
| **Voices** | `voice:list`, `voice:refresh`, `voice:toggle-favorite`, `voice:get-favorites` | Renderer -> Main | Voice filtering, provider sync, bookmarking |
| **TTS** | `tts:preview-voice`, `tts:generate-project-audio`, `tts:get-generation`, `tts:list-generations`, `tts:delete-generation`, `tts:open-audio-folder` | Renderer -> Main | Single audio generation, voice preview, history records |
| **Segments** | `segment:build`, `segment:list`, `segment:get`, `segment:update-override`, `segment:reset-override`, `segment:update-voice` | Renderer -> Main | Sentence splitting, fingerprint check, per-segment text/voice overrides |
| **Queue** | `queue:start`, `queue:pause`, `queue:resume`, `queue:cancel`, `queue:get-status`, `queue:regenerate-segment`, `queue:event` | Bidirectional | Persistent queue execution, controls, real-time push events |
| **Compositions**| `composition:compose`, `composition:get-latest` | Renderer -> Main | FFmpeg audio concatenation, pause insertion, composition records |
| **Subtitles** | `subtitle:build-cues`, `subtitle:export` | Renderer -> Main | Continuous subtitle cue calculation, SRT/VTT generation |
| **Export** | `project:export-bundle`, `project:select-export-dir` | Renderer -> Main | Native directory picker, atomic bundle exporter |
| **FFmpeg** | `ffmpeg:get-status` | Renderer -> Main | FFmpeg and FFprobe binary availability diagnostics |

---

## 11. UI Screens & Components

| Screen Route | Component | Status | Key Features |
| :--- | :--- | :--- | :--- |
| `dashboard` | [`DashboardPage`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/src/renderer/pages/DashboardPage.tsx) | **DONE** | System telemetry card, storage paths card, provider readiness card, recent projects list |
| `tts` | [`TextToSpeechPage`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/src/renderer/pages/TextToSpeechPage.tsx) | **DONE** | Core 5-tab studio: Kịch bản (Script), Phân đoạn (Segments), Âm thanh (Audio), Phụ đề (Subtitles), Xuất bản (Export) |
| `projects` | [`ProjectsPage`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/src/renderer/pages/ProjectsPage.tsx) | **DONE** | Project grid, search, sorting, create, duplicate, rename modal, delete modal, reveal folder |
| `history` | [`HistoryPage`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/src/renderer/pages/HistoryPage.tsx) | **DONE** | Generation history log, status badges, audio playback, delete generation, open audio folder |
| `voices` | [`VoicesPage`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/src/renderer/pages/VoicesPage.tsx) | **DONE** | Voice cards, search, provider/gender/locale filters, preview audio button, favorites toggle |
| `presets` | [`VoicePresetsPage`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/src/renderer/pages/VoicePresetsPage.tsx) | **PLACEHOLDER** | EmptyState placeholder ("Tính năng lưu cấu hình giọng đọc đang được phát triển") |
| `dictionary` | [`PronunciationDictionaryPage`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/src/renderer/pages/PronunciationDictionaryPage.tsx) | **DONE** | Rules table, audio preview per term, rule editor, rule tester with audio comparison, CSV/JSON import/export |
| `settings` | [`SettingsPage`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/src/renderer/pages/SettingsPage.tsx) | **DONE** | General brand telemetry, storage paths, provider API keys, appearance (theme/i18n), system & FFmpeg diagnostics |

---

## 12. Zustand State Stores

| Store | File | Core Responsibilities |
| :--- | :--- | :--- |
| `useAppStore` | `app.store.ts` | Active navigation route, sidebar collapse state, theme (`dark`/`light`/`system`), language (`vi`/`en`), quick TTS draft |
| `useProjectEditorStore`| `projectEditor.store.ts` | Active project lifecycle, text editing, dirty state, autosave debouncing, draft recovery handling |
| `useTextProcessingStore`| `textProcessing.store.ts`| Normalization toggles, provider context, diff viewer mode, text processing preview, stale state tracking |
| `useDictionaryStore` | `dictionary.store.ts` | Rules list, search, category/provider/status filters, selection, import/export modals, revision counter |
| `useProviderStore` | `provider.store.ts` | Providers list, safeStorage API key configuration, connection self-test execution |
| `useVoiceStore` | `voice.store.ts` | Voice library definitions, filtering options, provider voice refresh, favorites bookmarking |
| `useGenerationStore` | `generation.store.ts` | Single audio synthesis, voice preview player state, generation history persistence |
| `useSegmentStore` | `segment.store.ts` | Segment list, segment builder, text/voice overrides, queue controls (start, pause, resume, cancel, regenerate) |
| `useCompositionStore` | `composition.store.ts` | Merged audio composition, subtitle cue list, subtitle exporter, project bundle exporter |

---

## 13. Multi-Agent Development System

The repository is governed by the multi-agent system specified in [`.agents/WORKFLOW.md`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/.agents/WORKFLOW.md):

```text
               MAIN AGENT / ORCHESTRATOR
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
BACKEND SPECIALIST              FRONTEND UX/UI SPECIALIST
(src/main/**, src/preload/**,    (src/renderer/**, components,
 src/shared/**, db/ffmpeg/tts)    pages, stores, styles, i18n)
         │                                 │
         └────────────────┬────────────────┘
                          ▼
                   INTEGRATED BUILD
                          │
                          ▼
                QA & TEST AUTOMATION
                (tests/**, QA gates,
                 .agents/qa/bugs/BUG-XXX.md)
                          │
                    PASS / FAIL
                          │
              ┌───────────┴───────────┐
              │                       │
            PASS                     FAIL
              │                       │
       SHIP / MERGE                   ▼
                          SELF-HEALING ROUTING
                          (Target Specialist / Max 3 Loops)
```

- **Main Orchestrator**: High-level task partitioning, Task Contract creation, integration merges, and documentation synchronization.
- **Backend Specialist**: Strict ownership of `src/main/**`, `src/preload/**`, `src/shared/**`, backend services, IPC, database, FFmpeg.
- **Frontend UX/UI Specialist**: Strict ownership of `src/renderer/**`, UI components, Tailwind styles, Zustand stores, accessibility, localization.
- **QA & Test Automation Specialist**: Independent test suite execution, bug ticket creation (`.agents/qa/bugs/BUG-XXX.md`), verification gates.
- **Self-Healing Protocol**: Up to 3 automatic remediation loops per bug ticket with circuit breaker escalation.

---

## 14. Installed Skills Audit

- **Project Workspace Skills**: None installed locally inside `.skills/` or the repository root.
- **Antigravity Global Environment Skills Available**:
  - `modern-web-guidance`: Modern HTML/CSS/Web best practices.
  - `chrome-devtools`: Debugging, troubleshooting, browser automation.
  - `a11y-debugging`: Accessibility auditing.
  - `generative_ui`: Interactive widgets and diagrams.
  - `google-antigravity-sdk`: Agent design and orchestration.
  - `debug-optimize-lcp`: Core Web Vitals optimization.
  - `memory-leak-debugging`: JavaScript heap analysis.

---

## 15. Automated Test Coverage & Quality Gates

### Actual Test Execution
- **Command**: `npm test` (`ELECTRON_RUN_AS_NODE=1 electron ./node_modules/vitest/vitest.mjs run`)
- **Test Files**: 36 passed (36/36)
- **Total Tests**: 178 passed (178/178, 100%)
- **Test Duration**: 3.24 seconds

### Domain Coverage Breakdown
- **Projects & Storage**: `projectRepository.test.ts`, `projectService.test.ts`, `projectFilesystem.test.ts`, `recovery.test.ts`, `largeText.test.ts` (17 tests)
- **Database & Schemas**: `database.test.ts`, `schemas.test.ts`, `secretStorage.test.ts`, `appPaths.test.ts`, `systemInfo.test.ts` (18 tests)
- **Text Processing & Dictionary**: `textProcessing.test.ts`, `dictionaryMatcher.test.ts`, `vietnameseNumberNormalizer.test.ts`, `dateNormalizer.test.ts`, `currencyNormalizer.test.ts`, `pronunciationRepository.test.ts`, `pronunciationService.test.ts`, `dictionaryImportExport.test.ts`, `processingPersistence.test.ts`, `stressProcessing.test.ts` (38 tests)
- **TTS Providers & Audio**: `edgeTts.test.ts`, `providerRegistry.test.ts`, `ttsGeneration.test.ts`, `audioStorage.test.ts`, `audioProtocol.test.ts` (36 tests)
- **Segment Engine, Queue, FFmpeg & Subtitles**: `segmentEngine.test.ts`, `segmentReuse.test.ts`, `jobQueue.test.ts`, `ffmpegService.test.ts`, `subtitleEngine.test.ts`, `exportService.test.ts` (22 tests)
- **QA Independent Verification Suites**: `qaAudioPreview.test.ts`, `qaDictionaryAudioPreview.test.ts`, `qaExportVerification.test.ts`, `qaBranding.test.ts` (44 tests)

### Quality Gate Results
- **Typecheck**: `npm run typecheck` -> **PASS (0 errors)**
- **Lint**: `npm run lint` -> **PASS (0 errors, 0 warnings)**
- **Tests**: `npm test` -> **PASS (178/178 passed)**
- **Production Build**: `npm run build` -> **PASS (Built in ~1.3s)**

---

## 16. Known Issues & Audit Findings

1. **`VoicePresetsPage` is a Placeholder**:
   - Status: `PLACEHOLDER`.
   - Evidence: `src/renderer/pages/VoicePresetsPage.tsx` renders `EmptyState` component. Preset saving is not yet hooked to database.
2. **FFmpeg Binary Dependency**:
   - Status: `CONDITIONAL DEPENDENCY`.
   - Evidence: If system FFmpeg is not installed in standard paths or PATH, audio composition and subtitle export fall back to reporting an error banner rather than crashing.
3. **External Provider API Keys Required for LucyLab/ElevenLabs/Vbee**:
   - Status: `CONFIG-DEPENDENT`.
   - Evidence: LucyLab, ElevenLabs, and Vbee require valid API credentials in safeStorage; offline operation falls back to Edge TTS (which is 100% operational without credentials) or built-in voice catalogs.

---

## 17. Technical Debt

1. **Monolithic Page Component in TextToSpeechPage**:
   - `TextToSpeechPage.tsx` has grown to ~1,250 lines because it manages multiple studio tabs.
   - Recommended Refactor: Split individual tab contents (`'script'`, `'segments'`, `'audio'`, `'subtitle'`, `'export'`) into dedicated tab subcomponents under `src/renderer/components/studio/`.
2. **Mock Rule in TestRule Dictionary Service**:
   - Line 501 in `pronunciationDictionary.service.ts` creates an in-memory `mockRule` object to execute rule testing before saving to SQLite. While functional and test-verified, it can be renamed to `transientRule` for clarity.

---

## 18. Current Risks

1. **Third-Party TTS Service Availability**:
   - Edge TTS relies on Microsoft Edge public synthesis endpoints. Any endpoint schema changes by Microsoft could disrupt live Edge synthesis.
2. **Electron Native Addon (`better-sqlite3`) Packaging**:
   - Cross-compiling for Windows or Linux from a macOS host requires Docker or native CI runners (e.g. GitHub Actions) to compile the C++ `.node` binary for the target OS architecture.

---

## 19. Next Recommended Work

### High Priority
1. **Studio Tab Modularization**: Decompose `TextToSpeechPage.tsx` into clean, testable sub-panels (`ScriptTab.tsx`, `SegmentsTab.tsx`, `AudioTab.tsx`, `SubtitleTab.tsx`, `ExportTab.tsx`).
2. **Automated CI/CD Cross-Compilation**: Configure GitHub Actions workflow for automated multi-platform builds (macOS Universal DMG, Windows NSIS/Portable, Linux AppImage/DEB).

### Medium Priority
1. **Implement Voice Presets**: Connect `VoicePresetsPage.tsx` to a new SQLite table `voice_presets` so users can save custom speed/pitch/volume combinations.
2. **Batch Project Audio Processing**: Add multi-project queue processing from the Projects page.

### Low Priority
1. **Cloud Sync & Backup Export**: Add optional zip packaging for entire project directories including audio files and database records.
2. **Custom Color Themes**: Expand appearance settings beyond dark/light/system to user-selectable accent palettes.
