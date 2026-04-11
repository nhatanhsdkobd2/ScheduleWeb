import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });

export function isPersistenceEnabled(): boolean {
  if (process.env.DATABASE_URL?.trim()) return true;
  const host = process.env.PGHOST?.trim();
  const database = process.env.PGDATABASE?.trim();
  return Boolean(host && database);
}

export function getPoolConfig(): pg.PoolConfig {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (connectionString) {
    return { connectionString };
  }
  return {
    user: process.env.PGUSER ?? "postgres",
    password: process.env.PGPASSWORD ?? "",
    host: process.env.PGHOST ?? "localhost",
    port: Number(process.env.PGPORT ?? 5432),
    database: process.env.PGDATABASE ?? "postgres",
  };
}

let pool: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (!isPersistenceEnabled()) {
    throw new Error("PostgreSQL is not configured (set DATABASE_URL or PGHOST+PGDATABASE).");
  }
  if (!pool) {
    pool = new pg.Pool(getPoolConfig());
  }
  return pool;
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
