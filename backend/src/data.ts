import type {
  AuditLogItem,
  DashboardSummary,
  DelayTrendItem,
  Member,
  PerformanceItem,
  ProjectMemberAssignment,
  Project,
  ReportRecord,
  StatusDistributionItem,
  Task,
  TaskHistoryItem,
  WeeklyReportRow,
} from "../../shared/types/domain.js";

export const members: Member[] = [];
export const projects: Project[] = [];

// ── Default member seed data ───────────────────────────────────────────────
const DEFAULT_MEMBER_NAMES: string[] = [
  "Châu Gia Kiên",
  "Hoàng Văn Nhật Anh",
  "Lê Bá Kha",
  "Lê Bùi Hải Uyên",
  "Lê Nguyễn Thục Nhi",
  "Lê Quang Duy",
  "Lê Văn Thiện",
  "Lương Nguyễn Bảo Châu",
  "Nguyễn Lê Tân Thành",
  "Nguyễn Mạnh Hiếu",
  "Nguyễn Minh Kha",
  "Nguyễn Ngọc Bảo Kha",
  "Nguyễn Nhật Hào",
  "Nguyễn Phúc Bảo Phát",
  "Nguyễn Phước Thọ",
  "Nguyễn Quang Cảnh",
  "Nguyễn Quang Trí",
  "Nguyễn Thái Dương",
  "Nguyễn Thanh Huy",
  "Phạm Kim Chấn Nguyên",
  "Phan Văn Nguyên",
  "Trần Đình Anh Hùng",
  "Trần Hữu Quang Trường",
  "Trần Lộc",
  "Trần Nguyễn Hoàng Diễn",
  "Trương Việt Hưng",
];

function normalizeEmail(fullName: string): string {
  return fullName.toLowerCase().replace(/\s+/g, ".") + "@innova.com";
}

