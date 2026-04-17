"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppBar, Box, Button, CircularProgress, Container, Stack, TextField, Toolbar, Typography, useTheme } from "@mui/material";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";

function ActionIconMotion({
  children,
  strong = false,
}: {
  children: ReactNode;
  strong?: boolean;
}) {
  const [spinCount, setSpinCount] = useState(0);
  const rotateBy = strong ? 540 : 360;
  return (
    <motion.div
      onClick={() => setSpinCount((prev) => prev + 1)}
      animate={{
        rotate: spinCount * rotateBy,
        scale: spinCount === 0 ? 1 : [1, 0.82, 1],
      }}
      transition={{
        rotate: { type: "spring", stiffness: 300, damping: 15 },
        scale: { duration: 0.2 },
      }}
      whileTap={{ scale: 0.85 }}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}
    >
      {children}
    </motion.div>
  );
}

export default function ChangePasswordPage() {
  const { user, loading, changeMyPassword, signOutUser } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  const handleChangePassword = async () => {
    if (!user) {
      setErrorText("No active session.");
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorText("Please fill all password fields.");
      return;
    }
    if (newPassword.length < 6) {
      setErrorText("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorText("Password confirmation does not match.");
      return;
    }
    setErrorText(null);
    setSubmitting(true);
    try {
      await changeMyPassword(currentPassword, newPassword, confirmPassword);
      router.replace("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to change password";
      setErrorText(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) {
    return (
      <Box display="flex" minHeight="100vh" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary" }}>
      <AppBar position="static" color="inherit" elevation={0}>
        <Toolbar
          sx={{
            justifyContent: "flex-start",
            borderBottom: 1,
            borderColor: "divider",
            bgcolor: theme.palette.mode === "dark" ? "rgba(17, 17, 17, 0.92)" : "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(8px)",
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              component="img"
              src="/innova-logo.png"
              alt="Innova logo"
              sx={{ height: 40, width: "auto", display: "block" }}
            />
            <Box>
              <Typography fontWeight={800} color="text.primary">
                {"Software team's work schedule"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {"Thuan Ngo's Software Team"}
              </Typography>
            </Box>
          </Stack>
        </Toolbar>
      </AppBar>
      <Container maxWidth="sm" sx={{ py: 8 }}>
        <Stack spacing={2.5}>
          <Typography variant="h4" component="h1" fontWeight={700}>
            Change Password
          </Typography>
          <Typography color="text.secondary">
            {user.mustChangePassword
              ? "First login detected. Please change your password before using the system."
              : "Update your account password."}
          </Typography>
          <TextField
            label="Current password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            fullWidth
          />
          <TextField
            label="New password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            fullWidth
          />
          <TextField
            label="Confirm new password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleChangePassword();
              }
            }}
            fullWidth
          />
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              disabled={submitting}
              onClick={() => void handleChangePassword()}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
            >
              <ActionIconMotion>
                <Box
                  component="img"
                  src="/icon-change-password.png"
                  alt=""
                  sx={{ width: 18, height: 18, filter: "brightness(0) invert(1)" }}
                />
              </ActionIconMotion>
              {submitting ? "Saving..." : "Update password"}
            </Button>
            <Button
              variant="text"
              color="inherit"
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
              onClick={() => void signOutUser().then(() => router.replace("/login"))}
            >
              <ActionIconMotion strong>
                <Box
                  component="img"
                  src="/icon-logout.png"
                  alt=""
                  sx={{ width: 18, height: 18, filter: theme.palette.mode === "dark" ? "brightness(0) invert(1)" : "none" }}
                />
              </ActionIconMotion>
              Logout
            </Button>
          </Stack>
          {errorText ? (
            <Typography color="error" textAlign="left">
              {errorText}
            </Typography>
          ) : null}
        </Stack>
      </Container>
    </Box>
  );
}
