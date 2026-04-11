"use client";

import { memo } from "react";
import { flexRender, getCoreRowModel, useReactTable, type Row } from "@tanstack/react-table";
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from "@mui/material";
import type { Member } from "@shared/types/domain";
import type { TaskTableMeta } from "@/components/task-table/task-table-meta";
import { getRowEditingField } from "@/components/task-table/task-table-meta";
import type { TaskTableRow } from "@/components/task-table/task-table-types";

type TaskTableRowProps = {
  row: Row<TaskTableRow>;
  editingField: ReturnType<typeof getRowEditingField>;
  canMutateTasks: boolean;
  members: Member[];
  mounted: boolean;
  timelineMonthDays: Date[];
};

function taskRowPropsEqual(prev: TaskTableRowProps, next: TaskTableRowProps): boolean {
  return (
    prev.row.original === next.row.original &&
    prev.editingField === next.editingField &&
    prev.canMutateTasks === next.canMutateTasks &&
    prev.members === next.members &&
    prev.mounted === next.mounted &&
    prev.timelineMonthDays === next.timelineMonthDays
  );
}

/** One table body row: memoized so sibling rows skip re-render when only another task updates. */
export const TaskRow = memo(function TaskRow({
  row,
}: TaskTableRowProps) {
  return (
    <TableRow>
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
}: {
  columns: import("@tanstack/react-table").ColumnDef<TaskTableRow>[];
  data: TaskTableRow[];
  minTableWidth?: number;
  tableMeta: TaskTableMeta;
}) {
  const table = useReactTable({
    data,
    columns,
    meta: tableMeta,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (r) => r.id,
  });

  const { activeTaskCell, canMutateTasks, members, mounted, timelineMonthDays } = tableMeta;

  return (
    <TableContainer component={Paper} variant="outlined" sx={{ overflowX: "auto" }}>
      <Table size="small" sx={minTableWidth ? { minWidth: minTableWidth } : undefined}>
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
          {table.getRowModel().rows.map((row) => (
            <TaskRow
              key={row.id}
              row={row}
              editingField={getRowEditingField(row.original.id, activeTaskCell)}
              canMutateTasks={canMutateTasks}
              members={members}
              mounted={mounted}
              timelineMonthDays={timelineMonthDays}
            />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
