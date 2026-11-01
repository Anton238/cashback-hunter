CREATE TABLE cashback_entries_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bank_id INTEGER NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  percentage REAL NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  photo_local_key TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT DEFAULT (datetime('now')),
  offer_name TEXT NOT NULL DEFAULT '',
  UNIQUE(bank_id, category_id, month, year, offer_name)
);
INSERT INTO cashback_entries_new (id, bank_id, category_id, percentage, month, year, photo_local_key, notes, created_at, offer_name)
SELECT id, bank_id, category_id, percentage, month, year, photo_local_key, notes, created_at, '' FROM cashback_entries;
DROP TABLE cashback_entries;
ALTER TABLE cashback_entries_new RENAME TO cashback_entries;
