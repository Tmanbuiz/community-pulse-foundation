-- =========================================================
-- 0004  Events, assignments and volunteer hours
-- ---------------------------------------------------------
-- Phase 2. Admins create events and assign volunteers from
-- the existing records; volunteers never log in. That was a
-- deliberate decision: self sign-up would require giving
-- volunteers credentials, and the value of it does not yet
-- justify holding another set of passwords for people whose
-- personal data we already hold.
--
-- Hours live on the assignment rather than in a table of
-- their own. Every hour is therefore attributable to a
-- specific volunteer at a specific event, which is what a
-- funder asks to see. The cost is that ad-hoc hours not tied
-- to an event cannot be recorded; if that turns out to matter,
-- the answer is a general-purpose event, not a second table
-- with its own rules.
-- =========================================================

CREATE TABLE IF NOT EXISTS events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  public_ref   TEXT UNIQUE,              -- CPF-EVT-2026-000001, used in emails
  title        TEXT NOT NULL,
  description  TEXT,
  location     TEXT,
  starts_at    TEXT NOT NULL,            -- ISO 8601 UTC
  ends_at      TEXT,                     -- NULL when the finish time is open
  capacity     INTEGER,                  -- NULL means no limit
  status       TEXT NOT NULL DEFAULT 'DRAFT',
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  archived_at  TEXT,
  CHECK (status IN ('DRAFT','SCHEDULED','COMPLETED','CANCELLED'))
);

CREATE INDEX IF NOT EXISTS idx_events_starts  ON events (starts_at);
CREATE INDEX IF NOT EXISTS idx_events_status  ON events (status);

-- One row per volunteer per event. The UNIQUE constraint is the
-- protection against double-booking somebody by accident, which is easy
-- to do when assigning several people at once.
CREATE TABLE IF NOT EXISTS event_assignments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id     INTEGER NOT NULL,
  volunteer_id INTEGER NOT NULL,
  role         TEXT,                     -- free text, e.g. "driver", "sorting"
  status       TEXT NOT NULL DEFAULT 'ASSIGNED',
  hours        REAL,                     -- recorded after the event
  notes        TEXT,
  notified_at  TEXT,                     -- when the volunteer was emailed
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (event_id, volunteer_id),
  FOREIGN KEY (event_id)     REFERENCES events(id)     ON DELETE CASCADE,
  FOREIGN KEY (volunteer_id) REFERENCES volunteers(id) ON DELETE CASCADE,
  CHECK (status IN ('ASSIGNED','CONFIRMED','ATTENDED','NO_SHOW','CANCELLED')),
  CHECK (hours IS NULL OR (hours >= 0 AND hours <= 24))
);

CREATE INDEX IF NOT EXISTS idx_assign_event     ON event_assignments (event_id);
CREATE INDEX IF NOT EXISTS idx_assign_volunteer ON event_assignments (volunteer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_assign_status    ON event_assignments (status);
