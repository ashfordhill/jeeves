import { readFileSync } from "node:fs";
import { S3Client, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { required } from "./env.ts";
export function objects(publicSigning = false) {
  const credentials = JSON.parse(readFileSync("/run/secrets/s3_credentials", "utf8")) as {
    accessKeyId: string;
    secretAccessKey: string;
  };
  return new S3Client({
    region: "garage",
    endpoint: publicSigning ? required("PUBLIC_S3_ENDPOINT") : "http://objects:3900",
    forcePathStyle: true,
    credentials,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}
// Transport primitive only. Callers must enforce ownership, size, part identity and lifecycle before invoking.
export function signPart(bucket: string, key: string, uploadId: string, partNumber: number) {
  return getSignedUrl(
    objects(true),
    new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: 900 },
  );
}
