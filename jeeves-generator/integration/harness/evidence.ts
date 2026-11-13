import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

/** Redact both recognizable auth data and every actual runtime secret before retaining output. */
export async function sanitizer(application?: string) {
  const secrets: string[] = [];
  if (application) {
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
        strings(JSON.parse(value));
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

/** Test output can contain assertion operands: sanitize reporters too before any upload. */
export async function sanitizeArtifacts(directory: string, applications: string[]) {
  const clean = await runSanitizer(applications);
  async function walk(path: string): Promise<void> {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = join(path, entry.name);
      if (entry.isSymbolicLink()) throw new Error("Refusing a symlink in run artifacts");
      if (entry.isDirectory()) await walk(child);
      else if (/\.(?:json|log|xml)$/.test(entry.name))
        await writeFile(child, clean(await readFile(child, "utf8")));
    }
  }
  await walk(directory);
}

export async function runSanitizer(applications: string[]) {
  const redactors = await Promise.all(applications.map((application) => sanitizer(application)));
  return (value: string) => redactors.reduce((value, redact) => redact(value), value);
}
