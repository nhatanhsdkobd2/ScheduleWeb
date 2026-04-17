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
import { isAppAdminEmail } from "@/lib/app-admin";

export interface DashboardPayload {
  summary: DashboardSummary;
  statusDistribution: StatusDistributionItem[];
  delayTrend: DelayTrendItem[];
  performance: PerformanceItem[];
}

export interface AuthLoginUser {
  id: string;
  displayName: string;
  email: string;
  role: "admin" | "lead" | "member";
  team: string;
  photoURL: string | null;
  mustChangePassword: boolean;
}

/**
 * Real backend origin (Socket.IO, error text). Set NEXT_PUBLIC_API_BASE_URL (e.g. Render URL).
 * JSON `fetch` uses `API_FETCH_BASE` instead when NEXT_PUBLIC_USE_API_PROXY is true (see next.config).
 */
const backendOrigin = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000").replace(/\/$/, "");
export const publicApiBaseUrl = backendOrigin;

const useApiProxy =
  process.env.NEXT_PUBLIC_USE_API_PROXY === "true" || process.env.NEXT_PUBLIC_USE_API_PROXY === "1";

/** Browser calls same-origin `/api/proxy/...` → Next rewrites to backend (avoids CORS on localhost dev). */
const API_FETCH_BASE = useApiProxy ? "/api/proxy" : backendOrigin;
let currentAuthRole: AuthLoginUser["role"] = "member";
let currentAuthUserId: string | null = null;
let currentAuthUserEmail: string | null = null;

export function setApiAuthRole(role: AuthLoginUser["role"] | null | undefined): void {
  currentAuthRole = role ?? "member";
}

export function setApiAuthUserContext(user: Pick<AuthLoginUser, "id" | "email" | "role"> | null | undefined): void {
  currentAuthRole = user?.role ?? "member";
  currentAuthUserId = user?.id ?? null;
  currentAuthUserEmail = user?.email ?? null;
}

export async function getDashboardData(): Promise<DashboardPayload> {
  try {
    const response = await fetch(`${API_FETCH_BASE}/analytics/dashboard`, { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load dashboard data");
    return (await response.json()) as DashboardPayload;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new Error(`Dashboard load failed: ${msg}`);
  }
}

export async function loginWithEmailPassword(email: string, password: string): Promise<AuthLoginUser> {
  const payload = await requestJson<{ user: AuthLoginUser }>(`${API_FETCH_BASE}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  return payload.user;
}

export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Promise<AuthLoginUser> {
  const payload = await requestJson<{ user: AuthLoginUser }>(`${API_FETCH_BASE}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, currentPassword, newPassword, confirmPassword }),
  });
  return payload.user;
}

