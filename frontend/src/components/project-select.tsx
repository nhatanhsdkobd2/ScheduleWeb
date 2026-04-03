"use client";

import { FormControl, InputLabel, ListSubheader, MenuItem, Select } from "@mui/material";
import type { Project } from "@shared/types/domain";

interface ProjectSelectProps {
  value: string;
  onChange: (value: string) => void;
  projects: Project[];
}

export default function ProjectSelect({ value, onChange, projects }: ProjectSelectProps) {
  // Build flat list: group header + projects
  const menuElements: React.ReactNode[] = [];
  Object.entries(
    projects.reduce<Record<string, Project[]>>((acc, p) => {
      const cat = p.category ?? "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat]!.push(p);
      return acc;
    }, {}),
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([category, ps]) => {
      menuElements.push(
        <ListSubheader key={`hdr-${category}`} sx={{ fontWeight: 700, fontSize: "0.75rem" }}>
          {category}
        </ListSubheader>,
      );
      ps.forEach((project) => {
        menuElements.push(
          <MenuItem key={project.id} value={project.id} sx={{ pl: 3 }}>
            {project.name}
          </MenuItem>,
        );
      });
    });

  return (
    <FormControl size="small" sx={{ minWidth: 220 }}>
      <InputLabel>Project</InputLabel>
      <Select value={value} onChange={(e) => onChange(String(e.target.value))} label="Project">
        <MenuItem value="all">All projects ({projects.length})</MenuItem>
        {menuElements}
      </Select>
    </FormControl>
  );
}
