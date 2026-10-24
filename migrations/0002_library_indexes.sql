ALTER TABLE books ADD COLUMN column_mapping TEXT;

CREATE UNIQUE INDEX idx_books_source_name ON books(source_id, name);
CREATE UNIQUE INDEX idx_units_book_name ON units(book_id, name);
CREATE UNIQUE INDEX idx_words_unit_key ON words(unit_id, word_key);-- Migration number: 0002 	 2026-10-24T08:05:12.993Z
