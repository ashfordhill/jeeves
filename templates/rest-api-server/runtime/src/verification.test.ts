import { describe, expect, it } from "vitest";
import { parseContract } from "./contract.ts";
import { createValidators } from "./validation.ts";

const document = {
  openapi: "3.1.0",
  paths: {
    "/image": {
      get: {
        operationId: "image",
        responses: {
          "200": {
            description: "PNG",
            content: { "image/png": { schema: { type: "string", format: "binary" } } },
          },
        },
      },
    },
    "/redirect": {
      get: {
        operationId: "redirect",
        responses: {
          "302": {
            description: "Redirect",
            headers: {
              Location: { required: true, schema: { type: "string", format: "uri" } },
              "Cache-Control": { required: true, schema: { type: "string", const: "no-store" } },
            },
          },
        },
      },
    },
  },
};
const validators = createValidators(parseContract(JSON.stringify(document)));
const image = validators.get("image")!;
const redirect = validators.get("redirect")!;
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=",
  "base64",
);

describe("non-JSON response verification", () => {
  it("accepts PNG data only with the documented media type and decodable image data", () => {
    expect(image.response(200, png, { "Content-Type": "image/png" })).toEqual([]);
    expect(image.response(200, png, {})).toMatchObject([{ path: "/headers/content-type" }]);
    expect(image.response(200, png, { "content-type": "application/json" })).not.toEqual([]);
    expect(image.response(200, Buffer.from("fake"), { "content-type": "image/png" })).toMatchObject(
      [{ message: expect.stringContaining("PNG") }],
    );
    expect(image.response(200, png.subarray(0, 45), { "content-type": "image/png" })).not.toEqual(
      [],
    );
    const corrupt = Buffer.from(png);
    corrupt[45] = (corrupt[45] ?? 0) ^ 1;
    expect(image.response(200, corrupt, { "content-type": "image/png" })).not.toEqual([]);
  });
  it("validates Location and cache headers, including missing headers and schema violations", () => {
    expect(
      redirect.response(302, undefined, {
        location: "https://example.test/current",
        "cache-control": "no-store",
      }),
    ).toEqual([]);
    expect(redirect.response(302, undefined, {})).toHaveLength(2);
    expect(
      redirect.response(302, undefined, { location: "bad", "cache-control": "public" }),
    ).toHaveLength(2);
  });
});
