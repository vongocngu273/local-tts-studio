# Kiến Trúc Cơ Sở Dữ Liệu SQLite (Database Architecture)

Tài liệu này mô tả chi tiết nền tảng lưu trữ cơ sở dữ liệu SQLite trong ứng dụng **Local AI Text to Speech Studio** theo kiến trúc **Local-First** và ưu tiên toàn vẹn dữ liệu (Data Integrity).

---

## 1. Tổng quan kỹ thuật

- **Engine:** SQLite 3 qua thư viện `better-sqlite3` (C++ native addon được biên dịch tương thích Electron 33 ABI).
- **Vị trí tệp:** `<userData>/database/local-tts-studio.db`
- **Mô hình hoạt động:** Hoàn toàn cục bộ trên máy người dùng, không phụ thuộc kết nối internet, không phụ thuộc cloud database.
- **Vai trò:** **Single Source of Truth** cho toàn bộ project metadata, script text, revision history, settings và trạng thái phục hồi.

---

## 2. Cấu hình Pragmas & Hiệu năng

Để đảm bảo an toàn tuyệt đối cho dữ liệu khi crash/mất nguồn đột ngột mà vẫn đạt tốc độ đọc ghi tối ưu trên ổ cứng SSD/NVMe của máy tính cá nhân, hệ thống tự động kích hoạt các pragmas sau ngay khi mở kết nối:

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

### Rationale:
1. **`journal_mode = WAL` (Write-Ahead Logging):**
   - Tách biệt luồng đọc và ghi (đọc không block ghi, ghi không block đọc).
   - Tối ưu hóa chu kỳ auto-save định kỳ mà không làm khựng UI của Renderer.
2. **`synchronous = NORMAL`:**
   - Khi kết hợp với WAL, `NORMAL` đảm bảo toàn vẹn dữ liệu SQLite ngay cả khi ứng dụng bị crash hoặc mất điện, đồng thời giảm thiểu các lệnh `fsync` tốn kém.
3. **`foreign_keys = ON`:**
   - Duy trì tính toàn vẹn tham chiếu bảng (ví dụ: `project_drafts` liên kết với `projects` qua foreign key `CASCADE`).
4. **`busy_timeout = 5000`:**
   - Chờ tối đa 5000ms nếu có xung đột khoá bảng trước khi quăng lỗi.

---

## 3. Schema & DDL

Hệ thống quản lý schema bằng hệ thống migration tự động theo phiên bản (`schema_migrations`).

### 3.1. Bảng `schema_migrations`
Ghi nhận các migration đã được áp dụng vào database.

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version INTEGER UNIQUE NOT NULL,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
```

### 3.2. Bảng `projects`
Bảng lưu trữ chính cho các dự án kịch bản âm thanh.

```sql
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,                     -- 'draft' | 'ready' | 'processing' | 'completed' | 'error'
  original_text TEXT NOT NULL DEFAULT '',
  processed_text TEXT NOT NULL DEFAULT '',
  provider_id TEXT,
  voice_id TEXT,
  settings_json TEXT NOT NULL DEFAULT '{}',
  project_path TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_opened_at TEXT,
  deleted_at TEXT                           -- Soft-delete timestamp (ISO-8601)
);

CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
```

### 3.3. Bảng `project_drafts`
Bảng lưu trữ bản thảo tạm thời (Intermediate Recovery Drafts) nhằm phục vụ cơ chế Crash Recovery.

```sql
CREATE TABLE IF NOT EXISTS project_drafts (
  project_id TEXT PRIMARY KEY,
  original_text TEXT NOT NULL DEFAULT '',
  processed_text TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### 3.4. Bảng `app_metadata`
Bảng lưu trữ trạng thái hệ thống, ví dụ cờ `clean_shutdown` để phát hiện sự cố ứng dụng tắt bất thường.

```sql
CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

---

## 4. Hệ thống Migration & An toàn Dữ liệu

Trước khi thực thi bất kỳ câu lệnh DDL migration nào, `MigrationRunner` thực hiện quy trình sau:
1. Kiểm tra danh sách migration trong code với các migration đã lưu trong `schema_migrations`.
2. Nếu có migration mới cần chạy:
   - Tự động tạo bản sao lưu an toàn (`safety backup`) của file `.db` vào thư mục `<userData>/backups/`.
   - Mở một SQLite Transaction `BEGIN ... COMMIT`.
   - Thực thi từng migration.
   - Ghi lại bản ghi phiên bản vào `schema_migrations`.
   - Nếu xảy ra bất kỳ lỗi nào, tự động `ROLLBACK` toàn bộ thay đổi.

---

## 5. Chiến lược Sao lưu & Xoay vòng (Backup & Rotation)

- **Định dạng file sao lưu:** `local-tts-studio-YYYYMMDD-HHmmss.db`
- **Vị trí:** `<userData>/backups/`
- **Tần suất tạo:**
  - Tự động trước mỗi lần nâng cấp schema migration.
  - Hỗ trợ snapshot thủ công hoặc định kỳ.
- **Giới hạn lưu trữ (Rotation):** Giữ tối đa **10 bản sao lưu mới nhất**. Khi vượt quá 10 bản, các bản cũ nhất sẽ được tự động dọn dẹp để tiết kiệm dung lượng ổ đĩa.

---

## 6. Trình dọn dẹp và đóng an toàn (Clean Shutdown & WAL Checkpoint)

Khi nhận sự kiện `app.on('before-quit')`:
1. Ghi nhận `clean_shutdown = 'true'` vào bảng `app_metadata`.
2. Thực thi lệnh `PRAGMA wal_checkpoint(TRUNCATE);` để đưa toàn bộ dữ liệu từ tệp WAL về tệp DB chính.
3. Đóng kết nối `db.close()`.
