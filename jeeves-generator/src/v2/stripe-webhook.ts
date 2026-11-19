import type { NormalizedGenerationSelection } from "@jeeves/spec";
import { endpointId } from "./local-contract.ts";

export const stripeSdkVersion = "23.1.0";
export const isStripeWebhook = (selection: NormalizedGenerationSelection) =>
  selection.binding.kind === "webhook-receiver" &&
  selection.inputs["webhook.signatureFormat"] === "stripe";

export const stripeSecretName = (module: string) =>
  `JEEVES_WEBHOOK_${endpointId(module)}_STRIPE_SECRET`;

/** Keep the base lockfile intact for other formats. The Stripe snapshot has one optional peer. */
export function withStripeSdk(packageJson: Uint8Array, lockfile: Uint8Array) {
  const decoder = new TextDecoder();
  const contents = JSON.parse(decoder.decode(packageJson));
  const nodeTypes = contents.devDependencies["@types/node"];
  const snapshot = `${stripeSdkVersion}(@types/node@${nodeTypes})`;
  const [manager, lock, ...extra] = decoder.decode(lockfile).split("\n---\n");
  if (!lock || extra.length) throw new Error("Invalid base application lockfile");
  const addBefore = (source: string, anchor: string, lines: string) => {
    if (source.split(anchor).length !== 2) throw new Error("Invalid base application lockfile");
    return source.replace(anchor, lines + anchor);
  };
  const importer = addBefore(
    lock,
    "      zod:\n",
    `      stripe:\n        specifier: ${stripeSdkVersion}\n        version: ${snapshot}\n`,
  );
  const packages = addBefore(
    importer,
    "\nsnapshots:\n",
    `\n  stripe@${stripeSdkVersion}:\n    resolution: {integrity: sha512-fVUfMSfTPoukfoV//MUKAx2+YxyKmYaYtnAL9VkfnHfaPNQylFdWZMD+zgUFerI8rjbaiER8Vzj2XEUQ2AhAsQ==}\n    engines: {node: '>=20'}\n    peerDependencies:\n      '@types/node': '>=20'\n    peerDependenciesMeta:\n      '@types/node':\n        optional: true\n`,
  );
  contents.dependencies.stripe = stripeSdkVersion;
  return {
    "package.json": `${JSON.stringify(contents, null, 2)}\n`,
    "pnpm-lock.yaml": `${manager}\n---\n${packages}\n  stripe@${snapshot}:\n    optionalDependencies:\n      '@types/node': ${nodeTypes}\n`,
  };
}
