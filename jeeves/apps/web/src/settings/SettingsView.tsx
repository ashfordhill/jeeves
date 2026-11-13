/**
 * Settings: connections first, one card per provider (its status, then a key field, or the
 * command for a CLI login), then the design chat's model. A saved key is never shown again: the
 * field is emptied after a save and never refilled, and the API never answers with a key.
 */
import {
  Autocomplete,
  Button,
  CopyButton,
  Loader,
  NativeSelect,
  PasswordInput,
} from "@mantine/core";
import { useEffect, useState } from "react";
import {
  api,
  type ModelRole,
  type ProviderAuth,
  type ProviderStatus,
  type RoleModel,
  type SettingsView as Settings,
} from "../project/api.ts";
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

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The length the server accepts, once trimmed. */
const KEY_LENGTH = { min: 8, max: 400 };

/**
 * A key provider's field: with no key, a password box and Save key; with a saved key, Saved,
 * Replace and Remove; with a key from the environment, only where it comes from.
 */
function KeyField({
  provider,
  auth,
  onSettings,
}: {
  provider: ProviderStatus;
  auth: Extract<ProviderAuth, { type: "api-key" }>;
  onSettings: (next: Settings) => void;
}) {
  const [value, setValue] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (provider.keySource === "env") {
    return (
      <p className="settings-key-env">
        Set by <code>{auth.envVar}</code> in the environment
      </p>
    );
  }

  const run = async (call: () => Promise<Settings>, done?: () => void) => {
    setBusy(true);
    setError(undefined);
    try {
      const next = await call();
      done?.();
      onSettings(next);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const alert = error ? (
    <span className="settings-error" role="alert">
      {error}
    </span>
  ) : null;

  if (provider.keySource === "file" && !replacing) {
    return (
      <div className="settings-key">
        <span className="settings-key-saved">
          <span className="settings-key-dots" aria-hidden="true">
            ••••••••••••••••
          </span>
          Saved
        </span>
        <button
          type="button"
          className="settings-button"
          aria-label={`Replace ${provider.name} key`}
          onClick={() => {
            setError(undefined);
            setReplacing(true);
          }}
        >
          Replace
        </button>
        <button
          type="button"
          className="settings-button"
          data-tone="danger"
          aria-label={`Remove ${provider.name} key`}
          disabled={busy}
          onClick={() => void run(() => api.removeKey(provider.id))}
        >
          Remove
        </button>
        {alert}
      </div>
    );
  }

  const key = value.trim();
  return (
    <form
      className="settings-key"
      onSubmit={(event) => {
        event.preventDefault();
        if (key.length < KEY_LENGTH.min || key.length > KEY_LENGTH.max) {
          setError(`A key is ${KEY_LENGTH.min} to ${KEY_LENGTH.max} characters.`);
          return;
        }
        void run(
          () => api.setKey(provider.id, key),
          () => {
            setValue("");
            setReplacing(false);
          },
        );
      }}
    >
      <PasswordInput
        className="settings-key-input"
        aria-label={`${provider.name} key`}
        placeholder="Paste a key"
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
      <button type="submit" className="settings-button" data-tone="primary" disabled={busy}>
        Save key
      </button>
      {replacing ? (
        <button
          type="button"
          className="settings-button"
          onClick={() => {
            setValue("");
            setError(undefined);
            setReplacing(false);
          }}
        >
          Cancel
        </button>
      ) : null}
      {alert}
    </form>
  );
}

/** One provider: its name and status pill, one line of help, then its key field or command. */
function ProviderCard({
  provider,
  onSettings,
}: {
  provider: ProviderStatus;
  onSettings: (next: Settings) => void;
}) {
  const { auth } = provider;
  const help = provider.help ?? provider.description;
  return (
    <li className="settings-provider" aria-label={provider.name}>
      <div className="settings-provider-head">
        <span className="settings-provider-name">{provider.name}</span>
        <span className="settings-status" data-ready={provider.ready}>
          <span className="settings-status-dot" aria-hidden="true" />
          {provider.status}
        </span>
      </div>
      <p className="settings-connection-help" title={help}>
        {help}
      </p>
      {auth.type === "api-key" ? (
        <KeyField provider={provider} auth={auth} onSettings={onSettings} />
      ) : (
        <CopyButton value={auth.command} timeout={1500}>
          {({ copied, copy }) => (
            <button
              type="button"
              className="settings-setup"
              onClick={copy}
              aria-label={`Copy ${provider.name} setup command`}
            >
              <code>{auth.command}</code>
              <span className="settings-copy">{copied ? "Copied" : "Copy"}</span>
            </button>
          )}
        </CopyButton>
      )}
    </li>
  );
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
      <div className="view-loading" role="status">
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

      <section className="settings-section" aria-labelledby="settings-connections">
        <h2 id="settings-connections">Connections</h2>
        {settings.fakeModel ? (
          <p className="settings-note" role="status">
            The server is replaying a scripted fake model (<code>JEEVES_FAKE_MODEL_SCRIPT</code>),
            so no provider is called.
          </p>
        ) : null}
        <ul className="settings-providers">
          {settings.providers.map((p) => (
            <ProviderCard key={p.id} provider={p} onSettings={setSettings} />
          ))}
        </ul>
        <p className="settings-help">
          A key is saved to <code>{settings.configPath}</code>, readable by you only, and never
          shown again or stored in designs. A key set in the environment wins.
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
