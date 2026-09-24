# Local TTS Studio — UI System & Component Inventory

This document serves as the authoritative source of truth for the **Frontend UX/UI Specialist** and QA testers regarding the current UI architecture, navigation, components, and design tokens of **Local TTS Studio** (v1.0.0, 2026).

---

## 1. Product Type & Paradigm

- **Product Category**: Professional Desktop Audio & Speech Engineering Studio.
- **Form Factor**: Frameless desktop application (Electron + React) with custom titlebar drag regions and native OS integration.
- **Target Audience**: Content creators, audiobook producers, voiceover artists, video editors, and developers needing local, high-control text-to-speech synthesis with timeline waveform editing and subtitle generation.
- **Design Philosophy**: High information density, minimal decorative fluff, dark/light theme support, instant feedback, and deterministic state visibility.

---

## 2. Navigation Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│ AppHeader (56px)                                                       │
│ [Menu Toggle]  [App Icon + Name] / [Current Route Title]   [Lang] [Theme]│
├──────────────┬─────────────────────────────────────────────────────────┤
│ AppSidebar   │ Main Content Workspace Area                             │
│ (64px /      │ (Max width: 6xl mx-auto, padding: p-4 to p-6)          │
│  256px)      │                                                         │
│              │ - DashboardPage                                         │
│ [Dashboard]  │ - TextToSpeechPage (Studio: 5 Tabs)                     │
│ [Studio TTS] │   [Kịch bản | Phân đoạn | Âm thanh | Phụ đề | Xuất bản] │
│ [Projects]   │ - ProjectsPage                                          │
│ [History]    │ - HistoryPage                                           │
│ [Voices]     │ - VoicesPage                                            │
│ [Presets]    │ - VoicePresetsPage                                      │
│ [Dictionary] │ - PronunciationDictionaryPage                           │
│ [Settings]   │ - SettingsPage (5 Tabs)                                 │
│              │   [Tổng quan | Lưu trữ | Nhà cung cấp | Giao diện | Máy]│
│ [Brand Badge]│                                                         │
└──────────────┴─────────────────────────────────────────────────────────┘
```

### Layout Elements
1. **`AppHeader` (`src/renderer/components/layout/AppHeader.tsx`)**:
   - Fixed height: `h-14` (56px).
   - Window drag area: `app-drag-region` on the header background; interactive buttons use `app-no-drag`.
   - Left: Sidebar toggle button (`Menu`), App waveform icon, Title breadcrumb (`Local TTS Studio / [Route Name]`).
   - Right: Language switcher (`Globe` - Tiếng Việt / English), Theme cycle button (`Sun` / `Moon` / `Laptop`).
2. **`AppSidebar` (`src/renderer/components/layout/AppSidebar.tsx`)**:
   - Width: `w-64` (expanded, 256px) or `w-16` (collapsed, 64px) with smooth CSS transition.
   - Header: Workspace brand badge with collapsible spark icon.
   - Navigation links: 8 items with active route highlighting (`bg-primary/10 text-primary border-l-2`).
   - Footer: Collapse/expand toggle button + Brand copyright watermark (`v1.0.0 • © 2026 Ngự Võ`).

---

## 3. Screen Inventory & States

### Screen 1: Dashboard (`DashboardPage.tsx`)
- **Route**: `'dashboard'`
- **Purpose**: High-level telemetry, system status, provider readiness, and rapid access to recent projects.
- **Major Components**: `SystemStatusCard`, `LocalStorageCard`, `ProviderStatusCard`, recent projects list, `EmptyState`.
- **Primary Action**: "Mở Studio TTS" (`setActiveRoute('tts')`).
- **Secondary Actions**: Click on recent project card to load directly into the editor; click "Xem tất cả" to navigate to Projects.
- **States**: Loading skeleton, Empty (no recent projects), Populated.
- **Known UX Issues**: None observed.

### Screen 2: Studio / Text-to-Speech (`TextToSpeechPage.tsx`)
- **Route**: `'tts'`
- **Purpose**: The primary multi-phase workspace for project text editing, processing, segmenting, generating, wave-inspecting, subtitling, and exporting.
- **Sub-Tabs**:
  1. **Kịch bản (Script)**: Original text editor, text processing toggles panel (`TextProcessingSettingsPanel`), diff viewer (`TextProcessingDiffViewer`), character/word counter, autosave indicator.
  2. **Phân đoạn (Segments)**: Segment list (`SegmentList`), segment builder, per-segment text/voice editor (`SegmentEditModal`), queue control bar (`QueueControlBar`).
  3. **Âm thanh (Audio)**: Waveform timeline (`WaveformTimeline`), full track player (`AudioPlayer`), FFmpeg audio composer trigger.
  4. **Phụ đề (Subtitles)**: Subtitle cue table viewer (`SubtitleViewer`), timing search, sentence/paragraph pause duration adjusters.
  5. **Xuất bản (Export)**: Export configuration grid (`ExportPanel`), target folder selector, atomic export trigger.
- **Primary Actions**:
  - Script tab: "Xử lý văn bản" (Process Script).
  - Segments tab: "Bắt đầu tạo âm thanh" (Start Queue).
  - Audio tab: "Ghép nối âm thanh" (Compose Full Track).
  - Subtitle tab: "Xuất tệp phụ đề" (Export SRT/VTT).
  - Export tab: "Tiến hành xuất tệp" (Export Bundle).
- **States**: Unsaved dirty changes, saving in progress, draft recovery alert, queue processing with live progress bar, audio composing spinner, export success banner.
- **Known UX Issues**: Single component file is large (~1,250 lines); tabs could be separated into dedicated modular sub-panel components.

### Screen 3: Projects (`ProjectsPage.tsx`)
- **Route**: `'projects'`
- **Purpose**: Project repository browser with search, multi-facet sorting, and management actions.
- **Major Components**: Project cards grid, search input, sort dropdown, Rename modal, Delete confirmation modal, `EmptyState`.
- **Primary Action**: "Tạo dự án mới" (Create Project).
- **Secondary Actions**: Rename project, Duplicate project, Delete (soft delete), Reveal folder in OS file manager, Open project in Studio.
- **States**: Loading spinner, Empty state (no projects or search returned 0 items), Modals open/closed.
- **Known UX Issues**: None.

### Screen 4: History (`HistoryPage.tsx`)
- **Route**: `'history'`
- **Purpose**: Audit log of all individual and batch TTS generations across projects.
- **Major Components**: Generation records table, `StatusBadge` (completed, processing, failed), inline `AudioPlayer`, delete button, reveal in folder button.
- **Primary Action**: Play generated audio.
- **Secondary Actions**: Delete history record, Reveal audio file in OS file manager.
- **States**: Loading, Empty, Audio playing.
- **Known UX Issues**: None.

### Screen 5: Voice Library (`VoicesPage.tsx`)
- **Route**: `'voices'`
- **Purpose**: Catalog of available neural voices across Edge TTS, LucyLab, ElevenLabs, and Vbee.
- **Major Components**: `VoiceCard` grid, search bar, provider filter tabs, gender dropdown, favorite filter toggle, "Làm mới danh sách" (Refresh) button.
- **Primary Action**: "Nghe thử" (Audition voice preview).
- **Secondary Actions**: Toggle favorite star, select default project voice.
- **States**: Loading voices, refreshing catalog spinner, preview audio loading/playing, empty filter results.
- **Known UX Issues**: Handled: rapid preview button clicks now gracefully cancel previous play promises without console `AbortError` noise.

### Screen 6: Voice Presets (`VoicePresetsPage.tsx`)
- **Route**: `'presets'`
- **Purpose**: Manage custom saved voice configurations (speed, pitch, volume, provider pairs).
- **Major Components**: `EmptyState` placeholder.
- **Status**: `PLACEHOLDER` — Renders clean placeholder indicating feature is planned for future release.
- **Known UX Issues**: Non-functional placeholder as documented.

### Screen 7: Pronunciation Dictionary (`PronunciationDictionaryPage.tsx`)
- **Route**: `'dictionary'`
- **Purpose**: Comprehensive phonetic pronunciation dictionary for brand names, acronyms, and technical terms.
- **Major Components**: Rules table with inline `PronunciationAudioButton`, batch actions bar, search bar, category filter, provider filter, `RuleEditorModal`, `TestRuleModal`, `ImportDictionaryModal`.
- **Primary Action**: "Thêm quy tắc mới" (Add Rule).
- **Secondary Actions**: Test rule modal with audio comparison, Import CSV/JSON, Export CSV/JSON, batch toggle enabled, batch delete.
- **States**: Loading, Empty, Editor modal open, Import preview modal, Test rule modal with audio playing.
- **Known UX Issues**: None.

### Screen 8: Settings (`SettingsPage.tsx`)
- **Route**: `'settings'`
- **Purpose**: System diagnostics, storage path revelation, provider API keys management, appearance, and FFmpeg binary health.
- **Sub-Tabs**:
  1. **Tổng quan (General)**: Brand telemetry cards (Tác giả: Ngự Võ, Phiên bản: v1.0.0, Năm: 2026, Bản quyền: Copyright © 2026 Ngự Võ, Mã định danh: `com.localtts.studio`).
  2. **Lưu trữ (Storage)**: Storage directory cards with "Mở thư mục" action.
  3. **Nhà cung cấp (Providers)**: `ProviderCard` list with safeStorage API key inputs and connection test buttons.
  4. **Giao diện (Appearance)**: Theme selector (Sáng, Tối, Hệ thống) and Language selector (Tiếng Việt, English).
  5. **Hệ thống (System)**: Hardware stats (CPU, RAM, OS, Electron, Node, Chrome) and FFmpeg self-test tool.
- **Primary Action**: Test provider connection / Save provider settings.
- **States**: Testing connection in progress, testing FFmpeg in progress, success/error alert banners.
- **Known UX Issues**: None.

---

## 4. Reusable Component Inventory

| Category | Component File | Description & Props |
| :--- | :--- | :--- |
| **Audio** | `AudioPlayer.tsx` | Standardized audio playback bar with play/pause, seekbar, time display, volume slider. |
| **Audio** | `WaveformTimeline.tsx` | `wavesurfer.js` canvas timeline with zoom controls, playhead scrubbing, audio region indicators. |
| **Dictionary**| `PronunciationAudioButton.tsx`| 3-state icon button (Idle, Loading spinner, Playing pulse) for spoken term preview. |
| **Dictionary**| `RuleEditorModal.tsx` | Modal form for creating/editing pronunciation rules with phonetic preview. |
| **Dictionary**| `TestRuleModal.tsx` | Interactive modal to test rules against sample text with side-by-side audio playback. |
| **Dictionary**| `ImportDictionaryModal.tsx` | File selector with validation summary (valid, duplicate, invalid) and import execution. |
| **Export** | `ExportPanel.tsx` | 9-option checkbox grid, target folder selector, and progress/export trigger. |
| **Layout** | `AppLayout.tsx` | Root shell holding AppSidebar and AppHeader with responsive container. |
| **Layout** | `AppHeader.tsx` | Window header bar with breadcrumb, theme toggle, and language switch. |
| **Layout** | `AppSidebar.tsx` | Collapsible navigation rail with active item indicator and brand copyright badge. |
| **Providers** | `ProviderCard.tsx` | Settings card for a TTS provider with API key input, voice counter, connection check. |
| **Segments** | `QueueControlBar.tsx` | Queue actions bar: Start, Pause, Resume, Cancel, status badge, progress bar. |
| **Segments** | `SegmentList.tsx` | Virtualized/scrollable list of script segments with index, text, duration, actions. |
| **Segments** | `SegmentCard.tsx` | Individual segment card with status badge, text override badge, preview audio button. |
| **Segments** | `SegmentEditModal.tsx` | Modal for modifying individual segment text override and voice assignment. |
| **Subtitles** | `SubtitleViewer.tsx` | Cue list preview table with cue index, start/end timestamps, text, and search filter. |
| **Text** | `TextProcessingSettingsPanel.tsx`| Normalization toggles with wrapping hint descriptions (no truncation). |
| **Text** | `TextProcessingDiffViewer.tsx`| Side-by-side or processed-only visual diff viewer highlighting added/removed tokens. |
| **UI** | `StatusBadge.tsx` | Semantic badge component (`ready`, `pending`, `warning`, `neutral`, `stale`). |
| **UI** | `EmptyState.tsx` | Centered empty state graphic with icon, title, description, and optional action button. |
| **UI** | `SystemStatusCard.tsx` | Telemetry metric card (CPU, Memory, Storage). |
| **UI** | `LocalStorageCard.tsx` | Disk space and directory path indicator card. |
| **UI** | `ProviderStatusCard.tsx`| Summary indicator card showing count of configured and active TTS providers. |
| **UI** | `ErrorBoundary.tsx` | React error boundary catching render crashes with user-facing recovery button. |
| **Voices** | `VoiceCard.tsx` | Voice card with provider badge, gender badge, locale, favorite star, preview audio button. |

---

## 5. Design Tokens (Tailwind & CSS Variables)

Source of truth: [`tailwind.config.js`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/tailwind.config.js) & [`src/renderer/styles/globals.css`](file:///Users/nguvn/Library/Mobile%20Documents/com~apple~CloudDocs/Work/Vibe-code/text-to-speech/src/renderer/styles/globals.css).

### Color Palette (HSL Variables)

| Token Name | Light Mode Value | Dark Mode Value | Usage |
| :--- | :--- | :--- | :--- |
| `--background` | `220 14% 96%` (Slate 100) | `222 47% 7%` (Dark Slate 950) | Main application background |
| `--foreground` | `222 47% 11%` (Slate 900) | `210 40% 98%` (Slate 50) | Default primary body text |
| `--card` | `0 0% 100%` (Pure White) | `222 47% 10%` (Slate 900) | Card backgrounds, panels, modals |
| `--card-foreground` | `222 47% 11%` | `210 40% 98%` | Card headers and text content |
| `--primary` | `221 83% 53%` (Royal Blue) | `217 91% 60%` (Vibrant Blue) | Primary buttons, active tabs, highlights |
| `--primary-foreground`| `210 40% 98%` | `222 47% 11%` | Text on primary buttons |
| `--muted` | `210 40% 96.1%` | `217 33% 17%` | Muted backgrounds, toggle tracks |
| `--muted-foreground` | `215.4 16.3% 46.9%` | `215 20.2% 65.1%` | Secondary descriptions, timestamps, hints |
| `--border` | `214.3 31.8% 91.4%` | `217 33% 17%` | Component outlines, separators |
| `--input` | `214.3 31.8% 91.4%` | `217 33% 17%` | Input border styling |

### Typography & Spacing
- **Font Family**: System native sans-serif stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`).
- **Base Font Sizes**:
  - `text-[10px]` / `text-xs`: Badges, metadata, secondary captions, hints.
  - `text-sm`: Body text, form labels, inputs, table cells.
  - `text-base` / `text-lg`: Card titles, section headers.
  - `text-xl` / `text-2xl`: Page headings.