export async function getWeeklyReportRows(): Promise<WeeklyReportRow[]> {
  try {
    const response = await fetch(`${API_FETCH_BASE}/reports/weekly`, { cache: "no-store" });
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

/** Unwrap common API envelopes (`{ data: ... }`, `{ results: ... }`) a few levels deep. */
function unwrapEnvelope(value: unknown, depth = 0): unknown {
  if (depth > 4 || value == null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value;
  const o = value as Record<string, unknown>;
  if ("data" in o && o.data !== undefined) return unwrapEnvelope(o.data, depth + 1);
  if ("results" in o && o.results !== undefined) return unwrapEnvelope(o.results, depth + 1);
  return value;
}

/**
 * Coerce `Task[]`, legacy `{ items, total }` paginated bodies, or mistaken React Query cache values
 * into a plain `Task[]` (e.g. when `/tasks` shape was stored where a flat array was expected).
 */
export function asTaskArray(value: unknown): Task[] {
  const v = unwrapEnvelope(value);
  if (Array.isArray(v)) {
    return (v as Task[]).filter((t) => t != null && String((t as Task).id ?? "").length > 0);
  }
  if (v && typeof v === "object" && "items" in (v as object)) {
    const items = (v as TasksPageResponse).items;
    if (Array.isArray(items)) {
      return items.filter((t) => t != null && String(t.id ?? "").length > 0);
    }
  }
  return [];
}

function coerceTotal(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

/**
 * Normalize any `/tasks` page payload: legacy `Task[]`, or `{ items, total }` with loose typing
 * (e.g. `items` missing, `total` as string). Always returns a real array for `items`.
 */
export function normalizeTasksPageResponse(raw: unknown): TasksPageResponse {
  const rawUnwrapped = unwrapEnvelope(raw);
  if (Array.isArray(rawUnwrapped)) {
    const items = rawUnwrapped as Task[];
    return { items, total: items.length };
  }
  if (rawUnwrapped && typeof rawUnwrapped === "object") {
    const o = rawUnwrapped as Record<string, unknown>;
    const itemsRaw = o.items;
    const items = Array.isArray(itemsRaw) ? (itemsRaw as Task[]) : [];
    const total = coerceTotal(o.total, items.length);
    return { items, total };
  }
  return { items: [], total: 0 };
}

/**
 * Coerce list endpoints that return `T[]` or mistakenly `{ items: T[] }` into a plain array.
 * Prevents `.filter` / `.map` on non-arrays when the API or cache shape is wrong.
 */
export function safeArray<T>(value: unknown): T[] {
  const v = unwrapEnvelope(value);
  if (Array.isArray(v)) return v as T[];
  if (v && typeof v === "object" && "items" in v) {
    const items = (v as { items?: unknown }).items;
    if (Array.isArray(items)) return items as T[];
  }
  return [];
}

/**
 * Flatten infinite-query `pages` into a single `Task[]` (shared with the dashboard).
 * Always returns an array, even when `pages` is missing or empty.
 */
export function flattenTaskPages(pages: unknown[] | undefined): Task[] {
  if (!Array.isArray(pages) || pages.length === 0) return [];
  const out: Task[] = [];
  for (const p of pages) {
    const { items } = normalizeTasksPageResponse(p);
    for (const t of items) {
      if (t != null && String((t as Task).id ?? "").length > 0) out.push(t as Task);
    }
  }
  return out;
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
  const url = `${API_FETCH_BASE}/tasks?${query}`;
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
      `Cannot connect to backend at ${backendOrigin}. Local: start backend on port 4000 or set NEXT_PUBLIC_USE_API_PROXY=true. Production: set NEXT_PUBLIC_API_BASE_URL; on Render set ALLOWED_ORIGIN to include your frontend origin(s).`,
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

const roleHeaders = (role: "admin" | "lead" | "member" = currentAuthRole): HeadersInit => {
  const elevatedRole = role === "member" && isAppAdminEmail(currentAuthUserEmail) ? "admin" : role;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-role": elevatedRole,
  };
  if (currentAuthUserId) {
    headers["x-user-id"] = currentAuthUserId;
  }
  if (currentAuthUserEmail) {
    headers["x-user-email"] = currentAuthUserEmail;
  }
  return headers;
};

export async function getMembers(): Promise<Member[]> {
  const raw = await requestJson<unknown>(`${API_FETCH_BASE}/members`);
  return safeArray<Member>(raw);
}

export async function createMember(payload: Omit<Member, "id" | "memberCode">): Promise<Member> {
  return requestJson<Member>(`${API_FETCH_BASE}/members`, {
    method: "POST",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateMember(id: string, payload: Partial<Omit<Member, "id">>): Promise<Member> {
  return requestJson<Member>(`${API_FETCH_BASE}/members/${id}`, {
    method: "PATCH",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteMember(id: string): Promise<void> {
  await requestJson<{ status: string }>(`${API_FETCH_BASE}/members/${id}`, {
    method: "DELETE",
    headers: roleHeaders(),
  });
}

export type AdminCreateAccountPayload = {
  fullName: string;
  email: string;
  role: "admin" | "lead" | "member";
  team: string;
  password: string;
  mustChangePassword: boolean;
};

export async function createAccountAsAdmin(payload: AdminCreateAccountPayload): Promise<{
  member: Member;
  account: { email: string; mustChangePassword: boolean };
}> {
  return requestJson(`${API_FETCH_BASE}/auth/users`, {
    method: "POST",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getProjects(): Promise<Project[]> {
  const raw = await requestJson<unknown>(`${API_FETCH_BASE}/projects`);
  return safeArray<Project>(raw);
}

export async function getProjectMembers(projectId: string): Promise<ProjectMemberAssignment[]> {
  return requestJson<ProjectMemberAssignment[]>(`${API_FETCH_BASE}/projects/${projectId}/members`);
}

export async function createProject(
  payload: Omit<Project, "id" | "projectCode">,
): Promise<Project> {
  return requestJson<Project>(`${API_FETCH_BASE}/projects`, {
    method: "POST",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function deleteProject(id: string): Promise<void> {
  await requestJson<{ status: string }>(`${API_FETCH_BASE}/projects/${id}`, {
    method: "DELETE",
    headers: roleHeaders(),
  });
}

export async function updateProject(id: string, payload: Partial<Omit<Project, "id">>): Promise<Project> {
  return requestJson<Project>(`${API_FETCH_BASE}/projects/${id}`, {
    method: "PATCH",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function assignProjectMember(
  projectId: string,
  payload: { memberId: string; assignmentRole: "owner" | "lead" | "contributor"; allocationPercent: number },
): Promise<ProjectMemberAssignment> {
  return requestJson<ProjectMemberAssignment>(`${API_FETCH_BASE}/projects/${projectId}/members`, {
    method: "POST",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function removeProjectMember(projectId: string, memberId: string): Promise<void> {
  await requestJson<{ status: string }>(`${API_FETCH_BASE}/projects/${projectId}/members/${memberId}`, {
    method: "DELETE",
    headers: roleHeaders(),
  });
}

export async function createTask(payload: Omit<Task, "id" | "status" | "taskCode">): Promise<Task> {
  return requestJson<Task>(`${API_FETCH_BASE}/tasks`, {
    method: "POST",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function updateTask(id: string, payload: Partial<Omit<Task, "id">>): Promise<Task> {
  return requestJson<Task>(`${API_FETCH_BASE}/tasks/${id}`, {
    method: "PATCH",
    headers: roleHeaders(),
    body: JSON.stringify(payload),
  });
}

export async function getTaskHistory(taskId: string): Promise<TaskHistoryItem[]> {
  return requestJson<TaskHistoryItem[]>(`${API_FETCH_BASE}/tasks/${taskId}/history`);
}
