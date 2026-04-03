import cors from "cors";
import express from "express";
import { z } from "zod";
import { getDashboardSummary, getDelayTrend, getPerformance, getStatusDistribution, getWeeklyReportRows, members, projects, tasks, } from "./data.js";
const app = express();
app.use(cors());
app.use(express.json());
app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
});
app.get("/members", (_req, res) => {
    res.json(members);
});
app.get("/projects", (_req, res) => {
    res.json(projects);
});
app.get("/tasks", (_req, res) => {
    res.json(tasks);
});
app.get("/analytics/dashboard", (_req, res) => {
    res.json({
        summary: getDashboardSummary(),
        statusDistribution: getStatusDistribution(),
        delayTrend: getDelayTrend(),
        performance: getPerformance(),
    });
});
app.get("/reports/weekly", (_req, res) => {
    res.json({
        generatedAt: new Date().toISOString(),
        rows: getWeeklyReportRows(),
    });
});
const reportExportSchema = z.object({
    reportType: z.enum(["weekly", "monthly"]),
    periodStart: z.string(),
    periodEnd: z.string(),
});
app.post("/reports/export", (req, res) => {
    const parsed = reportExportSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.flatten() });
        return;
    }
    res.json({
        status: "queued",
        reportId: `r-${Date.now()}`,
        message: "Local export job simulated successfully.",
    });
});
const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
    console.log(`Backend listening on http://localhost:${port}`);
});
