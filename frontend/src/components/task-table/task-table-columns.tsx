"use client";

import { Box, MenuItem, TextField, Tooltip as MuiTooltip, Typography } from "@mui/material";
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
        return (
          <Box sx={{ flexGrow: 1, minWidth: 420 }}>
            <TaskDescriptionEditor
              key={`${row.original.id}-${row.original.title}`}
              taskId={row.original.id}
              currentTitle={row.original.title}
              canMutate={m.canMutateTasks}
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
        const isEditing =
          m.activeTaskCell?.taskId === row.original.id && m.activeTaskCell.field === "assignee";
        if (!isEditing) {
          return (
            <Typography
              variant="body2"
              sx={{ cursor: m.canMutateTasks ? "pointer" : "default", minWidth: 170, whiteSpace: "nowrap" }}
              onClick={() => {
                if (m.canMutateTasks) m.setActiveTaskCell({ taskId: row.original.id, field: "assignee" });
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
            {m.members.map((mem) => (
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
        const isEditing = m.activeTaskCell?.taskId === row.original.id && m.activeTaskCell.field === "start";
        if (!isEditing) {
          return (
            <Typography
              variant="body2"
              sx={{ cursor: m.canMutateTasks ? "pointer" : "default", minWidth: 120, whiteSpace: "nowrap" }}
              onClick={() => {
                if (m.canMutateTasks) m.setActiveTaskCell({ taskId: row.original.id, field: "start" });
              }}
            >
              {row.original.startDate}
            </Typography>
          );
        }
        return (
          <InlineDateEditor
            value={row.original.raw.plannedStartDate ?? new Date().toISOString().slice(0, 10)}
            canMutate={m.canMutateTasks}
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
        const isEditing = m.activeTaskCell?.taskId === row.original.id && m.activeTaskCell.field === "complete";
        if (!isEditing) {
          return (
            <Typography
              variant="body2"
              sx={{ cursor: m.canMutateTasks ? "pointer" : "default", minWidth: 130, whiteSpace: "nowrap" }}
              onClick={() => {
                if (m.canMutateTasks) m.setActiveTaskCell({ taskId: row.original.id, field: "complete" });
              }}
            >
              {row.original.completeDate}
            </Typography>
          );
        }
        return (
          <InlineDateEditor
            value={row.original.raw.dueDate}
            canMutate={m.canMutateTasks}
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
        const isEditing = m.activeTaskCell?.taskId === row.original.id && m.activeTaskCell.field === "priority";
        if (!isEditing) {
          return (
            <Typography
              variant="body2"
              sx={{ cursor: m.canMutateTasks ? "pointer" : "default", minWidth: 110, whiteSpace: "nowrap" }}
              onClick={() => {
                if (m.canMutateTasks) m.setActiveTaskCell({ taskId: row.original.id, field: "priority" });
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
            disabled={!m.canMutateTasks}
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
        const progress = row.original.progress;
        const dueDate = new Date(row.original.raw.dueDate);
        if (!m.mounted) {
          return (
            <Box sx={{ minWidth: 120 }}>
              <ProgressEditor
                key={`${row.original.id}-${progress}`}
                taskId={row.original.id}
                currentProgress={progress}
                canMutate={m.canMutateTasks}
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
                  key={`${row.original.id}-${progress}`}
                  taskId={row.original.id}
                  currentProgress={progress}
                  canMutate={m.canMutateTasks}
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
          <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${timelineMonthDays.length}, 11px)`, gap: 0.25, mt: 0.5 }}>
            {timelineMonthDays.map((d) => {
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              return (
                <Box
                  key={`h-${d.toISOString().slice(0, 10)}`}
                  sx={{
                    width: 11,
                    height: 11,
                    borderRadius: 0.5,
                    border: "1px solid",
                    borderColor: "grey.300",
                    bgcolor: isWeekend ? "rgba(244,67,54,0.08)" : "white",
                    fontSize: 8,
                    lineHeight: "11px",
                    textAlign: "center",
                    color: isWeekend ? "error.light" : "text.secondary",
                  }}
                >
                  {d.getDate()}
                </Box>
              );
            })}
          </Box>
        </Box>
      ),
      cell: ({ row }) => {
        const days = timelineMonthDays;
        const start = toDayStart(row.original.raw.plannedStartDate ?? row.original.raw.dueDate);
        const end = toDayStart(row.original.raw.dueDate);
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

        return (
          <Box sx={{ minWidth: 360, py: 0.5 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${days.length}, 11px)`, gap: 0.25 }}>
              {days.map((d) => {
                const dayTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                const weekend = isWeekendDate(d);
                const inRange = dayTs >= rangeStart && dayTs <= rangeEnd;
                const filled = inRange && !weekend;
                return (
                  <Box
                    key={`${row.original.id}-${d.toISOString().slice(0, 10)}`}
                    sx={{
                      width: 11,
                      height: 11,
                      borderRadius: 0.5,
                      border: "1px solid",
                      borderColor: "grey.300",
                      bgcolor: filled ? (invalidRange ? "error.light" : "rgba(66, 133, 244, 0.82)") : "transparent",
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        );
      },
    },
  ];
}
