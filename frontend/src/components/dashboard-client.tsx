"use client";

import {
  Alert,
  AppBar,
  Avatar,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Tooltip as MuiTooltip,
  Typography,
} from "@mui/material";
import { useMemo, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { io } from "socket.io-client";
import type { Member, Project, Task } from "@shared/types/domain";
import {
  createAccountAsAdmin,
  createTask,
  createMember,
  createProject,
  deleteTask,
  deleteMember,
  deleteProject,
  getMembers,
  getProjects,
  asTaskArray,
  fetchAllTaskPages,
  fetchTasksPage,
  flattenTaskPages,
  normalizeTasksPageResponse,
  safeArray,
  type TaskFilters,
  type TasksPageResponse,
  publicApiBaseUrl,
  updateProject,
  updateTask,
  updateMember,
} from "@/lib/api";
import { memberFormSchema, parseFormErrors, taskFormSchema, type FormErrors } from "@/lib/validation";
import FilterBar from "@/components/filter-bar";
import ProjectSelect from "@/components/project-select";
import DataTable from "@/components/data-table";
import TaskDataTable from "@/components/task-table/task-data-table";
import { createTaskColumns } from "@/components/task-table/task-table-columns";
import type { ActiveTaskCellState, TaskTableMeta } from "@/components/task-table/task-table-meta";
import type { TaskTableRow } from "@/components/task-table/task-table-types";
import {
  formatDate,
  isTaskOverdue,
  isWeekendDate,
  priorityLabel,
  toDayStart,
} from "@/components/task-table/task-table-utils";
import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { isAppAdminEmail } from "@/lib/app-admin";
import { mergeTasksPreserveRefs } from "@/lib/task-merge";
import { tasksToInfiniteData } from "@/lib/task-infinite-data";

function filtersFromTasksQueryKey(key: readonly unknown[]): TaskFilters {
  if (key[0] !== "tasks") return {};
  if (key[1] === "all" && key[2] === "flat") return {};
  if (key[1] === "all" && key.length === 2) return {};
  return {
    projectId: key[1] === "all" ? undefined : String(key[1]),
    memberId: key[2] === "all" ? undefined : String(key[2]),
    dateFrom: typeof key[3] === "string" && key[3] ? key[3] : undefined,
    dateTo: typeof key[4] === "string" && key[4] ? key[4] : undefined,
  };
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

function getMonthDays(anchor: Date): Date[] {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const dayCount = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: dayCount }, (_, i) => new Date(year, month, i + 1));
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
  const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
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
      <Typography className="text-3xl font-bold leading-none text-slate-900">{safeValue}</Typography>
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
  ws.getRow(1).alignment = { horizontal: "center", vertical: "middle" };
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
      return inRange && !isWeekendDate(d);
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

  const timelineColumnWidths = timelineHeaders.map((header) => Math.max(8, header.length + 1));
  ws.columns = [
    { width: 18 },
    { width: 36 },
    { width: 24 },
    { width: 14 },
    { width: 8 },
    { width: 14 },
    { width: 10 },
    { width: 10 },
    ...timelineColumnWidths.map((width) => ({ width })),
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

function headerUserDisplayName(u: { displayName: string | null; email: string | null }): string {
  if (u.displayName?.trim()) return u.displayName.trim();
  if (u.email) {
    const local = u.email.split("@")[0];
    return local && local.length > 0 ? local : u.email;
  }
  return "User";
}

const DEFAULT_MEMBER_EMAIL_DOMAIN = "@vn.innova.com";

function normalizeMemberEmailInput(rawEmail: string, isEditMode: boolean): string {
  const trimmed = rawEmail.trim();
  if (trimmed.length === 0) return "";
  if (isEditMode) return trimmed;
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed}${DEFAULT_MEMBER_EMAIL_DOMAIN}`;
}

function emailLocalPartFromInput(rawEmail: string): string {
  const trimmed = rawEmail.trim();
  if (!trimmed) return "";
  if (trimmed.endsWith(DEFAULT_MEMBER_EMAIL_DOMAIN)) {
    return trimmed.slice(0, Math.max(0, trimmed.length - DEFAULT_MEMBER_EMAIL_DOMAIN.length));
  }
  if (trimmed.includes("@")) {
    return trimmed.split("@")[0] ?? "";
  }
  return trimmed;
}

function AppHeaderAuth() {
  const { user, loading, signOutUser } = useAuth();
  const [settingsAnchorEl, setSettingsAnchorEl] = useState<HTMLElement | null>(null);
  const settingsOpen = Boolean(settingsAnchorEl);
  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", minWidth: 72, justifyContent: "flex-end" }}>
        <CircularProgress size={20} />
      </Box>
    );
  }
  if (!user) {
    return (
      <Button
        component={Link}
        href="/login"
        variant="text"
        size="small"
        sx={{ textTransform: "none", fontWeight: 600, color: "#0f172a" }}
      >
        Sign in
      </Button>
    );
  }
  const name = headerUserDisplayName(user);
  const tip = user.email ? `${name} · ${user.email}` : name;
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
      <MuiTooltip title={tip} arrow>
        <Avatar src={user.photoURL ?? undefined} alt={name} sx={{ width: 36, height: 36 }} />
      </MuiTooltip>
      <Box sx={{ minWidth: 0, maxWidth: 220, display: { xs: "none", sm: "block" } }}>
        <Typography variant="body2" fontWeight={700} lineHeight={1.2} noWrap title={name}>
          {name}
        </Typography>
        {user.email ? (
          <Typography variant="caption" color="text.secondary" display="block" noWrap title={user.email}>
            {user.email}
          </Typography>
        ) : null}
      </Box>
      <MuiTooltip title="Settings" arrow>
        <IconButton
          size="small"
          onClick={(event) => setSettingsAnchorEl(event.currentTarget)}
          aria-label="Settings"
          sx={{ p: 0.5 }}
        >
          <Box
            component="img"
            src="/icon-settings.png"
            alt="Settings"
            sx={{ width: 22, height: 22, display: "block" }}
          />
        </IconButton>
      </MuiTooltip>
      <Menu
        anchorEl={settingsAnchorEl}
        open={settingsOpen}
        onClose={() => setSettingsAnchorEl(null)}
        keepMounted
        TransitionProps={{ timeout: 220 }}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              borderRadius: 2,
              minWidth: 190,
              boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
            },
          },
        }}
      >
        <MenuItem
          component={Link}
          href="/change-password"
          onClick={() => setSettingsAnchorEl(null)}
          sx={{ py: 1.2, gap: 1 }}
        >
          <Box component="img" src="/icon-change-password.png" alt="" sx={{ width: 18, height: 18 }} />
          <Typography variant="body2">Change password</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setSettingsAnchorEl(null);
            void signOutUser();
          }}
          sx={{ py: 1.2, gap: 1 }}
        >
          <Box component="img" src="/icon-logout.png" alt="" sx={{ width: 18, height: 18 }} />
          <Typography variant="body2">Logout</Typography>
        </MenuItem>
      </Menu>
    </Stack>
  );
}

export default function DashboardClient() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);
  const { user } = useAuth();
  useEffect(() => {
    if (user?.mustChangePassword) {
      router.replace("/change-password");
    }
  }, [router, user?.mustChangePassword]);
  const [activeTab, setActiveTab] = useState(0);
  useEffect(() => {
    if (activeTab === 4 && !(user && user.role === "admin")) {
      setActiveTab(0);
    }
  }, [activeTab, user]);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [taskDeleteConfirmId, setTaskDeleteConfirmId] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const taskTitleInputRef = useRef<HTMLInputElement | null>(null);
  const [taskTitleInputKey, setTaskTitleInputKey] = useState(0);
  const memberFullNameInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const memberEmailInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [memberFormInputKey, setMemberFormInputKey] = useState(0);
  const projectNameInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const [projectFormInputKey, setProjectFormInputKey] = useState(0);
  const [memberSearch, setMemberSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [selectedMemberId, setSelectedMemberId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [memberErrors, setMemberErrors] = useState<FormErrors>({});
  const [taskErrors, setTaskErrors] = useState<FormErrors>({});
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [projectErrors, setProjectErrors] = useState<FormErrors>({});
  const [activeTaskCell, setActiveTaskCell] = useState<ActiveTaskCellState>(null);
  const localTaskMutationAt = useRef<Map<string, number>>(new Map());
  const editTaskRef = useRef<Task | null>(null);
  const taskDrawerOpenRef = useRef(false);
  const activeTaskCellRef = useRef<ActiveTaskCellState>(null);
  const pendingSocketRef = useRef({
    members: false,
    projects: false,
    refreshTasks: false,
    taskFlashIds: new Set<string>(),
  });
  const socketDebounceTimerRef = useRef<number | null>(null);
  const lastSocketTaskRefetchAtRef = useRef(0);
  const [remoteFlashTaskIds, setRemoteFlashTaskIds] = useState(() => new Set<string>());
  const [taskRowObjectCache] = useState(() => new Map<string, TaskTableRow & { _builtWithMounted?: boolean }>());
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
  const [accountForm, setAccountForm] = useState({
    fullName: "",
    email: "",
    role: "member" as Member["role"],
    team: "Server API Team",
    password: "",
    mustChangePassword: true,
  });
  const [accountCreateError, setAccountCreateError] = useState<string | null>(null);
  const [accountCreateSuccess, setAccountCreateSuccess] = useState<string | null>(null);
  const accountEmailLocalPart = useMemo(
    () => emailLocalPartFromInput(accountForm.email),
    [accountForm.email],
  );

  editTaskRef.current = editTask;
  taskDrawerOpenRef.current = taskDrawerOpen;
  activeTaskCellRef.current = activeTaskCell;

  const membersQuery = useQuery({
    queryKey: ["members"],
    queryFn: getMembers,
    select: (data: unknown) => safeArray<Member>(data),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: getProjects,
    select: (data: unknown) => safeArray<Project>(data),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
  });
  const tasksQueryKey = useMemo(
    () => ["tasks", selectedProjectId, selectedMemberId, dateFrom, dateTo] as const,
    [selectedProjectId, selectedMemberId, dateFrom, dateTo],
  );
  const tasksInfinite = useInfiniteQuery({
    queryKey: tasksQueryKey,
    queryFn: ({ pageParam }) =>
      fetchTasksPage(
        {
          projectId: selectedProjectId === "all" ? undefined : selectedProjectId,
          memberId: selectedMemberId === "all" ? undefined : selectedMemberId,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
        pageParam,
      ),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const lp = normalizeTasksPageResponse(lastPage);
      if (!Array.isArray(lp.items) || typeof lp.total !== "number") return undefined;
      const pagesSoFar = Array.isArray(allPages) ? allPages : [];
      const loaded = pagesSoFar.reduce((sum, p) => sum + normalizeTasksPageResponse(p).items.length, 0);
      if (loaded >= lp.total) return undefined;
      return loaded;
    },
    select: (data) => ({
      ...data,
      pages: Array.isArray(data?.pages) ? data.pages.map((p) => normalizeTasksPageResponse(p)) : [],
    }),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    structuralSharing: false,
  });
  /** Full unfiltered list for KPI cards (chunked HTTP via fetchAllTaskPages). */
  const tasksAllFlatQuery = useQuery({
    queryKey: ["tasks", "all", "flat"],
    queryFn: async () => {
      const { items } = await fetchAllTaskPages({});
      return items;
    },
    select: (data: unknown) => asTaskArray(data),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    structuralSharing: false,
  });

  /** Load remaining pages in the background so charts and filters see the full server-side filtered set. */
  useEffect(() => {
    if (!tasksInfinite.hasNextPage || tasksInfinite.isFetchingNextPage) return;
    const t = window.setTimeout(() => {
      void tasksInfinite.fetchNextPage();
    }, 0);
    return () => window.clearTimeout(t);
  }, [tasksInfinite.hasNextPage, tasksInfinite.isFetchingNextPage, tasksInfinite.fetchNextPage, tasksInfinite.data?.pages]);

  const flashRemoteTaskRows = useCallback((ids: string[]) => {
    const now = Date.now();
    const add: string[] = [];
    for (const id of ids) {
      if (now - (localTaskMutationAt.current.get(id) ?? 0) < 1300) continue;
      add.push(id);
    }
    if (add.length === 0) return;
    setRemoteFlashTaskIds((prev) => {
      const next = new Set(prev);
      for (const id of add) next.add(id);
      return next;
    });
    for (const id of add) {
      window.setTimeout(() => {
        setRemoteFlashTaskIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 2000);
    }
  }, []);

  useEffect(() => {
    const socket = io(publicApiBaseUrl, { path: "/socket.io", transports: ["websocket", "polling"] });
    const mergePayload = (payload: { type: string; taskIds?: string[] }) => {
      const p = pendingSocketRef.current;
      if (payload.type === "members") p.members = true;
      if (payload.type === "projects") p.projects = true;
      if (payload.type === "tasks") {
        p.refreshTasks = true;
        for (const id of payload.taskIds ?? []) p.taskFlashIds.add(id);
      }
    };
    const flush = async () => {
      const p = pendingSocketRef.current;
      pendingSocketRef.current = {
        members: false,
        projects: false,
        refreshTasks: false,
        taskFlashIds: new Set(),
      };
      const flashIds = [...p.taskFlashIds];
      if (flashIds.length > 0) flashRemoteTaskRows(flashIds);

      if (p.members) {
        try {
          queryClient.setQueryData(["members"], await getMembers());
        } catch {
          /* keep cache */
        }
      }
      if (p.projects) {
        try {
          queryClient.setQueryData(["projects"], await getProjects());
        } catch {
          /* keep cache */
        }
      }
      if (!p.refreshTasks) return;

      const now = Date.now();
      const minGapMs = 2000;
      const wait = Math.max(0, minGapMs - (now - lastSocketTaskRefetchAtRef.current));
      if (wait > 0) {
        await new Promise((r) => setTimeout(r, wait));
      }

      const protectedTaskId =
        taskDrawerOpenRef.current && editTaskRef.current
          ? editTaskRef.current.id
          : activeTaskCellRef.current?.taskId ?? null;

      const queries = queryClient.getQueryCache().findAll({ queryKey: ["tasks"], exact: false });
      await Promise.all(
        queries.map(async (q) => {
          const key = q.queryKey;
          const filters = filtersFromTasksQueryKey(key);
          const prev = queryClient.getQueryData<Task[] | InfiniteData<TasksPageResponse>>(key);
          try {
            const { items: server, total } = await fetchAllTaskPages(filters);
            let prevFlat: Task[] | undefined;
            if (!prev) prevFlat = undefined;
            else if (Array.isArray(prev)) prevFlat = asTaskArray(prev);
            else if ("pages" in prev && Array.isArray(prev.pages)) prevFlat = flattenTaskPages(prev.pages);
            else prevFlat = asTaskArray(prev);
            const merged = mergeTasksPreserveRefs(prevFlat, server, protectedTaskId);
            if (key[1] === "all" && key[2] === "flat") {
              queryClient.setQueryData(key, merged);
            } else {
              queryClient.setQueryData(key, tasksToInfiniteData(merged, total));
            }
          } catch {
            /* keep cache */
          }
        }),
      );
      lastSocketTaskRefetchAtRef.current = Date.now();
    };
    const onEntityUpdated = (payload: { type: string; taskIds?: string[] }) => {
      mergePayload(payload);
      if (socketDebounceTimerRef.current !== null) window.clearTimeout(socketDebounceTimerRef.current);
      socketDebounceTimerRef.current = window.setTimeout(() => {
        socketDebounceTimerRef.current = null;
        void flush();
      }, 400);
    };
    socket.on("entity:updated", onEntityUpdated);
    return () => {
      socket.off("entity:updated", onEntityUpdated);
      if (socketDebounceTimerRef.current !== null) window.clearTimeout(socketDebounceTimerRef.current);
      socket.disconnect();
    };
  }, [queryClient, flashRemoteTaskRows]);

  const isTaskRowFlashing = useCallback((taskId: string) => remoteFlashTaskIds.has(taskId), [remoteFlashTaskIds]);

  const canMutateTasks = Boolean(user);
  const canManageAllTasks = user?.role === "admin" || user?.role === "lead";
  const canAssignAnyMember = canManageAllTasks;
  const canManageAccounts = user?.role === "admin";
  const canManageMembers =
    Boolean(user) && (user?.role === "admin" || user?.role === "lead" || isAppAdminEmail(user?.email));
  const canManageProjects =
    Boolean(user) && (user?.role === "admin" || isAppAdminEmail(user?.email));
  const canExportTasks = canManageMembers;

  /** Patch one task in every cached task list (flat + infinite pages) so Dashboard KPIs and Tasks tab stay in sync. */
  const patchTaskInAllTaskQueries = useCallback((taskId: string, patch: Partial<Task>) => {
    queryClient.setQueriesData<Task[] | InfiniteData<TasksPageResponse>>({ queryKey: ["tasks"] }, (prev) => {
      if (!prev) return prev;
      if (Array.isArray(prev)) {
        if (!prev.some((t) => t.id === taskId)) return prev;
        return prev.map((item) => (item.id === taskId ? { ...item, ...patch } : item));
      }
      if (!("pages" in prev) || !Array.isArray(prev.pages)) return prev;
      let touched = false;
      const pages = prev.pages.map((page) => {
        const norm = normalizeTasksPageResponse(page);
        const nextItems = norm.items.map((item) => {
          if (item.id !== taskId) return item;
          touched = true;
          return { ...item, ...patch };
        });
        return { items: nextItems, total: norm.total };
      });
      return touched ? { ...prev, pages } : prev;
    });
  }, [queryClient]);

  const createMemberMutation = useMutation({
    mutationFn: createMember,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      setDialogOpen(false);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to create member";
      setMemberErrors((prev) => ({ ...prev, _form: message }));
    },
  });
  const updateMemberMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<Member, "id">> }) => updateMember(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
      setDialogOpen(false);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to update member";
      setMemberErrors((prev) => ({ ...prev, _form: message }));
    },
  });
  const deleteMemberMutation = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["members"] });
    },
  });
  const createAccountMutation = useMutation({
    mutationFn: createAccountAsAdmin,
    onSuccess: async (result) => {
      setAccountCreateError(null);
      setAccountCreateSuccess(`Account ${result.account.email} created successfully.`);
      setAccountForm({
        fullName: "",
        email: "",
        role: "member",
        team: "Server API Team",
        password: "",
        mustChangePassword: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to create account";
      setAccountCreateError(message);
      setAccountCreateSuccess(null);
    },
  });
  const createTaskMutation = useMutation({
    mutationFn: (payload: Omit<Task, "id" | "status" | "taskCode">) => createTask(payload),
    onSuccess: (task) => {
      localTaskMutationAt.current.set(task.id, Date.now());
      setTaskDrawerOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<Task, "id">> }) => updateTask(id, payload),
    onMutate: async ({ id, payload }) => {
      await queryClient.cancelQueries({ queryKey: ["tasks"] });
      const previousEntries = queryClient.getQueriesData<Task[] | InfiniteData<TasksPageResponse>>({
        queryKey: ["tasks"],
      });
      patchTaskInAllTaskQueries(id, payload as Partial<Task>);
      return { previousEntries };
    },
    onError: (_error, _variables, context) => {
      const entries = context?.previousEntries;
      if (!entries) return;
      for (const [key, data] of entries) {
        queryClient.setQueryData(key, data);
      }
    },
    onSuccess: (updatedTask) => {
      if (updatedTask?.id) {
        localTaskMutationAt.current.set(updatedTask.id, Date.now());
        patchTaskInAllTaskQueries(updatedTask.id, updatedTask);
      }
      // Only close drawer when editing an existing task (not inline cell edits)
      if (editTask !== null) {
        setTaskDrawerOpen(false);
      }
    },
  });
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => deleteTask(taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setTaskDeleteConfirmId(null);
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

  const tasks = useMemo((): Task[] => {
    const pages = tasksInfinite.data?.pages;
    if (!Array.isArray(pages)) return [];
    return asTaskArray(flattenTaskPages(pages));
  }, [tasksInfinite.data]);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("Dashboard mount - tasks state:", tasks);
    }
  }, [tasks]);

  const filteredTasksTotal = useMemo(() => {
    const p0 = tasksInfinite.data?.pages?.[0];
    if (p0 === undefined) return tasks.length;
    return normalizeTasksPageResponse(p0).total;
  }, [tasksInfinite.data?.pages, tasks.length]);
  const members = useMemo(() => safeArray<Member>(membersQuery.data), [membersQuery.data]);
  const projects = useMemo(() => safeArray<Project>(projectsQuery.data), [projectsQuery.data]);

  const projectById = useMemo(() => {
    const m = new Map<string, Project>();
    for (const p of projects) m.set(p.id, p);
    return m;
  }, [projects]);

  const memberById = useMemo(() => {
    const m = new Map<string, Member>();
    for (const mem of members) m.set(mem.id, mem);
    return m;
  }, [members]);
  const resolvedCurrentMemberId = useMemo(() => {
    if (!user) return "";
    const byId = members.find((member) => member.id === user.id);
    if (byId) return byId.id;
    const email = user.email?.toLowerCase();
    if (!email) return "";
    const byEmail = members.find((member) => member.email.toLowerCase() === email);
    return byEmail?.id ?? "";
  }, [members, user]);
  const taskById = useMemo(() => {
    const map = new Map<string, Task>();
    for (const task of tasks) {
      map.set(task.id, task);
    }
    return map;
  }, [tasks]);
  const canEditTask = useCallback(
    (task: Task | undefined): boolean => {
      if (!user) return false;
      if (!task) return false;
      if (user.role === "member") return Boolean(resolvedCurrentMemberId) && task.assigneeMemberId === resolvedCurrentMemberId;
      return true;
    },
    [resolvedCurrentMemberId, user],
  );
  const assignableMembers = useMemo(() => {
    if (user?.role === "member") {
      return members.filter((member) => member.id === resolvedCurrentMemberId);
    }
    return members;
  }, [members, resolvedCurrentMemberId, user?.role]);

  const commitProgress = useCallback(
    (taskId: string, value: number, currentProgress: number) => {
      if (!canMutateTasks) return;
      const task = taskById.get(taskId);
      if (!canEditTask(task)) return;
      const next = Math.min(100, Math.max(0, Math.round(value)));
      const prev = Math.min(100, Math.max(0, Math.round(currentProgress)));
      if (next !== prev) {
        updateTaskMutation.mutate({ id: taskId, payload: { progress: next } });
      }
    },
    [canMutateTasks, canEditTask, taskById, updateTaskMutation],
  );
  const commitTaskTitle = useCallback(
    (taskId: string, value: string, currentTitle: string) => {
      if (!canMutateTasks) return;
      const task = taskById.get(taskId);
      if (!canEditTask(task)) return;
      const next = value.trim();
      if (!next || next === currentTitle) return;
      updateTaskMutation.mutate({ id: taskId, payload: { title: next } });
    },
    [canMutateTasks, canEditTask, taskById, updateTaskMutation],
  );
  const updateTaskMutate = useCallback(
    (args: { id: string; payload: Partial<Omit<Task, "id">> }) => {
      const task = taskById.get(args.id);
      if (!canEditTask(task)) return;
      updateTaskMutation.mutate(args);
    },
    [canEditTask, taskById, updateTaskMutation],
  );
  const deleteTaskMutate = useCallback(
    (taskId: string) => {
      const task = taskById.get(taskId);
      if (!canEditTask(task)) return;
      setTaskDeleteConfirmId(taskId);
    },
    [canEditTask, taskById],
  );

  /** Default IDs for new task creation */
  const defaultProjectId = useMemo(
    () => projects.find((p) => p.name === "RSPro Production")?.id ?? projects[0]?.id ?? "",
    [projects],
  );
  const defaultMemberId = useMemo(
    () =>
      user?.role === "member"
        ? (resolvedCurrentMemberId || members[0]?.id || "")
        : (members.find((m) => m.fullName === "Hoàng Văn Nhật Anh")?.id ?? members[0]?.id ?? ""),
    [members, resolvedCurrentMemberId, user?.role],
  );

  useEffect(() => {
    const validMemberIds = new Set(members.map((member) => member.id));
    const validProjectIds = new Set(projects.map((project) => project.id));
    if (selectedMemberId !== "all" && !validMemberIds.has(selectedMemberId)) {
      setSelectedMemberId("all");
    }
    if (selectedProjectId !== "all" && !validProjectIds.has(selectedProjectId)) {
      setSelectedProjectId("all");
    }
    if (!taskDrawerOpen) return;
    setTaskForm((prev) => {
      const nextProjectId = validProjectIds.has(prev.projectId) ? prev.projectId : (defaultProjectId || "");
      const nextAssigneeId = validMemberIds.has(prev.assigneeMemberId)
        ? prev.assigneeMemberId
        : (defaultMemberId || "");
      if (nextProjectId === prev.projectId && nextAssigneeId === prev.assigneeMemberId) {
        return prev;
      }
      return { ...prev, projectId: nextProjectId, assigneeMemberId: nextAssigneeId };
    });
  }, [
    members,
    projects,
    selectedMemberId,
    selectedProjectId,
    taskDrawerOpen,
    defaultProjectId,
    defaultMemberId,
  ]);

  const filteredMembers = useMemo(() => {
    const base = safeArray<Member>(members);
    const q = memberSearch.trim().toLowerCase();
    return base
      .filter((item) => (selectedTeam === "all" ? true : item.team === selectedTeam))
      .filter((item) => (selectedMemberId === "all" ? true : item.id === selectedMemberId))
      .filter((item) => {
        if (!q) return true;
        return item.fullName.toLowerCase().includes(q) || item.email.toLowerCase().includes(q);
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [members, selectedTeam, selectedMemberId, memberSearch]);

  const filteredProjects = useMemo(() => {
    const base = safeArray<Project>(projects);
    const q = projectSearch.trim().toLowerCase();
    return base.filter((p) => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.projectCode.toLowerCase().includes(q) ||
        (p.category?.toLowerCase().includes(q) ?? false) ||
        (p.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [projects, projectSearch]);
  const filteredTasks = useMemo(() => {
    const taskList = asTaskArray(tasks);
    const memberList = safeArray<Member>(members);
    // Build set of member IDs that match current team filter
    const teamMemberIds =
      selectedTeam === "all"
        ? null
        : new Set(memberList.filter((m) => m.team === selectedTeam).map((m) => m.id));

    return taskList.filter((item) => {
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

  /**
   * Dashboard KPI cards (Open / Overdue) must follow only filters shown on the Dashboard tab
   * (team + due date range), not project/member filters from the Tasks tab — otherwise counts
   * stay at 0 when those Task filters exclude everything.
   */
  const tasksForDashboardKpis = useMemo(() => {
    const list = asTaskArray(tasksAllFlatQuery.data);
    const rows = Array.isArray(list) ? list : [];
    const memberList = safeArray<Member>(members);
    const teamMemberIds =
      selectedTeam === "all"
        ? null
        : new Set(memberList.filter((m) => m.team === selectedTeam).map((m) => m.id));

    return rows.filter((item) => {
      if (teamMemberIds && !teamMemberIds.has(item.assigneeMemberId)) return false;
      if (dateFrom && item.dueDate < dateFrom) return false;
      if (dateTo && item.dueDate > dateTo) return false;
      return true;
    });
  }, [tasksAllFlatQuery.data, members, selectedTeam, dateFrom, dateTo]);

  /** Derived rows for Task table — reuse row objects when underlying Task ref + labels unchanged so memoized rows skip re-render. */
  const taskTableRows = useMemo<TaskTableRow[]>(() => {
    const cache = taskRowObjectCache;
    const out: TaskTableRow[] = [];
    const seen = new Set<string>();
    const rowsIn = asTaskArray(filteredTasks);
    for (const task of rowsIn) {
      if (!task?.id) continue;
      seen.add(task.id);
      const project = projectById.get(task.projectId);
      const member = memberById.get(task.assigneeMemberId);
      const projectName = task.projectName?.trim() || project?.name?.trim() || "—";
      const assigneeName = member?.fullName ?? "—";
      const prev = cache.get(task.id);
      if (
        prev &&
        prev.raw === task &&
        prev._builtWithMounted === mounted &&
        prev.projectName === projectName &&
        prev.assigneeName === assigneeName
      ) {
        out.push(prev);
        continue;
      }
      const startDateStr = task.plannedStartDate ?? (mounted ? new Date().toISOString().slice(0, 10) : "");
      const days = mounted && startDateStr ? countBusinessDaysInclusive(startDateStr, task.dueDate) : 0;
      const progress = task.completedAt ? 100 : (task.progress ?? 0);
      const next: TaskTableRow & { _builtWithMounted?: boolean } = {
        id: task.id,
        taskCode: task.taskCode,
        title: task.title,
        projectName,
        assigneeName,
        startDate: mounted ? formatDate(startDateStr || task.dueDate) : formatDate(task.dueDate),
        days,
        completeDate: formatDate(task.dueDate),
        priority: priorityLabel(task.priority),
        progress,
        raw: task,
        _builtWithMounted: mounted,
      };
      cache.set(task.id, next);
      out.push(next);
    }
    for (const id of [...cache.keys()]) {
      if (!seen.has(id)) cache.delete(id);
    }
    return out;
  }, [filteredTasks, projectById, memberById, mounted, taskRowObjectCache]);

  const timelineMonthDays = useMemo(() => {
    // Tasks timeline always follows the current month.
    if (!mounted) return [];
    return getMonthDays(new Date());
  }, [mounted]);

  const taskColumns = useMemo(() => createTaskColumns(timelineMonthDays), [timelineMonthDays]);

  const taskTableMeta = useMemo<TaskTableMeta>(
    () => ({
      activeTaskCell,
      mounted,
      canMutateTasks,
      canAssignAnyMember,
      canEditTask: (task: Task) => canEditTask(task),
      members,
      projects,
      assignableMembers,
      timelineMonthDays,
      setActiveTaskCell,
      updateTaskMutate,
      deleteTaskMutate,
      commitProgress,
      commitTaskTitle,
      isTaskRowFlashing,
    }),
    [
      activeTaskCell,
      mounted,
      canMutateTasks,
      canAssignAnyMember,
      canEditTask,
      members,
      projects,
      assignableMembers,
      timelineMonthDays,
      updateTaskMutate,
      deleteTaskMutate,
      commitProgress,
      commitTaskTitle,
      isTaskRowFlashing,
    ],
  );

  const summary = useMemo(() => {
    const kpiTasks = asTaskArray(tasksForDashboardKpis);
    const kpiRows = Array.isArray(kpiTasks) ? kpiTasks : [];
    const projList = safeArray<Project>(projects);
    const membersForSummary = safeArray<Member>(filteredMembers);
    const today = mounted ? new Date() : null;
    const openTasks = kpiRows.filter((task) => !(task.completedAt || task.progress === 100));
    const overdueTasks = today ? kpiRows.filter((task) => isTaskOverdue(task, today)).length : 0;
    const activeProjects =
      selectedProjectId === "all"
        ? projList.filter((project) => project.status === "active").length
        : projList.filter((project) => project.id === selectedProjectId && project.status === "active").length;
    return {
      activeMembers: membersForSummary.filter((member) => member.status === "active").length,
      activeProjects,
      openTasks: openTasks.length,
      overdueTasks,
    };
  }, [filteredMembers, tasksForDashboardKpis, projects, selectedProjectId, mounted]);

  const delayTrendData = useMemo(() => {
    const ft = asTaskArray(filteredTasks);
    const monthMap = new Map<string, { delayedTasks: number; totalDelay: number; count: number }>();
    for (const task of ft) {
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
    const overdueByMember = new Map<string, number>();
    const ft = asTaskArray(filteredTasks);
    const fm = safeArray<Member>(filteredMembers);
    if (now) {
      for (const task of ft) {
        const aid = task.assigneeMemberId;
        if (!aid || !isTaskOverdue(task, now)) continue;
        overdueByMember.set(aid, (overdueByMember.get(aid) ?? 0) + 1);
      }
    }
    return fm.map((member) => {
      const overdueCount = overdueByMember.get(member.id) ?? 0;
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
    const ft = asTaskArray(filteredTasks);
    const mems = safeArray<Member>(members);
    for (const item of ft) {
      map.set(item.assigneeMemberId, (map.get(item.assigneeMemberId) ?? 0) + 1);
    }
    return mems.map((member) => ({ name: member.fullName, tasks: map.get(member.id) ?? 0 }));
  }, [members, filteredTasks]);
  const memberChartInnerHeight = useMemo(() => Math.max(420, members.length * 28), [members.length]);
  const memberChartCardHeight = memberChartInnerHeight + 90;

  if (membersQuery.error || projectsQuery.error || tasksInfinite.error) {
    return (
      <Container suppressHydrationWarning sx={{ py: 4 }}>
        <Typography color="error" component="div" sx={{ whiteSpace: "pre-wrap" }}>
          {`Failed to load data. Current API base: ${publicApiBaseUrl}
If using localhost: start backend on port 4000, or set NEXT_PUBLIC_USE_API_PROXY=true and BACKEND_PROXY_TARGET to your Render URL (see frontend/.env.example).
If using production: set NEXT_PUBLIC_API_BASE_URL to your Render URL and redeploy. On Render, ALLOWED_ORIGIN must include your browser origin (Vercel + http://localhost:3000 for dev).`}
        </Typography>
      </Container>
    );
  }

  if (membersQuery.isLoading || projectsQuery.isLoading || tasksInfinite.isPending) {
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
    {
      id: "actions",
      header: () => (
        <Box sx={{ width: "100%", textAlign: "right", pr: 1 }}>
          Actions
        </Box>
      ),
      cell: ({ row }) => (
        <Box sx={{ width: "100%", display: "flex", justifyContent: "flex-end" }}>
          {canManageMembers ? (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                onClick={() => {
                  if (!canManageMembers) return;
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
              <Button
                size="small"
                color="error"
                onClick={() => {
                  if (!canManageMembers) return;
                  deleteMemberMutation.mutate(row.original.id);
                }}
              >
                Delete
              </Button>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          )}
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
          {canManageProjects ? (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                onClick={() => {
                  if (!canManageProjects) return;
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
              <Button
                size="small"
                color="error"
                onClick={() => {
                  if (!canManageProjects) return;
                  deleteProjectMutation.mutate(row.original.id);
                }}
              >
                Delete
              </Button>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              —
            </Typography>
          )}
        </Box>
      ),
    },
  ];

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <AppBar position="static" color="inherit" elevation={0}>
          <Toolbar className="border-b border-slate-200/80 bg-white/95 backdrop-blur" sx={{ justifyContent: "space-between" }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                component="img"
                src="/innova-logo.png"
                alt="Innova logo"
                sx={{
                  height: 40,
                  width: "auto",
                  display: "block",
                }}
              />
              <Box>
                <Typography fontWeight={800} className="text-slate-900">
                  {"Software team's work schedule"}
                </Typography>
                <Typography variant="caption" className="text-slate-500">
                  {"Thuan Ngo's Software Team"}
                </Typography>
              </Box>
            </Stack>
            <AppHeaderAuth />
          </Toolbar>
          <Box
            sx={{
              borderBottom: 1,
              borderColor: "divider",
              px: { xs: 1, sm: 2 },
              bgcolor: "background.paper",
            }}
          >
            <Tabs
              value={activeTab}
              onChange={(_, value) => setActiveTab(value)}
              variant="scrollable"
              scrollButtons="auto"
              allowScrollButtonsMobile
              aria-label="Main sections"
            >
              <Tab label="Dashboard" id="main-tab-0" />
              <Tab label="Members" id="main-tab-1" />
              <Tab label="Projects" id="main-tab-2" />
              <Tab label="Tasks" id="main-tab-3" />
              {canManageAccounts ? <Tab label="Accounts" id="main-tab-4" /> : null}
            </Tabs>
          </Box>
        </AppBar>
        <Container
          maxWidth={false}
          sx={{ py: 4, px: { xs: 2, md: 3 } }}
          className="bg-slate-50/60"
          id={`nav-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`main-tab-${activeTab}`}
        >
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
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} flexWrap="wrap" useFlexGap>
                    <TextField
                      label="Search name or email"
                      size="small"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Type to filter…"
                      sx={{
                        minWidth: { xs: "100%", md: 260 },
                        flex: { md: "1 1 260px" },
                        "& .MuiOutlinedInput-root": {
                          borderRadius: "12px",
                          backgroundColor: "#fff",
                          transition: "all 300ms",
                        },
                        "& fieldset": { borderColor: "#e5e7eb" },
                        "& .MuiOutlinedInput-root:hover fieldset": { borderColor: "#cbd5e1" },
                      }}
                    />
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
            {activeTab === 2 && (
              <Box className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-300 hover:shadow-md">
                <Stack direction={{ xs: "column", md: "row" }} spacing={2.5} flexWrap="wrap" useFlexGap>
                  <TextField
                    label="Search project"
                    size="small"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Name, code, category…"
                    sx={{
                      minWidth: { xs: "100%", md: 280 },
                      flex: { md: "1 1 280px" },
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "12px",
                        backgroundColor: "#fff",
                        transition: "all 300ms",
                      },
                      "& fieldset": { borderColor: "#e5e7eb" },
                      "& .MuiOutlinedInput-root:hover fieldset": { borderColor: "#cbd5e1" },
                    }}
                  />
                </Stack>
              </Box>
            )}
            {activeTab === 0 ? (
              <>
                <Typography variant="h4" fontWeight={800} className="tracking-tight text-slate-900">
                  {"Software team's work schedule"}
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
                        <BarChart
                          layout="vertical"
                          data={safeArray<Record<string, unknown>>(performanceChartData)}
                          margin={{ top: 8, right: 24, left: 180, bottom: 8 }}
                        >
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
                        <BarChart
                          layout="vertical"
                          data={safeArray<Record<string, unknown>>(workloadByMember)}
                          margin={{ top: 8, right: 24, left: 180, bottom: 8 }}
                        >
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
                  {canManageMembers ? (
                    <Button
                      variant="contained"
                      onClick={() => {
                        if (!canManageMembers) return;
                        setEditMember(null);
                        setMemberForm({
                          fullName: "",
                          email: "",
                          role: "member",
                          team: selectedTeam === "all" ? "Mobile Team" : selectedTeam,
                          status: "active",
                        });
                        setMemberFormInputKey((k) => k + 1);
                        setMemberErrors({});
                        setDialogOpen(true);
                      }}
                    >
                      Add member
                    </Button>
                  ) : null}
                </Stack>
                <DataTable columns={memberColumns} data={filteredMembers} />
                {filteredMembers.length === 0 ? <Alert severity="info">No members match the current filters.</Alert> : null}
              </>
            ) : null}

            {activeTab === 2 ? (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h5">Projects</Typography>
                  {canManageProjects ? (
                    <Button
                      variant="contained"
                      onClick={() => {
                        if (!canManageProjects) return;
                        setEditProject(null);
                        setProjectForm(DEFAULT_PROJECT_FORM);
                        setProjectFormInputKey((k) => k + 1);
                        setProjectErrors({});
                        setProjectDialogOpen(true);
                      }}
                    >
                      Add project
                    </Button>
                  ) : null}
                </Stack>
                <DataTable columns={projectColumns} data={filteredProjects} />
                {projects.length === 0 ? (
                  <Alert severity="info">No projects loaded.</Alert>
                ) : filteredProjects.length === 0 ? (
                  <Alert severity="info">No projects match the current filters.</Alert>
                ) : null}
              </>
            ) : null}

            {activeTab === 3 ? (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h5">Tasks</Typography>
                  <Stack direction="row" spacing={1}>
                    {canExportTasks ? (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          if (!canExportTasks) return;
                          void exportTasksToXLSX(taskTableRows, timelineMonthDays);
                        }}
                        disabled={taskTableRows.length === 0}
                      >
                        Export XLSX
                      </Button>
                    ) : null}
                    {canMutateTasks ? (
                      <Button
                        variant="contained"
                        onClick={() => {
                          if (!canMutateTasks) return;
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
                    ) : null}
                  </Stack>
                </Stack>
                <TaskDataTable
                  columns={taskColumns}
                  data={taskTableRows}
                  minTableWidth={1500}
                  tableMeta={taskTableMeta}
                  fetchNextPage={() => void tasksInfinite.fetchNextPage()}
                  hasNextPage={tasksInfinite.hasNextPage}
                  isFetchingNextPage={tasksInfinite.isFetchingNextPage}
                />
                <Typography variant="body2" color="text.secondary">
                  Showing {taskTableRows.length}/{filteredTasksTotal} tasks
                  {tasksInfinite.isFetchingNextPage ? " · Loading…" : null}
                </Typography>
                {taskTableRows.length === 0 ? <Alert severity="info">No tasks match the current filters.</Alert> : null}
              </>
            ) : null}

            {activeTab === 4 && canManageAccounts ? (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h5">Create Account</Typography>
                </Stack>
                <Box className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md">
                  <Stack spacing={2}>
                    <TextField
                      label="Full name"
                      value={accountForm.fullName}
                      onChange={(event) =>
                        setAccountForm((prev) => ({ ...prev, fullName: event.target.value }))
                      }
                    />
                    <Stack direction="row" spacing={1.5}>
                      <TextField
                        label="Email"
                        value={accountEmailLocalPart}
                        onChange={(event) =>
                          setAccountForm((prev) => ({
                            ...prev,
                            email: normalizeMemberEmailInput(event.target.value, false),
                          }))
                        }
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        label="Domain"
                        value={DEFAULT_MEMBER_EMAIL_DOMAIN}
                        InputProps={{ readOnly: true }}
                        sx={{ width: 190 }}
                      />
                    </Stack>
                    <TextField
                      label="Password"
                      type="password"
                      value={accountForm.password}
                      onChange={(event) =>
                        setAccountForm((prev) => ({ ...prev, password: event.target.value }))
                      }
                      helperText="Minimum 6 characters"
                    />
                    <TextField
                      select
                      label="Role"
                      value={accountForm.role}
                      onChange={(event) =>
                        setAccountForm((prev) => ({
                          ...prev,
                          role: event.target.value as Member["role"],
                        }))
                      }
                    >
                      <MenuItem value="admin">admin</MenuItem>
                      <MenuItem value="lead">lead</MenuItem>
                      <MenuItem value="member">member</MenuItem>
                    </TextField>
                    <TextField
                      select
                      label="Team"
                      value={accountForm.team}
                      onChange={(event) =>
                        setAccountForm((prev) => ({ ...prev, team: event.target.value }))
                      }
                    >
                      <MenuItem value="Mobile Team">Mobile Team</MenuItem>
                      <MenuItem value="OS Team">OS Team</MenuItem>
                      <MenuItem value="Tester Team">Tester Team</MenuItem>
                      <MenuItem value="Tablet Team">Tablet Team</MenuItem>
                      <MenuItem value="Web Team">Web Team</MenuItem>
                      <MenuItem value="Passthrough Team">Passthrough Team</MenuItem>
                      <MenuItem value="Server API Team">Server API Team</MenuItem>
                    </TextField>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={accountForm.mustChangePassword}
                          onChange={(event) =>
                            setAccountForm((prev) => ({
                              ...prev,
                              mustChangePassword: event.target.checked,
                            }))
                          }
                        />
                      }
                      label="Require password change at first login"
                    />
                    <Button
                      variant="contained"
                      disabled={createAccountMutation.isPending}
                      onClick={() => {
                        const fullName = accountForm.fullName.trim();
                        const email = accountForm.email.trim();
                        if (!fullName || !email) {
                          setAccountCreateError("Full name and email are required.");
                          setAccountCreateSuccess(null);
                          return;
                        }
                        if (!email.includes("@")) {
                          setAccountCreateError("Email format is invalid.");
                          setAccountCreateSuccess(null);
                          return;
                        }
                        if (accountForm.password.length < 6) {
                          setAccountCreateError("Password must be at least 6 characters.");
                          setAccountCreateSuccess(null);
                          return;
                        }
                        setAccountCreateError(null);
                        setAccountCreateSuccess(null);
                        createAccountMutation.mutate({
                          fullName,
                          email,
                          role: accountForm.role,
                          team: accountForm.team,
                          password: accountForm.password,
                          mustChangePassword: accountForm.mustChangePassword,
                        });
                      }}
                    >
                      {createAccountMutation.isPending ? "Creating..." : "Create account"}
                    </Button>
                    {accountCreateError ? <Alert severity="error">{accountCreateError}</Alert> : null}
                    {accountCreateSuccess ? <Alert severity="success">{accountCreateSuccess}</Alert> : null}
                  </Stack>
                </Box>
              </>
            ) : null}
          </Stack>
        </Container>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editMember ? "Edit member" : "Add member"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {memberErrors._form ? <Alert severity="error">{memberErrors._form}</Alert> : null}
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
              if (!canManageMembers) return;
              const payload = {
                ...memberForm,
                fullName: (memberFullNameInputRef.current?.value ?? "").trim(),
                email: (memberEmailInputRef.current?.value ?? "").trim(),
              };
              setMemberErrors({});
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
              disabled={user?.role === "member"}
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
                  if (!canMutateTasks) return;
                  const payload = {
                    ...taskForm,
                    title: (taskTitleInputRef.current?.value ?? "").trim(),
                    assigneeMemberId: user?.role === "member" ? (resolvedCurrentMemberId || taskForm.assigneeMemberId) : taskForm.assigneeMemberId,
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

      <Dialog
        open={Boolean(taskDeleteConfirmId)}
        onClose={() => {
          if (deleteTaskMutation.isPending) return;
          setTaskDeleteConfirmId(null);
        }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Delete task</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this task?</Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setTaskDeleteConfirmId(null)}
            disabled={deleteTaskMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleteTaskMutation.isPending || !taskDeleteConfirmId}
            onClick={() => {
              if (!taskDeleteConfirmId) return;
              deleteTaskMutation.mutate(taskDeleteConfirmId);
            }}
          >
            {deleteTaskMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

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
              if (!canManageProjects) return;
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
