import { writeFileSync } from "node:fs";

// v2's public sign-in binding for the browser (V3-16): the issuer, client and callback of this
// run's ports. Public values only; secrets stay in the private .runtime.
export function writeBrowserConfiguration(plan, env) {
  if (plan.identity.length !== 1) throw Error("Expected one bound browser identity provider");
  const [http, identity] = ["LOCAL_HTTP_PORT", "LOCAL_IDENTITY_PORT"].map((key) => {
    if (!/^\d{4,5}$/.test(env[key] ?? ""))
      throw new Error(`Set ${key}: the browser's sign-in is bound to this run's ports.`);
    return Number(env[key]);
  });
  const realm = plan.identity[0].id;
  const config = {
    issuer: `http://127.0.0.1:${identity}/realms/${realm}`,
    clientId: `${realm}-web`,
    callback: `http://127.0.0.1:${http}/`,
  };
  writeFileSync(
    "dist-public/runtime-config.js",
    `window.__LOCAL_VIDEO_CONFIG__ = ${JSON.stringify(config)};\n`,
  );
}
