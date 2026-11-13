import type { Request, Response } from "express";
import type {
  MusicUploadSignInput,
  MusicUploadTicket,
  MusicUploadCompleteInput,
  MusicListQuery,
  MusicTrackDTO,
} from "@commune/shared";
import {
  completeMusicUpload,
  createMusicUpload,
} from "../services/musicUploadService.js";
import {
  addTrackToLibrary,
  getMusicPlaybackUrl,
  getMusicDownloadUrl,
  listMusic,
  removeTrackFromLibrary,
  listPickerMusic,
} from "../services/musicService.js";
import { UserMusic } from "../models/UserMusic.js";

export async function libraryStatus(req: Request, res: Response) {
  res.set("Cache-Control", "private, no-store");
  res.json({ added: Boolean(await UserMusic.exists({ userId: req.userId!, trackId: req.params.id! })) });
}

export async function libraryStatuses(req: Request, res: Response) {
  res.set("Cache-Control", "private, no-store");
  const entries = await UserMusic.find({ userId: req.userId!, trackId: { $in: req.body.ids } }).select("trackId").lean();
  res.json({ ids: entries.map((entry) => entry.trackId.toString()) });
}

export async function picker(req: Request, res: Response) {
  res.set("Cache-Control", "private, no-store");
  res.json(await listPickerMusic(req.userId!, res.locals.query));
}

export async function signUpload(req: Request, res: Response) {
  res.set("Cache-Control", "no-store");

  const body: MusicUploadTicket = await createMusicUpload(
    req.userId!,
    req.body as MusicUploadSignInput,
  );

  res.status(201).json(body);
}

export async function completeUpload(req: Request, res: Response) {
  const { uploadId, duration } = req.body as MusicUploadCompleteInput;

  const body = await completeMusicUpload(req.userId!, uploadId, duration);

  res.status(201).json(body);
}

export async function list(req: Request, res: Response) {
  res.set("Cache-Control", "no-store");

  const tracks: MusicTrackDTO[] = await listMusic(
    req.userId!,
    req.query as unknown as MusicListQuery,
  );

  res.json(tracks);
}

export async function addToLibrary(req: Request, res: Response) {
  await addTrackToLibrary(req.userId!, req.params.id!);
  res.status(204).end();
}

export async function removeFromLibrary(req: Request, res: Response) {
  await removeTrackFromLibrary(req.userId!, req.params.id!);
  res.status(204).end();
}

export async function play(req: Request, res: Response) {
  res.set("Cache-Control", "no-store");

  const url = await getMusicPlaybackUrl(req.params.id!);

  res.json({ url });
}

export async function download(req: Request, res: Response) {
  res.set("Cache-Control", "no-store");
  res.json({ url: await getMusicDownloadUrl(req.params.id!) });
}
