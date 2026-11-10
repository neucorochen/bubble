
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { signAccessToken } from "../utils/tokens.js";

const app = createApp();

const auth = {
  Authorization: `Bearer ${signAccessToken("507f1f77bcf86cd799439011")}`,
};

describe("POST /api/uploads/sign", () => {
  it("requires authentication", async () => {
    const res = await request(app).post("/api/uploads/sign");

    expect(res.status).toBe(401);
  });

  it("returns a server upload ticket", async () => {
    const res = await request(app).post("/api/uploads/sign").set(auth);

    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toEqual({ mode: "server" });
  });
});

describe("POST /api/uploads/complete", () => {
  it("requires authentication", async () => {
    const res = await request(app)
      .post("/api/uploads/complete")
      .send({ id: "a".repeat(32), format: "png" });

    expect(res.status).toBe(401);
  });

  it("rejects direct uploads", async () => {
    const res = await request(app)
      .post("/api/uploads/complete")
      .set(auth)
      .send({ id: "a".repeat(32), format: "png" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/direct uploads are not enabled/i);
  });
});
