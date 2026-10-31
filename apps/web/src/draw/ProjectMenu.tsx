/**
 * Header menu: the open project's name, renaming it, other projects to switch to, and "New
 * project". The name also names the generated project's default folder.
 */
import { Button, Menu, Modal, TextInput, UnstyledButton } from "@mantine/core";
import { IconChevronDown, IconPencil, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { api, type Project } from "./api.ts";
import { ProjectChooser } from "./ProjectChooser.tsx";
import { RecipeDialog } from "./RecipeDialog.tsx";
import { useDraw } from "./store.ts";

export function ProjectMenu() {
  const project = useDraw((s) => s.loaded?.project);
  const open = useDraw((s) => s.open);
  const [recipeOpen, setRecipeOpen] = useState(false);
  const [chooserOpen, setChooserOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  if (!project) return null;
  const name = renaming?.trim() ?? "";
  const rename = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await api.renameProject(project.id, name);
      await open(project.id);
      setRenaming(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
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
          <Menu.Item
            leftSection={<IconPencil size={14} />}
            onClick={() => {
              setError(undefined);
              setRenaming(project.name);
            }}
          >
            Rename project
          </Menu.Item>
          <Menu.Divider />
          <Menu.Label>Projects</Menu.Label>
          {projects.map((p) => (
            <Menu.Item key={p.id} disabled={p.id === project.id} onClick={() => void open(p.id)}>
              {p.name}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item leftSection={<IconPlus size={14} />} onClick={() => setRecipeOpen(true)}>
            New from recipe
          </Menu.Item>
          <Menu.Item leftSection={<IconPlus size={14} />} onClick={() => setChooserOpen(true)}>
            New project
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>
      {chooserOpen ? <ProjectChooser onClose={() => setChooserOpen(false)} /> : null}
      <RecipeDialog opened={recipeOpen} onClose={() => setRecipeOpen(false)} />
      <Modal opened={renaming !== null} onClose={() => setRenaming(null)} title="Rename project">
        <form
          className="project-rename"
          onSubmit={(event) => {
            event.preventDefault();
            if (name) void rename();
          }}
        >
          <TextInput
            label="Project name"
            description="Also the default name of the generated project's folder."
            value={renaming ?? ""}
            error={error}
            data-autofocus
            onChange={(event) => setRenaming(event.currentTarget.value)}
          />
          <div className="project-rename-actions">
            <Button variant="default" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button type="submit" color="cyan.9" disabled={!name} loading={saving}>
              Rename
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
