# Local TTS Studio — Technical Architecture

This document provides the authoritative deep-dive technical architecture for **Local TTS Studio** (v1.0.0, 2026). It reflects the exact implementations present in the source code.

---

## 1. System Overview

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        REACT RENDERER PROCESS                          │
│                                                                        │
│   Pages: Dashboard, TextToSpeech Studio, Projects, History, Voices,    │
│          VoicePresets, PronunciationDictionary, Settings               │
│   Stores: app, projectEditor, textProcessing, dictionary, provider,    │
│           voice, generation, segment, composition                      │
│   Components: WaveformTimeline (wavesurfer.js), SubtitleViewer,        │
│               ExportPanel, QueueControlBar, SegmentList, AudioPlayer   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                         Preload ContextBridge
                     (window.localTTS Typed API)
                                    │
                        Typed IPC Message Bus
                    (64 Channels, Zod Schema Guard)
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                         ELECTRON MAIN PROCESS                          │
│                                                                        │
│  IPC Handler Dispatcher (registerIpcHandlers.ts):                      │
│  13 Modular Registrars: app, system, project, dictionary,              │
│  textProcessing, provider, generation, segment, queue,                 │
│  composition, subtitle, export, ffmpeg                                 │
│                                                                        │
│  Domain Service Layer:                                                 │
│  ├── ProjectService & ProjectFilesystemService                         │
│  ├── TextProcessingService (Normalizers + Protected Spans)             │
│  ├── PronunciationDictionaryService (Matcher + Import/Export)          │
│  ├── ProviderRegistry (Edge, LucyLab, ElevenLabs, Vbee)                │
│  ├── VoiceManagerService & TTSGenerationService                        │
│  ├── SegmentEngine (Splitters + Optimizer + Audio Reuse)               │
│  ├── JobQueueService (Persistent SQLite Queue + Worker + Recovery)     │
│  ├── FFmpegService & FFprobeService & FFmpegBinaryService              │
│  ├── AudioCompositionService & AudioStorageService                     │
│  ├── SubtitleTimingService & SrtWriter & VttWriter                     │
│  ├── ExportService (Atomic Bundler + Manifest Generator)               │
│  ├── SecretStorageService (Electron safeStorage API)                   │
│  └── SystemInfoService & Logger                                        │
│                                                                        │
│  Data Access Layer (better-sqlite3):                                   │
│  12 Repositories: project, projectDraft, pronunciationDictionary,      │
│  providerSettings, providerSecrets, voiceCache, generation,            │
│  voiceFavorites, segment, job, composition, subtitle, appMetadata      │
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

## 2. Process Boundaries

### Renderer Process (`src/renderer/**`)
- **Responsibilities**: User interaction, UI presentation, reactive local state via Zustand, Waveform rendering via HTML5 Canvas (`wavesurfer.js`), audio playback via HTML5 `<audio>` elements interacting with custom protocol `localtts-audio://`.
- **Restrictions**:
  - No direct Node.js API access (`fs`, `child_process`, `crypto`, `better-sqlite3` are strictly unavailable).
  - All operations with the filesystem, database, OS processes, or network TTS services must go through `window.localTTS`.

### Preload Process (`src/preload/**`)
- **Responsibilities**: Acts as a secure, typed DMZ (demilitarized zone) between Renderer and Main processes.
- **Implementation**:
  - Exposes `localTTSApi` to Renderer window object via `contextBridge.exposeInMainWorld('localTTS', localTTSApi)`.
  - Maps high-level async methods to `ipcRenderer.invoke(channel, payload)`.
  - Sets up reactive listeners (`ipcRenderer.on(IPC_CHANNELS.QUEUE_EVENT, ...)` with automatic cleanup callbacks).

### Electron Main Process (`src/main/**`)
- **Responsibilities**: Full OS capabilities, native Node.js runtime, window management, hardware telemetry, SQLite database operations, encrypted secrets storage, local filesystem management, external binary spawning (FFmpeg), and external network communication (WebSocket & HTTP REST).

