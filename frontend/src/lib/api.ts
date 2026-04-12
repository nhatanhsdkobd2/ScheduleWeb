"use client";

import type {
  TaskHistoryItem,
  DashboardSummary,
  DelayTrendItem,
  Member,
  PerformanceItem,
  Project,
  ProjectMemberAssignment,
  Task,
  StatusDistributionItem,
  WeeklyReportRow,
} from "@shared/types/domain";

export interface DashboardPayload {
  summary: DashboardSummary;
  statusDistribution: StatusDistributionItem[];
  delayTrend: DelayTrendItem[];
  performance: PerformanceItem[];
}

/** Base URL for API (set NEXT_PUBLIC_API_BASE_URL on Vercel; baked in at build time). */
export const publicApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const API_BASE = publicApiBaseUrl;

export async function getDashboardData(): Promise<DashboardPayload> {
  try {
    const response = await fetch(`${API_BASE}/analytics/dashboard`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load dashboard data");
    return (await response.json()) as DashboardPayload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Dashboard load failed: ${msg}`);
  }
}

export async function getWeeklyReportRows(): Promise<WeeklyReportRow[]> {
  try {
    const response = await fetch(`${API_BASE}/reports/weekly`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load report rows");
    const payload = (await response.json()) as { rows: WeeklyReportRow[] };
    return payload.rows;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Report rows load failed: ${msg}`);
  }
}

/** Server max per request is 500; keep pages smaller for smoother UX. */
export const TASK_PAGE_SIZE = 80;

export interface TaskFilters {
  search?: string;
  projectId?: string;
  memberId?: string;
  status?: Task["status"] | "all";
  dateFrom?: string;
  dateTo?: string;
}

export type TasksPageResponse = { items: Task[]; total: number };

/**
 * Coerce `Task[]`, legacy `{ items, total }` paginated bodies, or mistaken React Query cache values
 * into a plain `Task[]` (e.g. when `/tasks` shape was stored where a flat array was expected).
 */
export function asTaskArray(value: unknown): Task[] {
  if (Array.isArray(value)) {
    return (value as Task[]).filter((t) => t != null && String((t as Task).id ?? "").length > 0);
  }
  if (value && typeof value === "object" && "items" in (value as object)) {
    const items = (value as TasksPageResponse).items;
    if (Array.isArray(items)) {
      return items.filter((t) => t != null && String(t.id ?? "").length > 0);
    }
  }
  return [];
}

export function normalizeTasksPageResponse(raw: unknown): TasksPageResponse {
  if (Array.isArray(raw)) {
    const items = raw as Task[];
    return { items, total: items.length };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const items = o.items;
    const total = o.total;
    if (Array.isArray(items)) {
      return {
        items: items as Task[],
        total: typeof total === "number" && Number.isFinite(total) ? total : items.length,
      };
    }
  }
  return { items: [], total: 0 };
}

export function buildTasksQueryParams(filters: TaskFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.projectId && filters.projectId !== "all") params.set("projectId", filters.projectId);
  if (filters.memberId && filters.memberId !== "all") params.set("memberId", filters.memberId);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  return params;
}

export async function fetchTasksPage(filters: TaskFilters, offset: number): Promise<TasksPageResponse> {
  const params = buildTasksQueryParams(filters);
  params.set("limit", String(TASK_PAGE_SIZE));
  params.set("offset", String(offset));
  const query = params.toString();
  const url = `${API_BASE}/tasks?${query}`;
  const raw = await requestJson<unknown>(url);
  return normalizeTasksPageResponse(raw);
}

/** Loads every page for the given filters (used after socket updates and for legacy helpers). */
export async function fetchAllTaskPages(filters: TaskFilters): Promise<TasksPageResponse> {
  const items: Task[] = [];
  let offset = 0;
  let total = 0;
  for (;;) {
    const page = await fetchTasksPage(filters, offset);
    total = page.total;
    items.push(...page.items);
    offset += page.items.length;
    if (page.items.length === 0 || items.length >= total) {
      return { items, total };
    }
  }
}

