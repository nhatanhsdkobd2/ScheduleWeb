"use client";

import { useEffect } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, CircularProgress, Container, Stack, TextField, Typography } from "@mui/material";
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
      setErrorText(message);
      console.error("[auth] Email/password sign-in failed:", error);
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
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={3} alignItems="center">
        <Typography variant="h4" component="h1" fontWeight={700}>
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
          sx={{ px: 3, py: 1.5, textTransform: "none", fontWeight: 600 }}
        >
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
        {errorText ? (
          <Typography color="error" textAlign="center">
            {errorText}
          </Typography>
        ) : null}
      </Stack>
    </Container>
  );
}
