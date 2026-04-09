"use client";

import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Grid,
  InputAdornment,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Tooltip as MuiTooltip,
  Typography,
} from "@mui/material";
import { memo, useMemo, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { PickerDay, type PickerDayProps } from "@mui/x-date-pickers/PickerDay";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Member, Project, Task } from "@shared/types/domain";
import {
  createTask,
  createMember,
  createProject,
  deleteMember,
  deleteProject,
  getMembers,
  getProjects,
  getTasksByFilters,
  publicApiBaseUrl,
  updateProject,
  updateTask,
  updateMember,
} from "@/lib/api";
import { memberFormSchema, parseFormErrors, taskFormSchema, type FormErrors } from "@/lib/validation";
import FilterBar from "@/components/filter-bar";
import ProjectSelect from "@/components/project-select";
import DataTable from "@/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

/** Map priority -> display label */
function priorityLabel(priority: Task["priority"]): string {
  if (priority === "critical") return "Critical";
  if (priority === "high") return "High";
  if (priority === "medium") return "Normal";
  return "Low";
}

/** Format date as "Mon-DD-YYYY", e.g. "Apr-04-2026" — locale-fixed for SSR/CSR consistency */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const m = MONTHS[d.getMonth()];
  const day = String(d.getDate()).padStart(2, "0");
  const y = d.getFullYear();
  return `${m}-${day}-${y}`;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function countBusinessDaysInclusive(startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

  const startOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (endOnly.getTime() < startOnly.getTime()) return 0;
  if (endOnly.getTime() === startOnly.getTime()) return 1;

  let count = 0;
  const cursor = new Date(startOnly);
  while (cursor.getTime() <= endOnly.getTime()) {
    const day = cursor.getDay(); // 0: Sun, 6: Sat
    if (day >= 1 && day <= 5) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function toDateOrNull(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function toIsoDate(value: Date | null): string | undefined {
  if (!value) return undefined;
  return format(value, "yyyy-MM-dd");
}

function toDayStart(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

function getMonthDays(anchor: Date): Date[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: dayCount }, (_, i) => new Date(year, month, i + 1));
}

function isTaskOverdue(task: Task, today: Date): boolean {
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

function WeekendDay(props: PickerDayProps) {
  const dayOfWeek = props.day.getDay(); // 0: Sunday, 6: Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  return (
    <PickerDay
      {...props}
      sx={{
        ...(isWeekend
          ? {
              color: "error.light",
              backgroundColor: props.selected ? "rgba(244, 67, 54, 0.25)" : "rgba(244, 67, 54, 0.08)",
            }
          : {}),
      }}
    />
  );
}

function KpiStatCard({
  title,
  value,
  icon,
  onClick,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Box
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md"
      sx={{ cursor: onClick ? "pointer" : "default" }}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <Box className="mb-4 flex items-start justify-between">
        <Typography className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {title}
        </Typography>
        <Box className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          {icon}
        </Box>
      </Box>
      <Typography className="text-3xl font-bold leading-none text-slate-900">{value}</Typography>
    </Box>
  );
}

function DateFilterField({
  label,
  value,
  onChange,
  minWidth = 220,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minWidth?: number;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <TextField
      label={label}
      size="small"
      type="date"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      InputLabelProps={{ shrink: true }}
      inputRef={inputRef}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <Box
              component="button"
              type="button"
              aria-label={`Open ${label} calendar`}
              className="text-slate-400 transition-colors duration-300 hover:text-slate-600"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                const input = inputRef.current;
                if (!input) return;
                if (typeof input.showPicker === "function") {
                  input.showPicker();
                } else {
                  input.focus();
                }
              }}
              sx={{ border: 0, background: "transparent", p: 0, cursor: "pointer", lineHeight: 1 }}
            >
              📅
            </Box>
          </InputAdornment>
        ),
      }}
      sx={{
        minWidth,
        "& .MuiOutlinedInput-root": {
          borderRadius: "12px",
          backgroundColor: "#fff",
          transition: "all 300ms",
        },
        "& input[type='date']::-webkit-calendar-picker-indicator": {
          opacity: 0,
          position: "absolute",
          right: 0,
          width: 0,
          pointerEvents: "none",
        },
        "& fieldset": { borderColor: "#e5e7eb" },
        "& .MuiOutlinedInput-root:hover fieldset": { borderColor: "#cbd5e1" },
      }}
    />
  );
}