---

## 3. Security Boundaries & Hardening

1. **Context Isolation & Node Integration**:
   - `contextIsolation: true` in `BrowserWindow` webPreferences.
   - `nodeIntegration: false` ensures renderer cannot bypass preload boundaries.
2. **Preload API Whitelisting**:
   - The preload script does not expose generic `ipcRenderer.send` or `ipcRenderer.on`. Only explicit, domain-specific methods (`projects.create`, `queue.start`, etc.) are exposed.
3. **IPC Input Validation**:
   - All critical incoming IPC payloads are parsed and validated using **Zod schemas** in [`src/shared/schemas/`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/src/shared/schemas/) prior to invoking backend service logic.
4. **Encrypted Credential Storage**:
   - Provider API keys and sensitive tokens are encrypted using Electron's native `safeStorage` API via [`SecretStorageService`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/src/main/services/security/secretStorage.service.ts).
   - macOS: Apple Keychain Services.
   - Windows: Windows Data Protection API (DPAPI).
   - Linux: libsecret / Secret Service API.
   - Encrypted blobs are stored in the SQLite `provider_secrets` table. Plaintext credentials never hit SQLite or disk.
5. **Filesystem Path Confinement**:
   - All file and directory operations verify that target paths reside within the authorized workspace boundaries using `audioStorageService.isPathWithinWorkspace(targetPath)`.
   - Prevents path traversal vulnerabilities (`../../..`).
6. **External Process Execution**:
   - `FFmpegService` and `FFmpegBinaryService` invoke binaries using `child_process.spawn` with an explicit arguments array and `shell: false`. No shell string interpolation is permitted.
7. **Custom Audio Streaming Protocol**:
   - Registers scheme `localtts-audio://` with `bypassCSP: true`, `stream: true`, and `supportFetchAPI: true`.
   - Protocol handler verifies that requested audio files reside within authorized project workspaces.
   - Implements **HTTP Range Header parsing (RFC 7233)**: returns `206 Partial Content` with `Content-Range`, `Accept-Ranges: bytes`, and proper MIME types (`audio/mpeg`, `audio/wav`).

---

## 4. Directory Map

