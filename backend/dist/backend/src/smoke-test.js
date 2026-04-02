import { spawn } from "node:child_process";
import assert from "node:assert";
const baseUrl = "http://localhost:4000";
async function wait(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitForServer(timeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(`${baseUrl}/health`);
            if (res.ok)
                return;
        }
        catch {
            // keep polling
        }
        await wait(300);
    }
    throw new Error("Server did not become healthy in time");
}
async function run() {
    const proc = spawn(process.execPath, ["dist/backend/src/server.js"], { stdio: "ignore" });
    try {
        await waitForServer(10000);
        // Fetch seeded IDs from API
        const [membersData, projectsData] = await Promise.all([
            fetch(`${baseUrl}/members`).then((r) => r.json()),
            fetch(`${baseUrl}/projects`).then((r) => r.json()),
        ]);
        const firstMemberId = membersData[0]?.id;
        const secondMemberId = membersData[1]?.id;
        const firstProjectId = projectsData[0]?.id;
        assert.ok(firstMemberId, "No seeded members found");
        assert.ok(secondMemberId, "Need at least 2 seeded members");
        assert.ok(firstProjectId, "No seeded projects found");
        // Role-based check: member cannot mutate project members.
        const forbiddenRes = await fetch(`${baseUrl}/projects/${firstProjectId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-role": "member" },
            body: JSON.stringify({ memberId: secondMemberId, assignmentRole: "contributor", allocationPercent: 60 }),
        });
        assert.equal(forbiddenRes.status, 403);
        // Allowed role can assign.
        const assignRes = await fetch(`${baseUrl}/projects/${firstProjectId}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-role": "lead" },
            body: JSON.stringify({ memberId: secondMemberId, assignmentRole: "contributor", allocationPercent: 60 }),
        });
        assert.ok(assignRes.status === 200 || assignRes.status === 201);
        // Delete project — soft delete, member role forbidden.
        const deleteForbiddenRes = await fetch(`${baseUrl}/projects/${firstProjectId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", "x-role": "member" },
        });
        assert.equal(deleteForbiddenRes.status, 403);
        // Delete project — lead role allowed.
        const deleteRes = await fetch(`${baseUrl}/projects/${firstProjectId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json", "x-role": "lead" },
        });
        assert.ok(deleteRes.status === 200 || deleteRes.status === 201);
        // Task edge-case invalid assignee.
        const invalidTaskRes = await fetch(`${baseUrl}/tasks`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-role": "lead" },
            body: JSON.stringify({
                taskCode: "TSK-EDGE",
                title: "Invalid assignee check",
                projectId: firstProjectId,
                assigneeMemberId: "m-not-exists",
                dueDate: "2026-04-05",
                priority: "high",
            }),
        });
        assert.equal(invalidTaskRes.status, 400);
        // Retry/idempotency behavior should return same payload on duplicate key.
        const payload = { periodStart: "2026-03-01", periodEnd: "2026-03-31" };
        const firstExport = await fetch(`${baseUrl}/reports/monthly/export`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-role": "lead", "Idempotency-Key": "smoke-key-1" },
            body: JSON.stringify(payload),
        });
        assert.equal(firstExport.status, 200);
        const firstData = (await firstExport.json());
        const secondExport = await fetch(`${baseUrl}/reports/monthly/export`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-role": "lead", "Idempotency-Key": "smoke-key-1" },
            body: JSON.stringify(payload),
        });
        assert.equal(secondExport.status, 200);
        const secondData = (await secondExport.json());
        assert.deepEqual(secondData.reports, firstData.reports);
        // Cleanup endpoint admin-only
        const cleanupForbidden = await fetch(`${baseUrl}/reports/cleanup`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-role": "lead" },
            body: JSON.stringify({ retentionDays: 0 }),
        });
        assert.equal(cleanupForbidden.status, 403);
        const cleanupAllowed = await fetch(`${baseUrl}/reports/cleanup`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-role": "admin" },
            body: JSON.stringify({ retentionDays: 0 }),
        });
        assert.equal(cleanupAllowed.status, 200);
        console.log("SMOKE_TEST=PASS");
    }
    finally {
        proc.kill("SIGTERM");
    }
}
void run();
