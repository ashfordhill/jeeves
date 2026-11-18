import { createHash, createHmac } from "node:crypto";
import { EventEmitter } from "node:events";
import { stripTypeScriptTypes } from "node:module";
import { posix } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { frontDoorDesign } from "../../../field-projects/generator-system/fixtures/wd-front-door/design.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";

const registry = loadLocalV2Registry();
const bundle = assembleV2({ designJson: JSON.stringify(frontDoorDesign("required")) }, registry);
const text = (path: string) => {
  const file = bundle.files.find((f) => f.path === path);
  if (!file) throw Error(`Missing ${path}`);
  return new TextDecoder().decode(file.bytes);
};
const urls = new Map<string, string>();
function load(path: string): string {
  const cached = urls.get(path);
  if (cached) return cached;
  const source = stripTypeScriptTypes(text(path)).replace(
    /from "(\.?\.?\/[^"]+)"/g,
    (_match, relative: string) =>
      `from ${JSON.stringify(load(posix.join(posix.dirname(path), relative)))}`,
  );
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  urls.set(path, url);
  return url;
}
const runtime = await import(load("src/runtime/front-door.ts"));
const current = "a".repeat(64),
  previous = "b".repeat(64),
  now = 1795000000000;
const settings = { current, previous };
const stamp = (
  key = current,
  seconds = Math.floor(now / 1000),
  method = "POST",
  path = "/modules/echo",
) =>
  `v1.${seconds}.${createHmac("sha256", key).update(`${seconds}.${method}.${path}`).digest("hex")}`;
afterEach(() => vi.unstubAllEnvs());

