import cors from "cors";
import express from "express";
import path from "node:path";
import { unlink } from "node:fs/promises";
import { z } from "zod";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import {
  addAuditLog,
  auditLogs,
  createMember,
  createProject,
  createReportRecord,
  createTask,
  findMemberById,
  findProjectById,
  findTaskById,
  getDashboardSummary,
  getDelayTrend,
  getMembersWithSeed,
  getMonthlyReportRows,
  getPerformance,
  getPerformanceByPeriod,
  getProjectsWithSeed,
  softDeleteProject,
  getStatusDistribution,
  getWeeklyReportRows,
  projectMembers,
  removeMemberFromProject,
  reportHistory,
  assignMemberToProject,
  softDeleteMember,
  taskHistory,
  tasks,
  updateMember,
  updateProject,
  updateReportRecord,
  updateTask,
} from "./data.js";
import { generateExcelReport, generatePdfReport } from "./report-generator.js";

const EXPORT_DIR = path.resolve(process.cwd(), "exports");
const idempotencyCache = new Map<string, { status: "success"; reports: string[]; exportDir: string }>();
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? "http://localhost:3000";

const app = express();
app.use(
  cors({
    origin: allowedOrigin,
  }),
);
app.use(express.json());
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
  }),
);

type UserRole = "admin" | "pm" | "lead" | "member";
function requireRoles(allowed: UserRole[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const role = (req.header("x-role") ?? "member") as UserRole;
    if (!allowed.includes(role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

function getRequiredParam(req: express.Request, key: string): string | undefined {
  const value = req.params[key];
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }
  return value;
}

async function executeWithRetry<T>(task: () => Promise<T>, maxAttempts = 3): Promise<T> {
  let attempt = 0;
  let lastError: unknown = new Error("Unknown retry error");
  while (attempt < maxAttempts) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      attempt += 1;
      if (attempt >= maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
    }
  }
  throw lastError;
}

async function cleanupOldReports(retentionDays: number): Promise<{ deletedReports: number; deletedFiles: number }> {
  const threshold = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  let deletedReports = 0;
  let deletedFiles = 0;
  for (let i = reportHistory.length - 1; i >= 0; i -= 1) {
    const item = reportHistory[i];
    if (!item) continue;
    if (new Date(item.createdAt).getTime() < threshold) {
      if (item.filePath) {
        try {
          await unlink(item.filePath);
          deletedFiles += 1;
        } catch {
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
  memberCode: z.string().min(3),
  fullName: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["admin", "pm", "lead", "member"]),
  team: z.string().min(1),
  status: z.enum(["active", "inactive"]).default("active"),
});

app.post("/members", requireRoles(["admin", "pm", "lead"]), (req, res) => {
  const parsed = memberCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const duplicated = getMembersWithSeed().some(
    (member) => member.email === parsed.data.email || member.memberCode === parsed.data.memberCode,
  );
  if (duplicated) return res.status(409).json({ error: "Duplicate member_code or email" });

  const member = createMember(parsed.data);
  return res.status(201).json(member);
});

app.get("/members", (_req, res) => {
  res.json(getMembersWithSeed());
});

const memberPatchSchema = memberCreateSchema.partial();
app.patch("/members/:id", requireRoles(["admin", "pm", "lead"]), (req, res) => {
  const memberId = getRequiredParam(req, "id");
  if (!memberId) return res.status(400).json({ error: "Invalid member id" });
  const parsed = memberPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const updated = updateMember(memberId, parsed.data);
  if (!updated) return res.status(404).json({ error: "Member not found" });
  return res.json(updated);
});

app.delete("/members/:id", requireRoles(["admin", "pm", "lead"]), (req, res) => {
  const memberId = getRequiredParam(req, "id");
  if (!memberId) return res.status(400).json({ error: "Invalid member id" });
  const deleted = softDeleteMember(memberId);
  if (!deleted) return res.status(404).json({ error: "Member not found" });
  return res.json({ status: "deleted", member: deleted });
});

const projectCreateSchema = z.object({
  projectCode: z.string().min(3),
  name: z.string().min(2),
  ownerMemberId: z.string().optional(),
  status: z.enum(["planning", "active", "on_hold", "completed", "canceled"]).default("active"),
});

app.post("/projects", requireRoles(["admin", "pm", "lead"]), (req, res) => {
  const parsed = projectCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.ownerMemberId && !findMemberById(parsed.data.ownerMemberId)) {
    return res.status(400).json({ error: "ownerMemberId invalid" });
  }
  const duplicated = getProjectsWithSeed().some((project) => project.projectCode === parsed.data.projectCode);
  if (duplicated) return res.status(409).json({ error: "Duplicate projectCode" });
  const project = createProject(parsed.data);
  return res.status(201).json(project);
});

app.get("/projects", (_req, res) => {
  res.json(getProjectsWithSeed());
});

const projectPatchSchema = projectCreateSchema.partial();
app.patch("/projects/:id", requireRoles(["admin", "pm", "lead"]), (req, res) => {
  const projectId = getRequiredParam(req, "id");
  if (!projectId) return res.status(400).json({ error: "Invalid project id" });
  const parsed = projectPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (parsed.data.ownerMemberId && !findMemberById(parsed.data.ownerMemberId)) {
    return res.status(400).json({ error: "ownerMemberId invalid" });
  }
  const updated = updateProject(projectId, parsed.data);
  if (!updated) return res.status(404).json({ error: "Project not found" });
  return res.json(updated);
});

app.delete("/projects/:id", requireRoles(["admin", "pm", "lead"]), (req, res) => {
  const projectId = getRequiredParam(req, "id");
  if (!projectId) return res.status(400).json({ error: "Invalid project id" });
  const deleted = softDeleteProject(projectId);
  if (!deleted) return res.status(404).json({ error: "Project not found" });
  return res.json({ status: "deleted", project: deleted });
});

const projectMemberSchema = z.object({
  memberId: z.string(),
  assignmentRole: z.enum(["owner", "lead", "contributor"]).default("contributor"),
  allocationPercent: z.number().int().min(0).max(100).default(100),
});

app.get("/projects/:id/members", (req, res) => {
  const projectId = getRequiredParam(req, "id");
  if (!projectId) return res.status(400).json({ error: "Invalid project id" });
  res.json(projectMembers.filter((item) => item.projectId === projectId));
});

app.post("/projects/:id/members", requireRoles(["admin", "pm", "lead"]), (req, res) => {
  const projectId = getRequiredParam(req, "id");
  if (!projectId) return res.status(400).json({ error: "Invalid project id" });
  const parsed = projectMemberSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const project = findProjectById(projectId);
  if (!project) return res.status(404).json({ error: "Project not found" });
  if (!findMemberById(parsed.data.memberId)) return res.status(400).json({ error: "memberId invalid" });
  const assignment = assignMemberToProject({
    projectId,
    memberId: parsed.data.memberId,
    assignmentRole: parsed.data.assignmentRole,
    allocationPercent: parsed.data.allocationPercent,
  });
  return res.status(201).json(assignment);
});

app.delete("/projects/:id/members/:memberId", requireRoles(["admin", "pm", "lead"]), (req, res) => {
  const projectId = getRequiredParam(req, "id");
  const memberId = getRequiredParam(req, "memberId");
  if (!projectId || !memberId) return res.status(400).json({ error: "Invalid params" });
  const removed = removeMemberFromProject(projectId, memberId);
  if (!removed) return res.status(404).json({ error: "Assignment not found" });
  return res.json({ status: "removed" });
});

const taskCreateSchema = z.object({
  taskCode: z.string().min(3),
  title: z.string().min(3),
  projectId: z.string(),
  assigneeMemberId: z.string(),
  dueDate: z.string(),
  priority: z.enum(["low", "medium", "high", "critical"]),
});

app.post("/tasks", requireRoles(["admin", "pm", "lead"]), (req, res) => {
  const parsed = taskCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  if (!findProjectById(parsed.data.projectId)) return res.status(400).json({ error: "projectId invalid" });
  if (!findMemberById(parsed.data.assigneeMemberId)) return res.status(400).json({ error: "assigneeMemberId invalid" });
  if (new Date(parsed.data.dueDate).getTime() < Date.now() - 3650 * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: "dueDate invalid" });
  }
  const task = createTask(parsed.data);
  return res.status(201).json(task);
});

app.get("/tasks", (_req, res) => {
  const projectId = typeof _req.query.projectId === "string" ? _req.query.projectId : undefined;
  const memberId = typeof _req.query.memberId === "string" ? _req.query.memberId : undefined;
  const status = typeof _req.query.status === "string" ? _req.query.status : undefined;
  const search = typeof _req.query.search === "string" ? _req.query.search.toLowerCase() : undefined;
  const dateFrom = typeof _req.query.dateFrom === "string" ? _req.query.dateFrom : undefined;
  const dateTo = typeof _req.query.dateTo === "string" ? _req.query.dateTo : undefined;

  const filtered = tasks
    .filter((item) => !item.deletedAt)
    .filter((item) => (projectId ? item.projectId === projectId : true))
    .filter((item) => (memberId ? item.assigneeMemberId === memberId : true))
    .filter((item) => (status ? item.status === status : true))
    .filter((item) => (search ? `${item.taskCode} ${item.title}`.toLowerCase().includes(search) : true))
    .filter((item) => (dateFrom ? item.dueDate >= dateFrom : true))
    .filter((item) => (dateTo ? item.dueDate <= dateTo : true));
  res.json(filtered);
});

const taskPatchSchema = z
  .object({
    title: z.string().min(3).optional(),
    assigneeMemberId: z.string().optional(),
    dueDate: z.string().optional(),
    status: z.enum(["todo", "in_progress", "blocked", "done", "canceled"]).optional(),
    priority: z.enum(["low", "medium", "high", "critical"]).optional(),
    completedAt: z.string().optional(),
  })
  .strict();

app.patch("/tasks/:id", requireRoles(["admin", "pm", "lead"]), (req, res) => {
  const taskId = getRequiredParam(req, "id");
  if (!taskId) return res.status(400).json({ error: "Invalid task id" });
  const parsed = taskPatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const current = findTaskById(taskId);
  if (!current) return res.status(404).json({ error: "Task not found" });
  if (parsed.data.assigneeMemberId && !findMemberById(parsed.data.assigneeMemberId)) {
    return res.status(400).json({ error: "assigneeMemberId invalid" });
  }
  if (parsed.data.dueDate && new Date(parsed.data.dueDate).toString() === "Invalid Date") {
    return res.status(400).json({ error: "dueDate invalid" });
  }
  const updated = updateTask(taskId, parsed.data);
  return res.json(updated);
});

app.get("/tasks/:id/history", (req, res) => {
  const taskId = getRequiredParam(req, "id");
  if (!taskId) return res.status(400).json({ error: "Invalid task id" });
  res.json(taskHistory.filter((item) => item.taskId === taskId));
});

app.get("/analytics/dashboard", (_req, res) => {
  res.json({
    summary: getDashboardSummary(),
    statusDistribution: getStatusDistribution(),
    delayTrend: getDelayTrend(),
    performance: getPerformance(),
  });
});

app.get("/analytics/performance", (req, res) => {
  const periodType = (req.query.periodType as "month" | "quarter" | "year" | undefined) ?? "month";
  const periodKey = (req.query.periodKey as string | undefined) ?? "2026-03";
  res.json(getPerformanceByPeriod(periodType, periodKey));
});

app.get("/analytics/delay-trend", (_req, res) => {
  res.json(getDelayTrend());
});

app.get("/analytics/tasks-drilldown", (_req, res) => {
  const data = tasks
    .filter((task) => !task.deletedAt)
    .map((task) => ({
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

app.get("/reports/weekly", (_req, res) => {
  res.json({
    generatedAt: new Date().toISOString(),
    rows: getWeeklyReportRows(),
  });
});

app.get("/reports", (_req, res) => {
  res.json(reportHistory);
});

app.get("/reports/:id/status", (req, res) => {
  const reportId = getRequiredParam(req, "id");
  if (!reportId) return res.status(400).json({ error: "Invalid report id" });
  const report = reportHistory.find((item) => item.id === reportId);
  if (!report) return res.status(404).json({ error: "Report not found" });
  res.json(report);
});

app.get("/reports/:id/download", (req, res) => {
  const reportId = getRequiredParam(req, "id");
  if (!reportId) return res.status(400).json({ error: "Invalid report id" });
  const report = reportHistory.find((item) => item.id === reportId);
  if (!report || !report.filePath) return res.status(404).json({ error: "Report file not found" });
  return res.sendFile(report.filePath);
});

const reportExportSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
});

app.post("/reports/weekly/export", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
  const parsed = reportExportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
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
    const excelPath = await executeWithRetry(() =>
      generateExcelReport("weekly", parsed.data.periodStart, parsed.data.periodEnd, getWeeklyReportRows()),
    );
    updateReportRecord(excelReport.id, { status: "success", filePath: excelPath, completedAt: new Date().toISOString() });

    updateReportRecord(pdfReport.id, { status: "running" });
    const pdfPath = await executeWithRetry(() =>
      generatePdfReport("weekly", parsed.data.periodStart, parsed.data.periodEnd, getPerformance()),
    );
    updateReportRecord(pdfReport.id, { status: "success", filePath: pdfPath, completedAt: new Date().toISOString() });
    addAuditLog({ action: "report.export.weekly", entityType: "report", entityId: excelReport.id, metadata: {} });
    const payload = { status: "success" as const, reports: [excelReport.id, pdfReport.id], exportDir: EXPORT_DIR };
    if (cacheKey) idempotencyCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (error) {
    updateReportRecord(excelReport.id, { status: "failed" });
    updateReportRecord(pdfReport.id, { status: "failed" });
    return res.status(500).json({ error: `Export failed: ${String(error)}` });
  }
});

app.post("/reports/monthly/export", requireRoles(["admin", "pm", "lead"]), async (req, res) => {
  const parsed = reportExportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
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
    const excelPath = await executeWithRetry(() =>
      generateExcelReport("monthly", parsed.data.periodStart, parsed.data.periodEnd, getMonthlyReportRows()),
    );
    updateReportRecord(excelReport.id, { status: "success", filePath: excelPath, completedAt: new Date().toISOString() });

    updateReportRecord(pdfReport.id, { status: "running" });
    const pdfPath = await executeWithRetry(() =>
      generatePdfReport("monthly", parsed.data.periodStart, parsed.data.periodEnd, getPerformance()),
    );
    updateReportRecord(pdfReport.id, { status: "success", filePath: pdfPath, completedAt: new Date().toISOString() });
    addAuditLog({ action: "report.export.monthly", entityType: "report", entityId: excelReport.id, metadata: {} });
    const payload = { status: "success" as const, reports: [excelReport.id, pdfReport.id], exportDir: EXPORT_DIR };
    if (cacheKey) idempotencyCache.set(cacheKey, payload);
    return res.json(payload);
  } catch (error) {
    updateReportRecord(excelReport.id, { status: "failed" });
    updateReportRecord(pdfReport.id, { status: "failed" });
    return res.status(500).json({ error: `Export failed: ${String(error)}` });
  }
});

app.get("/audit-logs", (_req, res) => {
  res.json(
    auditLogs.slice(0, 200),
  );
});

app.post("/reports/cleanup", requireRoles(["admin"]), async (req, res) => {
  const retentionDays = Number((req.body as { retentionDays?: number }).retentionDays ?? 7);
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
app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});

setInterval(() => {
  void cleanupOldReports(14);
}, 60 * 60 * 1000);
