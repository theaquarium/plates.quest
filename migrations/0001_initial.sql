PRAGMA foreign_keys = ON;

CREATE TABLE trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_edited_at INTEGER NOT NULL,
  name_edited_by TEXT NOT NULL,
  regions TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE trip_plates (
  trip_id TEXT NOT NULL,
  plate_id TEXT NOT NULL,
  checked INTEGER NOT NULL DEFAULT 0 CHECK (checked IN (0, 1)),
  version INTEGER NOT NULL DEFAULT 0,
  edited_at INTEGER NOT NULL DEFAULT 0,
  edited_by TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (trip_id, plate_id),
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE mutations (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  applied INTEGER NOT NULL DEFAULT 0 CHECK (applied IN (0, 1)),
  created_at INTEGER NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX mutations_trip_id ON mutations(trip_id);
