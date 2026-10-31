/** Server-owned, hash-verified product recipes. Requests can select a recipe, never supply source. */
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import {
  type Architecture,
  capabilityEndpoint,
  type DesignDocument,
  designSchema,
  type Finding,
  finding,
  type LayoutDocument,
  resolveConfig,
  type TemplateLookup,
  type TemplateRef,
  upgradeDesign,
} from "@jeeves/spec";
import type { OutputFile } from "@jeeves/template-kit";
import { z } from "zod";
import {
  acceptancePath,
  acceptanceSupportPath,
  type FixedAcceptance,
  fixedAcceptanceSchema,
} from "./acceptance.ts";
import type { Lock } from "./lock.ts";
import type { ProjectPlan } from "./plan.ts";

const safePath = z
  .string()
  .min(1)
  .refine(
    (value) =>
      !isAbsolute(value) &&
      !value.includes("\\") &&
      value
        .split("/")
        .every((part) => part !== "" && part !== "." && part !== ".." && part !== ".git"),
    "Expected a safe relative recipe path",
  );
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const sourceSchema = z.object({ source: safePath, sha256: hash });
const fileSchema = sourceSchema.extend({
  path: safePath,
  ownership: z.enum(["generated", "scaffold"]),
});
const artifactSchema = sourceSchema.extend({ path: safePath });
const manifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string(),
  version: z.string(),
  title: z.string(),
  description: z.string(),
  maturity: z.literal("experimental"),
  features: z.array(z.string()),
  provenance: z.object({ consumerCommit: z.string(), jeevesCommit: z.string(), note: z.string() }),
  design: sourceSchema,
  files: z.array(fileSchema),
  artifacts: z.array(artifactSchema),
  provided: z.object({
    operations: z.record(z.string(), z.array(z.string())),
    frontends: z.array(z.string()),
  }),
  requiredPackages: z.record(safePath, z.record(z.string(), z.string())),
  runtimes: z.array(z.object({ name: z.string(), version: z.string(), tarball: safePath })),
  acceptance: z.array(
    z.object({
      id: z.string(),
      service: z.string(),
      operationIds: z.array(z.string()),
      acceptanceIds: z.array(z.string()),
      requires: z.enum(["extensions", "frontend"]),
      runner: z.enum(["node", "playwright"]).optional(),
      dependencies: z.array(z.object({ name: z.string(), version: z.string() })).optional(),
      source: safePath,
      sha256: hash,
      files: z.array(sourceSchema.extend({ path: safePath })),
    }),
  ),
});
export const qrStudioConfigurationSchema = z.strictObject({
  tagline: z.string().trim().min(1).max(120).default("One link. Room to change."),
  analyticsDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
});
export type RecipeRegistration = { id: string; version: string; manifestSha256: string };
export type RecipeArtifact = { path: string; contents: Buffer };
const catalog = [
  {
    id: "qr-studio",
    version: "0.1.0",
    manifest: new URL("../../../recipes/qr-studio/0.1.0/manifest.json", import.meta.url),
  },
];
const sha = (data: string | Buffer) => createHash("sha256").update(data).digest("hex");
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_key, item) =>
    item && typeof item === "object" && !Array.isArray(item)
      ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b)))
      : item,
  );
export class RecipeError extends Error {}

