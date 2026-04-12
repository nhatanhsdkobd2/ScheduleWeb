import type { InfiniteData } from "@tanstack/react-query";
import type { Task } from "@shared/types/domain";
import type { TasksPageResponse } from "@/lib/api";
import { TASK_PAGE_SIZE } from "@/lib/api";

/** Rebuild infinite-query pages from a flat list (e.g. after socket merge). */
export function tasksToInfiniteData(
  tasks: Task[],
  total: number,
  pageSize: number = TASK_PAGE_SIZE,
): InfiniteData<TasksPageResponse, number> {
  const pages: TasksPageResponse[] = [];
  for (let i = 0; i < tasks.length; i += pageSize) {
    pages.push({ items: tasks.slice(i, i + pageSize), total });
  }
  if (pages.length === 0) {
    pages.push({ items: [], total: 0 });
  }
  const pageParams = pages.map((_, i) => i * pageSize);
  return { pages, pageParams };
}
