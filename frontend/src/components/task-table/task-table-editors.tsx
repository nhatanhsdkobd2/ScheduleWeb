"use client";

import { memo, useEffect, useState } from "react";
import { Box, TextField } from "@mui/material";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { PickerDay, type PickerDayProps } from "@mui/x-date-pickers/PickerDay";
import { format } from "date-fns";

function toDateOrNull(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function toIsoDate(value: Date | null): string | undefined {
  if (!value) return undefined;
  return format(value, "yyyy-MM-dd");
}

function WeekendDay(props: PickerDayProps) {
  const dayOfWeek = props.day.getDay();
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

export const ProgressEditor = memo(function ProgressEditor({
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
  useEffect(() => {
    setDraft(String(currentProgress));
  }, [currentProgress]);

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

export const TaskDescriptionEditor = memo(function TaskDescriptionEditor({
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
  useEffect(() => {
    setDraft(currentTitle);
  }, [currentTitle]);

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

export const InlineDateEditor = memo(function InlineDateEditor({
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
