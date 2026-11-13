import { S3Client, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readSecret } from "./local.ts";

export function createObjects(options: {
  endpoint: string;
  region: string;
  credentialSecret: string;
  credential?: (secret: string) => string;
}) {
  const credentials: unknown = JSON.parse(
    (options.credential ?? readSecret)(options.credentialSecret),
  );
  if (
    !credentials ||
    typeof credentials !== "object" ||
    !("accessKeyId" in credentials) ||
    typeof credentials.accessKeyId !== "string" ||
    !credentials.accessKeyId ||
    !("secretAccessKey" in credentials) ||
    typeof credentials.secretAccessKey !== "string" ||
    !credentials.secretAccessKey
  )
    throw new Error("Invalid object credential");
  return new S3Client({
    endpoint: options.endpoint,
    region: options.region,
    credentials: {
      accessKeyId: credentials.accessKeyId,
      secretAccessKey: credentials.secretAccessKey,
    },
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
}
/** Provider primitive only; caller enforces ownership, part identity, bounds and lifecycle.
 * Supply a client with the public signing endpoint separately from the internal control client. */
export function signPart(
  client: S3Client,
  part: {
    bucket: string;
    key: string;
    uploadId: string;
    partNumber: number;
    expiresInSeconds: number;
  },
) {
  return getSignedUrl(
    client,
    new UploadPartCommand({
      Bucket: part.bucket,
      Key: part.key,
      UploadId: part.uploadId,
      PartNumber: part.partNumber,
    }),
    { expiresIn: part.expiresInSeconds },
  );
}