// ── Default project seed data ──────────────────────────────────────────────
const DEFAULT_PROJECTS: Omit<Project, "id">[] = [
  // 1. SDK Development
  { projectCode: "SDK-001", name: "SDK Development", ownerMemberId: "", status: "active", description: "Core SDK development for all product lines", category: "SDK Development" },

  // 2. Innova Products
  { projectCode: "INN-001", name: "InnovaProSDK", ownerMemberId: "", status: "active", description: "InnovaPro Software Development Kit", category: "Innova Products" },
  { projectCode: "INN-002", name: "RS2 Module", ownerMemberId: "", status: "active", description: "RS2 hardware integration module", category: "Innova Products" },
  { projectCode: "INN-003", name: "On-The-Go Module", ownerMemberId: "", status: "active", description: "On-The-Go module development", category: "Innova Products" },
  { projectCode: "INN-004", name: "Services Module (DMM, Battery,...)", ownerMemberId: "", status: "active", description: "Services module covering DMM and Battery services", category: "Innova Products" },
  { projectCode: "INN-005", name: "Parser modules (Passthrough parser, OEM API,...)", ownerMemberId: "", status: "active", description: "Parser modules: Passthrough parser and OEM API", category: "Innova Products" },
  { projectCode: "INN-006", name: "Universal DLL", ownerMemberId: "", status: "active", description: "Universal DLL for cross-platform support", category: "Innova Products" },

  // 3. Production
  { projectCode: "PRD-001", name: "RSPro Production", ownerMemberId: "", status: "active", description: "RSPro hardware production line", category: "Production" },
  { projectCode: "PRD-002", name: "Innova Tablet Production", ownerMemberId: "", status: "active", description: "Innova Tablet manufacturing and QA", category: "Production" },
  { projectCode: "PRD-003", name: "Android Tablet Passthrough", ownerMemberId: "", status: "active", description: "Android tablet passthrough functionality", category: "Production" },
  { projectCode: "PRD-004", name: "Hamaton App", ownerMemberId: "", status: "active", description: "Hamaton mobile application", category: "Production" },

  // 4. Intelligent Data Platform (IDP)
  { projectCode: "IDP-001", name: "IDP (Intelligent Data Platform)", ownerMemberId: "", status: "active", description: "Core Intelligent Data Platform", category: "Intelligent Data Platform" },
  { projectCode: "IDP-002", name: "OS Customization", ownerMemberId: "", status: "active", description: "OS customization layer for IDP", category: "Intelligent Data Platform" },
  { projectCode: "IDP-003", name: "Symptom Diagnostics AI", ownerMemberId: "", status: "active", description: "AI-powered symptom diagnostics engine", category: "Intelligent Data Platform" },
  { projectCode: "IDP-004", name: "Solution data (Q&A, FAQ, ...) AI", ownerMemberId: "", status: "active", description: "AI models for Q&A and FAQ resolution", category: "Intelligent Data Platform" },
  { projectCode: "IDP-005", name: "Live Data Prediction AI", ownerMemberId: "", status: "active", description: "Real-time data prediction AI module", category: "Intelligent Data Platform" },
  { projectCode: "IDP-006", name: "IDP AI", ownerMemberId: "", status: "active", description: "Core AI engine for IDP", category: "Intelligent Data Platform" },
  { projectCode: "IDP-007", name: "BA_EE_DMM AI", ownerMemberId: "", status: "active", description: "BA_EE_DMM AI integration module", category: "Intelligent Data Platform" },

  // 5. Server API
  { projectCode: "API-001", name: "Limbus Server API", ownerMemberId: "", status: "active", description: "Limbus backend server API", category: "Server API" },
  { projectCode: "API-002", name: "RSPRO Server API", ownerMemberId: "", status: "active", description: "RSPRO hardware server API", category: "Server API" },
  { projectCode: "API-003", name: "Tablet Server API", ownerMemberId: "", status: "active", description: "Tablet backend server API", category: "Server API" },
  { projectCode: "API-004", name: "Extra API (FordSecurity, NewFix, Symptom, ...)", ownerMemberId: "", status: "active", description: "Extra APIs: FordSecurity, NewFix, Symptom, and others", category: "Server API" },

  // 6. Server Deployment
  { projectCode: "SVD-001", name: "Server Deployment", ownerMemberId: "", status: "active", description: "Server deployment and infrastructure management", category: "Server Deployment" },

  // 7. Tool & Web Development
  { projectCode: "TWD-001", name: "Product management Dashboard", ownerMemberId: "", status: "active", description: "Product management web dashboard", category: "Tool & Web Development" },
  { projectCode: "TWD-002", name: "Intranet (interagte FTP file, BOM, Jira, PIES)", ownerMemberId: "", status: "active", description: "Intranet portal integrating FTP, BOM, Jira, and PIES", category: "Tool & Web Development" },
  { projectCode: "TWD-003", name: "Vehicle Validation (interagte Jira)", ownerMemberId: "", status: "active", description: "Vehicle validation system integrated with Jira", category: "Tool & Web Development" },
  { projectCode: "TWD-004", name: "ATE Log Android Web (Factory and Analyze, auto Mail Report)", ownerMemberId: "", status: "active", description: "ATE Log web application with factory analyze and auto mail report", category: "Tool & Web Development" },
  { projectCode: "TWD-005", name: "ATELogAndroid", ownerMemberId: "", status: "active", description: "ATE Log Android application", category: "Tool & Web Development" },
  { projectCode: "TWD-006", name: "SQLImporter / SQL Importer", ownerMemberId: "", status: "active", description: "SQL data importer tool", category: "Tool & Web Development" },
  { projectCode: "TWD-007", name: "Simulation Software (Provide APIs & Database organization)", ownerMemberId: "", status: "active", description: "Simulation software with APIs and database management", category: "Tool & Web Development" },
  { projectCode: "TWD-008", name: "CSR System", ownerMemberId: "", status: "active", description: "Customer Service Request system", category: "Tool & Web Development" },
  { projectCode: "TWD-009", name: "Version Release Tracking", ownerMemberId: "", status: "active", description: "Software version release tracking system", category: "Tool & Web Development" },
  { projectCode: "TWD-010", name: "Tool Builder (Built into Web SQL Importer)", ownerMemberId: "", status: "active", description: "Internal tool builder integrated with Web SQL Importer", category: "Tool & Web Development" },

  // 8. Internal Tools
  { projectCode: "INT-001", name: "Tool Log Management & Analytics Platform (Customer)", ownerMemberId: "", status: "active", description: "Tool log management and analytics platform for customers", category: "Internal Tools" },
  { projectCode: "INT-002", name: "Testing and Validation", ownerMemberId: "", status: "active", description: "Testing and validation workflow management", category: "Internal Tools" },
  { projectCode: "INT-003", name: "TimeOff Manager", ownerMemberId: "", status: "active", description: "Employee time-off request and management system", category: "Internal Tools" },
  { projectCode: "INT-004", name: "Android ATE", ownerMemberId: "", status: "active", description: "Android Automated Test Equipment system", category: "Internal Tools" },
];

