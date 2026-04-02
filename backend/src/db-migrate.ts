import { Client } from "pg";

async function run(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.log("DATABASE_URL is not set. Skip migration.");
    return;
  }
  const client = new Client({ connectionString });
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
      owner_member_id TEXT NOT NULL,
      status TEXT NOT NULL,
      deleted_at TIMESTAMPTZ NULL
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      task_code TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      project_id TEXT NOT NULL,
      assignee_member_id TEXT NOT NULL,
      due_date DATE NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      completed_at DATE NULL,
      deleted_at TIMESTAMPTZ NULL
    );
  `);
  await client.query(`CREATE INDEX IF NOT EXISTS idx_tasks_filters ON tasks(project_id, assignee_member_id, status, due_date);`);
  await client.end();
  console.log("DB_MIGRATION=PASS");
}

void run();
