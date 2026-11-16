import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inspect } from "node:util";
import { afterAll, describe, expect, it, vi } from "vitest";
import { keysDesign } from "../../../field-projects/generator-system/fixtures/rg-keys/design.ts";
import { loadLocalV2Registry } from "../../templates/local-v2/index.ts";
import { assembleV2 } from "./assemble.ts";

const bundle = assembleV2({ designJson: JSON.stringify(keysDesign()) }, loadLocalV2Registry());
const source = (path: string) => {
  const file = bundle.files.find((f) => f.path === path);
  if (!file) throw new Error(`Missing ${path}`);
  return new TextDecoder().decode(file.bytes);
};
const dataUrl = (js: string) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const keysUrl = dataUrl(stripTypeScriptTypes(source("src/runtime/keys.ts")));
const settingsUrl = dataUrl(
  stripTypeScriptTypes(source("src/runtime/settings.ts")).replaceAll(
    '"./keys.ts"',
    JSON.stringify(keysUrl),
  ),
);
const keys = await import(keysUrl);
const settings = await import(settingsUrl);
const vectors = JSON.parse(
  readFileSync(
    new URL("../../../docs/plans/reliable-generation/evidence/rg08/vectors.json", import.meta.url),
    "utf8",
  ),
);
const binding = { scope: "account-7", context: "items.list.v1" };
const key = Buffer.from(vectors.keyHex, "hex");
const ring = (ids: string[]) =>
  settings.keyRing().parse(
    Buffer.from(
      JSON.stringify(
        ids.map((id) => ({
          id,
          key: (id === "k2" ? Buffer.alloc(32, 99) : key).toString("base64url"),
        })),
      ),
    ),
  );
const signed = (ids = ["k1"], purpose = "cursor.items") =>
  keys.createSigningKeys(ring(ids), purpose);
const sealed = (ids = ["k1"], purpose = "cursor.items") =>
  keys.createSealingKeys(ring(ids), purpose);

