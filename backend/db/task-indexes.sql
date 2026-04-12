-- Optional: run manually against Postgres after deploy to speed up GET /tasks ordering and filters.
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction; use a maintenance window if needed.

CREATE INDEX IF NOT EXISTS idx_tasks_due_taskcode_active
  ON tasks (due_date ASC, task_code ASC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_project_deleted
  ON tasks (project_id, deleted_at)
  WHERE deleted_at IS NULL;
