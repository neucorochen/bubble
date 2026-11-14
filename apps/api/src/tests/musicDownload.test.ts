import { afterEach, describe, expect, it, vi } from "vitest";
import { MusicTrack } from "../models/MusicTrack.js";
import { getMusicDownloadUrl } from "../services/musicService.js";
import * as storage from "../services/storageService.js";

describe("music downloads", () => {
  afterEach(() => vi.restoreAllMocks());

  it("signs a download with a safe filename and preserves its audio extension", async () => {
    vi.spyOn(MusicTrack, "findById").mockImplementation((() => ({ select: () => ({ lean: async () => ({ storageKey: "music/key", artist: "Moby", title: "Song/Title", mimeType: "audio/mpeg" }) }) })) as never);
    const sign = vi.spyOn(storage, "createDownloadUrl").mockResolvedValue("https://example.test/file");
    expect(await getMusicDownloadUrl("0123456789abcdef01234567")).toBe("https://example.test/file");
    expect(sign).toHaveBeenCalledWith("music/key", 600, "Moby - Song_Title.mp3");
  });

  it("rejects missing tracks", async () => {
    vi.spyOn(MusicTrack, "findById").mockImplementation((() => ({ select: () => ({ lean: async () => null }) })) as never);
    await expect(getMusicDownloadUrl("0123456789abcdef01234567")).rejects.toThrow();
  });
});
