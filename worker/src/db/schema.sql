CREATE TABLE IF NOT EXISTS banks (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  updated_at TEXT,
  selection_limit INTEGER NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS category_synonyms (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  synonym     TEXT NOT NULL,
  UNIQUE(category_id, synonym)
);

CREATE TABLE IF NOT EXISTS cashback_entries (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  bank_id         INTEGER NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  category_id     INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  percentage      REAL NOT NULL,
  month           INTEGER NOT NULL,
  year            INTEGER NOT NULL,
  photo_local_key TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at      TEXT DEFAULT (datetime('now')),
  offer_name TEXT NOT NULL DEFAULT '',
  UNIQUE(bank_id, category_id, month, year, offer_name)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint  TEXT NOT NULL UNIQUE,
  p256dh    TEXT NOT NULL,
  auth      TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS category_corrections (
  bank_id INTEGER NOT NULL REFERENCES banks(id) ON DELETE CASCADE,
  offer_key TEXT NOT NULL,
  offer_name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(bank_id, offer_key)
);

CREATE TABLE IF NOT EXISTS display_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bank_ids TEXT NOT NULL DEFAULT '[]',
  category_ids TEXT NOT NULL DEFAULT '[]'
);
