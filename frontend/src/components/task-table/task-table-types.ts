import type { Task } from "@shared/types/domain";

/** Enriched row for the task table (virtualized list + export). */
export interface TaskTableRow {
  id: string;
  taskCode: string;
  title: string;
  projectName: string;
  assigneeName: string;
  startDate: string;
  days: number;
  completeDate: string;
  priority: string;
  progress: number;
  raw: Task;
}
