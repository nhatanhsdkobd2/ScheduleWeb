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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

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

export async function getTasks(): Promise<Task[]> {
  try {
    const response = await fetch(`${API_BASE}/tasks`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load tasks");
    return (await response.json()) as Task[];
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Tasks load failed: ${msg}`);
  }
}

export interface TaskFilters {
  search?: string;
  projectId?: string;
  memberId?: string;
  status?: Task["status"] | "all";
  dateFrom?: string;
  dateTo?: string;
}

export async function getTasksByFilters(filters: TaskFilters): Promise<Task[]> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.projectId && filters.projectId !== "all") params.set("projectId", filters.projectId);
  if (filters.memberId && filters.memberId !== "all") params.set("memberId", filters.memberId);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  const query = params.toString();
  const url = query ? `${API_BASE}/tasks?${query}` : `${API_BASE}/tasks`;
  return requestJson<Task[]>(url);
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(`Khong the ket noi backend tai ${API_BASE}. Vui long dam bao backend dang chay tren cong 4000.`);
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

export async function createMember(payload: Omit<Member, "id">): Promise<Member> {
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
  payload: Omit<Project, "id">,
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

export async function createTask(payload: Omit<Task, "id" | "status">): Promise<Task> {
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
