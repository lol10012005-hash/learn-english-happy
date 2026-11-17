-- Migration number: 0004 	 2026-11-17T01:52:24.446Z
-- Quản lý thư viện: ẩn file hoặc quyển không học, nhớ các quyển đã xóa
ALTER TABLE sources ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sources ADD COLUMN excluded_tabs TEXT;      -- JSON: tên các tab đã xóa, đồng bộ lại sẽ bỏ qua
ALTER TABLE books ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;