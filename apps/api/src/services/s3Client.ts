import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";

const credentials =
  env.S3_ACCESS_KEY && env.S3_SECRET_KEY
    ? {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    }
    : undefined;

export const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  ...(credentials ? { credentials } : {}),
});
