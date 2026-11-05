/**
 * Settings: connections first (each provider's status and exact setup command), then
 * the design chat's model. Keys and logins are set up outside the UI; Jeeves never shows them.
 */
import { Autocomplete, Button, CopyButton, Loader, NativeSelect } from "@mantine/core";
import { useEffect, useState } from "react";
import {
  api,
  type ModelRole,
  type ProviderStatus,
  type RoleModel,
  type SettingsView as Settings,
} from "../project/api.ts";
import { StatusBadge } from "../shell/StatusBadge.tsx";
import "./settings.css";

const MODEL_ROWS: {
  role: ModelRole;
  label: string;
  providerLabel: string;
  description: string;
}[] = [
  {
    role: "designChat",
    label: "Design model",
    providerLabel: "Design provider",
    description: "Edits the design from the Chat tab.",
  },
];

function same(a: RoleModel, b: RoleModel) {
  return a.provider === b.provider && a.model.trim() === b.model.trim();
}

function modelProblem(provider: ProviderStatus | undefined, model: string) {
  if (!provider) return "Pick a provider.";
  if (!model.trim() && !provider.defaultModelAllowed) return "Enter a model name.";
  return undefined;
}

function setupCommand(provider: ProviderStatus): string {
  if (provider.auth.type === "cli-login") return provider.auth.command;
  return `export ${provider.auth.envVar}=`;
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
  const allRoles = MODEL_ROWS.map((row) => row.role);
  const changed = allRoles.filter((role) => !same(roles[role], settings.roles[role]));
  const valid = allRoles.every(
    (role) => !modelProblem(providerOf(roles[role].provider), roles[role].model),
  );
  const update = (role: ModelRole, next: RoleModel) => {
    setSaved(false);
    setRoles({ ...roles, [role]: next });
  };
  const providerOptions = settings.providers.map((p) => ({ value: p.id, label: p.name }));
  const roleFields = (role: ModelRole, providerLabel: string) => {
    const choice = roles[role];
    const provider = providerOf(choice.provider);
    return (
      <div className="settings-role-fields">
        <NativeSelect
          label={providerLabel}
          value={choice.provider}
          data={providerOptions}
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
          label={`${providerLabel.replace(" provider", "")} model`}
          value={choice.model}
          data={provider?.suggestedModels ?? []}
          placeholder={provider?.defaultModelAllowed ? `${provider.name}'s default` : undefined}
          error={modelProblem(provider, choice.model)}
          onChange={(model) =>
            update(role, {
              ...choice,
              model,
            })
          }
        />
      </div>
    );
  };

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      const next = await api.setRoles(
        Object.fromEntries(
          changed.map((role) => [
            role,
            {
              provider: roles[role].provider,
              model: roles[role].model.trim(),
            },
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

      <section className="settings-card" aria-labelledby="settings-connections">
        <h2 id="settings-connections">Connections</h2>
        {settings.fakeModel ? (
          <p className="settings-note" role="status">
            The server is replaying a scripted fake model (<code>JEEVES_FAKE_MODEL_SCRIPT</code>),
            so no provider is called.
          </p>
        ) : null}
        <ul className="settings-providers">
          {settings.providers.map((p) => {
            const command = setupCommand(p);
            return (
              <li key={p.id}>
                <span className="settings-provider-name">{p.name}</span>
                <StatusBadge color={p.ready ? "teal" : "red"}>{p.status}</StatusBadge>
                <p className="settings-connection-help" title={p.help ?? p.description}>
                  {p.help ?? p.description}
                </p>
                <CopyButton value={command} timeout={1500}>
                  {({ copied, copy }) => (
                    <button
                      type="button"
                      className="settings-setup"
                      onClick={copy}
                      aria-label={`Copy ${p.name} setup command`}
                    >
                      <code>{command}</code>
                      <span className="settings-copy">{copied ? "Copied" : "Copy"}</span>
                    </button>
                  )}
                </CopyButton>
              </li>
            );
          })}
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
          {MODEL_ROWS.map(({ role, label, providerLabel, description }) => {
            const choice = roles[role];
            const provider = providerOf(choice.provider);
            return (
              <fieldset key={role} className="settings-role">
                <legend>{label}</legend>
                <p className="settings-help">{description}</p>
                {roleFields(role, providerLabel)}
                {provider && !provider.ready && !settings.fakeModel ? (
                  <p className="settings-warning">
                    {provider.name} isn't set up yet ({provider.status}). See Connections above.
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
              Save model
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
