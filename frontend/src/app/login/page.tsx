"use client";

import { useEffect } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AppBar, Box, Button, CircularProgress, Container, Stack, TextField, Toolbar, Typography } from "@mui/material";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { user, loading, signInWithPassword } = useAuth();
  const router = useRouter();
  const [errorText, setErrorText] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace(user.mustChangePassword ? "/change-password" : "/");
    }
  }, [user, loading, router]);

  const toFriendlyLoginMessage = (raw: string): string => {
    const normalized = raw.trim().toLowerCase();
    if (normalized.includes("invalid email or password")) {
      return "Incorrect email or password. Please check and try again.";
    }
    if (normalized.includes("cannot connect to backend")) {
      return "Cannot connect to the server. Please check the backend or try again later.";
    }
    return "Sign in failed. Please try again.";
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setErrorText("Please enter email and password.");
      return;
    }
    setErrorText(null);
    setSubmitting(true);
    try {
      const signedInUser = await signInWithPassword(email.trim(), password);
      router.replace(signedInUser.mustChangePassword ? "/change-password" : "/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      setErrorText(toFriendlyLoginMessage(message));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" minHeight="100vh" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  if (user) {
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
        <Stack spacing={3}>
          <Typography variant="h4" component="h1" fontWeight={700} textAlign="center">
            Sign in
          </Typography>
          <Typography color="text.secondary" textAlign="center">
            Use your company account email and password.
          </Typography>
          <TextField
            label="Email"
            type="email"
            fullWidth
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleLogin();
              }
            }}
          />
          <Button
            variant="contained"
            size="large"
            onClick={() => void handleLogin()}
            disabled={submitting}
            sx={{ px: 3, py: 1.5, textTransform: "none", fontWeight: 600, alignSelf: "center" }}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
          {errorText ? <Alert severity="error">{errorText}</Alert> : null}
        </Stack>
      </Container>
    </Box>
  );
}
