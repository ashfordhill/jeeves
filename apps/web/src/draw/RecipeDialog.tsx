import {
  Alert,
  Badge,
  Button,
  Group,
  Loader,
  Modal,
  NativeSelect,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useEffect, useState } from "react";
import { api, type ProductRecipe } from "./api.ts";
import { useDraw } from "./store.ts";

/** Finite configuration for the first reviewed product recipe. No model or source upload. */
export function RecipeDialog({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [recipes, setRecipes] = useState<ProductRecipe[]>();
  const [error, setError] = useState<string>();
  const [name, setName] = useState("My QR Studio");
  const [tagline, setTagline] = useState("One link. Room to change.");
  const [days, setDays] = useState("30");
  const [saving, setSaving] = useState(false);
  const open = useDraw((s) => s.open);
  useEffect(() => {
    if (!opened) return;
    let active = true;
    setError(undefined);
    api.recipes().then(
      (value) => {
        if (active) setRecipes(value);
      },
      (error) => {
        if (active) setError(String(error));
      },
    );
    return () => {
      active = false;
    };
  }, [opened]);
  const recipe = recipes?.find((item) => item.id === "qr-studio");
  const create = async () => {
    if (!recipe || saving) return;
    setSaving(true);
    setError(undefined);
    try {
      const project = await api.createFromRecipe(
        name.trim(),
        { id: recipe.id, version: recipe.version },
        { tagline: tagline.trim(), analyticsDays: Number(days) },
      );
      await open(project.id);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!saving) onClose();
      }}
      title="New from recipe"
      size="lg"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <Stack gap="md">
          {recipe ? (
            <>
              <Group justify="space-between">
                <Text fw={700}>{recipe.title}</Text>
                <Badge color="cyan" variant="light">
                  {recipe.maturity} · {recipe.version}
                </Badge>
              </Group>
              <Text size="sm">{recipe.description}</Text>
              <ul>
                {recipe.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <Text size="sm" c="dimmed">
                Creates a separate diagram with the product implementation and acceptance checks
                included. Generate it when ready. Custom features can be added separately.
              </Text>
              <TextInput
                label="Project and product name"
                value={name}
                maxLength={80}
                required
                onChange={(event) => setName(event.currentTarget.value)}
              />
              <TextInput
                label="Product tagline"
                value={tagline}
                maxLength={120}
                required
                onChange={(event) => setTagline(event.currentTarget.value)}
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
          ) : !error ? (
            <Loader aria-label="Loading recipes" />
          ) : null}
          {error ? (
            <Alert color="red" role="alert">
              {error}
            </Alert>
          ) : null}
          <Group justify="flex-end">
            <Button variant="default" disabled={saving} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              color="cyan.9"
              loading={saving}
              disabled={!recipe || !name.trim() || !tagline.trim()}
            >
              Create diagram
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
