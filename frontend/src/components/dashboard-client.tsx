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
  Divider,
  Drawer,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Member, Project, Task, WeeklyReportRow } from "@shared/types/domain";
import {
  createTask,
  createMember,
  createProject,
  deleteMember,
  deleteProject,
  getMembers,
  getProjects,
  getTasksByFilters,
  getTaskHistory,
  getWeeklyReportRows,
  updateProject,
  updateTask,
  updateMember,
} from "@/lib/api";
import { memberFormSchema, parseFormErrors, taskFormSchema, type FormErrors } from "@/lib/validation";
import FilterBar from "@/components/filter-bar";
import KpiCard from "@/components/kpi-card";
import DataTable from "@/components/data-table";
import type { ColumnDef } from "@tanstack/react-table";

/** Map task status -> progress percentage */
function statusToProgress(status: Task["status"]): number {
  if (status === "done") return 100;
  if (status === "in_progress") return 50;
  if (status === "blocked") return 30;
  if (status === "canceled") return 0;
  return 0;
}

/** Map priority -> display label */
function priorityLabel(priority: Task["priority"]): string {
  if (priority === "critical") return "Critical";
  if (priority === "high") return "High";
  if (priority === "medium") return "Normal";
  return "Low";
}

/** Format date as "Mon-DD-YYYY", e.g. "Apr-04-2026" */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

/** Enriched row type for the 11-column task table */
interface TaskTableRow {
  id: string;
  taskCode: string;
  title: string;
  projectType: string;
  projectName: string;
  assigneeName: string;
  progress: number;
  startDate: string;
  days: number;
  completeDate: string;
  priority: string;
  notes: string;
  status: Task["status"];
  raw: Task;
}