describe("WD10 front door", () => {
  it.each([
    [undefined, "EDGE_STAMP_MISSING"],
    ["", "EDGE_STAMP_FORMAT"],
    ["v2.1.aa", "EDGE_STAMP_FORMAT"],
    [`v1.99999999999.${"a".repeat(64)}`, "EDGE_STAMP_FORMAT"],
    [`v1.0001.${"a".repeat(64)}`, "EDGE_STAMP_FORMAT"],
    [`v1.1.${"A".repeat(64)}`, "EDGE_STAMP_FORMAT"],
    ["x".repeat(10000), "EDGE_STAMP_FORMAT"],
    [stamp(current, now / 1000 - 61), "EDGE_STAMP_TIME"],
    [stamp(current, now / 1000 + 61), "EDGE_STAMP_TIME"],
    [stamp("c".repeat(64)), "EDGE_STAMP_MAC"],
    [stamp(current, now / 1000, "GET"), "EDGE_STAMP_MAC"],
    [stamp(current, now / 1000, "POST", "/elsewhere"), "EDGE_STAMP_MAC"],
  ])("refuses bounded malformed/stale/mismatched input %#", (header, reason) => {
    expect(runtime.stampRefusal(settings, header, "POST", "/modules/echo", now)).toBe(reason);
  });
  it("accepts current and previous keys and inclusive clock boundaries", () => {
    for (const key of [current, previous])
      for (const delta of [-60, 0, 60])
        expect(
          runtime.stampRefusal(
            settings,
            stamp(key, now / 1000 + delta),
            "POST",
            "/modules/echo",
            now,
          ),
        ).toBeUndefined();
  });
  it("fails startup safely for absent/invalid current or previous keys", () => {
    vi.stubEnv("JEEVES_EDGE_STAMP_KEY", undefined);
    expect(() => runtime.frontDoorSettings()).toThrow("Invalid setting JEEVES_EDGE_STAMP_KEY");
    for (const value of ["", "short", "x".repeat(513), `${"a".repeat(32)}\n`]) {
      vi.stubEnv("JEEVES_EDGE_STAMP_KEY", value);
      expect(() => runtime.frontDoorSettings()).toThrow("Invalid setting JEEVES_EDGE_STAMP_KEY");
    }
    vi.stubEnv("JEEVES_EDGE_STAMP_KEY", current);
    vi.stubEnv("JEEVES_EDGE_STAMP_KEY_PREVIOUS", "short");
    expect(() => runtime.frontDoorSettings()).toThrow(
      "Invalid setting JEEVES_EDGE_STAMP_KEY_PREVIOUS",
    );
    vi.stubEnv("JEEVES_EDGE_STAMP_KEY_PREVIOUS", previous);
    expect(runtime.frontDoorSettings()).toEqual(settings);
    const entry = text("src/processes/front.ts");
    expect(entry.indexOf("const frontDoor = frontDoorServer(frontDoorSettings()")).toBeLessThan(
      entry.indexOf("const dependencies"),
    );
  });
  it("gates raw HTTP ahead of dispatch/body and logs exactly one safe reason", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const dispatch = vi.fn();
    const server = runtime.frontDoorServer(settings, ["/internal/modules/protected"])(dispatch);
    function emit(url: string, header?: string, duplicate = false, method = "POST") {
      const request = Object.assign(new EventEmitter(), {
        url,
        method,
        headers: { ...(header && { "x-edge-stamp": header }) },
        rawHeaders: header
          ? ["x-edge-stamp", header, ...(duplicate ? ["X-Edge-Stamp", header] : [])]
          : [],
        destroy: vi.fn(),
      });
      const response = Object.assign(new EventEmitter(), { writeHead: vi.fn(), end: vi.fn() });
      server.emit("request", request, response);
      return { request, response };
    }
    try {
      const refused = emit("/unmatched?private=neverlog");
      expect(dispatch).not.toHaveBeenCalled();
      expect(refused.request.eventNames()).toEqual([]);
      expect(refused.response.writeHead.mock.calls[0]?.[0] ?? "").toBe(403);
      expect(JSON.parse(String(refused.response.end.mock.calls[0]?.[0] ?? ""))).toEqual({
        error: "FORBIDDEN",
        message: "Request refused.",
      });
      expect(log.mock.calls).toEqual([[JSON.stringify({ reason: "EDGE_STAMP_MISSING" })]]);
      for (const url of ["/livez", "/readyz?q=1", "/healthz", "/internal/modules/protected"])
        emit(url);
      expect(dispatch).toHaveBeenCalledTimes(4);
      emit("/internal/modules/protected", undefined, false, "GET");
      emit("/internal/modules/protected", undefined, false, "HEAD");
      expect(dispatch).toHaveBeenCalledTimes(6);
      for (const url of [
        "/internal/modules/protected/subpath",
        "/internal/evil",
        "/internal/modules/protected-other",
        "/internal/modules/protected%2fsubpath",
        "/healthz/extra",
      ])
        emit(url);
      expect(dispatch).toHaveBeenCalledTimes(6);
      for (const method of ["PUT", "DELETE", "PATCH", "OPTIONS"])
        emit("/internal/modules/protected", undefined, false, method);
      expect(dispatch).toHaveBeenCalledTimes(6);
      const seconds = Math.floor(Date.now() / 1000);
      const accepted = emit("/modules/echo?query=ignored", stamp(current, seconds));
      expect(dispatch).toHaveBeenCalledTimes(7);
      expect(accepted.request.headers).not.toHaveProperty("x-edge-stamp");
      expect(accepted.request.rawHeaders).toEqual([]);
      emit("/modules/echo", stamp(current, seconds), true);
      expect(dispatch).toHaveBeenCalledTimes(7);
      expect(log.mock.calls.at(-1)).toEqual([JSON.stringify({ reason: "EDGE_STAMP_FORMAT" })]);
    } finally {
      log.mockRestore();
    }
  });
  it("emits required-only configuration, private setup and local edge wiring", () => {
    const contract = JSON.parse(text("deploy/contract.json"));
    expect(contract.processes[0].frontDoor).toEqual({
      header: "x-edge-stamp",
      keyEnv: "JEEVES_EDGE_STAMP_KEY",
      previousKeyEnv: "JEEVES_EDGE_STAMP_KEY_PREVIOUS",
      maxAgeSeconds: 60,
    });
    expect(contract.processes[0].env).toContain("JEEVES_EDGE_STAMP_KEY_PREVIOUS");
    expect(text("infra/edge/nginx.conf")).toContain("set $backend app-edge-stamp:3000");
    expect(text("compose.yaml")).toContain(".runtime/secrets/edge-stamp.env");
    expect(text("scripts/setup.mjs")).toContain('mode: 0o600, flag: "wx"');
    const legacy = assembleV2({ designJson: JSON.stringify(frontDoorDesign()) }, registry);
    const none = assembleV2({ designJson: JSON.stringify(frontDoorDesign("none")) }, registry);
    for (const path of [
      "src/processes/front.ts",
      "src/runtime/http.ts",
      "compose.yaml",
      "infra/edge/nginx.conf",
      "scripts/setup.mjs",
      "deploy/contract.json",
    ]) {
      const get = (files: typeof legacy.files) => files.find((f) => f.path === path)?.bytes;
      expect(get(legacy.files)).toEqual(get(none.files));
    }
    expect(legacy.files.find((f) => f.path === "src/runtime/front-door.ts")).toBeUndefined();
    // Independently captured from the accepted parent before WD10 source edits.
    expect(
      createHash("sha256")
        .update(
          legacy.files.find((f) => f.path === "src/runtime/http.ts")?.bytes ?? new Uint8Array(),
        )
        .digest("hex"),
    ).toBe("59f11ece27c6a698449e395b11d92a820a9e207f2f63469c9909680ce5fe0a46");
  });
});