```text
src/
├── main/                               # Electron Main Process
│   ├── database/                       # Database engine, migrations, repositories
│   │   ├── migrations/                 # Versioned migration scripts (001 - 004)
│   │   ├── repositories/               # 12 Data Access repositories
│   │   ├── backup.service.ts           # Pre-migration automated database backups
│   │   └── database.service.ts         # better-sqlite3 connection manager
│   ├── ipc/                            # 13 Modular IPC handler files
│   ├── providers/                      # TTS provider adapters (Edge, LucyLab, ElevenLabs, Vbee)
│   ├── security/                       # Security policies & sanitization
│   ├── services/                       # Core domain services
│   │   ├── app-paths/                  # OS path resolution
│   │   ├── audio/                      # Audio protocol handler & storage manager
│   │   ├── composition/                # Multi-segment audio composition
│   │   ├── dictionary/                 # Pronunciation dictionary service
│   │   ├── export/                     # Project export bundle & markdown manifest generator
│   │   ├── ffmpeg/                     # FFmpeg, FFprobe, binary detection
│   │   ├── job-queue/                  # Persistent queue, retry policy, crash recovery
│   │   ├── logger/                     # Structured rotating logger
│   │   ├── project/                    # Project CRUD, autosave, crash recovery
│   │   ├── project-filesystem/         # Project folder creation & text file mirroring
│   │   ├── security/                   # safeStorage secret encryption
│   │   ├── segmentation/               # Paragraph/sentence splitters, optimizer, fingerprinting
│   │   ├── subtitles/                  # Cue timing calculator, SRT writer, VTT writer
│   │   ├── system/                     # Hardware diagnostics & telemetry
│   │   ├── text-processing/            # 7-stage normalizers & protected spans matcher
│   │   └── tts/                        # Synthesis coordinator & voice manager
│   ├── window/                         # BrowserWindow creation & lifecycle
│   └── index.ts                        # Main process entry point
├── preload/                            # Preload Script
│   ├── api.ts                          # strongly typed localTTSApi definition
│   └── index.ts                        # contextBridge initializer
├── renderer/                           # React Renderer Process
│   ├── components/                     # Reusable UI component modules
│   │   ├── audio/                      # WaveformTimeline, AudioPlayer
│   │   ├── dictionary/                 # RuleEditorModal, TestRuleModal, ImportModal, PronunciationAudioButton
│   │   ├── export/                     # ExportPanel
│   │   ├── layout/                     # AppLayout, AppHeader, AppSidebar
│   │   ├── providers/                  # ProviderCard
│   │   ├── segments/                   # QueueControlBar, SegmentList, SegmentCard, SegmentEditModal
│   │   ├── subtitles/                  # SubtitleViewer
│   │   ├── text-processing/            # TextProcessingSettingsPanel, TextProcessingDiffViewer
│   │   ├── ui/                         # StatusBadge, EmptyState, SystemStatusCard, LocalStorageCard, ErrorBoundary
│   │   └── voices/                     # VoiceCard
│   ├── i18n/                           # Vietnamese & English localization dictionary
│   ├── pages/                          # 8 Route Pages
│   ├── routes/                         # Route router & switcher
│   ├── stores/                         # 9 Zustand reactive state stores
│   ├── styles/                         # Tailwind CSS & global theme variables
│   ├── App.tsx                         # Root UI component
│   └── main.tsx                        # React DOM entry point
└── shared/                             # Shared contracts & types
    ├── constants/                      # App constants, IPC channels
    ├── schemas/                        # Zod runtime validation schemas
    ├── types/                          # Domain TypeScript types & interfaces
    └── utils/                          # Shared time and formatting utilities
```

---

## 5. Domain Architecture & Service Layer

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          PROJECT SERVICE                               │
│  - projectService.createProject()                                      │
│  - projectService.saveOriginalText() [debounced 1500ms]                │
│  - projectService.saveDraft()        [debounced 500ms]                 │
│  - projectService.recoverDraft()     [crash recovery]                  │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       TEXT PROCESSING SERVICE                          │
│  1. Whitespace Normalizer (Conservative)                               │
│  2. Dictionary Matcher (Longest-First, Aho-Corasick Regex, Word Bound) │
│     └─ Emits Protected Spans to prevent re-processing                  │
│  3. Date Normalizer (dd/mm/yyyy -> ngày ... tháng ... năm ...)         │
│  4. Currency Normalizer (VND, USD, EUR, GBP, JPY)                      │
│  5. Vietnamese Number Normalizer (Integers, Decimals, Percentages)     │
│  6. Abbreviation Normalizer (TP. -> Thành phố, TS. -> Tiến sĩ)        │
│  7. Safety Checks & Diff Generation                                    │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         SEGMENTATION ENGINE                            │
│  - paragraphSplitter.split() -> Paragraphs                             │
│  - sentenceSplitter.splitParagraph() -> Sentences                      │
│  - segmentOptimizer.optimize() -> Balanced segment chunks              │
│  - computeSegmentFingerprint() -> SHA-256 (Text + Voice + Settings)    │
│  - Audio Reuse: Matches existing fingerprint in SQLite -> Keep Audio   │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                          JOB QUEUE SERVICE                             │
│  - SQLite table: tts_jobs (status: pending/processing/completed/failed)│
│  - Worker polling interval (500ms) with per-provider concurrency limits│
│  - Heartbeat timer (5000ms) detects stalled workers (>30s)             │
│  - Exponential backoff retry policy (1s, 2s, 4s - max 3 attempts)      │
│  - Dispatches synthesis to ProviderRegistry                            │
│  - Writes segment audio to disk via AudioStorageService                │
│  - Emits IPC events: queue:started, progress, completed, failed        │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      AUDIO COMPOSITION SERVICE                         │
│  - Verifies all segments have status = 'completed'                     │
│  - Formulates FFmpeg concat protocol with silence filter gaps:         │
│    - Sentence pause: default 250ms                                     │
│    - Paragraph pause: default 600ms                                    │
│  - Spawns FFmpeg binary via FFmpegService                              │
│  - Records audio_compositions entry with exact duration & byte size    │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       SUBTITLE TIMING SERVICE                          │
│  - Iterates segments with cumulative millisecond offset calculation    │
│  - Timing Source Priority:                                             │
│    1. Word-level / Character-level timing file (timingPath)            │
│    2. Duration-proportional character allocation (fallback)           │
│  - Automatically injects sentence & paragraph pause offsets            │
│  - Subtitle writers: SrtWriter (.srt) and VttWriter (.vtt)             │
└──────────────────┬─────────────────────────────────────────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            EXPORT SERVICE                              │
│  - Target directory selection via dialog.showOpenDialog                │
│  - Atomic file writing and copying:                                    │
│    ├── Merged MP3 / WAV audio                                          │
│    ├── SRT / VTT subtitle files                                        │
│    ├── Raw and Processed script text files                             │
│    ├── Canonical project.json backup                                   │
│    ├── segments/ directory with individual MP3 files                   │
│    └── Rich markdown audit report: manifest.md                         │
│  - Returns complete file manifest and total size in bytes              │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Database Architecture