export function loadRecipe(ref: TemplateRef) {
  const registered = catalog.find((item) => item.id === ref.id && item.version === ref.version);
  if (!registered)
    throw new RecipeError(`Unknown recipe ${ref.id}@${ref.version}. Choose a catalog recipe.`);
  const bytes = readFileSync(registered.manifest),
    manifest = manifestSchema.parse(JSON.parse(bytes.toString())),
    root = dirname(fileURLToPath(registered.manifest));
  if (manifest.id !== ref.id || manifest.version !== ref.version)
    throw new RecipeError("Recipe identity differs from its catalog registration");
  const read = (entry: z.infer<typeof sourceSchema>) => {
    const path = resolve(root, entry.source),
      actual = realpathSync(path),
      inside = relative(root, actual);
    if (inside.startsWith("..") || isAbsolute(inside))
      throw new RecipeError("Recipe source escapes its registered directory");
    const data = readFileSync(actual);
    if (sha(data) !== entry.sha256)
      throw new RecipeError(
        `Recipe source hash mismatch: ${entry.source}. Restore this released snapshot; use a new version for changes.`,
      );
    return data;
  };
  const design = upgradeDesign(designSchema.parse(JSON.parse(read(manifest.design).toString())));
  const files: OutputFile[] = manifest.files.map((file) => ({
    path: file.path,
    ownership: file.ownership,
    contents: read(file).toString(),
  }));
  const artifacts: RecipeArtifact[] = manifest.artifacts.map((file) => ({
    path: file.path,
    contents: read(file),
  }));
  const acceptance: FixedAcceptance[] = manifest.acceptance.map((suite) => {
    const { source: _source, sha256: _hash, files, ...metadata } = suite;
    return fixedAcceptanceSchema.parse({
      ...metadata,
      source: read(suite).toString(),
      files: files.map((file) => ({ path: file.path, contents: read(file).toString() })),
    });
  });
  const paths = [...files.map((file) => file.path), ...artifacts.map((file) => file.path)];
  if (new Set(paths).size !== paths.length)
    throw new RecipeError("Recipe has duplicate output paths");
  return {
    manifest,
    design,
    files,
    artifacts,
    acceptance,
    registration: {
      id: ref.id,
      version: ref.version,
      manifestSha256: sha(bytes),
    } satisfies RecipeRegistration,
  };
}
export type ProductRecipe = ReturnType<typeof loadRecipe>;

export function recipeCatalog() {
  return catalog.map((ref) => {
    const recipe = loadRecipe(ref),
      { id, version, title, description, maturity, features } = recipe.manifest;
    return {
      id,
      version,
      title,
      description,
      maturity,
      features,
      configuration: z.toJSONSchema(qrStudioConfigurationSchema, { io: "input" }),
      provided: recipe.manifest.provided,
    };
  });
}

