import { lookup } from "node:dns/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

// Only connect to a checked, public IPv4 address; pin it for the entire request.
const blocked = new BlockList();
for (const [address, bits] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15],
  ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as [string, number][]) blocked.addSubnet(address, bits, "ipv4");

export function publicIPv4(address: string): boolean {
  return isIP(address) === 4 && !blocked.check(address, "ipv4");
}

export function previewUrl(input: string): URL | null {
  try {
    if (input.length > 2048) return null;
    const url = new URL(input);
    if (!(["https:", "http:"].includes(url.protocol)) || url.username || url.password || url.port || isIP(url.hostname.replace(/^\[|\]$/g, ""))) return null;
    return url;
  } catch { return null; }
}

type Fetched = { body: Buffer; type: string; url: URL };
async function checkedFetch(url: URL, maxBytes: number, redirects = 0, deadline = Date.now() + 8000): Promise<Fetched> {
  if (!previewUrl(url.href) || redirects > 3 || Date.now() >= deadline) throw new Error("Invalid URL");
  let dnsTimer: ReturnType<typeof setTimeout> | undefined;
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, family: 4 }),
    new Promise<never>((_, reject) => { dnsTimer = setTimeout(() => reject(new Error("DNS timeout")), Math.min(4000, Math.max(1, deadline - Date.now()))); }),
  ]).finally(() => clearTimeout(dnsTimer));
  if (!addresses.length || addresses.some((entry) => !publicIPv4(entry.address))) throw new Error("Private address");
  const address = addresses[0]!.address;
  return new Promise((resolve, reject) => {
    const send = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = send(url, {
      family: 4,
      agent: false,
      lookup: (_host, _options, callback) => callback(null, address, 4),
      headers: { "User-Agent": "BubbleLinkPreview/1.0", Accept: "text/html,image/*;q=0.8", "Accept-Encoding": "identity" },
      timeout: 5000,
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        try { void checkedFetch(new URL(res.headers.location, url), maxBytes, redirects + 1, deadline).then(resolve, reject); } catch (error) { reject(error); }
        return;
      }
      if (status !== 200 || (res.headers["content-encoding"] && res.headers["content-encoding"] !== "identity")) { res.resume(); reject(new Error("Unsupported response")); return; }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > maxBytes) req.destroy(new Error("Response too large")); else chunks.push(chunk); });
      res.on("end", () => resolve({ body: Buffer.concat(chunks), type: String(res.headers["content-type"] ?? "").split(";")[0]!.toLowerCase(), url }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("Timeout")));
    req.on("error", reject);
    const wallTimer = setTimeout(() => req.destroy(new Error("Timeout")), Math.max(1, deadline - Date.now()));
    req.on("close", () => clearTimeout(wallTimer));
    req.end();
  });
}

function clean(value: string): string {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi, (entity) => {
    const named: Record<string, string> = { "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">" };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()]!;
    const number = entity.slice(2, -1);
    const code = number[0]?.toLowerCase() === "x" ? parseInt(number.slice(1), 16) : parseInt(number, 10);
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : "";
  }).replace(/\s+/g, " ").trim();
}

export function parseMetadata(html: string) {
  const meta: Record<string, string> = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const attr of match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[attr[1]!.toLowerCase()] = attr[2] ?? attr[3] ?? attr[4] ?? "";
    const name = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (name && attrs.content && !meta[name]) meta[name] = clean(attrs.content);
  }
  const fallback = /<title\b[^>]*>([^<]*)<\/title\s*>/i.exec(html)?.[1] ?? "";
  return { title: (meta["og:title"] || meta["twitter:title"] || clean(fallback)).slice(0, 200), description: (meta["og:description"] || meta["twitter:description"] || meta.description || "").slice(0, 300), image: meta["og:image"] || meta["twitter:image"] || "" };
}

let inFlight = 0;
export async function loadLinkPreview(input: string) {
  const target = previewUrl(input);
  if (!target || inFlight >= 12) return null;
  inFlight++;
  try {
    const page = await checkedFetch(target, 256 * 1024);
    if (page.type !== "text/html") return null;
    const meta = parseMetadata(page.body.toString("utf8"));
    let image: string | null = null;
    if (meta.image) {
      try {
        const imageUrl = previewUrl(new URL(meta.image, page.url).href);
        if (imageUrl) {
          const result = await checkedFetch(imageUrl, 150 * 1024);
          const b = result.body;
          const valid = result.type === "image/png" ? b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : result.type === "image/jpeg" ? b[0] === 255 && b[1] === 216 && b[2] === 255 : result.type === "image/webp" ? b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP" : result.type === "image/gif" && /^GIF8[79]a/.test(b.toString("ascii", 0, 6));
          if (valid) image = `data:${result.type};base64,${b.toString("base64")}`;
        }
      } catch { /* The text preview still works without an image. */ }
    }
    return { title: meta.title, description: meta.description, site: page.url.hostname, image };
  } catch { return null; } finally { inFlight--; }
}
