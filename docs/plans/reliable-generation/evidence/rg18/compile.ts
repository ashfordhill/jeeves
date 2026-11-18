import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { receiptDesign } from "../../../../../field-projects/generator-system/fixtures/rg-receipts/design.ts";
import { webhookDesign } from "../../../../../field-projects/generator-system/fixtures/rg-webhook/design.ts";
import { runStudioCommands } from "../../../../../jeeves/packages/spec/src/fixtures/v2-modules.ts";
import { exportNewDirectory } from "../../../../../jeeves-generator/src/export.ts";
import { assembleV2 } from "../../../../../jeeves-generator/src/v2/assemble.ts";
import { loadLocalV2Registry } from "../../../../../jeeves-generator/templates/local-v2/index.ts";

const root = await mkdtemp("/tmp/jeeves-rg18-compile-");
try {
  for (const variant of ["combined", "generic", "generic-pubsub", "api"]) {
    const design =
      variant === "api"
        ? webhookDesign()
        : variant.startsWith("generic")
          ? runStudioCommands(receiptDesign(), [
              { type: "removeTile", tile: "counter", alsoRemove: ["totals"] },
            ])
          : receiptDesign();
    if (variant === "generic-pubsub") {
      const events = design.architecture?.studio?.elements.find((row) => row.element === "events");
      if (events?.settings.kind !== "queue") throw Error("Missing Pub/Sub fixture queue");
      events.settings.provider = "google-cloud";
    }
    console.log("Actual variant", variant);
    const bundle = assembleV2({ designJson: JSON.stringify(design) }, loadLocalV2Registry());
    const app = join(root, variant);
    await exportNewDirectory(bundle.files, app);
    console.log(
      "Emitted paths",
      bundle.files.length,
      bundle.files.map((f) => f.path),
    );
    if (variant === "generic-pubsub") {
      const refusal = await readFile(
        join(app, "src/operations/projector-apply-item-requeue-0.ts"),
        "utf8",
      );
      if (
        !refusal.includes("PUBSUB_REQUEUE_UNSUPPORTED") ||
        refusal.includes("runtime/amqp.ts") ||
        refusal.includes("brokerBinding")
      )
        throw Error("Unsupported Pub/Sub requeue must compile without RabbitMQ imports");
      console.log(
        "Pub/Sub requeue artifact explicitly refuses and imports no RabbitMQ adapter/binding",
      );
    }
    const pkg = JSON.parse(await readFile(join(app, "package.json"), "utf8"));
    console.log("Dependency pins", pkg.dependencies, pkg.devDependencies);
    console.log(
      execFileSync("pnpm", ["install", "--offline", "--frozen-lockfile"], {
        cwd: app,
        encoding: "utf8",
      }),
    );
    console.log(
      "Scaffold checker and compiler",
      execFileSync("pnpm", ["build"], { cwd: app, encoding: "utf8" }),
    );
    if (variant === "api") continue;
    const handler = join(app, "src/modules/projector/apply-item.ts");
    const original = await readFile(handler, "utf8");
    await writeFile(
      handler,
      `${original}\nexport { receiptConsumer } from "./apply-item.receipt.ts";\n`,
    );
    // This is an application-owned extension file, checked through the real v8 boundary.
    const product = join(app, "src/modules/projector/apply-item.receipt.ts");
    await writeFile(
      product,
      `// @jeeves-extension: operation
import { defineReceiptConsumer } from "../../extension-api/index.ts";
import type { Dependencies } from "./apply-item.slots.ts";
export const receiptConsumer=defineReceiptConsumer<Dependencies>({
 database:"items", deliveryHorizonSeconds:86400, retentionSeconds:604800,
 map(input,messageId) { return {id:messageId,payload:input}; },
 async complete(event,commands) { await commands.call("record_item",[event.id,"projection"]); }
});\n`,
    );
    const declarationPath = join(app, "infra/postgres/items/products.json");
    const declaration = JSON.parse(await readFile(declarationPath, "utf8"));
    declaration.operations.push({
      name: "record_item",
      host: "projector",
      module: "apply-item",
      kind: "command",
      parameters: 2,
      file: "infra/postgres/items/products/commands/record-item.sql",
      relations: [{ schema: "p_projector_owner", name: "items", operations: ["insert"] }],
    });
    await writeFile(declarationPath, `${JSON.stringify(declaration, null, 2)}\n`);
    await writeFile(
      join(app, "infra/postgres/items/products/commands/record-item.sql"),
      "INSERT INTO p_projector_owner.items(id,account) VALUES($1,$2) RETURNING id,account;\n",
    );
    await writeFile(
      join(app, "infra/postgres/items/products/migrations/p_projector_owner/0001-initial.sql"),
      "CREATE TABLE p_projector_owner.items(id text PRIMARY KEY,account text NOT NULL);\n",
    );
    console.log(
      "Second product mapping registers record_item on the declared p_projector_owner.items under product-only grants",
    );
    console.log(
      "Filled receipt extension checker and compiler",
      execFileSync("pnpm", ["build"], { cwd: app, encoding: "utf8" }),
    );
    await writeFile(product, `${await readFile(product, "utf8")}\nvoid receiptConsumer.ack;\n`);
    let refused = false;
    try {
      execFileSync("pnpm", ["build"], { cwd: app, encoding: "utf8", stdio: "pipe" });
    } catch (error) {
      refused = String((error as { stdout?: string }).stdout).includes(
        "Property 'ack' does not exist",
      );
    }
    if (!refused) throw Error("Public ACK control did not refuse");
    console.log("Actual TypeScript refused product ACK control");
    console.log(
      "Compiler",
      execFileSync(process.execPath, [join(app, "node_modules/typescript/bin/tsc"), "--version"], {
        encoding: "utf8",
      }).trim(),
    );
  }
} finally {
  await rm(root, { recursive: true, force: true });
  console.log("Exact scratch directory removed");
}
