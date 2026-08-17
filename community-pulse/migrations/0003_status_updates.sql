-- =========================================================
-- 0003  Status update emails
-- ---------------------------------------------------------
-- Enquiries previously tracked delivery inline (ack_status,
-- ack_error) because they only ever sent one automatic
-- message. Status updates can be sent repeatedly, so they
-- need a log rather than a single set of columns.
--
-- This mirrors `communications` rather than extending it:
-- that table has volunteer_id NOT NULL and already holds
-- production rows, and rebuilding a live table to relax a
-- constraint is a worse trade than a parallel table.
-- =========================================================

CREATE TABLE IF NOT EXISTS enquiry_communications (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id    INTEGER NOT NULL,
  type          TEXT NOT NULL,          -- STATUS_UPDATE | FUNDS_RECEIVED | ADMIN_EMAIL
  direction     TEXT NOT NULL DEFAULT 'OUTBOUND',
  to_address    TEXT NOT NULL,
  subject       TEXT,
  body_preview  TEXT,                   -- short excerpt only, not the full rendered email
  status        TEXT NOT NULL DEFAULT 'PENDING',
  provider_id   TEXT,
  error_message TEXT,
  attempts      INTEGER NOT NULL DEFAULT 0,
  created_by    TEXT,                   -- admin who triggered it; NULL if system
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  FOREIGN KEY (enquiry_id) REFERENCES enquiries(id) ON DELETE CASCADE,
  CHECK (status IN ('PENDING','SENT','FAILED','RETRIED'))
);

CREATE INDEX IF NOT EXISTS idx_enq_comms_enquiry ON enquiry_communications (enquiry_id, created_at);
CREATE INDEX IF NOT EXISTS idx_enq_comms_status  ON enquiry_communications (status);
