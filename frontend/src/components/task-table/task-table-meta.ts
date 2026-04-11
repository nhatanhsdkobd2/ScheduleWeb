import type { Member, Task } from "@shared/types/domain";

export type ActiveTaskCellState = {
  taskId: string;
  field: "assignee" | "start" | "complete" | "priority";
} | null;

export interface TaskTableMeta {
  activeTaskCell: ActiveTaskCellState;
  mounted: boolean;
  canMutateTasks: boolean;
  members: Member[];
  timelineMonthDays: Date[];
  setActiveTaskCell: (next: ActiveTaskCellState) => void;
  updateTaskMutate: (args: { id: string; payload: Partial<Omit<Task, "id">> }) => void;
  commitProgress: (taskId: string, value: number, currentProgress: number) => void;
  commitTaskTitle: (taskId: string, value: string, currentTitle: string) => void;
  /** True when this row should play the remote-update highlight (2s). */
  isTaskRowFlashing: (taskId: string) => boolean;
}

export function getRowEditingField(
  rowId: string,
  active: ActiveTaskCellState,
): "assignee" | "start" | "complete" | "priority" | null {
  if (!active || active.taskId !== rowId) return null;
  return active.field;
}