// ── Demo tasks (seeded after members + projects) ────────────────────────────
interface DemoTask { taskCode: string; title: string; dueDate: string; status: Task["status"]; priority: Task["priority"]; completedAt?: string; }
const DEMO_TASKS: DemoTask[] = [
  { taskCode: "TSK-001", title: "Kickoff meeting & team alignment", dueDate: "2026-04-07", status: "done", priority: "high", completedAt: "2026-04-06" },
  { taskCode: "TSK-002", title: "Initial architecture design", dueDate: "2026-04-15", status: "in_progress", priority: "high" },
  { taskCode: "TSK-003", title: "Backend API scaffolding", dueDate: "2026-04-20", status: "todo", priority: "medium" },
  { taskCode: "TSK-004", title: "Frontend dashboard setup", dueDate: "2026-04-25", status: "todo", priority: "medium" },
  { taskCode: "TSK-005", title: "Database schema design", dueDate: "2026-04-12", status: "done", priority: "critical", completedAt: "2026-04-11" },
  { taskCode: "TSK-006", title: "CI/CD pipeline configuration", dueDate: "2026-04-30", status: "blocked", priority: "medium" },
  { taskCode: "TSK-007", title: "Performance benchmark baseline", dueDate: "2026-05-05", status: "todo", priority: "low" },
  { taskCode: "TSK-008", title: "UAT preparation & documentation", dueDate: "2026-05-10", status: "todo", priority: "medium" },
];

// ── Auto-seed: run once per server lifecycle ───────────────────────────────
let membersSeeded = false;
let projectsSeeded = false;

function seedDefaultMembers(): void {
  if (membersSeeded) return;
  const existingEmails = new Set(members.map((m) => m.email));
  DEFAULT_MEMBER_NAMES.forEach((fullName, index) => {
    const memberCode = `MB${String(index + 1).padStart(3, "0")}`;
    const email = normalizeEmail(fullName);
    if (!existingEmails.has(email)) {
      members.push({
        id: createId("m"),
        memberCode,
        fullName,
        email,
        role: "member",
        team: "Platform",
        status: "active",
      });
    }
  });
  membersSeeded = true;
}

function seedDefaultProjects(): void {
  if (projectsSeeded) return;
  // Ensure members are seeded first
  seedDefaultMembers();
  const existingCodes = new Set(projects.map((p) => p.projectCode));
  const firstMemberId = members[0]?.id ?? "";

  let firstProjectId = "";
  DEFAULT_PROJECTS.forEach((project) => {
    if (!existingCodes.has(project.projectCode)) {
      const newId = createId("p");
      projects.push({
        ...project,
        id: newId,
        ownerMemberId: firstMemberId || project.ownerMemberId,
      });
      if (!firstProjectId) firstProjectId = newId;
    }
  });
  if (!firstProjectId) firstProjectId = projects[0]?.id ?? "";
  // Default to InnovaProSDK (INN-001) and Hoang Van Nhat Anh for demo tasks
  const inn001Project = projects.find((p) => p.projectCode === "INN-001");
  const demoProjectId = inn001Project?.id ?? firstProjectId;
  const hoangVanNhatAnh = members.find((m) => m.fullName === "Hoàng Văn Nhật Anh") ?? members[0];
  if (hoangVanNhatAnh) {
    const seededTaskCodes = new Set(tasks.map((t) => t.taskCode));
    DEMO_TASKS.forEach((demo) => {
      if (!seededTaskCodes.has(demo.taskCode) && demoProjectId) {
        tasks.push({
          id: createId("t"),
          taskCode: demo.taskCode,
          title: demo.title,
          projectId: demoProjectId,
          assigneeMemberId: hoangVanNhatAnh.id,
          dueDate: demo.dueDate,
          status: demo.status,
          priority: demo.priority,
          completedAt: demo.completedAt,
        });
      }
    });

    // Seed demo project member assignment
    const existingPM = projectMembers.some(
      (pm) => pm.projectId === demoProjectId && pm.memberId === hoangVanNhatAnh.id,
    );
    if (!existingPM && demoProjectId) {
      projectMembers.push({
        id: createId("pm"),
        projectId: demoProjectId,
        memberId: hoangVanNhatAnh.id,
        assignmentRole: "owner",
        allocationPercent: 100,
        assignedAt: nowIso(),
      });
    }
  }

  projectsSeeded = true;
}

