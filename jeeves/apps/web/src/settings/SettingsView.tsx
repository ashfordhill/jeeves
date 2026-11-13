/**
 * Settings: connections first, one card per provider (its status, then a key field, or Codex's
 * sign-in), then the design chat's model. A saved key is never shown again: the field is emptied
 * after a save and never refilled, and the API never answers with a key.
 */
import { Autocomplete, Button, Loader, NativeSelect, PasswordInput } from "@mantine/core";
import { useEffect, useState } from "react";
import {
  api,
  type CodexLoginState,
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

/** How often a card waiting for a browser sign-in asks whether it has finished. */
const SIGN_IN_POLL_MS = 2000;

/**
 * Codex's sign-in. Signed out, **Sign in with ChatGPT** runs `codex login` on the server and links
 * the sign-in page it prints; the card then asks every 2 seconds until Codex is signed in or the
 * login fails, when it shows why and the terminal command. Signed in, **Sign out**.
 */
function CodexSignIn({
  provider,
  command,
  onSettings,
}: {
  provider: ProviderStatus;
  command: string;
  onSettings: (next: Settings) => void;
}) {
  const [login, setLogin] = useState<CodexLoginState>({ state: "idle" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const waiting = !provider.ready && login.state === "waiting";

  useEffect(() => {
    if (!waiting) return;
    let live = true;
    const timer = window.setInterval(() => {
      void Promise.all([api.settings(), api.codexSignInState()])
        .then(([next, state]) => {
          if (!live) return;
          setError(undefined);
          const signedIn = next.providers.find((p) => p.id === provider.id)?.ready ?? false;
          if (signedIn || state.state !== "waiting") onSettings(next);
          setLogin(signedIn ? { state: "idle" } : state);
        })
        .catch((e: unknown) => {
          if (live) setError(errorText(e));
        });
    }, SIGN_IN_POLL_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [waiting, provider.id, onSettings]);

  const run = async (call: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await call();
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

  if (provider.ready) {
    return (
      <div className="settings-key">
        <button
          type="button"
          className="settings-button"
          data-tone="danger"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const next = await api.codexSignOut();
              setLogin({ state: "idle" });
              onSettings(next);
            })
          }
        >
          Sign out
        </button>
        {alert}
      </div>
    );
  }

  return (
    <div className="settings-login">
      <div className="settings-key">
        <button
          type="button"
          className="settings-button"
          data-tone="primary"
          disabled={busy}
          onClick={() => void run(async () => setLogin(await api.codexSignIn()))}
        >
          Sign in with ChatGPT
        </button>
        {login.state === "waiting" ? (
          <span className="settings-login-wait" role="status">
            Finish signing in in your browser
          </span>
        ) : null}
        {login.state === "failed" ? (
          <span className="settings-login-fallback">
            or run <code>{command}</code> in a terminal
          </span>
        ) : null}
        {alert}
      </div>
      {login.state === "waiting" && login.url ? (
        <a
          className="settings-login-link"
          href={login.url}
          target="_blank"
          rel="noopener noreferrer"
          title={login.url}
        >
          {login.url}
        </a>
      ) : null}
      {login.state === "failed" ? (
        <p className="settings-login-error" role="alert">
          {login.message}
        </p>
      ) : null}
    </div>
  );
}

/** One provider: its name and status pill, one line of help, then its key field or sign-in. */
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
        <CodexSignIn provider={provider} command={auth.command} onSettings={onSettings} />
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
