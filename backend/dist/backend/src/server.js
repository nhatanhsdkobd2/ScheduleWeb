import "./db/index.js";
import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { unlink } from "node:fs/promises";
import { z } from "zod";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { addAuditLog, auditLogs, createMember, createProject, createReportRecord, createTask, findMemberById, findProjectById, findTaskById, getDashboardSummary, getDelayTrend, getMembersForRead, getMonthlyReportRows, getPerformance, getPerformanceByPeriod, getProjectsForRead, getTasks, loadOrInitializePersistence, softDeleteProject, getStatusDistribution, getWeeklyReportRows, projectMembers, removeMemberFromProject, reportHistory, assignMemberToProject, softDeleteMember, taskHistory, updateMember, updateProject, updateReportRecord, updateTask, } from "./data.js";
import { isPersistenceEnabled } from "./db/index.js";
import { nextTaskCodeFromDb } from "./db/task-store.js";
import { generateExcelReport, generatePdfReport } from "./report-generator.js";
import { attachSocketIo, emitEntityUpdated } from "./realtime.js";
const EXPORT_DIR = path.resolve(process.cwd(), "exports");
const idempotencyCache = new Map();
/**
 * CORS: mặc định cho phép mọi origin (`origin: true` = echo header Origin).
 * Đặt ALLOWED_ORIGIN=https://mot-domain.com để chỉ cho phép một origin (không thêm / cuối).
 * ALLOWED_ORIGIN=* giữ hành vi “mọi domain” (giống không set).
 */