- **Border Radius**:
  - `rounded-lg` (8px): Standard for cards, inputs, modals, buttons.
  - `rounded-md` (6px): Badges, icon containers.
  - `rounded-full`: Avatar chips, status dots.
- **Custom Desktop Scrollbars**:
  - Width: 8px.
  - Thumb: `hsl(var(--muted-foreground) / 0.25)` with hover opacity `0.4`.

---

## 6. UX States Standardization

1. **Loading State**:
   - Small actions: `Loader2 className="animate-spin"` inside button with disabled state.
   - Large sections: Skeleton containers or centered loading spinners with informative text.
2. **Empty State**:
   - Utilizes `EmptyState` component with centered Lucide icon in circular muted container, clear title, explanatory subtitle, and primary call-to-action button.
3. **Error State**:
   - User-facing error banners in red/amber with dismiss buttons.
   - Uncaught UI crashes handled gracefully by `ErrorBoundary` with reset option.
4. **Disabled State**:
   - `opacity-50 cursor-not-allowed` on buttons and form elements.
5. **Processing State**:
   - Queue progress bar showing completed/total segment counts and live percentage.
6. **Stale State**:
   - Orange/amber status badges (`StatusBadge variant="stale"`) notifying user that the script was modified and requires re-processing or re-segmenting.

