import { readFileSync } from "node:fs";
import { PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

const credentials = JSON.parse(readFileSync("/run/secrets/s3_credentials", "utf8"));
const client = new S3Client({
  region: "garage",
  endpoint: "http://objects:3900",
  forcePathStyle: true,
  credentials,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
await client.send(
  new PutBucketCorsCommand({
    Bucket: "youtube-v1-originals",
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedOrigins: ["http://127.0.0.1:4400"],
          AllowedMethods: ["PUT"],
          AllowedHeaders: ["content-type", "x-amz-*"],
          ExposeHeaders: ["ETag"],
          MaxAgeSeconds: 600,
        },
      ],
    },
  }),
);
