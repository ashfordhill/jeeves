import { studioArchitectureExamples } from "@jeeves/spec";
import { Alert, Button, Group, NativeSelect, Stack, Text, TextInput } from "@mantine/core";
import { IconArrowRight, IconPencil, IconSitemap } from "@tabler/icons-react";
import { useRef, useState } from "react";
import { createExampleProject, DEFAULT_EXAMPLE_ID } from "../architecture/create-example.ts";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { api, type Project } from "./api.ts";
import { useDraw } from "./store.ts";
import "./project-chooser.css";

type Choice = "study" | "blank";
/** A separate project, started from a design study or blank. */
export function ProjectChooser({ onClose }: { onClose: () => void }) {
  const [choice, setChoice] = useState<Choice>("study");
  const [study, setStudy] = useState<string>(DEFAULT_EXAMPLE_ID);
  const [name, setName] = useState<string>(
    studioArchitectureExamples[0]?.name ?? "Architecture study",
  );
  const [error, setError] = useState<string>(),
    [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const example = studioArchitectureExamples.find((item) => item.id === study);
  const allowed = !!name.trim();
  const create = async () => {
    if (!allowed || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(undefined);
    try {
      const project: Project =
        choice === "blank"
          ? await api.createProject(name.trim())
          : await createExampleProject(study, name.trim());
      await useDraw.getState().open(project.id);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not create the project.");
      setSaving(false);
      busy.current = false;
    }
  };
  return (
    <ConfigurationDialog
      title="Create a project"
      size="xl"
      onClose={() => {
        if (!busy.current) onClose();
      }}
      footer={
        <Group justify="flex-end">
          <Group>
            <Button variant="default" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button
              color="cyan.9"
              disabled={!allowed || saving}
              loading={saving}
              onClick={() => void create()}
              rightSection={<IconArrowRight size={16} />}
            >
              Create project
            </Button>
          </Group>
        </Group>
      }
    >
      <Stack gap="lg">
        <fieldset className="project-choices" aria-label="Project starting points">
          {(
            [
              {
                id: "study",
                icon: <IconSitemap size={24} />,
                title: "Architecture study",
                description: "Start from the TinyURL design study.",
              },
              {
                id: "blank",
                icon: <IconPencil size={24} />,
                title: "Blank architecture",
                description: "Draw your own applications, data stores and connections.",
              },
            ] as const
          ).map((item) => (
            <button
              type="button"
              className="project-choice"
              key={item.id}
              aria-pressed={choice === item.id}
              aria-label={`Choose ${item.title}`}
              disabled={saving}
              onClick={() => {
                setChoice(item.id);
                setError(undefined);
              }}
            >
              {item.icon}
              <strong>{item.title}</strong>
              <span>{item.description}</span>
            </button>
          ))}
        </fieldset>
        <fieldset disabled={saving} className="project-chooser-fields">
          <TextInput
            label="Project name"
            value={name}
            maxLength={80}
            required
            onChange={(event) => setName(event.currentTarget.value)}
          />
          {choice === "study" ? (
            <>
              <NativeSelect
                label="Study"
                value={study}
                data={studioArchitectureExamples.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
                onChange={(event) => setStudy(event.currentTarget.value)}
              />
              {example ? (
                <Text size="sm">
                  {example.description} Design only; runtime generation is unsupported.
                </Text>
              ) : null}
            </>
          ) : null}
        </fieldset>
        {error ? (
          <Alert color="red" title="Could not create project">
            {error}
          </Alert>
        ) : null}
      </Stack>
    </ConfigurationDialog>
  );
}
