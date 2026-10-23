-- Migration number: 0001 	 2026-10-23T15:19:07.154Z
-- Người dùng (định danh bằng tài khoản Google)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  google_sub TEXT NOT NULL UNIQUE,
  email TEXT,
  name TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- File Google đã kết nối (sheet / doc / audio)
CREATE TABLE sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('sheet', 'doc', 'audio')),
  google_file_id TEXT NOT NULL,
  name TEXT,
  column_mapping TEXT,            -- JSON ánh xạ cột đã lưu
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, google_file_id)
);

-- Quyển (mỗi trang tính là một quyển)
CREATE TABLE books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

-- Unit trong quyển
CREATE TABLE units (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

-- Từ vựng (bản chụp từ Google Sheet)
CREATE TABLE words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  word_key TEXT NOT NULL,
  word TEXT NOT NULL,
  meaning TEXT NOT NULL,
  example TEXT,
  extra TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

-- Tiến trình ôn tập SM-2 (theo word_key, không mất khi sửa Sheet)
CREATE TABLE word_progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_key TEXT NOT NULL,
  ef REAL NOT NULL DEFAULT 2.5,
  reps INTEGER NOT NULL DEFAULT 0,
  iv INTEGER NOT NULL DEFAULT 0,
  due TEXT,
  mastery INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  hint_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, word_key)
);

-- Lịch sử các lượt học từ vựng
CREATE TABLE study_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode INTEGER NOT NULL,
  unit_scope TEXT,                -- JSON danh sách unit
  score INTEGER NOT NULL DEFAULT 0,
  results TEXT,                   -- JSON kết quả từng từ
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Bài nghe chép (bản chụp văn bản gốc)
CREATE TABLE dictation_lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  doc_source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  audio_source_id INTEGER REFERENCES sources(id) ON DELETE SET NULL,
  original_text TEXT NOT NULL,
  timestamps TEXT,                -- JSON mốc [mm:ss] nếu có
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Lịch sử các lần làm nghe chép
CREATE TABLE dictation_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES dictation_lessons(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  typed_text TEXT NOT NULL,
  word_results TEXT,              -- JSON kết quả từng từ
  listen_pct REAL,
  type_pct REAL,
  score REAL,
  listen_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Chuỗi ngày học
CREATE TABLE streaks (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_study_date TEXT,
  current_streak INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0
);

-- Cài đặt cá nhân
CREATE TABLE settings (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL DEFAULT '{}'
);

-- Chỉ mục giúp truy vấn nhanh
CREATE INDEX idx_books_user ON books(user_id);
CREATE INDEX idx_units_book ON units(book_id);
CREATE INDEX idx_words_unit ON words(unit_id);
CREATE INDEX idx_words_key ON words(word_key);
CREATE INDEX idx_progress_due ON word_progress(user_id, due);
CREATE INDEX idx_sessions_user ON study_sessions(user_id, created_at);
CREATE INDEX idx_attempts_lesson ON dictation_attempts(lesson_id, created_at);