export default function DashboardClient() {
  const queryClient = useQueryClient();
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
  const [selectedStatus, setSelectedStatus] = useState<Task["status"] | "all">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [historyTaskId, setHistoryTaskId] = useState<string | null>(null);
  const [memberErrors, setMemberErrors] = useState<FormErrors>({});
  const [taskErrors, setTaskErrors] = useState<FormErrors>({});
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [projectErrors, setProjectErrors] = useState<FormErrors>({});
  const [projectForm, setProjectForm] = useState<{
    projectCode: string;
    name: string;
    description: string;
    status: Project["status"];
  }>({
    projectCode: "",
    name: "",
    description: "",
    status: "active",
  });

  const DEFAULT_PROJECT_FORM = {
    projectCode: "",
    name: "",
    description: "",
    status: "active" as Project["status"],
  };

  const [memberForm, setMemberForm] = useState<Omit<Member, "id">>({
    memberCode: "",
    fullName: "",
    email: "",
    role: "member",
    team: "Platform",
    status: "active",
  });
  const [taskForm, setTaskForm] = useState<Omit<Task, "id" | "status">>({
    taskCode: "",
    title: "",
    projectId: "",
    assigneeMemberId: "",
    dueDate: "",
    priority: "medium",
  });

  const membersQuery = useQuery<Member[]>({ queryKey: ["members"], queryFn: getMembers });
  const projectsQuery = useQuery<Project[]>({ queryKey: ["projects"], queryFn: getProjects });
  const tasksQuery = useQuery<Task[]>({
    queryKey: ["tasks", search, selectedProjectId, selectedMemberId, selectedStatus, dateFrom, dateTo],
    queryFn: () =>
      getTasksByFilters({
        search,
        projectId: selectedProjectId === "all" ? undefined : selectedProjectId,
        memberId: selectedMemberId === "all" ? undefined : selectedMemberId,
        status: selectedStatus === "all" ? undefined : selectedStatus,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });
  const weeklyQuery = useQuery<WeeklyReportRow[]>({ queryKey: ["weekly-rows"], queryFn: getWeeklyReportRows });
  const taskHistoryQuery = useQuery({
    queryKey: ["task-history", historyTaskId],
    queryFn: () => getTaskHistory(historyTaskId ?? ""),
    enabled: historyDialogOpen && Boolean(historyTaskId),
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
    mutationFn: createTask,
    onSuccess: () => {
      setTaskDrawerOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<Omit<Task, "id">> }) => updateTask(id, payload),
    onSuccess: () => {
      setTaskDrawerOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
  const createProjectMutation = useMutation({
    mutationFn: (payload: Omit<Project, "id">) => createProject(payload),
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

  const reportRows = weeklyQuery.data ?? [];
  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const members = useMemo(() => membersQuery.data ?? [], [membersQuery.data]);
  const projects = useMemo(() => projectsQuery.data ?? [], [projectsQuery.data]);

  /** Default IDs for new task creation */
  const defaultProjectId = useMemo(
    () => projects.find((p) => p.projectCode === "INN-001")?.id ?? projects[0]?.id ?? "",
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
    // When search is empty, show all tasks; otherwise filter by title/taskCode
    if (!search.trim()) return tasks;
    return tasks.filter((item) =>
      `${item.taskCode} ${item.title}`.toLowerCase().includes(search.toLowerCase()),
    );
  }, [tasks, search]);

  /** Derived 11-column rows for Task table */
  const taskTableRows = useMemo<TaskTableRow[]>(() => {
    return filteredTasks.map((task) => {
      const project = projects.find((p) => p.id === task.projectId);
      const member = members.find((m) => m.id === task.assigneeMemberId);
      const progress = statusToProgress(task.status);
      const dueMs = new Date(task.dueDate).getTime();
      // Default start = 7 days before due
      const startDateStr = task.completedAt ? task.completedAt : new Date(dueMs - 7 * 86400000).toISOString().slice(0, 10);
      const days = Math.ceil((dueMs - new Date(startDateStr).getTime()) / 86400000);
      return {
        id: task.id,
        taskCode: task.taskCode,
        title: task.title,
        projectType: project?.category ?? "—",
        projectName: project?.name ?? "—",
        assigneeName: member?.fullName ?? "—",
        progress,
        startDate: formatDate(startDateStr),
        days,
        completeDate: formatDate(task.dueDate),
        priority: priorityLabel(task.priority),
        notes: "—",
        status: task.status,
        raw: task,
      };
    });
  }, [filteredTasks, projects, members]);

  const summary = useMemo(() => {
    const openTasks = filteredTasks.filter((task) => task.status !== "done" && task.status !== "canceled");
    const overdueTasks = openTasks.filter((task) => new Date(task.dueDate) < new Date()).length;
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
  }, [filteredMembers, filteredTasks, projects, selectedProjectId]);

  const statusChartData = useMemo(() => {
    const map = new Map<Task["status"], number>();
    for (const task of filteredTasks) {
      map.set(task.status, (map.get(task.status) ?? 0) + 1);
    }
    return [...map.entries()].map(([status, value]) => ({ status, value }));
  }, [filteredTasks]);

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
    return filteredMembers.map((member) => {
      const ownTasks = filteredTasks.filter((task) => task.assigneeMemberId === member.id);
      const overdueCount = ownTasks.filter((task) => task.status !== "done" && new Date(task.dueDate) < new Date()).length;
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
  }, [filteredMembers, filteredTasks]);
  const workloadByMember = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of tasks) {
      map.set(item.assigneeMemberId, (map.get(item.assigneeMemberId) ?? 0) + 1);
    }
    return members.map((member) => ({ name: member.fullName, tasks: map.get(member.id) ?? 0 }));
  }, [members, tasks]);
  const completionVsOverdue = useMemo(() => {
    const done = tasks.filter((task) => task.status === "done").length;
    const overdue = tasks.filter((task) => task.status !== "done" && new Date(task.dueDate) < new Date()).length;
    return [{ label: "Done", value: done }, { label: "Overdue", value: overdue }];
  }, [tasks]);
  const calendarEvents = useMemo(
    () =>
      tasks.map((task) => ({
        id: task.id,
        title: task.title,
        date: task.dueDate,
      })),
    [tasks],
  );
  if (membersQuery.error || projectsQuery.error || tasksQuery.error) {
    return (
      <Container sx={{ py: 4 }}>
        <Typography color="error">Khong the tai du lieu. Hay chay backend tai cong 4000.</Typography>
      </Container>
    );
  }

  if (membersQuery.isLoading || projectsQuery.isLoading || tasksQuery.isLoading) {
    return (
      <Container sx={{ py: 4 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={24} />
          <Typography>Dang tai dashboard...</Typography>
        </Stack>
      </Container>
    );
  }

  const memberColumns: ColumnDef<Member>[] = [
    { accessorKey: "memberCode", header: "Code" },
    { accessorKey: "fullName", header: "Name" },
    { accessorKey: "email", header: "Email" },
    { accessorKey: "team", header: "Team" },
    { accessorKey: "role", header: "Role" },
    { accessorKey: "status", header: "Status" },
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
                memberCode: row.original.memberCode,
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
    { accessorKey: "projectCode", header: "Code" },
    { accessorKey: "name", header: "Name" },
    { accessorKey: "status", header: "Status" },
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
                projectCode: row.original.projectCode,
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
      cell: ({ row }) => (
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
            "& input": { py: 0.5, whiteSpace: "nowrap", overflow: "visible", textOverflow: "unset" },
          }}
        />
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
    // Start — read-only derived
    {
      id: "startDate",
      header: "Start",
      cell: ({ row }) => (
        <Typography variant="body2" color="text.secondary" sx={{ minWidth: 90 }}>
          {row.original.startDate}
        </Typography>
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
    // Status — inline Select with overdue highlight
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => {
        const isOverdue =
          row.original.status !== "done" &&
          row.original.status !== "canceled" &&
          new Date(row.original.raw.dueDate) < new Date();
        return (
          <TextField
            select
            size="small"
            variant="standard"
            fullWidth
            value={row.original.status}
            disabled={!canMutate}
            onChange={(e) => {
              const newStatus = e.target.value as Task["status"];
              updateTaskMutation.mutate({
                id: row.original.id,
                payload: {
                  status: newStatus,
                  completedAt: newStatus === "done" ? new Date().toISOString().slice(0, 10) : undefined,
                },
              });
            }}
            sx={{
              "& .MuiSelect-select": { py: 0.5 },
              "& .MuiInputBase-root": isOverdue
                ? { color: "error.main", fontWeight: 700 }
                : {},
            }}
          >
            <MenuItem value="todo">Todo</MenuItem>
            <MenuItem value="in_progress">In Progress</MenuItem>
            <MenuItem value="blocked">Blocked</MenuItem>
            <MenuItem value="done">Done</MenuItem>
            <MenuItem value="canceled">Canceled</MenuItem>
          </TextField>
        );
      },
    },
    // Actions — History only
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <Button
          size="small"
          onClick={() => {
            setHistoryTaskId(row.original.id);
            setHistoryDialogOpen(true);
          }}
        >
          History
        </Button>
      ),
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
            {activeTab !== 2 && (
              <>
                <FilterBar selectedTeam={selectedTeam} setSelectedTeam={setSelectedTeam} search={search} setSearch={setSearch} />
                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                  <TextField
                    select
                    label="Project"
                    size="small"
                    value={selectedProjectId}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                    sx={{ minWidth: 220, maxHeight: 300, overflow: "auto" }}
                  >
                    <MenuItem value="all">All projects ({projects.length})</MenuItem>
                    {Object.entries(
                      projects.reduce<Record<string, typeof projects>>((acc, p) => {
                        const cat = p.category ?? "Other";
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat]!.push(p);
                        return acc;
                      }, {}),
                    )
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([category, categoryProjects]) => (
                        <Box key={category} component="div">
                          <MenuItem
                            component="div"
                            disabled
                            sx={{ fontWeight: 700, fontSize: "0.75rem", color: "text.secondary", pl: 1, cursor: "default", minHeight: 32 }}
                          >
                            {category}
                          </MenuItem>
                          {categoryProjects.map((project) => (
                            <MenuItem key={project.id} value={project.id} sx={{ pl: 3 }}>
                              {project.name}
                            </MenuItem>
                          ))}
                        </Box>
                      ))}
                  </TextField>
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
              <TextField
                select
                label="Status"
                size="small"
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as Task["status"] | "all")}
                sx={{ minWidth: 160 }}
              >
                <MenuItem value="all">All status</MenuItem>
                <MenuItem value="todo">todo</MenuItem>
                <MenuItem value="in_progress">in_progress</MenuItem>
                <MenuItem value="blocked">blocked</MenuItem>
                <MenuItem value="done">done</MenuItem>
                <MenuItem value="canceled">canceled</MenuItem>
              </TextField>
              <TextField label="Due from" size="small" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField label="Due to" size="small" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} InputLabelProps={{ shrink: true }} />
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
                Task Status Distribution
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="status" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366f1" onClick={() => setActiveTab(3)} />
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
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card variant="outlined" sx={{ p: 2, height: 340 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>
                Completion vs Overdue
              </Typography>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={completionVsOverdue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#14b8a6" />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Grid>
        </Grid>

        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Task Schedule (Month View)
          </Typography>
          <FullCalendar
            plugins={[dayGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,dayGridWeek",
            }}
            events={calendarEvents}
            eventClick={(eventInfo) => {
              window.alert(`Task: ${eventInfo.event.title}`);
            }}
          />
        </Card>

        <Card variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Weekly Report Snapshot
          </Typography>
          <Box sx={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th align="left">Member</th>
                  <th align="right">Assigned</th>
                  <th align="right">Done</th>
                  <th align="right">Overdue</th>
                  <th align="right">Avg Delay Days</th>
                </tr>
              </thead>
              <tbody>
                {reportRows.map((row) => (
                  <tr key={row.memberName}>
                    <td>{row.memberName}</td>
                    <td align="right">{row.assigned}</td>
                    <td align="right">{row.done}</td>
                    <td align="right">{row.overdue}</td>
                    <td align="right">{row.avgDelayDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Box>
        </Card>
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
                        memberCode: "",
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
                  <Button
                    variant="contained"
                    disabled={!canMutate}
                    onClick={() => {
                      setEditTask(null);
                      setTaskForm({
                        taskCode: "",
                        title: "",
                        projectId: defaultProjectId,
                        assigneeMemberId: defaultMemberId,
                        dueDate: new Date().toISOString().slice(0, 10),
                        priority: "medium",
                      });
                      setTaskErrors({});
                      setTaskDrawerOpen(true);
                    }}
                  >
                    Add task
                  </Button>
                </Stack>
                <DataTable columns={taskColumns} data={taskTableRows} />
                {taskTableRows.length === 0 ? <Alert severity="info">Khong co task phu hop voi filter hien tai.</Alert> : null}
                <Stack direction="row" spacing={1}>
                  <Typography variant="body2">Overdue highlights:</Typography>
                  {taskTableRows
                    .filter((row) => row.status !== "done" && new Date(row.raw.dueDate) < new Date())
                    .slice(0, 6)
                    .map((row) => (
                      <Chip key={row.id} color="error" size="small" label={`${row.taskCode} overdue`} />
                    ))}
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
              label="Member code"
              value={memberForm.memberCode}
              onChange={(e) => setMemberForm((s) => ({ ...s, memberCode: e.target.value }))}
              error={Boolean(memberErrors.memberCode)}
              helperText={memberErrors.memberCode}
            />
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
              value={memberForm.team}
              onChange={(e) => setMemberForm((s) => ({ ...s, team: e.target.value }))}
              error={Boolean(memberErrors.team)}
              helperText={memberErrors.team}
            />
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
              label="Task code"
              value={taskForm.taskCode}
              onChange={(e) => setTaskForm((s) => ({ ...s, taskCode: e.target.value }))}
              error={Boolean(taskErrors.taskCode)}
              helperText={taskErrors.taskCode}
            />
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
              label="Project code"
              value={projectForm.projectCode}
              onChange={(e) => setProjectForm((s) => ({ ...s, projectCode: e.target.value }))}
              error={Boolean(projectErrors.projectCode)}
              helperText={projectErrors.projectCode ?? "Unique code, e.g. SDK-002"}
              disabled={Boolean(editProject)}
            />
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
            <TextField
              select
              label="Status"
              value={projectForm.status}
              onChange={(e) => setProjectForm((s) => ({ ...s, status: e.target.value as Project["status"] }))}
            >
              <MenuItem value="planning">planning</MenuItem>
              <MenuItem value="active">active</MenuItem>
              <MenuItem value="on_hold">on_hold</MenuItem>
              <MenuItem value="completed">completed</MenuItem>
              <MenuItem value="canceled">canceled</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProjectDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!projectForm.projectCode.trim() || !projectForm.name.trim()}
            onClick={() => {
              if (!projectForm.projectCode.trim() || !projectForm.name.trim()) return;
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
                  projectCode: projectForm.projectCode.trim(),
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

      <Dialog open={historyDialogOpen} onClose={() => setHistoryDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Assignment history timeline</DialogTitle>
        <DialogContent>
          {taskHistoryQuery.isLoading ? (
            <Typography>Loading history...</Typography>
          ) : (
            <Stack spacing={1} sx={{ mt: 1 }}>
              {(taskHistoryQuery.data ?? []).length === 0 ? (
                <Typography color="text.secondary">Chua co lich su thay doi.</Typography>
              ) : (
                (taskHistoryQuery.data ?? []).map((item) => (
                  <Box key={item.id}>
                    <Typography variant="body2" fontWeight={600}>
                      {item.fieldName}: {item.oldValue} -&gt; {item.newValue}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {item.changedAt}
                    </Typography>
                    <Divider sx={{ mt: 1 }} />
                  </Box>
                ))
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
