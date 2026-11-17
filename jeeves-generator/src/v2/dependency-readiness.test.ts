import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { afterEach, expect, test, vi } from "vitest";
import { operationImports, operationUrl } from "./operation.test.helpers.ts";

const source = (name: string) =>
  readFileSync(
    new URL(`../../templates/local-v2/assets/src/runtime/${name}.ts.template`, import.meta.url),
    "utf8",
  );
const data = (code: string) =>
  `data:text/javascript;base64,${Buffer.from(operationImports(stripTypeScriptTypes(code))).toString("base64")}`;
const processUrl = data(source("process"));
const runtime = await import(processUrl);
const operation = await import(operationUrl);
const exitCode = process.exitCode;
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  process.exitCode = exitCode;
});

test("RG14 safe health probes leave expired request contexts, serialize actual work past caller timeout, and cannot reopen readiness after drain", async () => {
  vi.useFakeTimers();
  const marks: boolean[] = [];
  const app = runtime.createProcessLifecycle({
    mark: (ready: boolean) => marks.push(ready),
    terminate() {},
  });
  const request = operation.operation({ maximumMs: 1 });
  const probe = vi.fn();
  let finish!: () => void;
  probe.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  operation.withProcess(app.scope, () =>
    operation.withOperation(request.context, () => runtime.probeDependency(app.scope, {}, probe)),
  );
  app.scope.ready();
  await vi.advanceTimersByTimeAsync(5000);
  expect(probe).toHaveBeenCalledOnce(); // The originating request has already expired.
  expect(marks.at(-1)).toBe(true);
  await vi.advanceTimersByTimeAsync(2000);
  expect(marks.at(-1)).toBe(false);
  await vi.advanceTimersByTimeAsync(15000);
  expect(probe).toHaveBeenCalledOnce(); // Actual SDK work, not its timeout race, owns the slot.
  let closed = false;
  const closing = app.close().then(() => {
    closed = true;
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(closed).toBe(false);
  finish();
  await closing;
  await vi.advanceTimersByTimeAsync(20000);
  expect(probe).toHaveBeenCalledOnce();
  expect(marks.at(-1)).toBe(false);
  request.close();
});

test("RG14 Garage quorum and search health loss require both resources to recover, without object mutations or grant widening", async () => {
  vi.useFakeTimers();
  const provider = { objectStatus: 200, searchStatus: "green", sends: 0, reads: 0 };
  vi.stubGlobal("__rg14Provider", provider);
  const objectsSdk = data(
    `export class S3Client { send() { globalThis.__rg14Provider.sends++; return Promise.resolve({}); } } export class UploadPartCommand {}`,
  );
  const signer = data("export function getSignedUrl() { throw Error('Unexpected presign'); }");
  const searchSdk = data(
    `export class Client { cluster = { health() { globalThis.__rg14Provider.reads++; return Promise.resolve({ body: {status: globalThis.__rg14Provider.searchStatus} }); } }; }`,
  );
  const load = (name: string, replacements: Record<string, string>) =>
    import(
      data(
        source(name)
          .replace('from "./process.ts"', `from "${processUrl}"`)
          .replace(
            'import { readSecret } from "./local.ts";',
            'const readSecret = () => JSON.stringify({accessKeyId:"test",secretAccessKey:"test"});',
          )
          .replace(/from "([^"]+)"/g, (match, path: string) =>
            replacements[path] ? `from "${replacements[path]}"` : match,
          ),
      )
    );
  const objects = await load("objects", {
    "@aws-sdk/client-s3": objectsSdk,
    "@aws-sdk/s3-request-presigner": signer,
  });
  const search = await load("search", { "@opensearch-project/opensearch": searchSdk });
  const fetch = vi.fn(async () => new Response(null, { status: provider.objectStatus }));
  vi.stubGlobal("fetch", fetch);
  const app = runtime.createProcessLifecycle({ mark() {}, terminate() {} });
  operation.withProcess(app.scope, () => {
    objects.createObjects({
      endpoint: "http://local-objects:3900",
      region: "local",
      credentialSecret: "task-only",
      healthEndpoint: "http://local-objects:3903/health",
    });
    search.createSearch({ endpoint: "http://local-search:9200", requestTimeoutMs: 2000 });
  });
  app.scope.ready();
  provider.objectStatus = 503;
  provider.searchStatus = "red";
  await vi.advanceTimersByTimeAsync(5000);
  expect(app.scope.dependenciesReady()).toBe(false);
  provider.objectStatus = 200;
  await vi.advanceTimersByTimeAsync(5000);
  expect(app.scope.dependenciesReady()).toBe(false);
  provider.searchStatus = "yellow";
  await vi.advanceTimersByTimeAsync(5000);
  expect(app.scope.dependenciesReady()).toBe(true);
  expect(provider.sends).toBe(0);
  expect(provider.reads).toBe(3);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls[0]).toMatchObject([
    "http://local-objects:3903/health",
    { redirect: "manual", credentials: "omit", signal: expect.any(AbortSignal) },
  ]);
  await app.close();
  await vi.advanceTimersByTimeAsync(10000);
  expect(fetch).toHaveBeenCalledTimes(3);
});
