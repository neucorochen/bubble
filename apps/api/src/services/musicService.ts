import type { MusicListQuery, MusicTrackDTO, ProfileMusicResponse } from "@commune/shared";
import { MusicTrack } from "../models/MusicTrack.js";
import { UserMusic } from "../models/UserMusic.js";
import { notFound } from "../utils/errors.js";
import { createDownloadUrl } from "./storageService.js";
import { Types } from "mongoose";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listPickerMusic(userId: string, query: { scope: "all" | "mine"; q?: string; cursor?: string }) {
  const cursor = query.cursor ? new Types.ObjectId(query.cursor) : null;
  const search = query.q ? { $or: [{ title: { $regex: escapeRegex(query.q), $options: "i" } }, { artist: { $regex: escapeRegex(query.q), $options: "i" } }] } : {};
  const base = cursor ? { _id: { $lt: cursor } } : {};
  const rows = query.scope === "all"
    ? await MusicTrack.find({ ...base, ...search }).sort({ _id: -1 }).limit(51).lean()
    : await UserMusic.aggregate([
        { $match: { userId: new Types.ObjectId(userId), ...base } },
        { $sort: { _id: -1 } },
        { $lookup: { from: MusicTrack.collection.name, localField: "trackId", foreignField: "_id", as: "track" } },
        { $unwind: "$track" },
        { $replaceRoot: { newRoot: { $mergeObjects: ["$track", { cursorId: "$_id" }] } } },
        { $match: search },
        { $limit: 51 },
      ]);
  const page = rows.slice(0, 50);
  const tracks = page.map((track) => ({ id: track._id.toString(), title: track.title, artist: track.artist, duration: track.duration ?? null, mimeType: track.mimeType, size: track.size, addedAt: null, addedByMe: query.scope === "mine" }));
  const last = page[page.length - 1];
  return { tracks, nextCursor: rows.length > 50 && last ? ("cursorId" in last ? last.cursorId : last._id).toString() : null };
}

export async function listProfileMusic(ownerId: string, viewerId: string, cursor?: string): Promise<ProfileMusicResponse> {
  const filter = cursor ? {
    $or: [
      { createdAt: { $lt: new Date(Number(cursor.slice(0, 13))) } },
      { createdAt: new Date(Number(cursor.slice(0, 13))), _id: { $lt: cursor.slice(14) } },
    ],
  } : {};
  const entries = await UserMusic.find({ userId: ownerId, ...filter })
    .sort({ createdAt: -1, _id: -1 }).limit(6).lean();
  const page = entries.slice(0, 5);
  const ids = page.map((entry) => entry.trackId);
  const [tracks, viewerEntries] = await Promise.all([
    MusicTrack.find({ _id: { $in: ids } }).lean(),
    UserMusic.find({ userId: viewerId, trackId: { $in: ids } }).lean(),
  ]);
  const tracksById = new Map(tracks.map((track) => [track._id.toString(), track]));
  const viewerDates = new Map(viewerEntries.map((entry) => [entry.trackId.toString(), entry.createdAt]));
  const items = page.flatMap((entry): MusicTrackDTO[] => {
    const track = tracksById.get(entry.trackId.toString());
    if (!track) return [];
    const addedAt = viewerDates.get(track._id.toString());
    return [{ id: track._id.toString(), title: track.title, artist: track.artist,
      mimeType: track.mimeType, size: track.size, duration: track.duration ?? null,
      addedAt: addedAt?.toISOString() ?? null, addedByMe: addedAt !== undefined }];
  });
  const last = page[page.length - 1];
  return { status: "visible", tracks: items,
    nextCursor: entries.length > 5 && last ? `${last.createdAt.getTime()}-${last._id.toString()}` : null };
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

export async function getMusicDownloadUrl(trackId: string): Promise<string> {
  const track = await MusicTrack.findById(trackId).select("storageKey title artist mimeType").lean();
  if (!track) throw notFound("Music track not found");
  const extensions: Record<string, string> = { "audio/mpeg": "mp3", "audio/flac": "flac", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/ogg": "ogg" };
  const name = `${track.artist} - ${track.title}`.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 180);
  return createDownloadUrl(track.storageKey, 600, `${name}.${extensions[track.mimeType] ?? "audio"}`);
}
