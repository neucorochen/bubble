import type { MusicAttachmentDTO } from "@commune/shared";
import { MusicTrack } from "../models/MusicTrack.js";
import { badRequest } from "../utils/errors.js";

export async function validateMusicTrackIds(ids: string[]) {
  if (ids.length && await MusicTrack.countDocuments({ _id: { $in: ids } }) !== ids.length) {
    throw badRequest("Music track not found");
  }
}

export async function loadPostMusic(
  posts: { _id: unknown; musicTrackIds?: unknown[] }[],
): Promise<Map<string, MusicAttachmentDTO[]>> {
  const ids = [...new Set(posts.flatMap((post) => (post.musicTrackIds ?? []).map(String)))];
  const tracks = ids.length
    ? await MusicTrack.find({ _id: { $in: ids } })
        .select("title artist duration")
        .lean()
    : [];
  const byId = new Map(tracks.map((track) => [track._id.toString(), track]));
  return new Map(
    posts.map((post) => [
      String(post._id),
      (post.musicTrackIds ?? []).map((value): MusicAttachmentDTO => {
        const id = String(value);
        const track = byId.get(id);
        return track
          ? {
              id,
              title: track.title,
              artist: track.artist,
              duration: track.duration ?? null,
              unavailable: false,
            }
          : { id, unavailable: true };
      }),
    ]),
  );
}