// ── Public seed-aware getters ───────────────────────────────────────────────
export function getMembersWithSeed(): Member[] {
  seedDefaultMembers();
  return members.filter((member) => !member.deletedAt);
}

export function getProjectsWithSeed(): Project[] {
  seedDefaultProjects();
  return projects.filter((project) => !project.deletedAt);
}

export function softDeleteProject(id: string): Project | undefined {
  const project = projects.find((p) => p.id === id && !p.deletedAt);
  if (!project) return undefined;
  project.deletedAt = nowIso();
  addAuditLog({
    action: "project.delete",
    entityType: "project",
    entityId: project.id,
    metadata: { projectCode: project.projectCode },
  });
  return project;
}

// ── Re-export task/projectMembers arrays for direct mutation ───────────────
export const tasks: Task[] = [];
export const projectMembers: ProjectMemberAssignment[] = [];

export const taskHistory: TaskHistoryItem[] = [];
export const auditLogs: AuditLogItem[] = [];
export const reportHistory: ReportRecord[] = [];

const SENSITIVE_KEYS = ["password", "token", "secret", "authorization", "cookie", "session"];

function sanitizeMetadata(raw: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(raw).map(([key, value]) => {
      const lower = key.toLowerCase();
      if (SENSITIVE_KEYS.some((marker) => lower.includes(marker))) {
        return [key, "[REDACTED]"];
      }
      return [key, value];
    }),
  );
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function addAuditLog(entry: Omit<AuditLogItem, "id" | "createdAt">): AuditLogItem {
  const item: AuditLogItem = {
    id: createId("log"),
    createdAt: nowIso(),
    ...entry,
    metadata: sanitizeMetadata(entry.metadata),
  };
  auditLogs.unshift(item);
  return item;
}

export function addTaskHistory(entry: Omit<TaskHistoryItem, "id" | "changedAt">): TaskHistoryItem {
  const item: TaskHistoryItem = {
    id: createId("th"),
    changedAt: nowIso(),
    ...entry,
  };
  taskHistory.unshift(item);
  return item;
}

export function findMemberById(id: string): Member | undefined {
  return members.find((member) => member.id === id && !member.deletedAt);
}

export function findProjectById(id: string): Project | undefined {
  return projects.find((project) => project.id === id && !project.deletedAt);
}

export function findTaskById(id: string): Task | undefined {
  return tasks.find((task) => task.id === id && !task.deletedAt);
}

export function createMember(input: Omit<Member, "id">): Member {
  const member: Member = { id: createId("m"), ...input };
  members.push(member);
  addAuditLog({
    action: "member.create",
    entityType: "member",
    entityId: member.id,
    metadata: { memberCode: member.memberCode, email: member.email },
  });
  return member;
}

export function updateMember(id: string, patch: Partial<Omit<Member, "id">>): Member | undefined {
  const member = findMemberById(id);
  if (!member) return undefined;
  Object.assign(member, patch);
  addAuditLog({
    action: "member.update",
    entityType: "member",
    entityId: member.id,
    metadata: { keys: Object.keys(patch).join(",") },
  });
  return member;
}

export function softDeleteMember(id: string): Member | undefined {
  const member = findMemberById(id);
  if (!member) return undefined;
  member.deletedAt = nowIso();
  member.status = "inactive";
  addAuditLog({
    action: "member.delete",
    entityType: "member",
    entityId: member.id,
    metadata: {},
  });
  return member;
}

export function createProject(input: Omit<Project, "id">): Project {
  const project: Project = { id: createId("p"), ...input };
  projects.push(project);
  addAuditLog({
    action: "project.create",
    entityType: "project",
    entityId: project.id,
    metadata: { projectCode: project.projectCode },
  });
  return project;
}