/** Declarative core bindings are fixed; project notes, presentation and independent additions remain editable. */
export function recipeForDesign(
  design: DesignDocument,
  lookup: TemplateLookup,
): ProductRecipe | undefined {
  if (!design.recipe) return undefined;
  const recipe = loadRecipe(design.recipe);
  qrStudioConfigurationSchema.parse(design.recipe.config);
  for (const required of recipe.design.elements) {
    const element = design.elements.find((item) => item.id === required.id);
    if (!element || canonical(element.template) !== canonical(required.template))
      throw new RecipeError(
        `Recipe requires ${required.id} with template ${required.template?.id}@${required.template?.version}. Keep that binding or create a separate custom design.`,
      );
    const elementTemplate = required.template && lookup.get(required.template);
    if (!elementTemplate) throw new RecipeError(`Missing recipe template for ${required.id}`);
    const expectedRoot = { ...resolveConfig(elementTemplate.config, required.config) };
    const actualRoot = { ...resolveConfig(elementTemplate.config, element.config) };
    if (required.id === "qrwty-web") {
      delete expectedRoot.title;
      delete actualRoot.title;
      delete expectedRoot.hostPort;
      delete actualRoot.hostPort;
    }
    if (canonical(expectedRoot) !== canonical(actualRoot))
      throw new RecipeError(
        `Recipe element ${required.id} configuration is outside the supported envelope. Keep its pinned settings; branding and the frontend host port are configurable.`,
      );
    for (const expected of required.attachments) {
      const actual = element.attachments.find((item) => item.id === expected.id),
        template = lookup.get(expected.template);
      if (!actual || !template || canonical(actual.template) !== canonical(expected.template))
        throw new RecipeError(
          `Recipe requires ${required.id}/${expected.id} with its pinned template.`,
        );
      const expectedConfig = structuredClone(resolveConfig(template.config, expected.config)),
        actualConfig = structuredClone(resolveConfig(template.config, actual.config));
      if (expected.template.id === "rest-api-server") {
        const requiredModel = expectedConfig.model as {
          resources: { id: string }[];
          extensions: { id: string; notes?: string }[];
          acceptanceCases: string[];
        };
        const actualModel = actualConfig.model as typeof requiredModel | undefined;
        if (!actualModel)
          throw new RecipeError(`Recipe requires the ${expected.id} resource model`);
        for (const resource of requiredModel.resources)
          if (
            canonical(resource) !==
            canonical(actualModel.resources.find((item) => item.id === resource.id))
          )
            throw new RecipeError(
              `Recipe resource ${resource.id} differs from its versioned contract. Add a separate resource for custom data.`,
            );
        for (const extension of requiredModel.extensions) {
          const { notes: _expected, ...wanted } = extension;
          const { notes: _actual, ...found } =
            actualModel.extensions.find((item) => item.id === extension.id) ?? {};
          if (canonical(wanted) !== canonical(found))
            throw new RecipeError(
              `Recipe operation ${extension.id} differs from its versioned contract. Add a separate operation for custom behavior.`,
            );
        }
        if (requiredModel.acceptanceCases.some((id) => !actualModel.acceptanceCases.includes(id)))
          throw new RecipeError("Recipe acceptance references cannot be removed");
        // The non-resource model fields (notably storage binding) must remain identical.
        const reduce = (model: typeof requiredModel) => {
          const { resources: _r, extensions: _e, acceptanceCases: _a, ...rest } = model;
          return rest;
        };
        expectedConfig.model = reduce(requiredModel);
        actualConfig.model = reduce(actualModel);
      }
      if (canonical(expectedConfig) !== canonical(actualConfig))
        throw new RecipeError(
          `Recipe capability ${expected.id} configuration is incompatible with its pinned implementation.`,
        );
    }
  }
  for (const required of recipe.design.connections) {
    const actual = design.connections.find((item) => item.id === required.id);
    if (
      !actual ||
      actual.kind !== required.kind ||
      canonical(capabilityEndpoint(actual, "from")) !==
        canonical(capabilityEndpoint(required, "from")) ||
      canonical(capabilityEndpoint(actual, "to")) !== canonical(capabilityEndpoint(required, "to"))
    )
      throw new RecipeError(
        `Recipe requires connection ${required.id} and its original capability bindings.`,
      );
  }
  const web = design.elements.find((element) => element.id === "qrwty-web");
  if (
    !Number.isInteger(web?.config.hostPort) ||
    Number(web?.config.hostPort) < 1024 ||
    Number(web?.config.hostPort) > 65535
  )
    throw new RecipeError(
      "QR Studio requires a fixed local web port from 1024 to 65535 so printed URLs remain stable.",
    );
  return recipe;
}

export function recipeFindings(design: DesignDocument, lookup: TemplateLookup): Finding[] {
  try {
    recipeForDesign(design, lookup);
    return [];
  } catch (error) {
    return [finding("RECIPE_INCOMPATIBLE", error instanceof Error ? error.message : String(error))];
  }
}

export function createRecipeDesign(
  ref: TemplateRef,
  options: { title: string; hostPort: number; config?: Record<string, unknown> },
): { design: DesignDocument; layout: LayoutDocument } {
  const recipe = loadRecipe(ref),
    design = structuredClone(recipe.design);
  design.architecture = qrStudioArchitecture(options.title);
  design.recipe = { ...ref, config: qrStudioConfigurationSchema.parse(options.config ?? {}) };
  const web = design.elements.find((item) => item.id === "qrwty-web");
  if (!web) throw new RecipeError("Recipe has no frontend");
  web.config = { ...web.config, title: options.title, hostPort: options.hostPort };
  return {
    design,
    layout: {
      schemaVersion: 1,
      items: {
        "qrwty-web": { x: 80, y: 150, width: 270, height: 190 },
        qrwty: { x: 470, y: 150, width: 300, height: 220 },
        "qrwty-db": { x: 900, y: 150, width: 270, height: 190 },
      },
      viewport: { x: 40, y: 80, zoom: 0.85 },
    },
  };
}

