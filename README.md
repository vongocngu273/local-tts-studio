# Local TTS Studio

## Overview

**Local TTS Studio** is a modern, local-first desktop Text to Speech Studio designed for privacy, performance, and flexibility. It runs completely offline on your computer, keeping scripts, voice models, and synthesized audio safely on-device.

---

## Tech Stack

- **Runtime & Desktop Shell**: [Electron 33](https://www.electronjs.org/)
- **Database**: [SQLite 3](https://www.sqlite.org/) via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) (WAL mode, Foreign Keys, Synchronous NORMAL)
- **Frontend UI**: [React 18](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/)
- **Build System**: [Vite 5](https://vitejs.dev/) via [electron-vite](https://electron-vite.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Validation**: [Zod](https://zod.dev/)
- **Testing**: [Vitest](https://vitest.dev/) (executed directly under Electron Node runtime)

---

## Phase 2 Features (Database, Persistence & Recovery)

- **SQLite Database Architecture**:
  - `better-sqlite3` native engine with WAL (`Write-Ahead Logging`) mode.
  - Automatic schema migrations with safety pre-migration backups.
  - Timestamped backup management with automated rotation (keeps newest 10 backups).
  - Clean shutdown tracking with WAL truncation checkpoint on exit.
- **Physical Project Storage**:
  - Structured directory hierarchy: `segments/`, `audio/`, `subtitles/`, `exports/`, `temp/`.
  - Atomic writing for `project.json` and `script-original.txt` via temporary file renames.
  - SQLite as Single Source of Truth with filesystem self-healing.
  - Complete Vietnamese Unicode fidelity (tested with 100,000 character stress scripts).
- **Auto-Save & Crash Recovery**:
  - 1000ms debounced background auto-save.
  - 400ms intermediate draft saving for crash recovery.
  - Non-blocking recovery banner in UI allowing one-click draft restore or discard.
  - Revision concurrency conflict prevention.
  - Keyboard shortcut `Cmd+S` / `Ctrl+S` for instantaneous save.
- **Project Management UI**:
  - Create new projects with auto-incrementing default names ("Untitled Project", "Untitled Project (2)").
  - Inline project renaming and duplicate project ("... (Copy)").
  - Fast search with case-insensitivity and multi-attribute sorting.
  - Soft delete with confirmation modal (database flag set, physical directory preserved).
  - Secure "Open Folder" button with directory traversal defense.

---

## Phase 3 Features (Pronunciation Dictionary & Text Processing)

- **Pronunciation Dictionary**:
  - Persistent storage in SQLite with 5 indexes and incremental `pronunciation_dictionary_revision` tracking.
  - Unicode-aware word boundary matching (`[\p{L}\p{N}_]`) preserving Vietnamese accented letters.
  - Precedence resolution: Highest Priority > Longest Match > Provider Scope Specificity > Recency.
  - Deterministic single-pass non-cascading replacement preventing recursion or compounding loops.
  - Protected spans mechanism guaranteeing dictionary replacements are never altered by downstream normalizers.
  - RFC 4180 CSV and JSON import/export with UTF-8 BOM (`\uFEFF`) and conflict policies (`skip` / `replace`).
  - Interactive rule testing with visual before/after comparison.
- **Vietnamese Text Processing Pipeline**:
  - Modular normalizer pipeline: Whitespace, Dates (`DD/MM/YYYY`), Numbers in words (`2026` → `hai nghìn không trăm hai mươi sáu`), Currencies (`VNĐ`, `₫` → `đồng`), and Common Abbreviations.
  - Leap year and calendar date validation (invalid dates like `31/02/2026` remain untouched).
  - Preceding `ngày` deduplication (prevents "ngày ngày một").
  - Deterministic SHA-256 fingerprinting for caching and change detection.
- **Preview & Trace UI**:
  - Side-by-side or processed-only view modes with transformation highlights.
  - Full transformation trace inspecting original vs normalized tokens and stage sources.
  - Real-time stale detection banner alerting when original script or dictionary rules change.
  - Quick "Add to Pronunciation Dictionary" action directly from selected script text.

---

## Documentation

- [SQLite Database Architecture & Schema](docs/database.md)
- [Project File Storage & Integrity](docs/project-storage.md)
- [Pronunciation Dictionary Architecture & Specification](docs/pronunciation-dictionary.md)
- [Local Text Processing Engine Specification](docs/text-processing.md)

---

## Requirements

- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later

---

## Install & Setup

```bash
npm install
```

> **Note on Native Modules:** `better-sqlite3` is rebuilt against the Electron ABI using `@electron/rebuild`.

---

## Development

Run development server with hot-reload for renderer and main process:

```bash
npm run dev
```

---

## Quality Gates & Verification

### Typecheck
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

### Automated Unit & Integration Tests
```bash
npm run test
```

### Production Build
```bash
npm run build
```

---

## Local Data & Storage

All application data is securely stored locally on your machine within the standard Electron `userData` directory:

- **macOS**: `~/Library/Application Support/LocalTTSStudio`
- **Windows**: `%APPDATA%\LocalTTSStudio`
- **Linux**: `~/.config/LocalTTSStudio`

Sub-directory layout:

```text
LocalTTSStudio/
├── database/            # SQLite database file (local-tts-studio.db)
├── projects/            # Physical project directories (<project-id>/)
├── cache/               # Audio/TTS temporary cache
├── logs/                # Application logs (logs/app.log)
├── backups/             # Timestamped safety backups (rotated to max 10)
└── temp/                # Working scratch directory
```

---

## Architecture

The codebase enforces strict isolation between processes:

- **`src/main/`**: Electron main process handling native window lifecycle, SQLite database connection, migrations, filesystem operations, logging, hardware diagnostics, and secure IPC endpoints.
- **`src/preload/`**: Secure bridge using `contextBridge.exposeInMainWorld('localTTS', ...)` to expose only explicit, typed APIs to the renderer.
- **`src/renderer/`**: React application handling UI layout, state management, and user interaction. Never imports Node or Electron modules directly.
- **`src/shared/`**: Pure TypeScript contracts, constants, Zod schemas, and types shared across processes.

---

## Roadmap

- [x] **Phase 1**: Desktop Foundation, Architecture, Security & Shell
- [x] **Phase 2**: SQLite Database + Project Persistence + Auto-Save + Recovery
- [ ] **Phase 3**: Pronunciation Dictionary & Text Normalization
- [ ] **Phase 4**: Local & Cloud TTS Providers (Edge TTS, LucyLab, ElevenLabs, Vbee)
- [ ] **Phase 5**: Audio Processing, FFmpeg merge, Subtitles (SRT/VTT)
