/**
 * Settings (PLAN §12): each provider's status (never a key), and the provider and model used for
 * each role. Keys and logins are set up outside the UI, in the environment, the config file, or
 * the provider's own CLI.
 */
import { Autocomplete, Button, Loader, NativeSelect } from "@mantine/core";
import { useEffect, useState } from "react";
import {
  api,
  type ModelRole,
  type ProviderStatus,
  type RoleModel,
  type SettingsView as Settings,
} from "../draw/api.ts";
import { StatusBadge } from "../shell/StatusBadge.tsx";
import "./settings.css";

const ROLES: { role: ModelRole; label: string; description: string }[] = [
  { role: "designChat", label: "Design chat", description: "Edits the design from the Chat tab." },
  { role: "planner", label: "Planner", description: "Breaks a template project into tasks." },
  { role: "coding", label: "Coding agent", description: "Implements each task." },
];

const roleKind = (role: ModelRole) => (role === "coding" ? "coding" : "model");

function same(a: RoleModel, b: RoleModel) {
  return a.provider === b.provider && a.model.trim() === b.model.trim();
}

function modelProblem(provider: ProviderStatus | undefined, model: string) {
  if (!provider) return "Pick a provider.";
  if (!model.trim() && !provider.defaultModelAllowed) return "Enter a model name.";
  return undefined;
}

export function SettingsView() {
  const [settings, setSettings] = useState<Settings>();
  const [roles, setRoles] = useState<Record<ModelRole, RoleModel>>();
  const [error, setError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .settings()
      .then((s) => {
        setSettings(s);
        setRoles(s.roles);
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
  if (!settings || !roles) {
    return (
      <div className="draw-loading" role="status">
        <Loader size="sm" /> Loading settings…
      </div>
    );
  }

  const providerOf = (id: string) => settings.providers.find((p) => p.id === id);
  const changed = ROLES.filter(({ role }) => !same(roles[role], settings.roles[role]));
  const valid = ROLES.every(
    ({ role }) => !modelProblem(providerOf(roles[role].provider), roles[role].model),
  );
  const update = (role: ModelRole, next: RoleModel) => {
    setSaved(false);
    setRoles({ ...roles, [role]: next });
  };
  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const next = await api.setRoles(
        Object.fromEntries(
          changed.map(({ role }) => [
            role,
            { provider: roles[role].provider, model: roles[role].model.trim() },
          ]),
        ),
      );
      setSettings(next);
      setRoles(next.roles);
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
              <StatusBadge color={p.ready ? "teal" : p.available ? "red" : "gray"}>
                {p.status}
              </StatusBadge>
              <p className="settings-help">{p.description}</p>
              {p.help ? <p className="settings-help">{p.help}</p> : null}
            </li>
          ))}
        </ul>
        <p className="settings-help">
          Keys are read from the environment or <code>{settings.configPath}</code>. They're never
          shown here or stored in designs.
        </p>
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
          {ROLES.map(({ role, label, description }) => {
            const choice = roles[role];
            const provider = providerOf(choice.provider);
            const options = settings.providers.filter((p) => p.kinds.includes(roleKind(role)));
            return (
              <fieldset key={role} className="settings-role">
                <legend>{label}</legend>
                <p className="settings-help">{description}</p>
                <div className="settings-role-fields">
                  <NativeSelect
                    label={`${label} provider`}
                    value={choice.provider}
                    data={options.map((p) => ({
                      value: p.id,
                      label: p.available ? p.name : `${p.name} (coming later)`,
                      disabled: !p.available,
                    }))}
                    onChange={(event) => {
                      const next = providerOf(event.currentTarget.value);
                      if (!next) return;
                      // A model name rarely carries over between providers.
                      update(role, {
                        provider: next.id,
                        model: next.id === choice.provider ? choice.model : "",
                      });
                    }}
                  />
                  <Autocomplete
                    label={`${label} model`}
                    value={choice.model}
                    data={provider?.suggestedModels ?? []}
                    placeholder={
                      provider?.defaultModelAllowed ? `${provider.name}'s default` : undefined
                    }
                    error={modelProblem(provider, choice.model)}
                    onChange={(model) => update(role, { ...choice, model })}
                  />
                </div>
                {provider &&
                !provider.ready &&
                provider.available &&
                !(settings.fakeModel && roleKind(role) === "model") ? (
                  <p className="settings-warning">
                    {provider.name} isn't set up yet ({provider.status}). See Providers above.
                  </p>
                ) : null}
              </fieldset>
            );
          })}
          <div className="settings-actions">
            <Button
              type="submit"
              color="cyan.9"
              disabled={changed.length === 0 || !valid}
              loading={saving}
            >
              Save models
            </Button>
            {saved && changed.length === 0 ? (
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
