import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { s3Client, s3PresignClient } from "./s3Client.js";

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

export async function getObjectMetadata(key: string) {
  return s3Client.send(
    new HeadObjectCommand({
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

/**
 * Создаёт временную форму для загрузки файла непосредственно в S3.
 *
 * Ограничение размера проверяется самим хранилищем,
 * а не только нашим API.
 */
export async function createUploadForm(
  key: string,
  contentType: string,
  maxBytes: number,
): Promise<{ url: string; fields: Record<string, string> }> {
  return createPresignedPost(s3PresignClient, {
    Bucket: env.S3_BUCKET,
    Key: key,
    Expires: 600,
    Fields: {
      "Content-Type": contentType,
    },
    Conditions: [
      ["content-length-range", 1, maxBytes],
      ["eq", "$Content-Type", contentType],
    ],
  });
}

/**
 * Создаёт временную ссылку для воспроизведения аудио.
 */
export async function createDownloadUrl(
  key: string,
  expiresIn = 600,
  filename?: string,
): Promise<string> {
  return getSignedUrl(
    s3PresignClient,
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      ...(filename ? { ResponseContentDisposition: `attachment; filename="track"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}` } : {}),
    }),
    { expiresIn },
  );
}