---

## 7. UI Inconsistencies Audit

1. **Modal Form Padding**:
   - `RuleEditorModal.tsx` and `SegmentEditModal.tsx` use `p-6` with standard `max-w-lg`.
   - `ImportDictionaryModal.tsx` uses `max-w-xl` to accommodate table previews. This is acceptable given the data density.
2. **Action Button Typography**:
   - Buttons across `TextToSpeechPage` and `ProjectsPage` vary slightly between `text-xs font-semibold` and `text-sm font-medium`. Standardizing to `text-xs font-semibold` for compact desktop headers and `text-sm font-medium` for modal submit actions is recommended.
3. **Text Truncation Guard**:
   - Fixed previously reported bug where toggle hints in `TextProcessingSettingsPanel` and `ExportPanel` were clipped with `truncate`. All cards now use `leading-relaxed break-words whitespace-normal`.

---

## 8. AI Slop & Visual Bloat Audit

- **Card Overuse**: Currently reasonable. Screens use structured card grids for projects and voices, avoiding nested "card-in-card" anti-patterns.
- **Decorative Gradients**: No gratuitous multi-color rainbow gradients. All styling uses clean solid slate backgrounds with subtle borders and crisp contrast.
- **Fake Dashboard Sections**: Avoided. `DashboardPage` only displays actual database-backed project counts, real hardware telemetry, and actual configured providers.
- **Redundant Icons**: Every icon in `AppSidebar` and `AppHeader` maps to a distinct user action or semantic domain.

---

## 9. Recommended Design Direction

1. **Maintain Desktop Information Density**: Prioritize dense, scannable data layouts over mobile-style oversized spacing.
2. **Modularize Large Studio Tabs**: Move the 5 tab implementations from `TextToSpeechPage.tsx` into dedicated components (`ScriptTab.tsx`, `SegmentsTab.tsx`, `AudioTab.tsx`, `SubtitleTab.tsx`, `ExportTab.tsx`) to improve testability and maintainability.
3. **Keyboard Shortcut Accessibility**: Implement global desktop shortcuts:
   - `Cmd/Ctrl + S`: Trigger immediate project save.
   - `Space`: Play/pause active audio playback in Studio or Voice Library.
   - `Cmd/Ctrl + N`: Create new project.