describe("RG08 purpose-bound signing and sealing", () => {
  it("matches fixed independent Python HKDF/HMAC/AES-GCM vectors in both directions", async () => {
    expect(signed().sign(vectors.value, binding)).toBe(vectors.signed);
    expect(signed().verify(vectors.signed, binding)).toBe(vectors.value);
    expect(sealed().open(vectors.sealed, binding)).toBe(vectors.value);
    const fixedCrypto = dataUrl(
      'export { createCipheriv, createDecipheriv, createHmac, hkdfSync, timingSafeEqual } from "node:crypto"; export const randomBytes = () => Buffer.from("000102030405060708090a0b", "hex");',
    );
    const fixed = await import(
      dataUrl(
        stripTypeScriptTypes(source("src/runtime/keys.ts")).replaceAll(
          '"node:crypto"',
          JSON.stringify(fixedCrypto),
        ),
      )
    );
    expect(fixed.createSealingKeys(ring(["k1"]), "cursor.items").seal(vectors.value, binding)).toBe(
      vectors.sealed,
    );
  });

  it("writes the current key, reads retained keys and refuses removed/unknown keys", () => {
    for (const [make, write, read, prefix] of [
      [signed, "sign", "verify", "jks1"],
      [sealed, "seal", "open", "jke1"],
    ] as const) {
      const before = make()[write]("rotation", binding);
      const rotated = make(["k2", "k1"]);
      const after = rotated[write]("rotation", binding);
      expect(after.startsWith(`${prefix}.k2.`)).toBe(true);
      expect(rotated[read](before, binding)).toBe("rotation");
      expect(rotated[read](after, binding)).toBe("rotation");
      expect(make(["k2"])[read](before, binding)).toBeUndefined();
      expect(make(["k1"])[read](after, binding)).toBeUndefined();
      expect(rotated[read](before.replace(".k1.", ".absent."), binding)).toBeUndefined();
    }
  });

  it("authenticates purpose, scope, context, envelope version and key ID without framing collisions", () => {
    for (const [make, write, read] of [
      [signed, "sign", "verify"],
      [sealed, "seal", "open"],
    ] as const) {
      const handle = make();
      const value = handle[write]("private value", binding);
      expect(make(["k1"], "cursor.other")[read](value, binding)).toBeUndefined();
      for (const other of [
        { ...binding, scope: "account-8" },
        { ...binding, context: "items.delete.v1" },
        { scope: "account-7items.", context: "list.v1" },
      ])
        expect(handle[read](value, other)).toBeUndefined();
      expect(handle[read](value.replace("1.", "2."), binding)).toBeUndefined();
      // k0 has the same raw bytes as k1; authenticating the ID still refuses substitution.
      expect(make(["k0"])[read](value.replace(".k1.", ".k0."), binding)).toBeUndefined();
    }
    expect(signed().verify(vectors.sealed, binding)).toBeUndefined();
    expect(sealed().open(vectors.signed, binding)).toBeUndefined();
  });

  it("rejects tampered, truncated, noncanonical and oversized inputs without logging contents", () => {
    const log = vi.spyOn(console, "log"),
      error = vi.spyOn(console, "error");
    try {
      for (const [make, write, read] of [
        [signed, "sign", "verify"],
        [sealed, "seal", "open"],
      ] as const) {
        const handle = make();
        const envelope = handle[write]("sensitive", binding);
        const pieces = envelope.split(".");
        const corrupt = [
          "",
          "sensitive",
          envelope.slice(0, -1),
          `${envelope}.x`,
          envelope.replaceAll(".", "/"),
          "x".repeat(24577),
        ];
        for (let n = 2; n < pieces.length; n++) {
          const changed = [...pieces];
          changed[n] = `${changed[n]?.startsWith("A") ? "B" : "A"}${changed[n]?.slice(1)}`;
          corrupt.push(changed.join("."));
          changed[n] = `${pieces[n]}=`;
          corrupt.push(changed.join("."));
          changed[n] = "+/";
          corrupt.push(changed.join("."));
        }
        for (const value of corrupt)
          expect(handle[read](value, binding), value.slice(0, 80)).toBeUndefined();
        for (const value of ["x".repeat(16385), "é".repeat(8193), "\ud800"])
          expect(() => handle[write](value, binding)).toThrow("Invalid protected value input");
        for (const other of [
          { scope: "", context: "x" },
          { scope: "x".repeat(513), context: "x" },
          { scope: "x", context: "\ud800" },
        ]) {
          expect(() => handle[write]("value", other)).toThrow("Invalid protected value input");
          expect(handle[read](envelope, other)).toBeUndefined();
        }
        expect(handle[read](handle[write]("", binding), binding)).toBe("");
        const maximum = "é".repeat(8192);
        expect(handle[read](handle[write](maximum, binding), binding)).toBe(maximum);
      }
      // Alternate unused base64 pad bits decode to the same bytes but must still refuse.
      const signatureAlias = `${vectors.signed.slice(0, -1)}t`;
      const tagAlias = `${vectors.sealed.slice(0, -1)}B`;
      expect(Buffer.from(signatureAlias.split(".").at(-1) ?? "", "base64url")).toEqual(
        Buffer.from(vectors.signed.split(".").at(-1), "base64url"),
      );
      expect(Buffer.from(tagAlias.split(".").at(-1) ?? "", "base64url")).toEqual(
        Buffer.from(vectors.sealed.split(".").at(-1), "base64url"),
      );
      expect(signed().verify(signatureAlias, binding)).toBeUndefined();
      expect(sealed().open(tagAlias, binding)).toBeUndefined();
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });

  it("refuses invalid runtime purpose types and bounded ring material", () => {
    for (const purpose of [
      undefined,
      null,
      7,
      new String("cursor.items"),
      { toString: () => "cursor.items" },
      "",
      "invalid purpose",
      "a".repeat(65),
    ]) {
      expect(() => keys.createSigningKeys(ring(["k1"]), purpose)).toThrow(
        "Invalid protected value input",
      );
      expect(() => keys.createSealingKeys(ring(["k1"]), purpose)).toThrow(
        "Invalid protected value input",
      );
    }
    expect(() =>
      settings
        .keyRing()
        .parse(
          Buffer.from(
            JSON.stringify([{ id: "big", key: Buffer.alloc(4097, 7).toString("base64url") }]),
          ),
        ),
    ).toThrow("Invalid value");
    expect(() => settings.keyRing().parse(Buffer.from(`${" ".repeat(65536)}[]`))).toThrow(
      "Invalid value",
    );
  });

  it("accepts only built-in setting descriptor identities, including derived optional settings", () => {
    const parse = vi.fn((raw) => raw);
    for (const kind of ["signingKeys", "sealingKeys", "keyRing", "secret", "text"]) {
      const forged = { ...settings.signingKeys("cursor.items"), kind, parse };
      expect(() => settings.declareSettings({ VALUE_KEYS: forged })).toThrow(
        "Invalid setting VALUE_KEYS",
      );
      expect(() => settings.optional(forged)).toThrow("Invalid setting descriptor");
      expect(() => settings.declareSettings({ VALUE_KEYS: { ...forged, optional: true } })).toThrow(
        "Invalid setting VALUE_KEYS",
      );
    }
    const valid = settings.optional(settings.optional(settings.signingKeys("cursor.items")));
    expect(() => settings.declareSettings({ VALUE_KEYS: valid })).not.toThrow();
    expect(parse).not.toHaveBeenCalled();
  });

  it("reserves generated purposes from public declarations while allowing private mechanisms", () => {
    const raw = Buffer.from(JSON.stringify([{ id: "k1", key: key.toString("base64url") }]));
    for (const purpose of ["jeeves", "jeeves.replay.value"]) {
      expect(() => settings.signingKeys(purpose).parse(raw)).toThrow("Invalid value");
      expect(() => settings.sealingKeys(purpose).parse(raw)).toThrow("Invalid value");
      const signing = signed(["k1"], purpose),
        sealing = sealed(["k1"], purpose);
      expect(signing.verify(signing.sign("generated", binding), binding)).toBe("generated");
      expect(sealing.open(sealing.seal("generated", binding), binding)).toBe("generated");
    }
  });

  it("keeps immutable method-only handles opaque, copies key material and randomizes sealing", () => {
    const input = ring(["k1"]);
    const a = keys.createSigningKeys(input, "cursor.items"),
      b = keys.createSealingKeys(input, "cursor.items");
    input.current.key.fill(0);
    expect(a.sign(vectors.value, binding)).toBe(vectors.signed);
    for (const [handle, names] of [
      [a, ["sign", "verify"]],
      [b, ["seal", "open"]],
    ] as const) {
      expect(Object.isFrozen(handle)).toBe(true);
      expect(Reflect.ownKeys(handle).sort()).toEqual([...names].sort());
      expect(JSON.stringify(handle)).toBe("{}");
      expect(inspect(handle)).not.toContain(key.toString("base64url"));
      expect(inspect(handle)).not.toContain(key.toString("hex"));
    }
    expect(b.seal("value", binding)).not.toBe(b.seal("value", binding));
    expect(source("src/extension-api/index.ts")).not.toMatch(
      /export .*\b(secret|keyRing|readSettings|readFile|createSigningKeys|createSealingKeys)\b/,
    );
    expect(source("src/extension-api/index.ts")).toContain(
      "export type { SigningKeys, SealingKeys, ValueContext }",
    );
  });
});

const directory = mkdtempSync(join(tmpdir(), "jeeves-rg08-settings-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const state = { opens: 0, clients: 0, parseCalls: 0, ready: false, results: [] as string[] };
(globalThis as { rg08State?: typeof state }).rg08State = state;

/** Execute the actual emitted process entry/configuration/setup with only external resources faked. */
async function processEntry(
  file: string,
  value: string | undefined,
  purpose = "cursor.items",
  forged = false,
) {
  if (value !== undefined) writeFileSync(file, value);
  Object.assign(state, { opens: 0, clients: 0, parseCalls: 0, ready: false, results: [] });
  const fs = dataUrl(`export {readFileSync,readSync} from "node:fs";
    import {openSync as open, closeSync as close, writeFileSync} from "node:fs";
    export const openSync = (...args) => { globalThis.rg08State.opens++; return open(...args); };
    export const closeSync = fd => { close(fd); writeFileSync(${JSON.stringify(file)}, 'changed after configuration read'); };`);
  const privateSettings = dataUrl(
    stripTypeScriptTypes(source("src/runtime/settings.ts"))
      .replaceAll('"./keys.ts"', JSON.stringify(keysUrl))
      .replaceAll('"node:fs"', JSON.stringify(fs)),
  );
  const api = dataUrl(
    `export {declareSettings, signingKeys, sealingKeys} from ${JSON.stringify(privateSettings)};`,
  );
  const imports: Record<string, string> = {
    "../runtime/settings.ts": privateSettings,
    "../modules/items-api/cursor.ts": dataUrl(
      stripTypeScriptTypes(
        readFileSync(
          new URL(
            "../../../field-projects/generator-system/fixtures/rg-keys/cursor.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      )
        .replaceAll('"../../extension-api/index.ts"', JSON.stringify(api))
        .replace(
          'signingKeys("cursor.items")',
          forged
            ? '{...signingKeys("cursor.items"), parse: raw => {globalThis.rg08State.parseCalls++; return raw;}}'
            : 'signingKeys("cursor.items")',
        )
        .replaceAll('"cursor.items"', JSON.stringify(purpose)),
    ),
    "../modules/items-api/receipt.ts": dataUrl(
      stripTypeScriptTypes(
        readFileSync(
          new URL(
            "../../../field-projects/generator-system/fixtures/rg-keys/receipt.ts",
            import.meta.url,
          ),
          "utf8",
        ),
      ).replaceAll('"../../extension-api/index.ts"', JSON.stringify(api)),
    ),
    "../runtime/module-clients.ts": dataUrl(
      `export const cacheClientEndpoint=()=>({}); export const createProbeLog=()=>()=>{}; export const cacheClient=async()=>{globalThis.rg08State.clients++; return {};}; export function checkConfiguration(checks){for(const check of checks)check();}`,
    ),
    "../runtime/local.ts": dataUrl('export const readSecret=()=>"synthetic cache credential";'),
    "../runtime/process.ts": dataUrl(
      "export async function runProcess(start){await start({signal: new AbortController().signal,own(){},admission(){},ready(){globalThis.rg08State.ready=true;}});}",
    ),
    "../runtime/tile-process.ts": dataUrl(
      "export const createFailureLog=()=>()=>{}; export const createNotImplementedLog=()=>()=>{};",
    ),
    "../http-errors.hooks.ts": dataUrl("export const formatHttpError=()=>({});"),
    "../runtime/http.ts": dataUrl(
      "export async function createHttpService(o){const routes=[]; o.configure(routes); return {stop(){},close(){},async start(){await Promise.all(routes); await o.initialize();}};}",
    ),
    "../runtime/tile-http.ts": dataUrl(
      'export function stubRoutes(routes,log,id,handler){routes.push(handler({context:{caller:{subject:"account-7"}}}).then(r=>globalThis.rg08State.results.push(r.body)));}',
    ),
  };
  let js = stripTypeScriptTypes(source("src/processes/items-api.ts"));
  for (const [from, url] of Object.entries(imports))
    js = js.replaceAll(JSON.stringify(from), JSON.stringify(url));
  const saved = process.env.JEEVES_SECRET_VALUE_KEYS_FILE;
  process.env.JEEVES_SECRET_VALUE_KEYS_FILE = file;
  try {
    await import(dataUrl(`${js}\n// ${file} ${purpose}`));
  } finally {
    if (saved === undefined) delete process.env.JEEVES_SECRET_VALUE_KEYS_FILE;
    else process.env.JEEVES_SECRET_VALUE_KEYS_FILE = saved;
  }
}

describe("RG08 emitted preconnection configuration", () => {
  const raw = JSON.stringify([{ id: "k1", key: key.toString("base64url") }]);
  it("reads one ring snapshot across modules and passes those same handles to actual setup", async () => {
    await processEntry(join(directory, "valid"), raw);
    expect(state).toMatchObject({ opens: 1, clients: 1, ready: true });
    expect(state.results[0]).toBe(vectors.signed);
    expect(
      sealed(["k1"], "receipt.items").open(state.results[1], {
        scope: "account-7",
        context: "items.receipt.v1",
      }),
    ).toBe("receipt:3");
  });
  it("refuses a forged public parser during actual startup before reading files or dispatching clients", async () => {
    const log = vi.spyOn(console, "log"),
      error = vi.spyOn(console, "error");
    try {
      await expect(
        processEntry(join(directory, "forged"), raw, "cursor.items", true),
      ).rejects.toThrow(/^Invalid setting VALUE_KEYS$/);
      expect(state).toEqual({ opens: 0, clients: 0, parseCalls: 0, ready: false, results: [] });
      expect(log).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  });
  it("fails malformed/oversized/misdeclared configuration before any client or readiness, naming no contents", async () => {
    for (const [name, value, purpose] of [
      ["missing", undefined, "cursor.items"],
      ["bad", "private-broken-key-bytes", "cursor.items"],
      ["big", "x".repeat(65537), "cursor.items"],
      ["purpose", raw, "invalid purpose"],
      ["protected-purpose", raw, "jeeves.workload"],
    ] as const) {
      await expect(processEntry(join(directory, name), value, purpose)).rejects.toThrow(
        /^Invalid setting VALUE_KEYS$/,
      );
      expect(state).toMatchObject({ clients: 0, ready: false, results: [] });
    }
  });
});
