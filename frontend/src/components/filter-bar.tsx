"use client";

import { MenuItem, Stack, TextField } from "@mui/material";

export interface FilterBarProps {
  selectedTeam: string;
  setSelectedTeam: (value: string) => void;
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

export default function FilterBar({ selectedTeam, setSelectedTeam }: FilterBarProps) {
  return (
    <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
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
