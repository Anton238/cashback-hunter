CREATE TABLE IF NOT EXISTS category_corrections (
  bank_id INTEGER NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  offer_key TEXT NOT NULL,
  offer_name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(bank_id, offer_key)
);
