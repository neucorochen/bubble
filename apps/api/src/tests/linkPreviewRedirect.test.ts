import { expect, it, vi } from "vitest";
import { loadLinkPreview } from "../services/linkPreview.js";
import { request } from "node:http";
import type { EventEmitter as Emitter } from "node:events";

const fixture = vi.hoisted(() => ({ mode: "redirect" as "redirect" | "html", pinned: "" }));

vi.mock("node:dns/promises", () => ({ lookup: vi.fn(async () => [{ address: "8.8.8.8", family: 4 }]) }));
vi.mock("node:http", async (original) => {
  const module = await original<typeof import("node:http")>();
  const { EventEmitter } = await import("node:events");
  return { ...module, request: vi.fn((_url, options, callback) => {
    const req = new EventEmitter() as Emitter & { end: () => void; destroy: (error: Error) => void };
    req.end = () => queueMicrotask(() => {
      const res = new EventEmitter() as Emitter & { statusCode: number; headers: object; resume: () => void };
      options.lookup("public.example", {}, (_error: unknown, address: string) => { fixture.pinned = address; });
      res.statusCode = fixture.mode === "redirect" ? 302 : 200;
      res.headers = fixture.mode === "redirect" ? { location: "http://169.254.169.254/latest/meta-data/" } : { "content-type": "text/html; charset=utf-8" };
      res.resume = () => queueMicrotask(() => req.emit("close"));
      callback(res);
      if (fixture.mode === "html") queueMicrotask(() => { res.emit("data", Buffer.from('<meta property="og:title" content="Example"><meta name="description" content="A page">')); res.emit("end"); req.emit("close"); });
    });
    req.destroy = (error: Error) => { req.emit("error", error); req.emit("close"); };
    return req;
  }) };
});

it("rejects redirects to internal addresses before making another request", async () => {
  fixture.mode = "redirect";
  expect(await loadLinkPreview("http://public.example/path")).toBeNull();
  expect(request).toHaveBeenCalledOnce();
});

it("loads public metadata using the checked IP address", async () => {
  fixture.mode = "html";
  expect(await loadLinkPreview("http://public.example/path")).toEqual({ title: "Example", description: "A page", site: "public.example", image: null });
  expect(fixture.pinned).toBe("8.8.8.8");
});
