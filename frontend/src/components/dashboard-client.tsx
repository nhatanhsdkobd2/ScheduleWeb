"use client";

import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CircularProgress,
  Container,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Grid,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Tooltip as MuiTooltip,
  Typography,
} from "@mui/material";
import { useMemo, useState, useEffect } from "react";
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
  updateProject,
  updateTask,
  updateMember,
} from "@/lib/api";
import { memberFormSchema, parseFormErrors, taskFormSchema, type FormErrors } from "@/lib/validation";
import FilterBar from "@/components/filter-bar";
import ProjectSelect from "@/components/project-select";
import KpiCard from "@/components/kpi-card";
import DataTable from "@/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";

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

/** Escape a CSV field: wrap in quotes if it contains comma/quote/newline, and double any embedded quotes */
function escapeCsvField(value: string): string {
  if (/[,"\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Export an array of TaskTableRow to a UTF-8-with-BOM CSV file */
function exportTasksToCSV(rows: TaskTableRow[]): void {
  const headers = [
    "Project Name",
    "Task Description",
    "Assigned To",
    "Start Day",
    "Days",
    "Complete",
    "Priority",
    "Progress",
  ];
  const csvLines: string[] = [
    headers.map(escapeCsvField).join(","),
    ...rows.map((row) =>
      [
        row.projectName,
        row.title,
        row.assigneeName,
        row.startDate || "",
        String(row.days),
        row.completeDate || "",
        row.priority,
        `${row.progress}%`,
      ]
        .map(escapeCsvField)
        .join(","),
    ),
  ];
  const bom = "\uFEFF"; // UTF-8 BOM so Excel opens Vietnamese characters correctly
  const csvContent = bom + csvLines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tasks-export-${new Date().toISOString().slice(0, 10)}.csv`;
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

export default function DashboardClient() {
  const queryClient = useQueryClient();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [selectedRole, setSelectedRole] = useState<"admin" | "pm" | "lead" | "member">("lead");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [selectedMemberId, setSelectedMemberId] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [memberErrors, setMemberErrors] = useState<FormErrors>({});
  const [taskErrors, setTaskErrors] = useState<FormErrors>({});
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [projectErrors, setProjectErrors] = useState<FormErrors>({});
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
  const tasksQuery = useQuery<Task[]>({
    queryKey: ["tasks", search, selectedProjectId, selectedMemberId, dateFrom, dateTo],
    queryFn: () =>
      getTasksByFilters({
        search,
        projectId: selectedProjectId === "all" ? undefined : selectedProjectId,
        memberId: selectedMemberId === "all" ? undefined : selectedMemberId,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const canMutate = selectedRole !== "member";

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
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
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
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

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
      .filter((item) => `${item.fullName} ${item.memberCode}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [members, search, selectedTeam, selectedMemberId]);
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
      if (search.trim() && !`${item.taskCode} ${item.title}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, members, search, selectedTeam, selectedProjectId, selectedMemberId, dateFrom, dateTo]);

  /** Derived rows for Task table */
  const taskTableRows = useMemo<TaskTableRow[]>(() => {
    return filteredTasks.map((task) => {
      const project = projects.find((p) => p.id === task.projectId);
      const member = members.find((m) => m.id === task.assigneeMemberId);
      const dueMs = new Date(task.dueDate).getTime();
      // Use plannedStartDate if set; if not, use today only after mount (avoids hydration mismatch)
      // During SSR / before mount, fallback to empty string → format shows "Invalid Date" but harmless
      const startDateStr = task.plannedStartDate ?? (mounted ? new Date().toISOString().slice(0, 10) : "");
      const days = mounted && startDateStr
        ? Math.ceil((dueMs - new Date(startDateStr).getTime()) / 86400000)
        : 0;
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

  const summary = useMemo(() => {
    const today = mounted ? new Date() : null;
    const openTasks = filteredTasks.filter((task) => !(task.completedAt || task.progress === 100));
    const overdueTasks = today ? openTasks.filter((task) => new Date(task.dueDate) < today).length : 0;
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
      const overdueCount = now ? ownTasks.filter((task) => !task.completedAt && new Date(task.dueDate) < now).length : 0;
      const avgDelayDays =
        ownTasks.length === 0
          ? 0
          : ownTasks.reduce((sum, task) => {
              if (!task.completedAt) return sum;
              const due = new Date(task.dueDate).getTime();
              const done = new Date(task.completedAt).getTime();
              return sum + Math.max(0, Math.floor((done - due) / (24 * 60 * 60 * 1000)));
            }, 0) / ownTasks.length;
      const overdueRatio = ownTasks.length === 0 ? 0 : overdueCount / ownTasks.length;
      const score = Math.max(0, Math.round(100 - avgDelayDays * 12 - overdueRatio * 35));
      return {
        name: member.fullName,
        score,
        avgDelayDays: Number(avgDelayDays.toFixed(2)),
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

  /** Overdue chips — only compute after mount to avoid hydration mismatch */
  const overdueChips = useMemo(() => {
    if (!mounted) return null;
    const today = new Date();
    return taskTableRows
      .filter((row) => row.raw.progress !== 100 && new Date(row.raw.dueDate) < today)
      .slice(0, 6)
      .map((row) => (
        <Chip key={row.id} color="error" size="small" label={`${row.taskCode} overdue`} />
      ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskTableRows, mounted]);
  if (membersQuery.error || projectsQuery.error || tasksQuery.error) {
    return (
      <Container suppressHydrationWarning sx={{ py: 4 }}>
        <Typography color="error">Khong the tai du lieu. Hay chay backend tai cong 4000.</Typography>
      </Container>
    );
  }

  if (membersQuery.isLoading || projectsQuery.isLoading || tasksQuery.isLoading) {
    return (
      <Container suppressHydrationWarning sx={{ py: 4 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={24} />
          <Typography>Dang tai dashboard...</Typography>
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
      header: "Actions",
      cell: ({ row }) => (
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
      ),
    },
  ];

  const projectColumns: ColumnDef<Project>[] = [
    { accessorKey: "name", header: "Name" },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
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
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <TextField
            size="small"
            variant="standard"
            fullWidth
            value={row.original.title}
            disabled={!canMutate}
            onChange={(e) =>
              updateTaskMutation.mutate({ id: row.original.id, payload: { title: e.target.value } })
            }
            sx={{
              "& input": { py: 0.5, whiteSpace: "normal", overflow: "visible" },
            }}
          />
        </Box>
      ),
    },
    // Assigned to — inline Select
    {
      id: "assigneeName",
      header: "Assigned to",
      cell: ({ row }) => (
        <TextField
          select
          size="small"
          variant="standard"
          fullWidth
          value={row.original.raw.assigneeMemberId}
          disabled={!canMutate}
          onChange={(e) =>
            updateTaskMutation.mutate({ id: row.original.id, payload: { assigneeMemberId: e.target.value } })
          }
          sx={{ "& .MuiSelect-select": { py: 0.5 } }}
        >
          {members.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.fullName}
            </MenuItem>
          ))}
        </TextField>
      ),
    },
    // Start Day — inline editable date
    {
      id: "startDate",
      header: "Start Day",
      cell: ({ row }) => (
        <TextField
          type="date"
          size="small"
          variant="standard"
          value={row.original.raw.plannedStartDate ?? new Date().toISOString().slice(0, 10)}
          disabled={!canMutate}
          onChange={(e) =>
            updateTaskMutation.mutate({ id: row.original.id, payload: { plannedStartDate: e.target.value } })
          }
          InputLabelProps={{ shrink: true }}
          sx={{ "& input": { py: 0.5, width: 130 } }}
        />
      ),
    },
    // Days — read-only derived
    {
      id: "days",
      header: "Days",
      cell: ({ row }) => (
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 40 }}>
          {row.original.days}
        </Typography>
      ),
    },
    // Complete — inline date
    {
      id: "completeDate",
      header: "Complete",
      cell: ({ row }) => (
        <TextField
          type="date"
          size="small"
          variant="standard"
          value={row.original.raw.dueDate}
          disabled={!canMutate}
          onChange={(e) =>
            updateTaskMutation.mutate({ id: row.original.id, payload: { dueDate: e.target.value } })
          }
          InputLabelProps={{ shrink: true }}
          sx={{ "& input": { py: 0.5, width: 130 } }}
        />
      ),
    },
    // Priority — inline Select
    {
      id: "priority",
      header: "Priority",
      cell: ({ row }) => (
        <TextField
          select
          size="small"
          variant="standard"
          fullWidth
          value={row.original.raw.priority}
          disabled={!canMutate}
          onChange={(e) =>
            updateTaskMutation.mutate({
              id: row.original.id,
              payload: { priority: e.target.value as Task["priority"] },
            })
          }
          sx={{ "& .MuiSelect-select": { py: 0.5 } }}
        >
          <MenuItem value="low">Low</MenuItem>
          <MenuItem value="medium">Normal</MenuItem>
          <MenuItem value="high">High</MenuItem>
          <MenuItem value="critical">Critical</MenuItem>
        </TextField>
      ),
    },
    // Progress — Typography %, Tooltip, LinearProgress, editable input
    {
      id: "progress",
      header: "Progress",
      cell: ({ row }) => {
        const progress = row.original.progress;
        const dueDate = new Date(row.original.raw.dueDate);
        // Avoid hydration mismatch: compute overdue only after mount
        if (!mounted) {
          return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 140 }}>
              <Typography variant="body2" fontWeight={700}>{progress}%</Typography>
              <LinearProgress variant="determinate" value={progress} sx={{ flex: 1, height: 7, borderRadius: 3, bgcolor: "grey.200" }} />
            </Box>
          );
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const isOverdue = progress < 100 && dueDate < today;
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 140 }}>
            <MuiTooltip title={tooltipTitle} arrow>
              <Typography
                variant="body2"
                fontWeight={700}
                color={isOverdue ? "error.main" : progress === 100 ? "success.main" : "text.primary"}
                sx={{ minWidth: 32, textAlign: "right", cursor: "default" }}
              >
                {progress}%
              </Typography>
            </MuiTooltip>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                flex: 1,
                height: 7,
                borderRadius: 3,
                bgcolor: "grey.200",
                "& .MuiLinearProgress-bar": {
                  bgcolor: isOverdue ? "error.main" : progress === 100 ? "success.main" : "info.main",
                  borderRadius: 3,
                },
              }}
            />
            <TextField
              type="number"
              size="small"
              variant="standard"
              value={String(progress)}
              disabled={!canMutate}
              inputProps={{ min: 0, max: 100, style: { width: 44, textAlign: "center", padding: "4px 2px" } }}
              onChange={(e) => {
                const val = Number(e.target.value);
                const clamped = Math.min(100, Math.max(0, isNaN(val) ? 0 : val));
                updateTaskMutation.mutate({ id: row.original.id, payload: { progress: clamped } });
              }}
            />
          </Box>
        );
      },
    },
  ];

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <Drawer variant="permanent" sx={{ width: 220, "& .MuiDrawer-paper": { width: 220, p: 2 } }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
          ScheduleWeb
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
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <Typography fontWeight={700}>Execution phase</Typography>
            <TextField
              select
              label="Role view"
              size="small"
              value={selectedRole}
              onChange={(event) => setSelectedRole(event.target.value as "admin" | "pm" | "lead" | "member")}
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="admin">admin</MenuItem>
              <MenuItem value="pm">pm</MenuItem>
              <MenuItem value="lead">lead</MenuItem>
              <MenuItem value="member">member</MenuItem>
            </TextField>
          </Toolbar>
        </AppBar>
        <Container sx={{ py: 4 }}>
          <Stack spacing={3}>
            {/* Filter — Dashboard tab: Due from / Due to only */}
            {activeTab === 0 && (
              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <TextField
                  select
                  label="Team filter"
                  size="small"
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  sx={{ minWidth: 180 }}
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
                <TextField label="Due from" size="small" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField label="Due to" size="small" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} InputLabelProps={{ shrink: true }} />
              </Stack>
            )}

            {/* Filter — Tasks tab only */}
            {activeTab === 3 && (
              <>
                <FilterBar selectedTeam={selectedTeam} setSelectedTeam={setSelectedTeam} search={search} setSearch={setSearch} />
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <ProjectSelect value={selectedProjectId} onChange={setSelectedProjectId} projects={projects} />
                  <TextField
                    select
                    label="Member"
                    size="small"
                    value={selectedMemberId}
                    onChange={(event) => setSelectedMemberId(event.target.value)}
                    sx={{ minWidth: 180 }}
                  >
                    <MenuItem value="all">All members</MenuItem>
                    {members.map((member) => (
                      <MenuItem key={member.id} value={member.id}>
                        {member.fullName}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField label="Due from" size="small" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} InputLabelProps={{ shrink: true }} />
                  <TextField label="Due to" size="small" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} InputLabelProps={{ shrink: true }} />
                </Stack>
              </>
            )}
            {/* Filter — Members tab: Search + Team + Member only */}
            {activeTab === 1 && (
              <>
                <FilterBar selectedTeam={selectedTeam} setSelectedTeam={setSelectedTeam} search={search} setSearch={setSearch} />
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    select
                    label="Member"
                    size="small"
                    value={selectedMemberId}
                    onChange={(event) => setSelectedMemberId(event.target.value)}
                    sx={{ minWidth: 180 }}
                  >
                    <MenuItem value="all">All members</MenuItem>
                    {members.map((member) => (
                      <MenuItem key={member.id} value={member.id}>
                        {member.fullName}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              </>
            )}
            {!canMutate ? <Alert severity="info">Role member chi duoc xem du lieu.</Alert> : null}
            {activeTab === 0 ? (
              <>
                <Typography variant="h4" fontWeight={700}>
                  ScheduleWeb Dashboard
                </Typography>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <KpiCard label="Active Members" value={summary.activeMembers} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <KpiCard label="Active Projects" value={summary.activeProjects} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <KpiCard label="Open Tasks" value={summary.openTasks} />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <KpiCard label="Overdue Tasks" value={summary.overdueTasks} />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card variant="outlined" sx={{ p: 2, height: 340 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Delay Trend
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={delayTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="delayedTasks" stroke="#ef4444" />
                  <Line type="monotone" dataKey="avgDelayDays" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card variant="outlined" sx={{ p: 2, height: 340 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Performance Score by Member
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={performanceChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="score" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card variant="outlined" sx={{ p: 2, height: 340 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Workload by Member
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={workloadByMember}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="tasks" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
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
                      setMemberErrors({});
                      setDialogOpen(true);
                    }}
                  >
                    Add member
                  </Button>
                </Stack>
                <DataTable columns={memberColumns} data={filteredMembers} />
                {filteredMembers.length === 0 ? <Alert severity="info">Khong co member phu hop voi filter hien tai.</Alert> : null}
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
                      setProjectErrors({});
                      setProjectDialogOpen(true);
                    }}
                  >
                    Add project
                  </Button>
                </Stack>
                <DataTable columns={projectColumns} data={projects} />
                {projects.length === 0 ? <Alert severity="info">Khong co project phu hop.</Alert> : null}
              </>
            ) : null}

            {activeTab === 3 ? (
              <>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="h5">Tasks</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      onClick={() => exportTasksToCSV(taskTableRows)}
                      disabled={taskTableRows.length === 0}
                    >
                      Export CSV
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
                      setTaskErrors({});
                      setTaskDrawerOpen(true);
                    }}
                  >
                    Add task
                  </Button>
                  </Stack>
                </Stack>
                <DataTable columns={taskColumns} data={taskTableRows} />
                {taskTableRows.length === 0 ? <Alert severity="info">Khong co task phu hop voi filter hien tai.</Alert> : null}
                <Stack direction="row" spacing={1}>
                  <Typography variant="body2">Overdue highlights:</Typography>
                  {overdueChips}
                </Stack>
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
              label="Full name"
              value={memberForm.fullName}
              onChange={(e) => setMemberForm((s) => ({ ...s, fullName: e.target.value }))}
              error={Boolean(memberErrors.fullName)}
              helperText={memberErrors.fullName}
            />
            <TextField
              label="Email"
              value={memberForm.email}
              onChange={(e) => setMemberForm((s) => ({ ...s, email: e.target.value }))}
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
              const parsed = memberFormSchema.safeParse(memberForm);
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
              label="Title"
              value={taskForm.title}
              onChange={(e) => setTaskForm((s) => ({ ...s, title: e.target.value }))}
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
                  const parsed = taskFormSchema.safeParse(taskForm);
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
              label="Name"
              value={projectForm.name}
              onChange={(e) => setProjectForm((s) => ({ ...s, name: e.target.value }))}
              error={Boolean(projectErrors.name)}
              helperText={projectErrors.name}
            />
            <TextField
              label="Description"
              value={projectForm.description}
              onChange={(e) => setProjectForm((s) => ({ ...s, description: e.target.value }))}
              multiline
              rows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProjectDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!projectForm.name.trim()}
            onClick={() => {
              if (!projectForm.name.trim()) return;
              if (editProject) {
                updateProjectMutation.mutate({
                  id: editProject.id,
                  payload: {
                    name: projectForm.name.trim(),
                    status: projectForm.status,
                    description: projectForm.description.trim() || undefined,
                  },
                });
              } else {
                createProjectMutation.mutate({
                  name: projectForm.name.trim(),
                  status: projectForm.status,
                  description: projectForm.description.trim() || undefined,
                });
              }
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
}
