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
  listMusic,
  removeTrackFromLibrary,
} from "../services/musicService.js";

export async function signUpload(req: Request, res: Response) {
  res.set("Cache-Control", "no-store");

  const body: MusicUploadTicket = await createMusicUpload(
    req.userId!,
    req.body as MusicUploadSignInput,
  );

  res.status(201).json(body);
}

export async function completeUpload(req: Request, res: Response) {
  const { uploadId } = req.body as MusicUploadCompleteInput;

  const body = await completeMusicUpload(req.userId!, uploadId);

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
