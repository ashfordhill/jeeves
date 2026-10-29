/** Header menu: the open project's name, other projects to switch to, and "New project". */
import { Menu, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { api, type Project } from "./api.ts";
import { useDraw } from "./store.ts";

export function ProjectMenu() {
  const project = useDraw((s) => s.loaded?.project);
  const open = useDraw((s) => s.open);
  const [projects, setProjects] = useState<Project[]>([]);

  if (!project) return null;
  return (
    <Menu
      position="bottom-end"
      width={260}
      shadow="md"
      onOpen={() => {
        api.listProjects().then(setProjects, () => setProjects([]));
      }}
    >
      <Menu.Target>
        <UnstyledButton className="project-menu-btn" aria-label={`Project: ${project.name}`}>
          <span className="project-menu-name">{project.name}</span>
          <IconChevronDown size={16} aria-hidden />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Projects</Menu.Label>
        {projects.map((p) => (
          <Menu.Item key={p.id} disabled={p.id === project.id} onClick={() => void open(p.id)}>
            {p.name}
          </Menu.Item>
        ))}
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconPlus size={14} />}
          onClick={async () => {
            const created = await api.createProject("Untitled design");
            await open(created.id);
          }}
        >
          New project
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
