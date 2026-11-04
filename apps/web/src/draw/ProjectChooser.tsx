import { studioArchitectureExamples } from "@jeeves/spec";
import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  NativeSelect,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  IconArrowRight,
  IconDatabase,
  IconLayoutDashboard,
  IconPencil,
  IconQrcode,
  IconServer,
  IconSitemap,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { createExampleProject, DEFAULT_EXAMPLE_ID } from "../architecture/create-example.ts";
import { ConfigurationDialog } from "../components/ConfigurationDialog.tsx";
import { type ArchitectureStarter, api, type ProductRecipe, type Project } from "./api.ts";
import { useDraw } from "./store.ts";
import "./project-chooser.css";

type Choice = "study" | "resource" | "recipe" | "blank";
/** A separate project, with the ownership of each starting point explained before creation. */
export function ProjectChooser({ onClose }: { onClose: () => void }) {
  const [choice, setChoice] = useState<Choice>("study");
  const [study, setStudy] = useState<string>(DEFAULT_EXAMPLE_ID);
  const [name, setName] = useState<string>(
    studioArchitectureExamples[0]?.name ?? "Architecture study",
  );
  const [tagline, setTagline] = useState("Inventory, without the busywork.");
  const [qrTagline, setQrTagline] = useState("One link. Room to change.");
  const [preset, setPreset] = useState<"midnight" | "paper">("midnight");
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10),
    [days, setDays] = useState("30");
  const [catalog, setCatalog] = useState<{
    starters: ArchitectureStarter[];
    recipes: ProductRecipe[];
  }>();
  const [loading, setLoading] = useState(true),
    [catalogError, setCatalogError] = useState<string>();
  const [error, setError] = useState<string>(),
    [attempt, setAttempt] = useState(0),
    [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const catalogRequest = useRef<
    { attempt: number; pending: Promise<[ArchitectureStarter[], ProductRecipe[]]> } | undefined
  >(undefined);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setCatalogError(undefined);
    if (catalogRequest.current?.attempt !== attempt)
      catalogRequest.current = { attempt, pending: Promise.all([api.starters(), api.recipes()]) };
    catalogRequest.current.pending.then(
      ([starters, recipes]) => {
        if (active) {
          setCatalog({ starters, recipes });
          setLoading(false);
        }
      },
      (failure) => {
        if (active) {
          setCatalogError(
            failure instanceof Error ? failure.message : "Could not load starting architectures.",
          );
          setLoading(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);
  const starter = catalog?.starters.find((item) => item.id === "resource-workspace");
  const recipe = catalog?.recipes.find((item) => item.id === "qr-studio");
  const example = studioArchitectureExamples.find((item) => item.id === study);
  const allowed =
    !!name.trim() &&
    (choice === "blank" ||
      choice === "study" ||
      (choice === "resource" ? !!starter : !!recipe && !!qrTagline.trim()));
  const create = async () => {
    if (!allowed || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(undefined);
    try {
      let project: Project;
      if (choice === "blank") project = await api.createProject(name.trim());
      else if (choice === "study") project = await createExampleProject(study, name.trim());
      else if (choice === "resource" && starter)
        project = await api.createFromStarter(
          name.trim(),
          { id: starter.id, version: starter.version },
          { preset, pageSize, tagline },
        );
      else if (choice === "recipe" && recipe)
        project = await api.createFromRecipe(
          name.trim(),
          { id: recipe.id, version: recipe.version },
          { tagline: qrTagline.trim(), analyticsDays: Number(days) },
        );
      else throw new Error("Choose an available starting point.");
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
                description: "Start from a source-mapped studio design study.",
              },
              {
                id: "resource",
                icon: <IconLayoutDashboard size={24} />,
                title: "Resource workspace",
                description: "Existing supported accounts, private records and forms.",
              },
              {
                id: "recipe",
                icon: <IconQrcode size={24} />,
                title: "QR Studio",
                description: "A complete QR library, artwork studio and analytics product.",
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
        {catalogError ? (
          <Alert color="red" title="Starting architectures could not load">
            <Stack gap="xs">
              <Text size="sm">{catalogError}</Text>
              <Button
                variant="default"
                size="xs"
                onClick={() => setAttempt((value) => value + 1)}
                disabled={loading || saving}
              >
                Retry catalog
              </Button>
            </Stack>
          </Alert>
        ) : null}
        {loading && choice !== "blank" && choice !== "study" ? (
          <Group role="status">
            <Loader size="sm" /> Loading starting architectures…
          </Group>
        ) : null}
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
          ) : choice === "resource" && starter ? (
            <>
              <Group gap="xs">
                <Badge variant="light" color="cyan">
                  Editable copy
                </Badge>
                <Text size="xs">
                  {starter.version} · {starter.maturity}
                </Text>
              </Group>
              <Text size="sm">
                Start with warehouses and stock items. Account access, forms and paging are supplied
                by existing versioned components. Detailed source contracts stay preserved; new
                domain behavior belongs in separately implemented C4b work.
              </Text>
              <div
                className="starter-topology"
                role="img"
                aria-label="Browser workspace calls the Inventory API, which uses its Postgres database. Workspace members manage their own records."
              >
                <div>
                  <IconLayoutDashboard size={22} />
                  <strong>Workspace</strong>
                  <small>Accounts &amp; records</small>
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <IconServer size={22} />
                  <strong>Resource API</strong>
                  <small>Ownership &amp; contracts</small>
                </div>
                <span aria-hidden="true">→</span>
                <div>
                  <IconDatabase size={22} />
                  <strong>Postgres</strong>
                  <small>Persistent records</small>
                </div>
              </div>
              <TextInput
                label="Workspace tagline"
                value={tagline}
                maxLength={140}
                onChange={(event) => setTagline(event.currentTarget.value)}
              />
              <div className="project-chooser-options">
                <NativeSelect
                  label="Workspace preset"
                  value={preset}
                  data={[
                    { value: "midnight", label: "Midnight · navy and sky" },
                    { value: "paper", label: "Paper · warm white and teal" },
                  ]}
                  onChange={(event) => setPreset(event.currentTarget.value as "midnight" | "paper")}
                />
                <NativeSelect
                  label="Records per page"
                  value={String(pageSize)}
                  data={["10", "25", "50"]}
                  onChange={(event) =>
                    setPageSize(Number(event.currentTarget.value) as 10 | 25 | 50)
                  }
                />
              </div>
              <Text size="xs" c="dimmed">
                Private records for individual accounts. Organization roles, SSO and workflow
                commands need additional capabilities. Creating the diagram does not claim
                verification; Generate checks the application.
              </Text>
            </>
          ) : choice === "recipe" && recipe ? (
            <>
              <Group gap="xs">
                <Badge variant="light" color="cyan">
                  Versioned product
                </Badge>
                <Text size="xs">
                  {recipe.version} · {recipe.maturity}
                </Text>
              </Group>
              <Text size="sm">
                The recipe includes QR URLs, saved artwork, exports and scan analytics with fixed
                acceptance checks. Its core resource definitions and implementation stay protected;
                add custom features separately.
              </Text>
              <TextInput
                label="Product tagline"
                value={qrTagline}
                maxLength={120}
                required
                onChange={(event) => setQrTagline(event.currentTarget.value)}
              />
              <NativeSelect
                label="Default analytics range"
                value={days}
                data={[
                  { value: "7", label: "Last 7 days" },
                  { value: "30", label: "Last 30 days" },
                  { value: "90", label: "Last 90 days" },
                ]}
                onChange={(event) => setDays(event.currentTarget.value)}
              />
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
