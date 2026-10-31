import type {
  Attachment,
  Connection,
  DesignDocument,
  Element,
  ResourceConfig,
  TemplateManifest,
  TemplateManifestInput,
} from "@jeeves/spec";
import type { ComposeFile, ComposeFragment } from "./compose.ts";

/**
 * The template package contract (PLAN §8). A template package exports one `TemplateModule` from
 * `templates/<id>/template.ts`; `manifest.ts` stays import-free of Node APIs so the web app can
 * load it through the registry.
 *
 * Package layout:
 *
 * | Path             | Part                                                              |
 * | ---------------- | ----------------------------------------------------------------- |
 * | `manifest.ts`    | `defineTemplate({...})`, the default export                       |
 * | `runtime/`       | Its own npm package (`@jeeves/<name>-runtime`), the strict part   |
 * | `scaffold/`      | Files rendered once into the project, then project-owned          |
 * | `generate.ts`    | `generate(ctx)`: deterministic files and compose fragments        |
 * | `test-pack/`     | `TestPack` checks, run against the composed project               |
 * | `agent-guide.md` | How a coding agent extends this template                          |
 * | `conformance/`   | `*.conformance.ts` Testcontainers tests (`pnpm test:templates`)   |
 * | `template.ts`    | Bundles the above into a `TemplateModule`                         |
 */
export interface TemplateModule {
  manifest: TemplateManifestInput;
  generate(ctx: GenerateContext): GenerateResult;
  /** Markdown, copied into `jeeves/elements/<id>.md` for the orchestrator. */
  agentGuide: string;
  testPack: TestPack;
  /** The runtime package generated code imports, if the template has one. */
  runtime?: RuntimePackage;
  /** Additional immutable/shared components required by this template. */
  runtimes?: RuntimePackage[];
}

export interface RuntimePackage {
  name: string;
  version: string;
  /** Absolute path of the package directory (what `pnpm pack` runs in). */
  dir: string;
  /** Absolute archive path and SHA-256 of an immutable published component. */
  artifact?: { path: string; sha256: string };
}

/** Who owns a file in the generated project (PLAN §9 "Ownership"). */
export type FileOwnership =
  /** Rewritten on every generation; hashed in `lock.json`. */
  | "generated"
  /** Written only if missing; project-owned afterwards. */
  | "scaffold";

export interface OutputFile {
  /** POSIX path relative to the project root. */
  path: string;
  contents: string;
  ownership: FileOwnership;
}

/** One end of a connection as seen from the element being generated. */
export interface ResolvedEnd {
  element: Element;
  attachment?: Attachment;
  /**
   * The manifest of the peer's attachment, if the connection ends on one, else of the element.
   * Undefined when the peer is a "needs a template" element or its template is unknown.
   */
  manifest?: TemplateManifest;
  /** The peer element's own manifest (the same as `manifest` unless the end is an attachment). */
  elementManifest?: TemplateManifest;
  /** The peer element's directory, when it has a template. */
  dir?: string;
}

export interface ResolvedConnection {
  connection: Connection;
  /** The end of the connection on this element (and attachment, if any). */
  self: Endpoint;
  peer: ResolvedEnd;
}

type Endpoint = Connection["from"];

export interface ResolvedAttachment {
  attachment: Attachment;
  manifest: TemplateManifest;
  config: Record<string, unknown>;
  /** Connections ending at this attachment, in design order. */
  incoming: ResolvedConnection[];
  /** Connections starting at this attachment, in design order. */
  outgoing: ResolvedConnection[];
}

/** Everything `generate` may look at. Built by `createGenerateContext`. */
export interface GenerateContext {
  design: DesignDocument;
  /** Previous emitted resource snapshot and immutable SQL, supplied only during regeneration. */
  previousModel?: ResourceConfig;
  generatedContracts?: Record<string, string>;
  previousMigrations?: OutputFile[];
  reviewedMigration?: { fromFingerprint: string; toFingerprint: string; sql: string };
  element: Element;
  /** Set when generating an attachment template on `element`. */
  attachment?: Attachment;
  manifest: TemplateManifest;
  /** The element's (or attachment's) config with schema defaults applied. */
  config: Record<string, unknown>;
  /** The element's directory, e.g. `databases/links-db`. */
  dir: string;
  /** The element's attachments, in design order, with their config defaults applied. */
  attachments: ResolvedAttachment[];
  /** Connections ending at this element (or attachment), in design order. */
  incoming: ResolvedConnection[];
  /** Connections starting at this element (or attachment), in design order. */
  outgoing: ResolvedConnection[];
}

export interface GenerateResult {
  resourceModel?: ResourceConfig;
  files: OutputFile[];
  /** Merged with every other template's fragment into `docker-compose.yml`. */
  compose: ComposeFragment;
  /** Runtime packages an element needs in its `package.json` (vendored by the generator). */
  runtimeDependencies: { element: string; name: string }[];
  /**
   * Registry packages an element needs in its `package.json`, for example `drizzle-orm` for a
   * service that uses a database. Like runtime dependencies, they're added when missing and never
   * changed or removed (`mergePackageDependencies`).
   */
  packageDependencies?: PackageDependency[];
  /**
   * `package.json` scripts an element needs, for example `pretypecheck` to regenerate client
   * types. Added when the script name is missing; an existing script is never changed.
   */
  packageScripts?: PackageScript[];
}

export interface PackageScript {
  element: string;
  name: string;
  command: string;
}

export interface PackageDependency {
  element: string;
  name: string;
  /** An exact version. */
  version: string;
  dev?: boolean;
}

/** A template's test pack: ordered checks run against the composed, running project. */
export interface TestPack {
  template: string;
  checks: TestCheck[];
}

export interface TestCheck {
  /** Stable kebab-case ID, used in reports. */
  id: string;
  title: string;
  /** Throws (any error) to fail. Checks run in order and may restart services. */
  run(ctx: TestPackContext): Promise<void>;
}

/** What a check gets. Conformance tests implement it with Testcontainers; S10 with compose. */
export interface TestPackContext {
  /** Extensions left for later tasks; never includes the current or completed work. */
  deferredOperations?: string[];
  projectDir: string;
  /** The element (or attachment) the pack is checked for, resolved as it was for `generate`. */
  subject: GenerateContext;
  /** The project's `docker-compose.yml`, parsed. */
  compose: ComposeFile;
  service(name: string): ServiceHandle;
  log(message: string): void;
}

export interface ServiceHandle {
  name: string;
  /** Host address of a published container port. */
  endpoint(containerPort: number): Promise<{ host: string; port: number }>;
  exec(command: string[]): Promise<{ exitCode: number; output: string }>;
  /** Restarts the container and waits until it is healthy again. */
  restart(): Promise<void>;
  /** Stops the container (SIGTERM, then SIGKILL after the grace period). */
  stop(options?: { graceSeconds?: number }): Promise<{ exitCode: number }>;
  /** Starts a stopped service and waits until it is healthy. */
  start(): Promise<void>;
  /**
   * Runs a one-off container of this service (`docker compose run --rm --no-deps`) with extra
   * environment or another command, and waits for it to exit.
   */
  run(options: {
    env?: Record<string, string>;
    command?: string[];
  }): Promise<{ exitCode: number; output: string }>;
}

export interface CheckResult {
  id: string;
  title: string;
  status: "passed" | "failed" | "skipped";
  reason?: string;
  durationMs: number;
  error?: string;
}

/** An inapplicable check is recorded visibly, with a reason, rather than counted as passed. */
export class CheckSkipped extends Error {}
