/**
 * All projects in one searchable list: open any of them, or delete the ones you no longer need.
 * Deleting asks once, inline, and never deletes anything outside the chosen row.
 */
import { ActionIcon, Button, Group, Loader, Modal, Text, TextInput, Tooltip } from "@mantine/core";
import { IconSearch, IconTrash } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { api, type Project } from "./api.ts";
import { useDraw } from "./store.ts";

function formatDate(iso: string) {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString();
}

export function ProjectBrowser({ onClose }: { onClose: () => void }) {
  const current = useDraw((s) => s.loaded?.project.id);
  const open = useDraw((s) => s.open);
  const [projects, setProjects] = useState<Project[]>();
  const [query, setQuery] = useState("");
  const [confirming, setConfirming] = useState<string>();
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.listProjects().then(setProjects, (failure) => {
      setError(failure instanceof Error ? failure.message : "Could not list projects.");
      setProjects([]);
    });
  }, []);

  const needle = query.trim().toLowerCase();
  const shown = (projects ?? []).filter((p) => !needle || p.name.toLowerCase().includes(needle));

  const remove = async (id: string) => {
    setBusy(id);
    setError(undefined);
    try {
      await api.deleteProject(id);
      const remaining = (projects ?? []).filter((p) => p.id !== id);
      setProjects(remaining);
      setConfirming(undefined);
      if (id === current) {
        const next = remaining[0];
        if (next) await open(next.id);
        else {
          onClose();
          await open(undefined);
        }
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not delete the project.");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <Modal opened onClose={onClose} title="Projects" size="lg">
      <div className="project-browser">
        <TextInput
          aria-label="Search projects"
          placeholder="Search by name"
          leftSection={<IconSearch size={16} />}
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          data-autofocus
        />
        {error ? (
          <Text size="sm" c="red" role="alert">
            {error}
          </Text>
        ) : null}
        {!projects ? (
          <Group role="status">
            <Loader size="sm" /> Loading projects…
          </Group>
        ) : (
          <ul className="project-browser-list" aria-label="All projects">
            {shown.map((project) => (
              <li key={project.id} className="project-browser-row">
                <button
                  type="button"
                  className="project-browser-open"
                  disabled={project.id === current || busy === project.id}
                  aria-current={project.id === current ? "true" : undefined}
                  onClick={() => {
                    void open(project.id);
                    onClose();
                  }}
                >
                  <strong>{project.name}</strong>
                  <small>
                    {project.target ? "Planning target · " : ""}
                    {formatDate(project.updatedAt)}
                  </small>
                </button>
                {confirming === project.id ? (
                  <Group gap="xs" wrap="nowrap">
                    <Button
                      size="compact-xs"
                      color="red"
                      loading={busy === project.id}
                      onClick={() => void remove(project.id)}
                    >
                      Delete
                    </Button>
                    <Button
                      size="compact-xs"
                      variant="default"
                      disabled={busy === project.id}
                      onClick={() => setConfirming(undefined)}
                    >
                      Keep
                    </Button>
                  </Group>
                ) : (
                  <Tooltip label="Delete project">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      aria-label={`Delete ${project.name}`}
                      disabled={!!busy}
                      onClick={() => setConfirming(project.id)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </li>
            ))}
            {shown.length === 0 ? (
              <li className="project-browser-empty">No projects match.</li>
            ) : null}
          </ul>
        )}
        <Text size="xs" c="dimmed">
          {projects ? `${projects.length} projects` : ""}
        </Text>
      </div>
    </Modal>
  );
}