function normalizeOrigin(url) {
    return url.replace(/\/+$/, "");
}
const rawOrigin = process.env.ALLOWED_ORIGIN?.trim();
const explicitOrigin = rawOrigin && rawOrigin !== "*" ? normalizeOrigin(rawOrigin) : undefined;
const corsOrigin = explicitOrigin ?? true;
const app = express();
// Trust proxy so express-rate-limit can read X-Forwarded-For header
app.set("trust proxy", 1);
app.use(cors({
    origin: corsOrigin,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "x-role", "X-Role", "Idempotency-Key"],
    optionsSuccessStatus: 204,
}));
app.use(express.json());
// API JSON: tắt CSP; tắt COOP/COEP mặc định (dễ gây lỗi “CORS” trên fetch cross-origin); CORP = cross-origin.
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
}));
function requireRoles(allowed) {
    return (req, res, next) => {
        const role = (req.header("x-role") ?? "member");
        if (!allowed.includes(role)) {
            res.status(403).json({ error: "Forbidden" });
            return;
        }
        next();
    };
}
function getRequiredParam(req, key) {
    const value = req.params[key];
    if (typeof value !== "string" || value.length === 0) {
        return undefined;
    }
    return value;
}
async function executeWithRetry(task, maxAttempts = 3) {
    let attempt = 0;
    let lastError = new Error("Unknown retry error");
    while (attempt < maxAttempts) {
        try {
            return await task();
        }
        catch (error) {
            lastError = error;
            attempt += 1;
            if (attempt >= maxAttempts)
                break;
            await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
        }
    }
    throw lastError;
}
async function cleanupOldReports(retentionDays) {
    const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    let deletedReports = 0;
    let deletedFiles = 0;
    for (let i = reportHistory.length - 1; i >= 0; i -= 1) {
        const item = reportHistory[i];
        if (!item)
            continue;
        if (new Date(item.createdAt).getTime() < threshold) {
            if (item.filePath) {
                try {
                    await unlink(item.filePath);
                    deletedFiles += 1;
                }
                catch {
                    // Ignore missing file.
                }
            }
            reportHistory.splice(i, 1);
            deletedReports += 1;
        }
    }
    return { deletedReports, deletedFiles };
}
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
const memberCreateSchema = z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    role: z.enum(["admin", "pm", "lead", "member"]),
    team: z.string().min(1),
    status: z.enum(["active", "inactive"]).default("active"),
});
app.post("/members", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
    const parsed = memberCreateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const memberList = await getMembersForRead();
    const duplicated = memberList.some((member) => member.email.toLowerCase() === parsed.data.email.toLowerCase());
    if (duplicated)
        return res.status(409).json({ error: "Duplicate email" });
    // Auto-generate memberCode: MEM-NNN (max current + 1)
    const allCodes = memberList.map((m) => m.memberCode).filter((c) => c.startsWith("MEM-"));
    const nums = allCodes.map((c) => parseInt(c.replace("MEM-", ""), 10)).filter((n) => !isNaN(n));
    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
    const newCode = `MEM-${String(maxNum + 1).padStart(3, "0")}`;
    const member = await createMember({ ...parsed.data, memberCode: newCode });
    emitEntityUpdated({ type: "members" });
    return res.status(201).json(member);
});
app.get("/members", async (_req, res) => {
    res.json(await getMembersForRead());
});
const memberPatchSchema = memberCreateSchema.partial();
app.patch("/members/:id", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
    const memberId = getRequiredParam(req, "id");
    if (!memberId)
        return res.status(400).json({ error: "Invalid member id" });
    const parsed = memberPatchSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const updated = await updateMember(memberId, parsed.data);
    if (!updated)
        return res.status(404).json({ error: "Member not found" });
    emitEntityUpdated({ type: "members" });
    return res.json(updated);
});
app.delete("/members/:id", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
    const memberId = getRequiredParam(req, "id");
    if (!memberId)
        return res.status(400).json({ error: "Invalid member id" });
    const deleted = await softDeleteMember(memberId);
    if (!deleted)
        return res.status(404).json({ error: "Member not found" });
    emitEntityUpdated({ type: "members" });
    return res.json({ status: "deleted", member: deleted });
});
const projectCreateSchema = z.object({
    name: z.string().min(2),
    ownerMemberId: z.string().optional(),
    status: z.enum(["planning", "active", "on_hold", "completed", "canceled"]).default("active"),
});
app.post("/projects", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
    const parsed = projectCreateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    if (parsed.data.ownerMemberId && !(await findMemberById(parsed.data.ownerMemberId))) {
        return res.status(400).json({ error: "ownerMemberId invalid" });
    }
    // Auto-generate projectCode: PROJ-NNN (max current + 1)
    const projectList = await getProjectsForRead();
    const allCodes = projectList.map((p) => p.projectCode).filter((c) => c.startsWith("PROJ-"));
    const nums = allCodes.map((c) => parseInt(c.replace("PROJ-", ""), 10)).filter((n) => !isNaN(n));
    const maxNum = nums.length > 0 ? Math.max(...nums) : 0;
    const newCode = `PROJ-${String(maxNum + 1).padStart(3, "0")}`;
    const project = await createProject({ ...parsed.data, projectCode: newCode });
    emitEntityUpdated({ type: "projects" });
    return res.status(201).json(project);
});
app.get("/projects", async (_req, res) => {
    res.json(await getProjectsForRead());
});
const projectPatchSchema = projectCreateSchema.partial();
app.patch("/projects/:id", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
    const projectId = getRequiredParam(req, "id");
    if (!projectId)
        return res.status(400).json({ error: "Invalid project id" });
    const parsed = projectPatchSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    if (parsed.data.ownerMemberId && !(await findMemberById(parsed.data.ownerMemberId))) {
        return res.status(400).json({ error: "ownerMemberId invalid" });
    }
    const updated = await updateProject(projectId, parsed.data);
    if (!updated)
        return res.status(404).json({ error: "Project not found" });
    emitEntityUpdated({ type: "projects" });
    return res.json(updated);
});
app.delete("/projects/:id", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
    const projectId = getRequiredParam(req, "id");
    if (!projectId)
        return res.status(400).json({ error: "Invalid project id" });
    const deleted = await softDeleteProject(projectId);
    if (!deleted)
        return res.status(404).json({ error: "Project not found" });
    emitEntityUpdated({ type: "projects" });
    return res.json({ status: "deleted", project: deleted });
});
const projectMemberSchema = z.object({
    memberId: z.string(),
    assignmentRole: z.enum(["owner", "lead", "contributor"]).default("contributor"),
    allocationPercent: z.number().int().min(0).max(100).default(100),
});
app.get("/projects/:id/members", (req, res) => {
    const projectId = getRequiredParam(req, "id");
    if (!projectId)
        return res.status(400).json({ error: "Invalid project id" });
    res.json(projectMembers.filter((item) => item.projectId === projectId));
});
app.post("/projects/:id/members", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
    const projectId = getRequiredParam(req, "id");
    if (!projectId)
        return res.status(400).json({ error: "Invalid project id" });
    const parsed = projectMemberSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const project = await findProjectById(projectId);
    if (!project)
        return res.status(404).json({ error: "Project not found" });
    if (!(await findMemberById(parsed.data.memberId)))
        return res.status(400).json({ error: "memberId invalid" });
    const assignment = assignMemberToProject({
        projectId,
        memberId: parsed.data.memberId,
        assignmentRole: parsed.data.assignmentRole,
        allocationPercent: parsed.data.allocationPercent,
    });
    emitEntityUpdated({ type: "projects" });
    return res.status(201).json(assignment);
});
app.delete("/projects/:id/members/:memberId", requireRoles(["admin", "pm", "lead"]), (req, res) => {
    const projectId = getRequiredParam(req, "id");
    const memberId = getRequiredParam(req, "memberId");
    if (!projectId || !memberId)
        return res.status(400).json({ error: "Invalid params" });
    const removed = removeMemberFromProject(projectId, memberId);
    if (!removed)
        return res.status(404).json({ error: "Assignment not found" });
    emitEntityUpdated({ type: "projects" });
    return res.json({ status: "removed" });
});
const taskCreateSchema = z.object({
    title: z.string().min(3),
    projectId: z.string(),
    assigneeMemberId: z.string(),
    dueDate: z.string(),
    priority: z.enum(["low", "medium", "high", "critical"]),
    plannedStartDate: z.string().optional(),
});
app.post("/tasks", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
    const parsed = taskCreateSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    if (!(await findProjectById(parsed.data.projectId)))
        return res.status(400).json({ error: "projectId invalid" });
    if (!(await findMemberById(parsed.data.assigneeMemberId)))
        return res.status(400).json({ error: "assigneeMemberId invalid" });
    if (new Date(parsed.data.dueDate).getTime() < Date.now() - 3650 * 24 * 60 * 60 * 1000) {
        return res.status(400).json({ error: "dueDate invalid" });
    }
    let taskCode;
    if (isPersistenceEnabled()) {
        taskCode = await nextTaskCodeFromDb();
    }
    else {
        const existingCodes = (await getTasks({})).items.map((t) => t.taskCode);
        let nextNum = 1;
        for (const code of existingCodes) {
            const match = /^TSK-(\d+)$/.exec(code);
            if (match) {
                const num = Number.parseInt(match[1] ?? "0", 10);
                if (num >= nextNum)
                    nextNum = num + 1;
            }
        }
        taskCode = `TSK-${String(nextNum).padStart(3, "0")}`;
    }
    const task = await createTask({ taskCode, ...parsed.data });
    emitEntityUpdated({ type: "tasks", taskIds: [task.id] });
    return res.status(201).json(task);
});
app.get("/tasks", async (_req, res) => {
    const projectId = typeof _req.query.projectId === "string" ? _req.query.projectId : undefined;
    const memberId = typeof _req.query.memberId === "string" ? _req.query.memberId : undefined;
    const status = typeof _req.query.status === "string" ? _req.query.status : undefined;
    const search = typeof _req.query.search === "string" ? _req.query.search : undefined;
    const dateFrom = typeof _req.query.dateFrom === "string" ? _req.query.dateFrom : undefined;
    const dateTo = typeof _req.query.dateTo === "string" ? _req.query.dateTo : undefined;
    const limitRaw = _req.query.limit;
    const offsetRaw = _req.query.offset;
    const limit = limitRaw !== undefined ? Math.min(500, Math.max(1, Number.parseInt(String(limitRaw), 10) || 80)) : 80;
    const offset = offsetRaw !== undefined ? Math.max(0, Number.parseInt(String(offsetRaw), 10) || 0) : 0;
    const page = await getTasks({ projectId, memberId, status, search, dateFrom, dateTo }, { limit, offset });
    res.json(page);
});
const taskPatchSchema = z
    .object({
    title: z.string().min(3).optional(),
    assigneeMemberId: z.string().optional(),
    dueDate: z.string().optional(),
    plannedStartDate: z.string().optional(),
    progress: z.number().int().min(0).max(100).optional(),
    status: z.enum(["todo", "in_progress", "blocked", "done", "canceled"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    completedAt: z.string().optional(),
})
    .strict();
app.patch("/tasks/:id", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
    const taskId = getRequiredParam(req, "id");
    if (!taskId)
        return res.status(400).json({ error: "Invalid task id" });
    const parsed = taskPatchSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const current = await findTaskById(taskId);
    if (!current)
        return res.status(404).json({ error: "Task not found" });
    if (parsed.data.assigneeMemberId && !(await findMemberById(parsed.data.assigneeMemberId))) {
        return res.status(400).json({ error: "assigneeMemberId invalid" });
    }
    if (parsed.data.dueDate && new Date(parsed.data.dueDate).toString() === "Invalid Date") {
        return res.status(400).json({ error: "dueDate invalid" });
    }
    // Progress logic: when progress reaches 100, mark as done
    const incoming = parsed.data;
    const patchData = { ...incoming };
    if (incoming.progress !== undefined) {
        if (incoming.progress === 100) {
            patchData.completedAt = new Date().toISOString().slice(0, 10);
            patchData.status = "done";
        }
        else if (current.status === "done" || current.completedAt) {
            patchData.completedAt = undefined;
            patchData.status = "in_progress";
        }
    }
    const updated = await updateTask(taskId, patchData);
    if (!updated)
        return res.status(500).json({ error: "Task update failed" });
    emitEntityUpdated({ type: "tasks", taskIds: [updated.id] });
    return res.json(updated);
});
app.get("/tasks/:id/history", (req, res) => {
    const taskId = getRequiredParam(req, "id");
    if (!taskId)
        return res.status(400).json({ error: "Invalid task id" });
    res.json(taskHistory.filter((item) => item.taskId === taskId));
});
app.get("/analytics/dashboard", async (_req, res) => {
    res.json({
        summary: await getDashboardSummary(),
        statusDistribution: await getStatusDistribution(),
        delayTrend: await getDelayTrend(),
        performance: await getPerformance(),
    });
});
app.get("/analytics/performance", async (req, res) => {
    const periodType = req.query.periodType ?? "month";
    const periodKey = req.query.periodKey ?? "2026-03";
    res.json(await getPerformanceByPeriod(periodType, periodKey));
});
app.get("/analytics/delay-trend", async (_req, res) => {
    res.json(await getDelayTrend());
});
app.get("/analytics/tasks-drilldown", async (_req, res) => {
    const { items: taskList } = await getTasks({});
    const data = taskList.map((task) => ({
        id: task.id,
        taskCode: task.taskCode,
        title: task.title,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate,
        assigneeMemberId: task.assigneeMemberId,
    }));
    res.json(data);
});
app.get("/reports/weekly", async (_req, res) => {
    res.json({
        generatedAt: new Date().toISOString(),
        rows: await getWeeklyReportRows(),
    });
});
app.get("/reports", (_req, res) => {
    res.json(reportHistory);
});
app.get("/reports/:id/status", (req, res) => {
    const reportId = getRequiredParam(req, "id");
    if (!reportId)
        return res.status(400).json({ error: "Invalid report id" });
    const report = reportHistory.find((item) => item.id === reportId);
    if (!report)
        return res.status(404).json({ error: "Report not found" });
    res.json(report);
});
app.get("/reports/:id/download", (req, res) => {
    const reportId = getRequiredParam(req, "id");
    if (!reportId)
        return res.status(400).json({ error: "Invalid report id" });
    const report = reportHistory.find((item) => item.id === reportId);
    if (!report || !report.filePath)
        return res.status(404).json({ error: "Report file not found" });
    return res.sendFile(report.filePath);
});
const reportExportSchema = z.object({
    periodStart: z.string(),
    periodEnd: z.string(),
});
app.post("/reports/weekly/export", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
    const parsed = reportExportSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const idemKey = req.header("Idempotency-Key");
    const cacheKey = idemKey ? `weekly:${idemKey}` : undefined;
    if (cacheKey && idempotencyCache.has(cacheKey)) {
        return res.json(idempotencyCache.get(cacheKey));
    }
    const excelReport = createReportRecord({
        reportType: "weekly",
        format: "xlsx",
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
    });
    const pdfReport = createReportRecord({
        reportType: "weekly",
        format: "pdf",
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
    });
    try {
        updateReportRecord(excelReport.id, { status: "running" });
        const excelPath = await executeWithRetry(async () => generateExcelReport("weekly", parsed.data.periodStart, parsed.data.periodEnd, await getWeeklyReportRows()));
        updateReportRecord(excelReport.id, { status: "success", filePath: excelPath, completedAt: new Date().toISOString() });
        updateReportRecord(pdfReport.id, { status: "running" });
        const pdfPath = await executeWithRetry(async () => generatePdfReport("weekly", parsed.data.periodStart, parsed.data.periodEnd, await getPerformance()));
        updateReportRecord(pdfReport.id, { status: "success", filePath: pdfPath, completedAt: new Date().toISOString() });
        addAuditLog({ action: "report.export.weekly", entityType: "report", entityId: excelReport.id, metadata: {} });
        const payload = { status: "success", reports: [excelReport.id, pdfReport.id], exportDir: EXPORT_DIR };
        if (cacheKey)
            idempotencyCache.set(cacheKey, payload);
        return res.json(payload);
    }
    catch (error) {
        updateReportRecord(excelReport.id, { status: "failed" });
        updateReportRecord(pdfReport.id, { status: "failed" });
        return res.status(500).json({ error: `Export failed: ${String(error)}` });
    }
});
app.post("/reports/monthly/export", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
    const parsed = reportExportSchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: parsed.error.flatten() });
    const idemKey = req.header("Idempotency-Key");
    const cacheKey = idemKey ? `monthly:${idemKey}` : undefined;
    if (cacheKey && idempotencyCache.has(cacheKey)) {
        return res.json(idempotencyCache.get(cacheKey));
    }
    const excelReport = createReportRecord({
        reportType: "monthly",
        format: "xlsx",
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
    });
    const pdfReport = createReportRecord({
        reportType: "monthly",
        format: "pdf",
        periodStart: parsed.data.periodStart,
        periodEnd: parsed.data.periodEnd,
    });
    try {
        updateReportRecord(excelReport.id, { status: "running" });
        const excelPath = await executeWithRetry(async () => generateExcelReport("monthly", parsed.data.periodStart, parsed.data.periodEnd, await getMonthlyReportRows()));
        updateReportRecord(excelReport.id, { status: "success", filePath: excelPath, completedAt: new Date().toISOString() });
        updateReportRecord(pdfReport.id, { status: "running" });
        const pdfPath = await executeWithRetry(async () => generatePdfReport("monthly", parsed.data.periodStart, parsed.data.periodEnd, await getPerformance()));
        updateReportRecord(pdfReport.id, { status: "success", filePath: pdfPath, completedAt: new Date().toISOString() });
        addAuditLog({ action: "report.export.monthly", entityType: "report", entityId: excelReport.id, metadata: {} });
        const payload = { status: "success", reports: [excelReport.id, pdfReport.id], exportDir: EXPORT_DIR };
        if (cacheKey)
            idempotencyCache.set(cacheKey, payload);
        return res.json(payload);
    }
    catch (error) {
        updateReportRecord(excelReport.id, { status: "failed" });
        updateReportRecord(pdfReport.id, { status: "failed" });
        return res.status(500).json({ error: `Export failed: ${String(error)}` });
    }
});
app.get("/audit-logs", (_req, res) => {
    res.json(auditLogs.slice(0, 200));
});
app.post("/reports/cleanup", requireRoles(["admin"]), async (req, res) => {
    const retentionDays = Number(req.body.retentionDays ?? 7);
    const result = await cleanupOldReports(retentionDays);
    addAuditLog({
        action: "report.cleanup",
        entityType: "report",
        entityId: "bulk",
        metadata: { retentionDays: String(retentionDays), deletedReports: String(result.deletedReports) },
    });
    res.json(result);
});
app.use("/exports", express.static(EXPORT_DIR));
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";
const httpServer = createServer(app);
attachSocketIo(httpServer, corsOrigin);
async function start() {
    await loadOrInitializePersistence();
    httpServer.listen(port, host, () => {
        console.log(`Backend listening on http://${host}:${port}`);
    });
}
void start();
setInterval(() => {
    void cleanupOldReports(14);
}, 60 * 60 * 1000);
