"use client";

import { keyframes } from "@emotion/react";
import { memo, useEffect, useRef } from "react";
import { flexRender, getCoreRowModel, useReactTable, type Row } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { alpha, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, useTheme } from "@mui/material";
import type { Member } from "@shared/types/domain";
import type { TaskTableMeta } from "@/components/task-table/task-table-meta";
import { getRowEditingField } from "@/components/task-table/task-table-meta";
import type { TaskTableRow } from "@/components/task-table/task-table-types";
import { safeArray } from "@/lib/api";

const remoteUpdateFlash = keyframes`
  0% { background-color: rgba(250, 204, 21, 0.42); }
  100% { background-color: transparent; }
`;

/** Matches estimateSize — rows may grow slightly with wrapped text; padding keeps layout stable. */
const TASK_TABLE_ROW_ESTIMATE_PX = 56;

type TaskTableRowProps = {
  row: Row<TaskTableRow>;
  editingField: ReturnType<typeof getRowEditingField>;
  canMutateTasks: boolean;
  members: Member[];
  mounted: boolean;
  timelineMonthDays: Date[];
  rowRemoteFlash: boolean;
  virtualSize: number;
};

function taskRowPropsEqual(prev: TaskTableRowProps, next: TaskTableRowProps): boolean {
  return (
    prev.row.original === next.row.original &&
    prev.editingField === next.editingField &&
    prev.canMutateTasks === next.canMutateTasks &&
    prev.members === next.members &&
    prev.mounted === next.mounted &&
    prev.timelineMonthDays === next.timelineMonthDays &&
    prev.rowRemoteFlash === next.rowRemoteFlash &&
    prev.virtualSize === next.virtualSize
  );
}

/** One table body row: memoized so sibling rows skip re-render when only another task updates. */
export const TaskRow = memo(function TaskRow({
  row,
  rowRemoteFlash,
  virtualSize,
}: TaskTableRowProps) {
  const theme = useTheme();
  return (
    <TableRow
      sx={
        rowRemoteFlash
          ? {
              animation: `${remoteUpdateFlash} 2s ease-out forwards`,
              outline: `1px solid ${alpha(theme.palette.warning.main, 0.45)}`,
              minHeight: virtualSize,
            }
          : { minHeight: virtualSize }
      }
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}, taskRowPropsEqual);

export default function TaskDataTable({
  columns,
  data,
  minTableWidth,
  tableMeta,
  scrollContainerMaxHeight = 560,
  fetchNextPage,
  hasNextPage = false,
  isFetchingNextPage = false,
}: {
  columns: import("@tanstack/react-table").ColumnDef<TaskTableRow>[];
  data: TaskTableRow[];
  minTableWidth?: number;
  tableMeta: TaskTableMeta;
  /** Vertical viewport for the task list (inner scroll). */
  scrollContainerMaxHeight?: number;
  fetchNextPage?: () => void | Promise<unknown>;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}) {
  const safeData = Array.isArray(data) ? data : [];
  const table = useReactTable({
    data: safeData,
    columns,
    meta: tableMeta,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });

  const { activeTaskCell, canMutateTasks, members, mounted, timelineMonthDays, isTaskRowFlashing } = tableMeta;
  const safeMembers = safeArray<Member>(members);

  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const colCount = table.getVisibleLeafColumns().length;

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => TASK_TABLE_ROW_ESTIMATE_PX,
    overscan: 10,
    getItemKey: (index) => rows[index]?.id ?? index,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const firstVirt = virtualItems[0];
  const lastVirt = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1] : undefined;
  const paddingTop = firstVirt !== undefined ? firstVirt.start : 0;
  const paddingBottom =
    lastVirt !== undefined ? rowVirtualizer.getTotalSize() - lastVirt.end : 0;

  useEffect(() => {
    if (!fetchNextPage || !hasNextPage || isFetchingNextPage) return;
    const last = virtualItems[virtualItems.length - 1];
    if (!last) return;
    if (last.index >= rows.length - 4) {
      void fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, rows.length, virtualItems]);

  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      ref={scrollRef}
      sx={{
        maxHeight: scrollContainerMaxHeight,
        overflow: "auto",
        // Ẩn thanh cuộn (ngang + dọc); vẫn cuộn bình thường bằng wheel / trackpad / phím
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      <Table size="small" stickyHeader sx={minTableWidth ? { minWidth: minTableWidth } : undefined}>
        <TableHead>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>
              {group.headers.map((header) => (
                <TableCell key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableHead>
        <TableBody>
          {paddingTop > 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} sx={{ p: 0, border: "none", height: paddingTop }} />
            </TableRow>
          ) : null}
          {virtualItems.map((v) => {
            const row = rows[v.index];
            if (!row) return null;
            return (
              <TaskRow
                key={row.id}
                row={row}
                rowRemoteFlash={isTaskRowFlashing(row.original.id)}
                editingField={getRowEditingField(row.original.id, activeTaskCell)}
                canMutateTasks={canMutateTasks}
                members={safeMembers}
                mounted={mounted}
                timelineMonthDays={timelineMonthDays}
                virtualSize={v.size}
              />
            );
          })}
          {paddingBottom > 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} sx={{ p: 0, border: "none", height: paddingBottom }} />
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
