/**
 * Settings: one card per provider (its status, then a key field, Codex's sign-in, or the custom
 * endpoint's name, base URL and key). The design chat's model is picked in the chat composer. A
 * saved key is never shown again: the field is emptied after a save and never refilled, and the API
 * never answers with a key.
 */
import { Autocomplete, Loader, PasswordInput, TextInput } from "@mantine/core";
import { IconChevronDown } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import {
  api,
  type CodexLoginState,
  type KnownHost,
  type ProviderAuth,
  type ProviderStatus,
  type SettingsView as Settings,
} from "../project/api.ts";
import "./settings.css";

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

/** The longest name the server keeps for the custom endpoint. */
const ENDPOINT_NAME_MAX = 40;

/**
 * The custom endpoint: with none saved, its name, base URL and key, and **Save**; once saved, the
 * name and base URL, the key as dots, **Replace** (the three fields again, the key empty, with
 * **Cancel**) and **Remove**. The name field lists the known hosts (models.dev's providers with a
 * base URL); picking one fills the name and the base URL. The server checks the base URL and says
 * why it can't take one.
 */
function EndpointField({
  provider,
  endpoint,
  onSettings,
}: {
  provider: ProviderStatus;
  endpoint: Settings["custom"];
  onSettings: (next: Settings) => void;
}) {
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [key, setKey] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [hosts, setHosts] = useState<KnownHost[]>([]);

  useEffect(() => {
    let live = true;
    // Without the list (offline, no catalogue yet) the name is typed.
    api
      .knownHosts()
      .then((next) => {
        if (live) setHosts(next);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

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

  if (endpoint && !replacing) {
    return (
      <div className="settings-endpoint">
        <div className="settings-key">
          <span className="settings-key-saved settings-endpoint-name" title={endpoint.name}>
            <span className="settings-endpoint-value">{endpoint.name}</span>
          </span>
          <span className="settings-key-saved settings-endpoint-url" title={endpoint.baseUrl}>
            <span className="settings-endpoint-value">{endpoint.baseUrl}</span>
          </span>
        </div>
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
            aria-label={`Replace ${provider.name}`}
            onClick={() => {
              setName(endpoint.name);
              setBaseUrl(endpoint.baseUrl);
              setKey("");
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
            aria-label={`Remove ${provider.name}`}
            disabled={busy}
            onClick={() =>
              void run(
                () => api.removeCustomEndpoint(),
                () => {
                  setName("");
                  setBaseUrl("");
                },
              )
            }
          >
            Remove
          </button>
          {alert}
        </div>
      </div>
    );
  }

  const input = { name: name.trim(), baseUrl: baseUrl.trim(), apiKey: key.trim() };
  return (
    <form
      className="settings-endpoint"
      onSubmit={(event) => {
        event.preventDefault();
        if (!input.name || !input.baseUrl || !input.apiKey) {
          setError("Enter a name, a base URL and a key.");
          return;
        }
        if (input.apiKey.length < KEY_LENGTH.min || input.apiKey.length > KEY_LENGTH.max) {
          setError(`A key is ${KEY_LENGTH.min} to ${KEY_LENGTH.max} characters.`);
          return;
        }
        void run(
          () => api.setCustomEndpoint(input),
          () => {
            setKey("");
            setReplacing(false);
          },
        );
      }}
    >
      <div className="settings-key">
        <Autocomplete
          className="settings-key-input settings-endpoint-name"
          aria-label="Endpoint name"
          placeholder="Name, such as DeepSeek"
          autoComplete="off"
          spellCheck={false}
          maxLength={ENDPOINT_NAME_MAX}
          data={hosts.map((host) => host.name)}
          maxDropdownHeight={260}
          rightSection={hosts.length > 0 ? <IconChevronDown size={14} aria-hidden /> : null}
          rightSectionPointerEvents="none"
          value={name}
          onChange={(next) => setName(next.slice(0, ENDPOINT_NAME_MAX))}
          onOptionSubmit={(picked) => {
            const host = hosts.find((h) => h.name === picked);
            if (host) setBaseUrl(host.baseUrl);
          }}
        />
        <TextInput
          className="settings-key-input settings-endpoint-url"
          aria-label="Base URL"
          placeholder="https://api.example.com/v1"
          autoComplete="off"
          spellCheck={false}
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.currentTarget.value)}
        />
      </div>
      <div className="settings-key">
        <PasswordInput
          className="settings-key-input"
          aria-label={`${provider.name} key`}
          placeholder="Paste a key"
          autoComplete="off"
          spellCheck={false}
          value={key}
          onChange={(event) => setKey(event.currentTarget.value)}
        />
        <button type="submit" className="settings-button" data-tone="primary" disabled={busy}>
          Save
        </button>
        {replacing ? (
          <button
            type="button"
            className="settings-button"
            onClick={() => {
              setKey("");
              setError(undefined);
              setReplacing(false);
            }}
          >
            Cancel
          </button>
        ) : null}
        {alert}
      </div>
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

/**
 * One provider: its name and status pill, one line of help, then its key field, sign-in or
 * endpoint fields.
 */
function ProviderCard({
  provider,
  endpoint,
  onSettings,
}: {
  provider: ProviderStatus;
  endpoint: Settings["custom"];
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
      ) : auth.type === "endpoint" ? (
        <EndpointField provider={provider} endpoint={endpoint} onSettings={onSettings} />
      ) : (
        <CodexSignIn provider={provider} command={auth.command} onSettings={onSettings} />
      )}
    </li>
  );
}

export function SettingsView() {
  const [settings, setSettings] = useState<Settings>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    api
      .settings()
      .then(setSettings)
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
  if (!settings) {
    return (
      <div className="view-loading" role="status">
        <Loader size="sm" /> Loading settings…
      </div>
    );
  }

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
            <ProviderCard
              key={p.id}
              provider={p}
              endpoint={settings.custom}
              onSettings={setSettings}
            />
          ))}
        </ul>
        <p className="settings-help">
          A key is saved to <code>{settings.configPath}</code>, readable by you only, and never
          shown again or stored in designs. A key set in the environment wins.
        </p>
      </section>
    </div>
  );
}
