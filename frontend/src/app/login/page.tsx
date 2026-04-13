"use client";

import { useEffect } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Button, CircularProgress, Container, Stack, Typography } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [errorText, setErrorText] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const handleGoogle = async () => {
    setErrorText(null);
    try {
      await signInWithGoogle();
      router.replace("/");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Google sign-in failed";
      setErrorText(message);
      console.error("[auth] Google sign-in failed:", error);
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
          Continue with your Google account.
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<GoogleIcon />}
          onClick={() => void handleGoogle()}
          sx={{ px: 3, py: 1.5, textTransform: "none", fontWeight: 600 }}
        >
          Sign in with Google
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