export function assignMemberToProject(input: Omit<ProjectMemberAssignment, "id" | "assignedAt">): ProjectMemberAssignment {
  const duplicated = projectMembers.find(
    (item) => item.projectId === input.projectId && item.memberId === input.memberId,
  );
  if (duplicated) return duplicated;
  const assignment: ProjectMemberAssignment = {
    id: createId("pm"),
    assignedAt: nowIso(),
    ...input,
  };
  projectMembers.push(assignment);
  addAuditLog({
    action: "project.member.assign",
    entityType: "project",
    entityId: input.projectId,
    metadata: { memberId: input.memberId, assignmentRole: input.assignmentRole },
  });
  return assignment;
}

export function removeMemberFromProject(projectId: string, memberId: string): boolean {
  const index = projectMembers.findIndex((item) => item.projectId === projectId && item.memberId === memberId);
  if (index < 0) return false;
  projectMembers.splice(index, 1);
  addAuditLog({
    action: "project.member.remove",
    entityType: "project",
    entityId: projectId,
    metadata: { memberId },
  });
  return true;
}

export function updateProject(id: string, patch: Partial<Omit<Project, "id">>): Project | undefined {
  const project = findProjectById(id);
  if (!project) return undefined;
  Object.assign(project, patch);
  addAuditLog({
    action: "project.update",
    entityType: "project",
    entityId: project.id,
    metadata: { keys: Object.keys(patch).join(",") },
  });
  return project;
}

export function createTask(input: Omit<Task, "id" | "status">): Task {
  const task: Task = { id: createId("t"), status: "todo", ...input };
  tasks.push(task);
  addAuditLog({
    action: "task.create",
    entityType: "task",
    entityId: task.id,
    metadata: { taskCode: task.taskCode },
  });
  return task;
}

export function updateTask(id: string, patch: Partial<Omit<Task, "id">>): Task | undefined {
  const task = findTaskById(id);
  if (!task) return undefined;
  for (const [fieldName, newValue] of Object.entries(patch)) {
    const key = fieldName as keyof Task;
    const oldValue = task[key];
    if (typeof newValue !== "undefined" && String(oldValue ?? "") !== String(newValue)) {
      addTaskHistory({
        taskId: task.id,
        fieldName,
        oldValue: String(oldValue ?? ""),
        newValue: String(newValue),
      });
    }
  }
  Object.assign(task, patch);
  addAuditLog({
    action: "task.update",
    entityType: "task",
    entityId: task.id,
    metadata: { keys: Object.keys(patch).join(",") },
  });
  return task;
}

function toDelayDays(task: Task): number {
  if (!task.completedAt) return 0;
  const due = new Date(task.dueDate).getTime();
  const done = new Date(task.completedAt).getTime();
  const delayMs = Math.max(0, done - due);
  return Math.floor(delayMs / (24 * 60 * 60 * 1000));
}

const priorityWeight: Record<Task["priority"], number> = {
  low: 1,
  medium: 1.5,
  high: 2,
  critical: 3,
};

function toBand(score: number): "A" | "B" | "C" | "D" {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  return "D";
}

export function getDashboardSummary(): DashboardSummary {
  const now = new Date();
  const activeMembers = getMembersWithSeed();
  const activeProjects = getProjectsWithSeed();
  const openTasks = tasks.filter((task) => !task.deletedAt && task.status !== "done" && task.status !== "canceled");
  const overdueTasks = openTasks.filter((task) => new Date(task.dueDate) < now).length;
  return {
    activeMembers: activeMembers.filter((member) => member.status === "active").length,
    activeProjects: activeProjects.filter((project) => project.status === "active").length,
    openTasks: openTasks.length,
    overdueTasks,
  };
}

export function getStatusDistribution(): StatusDistributionItem[] {
  const counts = new Map<Task["status"], number>();
  for (const task of tasks.filter((item) => !item.deletedAt)) {
    counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
  }
  return [...counts.entries()].map(([status, value]) => ({ status, value }));
}

