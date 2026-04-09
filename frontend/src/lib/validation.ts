"use client";

import { z } from "zod";

export const memberFormSchema = z.object({
  fullName: z.string().min(2, "Full name toi thieu 2 ky tu"),
  email: z.string().email("Email khong hop le"),
  role: z.enum(["admin", "pm", "lead", "member"]),
  team: z.string().min(1, "Team is required"),
  status: z.enum(["active", "inactive"]),
});

export const taskFormSchema = z.object({
  title: z.string().min(3, "Title toi thieu 3 ky tu"),
  projectId: z.string().min(1, "Can chon project"),
  assigneeMemberId: z.string().min(1, "Can chon assignee"),
  dueDate: z.string().min(1, "Can chon due date"),
  priority: z.enum(["low", "medium", "high", "critical"]),
  plannedStartDate: z.string().optional(),
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
