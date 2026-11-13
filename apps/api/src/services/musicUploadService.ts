import { randomUUID } from "node:crypto";
import type { MusicUploadSignInput } from "@commune/shared";
import { MAX_MUSIC_BYTES } from "@commune/shared";
import { MusicTrack } from "../models/MusicTrack.js";
import { MusicUpload } from "../models/MusicUpload.js";
import { UserMusic } from "../models/UserMusic.js";
import { badRequest, conflict, notFound } from "../utils/errors.js";
import {
  createUploadForm,
  getObjectMetadata,
} from "./storageService.js";

const UPLOAD_RECORD_TTL_MINUTES = 15;

export async function createMusicUpload(
  userId: string,
  input: MusicUploadSignInput,
) {
  if (input.size > MAX_MUSIC_BYTES) {
    throw badRequest("Music file is too large");
  }

  const storageKey = `music/${userId}/${randomUUID()}`;

  const upload = await MusicUpload.create({
    userId,
    storageKey,
    title: input.title,
    artist: input.artist,
    mimeType: input.mimeType,
    size: input.size,
    expiresAt: new Date(
      Date.now() + UPLOAD_RECORD_TTL_MINUTES * 60 * 1000,
    ),
  });

  try {
    const form = await createUploadForm(
      storageKey,
      input.mimeType,
      input.size,
    );

    return {
      uploadId: upload.id,
      url: form.url,
      fields: form.fields,
    };
  } catch (error) {
    await MusicUpload.deleteOne({ _id: upload._id });
    throw error;
  }
}

export async function completeMusicUpload(
  userId: string,
  uploadId: string,
) {
  const upload = await MusicUpload.findOne({
    _id: uploadId,
    userId,
  });

  if (!upload) {
    throw notFound("Upload not found");
  }

  // Повторное подтверждение уже завершённой загрузки.
  if (upload.completedTrackId) {
    return {
      trackId: upload.completedTrackId.toString(),
    };
  }

  if (upload.expiresAt.getTime() <= Date.now()) {
    throw badRequest("Upload has expired");
  }

  let metadata;

  try {
    metadata = await getObjectMetadata(upload.storageKey);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "$metadata" in error &&
      (error as { $metadata?: { httpStatusCode?: number } }).$metadata
        ?.httpStatusCode === 404
    ) {
      throw badRequest("Uploaded file not found");
    }

    throw error;
  }

  if (metadata.ContentLength !== upload.size) {
    throw badRequest("Uploaded file size does not match");
  }

  if (metadata.ContentType !== upload.mimeType) {
    throw badRequest("Uploaded file type does not match");
  }

  let track;

  try {
    track = await MusicTrack.findOneAndUpdate(
      { storageKey: upload.storageKey },
      {
        $setOnInsert: {
          title: upload.title,
          artist: upload.artist,
          storageKey: upload.storageKey,
          mimeType: upload.mimeType,
          size: upload.size,
          duration: null,
          uploadedBy: userId,
        },
      },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
      },
    );
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== 11000
    ) {
      throw error;
    }

    track = await MusicTrack.findOne({
      storageKey: upload.storageKey,
    });
  }

  if (!track) {
    throw notFound("Music track not found");
  }

  if (track.uploadedBy.toString() !== userId) {
    throw conflict("This upload belongs to another user");
  }

  // Добавляем трек в библиотеку загрузившего пользователя.
  try {
    await UserMusic.updateOne(
      {
        userId,
        trackId: track._id,
      },
      {
        $setOnInsert: {
          userId,
          trackId: track._id,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    // При параллельных запросах связь могла быть создана другим запросом.
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== 11000
    ) {
      throw error;
    }
  }

  // Сохраняем результат, чтобы повторный запрос вернул тот же trackId.
  await MusicUpload.updateOne(
    {
      _id: upload._id,
      userId,
      completedTrackId: null,
    },
    {
      $set: {
        completedTrackId: track._id,
      },
    },
  );

  return {
    trackId: track.id,
  };
}
