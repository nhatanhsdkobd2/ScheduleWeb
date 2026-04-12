import type { Task } from "@shared/types/domain";

/** Field-wise equality so unchanged server payloads can reuse the same object reference. */
export function taskFieldsEqual(a: Task, b: Task): boolean {
  return (
    a.id === b.id &&
    a.taskCode === b.taskCode &&
    a.title === b.title &&
    a.projectId === b.projectId &&
    a.assigneeMemberId === b.assigneeMemberId &&
    a.dueDate === b.dueDate &&
    (a.completedAt ?? "") === (b.completedAt ?? "") &&
    (a.plannedStartDate ?? "") === (b.plannedStartDate ?? "") &&
    (a.progress ?? 0) === (b.progress ?? 0) &&
    a.status === b.status &&
    a.priority === b.priority &&
    (a.deletedAt ?? "") === (b.deletedAt ?? "") &&
    (a.projectName ?? "") === (b.projectName ?? "")
  );
}

/**
 * When merging a refetched task list, reuse previous Task references where data is unchanged
 * so memoized rows stay stable. Always keeps the previous object for `protectedTaskId` if present.
 */
export function mergeTasksPreserveRefs(
  prev: Task[] | undefined,
  incoming: Task[],
  protectedTaskId: string | null,
): Task[] {
  const prevById = new Map((prev ?? []).map((t) => [t.id, t]));
  return incoming.map((next) => {
    if (protectedTaskId && next.id === protectedTaskId) {
      return prevById.get(next.id) ?? next;
    }
    const old = prevById.get(next.id);
    if (old && taskFieldsEqual(old, next)) return old;
    return next;
  });
}
