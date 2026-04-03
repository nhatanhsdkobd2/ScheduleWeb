"use client";

import { MenuItem, Stack, TextField } from "@mui/material";

export interface FilterBarProps {
  selectedTeam: string;
  setSelectedTeam: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
}

const TEAMS = [
  "Mobile Team",
  "OS Team",
  "Tester Team",
  "Tablet Team",
  "Web Team",
  "Passthrough Team",
  "Server API Team",
];

export default function FilterBar({ selectedTeam, setSelectedTeam, search, setSearch }: FilterBarProps) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
      <TextField
        label="Search member/task"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        size="small"
      />
      <TextField
        label="Team filter"
        select
        value={selectedTeam}
        onChange={(event) => setSelectedTeam(event.target.value)}
        size="small"
        sx={{ minWidth: 180 }}
      >
        <MenuItem value="all">All teams</MenuItem>
        {TEAMS.map((team) => (
          <MenuItem key={team} value={team}>
            {team}
          </MenuItem>
        ))}
      </TextField>
    </Stack>
  );
}
