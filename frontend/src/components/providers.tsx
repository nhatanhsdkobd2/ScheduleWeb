"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useMemo, useState } from "react";

type UiState = {
  selectedTeam: string;
  setSelectedTeam: (value: string) => void;
};

export const UiStateContext = createContext<UiState>({
  selectedTeam: "all",
  setSelectedTeam: () => undefined,
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [selectedTeam, setSelectedTeam] = useState("all");
  const value = useMemo(() => ({ selectedTeam, setSelectedTeam }), [selectedTeam]);

  return (
    <QueryClientProvider client={queryClient}>
      <UiStateContext.Provider value={value}>{children}</UiStateContext.Provider>
    </QueryClientProvider>
  );
}
