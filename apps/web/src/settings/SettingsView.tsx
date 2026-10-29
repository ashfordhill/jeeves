/**
 * Settings (PLAN §12): whether each provider has an API key (never the key itself) and the model
 * used for each role. Keys are set outside the UI, in the environment or the config file.
 */
import { Badge, Button, Loader, TextInput } from "@mantine/core";
import { useEffect, useState } from "react";
import { api, type ModelRole, type SettingsView as Settings } from "../draw/api.ts";
import "./settings.css";

const ROLES: { role: ModelRole; label: string; description: string }[] = [
  { role: "designChat", label: "Design chat", description: "Edits the design from the Chat tab." },
  { role: "planner", label: "Planner", description: "Breaks a template project into tasks." },
  { role: "coding", label: "Coding agent", description: "Implements each task." },
];

function sourceLabel(source: "env" | "file" | null) {
  return source === "env" ? "from the environment" : "from the config file";
}

export function SettingsView() {
  const [settings, setSettings] = useState<Settings>();
  const [models, setModels] = useState<Record<ModelRole, string>>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then((s) => {
        setSettings(s);
        setModels(s.models);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error && !settings) {
    return (
      <div className="empty-view" role="alert">
        <h1>Couldn't load settings</h1>
        <p>{error}</p>
      </div>
    );
  }
  if (!settings || !models) {
    return (
      <div className="draw-loading" role="status">
        <Loader size="sm" /> Loading settings…
      </div>
    );
  }

  const dirty = ROLES.some(({ role }) => models[role].trim() !== settings.models[role]);
  const valid = ROLES.every(({ role }) => models[role].trim().length > 0);
  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const changed = ROLES.filter(({ role }) => models[role].trim() !== settings.models[role]);
      const next = await api.setModels(
        Object.fromEntries(changed.map(({ role }) => [role, models[role].trim()])),
      );
      setSettings(next);
      setModels(next.models);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-view">
      <h1 className="settings-title">Settings</h1>

      <section className="settings-card" aria-labelledby="settings-providers">
        <h2 id="settings-providers">Providers</h2>
        {settings.fakeModel ? (
          <p className="settings-note" role="status">
            The server is replaying a scripted fake model (<code>JEEVES_FAKE_MODEL_SCRIPT</code>),
            so no provider is called.
          </p>
        ) : null}
        <ul className="settings-providers">
          {settings.providers.map((p) => (
            <li key={p.id}>
              <span className="settings-provider-name">{p.name}</span>
              {p.configured ? (
                <Badge color="teal" variant="light">
                  API key set {sourceLabel(p.source)}
                </Badge>
              ) : (
                <Badge color="red" variant="light">
                  No API key
                </Badge>
              )}
              {!p.configured ? (
                <p className="settings-help">
                  Set <code>{p.envVar}</code> before starting Jeeves, or add{" "}
                  <code>{`{"${p.id}": {"apiKey": "…"}}`}</code> to{" "}
                  <code>{settings.configPath}</code>. Keys are never shown or stored in designs.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="settings-card" aria-labelledby="settings-models">
        <h2 id="settings-models">Models</h2>
        <form
          className="settings-models"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          {ROLES.map(({ role, label, description }) => (
            <TextInput
              key={role}
              label={label}
              description={description}
              value={models[role]}
              error={models[role].trim() ? undefined : "Enter a model name."}
              onChange={(event) => {
                setSaved(false);
                setModels({ ...models, [role]: event.currentTarget.value });
              }}
            />
          ))}
          <div className="settings-actions">
            <Button type="submit" disabled={!dirty || !valid} loading={saving}>
              Save models
            </Button>
            {saved && !dirty ? (
              <span className="settings-saved" role="status">
                Saved to {settings.configPath}
              </span>
            ) : null}
            {error ? (
              <span className="settings-error" role="alert">
                {error}
              </span>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
