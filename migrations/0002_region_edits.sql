ALTER TABLE trips ADD COLUMN regions_edited_at INTEGER NOT NULL DEFAULT 0;
ALTER TABLE trips ADD COLUMN regions_edited_by TEXT NOT NULL DEFAULT '';

UPDATE trips
SET regions_edited_at = created_at,
    regions_edited_by = name_edited_by
WHERE regions_edited_at = 0;
