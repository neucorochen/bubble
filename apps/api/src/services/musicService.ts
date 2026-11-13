import type { MusicListQuery, MusicTrackDTO } from "@commune/shared";
import { MusicTrack } from "../models/MusicTrack.js";
import { UserMusic } from "../models/UserMusic.js";
import { notFound } from "../utils/errors.js";
import { createDownloadUrl } from "./storageService.js";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listMusic(
  userId: string,
  query: MusicListQuery,
): Promise<MusicTrackDTO[]> {
  const filter = query.q
    ? {
      $or: [
        { title: { $regex: escapeRegex(query.q), $options: "i" } },
        { artist: { $regex: escapeRegex(query.q), $options: "i" } },
      ],
    }
    : {};

  if (query.scope === "mine") {
    const entries = await UserMusic.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    if (entries.length === 0) {
      return [];
    }

    const tracks = await MusicTrack.find({
      _id: { $in: entries.map((entry) => entry.trackId) },
      ...filter,
    }).lean();

    const tracksById = new Map(
      tracks.map((track) => [track._id.toString(), track]),
    );

    return entries
      .map((entry): MusicTrackDTO | null => {
        const track = tracksById.get(entry.trackId.toString());

        if (!track) {
          return null;
        }

        return {
          id: track._id.toString(),
          title: track.title,
          artist: track.artist,
          mimeType: track.mimeType,
          size: track.size,
          duration: track.duration ?? null,
          addedAt: entry.createdAt?.toISOString() ?? null,
          addedByMe: true,
        };
      })
      .filter((track): track is MusicTrackDTO => track !== null)
      .slice(0, query.limit);
  }

  const tracks = await MusicTrack.find(filter)
    .sort({ createdAt: -1 })
    .limit(query.limit)
    .lean();

  if (tracks.length === 0) {
    return [];
  }

  const entries = await UserMusic.find({
    userId,
    trackId: { $in: tracks.map((track) => track._id) },
  }).lean();

  const libraryByTrackId = new Map(
    entries.map((entry) => [
      entry.trackId.toString(),
      entry.createdAt,
    ]),
  );

  return tracks.map((track) => {
    const addedAt = libraryByTrackId.get(track._id.toString());

    return {
      id: track._id.toString(),
      title: track.title,
      artist: track.artist,
      mimeType: track.mimeType,
      size: track.size,
      duration: track.duration ?? null,
      addedAt: addedAt?.toISOString() ?? null,
      addedByMe: addedAt !== undefined,
    };
  });
}

export async function addTrackToLibrary(
  userId: string,
  trackId: string,
): Promise<void> {
  const trackExists = await MusicTrack.exists({ _id: trackId });

  if (!trackExists) {
    notFound("Music track not found");
  }

  try {
    await UserMusic.updateOne(
      { userId, trackId },
      {
        $setOnInsert: { userId, trackId },
      },
      { upsert: true },
    );
  } catch (error) {
    // Параллельное добавление одного трека не должно приводить к ошибке.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      return;
    }

    throw error;
  }
}

export async function removeTrackFromLibrary(
  userId: string,
  trackId: string,
): Promise<void> {
  const trackExists = await MusicTrack.exists({ _id: trackId });

  if (!trackExists) {
    notFound("Music track not found");
  }

  await UserMusic.deleteOne({ userId, trackId });
}

export async function getMusicPlaybackUrl(
  trackId: string,
): Promise<string> {
  const track = await MusicTrack.findById(trackId).select("storageKey").lean();

  if (!track) {
    throw notFound("Music track not found");
  }

  return createDownloadUrl(track.storageKey, 600);
}
