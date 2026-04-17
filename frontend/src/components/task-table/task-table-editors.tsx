"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Box, TextField, useTheme } from "@mui/material";
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
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const [draft, setDraft] = useState<string>(String(currentProgress));
  const skipBlurCommitRef = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** While true, ignore prop-driven draft sync so we never overwrite local edits with a stale currentProgress. */
  const inputFocusedRef = useRef(false);

  useEffect(() => {
    if (inputFocusedRef.current) return;
    setDraft(String(currentProgress));
  }, [currentProgress, taskId]);

  const clampDraft = useCallback(
    (raw: string) => {
      const parsed = Number(raw);
      return Math.min(100, Math.max(0, Number.isFinite(parsed) ? parsed : currentProgress));
    },
    [currentProgress],
  );

  const fillPercent = Math.min(100, Math.max(0, Number.isFinite(Number(draft)) ? Number(draft) : currentProgress));
  const trackBackground = isDarkMode ? "#111111" : "#f1f5f9";
  const trackBorderColor = isDarkMode ? "rgba(148, 163, 184, 0.42)" : "#d1d5db";
  const fillBackground = isOverdue
    ? isDarkMode
      ? "rgba(220, 38, 38, 0.5)"
      : "rgba(248, 113, 113, 0.4)"
    : isDone
      ? "#217346"
      : isDarkMode
        ? "rgba(33, 115, 70, 0.5)"
        : "rgba(33, 115, 70, 0.32)";
  const textColor = isDarkMode ? "#f8fafc" : isDone ? "#ffffff" : "#0f172a";

  return (
    <Box
      sx={{
        position: "relative",
        width: 120,
        height: 28,
        borderRadius: 1,
        overflow: "hidden",
        border: "1px solid",
        borderColor: trackBorderColor,
        bgcolor: trackBackground,
        "&::before": {
          content: '""',
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: `${fillPercent}%`,
          bgcolor: fillBackground,
          transition: "width 120ms ease",
        },
      }}
    >
      <TextField
        inputRef={inputRef}
        size="small"
        variant="standard"
        value={`${draft}%`}
        InputProps={{ disableUnderline: true }}
        inputProps={{
          readOnly: !canMutate,
          style: { textAlign: "center", padding: "3px 6px", fontWeight: 700, fontSize: "0.86rem", color: textColor },
        }}
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          "& .MuiInputBase-root": { height: "100%" },
          "& input": { color: `${textColor} !important` },
        }}
        onFocus={() => {
          if (!canMutate) {
            inputRef.current?.blur();
            return;
          }
          inputFocusedRef.current = true;
        }}
        onBlur={() => {
          if (!canMutate) return;
          inputFocusedRef.current = false;
          if (skipBlurCommitRef.current) return;
          const clamped = clampDraft(draft);
          if (clamped !== currentProgress) {
            onCommit(taskId, clamped, currentProgress);
          }
        }}
        onChange={(e) => {
          if (!canMutate) return;
          const digits = e.target.value.replace(/[^0-9]/g, "");
          if (!digits) {
            setDraft("0");
            return;
          }
          const normalized = String(Math.min(100, Math.max(0, Number(digits))));
          setDraft(normalized);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          if (!canMutate) return;
          if (e.key === "Enter") {
            if (e.nativeEvent.isComposing) return;
            e.preventDefault();
            e.stopPropagation();
            skipBlurCommitRef.current = true;
            const clamped = clampDraft(draft);
            onCommit(taskId, clamped, currentProgress);
            queueMicrotask(() => {
              inputRef.current?.blur();
              skipBlurCommitRef.current = false;
            });
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
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inputFocusedRef = useRef(false);

  useEffect(() => {
    if (inputFocusedRef.current) return;
    setDraft(currentTitle);
  }, [currentTitle, taskId]);

  return (
    <TextField
      inputRef={inputRef}
      size="small"
      variant="standard"
      fullWidth
      value={draft}
      InputProps={{ disableUnderline: true }}
      inputProps={{ readOnly: !canMutate }}
      onFocus={() => {
        if (!canMutate) {
          inputRef.current?.blur();
          return;
        }
        inputFocusedRef.current = true;
      }}
      onBlur={() => {
        if (!canMutate) return;
        inputFocusedRef.current = false;
      }}
      onChange={(e) => {
        if (!canMutate) return;
        setDraft(e.target.value);
      }}
      onKeyDown={(e) => {
        if (!canMutate) return;
        if (e.key === "Enter") {
          if (e.nativeEvent.isComposing) return;
          e.preventDefault();
          onCommit(taskId, draft, currentTitle);
          queueMicrotask(() => inputRef.current?.blur());
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
