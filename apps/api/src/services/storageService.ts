import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { s3Client } from "./s3Client.js";

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function getObject(key: string) {
  return s3Client.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
}

export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    }),
  );
}
