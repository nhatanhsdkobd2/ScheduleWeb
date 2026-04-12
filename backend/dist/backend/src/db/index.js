import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });
export function isPersistenceEnabled() {
    if (process.env.DATABASE_URL?.trim())
        return true;
    const host = process.env.PGHOST?.trim();
    const database = process.env.PGDATABASE?.trim();
    return Boolean(host && database);
}
export function getPoolConfig() {
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
let pool = null;
export function getPool() {
    if (!isPersistenceEnabled()) {
        throw new Error("PostgreSQL is not configured (set DATABASE_URL or PGHOST+PGDATABASE).");
    }
    if (!pool) {
        pool = new pg.Pool(getPoolConfig());
    }
    return pool;
}
export async function closePool() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
/**
 * Call once before accepting traffic in production. Without Postgres the API uses in-memory
 * data only — unsafe for real deployments — so we fail fast with an explicit log on Render.
 */
export function requireDatabaseInProduction() {
    if (process.env.NODE_ENV !== "production")
        return;
    if (isPersistenceEnabled())
        return;
    console.error("[FATAL] NODE_ENV=production but PostgreSQL is not configured.\n" +
        "Set DATABASE_URL (recommended on Render) or PGHOST + PGDATABASE (and PGUSER / PGPASSWORD if needed).\n" +
        "The server would otherwise run with in-memory-only data.");
    process.exit(1);
}
