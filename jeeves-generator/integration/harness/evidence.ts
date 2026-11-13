import { lstat, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { writeJson } from "./process.ts";

// A private sibling survives interrupted tests without changing generated files/runtime history.
// Cleanup deletes it only with the outer temporary directory, after every reporter is scrubbed.
export const privateRedactionsPath = (application: string) => `${application}.redactions.json`;
async function privateRedactions(application: string): Promise<string[]> {
  const path = privateRedactionsPath(application);
  const stat = await lstat(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined;
    throw error;
  });
  if (!stat) return [];
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("Invalid private redaction input");
  const values: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || !value))
    throw new Error("Invalid private redaction values");
  return values;
}
/** Persist before using a transient credential, so recovery can scrub reporter operands too. */
export async function rememberSecrets(application: string, ...values: string[]) {
  await writeJson(privateRedactionsPath(application), [
    ...new Set([...(await privateRedactions(application)), ...values.filter(Boolean)]),
  ]);
}

/** Redact both recognizable auth data and every actual runtime secret before retaining output. */
export async function sanitizer(application?: string) {
  const secrets: string[] = [];
  if (application) {
    secrets.push(...(await privateRedactions(application)));
    const directory = join(application, ".runtime/secrets");
    let names: string[];
    try {
      names = await readdir(directory);
    } catch (error) {
      // A failed startup may not have created a runtime; existing unreadable secrets are errors.
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      names = [];
    }
    for (const name of names) {
      const value = (await readFile(join(directory, name), "utf8")).trim();
      if (value) secrets.push(value);
      // Object-store credentials are JSON. Reporter operands may print individual members or
      // pretty-print the object, so the original file bytes alone do not cover those forms.
      const strings = (part: unknown): void => {
        if (typeof part === "string" && part) secrets.push(part);
        else if (part && typeof part === "object")
          for (const member of Object.values(part)) strings(member);
      };
      try {
        // The generated realm definition contains public configuration, not credentials. Its
        // "true"/"false" mapper flags and realm names must not become secret substrings.
        if (!name.endsWith(".realm.json")) strings(JSON.parse(value));
      } catch {
        /* Plain-text secrets are already included. */
      }
    }
  }
  return (value: string) => {
    for (const secret of secrets.sort((a, b) => b.length - a.length))
      value = value.split(secret).join("[REDACTED]");
    return value
      .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
      .replace(/([?&](?:X-Amz-[^=\s]+|access_token|token)=)[^&\s"']+/gi, "$1[REDACTED]")
      .replace(/(amqps?:\/\/[^:\s]+:)[^@\s]+@/g, "$1[REDACTED]@")
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED JWT]");
  };
}

/** Preserve JSON scalars/escaping even if a credential happens to be a JSON literal. */
export function sanitizeJson(value: unknown, clean: (value: string) => string): unknown {
  if (typeof value === "string") return clean(value);
  if (Array.isArray(value)) return value.map((part) => sanitizeJson(part, clean));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, part]) => [clean(key), sanitizeJson(part, clean)]),
    );
  return value;
}

/** Test output can contain assertion operands: sanitize reporters too before any upload. */
export async function sanitizeArtifacts(directory: string, applications: string[]) {
  const clean = await runSanitizer(applications);
  async function walk(path: string): Promise<void> {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Refusing a symlink in run artifacts");
      if (entry.isDirectory()) await walk(child);
      else if (/\.(?:json|log|xml)$/.test(entry.name)) {
        const original = await readFile(child, "utf8");
        let sanitized = clean(original);
        if (entry.name.endsWith(".json")) {
          try {
            sanitized = `${JSON.stringify(sanitizeJson(JSON.parse(original), clean), null, 2)}\n`;
          } catch (error) {
            // An abruptly interrupted reporter can leave truncated JSON; scrub its text too.
            if (!(error instanceof SyntaxError)) throw error;
          }
        }
        await writeFile(child, sanitized);
      }
    }
  }
  await walk(directory);
}

export async function runSanitizer(applications: string[]) {
  const redactors = await Promise.all(applications.map((application) => sanitizer(application)));
  return (value: string) => redactors.reduce((value, redact) => redact(value), value);
}