/** Export tasks + gantt timeline as styled XLSX */
async function exportTasksToXLSX(rows: TaskTableRow[], timelineDays: Date[]): Promise<void> {
  const timelineMonthLabel = timelineDays[0] ? format(timelineDays[0], "MMM-yyyy") : "Timeline";
  const timelineHeaders = timelineDays.map((d) => `${timelineMonthLabel}-${String(d.getDate()).padStart(2, "0")}`);
  const headers = [
    "Project Name",
    "Task Description",
    "Assigned To",
    "Start Day",
    "Days",
    "Complete",
    "Priority",
    "Progress",
    ...timelineHeaders,
  ];
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Tasks");
  ws.addRow(headers);

  const fixedCols = 8; // before timeline starts
  const timelineStartCol = fixedCols + 1;
  ws.getRow(1).font = { bold: true };
  // Keep a single contiguous sheet region (no vertical pane split).
  ws.views = [{ state: "frozen", ySplit: 1 }];

  for (const row of rows) {
    const start = toDayStart(row.raw.plannedStartDate ?? row.raw.dueDate);
    const end = toDayStart(row.raw.dueDate);
    const startMs = start?.getTime() ?? 0;
    const endMs = end?.getTime() ?? 0;
    const rangeStart = Math.min(startMs, endMs);
    const rangeEnd = Math.max(startMs, endMs);

    const timelineCells = timelineDays.map((d) => {
      const dayMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const inRange = start && end && dayMs >= rangeStart && dayMs <= rangeEnd;
      return inRange && !isWeekend(d);
    });

    const rowValues = [
      row.projectName,
      row.title,
      row.assigneeName,
      row.startDate || "",
      row.days,
      row.completeDate || "",
      row.priority,
      `${row.progress}%`,
      ...timelineCells.map((filled) => (filled ? " " : "")),
    ];
    const excelRow = ws.addRow(rowValues);

    timelineCells.forEach((filled, idx) => {
      if (!filled) return;
      const c = excelRow.getCell(timelineStartCol + idx);
      c.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4A90E2" },
      };
      c.border = {
        top: { style: "thin", color: { argb: "FF4A90E2" } },
        left: { style: "thin", color: { argb: "FF4A90E2" } },
        bottom: { style: "thin", color: { argb: "FF4A90E2" } },
        right: { style: "thin", color: { argb: "FF4A90E2" } },
      };
    });
  }

  ws.columns = [
    { width: 18 },
    { width: 36 },
    { width: 24 },
    { width: 14 },
    { width: 8 },
    { width: 14 },
    { width: 10 },
    { width: 10 },
    ...timelineDays.map(() => ({ width: 3 })),
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tasks-export-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Enriched row type for the task table */
interface TaskTableRow {
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

const ProgressEditor = memo(function ProgressEditor({
  taskId,
  currentProgress,
  canMutate,
  isOverdue,
  isDone,
  onCommit,
}: {
  taskId: string;
  currentProgress: number;
  canMutate: boolean;
  isOverdue: boolean;
  isDone: boolean;
  onCommit: (taskId: string, value: number, currentProgress: number) => void;
}) {
  const [draft, setDraft] = useState<string>(String(currentProgress));
  const fillPercent = Math.min(100, Math.max(0, Number.isFinite(Number(draft)) ? Number(draft) : currentProgress));

  return (
    <Box
      sx={{
        position: "relative",
        width: 120,
        height: 28,
        borderRadius: 1,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "grey.300",
        bgcolor: "grey.100",
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${fillPercent}%`,
          bgcolor: isOverdue ? "rgba(255, 152, 152, 0.45)" : isDone ? "rgba(129, 199, 132, 0.65)" : "rgba(129, 199, 132, 0.55)",
          transition: "width 120ms ease",
        },
      }}
    >
      <TextField
        size="small"
        variant="standard"
        value={`${draft}%`}
        disabled={!canMutate}
        InputProps={{ disableUnderline: true }}
        inputProps={{ style: { textAlign: "center", padding: "3px 6px", fontWeight: 600, fontSize: "0.92rem", color: "#000" } }}
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          "& .MuiInputBase-root": { height: "100%" },
          "& input": { color: "#000 !important" },
        }}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          if (!digits) {
            setDraft("0");
            return;
          }
          const normalized = String(Math.min(100, Math.max(0, Number(digits))));
          setDraft(normalized);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            const parsed = Number(draft);
            const clamped = Math.min(100, Math.max(0, Number.isFinite(parsed) ? parsed : currentProgress));
            onCommit(taskId, clamped, currentProgress);
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setDraft(String(currentProgress));
          }
        }}
      />
    </Box>
  );
});

const TaskDescriptionEditor = memo(function TaskDescriptionEditor({
  taskId,
  currentTitle,
  canMutate,
  onCommit,
}: {
  taskId: string;
  currentTitle: string;
  canMutate: boolean;
  onCommit: (taskId: string, value: string, currentTitle: string) => void;
}) {
  const [draft, setDraft] = useState<string>(currentTitle);

  return (
    <TextField
      size="small"
      variant="standard"
      fullWidth
      value={draft}
      disabled={!canMutate}
      InputProps={{ disableUnderline: true }}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(taskId, draft, currentTitle);
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setDraft(currentTitle);
        }
      }}
      sx={{
        "& input": { py: 0.5, whiteSpace: "normal", overflow: "visible" },
      }}
    />
  );
});

const InlineDateEditor = memo(function InlineDateEditor({
  value,
  canMutate,
  onChange,
  onClose,
}: {
  value: string;
  canMutate: boolean;
  onChange: (next: string) => void;
  onClose?: () => void;
}) {
  return (
    <DatePicker
      value={toDateOrNull(value)}
      onChange={(next) => {
        const normalized = toIsoDate(next);
        if (normalized) onChange(normalized);
        onClose?.();
      }}
      disabled={!canMutate}
      slots={{ day: WeekendDay }}
      format="MM/dd/yyyy"
      slotProps={{
        textField: {
          size: "small",
          variant: "standard",
          sx: {
            width: 150,
            "& .MuiInput-underline:before": { borderBottom: "0 !important" },
            "& .MuiInput-underline:hover:not(.Mui-disabled):before": { borderBottom: "0 !important" },
            "& .MuiInput-underline:after": { borderBottom: "0 !important" },
            "& .MuiInputBase-root:before": { borderBottom: "0 !important" },
            "& .MuiInputBase-root:hover:not(.Mui-disabled):before": { borderBottom: "0 !important" },
            "& .MuiInputBase-root:after": { borderBottom: "0 !important" },
            "& input": { py: 0.5, width: 98 },
          },
        },
      }}
    />
  );
});

export default function DashboardClient() {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [activeTab, setActiveTab] = useState(0);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedRole, setSelectedRole] = useState<"admin" | "pm" | "lead" | "member">("lead");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const taskTitleInputRef = useRef<HTMLInputElement | null>(null);
  const [taskTitleInputKey, setTaskTitleInputKey] = useState(0);
  const memberFullNameInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const memberEmailInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [memberFormInputKey, setMemberFormInputKey] = useState(0);
  const projectNameInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [projectFormInputKey, setProjectFormInputKey] = useState(0);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [selectedMemberId, setSelectedMemberId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [memberErrors, setMemberErrors] = useState<FormErrors>({});
  const [taskErrors, setTaskErrors] = useState<FormErrors>({});
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [projectErrors, setProjectErrors] = useState<FormErrors>({});
  const [activeTaskCell, setActiveTaskCell] = useState<{ taskId: string; field: "assignee" | "start" | "complete" | "priority" } | null>(null);
  const [taskRowsVisible, setTaskRowsVisible] = useState(50);
  const [isTaskListLoadingMore, setIsTaskListLoadingMore] = useState(false);
  const taskListLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const taskListLoadTimerRef = useRef<number | null>(null);
  const [projectForm, setProjectForm] = useState<{
    name: string;
    description: string;
    status: Project["status"];
  }>({
    name: "",
    description: "",
    status: "active",
  });

  const DEFAULT_PROJECT_FORM = {
    name: "",
    description: "",
    status: "active" as Project["status"],
  };

  const [memberForm, setMemberForm] = useState<Omit<Member, "id" | "memberCode">>({
    fullName: "",
    email: "",
    role: "member",
    team: "Mobile Team",
    status: "active",
  });
  const [taskForm, setTaskForm] = useState<Omit<Task, "id" | "status" | "taskCode">>({
    title: "",
    projectId: "",
    assigneeMemberId: "",
    dueDate: "",
    priority: "medium",
    plannedStartDate: "",
  });

  const membersQuery = useQuery<Member[]>({ queryKey: ["members"], queryFn: getMembers });
  const projectsQuery = useQuery<Project[]>({ queryKey: ["projects"], queryFn: getProjects });
  const tasksQueryKey = useMemo(
    () => ["tasks", selectedProjectId, selectedMemberId, dateFrom, dateTo] as const,
    [selectedProjectId, selectedMemberId, dateFrom, dateTo],
  );
  const tasksQuery = useQuery<Task[]>({
    queryKey: tasksQueryKey,
    queryFn: () =>
      getTasksByFilters({
        projectId: selectedProjectId === "all" ? undefined : selectedProjectId,
        memberId: selectedMemberId === "all" ? undefined : selectedMemberId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });
  const totalTasksQuery = useQuery<Task[]>({
    queryKey: ["tasks-total-count"],
    queryFn: () => getTasksByFilters({}),
  });

  const canMutate = selectedRole !== "member";

  const patchTaskInCurrentQuery = useCallback((taskId: string, patch: Partial<Task>) => {
    queryClient.setQueryData<Task[]>(tasksQueryKey, (prev) => {
      if (!prev) return prev;
      return prev.map((item) => (item.id === taskId ? { ...item, ...patch } : item));
    });
  }, [queryClient, tasksQueryKey]);

  const createMemberMutation = useMutation({
    mutationFn: createMember,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      setDialogOpen(false);
    },
  });
  const updateMemberMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<Member, "id">> }) => updateMember(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      setDialogOpen(false);
    },
  });
  const deleteMemberMutation = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
  const createTaskMutation = useMutation({
    mutationFn: (payload: Omit<Task, "id" | "status" | "taskCode">) => createTask(payload),
    onSuccess: () => {
      setTaskDrawerOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<Task, "id">> }) => updateTask(id, payload),
    onMutate: ({ id, payload }) => {
      const snapshot = queryClient.getQueryData<Task[]>(tasksQueryKey);
      patchTaskInCurrentQuery(id, payload as Partial<Task>);
      return { snapshot };
    },
    onError: (_error, _variables, context) => {
      if (!context?.snapshot) return;
      queryClient.setQueryData(tasksQueryKey, context.snapshot);
    },
    onSuccess: (updatedTask) => {
      if (updatedTask?.id) {
        patchTaskInCurrentQuery(updatedTask.id, updatedTask);
      }
      // Only close drawer when editing an existing task (not inline cell edits)
      if (editTask !== null) {
        setTaskDrawerOpen(false);
      }
    },
  });
  const createProjectMutation = useMutation({
    mutationFn: (payload: Omit<Project, "id" | "projectCode">) => createProject(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setProjectDialogOpen(false);
      setProjectForm(DEFAULT_PROJECT_FORM);
    },
  });
  const deleteProjectMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
  const updateProjectMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<Project, "id">> }) => updateProject(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      setProjectDialogOpen(false);
    },
  });

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const totalTasksCount = totalTasksQuery.data?.length ?? tasks.length;
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  const commitProgress = useCallback(
    (taskId: string, value: number, currentProgress: number) => {
      if (value !== currentProgress) {
        updateTaskMutation.mutate({ id: taskId, payload: { progress: value } });
      }
    },
    [updateTaskMutation],
  );
  const commitTaskTitle = useCallback(
    (taskId: string, value: string, currentTitle: string) => {
      const next = value.trim();
      if (!next || next === currentTitle) return;
      updateTaskMutation.mutate({ id: taskId, payload: { title: next } });
    },
    [updateTaskMutation],
  );

  /** Default IDs for new task creation */
  const defaultProjectId = useMemo(
    () => projects.find((p) => p.name === "RSPro Production")?.id ?? projects[0]?.id ?? "",
    [projects],
  );
  const defaultMemberId = useMemo(
    () => members.find((m) => m.fullName === "Hoàng Văn Nhật Anh")?.id ?? members[0]?.id ?? "",
    [members],
  );

  const filteredMembers = useMemo(() => {
    return members
      .filter((item) => (selectedTeam === "all" ? true : item.team === selectedTeam))
      .filter((item) => (selectedMemberId === "all" ? true : item.id === selectedMemberId))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [members, selectedTeam, selectedMemberId]);
  const filteredTasks = useMemo(() => {
    // Build set of member IDs that match current team filter
    const teamMemberIds =
      selectedTeam === "all"
        ? null
        : new Set(members.filter((m) => m.team === selectedTeam).map((m) => m.id));

    return tasks.filter((item) => {
      // Team filter: check via member
      if (teamMemberIds && !teamMemberIds.has(item.assigneeMemberId)) return false;
      // Project filter
      if (selectedProjectId !== "all" && item.projectId !== selectedProjectId) return false;
      // Member filter
      if (selectedMemberId !== "all" && item.assigneeMemberId !== selectedMemberId) return false;
      // Date range filter
      if (dateFrom && item.dueDate < dateFrom) return false;
      if (dateTo && item.dueDate > dateTo) return false;
      // Search filter
      return true;
    });
  }, [tasks, members, selectedTeam, selectedProjectId, selectedMemberId, dateFrom, dateTo]);

  /** Derived rows for Task table */
  const taskTableRows = useMemo<TaskTableRow[]>(() => {
    return filteredTasks.map((task) => {
      const project = projects.find((p) => p.id === task.projectId);
      const member = members.find((m) => m.id === task.assigneeMemberId);
      // Use plannedStartDate if set; if not, use today only after mount (avoids hydration mismatch)
      // During SSR / before mount, fallback to empty string → format shows "Invalid Date" but harmless
      const startDateStr = task.plannedStartDate ?? (mounted ? new Date().toISOString().slice(0, 10) : "");
      const days = mounted && startDateStr ? countBusinessDaysInclusive(startDateStr, task.dueDate) : 0;
      // Progress: completedAt => 100, otherwise stored progress or 0
      const progress = task.completedAt ? 100 : (task.progress ?? 0);
      return {
        id: task.id,
        taskCode: task.taskCode,
        title: task.title,
        projectName: project?.name ?? "—",
        assigneeName: member?.fullName ?? "—",
        startDate: mounted ? formatDate(startDateStr || task.dueDate) : formatDate(task.dueDate),
        days,
        completeDate: formatDate(task.dueDate),
        priority: priorityLabel(task.priority),
        progress,
        raw: task,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTasks, projects, members, mounted]);

  const timelineMonthDays = useMemo(() => {
    // Tasks timeline always follows the current month.
    if (!mounted) return [];
    return getMonthDays(new Date());
  }, [mounted]);

  const summary = useMemo(() => {
    const today = mounted ? new Date() : null;
    const openTasks = filteredTasks.filter((task) => !(task.completedAt || task.progress === 100));
    const overdueTasks = today ? filteredTasks.filter((task) => isTaskOverdue(task, today)).length : 0;
    const activeProjects =
      selectedProjectId === "all"
        ? projects.filter((project) => project.status === "active").length
        : projects.filter((project) => project.id === selectedProjectId && project.status === "active").length;
    return {
      activeMembers: filteredMembers.filter((member) => member.status === "active").length,
      activeProjects,
      openTasks: openTasks.length,
      overdueTasks,
    };
  }, [filteredMembers, filteredTasks, projects, selectedProjectId, mounted]);

  const delayTrendData = useMemo(() => {
    const monthMap = new Map<string, { delayedTasks: number; totalDelay: number; count: number }>();
    for (const task of filteredTasks) {
      if (!task.completedAt) continue;
      const period = task.completedAt.slice(0, 7);
      const due = new Date(task.dueDate).getTime();
      const done = new Date(task.completedAt).getTime();
      const delayDays = Math.max(0, Math.floor((done - due) / (24 * 60 * 60 * 1000)));
      const current = monthMap.get(period) ?? { delayedTasks: 0, totalDelay: 0, count: 0 };
      current.count += 1;
      current.totalDelay += delayDays;
      if (delayDays > 0) current.delayedTasks += 1;
      monthMap.set(period, current);
    }
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, stat]) => ({
        period,
        delayedTasks: stat.delayedTasks,
        avgDelayDays: Number((stat.count === 0 ? 0 : stat.totalDelay / stat.count).toFixed(2)),
      }));
  }, [filteredTasks]);

  const performanceChartData = useMemo(() => {
    const now = mounted ? new Date() : null;
    return filteredMembers.map((member) => {
      const ownTasks = filteredTasks.filter((task) => task.assigneeMemberId === member.id);
      const overdueCount = now ? ownTasks.filter((task) => isTaskOverdue(task, now)).length : 0;
      // New rule: each overdue task deducts 1 point from 100.
      const score = Math.max(0, 100 - overdueCount);
      return {
        name: member.fullName,
        score,
        overdueCount,
      };
    });
  }, [filteredMembers, filteredTasks, mounted]);
  const workloadByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of filteredTasks) {
      map.set(item.assigneeMemberId, (map.get(item.assigneeMemberId) ?? 0) + 1);
    }
    return members.map((member) => ({ name: member.fullName, tasks: map.get(member.id) ?? 0 }));
  }, [members, filteredTasks]);
  const memberChartInnerHeight = useMemo(() => Math.max(420, members.length * 28), [members.length]);
  const memberChartCardHeight = memberChartInnerHeight + 90;

  const visibleTaskRows = useMemo(
    () => taskTableRows.slice(0, taskRowsVisible),
    [taskTableRows, taskRowsVisible],
  );
  const triggerTaskRowsLoadMore = useCallback(() => {
    if (isTaskListLoadingMore) return;
    if (visibleTaskRows.length >= taskTableRows.length) return;
    if (taskListLoadTimerRef.current !== null) return;

    setIsTaskListLoadingMore(true);
    taskListLoadTimerRef.current = window.setTimeout(() => {
      setTaskRowsVisible((n) => Math.min(n + 50, taskTableRows.length));
      setIsTaskListLoadingMore(false);
      taskListLoadTimerRef.current = null;
    }, 260);
  }, [isTaskListLoadingMore, visibleTaskRows.length, taskTableRows.length]);

  useEffect(() => {
    setTaskRowsVisible(50);
  }, [selectedTeam, selectedProjectId, selectedMemberId, dateFrom, dateTo]);

  useEffect(() => {
    const target = taskListLoadMoreRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        triggerTaskRowsLoadMore();
      },
      { root: null, rootMargin: "0px 0px 180px 0px", threshold: 0.1 },
    );

    observer.observe(target);
    return () => {
      observer.disconnect();
    };
  }, [triggerTaskRowsLoadMore]);

  useEffect(() => {
    if (activeTab !== 3) return;
    const handleScroll = () => {
      const scrollBottom = window.innerHeight + window.scrollY;
      const totalHeight = document.documentElement.scrollHeight;
      if (scrollBottom >= totalHeight - 220) {
        triggerTaskRowsLoadMore();
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [activeTab, triggerTaskRowsLoadMore]);

  useEffect(() => {
    return () => {
      if (taskListLoadTimerRef.current !== null) {
        window.clearTimeout(taskListLoadTimerRef.current);
      }
    };
  }, []);
  if (membersQuery.error || projectsQuery.error || tasksQuery.error) {
    return (
      <Container suppressHydrationWarning sx={{ py: 4 }}>
        <Typography color="error" component="div" sx={{ whiteSpace: "pre-wrap" }}>
          {`Failed to load data. Current API base: ${publicApiBaseUrl}
If using localhost: start backend on port 4000.
If using production: set NEXT_PUBLIC_API_BASE_URL to your Render URL (e.g. https://...onrender.com) and redeploy. On Render, ALLOWED_ORIGIN must match your browser origin (e.g. https://your-app.vercel.app).`}
        </Typography>
      </Container>
    );
  }

  if (membersQuery.isLoading || projectsQuery.isLoading || tasksQuery.isLoading) {
    return (
      <Container suppressHydrationWarning sx={{ py: 4 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={24} />
          <Typography>Loading dashboard...</Typography>
        </Stack>
      </Container>
    );
  }

  const memberColumns: ColumnDef<Member>[] = [
    { accessorKey: "fullName", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "team", header: "Team" },
    { accessorKey: "role", header: "Role" },
    {
      id: "actions",
      header: () => (
        <Box sx={{ width: "100%", textAlign: "right", pr: 1 }}>
          Actions
        </Box>
      ),
      cell: ({ row }) => (
        <Box sx={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              disabled={!canMutate}
              onClick={() => {
                setEditMember(row.original);
                setMemberForm({
                  fullName: row.original.fullName,
                  email: row.original.email,
                  role: row.original.role,
                  team: row.original.team,
                  status: row.original.status,
                });
                setMemberFormInputKey((k) => k + 1);
                setMemberErrors({});
                setDialogOpen(true);
              }}
            >
              Edit
            </Button>
            <Button size="small" color="error" disabled={!canMutate} onClick={() => deleteMemberMutation.mutate(row.original.id)}>
              Delete
            </Button>
          </Stack>
        </Box>
      ),
    },
  ];

  const projectColumns: ColumnDef<Project>[] = [
    { accessorKey: "name", header: "Name" },
    {
      id: "actions",
      header: () => (
        <Box sx={{ width: "100%", textAlign: "right", pr: 1 }}>
          Actions
        </Box>
      ),
      cell: ({ row }) => (
        <Box sx={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              disabled={!canMutate}
              onClick={() => {
                setEditProject(row.original);
                setProjectForm({
                  name: row.original.name,
                  description: row.original.description ?? "",
                  status: row.original.status,
                });
                setProjectFormInputKey((k) => k + 1);
                setProjectErrors({});
                setProjectDialogOpen(true);
              }}
            >
              Edit
            </Button>
            <Button size="small" color="error" disabled={!canMutate} onClick={() => deleteProjectMutation.mutate(row.original.id)}>
              Delete
            </Button>
          </Stack>
        </Box>
      ),
    },
  ];

  const taskColumns: ColumnDef<TaskTableRow>[] = [
    // Project Name — read-only lookup
    {
      id: "projectName",
      header: "Project Name",
      cell: ({ row }) => (
        <Typography variant="body2" sx={{ minWidth: 120 }}>
          {row.original.projectName}
        </Typography>
      ),
    },
    // Task Description — inline text, editable, full display
    {
      id: "title",
      header: "Task Description",
      accessorKey: "title",
      cell: ({ row }) => (
        <Box sx={{ flexGrow: 1, minWidth: 420 }}>
          <TaskDescriptionEditor
            key={`${row.original.id}-${row.original.title}`}
            taskId={row.original.id}
            currentTitle={row.original.title}
            canMutate={canMutate}
            onCommit={commitTaskTitle}
          />
        </Box>
      ),
    },
    // Assigned to — inline Select
    {
      id: "assigneeName",
      header: () => (
        <Box sx={{ minWidth: 170, whiteSpace: "nowrap" }}>
          Assigned to
        </Box>
      ),
      cell: ({ row }) => {
        const isEditing = activeTaskCell?.taskId === row.original.id && activeTaskCell.field === "assignee";
        if (!isEditing) {
          return (
            <Typography
              variant="body2"
              sx={{ cursor: canMutate ? "pointer" : "default", minWidth: 170, whiteSpace: "nowrap" }}
              onClick={() => {
                if (canMutate) setActiveTaskCell({ taskId: row.original.id, field: "assignee" });
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
            disabled={!canMutate}
            InputProps={{ disableUnderline: true }}
            onChange={(e) => {
              updateTaskMutation.mutate({ id: row.original.id, payload: { assigneeMemberId: e.target.value } });
              setActiveTaskCell(null);
            }}
            onBlur={() => setActiveTaskCell(null)}
            autoFocus
            sx={{ minWidth: 170, "& .MuiSelect-select": { py: 0.5, whiteSpace: "nowrap" } }}
          >
            {members.map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.fullName}
              </MenuItem>
            ))}
          </TextField>
        );
      },
    },
    // Start Day — inline editable date
    {
      id: "startDate",
      header: () => (
        <Box sx={{ minWidth: 120, whiteSpace: "nowrap" }}>
          Start Day
        </Box>
      ),
      cell: ({ row }) => {
        const isEditing = activeTaskCell?.taskId === row.original.id && activeTaskCell.field === "start";
        if (!isEditing) {
          return (
            <Typography
              variant="body2"
              sx={{ cursor: canMutate ? "pointer" : "default", minWidth: 120, whiteSpace: "nowrap" }}
              onClick={() => {
                if (canMutate) setActiveTaskCell({ taskId: row.original.id, field: "start" });
              }}
            >
              {row.original.startDate}
            </Typography>
          );
        }
        return (
          <InlineDateEditor
            value={row.original.raw.plannedStartDate ?? new Date().toISOString().slice(0, 10)}
            canMutate={canMutate}
            onChange={(next) =>
              updateTaskMutation.mutate({ id: row.original.id, payload: { plannedStartDate: next } })
            }
            onClose={() => setActiveTaskCell(null)}
          />
        );
      },
    },
    // Days — read-only derived
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
    // Complete — inline date
    {
      id: "completeDate",
      header: () => (
        <Box sx={{ minWidth: 130, whiteSpace: "nowrap" }}>
          Complete
        </Box>
      ),
      cell: ({ row }) => {
        const isEditing = activeTaskCell?.taskId === row.original.id && activeTaskCell.field === "complete";
        if (!isEditing) {
          return (
            <Typography
              variant="body2"
              sx={{ cursor: canMutate ? "pointer" : "default", minWidth: 130, whiteSpace: "nowrap" }}
              onClick={() => {
                if (canMutate) setActiveTaskCell({ taskId: row.original.id, field: "complete" });
              }}
            >
              {row.original.completeDate}
            </Typography>
          );
        }
        return (
          <InlineDateEditor
            value={row.original.raw.dueDate}
            canMutate={canMutate}
            onChange={(next) =>
              updateTaskMutation.mutate({ id: row.original.id, payload: { dueDate: next } })
            }
            onClose={() => setActiveTaskCell(null)}
          />
        );
      },
    },
    // Priority — inline Select
    {
      id: "priority",
      header: () => (
        <Box sx={{ minWidth: 110, whiteSpace: "nowrap" }}>
          Priority
        </Box>
      ),
      cell: ({ row }) => {
        const isEditing = activeTaskCell?.taskId === row.original.id && activeTaskCell.field === "priority";
        if (!isEditing) {
          return (
            <Typography
              variant="body2"
              sx={{ cursor: canMutate ? "pointer" : "default", minWidth: 110, whiteSpace: "nowrap" }}
              onClick={() => {
                if (canMutate) setActiveTaskCell({ taskId: row.original.id, field: "priority" });
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
            disabled={!canMutate}
            InputProps={{ disableUnderline: true }}
            onChange={(e) => {
              updateTaskMutation.mutate({
                id: row.original.id,
                payload: { priority: e.target.value as Task["priority"] },
              });
              setActiveTaskCell(null);
            }}
            onBlur={() => setActiveTaskCell(null)}
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
    // Progress — single editable progress box
    {
      id: "progress",
      header: "Progress",
      cell: ({ row }) => {
        const progress = row.original.progress;
        const dueDate = new Date(row.original.raw.dueDate);
        // Avoid hydration mismatch: compute overdue only after mount
        if (!mounted) {
          return (
            <Box sx={{ minWidth: 120 }}>
              <ProgressEditor
                key={`${row.original.id}-${progress}`}
                taskId={row.original.id}
                currentProgress={progress}
                canMutate={canMutate}
                isOverdue={false}
                isDone={progress === 100}
                onCommit={commitProgress}
              />
            </Box>
          );
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isOverdue = isTaskOverdue(row.original.raw, today);
        const daysOverdue = isOverdue
          ? Math.ceil((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const tooltipTitle =
          progress === 100
            ? "Done"
            : isOverdue
              ? `Overdue ${daysOverdue}d`
              : "On track";

        return (
          <Box sx={{ minWidth: 120 }}>
            <MuiTooltip title={tooltipTitle} arrow>
              <Box>
                <ProgressEditor
                  key={`${row.original.id}-${progress}`}
                  taskId={row.original.id}
                  currentProgress={progress}
                  canMutate={canMutate}
                  isOverdue={isOverdue}
                  isDone={progress === 100}
                  onCommit={commitProgress}
                />
              </Box>
            </MuiTooltip>
          </Box>
        );
      },
    },
    // Timeline — mini gantt per row (at end)
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
        const start = toDayStart(row.original.raw.plannedStartDate ?? row.original.raw.dueDate);
        const end = toDayStart(row.original.raw.dueDate);
        if (!start || !end || timelineMonthDays.length === 0) {
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
            <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${timelineMonthDays.length}, 11px)`, gap: 0.25 }}>
              {timelineMonthDays.map((d) => {
                const dayTs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const inRange = dayTs >= rangeStart && dayTs <= rangeEnd;
                const filled = inRange && !isWeekend;
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

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer variant="permanent" sx={{ width: 220, "& .MuiDrawer-paper": { width: 220, p: 2 } }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          Software team's work schedule
        </Typography>
        <Tabs
          orientation="vertical"
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          sx={{ alignItems: "flex-start" }}
        >
          <Tab label="Dashboard" />
          <Tab label="Members" />
          <Tab label="Projects" />
          <Tab label="Tasks" />
        </Tabs>
      </Drawer>

      <Box sx={{ flex: 1 }}>
        <AppBar position="static" color="inherit" elevation={0}>
          <Toolbar className="border-b border-slate-200/80 bg-white/95 backdrop-blur" sx={{ justifyContent: "space-between" }}>
            <Box>
              <Typography fontWeight={800} className="text-slate-900">
                Execution phase
              </Typography>
              <Typography variant="caption" className="text-slate-500">
                Project operations overview
              </Typography>
            </Box>
            <TextField
              select
              label="Role view"
              size="small"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as "admin" | "pm" | "lead" | "member")}
              sx={{
                minWidth: 180,
                "& .MuiOutlinedInput-root": {
                  borderRadius: "9999px",
                  backgroundColor: "#ffffff",
                  transition: "all 300ms",
                },
                "& fieldset": { borderColor: "#e2e8f0" },
                "& .MuiOutlinedInput-root:hover fieldset": { borderColor: "#cbd5e1" },
              }}
            >
              <MenuItem value="admin">admin</MenuItem>
              <MenuItem value="pm">pm</MenuItem>
              <MenuItem value="lead">lead</MenuItem>
              <MenuItem value="member">member</MenuItem>
            </TextField>
          </Toolbar>
        </AppBar>
        <Container maxWidth={false} sx={{ py: 4, px: { xs: 2, md: 3 } }} className="bg-slate-50/60">
          <Stack spacing={3.5}>
            {/* Filter — Dashboard tab: Due from / Due to only */}
            {activeTab === 0 && (
              <Box className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <Stack direction={{ xs: "column", md: "row" }} spacing={2.5}>
                  <TextField
                    select
                    label="Team filter"
                    size="small"
                    value={selectedTeam}
                    onChange={(e) => setSelectedTeam(e.target.value)}
                    sx={{
                      minWidth: 220,
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "12px",
                        backgroundColor: "#fff",
                        transition: "all 300ms",
                      },
                      "& fieldset": { borderColor: "#e5e7eb" },
                      "& .MuiOutlinedInput-root:hover fieldset": { borderColor: "#cbd5e1" },
                    }}
                  >
                    <MenuItem value="all">All teams</MenuItem>
                    <MenuItem value="Mobile Team">Mobile Team</MenuItem>
                    <MenuItem value="OS Team">OS Team</MenuItem>
                    <MenuItem value="Tester Team">Tester Team</MenuItem>
                    <MenuItem value="Tablet Team">Tablet Team</MenuItem>
                    <MenuItem value="Web Team">Web Team</MenuItem>
                    <MenuItem value="Passthrough Team">Passthrough Team</MenuItem>
                    <MenuItem value="Server API Team">Server API Team</MenuItem>
                  </TextField>
                  <DateFilterField label="Due from" value={dateFrom} onChange={setDateFrom} />
                  <DateFilterField label="Due to" value={dateTo} onChange={setDateTo} />
                </Stack>
              </Box>
            )}

            {/* Filter — Tasks tab only */}
            {activeTab === 3 && (
              <Box className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <Stack spacing={2.5}>
                  <FilterBar selectedTeam={selectedTeam} setSelectedTeam={setSelectedTeam} />
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2.5}>
                    <ProjectSelect value={selectedProjectId} onChange={setSelectedProjectId} projects={projects} />
                    <TextField
                      select
                      label="Member"
                      size="small"
                      value={selectedMemberId}
                      onChange={(event) => setSelectedMemberId(event.target.value)}
                      sx={{
                        minWidth: 220,
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "12px",
                          backgroundColor: "#fff",
                          transition: "all 300ms",
                        },
                        "& fieldset": { borderColor: "#e5e7eb" },
                        "& .MuiOutlinedInput-root:hover fieldset": { borderColor: "#cbd5e1" },
                      }}
                    >
                      <MenuItem value="all">All members</MenuItem>
                      {members.map((member) => (
                        <MenuItem key={member.id} value={member.id}>
                          {member.fullName}
                        </MenuItem>
                      ))}
                    </TextField>
                    <DateFilterField label="Due from" value={dateFrom} onChange={setDateFrom} />
                    <DateFilterField label="Due to" value={dateTo} onChange={setDateTo} />
                  </Stack>
                </Stack>
              </Box>
            )}
            {/* Filter — Members tab: Search + Team + Member only */}
            {activeTab === 1 && (
              <Box className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <Stack spacing={2.5}>
                  <FilterBar selectedTeam={selectedTeam} setSelectedTeam={setSelectedTeam} />
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2.5}>
                    <TextField
                      select
                      label="Member"
                      size="small"
                      value={selectedMemberId}
                      onChange={(event) => setSelectedMemberId(event.target.value)}
                      sx={{
                        minWidth: 220,
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "12px",
                          backgroundColor: "#fff",
                          transition: "all 300ms",
                        },
                        "& fieldset": { borderColor: "#e5e7eb" },
                        "& .MuiOutlinedInput-root:hover fieldset": { borderColor: "#cbd5e1" },
                      }}
                    >
                      <MenuItem value="all">All members</MenuItem>
                      {members.map((member) => (
                        <MenuItem key={member.id} value={member.id}>
                          {member.fullName}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Stack>
                </Stack>
              </Box>
            )}
            {!canMutate ? <Alert severity="info">Member role is read-only.</Alert> : null}
            {activeTab === 0 ? (
              <>
                <Typography variant="h4" fontWeight={800} className="tracking-tight text-slate-900">
                  Software team's work schedule
                </Typography>
                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12, md: 6, xl: 3 }}>
                    <KpiStatCard
                      title="Active Members"
                      value={summary.activeMembers}
                      onClick={() => setActiveTab(1)}
                      icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M16 19V17.8C16 16.12 14.43 14.75 12.5 14.75H6.5C4.57 14.75 3 16.12 3 17.8V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                          <circle cx="9.5" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.8"/>
                          <path d="M17 9.25C18.38 9.25 19.5 10.37 19.5 11.75C19.5 13.13 18.38 14.25 17 14.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      }
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6, xl: 3 }}>
                    <KpiStatCard
                      title="Active Projects"
                      value={summary.activeProjects}
                      onClick={() => setActiveTab(2)}
                      icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path d="M3 7.5C3 6.67 3.67 6 4.5 6H9L10.5 7.5H19.5C20.33 7.5 21 8.17 21 9V18C21 18.83 20.33 19.5 19.5 19.5H4.5C3.67 19.5 3 18.83 3 18V7.5Z" stroke="currentColor" strokeWidth="1.8" />
                        </svg>
                      }
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6, xl: 3 }}>
                    <KpiStatCard
                      title="Open Tasks"
                      value={summary.openTasks}
                      onClick={() => setActiveTab(3)}
                      icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8"/>
                          <path d="M8 10H16M8 14H12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      }
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6, xl: 3 }}>
                    <KpiStatCard
                      title="Overdue Tasks"
                      value={summary.overdueTasks}
                      onClick={() => setActiveTab(3)}
                      icon={
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8"/>
                          <path d="M12 8V12L14.5 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                        </svg>
                      }
                    />
                  </Grid>
                </Grid>

                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12 }}>
                    <Box
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md"
                      sx={{ minHeight: memberChartCardHeight }}
                    >
                      <Typography variant="h6" className="mb-4 font-semibold text-slate-800">
                        Performance Score by Member
                      </Typography>
                      <ResponsiveContainer width="100%" height={memberChartInnerHeight}>
                        <BarChart layout="vertical" data={performanceChartData} margin={{ top: 8, right: 24, left: 180, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={{ stroke: "#e2e8f0" }} />
                          <YAxis type="category" dataKey="name" width={165} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="score" fill="#10b981" radius={[0, 8, 8, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Box
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md"
                      sx={{ minHeight: memberChartCardHeight }}
                    >
                      <Typography variant="h6" className="mb-4 font-semibold text-slate-800">
                        Workload by Member
                      </Typography>
                      <ResponsiveContainer width="100%" height={memberChartInnerHeight}>
                        <BarChart layout="vertical" data={workloadByMember} margin={{ top: 8, right: 24, left: 180, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis type="number" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={{ stroke: "#e2e8f0" }} tickLine={{ stroke: "#e2e8f0" }} />
                          <YAxis type="category" dataKey="name" width={165} tick={{ fontSize: 12, fill: "#475569" }} axisLine={false} tickLine={false} />
                          <Tooltip />
                          <Bar dataKey="tasks" fill="#2563eb" radius={[0, 8, 8, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Grid>
                </Grid>
              </>
            ) : null}

            {activeTab === 1 ? (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h5">Members</Typography>
                  <Button
                    variant="contained"
                    disabled={!canMutate}
                    onClick={() => {
                      setEditMember(null);
                      setMemberForm({
                        fullName: "",
                        email: "",
                        role: "member",
                        team: selectedTeam === "all" ? "Platform" : selectedTeam,
                        status: "active",
                      });
                      setMemberFormInputKey((k) => k + 1);
                      setMemberErrors({});
                      setDialogOpen(true);
                    }}
                  >
                    Add member
                  </Button>
                </Stack>
                <DataTable columns={memberColumns} data={filteredMembers} />
                {filteredMembers.length === 0 ? <Alert severity="info">No members match the current filters.</Alert> : null}
              </>
            ) : null}

            {activeTab === 2 ? (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h5">Projects</Typography>
                  <Button
                    variant="contained"
                    disabled={!canMutate}
                    onClick={() => {
                      setEditProject(null);
                      setProjectForm(DEFAULT_PROJECT_FORM);
                      setProjectFormInputKey((k) => k + 1);
                      setProjectErrors({});
                      setProjectDialogOpen(true);
                    }}
                  >
                    Add project
                  </Button>
                </Stack>
                <DataTable columns={projectColumns} data={projects} />
                {projects.length === 0 ? <Alert severity="info">No matching projects found.</Alert> : null}
              </>
            ) : null}

            {activeTab === 3 ? (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h5">Tasks</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      onClick={() => { void exportTasksToXLSX(taskTableRows, timelineMonthDays); }}
                      disabled={taskTableRows.length === 0}
                    >
                      Export XLSX
                    </Button>
                    <Button
                      variant="contained"
                    disabled={!canMutate}
                    onClick={() => {
                      setEditTask(null);
                      const today = mounted ? new Date().toISOString().slice(0, 10) : "";
                      setTaskForm({
                        title: "",
                        projectId: defaultProjectId,
                        assigneeMemberId: defaultMemberId,
                        dueDate: today,
                        priority: "medium",
                        plannedStartDate: today,
                      });
                      setTaskTitleInputKey((k) => k + 1);
                      setTaskErrors({});
                      setTaskDrawerOpen(true);
                    }}
                  >
                    Add task
                  </Button>
                  </Stack>
                </Stack>
                <DataTable columns={taskColumns} data={visibleTaskRows} minTableWidth={1500} />
                <Typography variant="body2" color="text.secondary">
                  Showing {visibleTaskRows.length}/{totalTasksCount} tasks
                </Typography>
                {visibleTaskRows.length < taskTableRows.length ? <Box ref={taskListLoadMoreRef} sx={{ height: 1 }} /> : null}
                {isTaskListLoadingMore ? (
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ py: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">Loading more tasks...</Typography>
                  </Stack>
                ) : null}
                {taskTableRows.length === 0 ? <Alert severity="info">No tasks match the current filters.</Alert> : null}
              </>
            ) : null}
          </Stack>
        </Container>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editMember ? "Edit member" : "Add member"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              key={`member-fullName-${memberFormInputKey}`}
              label="Full name"
              defaultValue={memberForm.fullName}
              inputRef={memberFullNameInputRef}
              error={Boolean(memberErrors.fullName)}
              helperText={memberErrors.fullName}
            />
            <TextField
              key={`member-email-${memberFormInputKey}`}
              label="Email"
              defaultValue={memberForm.email}
              inputRef={memberEmailInputRef}
              error={Boolean(memberErrors.email)}
              helperText={memberErrors.email}
            />
            <TextField
              label="Team"
              select
              value={memberForm.team}
              onChange={(e) => setMemberForm((s) => ({ ...s, team: e.target.value }))}
              error={Boolean(memberErrors.team)}
              helperText={memberErrors.team}
            >
              <MenuItem value="Mobile Team">Mobile Team</MenuItem>
              <MenuItem value="OS Team">OS Team</MenuItem>
              <MenuItem value="Tester Team">Tester Team</MenuItem>
              <MenuItem value="Tablet Team">Tablet Team</MenuItem>
              <MenuItem value="Web Team">Web Team</MenuItem>
              <MenuItem value="Passthrough Team">Passthrough Team</MenuItem>
              <MenuItem value="Server API Team">Server API Team</MenuItem>
            </TextField>
            <TextField select label="Role" value={memberForm.role} onChange={(e) => setMemberForm((s) => ({ ...s, role: e.target.value as Member["role"] }))}>
              <MenuItem value="admin">admin</MenuItem>
              <MenuItem value="pm">pm</MenuItem>
              <MenuItem value="lead">lead</MenuItem>
              <MenuItem value="member">member</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const payload = {
                ...memberForm,
                fullName: (memberFullNameInputRef.current?.value ?? "").trim(),
                email: (memberEmailInputRef.current?.value ?? "").trim(),
              };
              const parsed = memberFormSchema.safeParse(payload);
              if (!parsed.success) {
                setMemberErrors(parseFormErrors(parsed.error.issues));
                return;
              }
              if (editMember) {
                updateMemberMutation.mutate({ id: editMember.id, payload: parsed.data });
              } else {
                createMemberMutation.mutate(parsed.data);
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Drawer anchor="right" open={taskDrawerOpen} onClose={() => setTaskDrawerOpen(false)}>
        <Box sx={{ width: 380, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {editTask ? "Edit task" : "Create task"}
          </Typography>
          <Stack spacing={2}>
            <TextField
              key={taskTitleInputKey}
              label="Title"
              defaultValue={taskForm.title}
              inputRef={taskTitleInputRef}
              error={Boolean(taskErrors.title)}
              helperText={taskErrors.title}
            />
            <TextField
              select
              label="Project"
              value={taskForm.projectId}
              onChange={(e) => setTaskForm((s) => ({ ...s, projectId: e.target.value }))}
              error={Boolean(taskErrors.projectId)}
              helperText={taskErrors.projectId}
            >
              {projects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Assignee"
              value={taskForm.assigneeMemberId}
              onChange={(e) => setTaskForm((s) => ({ ...s, assigneeMemberId: e.target.value }))}
              error={Boolean(taskErrors.assigneeMemberId)}
              helperText={taskErrors.assigneeMemberId}
            >
              {members.map((member) => (
                <MenuItem key={member.id} value={member.id}>
                  {member.fullName}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Start Day"
              type="date"
              value={taskForm.plannedStartDate ?? ""}
              onChange={(e) => setTaskForm((s) => ({ ...s, plannedStartDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Due date"
              type="date"
              value={taskForm.dueDate}
              onChange={(e) => setTaskForm((s) => ({ ...s, dueDate: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              error={Boolean(taskErrors.dueDate)}
              helperText={taskErrors.dueDate}
            />
            <TextField
              select
              label="Priority"
              value={taskForm.priority}
              onChange={(e) => setTaskForm((s) => ({ ...s, priority: e.target.value as Task["priority"] }))}
            >
              <MenuItem value="low">low</MenuItem>
              <MenuItem value="medium">medium</MenuItem>
              <MenuItem value="high">high</MenuItem>
              <MenuItem value="critical">critical</MenuItem>
            </TextField>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button onClick={() => setTaskDrawerOpen(false)}>Cancel</Button>
              <Button
                variant="contained"
                onClick={() => {
                  const payload = {
                    ...taskForm,
                    title: (taskTitleInputRef.current?.value ?? "").trim(),
                  };
                  const parsed = taskFormSchema.safeParse(payload);
                  if (!parsed.success) {
                    setTaskErrors(parseFormErrors(parsed.error.issues));
                    return;
                  }
                  if (editTask) {
                    updateTaskMutation.mutate({ id: editTask.id, payload: parsed.data });
                  } else {
                    createTaskMutation.mutate(parsed.data);
                  }
                }}
              >
                Save
              </Button>
            </Stack>
          </Stack>
        </Box>
      </Drawer>

      <Dialog open={projectDialogOpen} onClose={() => setProjectDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editProject ? "Edit project" : "Add project"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              key={`project-name-${projectFormInputKey}`}
              label="Name"
              defaultValue={projectForm.name}
              inputRef={projectNameInputRef}
              error={Boolean(projectErrors.name)}
              helperText={projectErrors.name}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProjectDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              const projectName = (projectNameInputRef.current?.value ?? "").trim();
              if (!projectName) {
                setProjectErrors((s) => ({ ...s, name: "Name is required" }));
                return;
              }
              if (editProject) {
                updateProjectMutation.mutate({
                  id: editProject.id,
                  payload: {
                    name: projectName,
                    status: projectForm.status,
                  },
                });
              } else {
                createProjectMutation.mutate({
                  name: projectName,
                  status: projectForm.status,
                });
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
    </LocalizationProvider>
  );
}
