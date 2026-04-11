"use client";

import { z } from "zod";

export const memberFormSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "pm", "lead", "member"]),
  team: z.string().min(1, "Team is required"),
  status: z.enum(["active", "inactive"]),
});

export const taskFormSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  projectId: z.string().min(1, "Select a project"),
  assigneeMemberId: z.string().min(1, "Select an assignee"),
  dueDate: z.string().min(1, "Select a due date"),
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