- **Engine**: SQLite 3 via `better-sqlite3`
- **Journal Mode**: WAL (`PRAGMA journal_mode = WAL;`)
- **Foreign Keys**: Enforced (`PRAGMA foreign_keys = ON;`)
- **Synchronous**: Normal (`PRAGMA synchronous = NORMAL;`)
- **Current Version**: `4`

### Entity-Relationship Diagram

```text
┌────────────────────────┐
│        projects        │◄─────────────────────────┐
│ (id, name, text, ...)  │                          │
└───────────┬────────────┘                          │
            │ 1:1                                   │ 1:N
            ▼                                       │
┌────────────────────────┐                          │
│     project_drafts     │                          │
│ (project_id, text,...) │                          │
└────────────────────────┘                          │
            │                                       │
            │ 1:N                                   │
            ▼                                       │
┌────────────────────────┐                          │
│    project_segments    │                          │
│ (id, text_hash, audio) │                          │
└───────────┬────────────┘                          │
            │ 1:N                                   │
            ▼                                       │
┌────────────────────────┐                          │
│        tts_jobs        ├──────────────────────────┤
│ (id, status, attempt)  │                          │
└────────────────────────┘                          │
            │                                       │
            │ 1:N                                   │
            ▼                                       │
┌────────────────────────┐                          │
│   audio_compositions   ├──────────────────────────┤
│ (id, duration, mp3)    │                          │
└───────────┬────────────┘                          │
            │ 1:N                                   │
            ▼                                       │
┌────────────────────────┐                          │
│    subtitle_exports    ├──────────────────────────┘
│ (id, format, cues)     │
└────────────────────────┘

Independent Global Tables:
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│ pronunciation_dict     │  │   provider_settings    │  │   provider_secrets     │
│ (term, spoken_text)    │  │ (provider_id, enabled) │  │ (provider_id, secret)  │
└────────────────────────┘  └────────────────────────┘  └────────────────────────┘
┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────┐
│    tts_voice_cache     │  │    voice_favorites     │  │      app_metadata      │
│ (provider_id, voice_id)│  │ (provider_id, voice_id)│  │ (key, value)           │
└────────────────────────┘  └────────────────────────┘  └────────────────────────┘
┌────────────────────────┐
│   schema_migrations    │
│ (version, name, date)  │
└────────────────────────┘
```

---

## 7. IPC Architecture