export function getDelayTrend(): DelayTrendItem[] {
  const monthMap = new Map<string, { delayedTasks: number; totalDelay: number; doneCount: number }>();
  for (const task of tasks.filter((item) => !item.deletedAt && item.completedAt)) {
    const period = task.completedAt!.slice(0, 7);
    const current = monthMap.get(period) ?? { delayedTasks: 0, totalDelay: 0, doneCount: 0 };
    const delay = toDelayDays(task);
    current.doneCount += 1;
    current.totalDelay += delay;
    if (delay > 0) current.delayedTasks += 1;
    monthMap.set(period, current);
  }
  return [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, stat]) => ({
      period,
      delayedTasks: stat.delayedTasks,
      avgDelayDays: Number((stat.doneCount === 0 ? 0 : stat.totalDelay / stat.doneCount).toFixed(2)),
    }));
}

export function getPerformance(): PerformanceItem[] {
  const activeMembers = getMembersWithSeed();
  return activeMembers.map((member) => {
    const ownTasks = tasks.filter((task) => !task.deletedAt && task.assigneeMemberId === member.id);
    const overdueCount = ownTasks.filter((task) => task.completedAt && toDelayDays(task) > 0).length;
    const avgDelayDays =
      ownTasks.length === 0 ? 0 : ownTasks.reduce((sum, task) => sum + toDelayDays(task), 0) / ownTasks.length;
    const overdueRatio = ownTasks.length === 0 ? 0 : overdueCount / ownTasks.length;
    const weightedDelayPenalty = ownTasks.reduce((sum, task) => sum + toDelayDays(task) * priorityWeight[task.priority], 0);
    const overduePenalty = overdueRatio * 40;
    const score = Math.max(0, Math.round(100 - weightedDelayPenalty - overduePenalty));
    return {
      memberId: member.id,
      memberName: member.fullName,
      score,
      avgDelayDays: Number(avgDelayDays.toFixed(2)),
      overdueRatio: Number(overdueRatio.toFixed(2)),
      performanceBand: toBand(score),
    };
  });
}

export function getWeeklyReportRows(): WeeklyReportRow[] {
  const activeMembers = getMembersWithSeed();
  return activeMembers.map((member) => {
    const ownTasks = tasks.filter((task) => !task.deletedAt && task.assigneeMemberId === member.id);
    const done = ownTasks.filter((task) => task.status === "done").length;
    const overdue = ownTasks.filter((task) => task.completedAt && toDelayDays(task) > 0).length;
    const avgDelayDays =
      ownTasks.length === 0 ? 0 : ownTasks.reduce((sum, task) => sum + toDelayDays(task), 0) / ownTasks.length;
    return {
      memberName: member.fullName,
      assigned: ownTasks.length,
      done,
      overdue,
      avgDelayDays: Number(avgDelayDays.toFixed(2)),
    };
  });
}

export function getMonthlyReportRows(): WeeklyReportRow[] {
  return getWeeklyReportRows();
}

export function getPerformanceByPeriod(periodType: "month" | "quarter" | "year", periodKey: string): PerformanceItem[] {
  const start = periodType === "month" ? `${periodKey}-01` : periodType === "quarter" ? `${periodKey}-01` : `${periodKey}-01-01`;
  const filteredTasks = tasks.filter((task) => !task.deletedAt && (!task.completedAt || task.completedAt >= start));
  const basePerformance = getPerformance();
  return basePerformance.map((item) => {
    const ownCount = filteredTasks.filter((task) => task.assigneeMemberId === item.memberId).length;
    return {
      ...item,
      score: Math.max(0, Math.min(100, item.score - Math.max(0, 2 - ownCount) * 5)),
    };
  });
}

export function createReportRecord(input: Omit<ReportRecord, "id" | "createdAt" | "status">): ReportRecord {
  const report: ReportRecord = {
    id: createId("r"),
    createdAt: nowIso(),
    status: "queued",
    ...input,
  };
  reportHistory.unshift(report);
  addAuditLog({
    action: "report.create",
    entityType: "report",
    entityId: report.id,
    metadata: { reportType: report.reportType, format: report.format },
  });
  return report;
}

export function updateReportRecord(id: string, patch: Partial<ReportRecord>): ReportRecord | undefined {
  const report = reportHistory.find((item) => item.id === id);
  if (!report) return undefined;
  Object.assign(report, patch);
  return report;
}
