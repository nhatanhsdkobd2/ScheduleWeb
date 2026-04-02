export type Role = "admin" | "pm" | "lead" | "member";
export type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "canceled";
export type Priority = "low" | "medium" | "high" | "critical";

export interface Member {
  id: string;
  memberCode: string;
  fullName: string;
  email: string;
  role: Role;
  team: string;
  status: "active" | "inactive";
  deletedAt?: string;
}

export interface Project {
  id: string;
  projectCode: string;
  name: string;
  ownerMemberId?: string;
  status: "planning" | "active" | "on_hold" | "completed" | "canceled";
  description?: string;
  category?: string;
  deletedAt?: string;
}

export interface ProjectMemberAssignment {
  id: string;
  projectId: string;
  memberId: string;
  assignmentRole: "owner" | "lead" | "contributor";
  allocationPercent: number;
  assignedAt: string;
}

export interface Task {
  id: string;
  taskCode: string;
  title: string;
  projectId: string;
  assigneeMemberId: string;
  dueDate: string;
  completedAt?: string;
  status: TaskStatus;
  priority: Priority;
  deletedAt?: string;
}

export interface TaskHistoryItem {
  id: string;
  taskId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedAt: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  entityType: "member" | "project" | "task" | "report";
  entityId: string;
  metadata: Record<string, string>;
  createdAt: string;
}

export interface DashboardSummary {
  activeMembers: number;
  activeProjects: number;
  openTasks: number;
  overdueTasks: number;
}

export interface DelayTrendItem {
  period: string;
  delayedTasks: number;
  avgDelayDays: number;
}

export interface StatusDistributionItem {
  status: TaskStatus;
  value: number;
}

export interface PerformanceItem {
  memberId: string;
  memberName: string;
  score: number;
  avgDelayDays: number;
  overdueRatio: number;
  performanceBand: "A" | "B" | "C" | "D";
}

export interface WeeklyReportRow {
  memberName: string;
  assigned: number;
  done: number;
  overdue: number;
  avgDelayDays: number;
}

export interface ReportRecord {
  id: string;
  reportType: "weekly" | "monthly";
  format: "xlsx" | "pdf";
  periodStart: string;
  periodEnd: string;
  status: "queued" | "running" | "success" | "failed";
  filePath?: string;
  createdAt: string;
  completedAt?: string;
}
