import { performance } from "node:perf_hooks";
import { spawn } from "node:child_process";

const base = "http://localhost:4000";

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitHealth(timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return;
    } catch {
      // retry
    }
    await wait(250);
  }
  throw new Error("Server not healthy");
}

function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? 0;
}

async function benchEndpoint(path: string, count: number): Promise<number> {
  const timings: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = performance.now();
    const res = await fetch(`${base}${path}`);
    await res.text();
    timings.push(performance.now() - start);
  }
  return p95(timings);
}

async function run(): Promise<void> {
  const proc = spawn(process.execPath, ["dist/backend/src/server.js"], { stdio: "ignore" });
  try {
    await waitHealth(10000);
    const tasksP95 = await benchEndpoint("/tasks", 40);
    const dashboardP95 = await benchEndpoint("/analytics/dashboard", 40);

    const exportStart = performance.now();
    await fetch(`${base}/reports/monthly/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-role": "lead" },
      body: JSON.stringify({ periodStart: "2026-01-01", periodEnd: "2026-12-31" }),
    });
    const exportElapsed = performance.now() - exportStart;

    console.log(`PERF_TASKS_P95_MS=${tasksP95.toFixed(2)}`);
    console.log(`PERF_DASHBOARD_P95_MS=${dashboardP95.toFixed(2)}`);
    console.log(`PERF_EXPORT_MS=${exportElapsed.toFixed(2)}`);
  } finally {
    proc.kill("SIGTERM");
  }
}

void run();
