import type { Task } from "@shared/types/domain";

/** Map priority -> display label */
export function priorityLabel(priority: Task["priority"]): string {
  if (priority === "critical") return "Critical";
  if (priority === "high") return "High";
  if (priority === "medium") return "Normal";
  return "Low";
}

/** Format date as "Mon-DD-YYYY" — locale-fixed for SSR/CSR consistency */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const m = MONTHS[d.getMonth()];
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  return `${m}-${day}-${y}`;
}

function normalizeIsoDate(value: string | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toTodayIsoLocal(today: Date): string {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isTaskOverdue(task: Task, today: Date): boolean {
  const dueIso = normalizeIsoDate(task.dueDate);
  if (!dueIso) return false;
  const startIso = normalizeIsoDate(task.plannedStartDate);
  const hasInvalidRange = Boolean(startIso && dueIso < startIso);
  if (hasInvalidRange) return true;

  const progress = task.completedAt ? 100 : (task.progress ?? 0);
  if (progress >= 100) return false;

  const todayIso = toTodayIsoLocal(today);
  return dueIso < todayIso;
}

export function toDayStart(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isWeekendDate(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}
