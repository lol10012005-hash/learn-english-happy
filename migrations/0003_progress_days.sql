-- Migration number: 0003 	 2026-10-24T14:31:46.108Z
-- Thống kê theo ngày (dùng cho lịch chuỗi ngày và biểu đồ)
CREATE TABLE study_days (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,                       -- YYYY-MM-DD theo giờ địa phương của người học
  sessions INTEGER NOT NULL DEFAULT 0,
  words INTEGER NOT NULL DEFAULT 0,
  good INTEGER NOT NULL DEFAULT 0,         -- số lượt từ "Đã thuộc"
  mid INTEGER NOT NULL DEFAULT 0,          -- số lượt từ "Chưa thuộc"
  bad INTEGER NOT NULL DEFAULT 0,          -- số lượt từ "Không thuộc"
  score INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

ALTER TABLE study_sessions ADD COLUMN words INTEGER NOT NULL DEFAULT 0;