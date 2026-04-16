import { Client } from "pg";
import { getPoolConfig, isPersistenceEnabled } from "./db/index.js";
async function run() {
    if (!isPersistenceEnabled()) {
        console.log("PostgreSQL is not configured (DATABASE_URL or PGHOST+PGDATABASE). Skip migration.");
        return;
    }
    const cfg = getPoolConfig();
    const client = new Client("connectionString" in cfg && cfg.connectionString
        ? { connectionString: cfg.connectionString }
        : {
            user: cfg.user,
            password: cfg.password,
            host: cfg.host,
            port: cfg.port,
            database: cfg.database,
        });
    await client.connect();
    await client.query(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      member_code TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      team TEXT NOT NULL,
      status TEXT NOT NULL,
      deleted_at TIMESTAMPTZ NULL
    );
  `);
    await client.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      project_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      owner_member_id TEXT NULL REFERENCES members (id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      description TEXT NULL,
      category TEXT NULL,
      deleted_at TIMESTAMPTZ NULL
    );
  `);
    await client.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      task_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects (id) ON DELETE RESTRICT,
      assignee_member_id TEXT NOT NULL REFERENCES members (id) ON DELETE RESTRICT,
      due_date DATE NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      planned_start_date DATE NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      completed_at DATE NULL,
      deleted_at TIMESTAMPTZ NULL
    );
  `);
    await client.query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      member_id TEXT NOT NULL UNIQUE REFERENCES members (id) ON DELETE CASCADE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
      password_changed_at TIMESTAMPTZ NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ NULL
    );
  `);
    await client.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE;`);
    await client.query(`ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMPTZ NULL;`);
    await client.query(`
    UPDATE auth_users
    SET must_change_password = TRUE
    WHERE password_changed_at IS NULL
      AND must_change_password = FALSE;
  `);
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;`);
    await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS category TEXT;`);
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS planned_start_date DATE;`);
    await client.query(`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INTEGER NOT NULL DEFAULT 0;`);
    await client.query(`ALTER TABLE projects ALTER COLUMN owner_member_id DROP NOT NULL;`);
    await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id) WHERE deleted_at IS NULL;
  `);
    await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks (assignee_member_id) WHERE deleted_at IS NULL;
  `);
    await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status_due ON tasks (status, due_date) WHERE deleted_at IS NULL;
  `);
    await client.query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_filters ON tasks (project_id, assignee_member_id, status, due_date)
      WHERE deleted_at IS NULL;
  `);
    await client.query(`
    CREATE INDEX IF NOT EXISTS idx_auth_users_email_lower
      ON auth_users (lower(email))
      WHERE deleted_at IS NULL;
  `);
    await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_project_id_fkey') THEN
        ALTER TABLE tasks
          ADD CONSTRAINT tasks_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE RESTRICT;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'tasks_project_id_fkey: %', SQLERRM;
    END $$;
  `);
    await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_assignee_member_id_fkey') THEN
        ALTER TABLE tasks
          ADD CONSTRAINT tasks_assignee_member_id_fkey
          FOREIGN KEY (assignee_member_id) REFERENCES members (id) ON DELETE RESTRICT;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'tasks_assignee_member_id_fkey: %', SQLERRM;
    END $$;
  `);
    await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'projects_owner_member_id_fkey') THEN
        ALTER TABLE projects
          ADD CONSTRAINT projects_owner_member_id_fkey
          FOREIGN KEY (owner_member_id) REFERENCES members (id) ON DELETE SET NULL;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'projects_owner_member_id_fkey: %', SQLERRM;
    END $$;
  `);
    await client.end();
    console.log("DB_MIGRATION=PASS");
}
void run();
