import { afterEach, expect, it, vi } from "vitest";
import fixture from "../conformance/fixtures/definition.json";
import { createWorkspaceClient, WorkspaceError } from "./client.ts";

const alice = { id: "a0000000-0000-4000-8000-000000000000", csrfToken: "a".repeat(64) };
const bob = { id: "b0000000-0000-4000-8000-000000000000", csrfToken: "b".repeat(64) };
const json = (value: unknown, status = 200) => Response.json(value, { status });
const clientFor = (fetch: typeof globalThis.fetch, extra = {}) =>
  createWorkspaceClient({ definition: fixture, baseUrl: "/_api/inventory", fetch, ...extra });
afterEach(() => vi.restoreAllMocks());

it("keeps cookies and CSRF same-origin, drains logout, and never retries a failed mutation", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => json(alice));
  const client = clientFor(fetch);
  expect(() => {
    client.definition.collections[0]!.name = "changed";
  }).toThrow();
  await client.restore();
  fetch.mockResolvedValueOnce(json({ error: "SECRET DATABASE DETAIL" }, 500));
  await expect(client.create("warehouse", { name: "North", website: null })).rejects.toMatchObject({
    status: 500,
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fetch.mock.calls[1]?.[1]).toMatchObject({
    method: "POST",
    credentials: "same-origin",
    redirect: "error",
    headers: { "X-CSRF-Token": alice.csrfToken },
  });
  // A mocked 204 body reader makes the completion responsibility observable.
  const response = new Response(null, { status: 204 });
  const drained = vi.spyOn(response, "arrayBuffer");
  fetch.mockResolvedValueOnce(response);
  await client.logout();
  expect(drained).toHaveBeenCalledOnce();
  expect(client.identity()).toBeUndefined();
  expect(localStorage.length).toBe(0);
  await expect(client.list("warehouse")).rejects.toMatchObject({ status: 401 });
  expect(fetch).toHaveBeenCalledTimes(3);
  const unsafe = clientFor(fetch, { baseUrl: "https://outside.example" });
  await expect(unsafe.restore()).rejects.toMatchObject({ kind: "CONFIGURATION" });
  expect(fetch).toHaveBeenCalledTimes(3);
});

it("distinguishes anonymous sessions, server/protocol failures and session expiry", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>();
  const client = clientFor(fetch);
  fetch.mockResolvedValueOnce(json({}, 401));
  expect(await client.restore()).toBeUndefined();
  fetch.mockResolvedValueOnce(json({}, 500));
  await expect(client.restore()).rejects.toMatchObject({ status: 500 });
  fetch.mockResolvedValueOnce(json({ csrfToken: "invalid" }));
  await expect(client.restore()).rejects.toMatchObject({ kind: "PROTOCOL" });
  fetch.mockResolvedValueOnce(json(alice));
  await client.restore();
  fetch.mockResolvedValueOnce(json({}, 401));
  await expect(client.list("warehouse")).rejects.toMatchObject({ status: 401 });
  expect(client.identity()).toBeUndefined();
  expect(new WorkspaceError("HTTP", 500).message).not.toContain("SECRET");
});

it("discards an old account's response after a new login", async () => {
  let resolve: (response: Response) => void = () => {};
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json(alice));
  const client = clientFor(fetch);
  await client.restore();
  fetch.mockImplementationOnce(
    () =>
      new Promise<Response>((done) => {
        resolve = done;
      }),
  );
  const old = client.list("warehouse");
  const failed = expect(old).rejects.toMatchObject({ kind: "SESSION_CHANGED" });
  fetch.mockResolvedValueOnce(json(bob));
  await client.authenticate("login", {
    email: "bob@example.test",
    password: "long-enough-password",
  });
  resolve(json({ items: [], nextCursor: null }));
  await failed;
  expect(client.identity()?.id).toBe(bob.id);
});

it("has a finite timeout and handles explicit cancellation separately", async () => {
  const fetch = vi.fn<typeof globalThis.fetch>(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        if (init?.signal?.aborted) reject(new Error("aborted"));
        else
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
      }),
  );
  const client = clientFor(fetch, { timeoutMs: 100 });
  await expect(client.restore()).rejects.toMatchObject({ kind: "TIMEOUT" });
  const cancellation = new AbortController();
  cancellation.abort();
  await expect(client.restore(cancellation.signal)).rejects.toMatchObject({ kind: "CANCELLED" });
});
