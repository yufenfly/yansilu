ALTER TABLE permanent_note_meta ADD COLUMN starting_question TEXT;
ALTER TABLE permanent_note_meta ADD COLUMN viewpoint_history_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE permanent_note_meta ADD COLUMN pending_viewpoint_revision_json TEXT NOT NULL DEFAULT 'null';