The IPC contract follows a strict pattern:
1. **Renderer** initiates an action:
   ```typescript
   await window.localTTS.projects.create({ name: 'My Novel' });
   ```
2. **Preload** dispatches over the whitelisted channel:
   ```typescript
   ipcRenderer.invoke(IPC_CHANNELS.PROJECT_CREATE, input);
   ```
3. **IPC Handler** validates input via Zod and calls the domain service:
   ```typescript
   ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_event, input) => {
     const validated = CreateProjectSchema.parse(input);
     return projectService.createProject(validated);
   });
   ```
4. **Service** executes business logic, invokes repositories, updates SQLite, and writes files.
5. **Result** is serialized and returned cleanly to the awaiting Promise in the Renderer.

---

## 8. TTS Provider Architecture

All providers implement the `ITTSProvider` interface:

```typescript
export interface ITTSProvider {
  readonly id: ProviderId;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;
  isConfigured(): boolean;
  testConnection(): Promise<{ success: boolean; message: string }>;
  getVoices(): Promise<VoiceDefinition[]>;
  synthesize(request: ProviderSynthesisRequest): Promise<ProviderSynthesisResult>;
}
```

- **`EdgeTtsAdapter`**: Connects directly via WebSocket (`wss://speech.platform.bing.com/consumer/speech/synthesize/readahead/edge/v1`). Zero-configuration, free, real-time synthesis.
- **`LucyLabAdapter`**: REST client for `https://api.lucylab.ai/v1`. Supports asynchronous synthesis jobs with polling and Vietnamese-optimized models.
- **`ElevenLabsAdapter`**: REST client for `https://api.elevenlabs.io/v1`. Supports quota inspection via `/user` and character-timestamped streaming synthesis.
- **`VbeeAdapter`**: REST client for `https://api.vbee.ai/v1`. Vietnamese voice platform adapter with fallback catalogs.

---

## 9. Dependency & Invalidation Graph

```text
Original Text Modified
         │
         ▼
[processed_text invalidated] (stale flag set to true)
         │
         ▼
User commits Text Processing
         │
         ▼
[new processed_text written] -> compute processingFingerprint
         │
         ▼
User rebuilds Segments
         │
         ├─────────────────────────────────────────┐
         ▼                                         ▼
Segment Fingerprint MATCHES               Segment Fingerprint CHANGED
         │                                         │
         ▼                                         ▼
   [REUSE AUDIO]                              [STALE AUDIO]
Existing audioPath preserved              audioPath cleared, status = 'pending'
         │                                         │
         └────────────────────┬────────────────────┘
                              │
                              ▼
                      Queue Execution
                              │
                              ▼
                     Audio Composition
                              │
                              ▼
                       Subtitle Export
                              │
                              ▼
                     Final Project Bundle
```

---

## 10. Crash Recovery & Resilience Architecture

1. **Dual-Timer Autosave**:
   - `draftSaveTimer` (500ms debounce): Writes raw text and current revision to `project_drafts` in SQLite without triggering file exports or rebuilding text processing.
   - `autoSaveTimer` (1500ms debounce): Writes authoritative text to `projects` table and mirrors `script-original.txt` to the filesystem.
2. **Crash Recovery Detection**:
   - When opening a project, `projectService.checkRecoveryDraft(projectId)` compares the `project_drafts` timestamp and revision against the `projects` table.
   - If a newer uncommitted draft exists, the UI presents the user with a prompt: **Khôi phục bản thảo chưa lưu** or **Hủy bỏ**.
3. **Queue Crash Recovery**:
   - On application startup, `queueRecoveryService.recoverOrphanedJobs()` scans `tts_jobs` for any records stuck in `processing`.
   - Stalled jobs are automatically reset to `pending` so the background worker picks them up safely upon queue resumption.
4. **Pre-Migration Safety Backups**:
   - Before executing any schema migration (`001` - `004`), `backupService.createBackup()` creates a full snapshot of `localtts.db` named `localtts_backup_vX_{timestamp}.db` in the `backups/` directory.
