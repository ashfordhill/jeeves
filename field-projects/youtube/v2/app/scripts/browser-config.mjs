import { writeFileSync } from "node:fs";

// Public identity binding only. Secrets remain exclusively in the private runtime.
// Realm/client follow the generated provider setup and backend audience together.
export function writeBrowserConfiguration(plan, ports) {
  if (plan.identity.length !== 1) throw Error("Expected one bound browser identity provider");
  const realm = plan.identity[0].id;
  const config = {
    issuer: `http://127.0.0.1:${ports.LOCAL_IDENTITY_PORT}/realms/${realm}`,
    clientId: `${realm}-web`,
    callback: `http://127.0.0.1:${ports.LOCAL_HTTP_PORT}/`,
  };
  writeFileSync(
    "dist-public/runtime-config.js",
    `window.__LOCAL_VIDEO_CONFIG__ = ${JSON.stringify(config)};\n`,
  );
}
