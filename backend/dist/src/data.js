export const members = [
    {
        id: "m-1",
        memberCode: "MB001",
        fullName: "Nguyen Van A",
        email: "a@example.com",
        role: "lead",
        team: "Platform",
        status: "active",
    },
    {
        id: "m-2",
        memberCode: "MB002",
        fullName: "Tran Thi B",
        email: "b@example.com",
        role: "member",
        team: "Platform",
        status: "active",
    },
];
export const projects = [
    {
        id: "p-1",
        projectCode: "PRJ001",
        name: "ScheduleWeb",
        ownerMemberId: "m-1",
        status: "active",
    },
];
export const tasks = [
    {
        id: "t-1",
        taskCode: "TSK001",
        title: "Create member module",
        projectId: "p-1",
        assigneeMemberId: "m-2",
        dueDate: "2026-04-03",
        status: "in_progress",
        priority: "high",
    },
    {
        id: "t-2",
        taskCode: "TSK002",
        title: "Build report export",
        projectId: "p-1",
        assigneeMemberId: "m-1",
        dueDate: "2026-03-25",
        completedAt: "2026-03-27",
        status: "done",
        priority: "critical",
    },
];
function toDelayDays(task) {
    if (!task.completedAt) {
        return 0;
    }
    const due = new Date(task.dueDate).getTime();
    const done = new Date(task.completedAt).getTime();
    const delayMs = Math.max(0, done - due);
    return Math.floor(delayMs / (24 * 60 * 60 * 1000));
}
export function getDashboardSummary() {
    const now = new Date();
    const openTasks = tasks.filter((task) => task.status !== "done" && task.status !== "canceled");
    const overdueTasks = openTasks.filter((task) => new Date(task.dueDate) < now).length;
    return {
        activeMembers: members.filter((member) => member.status === "active").length,
        activeProjects: projects.filter((project) => project.status === "active").length,
        openTasks: openTasks.length,
        overdueTasks,
    };
}
export function getStatusDistribution() {
    const counts = new Map();
    for (const task of tasks) {
        counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
    }
    return [...counts.entries()].map(([status, value]) => ({ status, value }));
}
export function getDelayTrend() {
    return [
        { period: "2026-01", delayedTasks: 2, avgDelayDays: 1.5 },
        { period: "2026-02", delayedTasks: 3, avgDelayDays: 2.1 },
        { period: "2026-03", delayedTasks: 1, avgDelayDays: 0.8 },
    ];
}
export function getPerformance() {
    return members.map((member) => {
        const ownTasks = tasks.filter((task) => task.assigneeMemberId === member.id);
        const overdueCount = ownTasks.filter((task) => task.completedAt && toDelayDays(task) > 0).length;
        const avgDelayDays = ownTasks.length === 0 ? 0 : ownTasks.reduce((sum, task) => sum + toDelayDays(task), 0) / ownTasks.length;
        const overdueRatio = ownTasks.length === 0 ? 0 : overdueCount / ownTasks.length;
        const score = Math.max(0, Math.round(100 - avgDelayDays * 12 - overdueRatio * 35));
        return {
            memberId: member.id,
            memberName: member.fullName,
            score,
            avgDelayDays: Number(avgDelayDays.toFixed(2)),
            overdueRatio: Number(overdueRatio.toFixed(2)),
        };
    });
}
export function getWeeklyReportRows() {
    return members.map((member) => {
        const ownTasks = tasks.filter((task) => task.assigneeMemberId === member.id);
        const done = ownTasks.filter((task) => task.status === "done").length;
        const overdue = ownTasks.filter((task) => task.completedAt && toDelayDays(task) > 0).length;
        const avgDelayDays = ownTasks.length === 0 ? 0 : ownTasks.reduce((sum, task) => sum + toDelayDays(task), 0) / ownTasks.length;
        return {
            memberName: member.fullName,
            assigned: ownTasks.length,
            done,
            overdue,
            avgDelayDays: Number(avgDelayDays.toFixed(2)),
        };
    });
}
