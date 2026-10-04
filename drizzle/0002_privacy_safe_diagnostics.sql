CREATE TABLE IF NOT EXISTS diagnostic_events (
 seq INTEGER PRIMARY KEY AUTOINCREMENT,
 event_id TEXT NOT NULL UNIQUE,
 diagnostic_id TEXT NOT NULL,
 correlation_id TEXT NOT NULL,
 request_id TEXT,
 session_id TEXT,
 question_id TEXT,
 answer_id TEXT,
 analysis_id TEXT,
 provider_attempt_id TEXT,
 route TEXT NOT NULL,
 stage TEXT NOT NULL,
 status TEXT NOT NULL,
 operation TEXT,
 state_version INTEGER,
 content_revision INTEGER,
 media_generation INTEGER,
 retry_count INTEGER NOT NULL DEFAULT 0,
 duration_ms INTEGER,
 started_at TEXT,
 ended_at TEXT,
 http_status INTEGER,
 provider_request_id TEXT,
 provider_error_code TEXT,
 error_category TEXT,
 error_code TEXT,
 error_name TEXT,
 failure_phase TEXT,
 network_code TEXT,
 message TEXT,
 build_version TEXT,
 readiness_json TEXT NOT NULL DEFAULT '{}',
 created_at TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS diagnostic_event_sources (
 event_id TEXT NOT NULL REFERENCES diagnostic_events(event_id) ON DELETE CASCADE,
 session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 PRIMARY KEY(event_id,session_id)
);
CREATE INDEX IF NOT EXISTS diagnostic_correlation_seq ON diagnostic_events(correlation_id,seq);
CREATE INDEX IF NOT EXISTS diagnostic_id_seq ON diagnostic_events(diagnostic_id,seq);
CREATE INDEX IF NOT EXISTS diagnostic_expiry ON diagnostic_events(expires_at);
CREATE INDEX IF NOT EXISTS diagnostic_failure_seq ON diagnostic_events(error_code,seq);
CREATE INDEX IF NOT EXISTS diagnostic_source_session ON diagnostic_event_sources(session_id,event_id);
-- The app withdraws/cleans sessions using a soft status update. Clear all related
-- events (including multi-session analysis) in that same DB transaction.
CREATE TRIGGER IF NOT EXISTS diagnostic_session_unavailable
AFTER UPDATE OF status ON sessions
WHEN NEW.status IN ('withdrawn','expired')
BEGIN
 DELETE FROM diagnostic_events WHERE event_id IN
  (SELECT event_id FROM diagnostic_event_sources WHERE session_id=NEW.id)
  OR session_id=NEW.id;
END;
CREATE TRIGGER IF NOT EXISTS diagnostic_session_delete
BEFORE DELETE ON sessions
BEGIN
 DELETE FROM diagnostic_events WHERE event_id IN
  (SELECT event_id FROM diagnostic_event_sources WHERE session_id=OLD.id)
  OR session_id=OLD.id;
END;
-- Explicit cleanup also works when a D1 connection does not enable foreign keys.
CREATE TRIGGER IF NOT EXISTS diagnostic_event_delete
AFTER DELETE ON diagnostic_events
BEGIN
 DELETE FROM diagnostic_event_sources WHERE event_id=OLD.event_id;
END;
