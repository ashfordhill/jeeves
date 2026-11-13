import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";
import { plan, secret } from "./common.mjs";

for (const binding of plan.storage.filter((binding) => binding.corsPut)) {
  const client = new S3Client({
    region: "garage",
    endpoint: "http://local-objects:3900",
    forcePathStyle: true,
    credentials: JSON.parse(secret(binding.secret)),
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  try {
    await client.send(
      new PutBucketCorsCommand({
        Bucket: binding.resource,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: [`http://127.0.0.1:${process.env.LOCAL_HTTP_PORT}`],
              AllowedMethods: ["PUT"],
              AllowedHeaders: ["content-type", "x-amz-*"],
              ExposeHeaders: ["ETag"],
              MaxAgeSeconds: 600,
            },
          ],
        },
      }),
    );
  } finally {
    client.destroy();
  }
}
console.log("Selected PUT origins configured.");
