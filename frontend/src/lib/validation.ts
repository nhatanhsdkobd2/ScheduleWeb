"use client";

import { z } from "zod";

export const memberFormSchema = z.object({
  memberCode: z.string().min(3, "Member code toi thieu 3 ky tu"),
  fullName: z.string().min(2, "Full name toi thieu 2 ky tu"),
  email: z.string().email("Email khong hop le"),
  role: z.enum(["admin", "pm", "lead", "member"]),
  team: z.string().min(1, "Team khong duoc de trong"),
  status: z.enum(["active", "inactive"]),
});

export const taskFormSchema = z.object({
  taskCode: z.string().min(3, "Task code toi thieu 3 ky tu"),
  title: z.string().min(3, "Title toi thieu 3 ky tu"),
  projectId: z.string().min(1, "Can chon project"),
  assigneeMemberId: z.string().min(1, "Can chon assignee"),
  dueDate: z.string().min(1, "Can chon due date"),
  priority: z.enum(["low", "medium", "high", "critical"]),
});

export type FormErrors = Record<string, string>;

export function parseFormErrors(issues: z.ZodIssue[]): FormErrors {
  const output: FormErrors = {};
  for (const issue of issues) {
    const key = issue.path.join(".");
    if (!output[key]) output[key] = issue.message;
  }
  return output;
}
