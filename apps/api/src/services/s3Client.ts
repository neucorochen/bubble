import { S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";

const credentials =
  env.S3_ACCESS_KEY && env.S3_SECRET_KEY
    ? {
      accessKeyId: env.S3_ACCESS_KEY,
      secretAccessKey: env.S3_SECRET_KEY,
    }
    : undefined;

function createClient(endpoint?: string) {
  return new S3Client({
    region: env.S3_REGION,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    ...(credentials ? { credentials } : {}),
  });
}

/**
 * Клиент для операций API с хранилищем.
 * Использует внутренний endpoint, если он настроен.
 */
export const s3Client = createClient(env.S3_ENDPOINT);

/**
 * Клиент для создания ссылок, которыми будет пользоваться браузер.
 * Его endpoint должен быть доступен с компьютера пользователя.
 */
export const s3PresignClient =
  env.S3_PUBLIC_ENDPOINT &&
  env.S3_PUBLIC_ENDPOINT !== env.S3_ENDPOINT
    ? createClient(env.S3_PUBLIC_ENDPOINT)
    : s3Client;
