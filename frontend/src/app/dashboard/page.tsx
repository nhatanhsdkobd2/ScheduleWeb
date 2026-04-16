"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Container,
  Stack,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import HomeOutlinedIcon from "@mui/icons-material/HomeOutlined";
import { useAuth } from "@/context/AuthContext";

function displayName(user: { displayName: string | null; email: string | null }): string {
  if (user.displayName?.trim()) return user.displayName.trim();
  if (user.email) return user.email.split("@")[0] ?? user.email;
  return "User";
}

export default function DashboardPage() {
  const { user, loading, signOutUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
    if (!loading && user?.mustChangePassword) {
      router.replace("/change-password");
    }
  }, [user, loading, router]);

  if (loading || !user || user.mustChangePassword) {
    return (
      <Box display="flex" minHeight="100vh" alignItems="center" justifyContent="center">
        <CircularProgress />
      </Box>
    );
  }

  const name = displayName(user);

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Stack spacing={3} alignItems="center">
        <Avatar
          src={user.photoURL ?? undefined}
          alt={name}
          sx={{ width: 96, height: 96 }}
        />
        <Typography variant="h4" component="h1" fontWeight={700} textAlign="center">
          Hello, {name}
        </Typography>
        <Typography color="text.secondary" variant="body1">
          {user.email ?? "—"}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} width="100%" justifyContent="center">
          <Button
            component={Link}
            href="/"
            variant="contained"
            startIcon={<HomeOutlinedIcon />}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Back to app
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<LogoutIcon />}
            onClick={() => void signOutUser().then(() => router.replace("/login"))}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Sign out
          </Button>
        </Stack>
      </Stack>
    </Container>
  );
}