export async function getTasks(): Promise<Task[]> {
  const { items } = await fetchAllTaskPages({});
  return items;
}

/** Full task list for the given filters (all pages), always `Task[]`. */
export async function getTasksByFilters(filters: TaskFilters): Promise<Task[]> {
  const { items } = await fetchAllTaskPages(filters);
  return items;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(
      `Cannot connect to backend at ${API_BASE}. Local: start backend on port 4000. Production: verify NEXT_PUBLIC_API_BASE_URL on Vercel and redeploy; on Render set ALLOWED_ORIGIN to your site URL.`,
    );
  }

  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const ct = response.headers.get("content-type");
      if (ct && ct.includes("application/json")) {
        const errBody = (await response.json()) as { error?: string | { message?: string } };
        if (errBody?.error) {
          message = typeof errBody.error === "string" ? errBody.error : JSON.stringify(errBody.error);
        }
      }
    } catch {
      // ignore parse errors on error response
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

const roleHeaders = (role: "admin" | "pm" | "lead" | "member" = "lead"): HeadersInit => ({
  "Content-Type": "application/json",
  "x-role": role,
});

export async function getMembers(): Promise<Member[]> {
  return requestJson<Member[]>(`${API_BASE}/members`);
}

export async function createMember(payload: Omit<Member, "id" | "memberCode">): Promise<Member> {
  return requestJson<Member>(`${API_BASE}/members`, {
    method: "POST",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateMember(id: string, payload: Partial<Omit<Member, "id">>): Promise<Member> {
  return requestJson<Member>(`${API_BASE}/members/${id}`, {
    method: "PATCH",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteMember(id: string): Promise<void> {
  await requestJson<{ status: string }>(`${API_BASE}/members/${id}`, {
    method: "DELETE",
    headers: roleHeaders(),
  });
}

export async function getProjects(): Promise<Project[]> {
  return requestJson<Project[]>(`${API_BASE}/projects`);
}

export async function getProjectMembers(projectId: string): Promise<ProjectMemberAssignment[]> {
  return requestJson<ProjectMemberAssignment[]>(`${API_BASE}/projects/${projectId}/members`);
}

export async function createProject(
  payload: Omit<Project, "id" | "projectCode">,
): Promise<Project> {
  return requestJson<Project>(`${API_BASE}/projects`, {
    method: "POST",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await requestJson<{ status: string }>(`${API_BASE}/projects/${id}`, {
    method: "DELETE",
    headers: roleHeaders(),
  });
}

export async function updateProject(id: string, payload: Partial<Omit<Project, "id">>): Promise<Project> {
  return requestJson<Project>(`${API_BASE}/projects/${id}`, {
    method: "PATCH",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function assignProjectMember(
  projectId: string,
  payload: { memberId: string; assignmentRole: "owner" | "lead" | "contributor"; allocationPercent: number },
): Promise<ProjectMemberAssignment> {
  return requestJson<ProjectMemberAssignment>(`${API_BASE}/projects/${projectId}/members`, {
    method: "POST",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function removeProjectMember(projectId: string, memberId: string): Promise<void> {
  await requestJson<{ status: string }>(`${API_BASE}/projects/${projectId}/members/${memberId}`, {
    method: "DELETE",
    headers: roleHeaders(),
  });
}

export async function createTask(payload: Omit<Task, "id" | "status" | "taskCode">): Promise<Task> {
  return requestJson<Task>(`${API_BASE}/tasks`, {
    method: "POST",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateTask(id: string, payload: Partial<Omit<Task, "id">>): Promise<Task> {
  return requestJson<Task>(`${API_BASE}/tasks/${id}`, {
    method: "PATCH",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getTaskHistory(taskId: string): Promise<TaskHistoryItem[]> {
  return requestJson<TaskHistoryItem[]>(`${API_BASE}/tasks/${taskId}/history`);
}
