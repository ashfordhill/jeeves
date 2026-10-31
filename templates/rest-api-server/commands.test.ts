import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resourceServer, sessionPrincipal } from "@jeeves/rest-server";
import { createService, defineFeature } from "@jeeves/service-runtime";
import { resourceConfigSchema } from "@jeeves/spec";
import { describe, expect, it, vi } from "vitest";
import { stringify } from "yaml";
import { modelMigration, resourceContract, resourceDescriptor } from "./resources.ts";
import { sessionCookieName } from "./runtime/src/sessions.ts";

const model = () =>
  resourceConfigSchema.parse({
    resources: [
      {
        id: "document",
        name: "document",
        access: "owner",
        fields: [
          {
            id: "copies",
            name: "copies",
            type: "integer",
            required: true,
            minimum: 1,
            maximum: 100,
          },
          {
            id: "style",
            name: "style",
            type: "enum",
            required: false,
            values: ["plain", "rounded"],
          },
        ],
        belongsTo: [],
        operations: ["create", "read", "update", "list"],
      },
    ],
    acceptanceCases: ["SAVE-1"],
    extensions: [
      {
        id: "publish",
        operationId: "publishDocument",
        method: "POST",
        path: "/document/{id}/publish",
        access: "owner",
        acceptance: ["SAVE-1"],
        notes: "Publish the owner's document",
        contract: {
          parameters: [
            { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  additionalProperties: false,
                  required: ["copies"],
                  properties: { copies: { type: "integer", minimum: 1, maximum: 100 } },
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Published",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: false,
                    required: ["copies"],
                    properties: { copies: { type: "integer" } },
                  },
                },
              },
            },
            "404": { description: "Not found" },
          },
        },
      },
    ],
  });

describe("owner commands and bounded storage", () => {
  it("emits bounded SQL and rejects constraint changes without reviewed migration", () => {
    const original = model();
    const sql = modelMigration(original);
    expect(sql).toMatch(/integer NOT NULL CHECK \("f_[a-f0-9]+" >= 1 AND "f_[a-f0-9]+" <= 100\)/);
    expect(sql).toMatch(/text CHECK \("f_[a-f0-9]+" IN \('plain', 'rounded'\)\)/);
    for (const field of [
      { ...original.resources[0]!.fields[0]!, maximum: 200 },
      { ...original.resources[0]!.fields[1]!, values: ["plain"] },
    ]) {
      const next = structuredClone(original);
      next.resources[0]!.fields = next.resources[0]!.fields.map((f) =>
        f.id === field.id ? field : f,
      );
      expect(() => modelMigration(next, original)).toThrow(/reviewed migration/i);
    }
    const renamed = structuredClone(original);
    renamed.resources[0]!.name = "artwork";
    renamed.resources[0]!.fields[0]!.name = "quantity";
    expect(modelMigration(renamed, original).trim()).toBe("");
    expect(resourceDescriptor(renamed.resources[0]!, renamed).fields[0]!.column).toBe(
      resourceDescriptor(original.resources[0]!, original).fields[0]!.column,
    );
  });

  it("authenticates and validates before dispatch, preserves owner checks and blocks standard-operation overrides", async () => {
    const config = model();
    const directory = mkdtempSync(join(tmpdir(), "jeeves-command-"));
    const contract = join(directory, "api.yaml");
    writeFileSync(contract, stringify(resourceContract(config, "Documents")));
    const alice = "10000000-0000-4000-8000-000000000001",
      bob = "10000000-0000-4000-8000-000000000002";
    const id = "20000000-0000-4000-8000-000000000001";
    const origin = "http://127.0.0.1:9999";
    const query = vi.fn(async (_sql: string, values?: unknown[]) => ({
      rows:
        values?.[0] === createHash("sha256").update("a".repeat(64)).digest("hex")
          ? [{ user_id: alice, csrf_token: "csrf" }]
          : values?.[0] === createHash("sha256").update("b".repeat(64)).digest("hex")
            ? [{ user_id: bob, csrf_token: "csrf" }]
            : [],
    }));
    let published = 0;
    const feature = defineFeature({
      name: "publish",
      operations: {
        publishDocument: async (request) => {
          if (sessionPrincipal(request.request)?.id !== alice || request.params.id !== id)
            return { status: 404, body: { error: "NOT_FOUND", message: "No owned document" } };
          published++;
          return { status: 201, body: request.body };
        },
      },
    });
    const plugin = () =>
      resourceServer({
        database: () => ({ query }),
        contract,
        resources: config.resources.map((r) => resourceDescriptor(r, config)),
        extensions: config.extensions,
      });
    const service = await createService(
      { name: "documents", plugins: [plugin()] },
      { env: { PUBLIC_ORIGIN: origin }, features: [feature], logger: false },
    );
    const headers = {
      origin,
      cookie: sessionCookieName(origin) + "=" + "a".repeat(64),
      "x-csrf-token": "csrf",
    };
    const call = (extra: Record<string, string> = headers, payload: unknown = { copies: 5 }) =>
      service.app.inject({
        method: "POST",
        url: `/document/${id}/publish`,
        headers: extra,
        ...(payload !== undefined && {
          payload: JSON.stringify(payload),
          headers: { ...extra, "content-type": "application/json" },
        }),
      });
    try {
      expect((await call({})).statusCode).toBe(401);
      for (const extra of [
        { ...headers, "x-csrf-token": "" },
        { ...headers, "x-csrf-token": "wrong" },
        { ...headers, origin: "http://evil.test" },
        { ...headers, origin: "" },
      ])
        expect((await call(extra)).statusCode).toBe(403);
      for (const payload of [
        {},
        { copies: 0 },
        { copies: 1.5 },
        { copies: "5" },
        { copies: 5, ownerId: bob },
      ])
        expect((await call(headers, payload)).statusCode).toBe(400);
      expect(
        (await service.app.inject({ method: "POST", url: `/document/${id}/publish`, headers }))
          .statusCode,
      ).toBe(400);
      expect(
        (await call({ ...headers, cookie: sessionCookieName(origin) + "=" + "b".repeat(64) }))
          .statusCode,
      ).toBe(404);
      expect(published).toBe(0);
      const result = await call();
      expect(result.statusCode).toBe(201);
      expect(result.json()).toEqual({ copies: 5 });
      expect(published).toBe(1);
      expect(result.headers["cache-control"]).toBe("no-store");
      await expect(
        createService(
          { name: "override", plugins: [plugin()] },
          {
            env: { PUBLIC_ORIGIN: origin },
            logger: false,
            features: [
              defineFeature({
                name: "bad",
                operations: { createDocument: async () => ({ status: 201, body: {} }) },
              }),
            ],
          },
        ),
      ).rejects.toThrow(/overrides generated operation/);
    } finally {
      await service.stop();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
