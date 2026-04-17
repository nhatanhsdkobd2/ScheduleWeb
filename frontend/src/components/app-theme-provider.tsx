"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

type AppThemeMode = "light" | "dark";

type AppThemeContextValue = {
  mode: AppThemeMode;
  isDark: boolean;
  setMode: (mode: AppThemeMode) => void;
  toggleTheme: () => void;
};

const THEME_MODE_STORAGE_KEY = "schedule-web-theme-mode";

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

export default function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<AppThemeMode>("light");

  useEffect(() => {
    const storedMode = typeof window !== "undefined" ? window.localStorage.getItem(THEME_MODE_STORAGE_KEY) : null;
    if (storedMode === "light" || storedMode === "dark") {
      setMode(storedMode);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    const root = document.documentElement;
    root.classList.toggle("app-dark", mode === "dark");
    root.classList.toggle("app-light", mode === "light");
  }, [mode]);

  const toggleTheme = useCallback(() => {
    setMode((prev) => (prev === "light" ? "dark" : "light"));
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: "#217346" },
          background:
            mode === "dark"
              ? { default: "#010101", paper: "#111111" }
              : { default: "#f8fafc", paper: "#ffffff" },
        },
        typography: {
          fontFamily: "Aptos, \"Segoe UI\", Arial, Helvetica, sans-serif",
        },
        shape: { borderRadius: 10 },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                transition: "background-color 220ms ease, color 220ms ease",
              },
            },
          },
          MuiAppBar: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
                borderBottom:
                  mode === "dark" ? "1px solid rgba(148, 163, 184, 0.22)" : "1px solid rgba(148, 163, 184, 0.18)",
                boxShadow:
                  mode === "dark"
                    ? "0 8px 24px rgba(2, 6, 23, 0.35)"
                    : "0 6px 18px rgba(15, 23, 42, 0.08)",
              },
            },
          },
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
                border:
                  mode === "dark" ? "1px solid rgba(148, 163, 184, 0.18)" : "1px solid rgba(148, 163, 184, 0.16)",
              },
            },
          },
          MuiTableCell: {
            styleOverrides: {
              root: {
                borderBottom:
                  mode === "dark" ? "1px solid rgba(148, 163, 184, 0.18)" : "1px solid rgba(148, 163, 184, 0.14)",
              },
              head: {
                fontWeight: 700,
                backgroundColor: mode === "dark" ? "rgba(30, 41, 59, 0.92)" : "rgba(248, 250, 252, 0.94)",
              },
              stickyHeader: {
                backgroundColor: mode === "dark" ? "rgba(30, 41, 59, 0.95)" : "rgba(248, 250, 252, 0.98)",
                backdropFilter: "blur(6px)",
              },
            },
          },
          MuiMenu: {
            styleOverrides: {
              paper: {
                borderRadius: 12,
                boxShadow:
                  mode === "dark"
                    ? "0 16px 36px rgba(2, 6, 23, 0.5)"
                    : "0 14px 30px rgba(15, 23, 42, 0.18)",
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                borderRadius: 16,
                boxShadow:
                  mode === "dark"
                    ? "0 20px 44px rgba(2, 6, 23, 0.55)"
                    : "0 16px 36px rgba(15, 23, 42, 0.2)",
              },
            },
          },
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                backgroundColor: mode === "dark" ? "#111111" : undefined,
              },
              notchedOutline: {
                borderColor: mode === "dark" ? "rgba(148, 163, 184, 0.32)" : undefined,
              },
            },
          },
        },
      }),
    [mode],
  );

  const contextValue = useMemo<AppThemeContextValue>(
    () => ({
      mode,
      isDark: mode === "dark",
      setMode,
      toggleTheme,
    }),
    [mode, toggleTheme],
  );

  return (
    <AppThemeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppThemeContext.Provider>
  );
}

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
}
