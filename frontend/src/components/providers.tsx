"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useMemo, useState } from "react";
import { AuthProvider } from "@/context/AuthContext";

type UiState = {
  selectedTeam: string;
  setSelectedTeam: (value: string) => void;
};

export const UiStateContext = createContext<UiState>({
  selectedTeam: "all",
  setSelectedTeam: () => undefined,
});

function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
        structuralSharing: true,
      },
    },
  });
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createAppQueryClient);
  const [selectedTeam, setSelectedTeam] = useState("all");
  const value = useMemo(() => ({ selectedTeam, setSelectedTeam }), [selectedTeam]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
