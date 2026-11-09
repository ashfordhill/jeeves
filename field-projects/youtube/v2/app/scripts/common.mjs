import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

process.chdir(fileURLToPath(new URL("../", import.meta.url)));
export const plan = JSON.parse(readFileSync("infra/local.json", "utf8"));
export const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const secret = (name) =>
  readFileSync(`${process.env.SECRET_DIR ?? "/run/secrets"}/${name}`, "utf8").trim();
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
