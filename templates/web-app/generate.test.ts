import { createGenerateContext } from "@jeeves/template-kit";
import { describe, expect, it } from "vitest";
import { lookup, WEB_TITLE, webDesign } from "./conformance/fixtures/design.ts";
import {
  envRef,
  generate,
  nginxTemplate,
  runtimeConfigTemplate,
  wiringSource,
} from "./generate.ts";

const ctxFor = (id: "web" | "docs") => createGenerateContext(webDesign(), lookup, id);

describe("web-app generate", () => {
  it("scaffolds the app once and generates its wiring and nginx templates", () => {
    const { files, runtimeDependencies } = generate(ctxFor("web"));
    expect(files.filter((f) => f.ownership === "scaffold").map((f) => f.path)).toEqual([
      "frontends/web/Dockerfile",
      "frontends/web/Dockerfile.dockerignore",
      "frontends/web/index.html",
      "frontends/web/package.json",
      "frontends/web/public/favicon.svg",
      "frontends/web/src/App.tsx",
      "frontends/web/src/main.tsx",
      "frontends/web/src/pages/Home.tsx",
      "frontends/web/src/styles.css",
      "frontends/web/tsconfig.json",
      "frontends/web/vite.config.ts",
    ]);
    expect(files.filter((f) => f.ownership === "generated").map((f) => f.path)).toEqual([
      "frontends/web/src/jeeves.generated.ts",
      "frontends/web/nginx/default.conf.template",
      "frontends/web/nginx/jeeves-config.json.template",
    ]);
    expect(runtimeDependencies).toEqual([{ element: "web", name: "@jeeves/web-runtime" }]);
  });

  it("escapes the title for each file it lands in", () => {
    const files = generate(ctxFor("web")).files;
    const file = (path: string) => files.find((f) => f.path === `frontends/web/${path}`)?.contents;
    expect(file("index.html")).toContain('<title>Links &amp; "Co" $5 &lt;beta&gt;</title>');
    expect(JSON.parse(file("package.json") ?? "").description).toBe(
      "Links web: a Jeeves web-app element.",
    );
    expect(file("vite.config.ts")).toContain('jeevesDev({ title: "Links & \\"Co\\" $5 <beta>" })');
    expect(file("package.json")).toContain('"dev": "vite --port 5173 --strictPort"');
    expect(wiringSource(ctxFor("web"))).toContain(`title: ${JSON.stringify(WEB_TITLE)},`);
  });

  it("serves the build with nginx, health-checked, and passes the title through compose", () => {
    const service = generate(ctxFor("docs")).compose.services?.docs;
    expect(service).toMatchObject({
      build: { context: ".", dockerfile: "frontends/docs/Dockerfile" },
      environment: { PORT: "8000", APP_TITLE: "Docs" },
      ports: ["127.0.0.1::8000"],
      restart: "unless-stopped",
    });
    expect(service?.healthcheck?.test).toEqual([
      "CMD",
      "wget",
      "-q",
      "-O",
      "/dev/null",
      "http://127.0.0.1:8000/healthz",
    ]);
    const web = generate(ctxFor("web")).compose.services?.web;
    expect(web?.environment?.APP_TITLE).toBe('Links & "Co" $$5 <beta>');
  });

  it("wires each REST client into the app, the runtime config, and the proxy", () => {
    const wiring = wiringSource(ctxFor("web"));
    expect(wiring).toContain('import { linksClient } from "./clients/links.generated.ts";');
    expect(wiring).toContain('  apis: {\n    "links": linksClient,\n  },');
    expect(JSON.parse(runtimeConfigTemplate(ctxFor("web")))).toEqual({
      title: envRef("APP_TITLE"),
      apis: { links: { url: "/_api/links" } },
    });
    const nginx = nginxTemplate(ctxFor("web"));
    expect(nginx).toContain(
      [
        "    location /_api/links/ {",
        `        set $jeeves_upstream \${API_LINKS_URL};`,
        "        rewrite ^/_api/links/(.*)$ /$1 break;",
        "        proxy_pass $jeeves_upstream;",
        `        proxy_set_header Authorization "Bearer \${API_LINKS_TOKEN}";`,
        "    }",
      ].join("\n"),
    );
  });

  it("wires no APIs for an app without clients", () => {
    expect(wiringSource(ctxFor("docs"))).toContain("  apis: {},");
    expect(nginxTemplate(ctxFor("docs"))).not.toContain("/_api/");
    expect(JSON.parse(runtimeConfigTemplate(ctxFor("docs"))).apis).toEqual({});
  });

  it("is deterministic", () => {
    expect(generate(ctxFor("web"))).toEqual(generate(ctxFor("web")));
  });
});
