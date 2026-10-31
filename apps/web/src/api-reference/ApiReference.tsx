import type { ApiPreview } from "@jeeves/spec";
import { useMemo } from "react";
import css from "swagger-ui-dist/swagger-ui.css?inline";
import bundleUrl from "swagger-ui-dist/swagger-ui-bundle.js?url";

/** Isolate bundled React/styles. Opaque sandbox + CSP prevent API/ref/validator requests. */
export default function ApiReference({
  api,
  operationId,
}: {
  api: ApiPreview["apis"][number];
  operationId?: string;
}) {
  const source = useMemo(() => {
    const document = structuredClone(api.document!);
    const paths = document.paths as Record<string, Record<string, Record<string, unknown>>>;
    for (const operation of api.operations) {
      const entry = paths[operation.path]![operation.method.toLowerCase()]!;
      entry.summary = operation.purpose;
      entry.tags = [operation.group];
    }
    if (operationId) {
      document.paths = Object.fromEntries(
        Object.entries(paths).flatMap(([path, methods]) => {
          const selected = Object.fromEntries(
            Object.entries(methods).filter(([, value]) => value.operationId === operationId),
          );
          return Object.keys(selected).length ? [[path, selected]] : [];
        }),
      );
    }
    const spec = JSON.stringify(document).replaceAll("<", "\\u003c");
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Saved design API reference</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${location.origin} 'unsafe-inline'; style-src ${location.origin} 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"><style>${css}</style><style>body{margin:0;background:white} .swagger-ui .wrapper{padding:12px} .swagger-ui .auth-wrapper,.swagger-ui .authorization__btn{display:none} .swagger-ui .opblock-summary-method{color:#152334!important} .swagger-ui input{max-width:100%}.swagger-ui .info{margin:12px 0}.swagger-ui .info .title{font-size:24px}.swagger-ui .scheme-container{display:none}.swagger-ui .info .title small{background:#495568}.swagger-ui .info .title small.version-stamp{background:#476200}.swagger-ui .parameter__in{color:#555}</style></head><body><div id="reference"></div><script src="${new URL(bundleUrl, location.href).href}"></script><script>const ui=SwaggerUIBundle({dom_id:'#reference',spec:${spec},supportedSubmitMethods:[],validatorUrl:null,queryConfigEnabled:false,tryItOutEnabled:false,persistAuthorization:false,showExtensions:false,showCommonExtensions:false,deepLinking:false,docExpansion:'${operationId ? "full" : "list"}',defaultModelsExpandDepth:-1,requestInterceptor:()=>{throw new Error('Requests are disabled in design mode')}});</script></body></html>`;
  }, [api, operationId]);
  return (
    <iframe
      title="Saved design API reference"
      className="api-reference-frame"
      sandbox="allow-scripts"
      srcDoc={source}
    />
  );
}
