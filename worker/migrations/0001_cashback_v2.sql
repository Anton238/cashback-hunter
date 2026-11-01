-- Apply once to the existing database, after taking a backup.
ALTER TABLE banks ADD COLUMN selection_limit INTEGER NOT NULL DEFAULT 3;
ALTER TABLE cashback_entries ADD COLUMN notes TEXT NOT NULL DEFAULT '';
