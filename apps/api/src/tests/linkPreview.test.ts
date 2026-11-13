import { lookup } from "node:dns/promises";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../app.js";
import { loadLinkPreview, parseMetadata, previewUrl, publicIPv4 } from "../services/linkPreview.js";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
beforeEach(() => vi.clearAllMocks());

describe("link previews", () => {
  it("rejects private, local, reserved and literal IP targets", () => {
    for (const ip of ["127.0.0.1", "10.2.3.4", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1"]) expect(publicIPv4(ip)).toBe(false);
    expect(publicIPv4("8.8.8.8")).toBe(true);
    for (const url of ["http://127.0.0.1/", "http://[::1]/", "file:///etc/passwd", "http://example.com:8080/", "https://user:pass@example.com/"]) expect(previewUrl(url)).toBeNull();
    expect(previewUrl("https://example.com/path")?.hostname).toBe("example.com");
  });

  it("does not connect when DNS returns a private address or mixed addresses", async () => {
    vi.mocked(lookup).mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }] as never);
    expect(await loadLinkPreview("https://local.example/")).toBeNull();
    vi.mocked(lookup).mockResolvedValueOnce([{ address: "8.8.8.8", family: 4 }, { address: "10.0.0.1", family: 4 }] as never);
    expect(await loadLinkPreview("https://mixed.example/")).toBeNull();
  });

  it("extracts bounded Open Graph metadata as plain text", () => {
    expect(parseMetadata(`<meta content="Hello &amp; welcome" property="og:title"><meta name='description' content='A &quot;page&quot;'><meta property='og:image' content='/cover.png'>`)).toEqual({ title: "Hello & welcome", description: 'A "page"', image: "/cover.png" });
    expect(parseMetadata(`<title>${"x".repeat(250)}</title>`).title).toHaveLength(200);
  });

  it("requires authentication for metadata requests", async () => {
    const response = await request(createApp()).post("/api/link-preview").send({ url: "https://example.com" });
    expect(response.status).toBe(401);
    expect(lookup).not.toHaveBeenCalled();
  });
});