/** Overlay only scaffold slots; a recipe cannot replace another template's generated output. */
export function applyRecipe(
  plan: ProjectPlan,
  design: DesignDocument,
  recipe: ProductRecipe,
): ProjectPlan {
  const files = new Map(plan.files.map((file) => [file.path, file]));
  for (const file of recipe.files) {
    if (files.get(file.path)?.ownership === "generated")
      throw new RecipeError(`Recipe conflicts with generated template output: ${file.path}`);
    files.set(file.path, file);
  }
  const config = qrStudioConfigurationSchema.parse(design.recipe?.config ?? {});
  files.set("frontends/qrwty-web/src/product.generated.ts", {
    path: "frontends/qrwty-web/src/product.generated.ts",
    ownership: "generated",
    contents: `// Generated by the pinned QR Studio recipe. Configure through the design.\nexport const productConfiguration = ${JSON.stringify(config)} as const;\n`,
  });
  const guide = files.get("AGENTS.md");
  if (guide)
    files.set(guide.path, {
      ...guide,
      contents:
        guide.contents +
        `\n## Product recipe ${recipe.manifest.id}@${recipe.manifest.version}\n\nThe recipe provides the core QR library, Studio, analytics and declared operations. Its implementation and artifacts are generated-owned; every protected path is hashed in jeeves/lock.json. Never reimplement or edit those files. Add independent server features/resources/operations through the design and project-owned files. Use frontends/qrwty-web/src/ProjectExtras.tsx for additional UI. Required package pins belong to the recipe; additional dependencies are project-owned. Notes do not override provided operation behavior.\n`,
    });
  for (const required of recipe.manifest.runtimes)
    if (
      !plan.runtimes.some(
        (runtime) => runtime.name === required.name && runtime.version === required.version,
      )
    )
      throw new RecipeError(
        `Recipe requires ${required.name}@${required.version}; choose a compatible recipe version.`,
      );
  return {
    ...plan,
    recipe: recipe.registration,
    artifacts: recipe.artifacts,
    files: [...files.values()].sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export function assertRecipeDependencies(dir: string, recipe: ProductRecipe) {
  for (const [path, dependencies] of Object.entries(recipe.manifest.requiredPackages)) {
    if (!existsSync(join(dir, path)))
      throw new RecipeError(
        `Recipe dependency file ${path} is missing. Restore it before regeneration or verification.`,
      );
    const pkg = JSON.parse(readFileSync(join(dir, path), "utf8"));
    for (const [name, pin] of Object.entries(dependencies))
      if (pkg.dependencies?.[name] !== pin)
        throw new RecipeError(
          `Recipe dependency ${path}: ${name} must remain ${pin}. Use a reviewed recipe upgrade to change it.`,
        );
  }
}

/** Fresh local outputs get private ignored credentials; existing origins/secrets are never replaced. */
export function recipeEnvironment(dir: string, design: DesignDocument, create = false): boolean {
  if (!design.recipe) return false;
  const port = Number(
    design.elements.find((element) => element.id === "qrwty-web")?.config.hostPort,
  );
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new RecipeError("Recipe requires a stable loopback web port.");
  if (process.env.DB_QRWTY_PASSWORD !== undefined)
    throw new RecipeError(
      "Remove ambient DB_QRWTY_PASSWORD before recipe generation; the private project .env owns local credentials.",
    );
  const origin = `http://127.0.0.1:${port}`,
    path = join(dir, ".env");
  if (process.env.QRWTY_PUBLIC_ORIGIN !== undefined && process.env.QRWTY_PUBLIC_ORIGIN !== origin)
    throw new RecipeError(
      "Ambient QRWTY_PUBLIC_ORIGIN conflicts with the recipe web port. Remove the override before local generation.",
    );
  if (existsSync(path)) {
    const values = parseEnv(readFileSync(path, "utf8"));
    if (values.QRWTY_PUBLIC_ORIGIN !== origin)
      throw new RecipeError(
        "Existing QRWTY_PUBLIC_ORIGIN differs from the recipe web port. Changing printed-link origin requires a reviewed migration; existing environment is unchanged.",
      );
    if (!values.DB_QRWTY_PASSWORD)
      throw new RecipeError(
        "Existing recipe .env needs DB_QRWTY_PASSWORD. No environment values were replaced.",
      );
    return false;
  }
  if (!create) return false;
  writeFileSync(
    path,
    `# Local recipe environment. Private, ignored by Git; keep the public origin stable.\nQRWTY_PUBLIC_ORIGIN=${origin}\nDB_QRWTY_PASSWORD=${randomBytes(24).toString("hex")}\n`,
    { mode: 0o600, flag: "wx" },
  );
  return true;
}

export function recipeCoverage(
  design: DesignDocument,
  lock: Pick<Lock, "elements"> & Partial<Omit<Lock, "elements">>,
  lookup: TemplateLookup,
) {
  const recipe = recipeForDesign(design, lookup);
  if (!recipe && !lock.recipe) return undefined;
  if (!recipe || canonical(lock.recipe) !== canonical(recipe.registration))
    throw new RecipeError(
      "Generated recipe provenance does not match the current registered recipe. Regenerate before planning or verifying.",
    );
  for (const file of recipe.files.filter((file) => file.ownership === "generated"))
    if (lock.files?.[file.path] !== `sha256-${sha(file.contents)}`)
      throw new RecipeError(
        `Recipe implementation is not protected by the generation lock: ${file.path}`,
      );
  for (const file of recipe.artifacts)
    if (lock.files?.[file.path] !== `sha256-${sha(file.contents)}`)
      throw new RecipeError(
        `Recipe artifact is not protected by the generation lock: ${file.path}`,
      );
  for (const suite of recipe.acceptance) {
    const expected = [
      { path: acceptancePath(suite), contents: suite.source },
      ...(suite.files ?? []).map((file) => ({
        path: acceptanceSupportPath(suite, file),
        contents: file.contents,
      })),
    ];
    for (const file of expected)
      if (lock.files?.[file.path] !== `sha256-${sha(file.contents)}`)
        throw new RecipeError(
          `Recipe acceptance is not protected by the generation lock: ${file.path}`,
        );
  }
  return {
    ...recipe.manifest.provided,
    acceptance: recipe.acceptance.map((suite) => `${suite.service}/${suite.id}`),
    frontendNotes: Object.fromEntries(
      recipe.design.elements
        .filter((element) => recipe.manifest.provided.frontends.includes(element.id))
        .map((element) => [element.id, element.notes]),
    ),
  };
}

export function qrStudioArchitecture(name: string): Architecture {
  return {
    system: {
      name,
      description:
        "Create permanent QR links, save artwork revisions and understand recorded scan activity.",
    },
    nodes: [
      {
        id: "owner",
        kind: "person",
        name: "Link owner",
        description: "Manages private links, artwork and analytics.",
      },
      {
        id: "scanner",
        kind: "person",
        name: "Person scanning a code",
        description: "Opens a printed QR link in their browser.",
      },
      {
        id: "destination",
        kind: "external-system",
        name: "Destination websites",
        description: "Sites selected by link owners, outside this system's control.",
      },
    ],
    relationships: [
      {
        id: "owner-manages",
        from: "owner",
        to: "system",
        description: "Manages links, artwork and analytics",
        container: "qrwty-web",
      },
      {
        id: "scanner-opens",
        from: "scanner",
        to: "system",
        description: "Opens the permanent QR URL",
        container: "qrwty",
      },
      {
        id: "system-redirects",
        from: "system",
        to: "scanner",
        description: "Returns a redirect destination",
        container: "qrwty",
      },
      {
        id: "browser-follows",
        from: "scanner",
        to: "destination",
        description: "Browser follows the destination URL",
      },
    ],
  };
}
