// Type-level checks of the generated types with openapi-fetch; `pnpm typecheck` compiles this.
import { createRestClient } from "../src/client.ts";
import type { paths } from "./links.openapi.ts";

const client = createRestClient<paths>({ name: "links", baseUrl: "http://links:8080/v1" });

export async function usage() {
  const pong = await client.GET("/ping", { params: { query: { message: "hi" } } });
  const message: string | undefined = pong.data?.message;

  const created = await client.POST("/links", { body: { url: "https://example.com" } });
  if (created.data) {
    const status: "active" | "expired" = created.data.status;
    const note: string | null | undefined = created.data.note;
    void [status, note];
  }
  if (created.error) {
    const code: string = created.error.error;
    void code;
  }

  const link = await client.GET("/links/{code}", { params: { path: { code: "jv" } } });
  void link.data?.owner?.message;

  // @ts-expect-error: the path parameter is required.
  await client.GET("/links/{code}");
  // @ts-expect-error: the body is required and must have a url.
  await client.POST("/links", { body: { tags: [] } });
  // @ts-expect-error: no such path.
  await client.GET("/nope");
  // @ts-expect-error: /links has no GET.
  await client.GET("/links");
  return message;
}
