import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
export const plan = JSON.parse(readFileSync("infra/local.json", "utf8"));
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
/** A credential, by `readSecret`'s rule: the file `JEEVES_SECRET_<NAME>_FILE` names when that is
 * set (an absolute path; `<NAME>` the name upper-cased, `-` and `.` as `_`), else
 * `SECRET_DIR/<name>`. Its failures name the variable, never the path or value. */
export const secret = (name) => {
  const variable = `JEEVES_SECRET_${name.toUpperCase().replace(/[-.]/g, "_")}_FILE`;
  const file = process.env[variable];
  if (file === undefined)
    return readFileSync(`${process.env.SECRET_DIR ?? "/run/secrets"}/${name}`, "utf8").trim();
  if (
    !file.startsWith("/") ||
    [...file].some((character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)
  )
    throw new Error(`Invalid endpoint ${variable}`);
  try {
    return readFileSync(file, "utf8").trim();
  } catch (error) {
    const code = error?.code;
    throw new Error(
      `Unreadable secret file ${variable}${typeof code === "string" && /^E[A-Z]+$/.test(code) ? ` (${code})` : ""}`,
    );
  }
};
export const quote = (name) => {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error("Invalid bounded SQL identity");
  return `"${name}"`;
};
export const capture = (...args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: 240000,
  }).trim();
export const compose = (...args) => capture("compose", "--profile", "*", ...args);
export const output = (...args) => {
  const value = compose(...args);
  if (value) console.log(value);
};
