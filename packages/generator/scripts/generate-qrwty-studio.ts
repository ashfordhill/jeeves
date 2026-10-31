/** Controlled Studio model adoption. Generates files; never starts Compose or calls a model. */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { qrwtyStudioAcceptance } from "../../../fixtures/acceptance/qrwty-studio/manifest.ts";
import { designSchema, validateDesign } from "../../spec/src/index.ts";
import { runtimeTarballName } from "../../template-kit/src/index.ts";
import { generateProject, packRuntimes } from "../src/generate.ts";
import { templateSet } from "../src/modules.ts";

const target = process.argv[2];
if (!target || process.argv.length !== 3)
  throw new Error("Pass one existing generated qrwty checkout directory.");
const dir = resolve(target);
if (!existsSync(join(dir, "jeeves/lock.json"))) throw new Error("Expected a generated checkout.");
const hash = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");
const vendor = join(dir, "vendor/jeeves");
const artifacts = new Map(readdirSync(vendor).map((name) => [name, hash(join(vendor, name))]));
const packageFile = join(dir, "services/qrwty/package.json");
const pkg = JSON.parse(readFileSync(packageFile, "utf8"));
const oldPin = "file:../../vendor/jeeves/jeeves-rest-server-0.1.0.tgz";
const nextPin = "file:../../vendor/jeeves/jeeves-rest-server-0.2.0.tgz";
if (![oldPin, nextPin].includes(pkg.dependencies["@jeeves/rest-server"]))
  throw new Error("Unexpected REST runtime pin; inspect before adopting Studio.");
const design = designSchema.parse(
  JSON.parse(
    readFileSync(new URL("../../../fixtures/designs/qrwty-studio.json", import.meta.url), "utf8"),
  ),
);
const templates = templateSet();
const findings = validateDesign(design, templates.lookup);
if (findings.some((finding) => finding.severity === "error"))
  throw new Error(JSON.stringify(findings));
const result = await generateProject({
  dir,
  design,
  projectName: "qrwty",
  templates,
  git: false,
  fixedAcceptance: qrwtyStudioAcceptance,
  // Released artifacts are immutable. Adopt new versions alongside old ones.
  vendor: (output, runtimes) =>
    packRuntimes(
      output,
      runtimes.filter(
        (runtime) =>
          !existsSync(
            join(output, "vendor/jeeves", runtimeTarballName(runtime.name, runtime.version)),
          ),
      ),
    ),
  log: console.log,
});
if (!result.ok) throw new Error(JSON.stringify(result));
for (const [name, expected] of artifacts)
  if (hash(join(vendor, name)) !== expected) throw new Error(`Existing artifact changed: ${name}`);
// Dependency pins are project-owned and intentionally adopted, never hidden in the merge helper.
const updated = JSON.parse(readFileSync(packageFile, "utf8"));
updated.dependencies["@jeeves/rest-server"] = nextPin;
writeFileSync(packageFile, `${JSON.stringify(updated, null, 2)}\n`);
console.log(
  JSON.stringify(
    {
      generated: result.written,
      scaffolded: result.scaffolded,
      vendored: result.vendored,
      preservedArtifacts: artifacts.size,
      designSource: "fixtures/designs/qrwty-studio.json",
      note: "This reviewed snapshot does not remove or replace unrelated live editor draft elements.",
    },
    null,
    2,
  ),
);
