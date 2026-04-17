"use client";

import { Box, MenuItem, TextField, Tooltip as MuiTooltip, Typography, useTheme } from "@mui/material";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import type { Task } from "@shared/types/domain";
import { InlineDateEditor, ProgressEditor, TaskDescriptionEditor } from "@/components/task-table/task-table-editors";
import type { TaskTableMeta } from "@/components/task-table/task-table-meta";
import type { TaskTableRow } from "@/components/task-table/task-table-types";
import { isTaskOverdue, toDayStart, isWeekendDate } from "@/components/task-table/task-table-utils";

function meta(table: { options: { meta?: unknown } }): TaskTableMeta {
  return table.options.meta as TaskTableMeta;
}

/** Matches prior grid: 11px cells, ~2px gap (MUI spacing 0.25). */
const TL_CELL = 11;
const TL_GAP = 2;
const tlPitch = (): number => TL_CELL + TL_GAP;
const tlWidth = (dayCount: number): number => dayCount * TL_CELL + Math.max(0, dayCount - 1) * TL_GAP;

function TaskTimelineMonthHeader({ timelineMonthDays }: { timelineMonthDays: Date[] }) {
  const theme = useTheme();
  const pitch = tlPitch();
  const w = tlWidth(timelineMonthDays.length);
  const h = TL_CELL;
  return (
    <svg width={w} height={h} style={{ display: "block", marginTop: 4 }}>
      {timelineMonthDays.map((d, i) => {
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const x = i * pitch;
        return (
          <g key={`h-${d.toISOString().slice(0, 10)}`}>
            <rect
              x={x}
              y={0}
              width={TL_CELL}
              height={h}
              rx={2}
              fill={isWeekend ? "rgba(244,67,54,0.08)" : "#ffffff"}
              stroke={theme.palette.grey[300]}
              strokeWidth={1}
            />
            <text
              x={x + TL_CELL / 2}
              y={8}
              textAnchor="middle"
              fontSize={8}
              fill={isWeekend ? theme.palette.error.light : theme.palette.text.secondary}
            >
              {d.getDate()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function TaskTimelineRowSvgCell({ rowOriginal, days }: { rowOriginal: TaskTableRow; days: Date[] }) {
  const theme = useTheme();
  const start = toDayStart(rowOriginal.raw.plannedStartDate ?? rowOriginal.raw.dueDate);
  const end = toDayStart(rowOriginal.raw.dueDate);
  if (!start || !end || days.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        —
      </Typography>
    );
  }

  const startMs = start.getTime();
  const endMs = end.getTime();
  const rangeStart = Math.min(startMs, endMs);
  const rangeEnd = Math.max(startMs, endMs);
  const invalidRange = endMs < startMs;

  const pitch = tlPitch();
  const w = tlWidth(days.length);
  const h = TL_CELL;
  const border = theme.palette.grey[300];
  const fillDone = invalidRange ? theme.palette.error.light : "rgba(66, 133, 244, 0.82)";
  return (
    <Box sx={{ minWidth: 360, py: 0.5 }}>
      <svg width={w} height={h} style={{ display: "block" }}>
        {days.map((d, i) => {
          const dayTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          const weekend = isWeekendDate(d);
          const inRange = dayTs >= rangeStart && dayTs <= rangeEnd;
          const filled = inRange && !weekend;
          const x = i * pitch;
          return (
            <rect
              key={`${rowOriginal.id}-${d.toISOString().slice(0, 10)}`}
              x={x}
              y={0}
              width={TL_CELL}
              height={h}
              rx={2}
              fill={filled ? fillDone : "transparent"}
              stroke={border}
              strokeWidth={1}
            />
          );
        })}
      </svg>
    </Box>
  );
}

export function createTaskColumns(timelineMonthDays: Date[]): ColumnDef<TaskTableRow>[] {
  return [
    {
      id: "projectName",
      header: "Project Name",
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ minWidth: 120 }}>
          {row.original.projectName}
        </Typography>
      ),
    },
    {
      id: "title",
      header: "Task Description",
      accessorKey: "title",
      cell: ({ row, table }) => {
        const m = meta(table);
        const canEditThisTask = m.canEditTask(row.original.raw);
        return (
          <Box sx={{ flexGrow: 1, minWidth: 420 }}>
            <TaskDescriptionEditor
              key={row.original.id}
              taskId={row.original.id}
              currentTitle={row.original.title}
              canMutate={canEditThisTask}
              onCommit={m.commitTaskTitle}
            />
          </Box>
        );
      },
    },
    {
      id: "assigneeName",
      header: () => (
        <Box sx={{ minWidth: 170, whiteSpace: "nowrap" }}>
          Assigned to
        </Box>
      ),
      cell: ({ row, table }) => {
        const m = meta(table);
        const canEditThisTask = m.canEditTask(row.original.raw);
        const isEditing =
          m.activeTaskCell?.taskId === row.original.id && m.activeTaskCell.field === "assignee";
        const canEditAssignee = canEditThisTask && m.canMutateTasks && m.canAssignAnyMember;
        if (!isEditing) {
          return (
            <Typography
              variant="body2"
              sx={{ cursor: canEditAssignee ? "pointer" : "default", minWidth: 170, whiteSpace: "nowrap" }}
              onClick={() => {
                if (canEditAssignee) m.setActiveTaskCell({ taskId: row.original.id, field: "assignee" });
              }}
            >
              {row.original.assigneeName}
            </Typography>
          );
        }
        return (
          <TextField
            select
            size="small"
            variant="standard"
            fullWidth
            value={row.original.raw.assigneeMemberId}
            disabled={!m.canMutateTasks}
            InputProps={{ disableUnderline: true }}
            onChange={(e) => {
              m.updateTaskMutate({ id: row.original.id, payload: { assigneeMemberId: e.target.value } });
              m.setActiveTaskCell(null);
            }}
            onBlur={() => m.setActiveTaskCell(null)}
            autoFocus
            sx={{ minWidth: 170, "& .MuiSelect-select": { py: 0.5, whiteSpace: "nowrap" } }}
          >
            {m.assignableMembers.map((mem) => (
              <MenuItem key={mem.id} value={mem.id}>
                {mem.fullName}
              </MenuItem>
            ))}
          </TextField>
        );
      },
    },
    {
      id: "startDate",
      header: () => (
        <Box sx={{ minWidth: 120, whiteSpace: "nowrap" }}>
          Start Day
        </Box>
      ),
      cell: ({ row, table }) => {
        const m = meta(table);
        const canEditThisTask = m.canEditTask(row.original.raw);
        const isEditing = m.activeTaskCell?.taskId === row.original.id && m.activeTaskCell.field === "start";
        if (!isEditing) {
          return (
            <Typography
              variant="body2"
              sx={{ cursor: canEditThisTask ? "pointer" : "default", minWidth: 120, whiteSpace: "nowrap" }}
              onClick={() => {
                if (canEditThisTask) m.setActiveTaskCell({ taskId: row.original.id, field: "start" });
              }}
            >
              {row.original.startDate}
            </Typography>
          );
        }
        return (
          <InlineDateEditor
            value={row.original.raw.plannedStartDate ?? new Date().toISOString().slice(0, 10)}
            canMutate={canEditThisTask}
            onChange={(next) => m.updateTaskMutate({ id: row.original.id, payload: { plannedStartDate: next } })}
            onClose={() => m.setActiveTaskCell(null)}
          />
        );
      },
    },
    {
      id: "days",
      header: () => (
        <Box sx={{ minWidth: 70, whiteSpace: "nowrap" }}>
          Days
        </Box>
      ),
      cell: ({ row }) => (
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 70, whiteSpace: "nowrap" }}>
          {row.original.days}
        </Typography>
      ),
    },
    {
      id: "completeDate",
      header: () => (
        <Box sx={{ minWidth: 130, whiteSpace: "nowrap" }}>
          Complete
        </Box>
      ),
      cell: ({ row, table }) => {
        const m = meta(table);
        const canEditThisTask = m.canEditTask(row.original.raw);
        const isEditing = m.activeTaskCell?.taskId === row.original.id && m.activeTaskCell.field === "complete";
        if (!isEditing) {
          return (
            <Typography
              variant="body2"
              sx={{ cursor: canEditThisTask ? "pointer" : "default", minWidth: 130, whiteSpace: "nowrap" }}
              onClick={() => {
                if (canEditThisTask) m.setActiveTaskCell({ taskId: row.original.id, field: "complete" });
              }}
            >
              {row.original.completeDate}
            </Typography>
          );
        }
        return (
          <InlineDateEditor
            value={row.original.raw.dueDate}
            canMutate={canEditThisTask}
            onChange={(next) => m.updateTaskMutate({ id: row.original.id, payload: { dueDate: next } })}
            onClose={() => m.setActiveTaskCell(null)}
          />
        );
      },
    },
    {
      id: "priority",
      header: () => (
        <Box sx={{ minWidth: 110, whiteSpace: "nowrap" }}>
          Priority
        </Box>
      ),
      cell: ({ row, table }) => {
        const m = meta(table);
        const canEditThisTask = m.canEditTask(row.original.raw);
        const isEditing = m.activeTaskCell?.taskId === row.original.id && m.activeTaskCell.field === "priority";
        if (!isEditing) {
          return (
            <Typography
              variant="body2"
              sx={{ cursor: canEditThisTask ? "pointer" : "default", minWidth: 110, whiteSpace: "nowrap" }}
              onClick={() => {
                if (canEditThisTask) m.setActiveTaskCell({ taskId: row.original.id, field: "priority" });
              }}
            >
              {row.original.priority}
            </Typography>
          );
        }
        return (
          <TextField
            select
            size="small"
            variant="standard"
            fullWidth
            value={row.original.raw.priority}
            disabled={!canEditThisTask}
            InputProps={{ disableUnderline: true }}
            onChange={(e) => {
              m.updateTaskMutate({
                id: row.original.id,
                payload: { priority: e.target.value as Task["priority"] },
              });
              m.setActiveTaskCell(null);
            }}
            onBlur={() => m.setActiveTaskCell(null)}
            autoFocus
            sx={{ minWidth: 110, "& .MuiSelect-select": { py: 0.5, whiteSpace: "nowrap" } }}
          >
            <MenuItem value="low">Low</MenuItem>
            <MenuItem value="medium">Normal</MenuItem>
            <MenuItem value="high">High</MenuItem>
            <MenuItem value="critical">Critical</MenuItem>
          </TextField>
        );
      },
    },
    {
      id: "progress",
      header: "Progress",
      cell: ({ row, table }) => {
        const m = meta(table);
        const canEditThisTask = m.canEditTask(row.original.raw);
        const progress = row.original.progress;
        const dueDate = new Date(row.original.raw.dueDate);
        if (!m.mounted) {
          return (
            <Box sx={{ minWidth: 120 }}>
              <ProgressEditor
                key={row.original.id}
                taskId={row.original.id}
                currentProgress={progress}
                  canMutate={canEditThisTask}
                isOverdue={false}
                isDone={progress === 100}
                onCommit={m.commitProgress}
              />
            </Box>
          );
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const overdue = isTaskOverdue(row.original.raw, today);
        const daysOverdue = overdue ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
        const tooltipTitle =
          progress === 100 ? "Done" : overdue ? `Overdue ${daysOverdue}d` : "On track";

        return (
          <Box sx={{ minWidth: 120 }}>
            <MuiTooltip title={tooltipTitle} arrow>
              <Box>
                <ProgressEditor
                  key={row.original.id}
                  taskId={row.original.id}
                  currentProgress={progress}
                  canMutate={canEditThisTask}
                  isOverdue={overdue}
                  isDone={progress === 100}
                  onCommit={m.commitProgress}
                />
              </Box>
            </MuiTooltip>
          </Box>
        );
      },
    },
    {
      id: "timeline",
      header: () => (
        <Box sx={{ minWidth: 360 }}>
          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 700 }}>
            {timelineMonthDays[0] ? format(timelineMonthDays[0], "MMM yyyy") : "Timeline"}
          </Typography>
          <TaskTimelineMonthHeader timelineMonthDays={timelineMonthDays} />
        </Box>
      ),
      cell: ({ row }) => <TaskTimelineRowSvgCell rowOriginal={row.original} days={timelineMonthDays} />,
    },
  ];
}
