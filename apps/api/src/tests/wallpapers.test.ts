import { Types } from "mongoose";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { Follow } from "../models/Follow.js";
import { Post } from "../models/Post.js";
import { deleteUploadIfUnused } from "../services/uploadService.js";
import { User } from "../models/User.js";
import { Wallpaper, WallpaperReaction, WallpaperReport } from "../models/Wallpaper.js";
import { signAccessToken } from "../utils/tokens.js";

const storage = vi.hoisted(() => ({ uploadObject: vi.fn(), deleteObject: vi.fn() }));
vi.mock("../services/storageService.js", () => storage);

const app = createApp();
const viewer = new Types.ObjectId();
const friend = new Types.ObjectId();
const wallpaperId = new Types.ObjectId();
const auth = { Authorization: `Bearer ${signAccessToken(viewer.toString())}` };
const imageUrl = "/uploads/" + "a".repeat(32) + ".png";

afterEach(() => vi.restoreAllMocks());

describe("wallpaper workshop", () => {
  it("requires authentication and rejects invalid filters", async () => {
    expect((await request(app).get("/api/wallpapers")).status).toBe(401);
    expect((await request(app).get("/api/wallpapers?view=other").set(auth)).status).toBe(400);
    expect((await request(app).get(`/api/wallpapers?page=0`).set(auth)).status).toBe(400);
  });

  it("filters for friends' uploads and their current catalog wallpapers", async () => {
    vi.spyOn(Follow, "aggregate").mockResolvedValue([{ _id: friend, backgroundUrl: imageUrl }]);
    const aggregate = vi.spyOn(Wallpaper, "aggregate").mockResolvedValue([
      {
        rows: [
          {
            _id: wallpaperId,
            username: "friend",
            imageUrl,
            likeCount: 2,
            mine: false,
            liked: true,
            favorite: false,
          },
        ],
        count: [{ total: 1 }],
      },
    ]);
    const response = await request(app).get("/api/wallpapers?view=friends").set(auth);
    expect(response.status).toBe(200);
    expect(response.body.items).toMatchObject([
      { id: wallpaperId.toString(), author: "friend", usedByFriends: true },
    ]);
    expect(aggregate.mock.calls[0]?.[0]).toContainEqual({
      $match: { $or: [{ author: { $in: [friend] } }, { imageUrl: { $in: [imageUrl] } }] },
    });
  });

  it("searches names literally and sorts popular results with a stable tie-break", async () => {
    const aggregate = vi.spyOn(Wallpaper, "aggregate").mockResolvedValue([]);
    const response = await request(app)
      .get("/api/wallpapers")
      .query({ q: "  Summer.  ", page: 2 })
      .set(auth);
    expect(response.status).toBe(200);
    const pipeline = aggregate.mock.calls[0]?.[0];
    expect(pipeline?.[0]).toEqual({ $match: { name: { $regex: "Summer\\.", $options: "i" } } });
    expect(pipeline?.at(-1)).toEqual({
      $facet: {
        rows: expect.arrayContaining([
          { $sort: { likeCount: -1, _id: -1 } },
          { $skip: 15 },
          { $limit: 15 },
        ]),
        count: [{ $count: "total" }],
      },
    });
  });

  it.each([
    ["popular", 15],
    ["favorites", 8],
  ] as const)("paginates %s at %i wallpapers", async (view, size) => {
    const rows = Array.from({ length: size }, () => ({
      _id: new Types.ObjectId(),
      username: "friend",
      likeCount: 2,
    }));
    const aggregate = vi
      .spyOn(Wallpaper, "aggregate")
      .mockResolvedValue([{ rows, count: [{ total: 17 }] }]);
    const response = await request(app).get(`/api/wallpapers?view=${view}`).set(auth);

    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(size);
    expect(response.body.items[0].name).toBe("Без названия");
    expect(response.body.totalPages).toBe(Math.ceil(17 / size));
    expect(aggregate.mock.calls[0]?.[0]?.at(-1)).toEqual({
      $facet: {
        rows: expect.arrayContaining([{ $limit: size }]),
        count: [{ $count: "total" }],
      },
    });
  });

  it("rejects an empty name before uploading", async () => {
    storage.uploadObject.mockClear();
    const response = await request(app).post("/api/wallpapers").set(auth).field("name", "   ");
    expect(response.status).toBe(400);
    expect(storage.uploadObject).not.toHaveBeenCalled();
  });

  it("publishes a validated image as the authenticated user", async () => {
    const create = vi.spyOn(Wallpaper, "create").mockResolvedValue({} as never);
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jR2QAAAAASUVORK5CYII=",
      "base64",
    );
    const response = await request(app)
      .post("/api/wallpapers")
      .set(auth)
      .field("name", "  Summer  ")
      .attach("file", png, "pixel.png");
    expect(response.status).toBe(201);
    expect(response.body.url).toMatch(/^\/uploads\/[a-f0-9]{32}\.png$/);
    expect(create).toHaveBeenCalledWith({
      author: viewer.toString(),
      imageUrl: response.body.url,
      name: "Summer",
    });
  });

  it("keeps a published image after its last user stops using it", async () => {
    vi.spyOn(Post, "exists").mockResolvedValue(null);
    vi.spyOn(User, "exists").mockResolvedValue(null);
    vi.spyOn(Wallpaper, "exists").mockResolvedValue({ _id: wallpaperId });
    storage.deleteObject.mockClear();

    await deleteUploadIfUnused(imageUrl);

    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it("upserts and removes only the viewer's reaction", async () => {
    vi.spyOn(Wallpaper, "findById").mockReturnValue({
      select: () => ({
        lean: async () => ({ _id: wallpaperId, author: friend }),
      }),
    } as never);
    vi.spyOn(User, "exists").mockResolvedValue({ _id: friend });
    const upsert = vi.spyOn(WallpaperReaction, "updateOne").mockResolvedValue({} as never);
    const remove = vi.spyOn(WallpaperReaction, "deleteOne").mockResolvedValue({} as never);
    const path = `/api/wallpapers/${wallpaperId}/favorite`;
    expect((await request(app).put(path).set(auth)).status).toBe(204);
    expect((await request(app).delete(path).set(auth)).status).toBe(204);
    const key = { wallpaper: wallpaperId, user: viewer.toString(), kind: "favorite" };
    expect(upsert).toHaveBeenCalledWith(key, { $setOnInsert: key }, { upsert: true });
    expect(remove).toHaveBeenCalledWith(key);
  });

  it("stores complaints for wallpaper moderation and rejects duplicates", async () => {
    vi.spyOn(Wallpaper, "findById").mockReturnValue({
      select: () => ({
        lean: async () => ({ _id: wallpaperId, author: friend }),
      }),
    } as never);
    vi.spyOn(User, "exists").mockResolvedValue({ _id: friend });
    const create = vi
      .spyOn(WallpaperReport, "create")
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce({ code: 11000 });
    const path = `/api/wallpapers/${wallpaperId}/report`;
    const report = { reason: "spam", details: "example" };
    expect((await request(app).post(path).set(auth).send(report)).status).toBe(201);
    expect((await request(app).post(path).set(auth).send(report)).status).toBe(409);
    expect(create).toHaveBeenCalledWith({
      ...report,
      reporter: viewer.toString(),
      wallpaper: wallpaperId,
    });
  });
});
