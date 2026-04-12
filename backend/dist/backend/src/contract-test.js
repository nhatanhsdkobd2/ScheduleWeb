import assert from "node:assert";
import { spawn } from "node:child_process";
const base = "http://localhost:4000";
async function wait(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
}
async function waitHealth(timeoutMs) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        try {
            const res = await fetch(`${base}/health`);
            if (res.ok)
                return;
        }
        catch {
            // retry
        }
        await wait(250);
    }
    throw new Error("health timeout");
}
async function run() {
    const proc = spawn(process.execPath, ["dist/backend/src/server.js"], { stdio: "ignore" });
    try {
        await waitHealth(10000);
        const invalidMember = await fetch(`${base}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-role": "lead" },
            body: JSON.stringify({ memberCode: "M1" }),
        });
        assert.equal(invalidMember.status, 400);
        const invalidMemberBody = (await invalidMember.json());
        assert.ok(invalidMemberBody.error, "400 response should include error object");
        const forbidden = await fetch(`${base}/members`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-role": "member" },
            body: JSON.stringify({
                memberCode: "M003",
                fullName: "No Access",
                email: "no-access@example.com",
                role: "member",
                team: "Platform",
                status: "active",
            }),
        });
        assert.equal(forbidden.status, 403);
        const forbiddenBody = (await forbidden.json());
        assert.equal(typeof forbiddenBody.error, "string");
        const notFound = await fetch(`${base}/members/not-exists`, {
            method: "DELETE",
            headers: { "x-role": "lead" },
        });
        assert.equal(notFound.status, 404);
        const notFoundBody = (await notFound.json());
        assert.equal(typeof notFoundBody.error, "string");
        const filteredTasks = await fetch(`${base}/tasks?memberId=m-1&status=done&limit=200`, {
            method: "GET",
        });
        assert.equal(filteredTasks.status, 200);
        const taskPayload = (await filteredTasks.json());
        const taskBody = taskPayload.items;
        assert.ok(taskBody.every((item) => item.assigneeMemberId === "m-1" && item.status === "done"));
        console.log("CONTRACT_TEST=PASS");
    }
    finally {
        proc.kill("SIGTERM");
    }
}
void run();
