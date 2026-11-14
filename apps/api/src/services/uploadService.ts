import crypto from "node:crypto";
import path from "node:path";
import { fontUploadUrlSchema, uploadUrlSchema, type UploadTicket } from "@commune/shared";
import { logger } from "../config/logger.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { Wallpaper } from "../models/Wallpaper.js";
import { badRequest } from "../utils/errors.js";
import { detectFontType } from "../utils/fonts.js";
import type { ImageExt } from "../utils/images.js";
import { deleteObject, uploadObject } from "./storageService.js";

const STORAGE_PREFIX = "uploads";

const contentTypes: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function saveImage(
  buffer: Buffer,
  ext: ImageExt,
): Promise<string> {
  const name = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
  const key = `${STORAGE_PREFIX}/${name}`;

  await uploadObject(
    key,
    buffer,
    contentTypes[ext] ?? "application/octet-stream",
  );

  return `/uploads/${name}`;
}

export async function saveFont(owner: string, buffer: Buffer): Promise<string> {
  const format = detectFontType(buffer);
  if (!format) throw badRequest("Invalid font file");
  const name = `${owner}-${crypto.randomBytes(16).toString("hex")}.${format.extension}`;
  await uploadObject(`${STORAGE_PREFIX}/${name}`, buffer, format.mime);
  return `/uploads/${name}`;
}

export async function deleteFontIfUnused(url: string | null | undefined): Promise<void> {
  if (!url || !fontUploadUrlSchema.safeParse(url).success) return;
  try {
    if (!(await User.exists({ "appearance.font": url }))) {
      await deleteObject(`${STORAGE_PREFIX}/${path.basename(url)}`);
    }
  } catch (err) {
    logger.warn({ err, url }, "Failed to delete font");
  }
}

/**
 * Direct uploads are disabled.
 * All files are uploaded through the API.
 */
export function createUploadTicket(): UploadTicket {
  return { mode: "server" };
}

export async function confirmDirectUpload(
  _id: string,
  _format: string,
): Promise<string> {
  throw badRequest("Direct uploads are not enabled");
}

/**
 * Delete an uploaded file only when no post, avatar, account background or workshop item references it.
 */
export async function deleteUploadIfUnused(
  url: string | null | undefined,
): Promise<void> {
  if (!url || !uploadUrlSchema.safeParse(url).success) return;

  try {
    const [usedByPost, usedByUser, usedByWorkshop] = await Promise.all([
      Post.exists({ imageUrl: url }),
      User.exists({ $or: [{ avatarUrl: url }, { "appearance.backgroundUrl": url }] }),
      Wallpaper.exists({ imageUrl: url }),
    ]);

    if (usedByPost || usedByUser || usedByWorkshop) return;

    await deleteObject(`${STORAGE_PREFIX}/${path.basename(url)}`);
  } catch (err) {
    logger.warn({ err, url }, "Failed to delete upload");
  }
}
