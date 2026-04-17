"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppBar, Box, Button, CircularProgress, Container, Stack, TextField, Toolbar, Typography } from "@mui/material";
import { useAuth } from "@/context/AuthContext";

export default function ChangePasswordPage() {
  const { user, loading, changeMyPassword, signOutUser } = useAuth();
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
    <Box sx={{ minHeight: "100vh", bgcolor: "#fff" }}>
      <AppBar position="static" color="inherit" elevation={0}>
        <Toolbar className="border-b border-slate-200/80 bg-white/95 backdrop-blur" sx={{ justifyContent: "flex-start" }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              component="img"
              src="/innova-logo.png"
              alt="Innova logo"
              sx={{ height: 40, width: "auto", display: "block" }}
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
            <Button variant="contained" disabled={submitting} onClick={() => void handleChangePassword()}>
              {submitting ? "Saving..." : "Update password"}
            </Button>
            <Button
              variant="text"
              color="inherit"
              onClick={() => void signOutUser().then(() => router.replace("/login"))}
            >
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
