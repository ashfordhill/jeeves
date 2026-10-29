import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { FastifyBaseLogger, FastifyInstance, FastifyRequest } from "fastify";
import type { z } from "zod";
import type { ServiceConfig } from "./config.ts";

/** What an operation handler gets: the request, already validated against the contract. */
export interface OperationRequest {
  operationId: string;
  params: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
  body: unknown;
  /** The underlying Fastify request, for anything the fields above don't cover. */
  request: FastifyRequest;
  log: FastifyBaseLogger;
}

/** What an operation handler returns. `status` must be one the contract documents. */
export interface OperationResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export type OperationHandler = (
  request: OperationRequest,
) => OperationResponse | Promise<OperationResponse>;

export interface FeatureContext<Shape extends z.ZodRawShape = z.ZodRawShape> {
  service: string;
  config: ServiceConfig;
  /** This feature's own variables, parsed with its `env` schema. */
  env: z.output<z.ZodObject<Shape>>;
  log: FastifyBaseLogger;
}

/**
 * A unit of project behavior, in `src/features/<name>/index.ts` as the default export. Features
 * add behavior; they never patch the runtime.
 */
export interface Feature<Shape extends z.ZodRawShape = z.ZodRawShape> {
  name: string;
  /**
   * Environment variables this feature needs, as a Zod shape. They're validated with the
   * service's own before anything starts, and every problem is reported at once.
   */
  env?: Shape;
  /**
   * Handlers for contract operations, keyed by `operationId`. Served by a contract plugin such as
   * `@jeeves/rest-server` (the element's rest-api-server attachment).
   */
  operations?: Record<string, OperationHandler>;
  /** Adds routes, hooks, or decorators to the service's Fastify instance. */
  register?(app: FastifyInstance, ctx: FeatureContext<Shape>): void | Promise<void>;
  /** A startup task: runs after dependencies and routes are ready, before the port opens. */
  start?(ctx: FeatureContext<Shape>): void | Promise<void>;
  /** Runs during graceful shutdown, after the server stops taking requests. */
  stop?(): void | Promise<void>;
}

const FEATURE = Symbol.for("jeeves.feature");

export function defineFeature<Shape extends z.ZodRawShape = Record<never, never>>(
  feature: Feature<Shape>,
): Feature<Shape> {
  if (!/^[a-z][a-z0-9-]*$/.test(feature.name)) {
    throw new Error(`Feature name "${feature.name}" must be kebab-case`);
  }
  return Object.assign(feature, { [FEATURE]: true });
}

export function isFeature(value: unknown): value is Feature {
  return typeof value === "object" && value !== null && FEATURE in value;
}

/**
 * Imports every feature folder in `dir` (`<dir>/<name>/index.ts`, or `index.js`), sorted by name.
 * Folders starting with `_` or `.` are skipped, so features can share helpers in `_shared/`.
 */
export async function loadFeatures(dir: URL | string): Promise<Feature[]> {
  const path = dir instanceof URL ? fileURLToPath(dir) : dir;
  if (!existsSync(path)) return [];
  const folders = readdirSync(path, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !/^[_.]/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const features: Feature[] = [];
  for (const folder of folders) {
    const index = ["index.ts", "index.js"].map((f) => join(path, folder, f)).find(existsSync);
    if (!index) throw new Error(`Feature folder src/features/${folder} has no index.ts`);
    const module = (await import(pathToFileURL(index).href)) as { default?: unknown };
    if (!isFeature(module.default)) {
      throw new Error(`src/features/${folder}/index.ts must default-export defineFeature({ ... })`);
    }
    features.push(module.default);
  }
  return features;
}
