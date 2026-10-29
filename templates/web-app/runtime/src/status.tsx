import { useCallback, useEffect, useId, useState } from "react";
import { useApis, useRuntimeConfig } from "./app.tsx";

/** The part of a generated client the status page uses. */
interface CallableApi {
  GET(path: string): Promise<{ data?: unknown; error?: unknown; response: Response }>;
}

interface Result {
  api: string;
  ok: boolean;
  text: string;
}

/**
 * `/_jeeves/status`: the app's runtime config and a form that calls an API through its generated
 * client. `?api=<name>&path=<path>` calls it right away; the result is in `[data-jeeves-result]`.
 */
export function StatusPage(props: { app: string }) {
  const config = useRuntimeConfig();
  const apis = useApis<Record<string, CallableApi>>();
  const names = Object.keys(apis);
  const params = new URLSearchParams(window.location.search);
  const [api, setApi] = useState(params.get("api") ?? names[0] ?? "");
  const [path, setPath] = useState(params.get("path") ?? "/ping");
  const [result, setResult] = useState<Result>();
  const [busy, setBusy] = useState(false);
  const apiId = useId();
  const pathId = useId();

  const call = useCallback(
    async (name: string, target: string) => {
      const client = apis[name];
      if (!client) {
        setResult({ api: name, ok: false, text: `No API "${name}"` });
        return;
      }
      setBusy(true);
      try {
        const { data, error, response } = await client.GET(target);
        const body = { status: response.status, data: data ?? error };
        setResult({ api: name, ok: response.ok, text: JSON.stringify(body, null, 2) });
      } catch (error) {
        const e = error as { name?: string; code?: string; message?: string };
        const body = { error: e.code ?? e.name ?? "ERROR", message: e.message };
        setResult({ api: name, ok: false, text: JSON.stringify(body, null, 2) });
      } finally {
        setBusy(false);
      }
    },
    [apis],
  );

  const auto = params.get("api");
  const autoPath = params.get("path");
  useEffect(() => {
    if (auto) void call(auto, autoPath ?? "/ping");
  }, [auto, autoPath, call]);

  return (
    <main className="jeeves-status">
      <h1>Jeeves status: {props.app}</h1>
      <h2>Runtime config</h2>
      <pre data-jeeves-config="">{JSON.stringify(config, null, 2)}</pre>
      <h2>Call an API</h2>
      {names.length === 0 ? (
        <p>This app has no API clients.</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void call(api, path);
          }}
        >
          <label htmlFor={apiId}>API</label>{" "}
          <select id={apiId} value={api} onChange={(e) => setApi(e.target.value)}>
            {names.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>{" "}
          <label htmlFor={pathId}>GET path</label>{" "}
          <input id={pathId} value={path} onChange={(e) => setPath(e.target.value)} />{" "}
          <button type="submit" disabled={busy}>
            Call
          </button>
        </form>
      )}
      {result && (
        <pre data-jeeves-result={result.api} data-jeeves-ok={String(result.ok)}>
          {result.text}
        </pre>
      )}
    </main>
  );
}
