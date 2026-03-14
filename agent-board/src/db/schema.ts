import type Database from 'better-sqlite3';

export function initSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id                  TEXT PRIMARY KEY,
      title               TEXT NOT NULL,
      description         TEXT NOT NULL DEFAULT '',
      technical_spec      TEXT NOT NULL DEFAULT '',
      acceptance_criteria TEXT NOT NULL DEFAULT '',
      priority            TEXT NOT NULL DEFAULT 'medium'
                          CHECK(priority IN ('critical','high','medium','low')),
      state               TEXT NOT NULL DEFAULT 'backlog'
                          CHECK(state IN (
                            'backlog','todo','in_progress','agent_review',
                            'changes_requested','human_review','done'
                          )),
      assigned_to         TEXT,
      created_by          TEXT NOT NULL,
      created_at          TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at        TEXT
    );

    CREATE TABLE IF NOT EXISTS comments (
      id            TEXT PRIMARY KEY,
      story_id      TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
      author        TEXT NOT NULL,
      content       TEXT NOT NULL,
      comment_type  TEXT NOT NULL DEFAULT 'comment'
                    CHECK(comment_type IN (
                      'comment','review_approve','review_reject',
                      'change_request','status_change','submission'
                    )),
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id            TEXT PRIMARY KEY,
      story_id      TEXT REFERENCES stories(id) ON DELETE CASCADE,
      actor         TEXT NOT NULL,
      action        TEXT NOT NULL,
      details       TEXT NOT NULL DEFAULT '',
      created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_stories_state ON stories(state);
    CREATE INDEX IF NOT EXISTS idx_stories_assigned ON stories(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_stories_priority ON stories(priority);
    CREATE INDEX IF NOT EXISTS idx_comments_story ON comments(story_id);
    CREATE INDEX IF NOT EXISTS idx_activity_story ON activity_log(story_id);
    CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
  `);
}
