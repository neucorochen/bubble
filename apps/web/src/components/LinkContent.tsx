import { Fragment, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuth } from "../store/auth";

type LinkPart = { value: string; href?: string };

export function splitLinks(text: string): LinkPart[] {
  const parts: LinkPart[] = [];
  const pattern = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    let raw = match[0];
    while (/[.,!?;:]$/.test(raw) || (raw.endsWith(")") && (raw.match(/\)/g)?.length ?? 0) > (raw.match(/\(/g)?.length ?? 0)) || (raw.endsWith("]") && (raw.match(/\]/g)?.length ?? 0) > (raw.match(/\[/g)?.length ?? 0))) raw = raw.slice(0, -1);
    if (!raw) continue;
    try {
      const url = new URL(/^www\./i.test(raw) ? `https://${raw}` : raw);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) continue;
      if (start > last) parts.push({ value: text.slice(last, start) });
      parts.push({ value: raw, href: url.href });
      last = start + raw.length;
    } catch { /* Leave invalid URLs as plain text. */ }
  }
  if (last < text.length) parts.push({ value: text.slice(last) });
  return parts;
}

export function youtubeId(href: string): string | null {
  try {
    const url = new URL(href);
    const host = url.hostname.toLowerCase();
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
    else if (["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com", "www.youtube-nocookie.com"].includes(host)) {
      const segments = url.pathname.split("/").filter(Boolean);
      id = url.pathname === "/watch" ? url.searchParams.get("v") : ["shorts", "embed", "live"].includes(segments[0] ?? "") ? segments[1] ?? null : null;
    }
    return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
  } catch { return null; }
}

export function LinkedText({ text }: { text: string }) {
  const parts = useMemo(() => splitLinks(text), [text]);
  return <>{parts.map((part, index) => part.href ? <a key={index} href={part.href} target="_blank" rel="noopener noreferrer ugc nofollow">{part.value}</a> : <Fragment key={index}>{part.value}</Fragment>)}</>;
}

interface Preview { title: string; description: string; site: string; image: string | null }

export function LinkPreview({ text }: { text: string }) {
  const { user } = useAuth();
  const first = useMemo(() => splitLinks(text).find((part) => part.href)?.href ?? "", [text]);
  const [delayed, setDelayed] = useState(first);
  useEffect(() => { const timer = window.setTimeout(() => setDelayed(first), 700); return () => window.clearTimeout(timer); }, [first]);
  const id = youtubeId(first);
  const query = useQuery({
    queryKey: ["link-preview", user?.id, delayed],
    queryFn: () => api<{ preview: Preview | null }>("/link-preview", { method: "POST", body: { url: delayed } }),
    enabled: Boolean(user && first && !id && delayed === first),
    staleTime: 5 * 60_000,
    retry: false,
  });
  if (!first) return null;
  if (id) return <div className="link-preview link-preview--video"><iframe title="Видео YouTube" src={`https://www.youtube-nocookie.com/embed/${id}`} loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>;
  const preview = (delayed === first ? query.data?.preview : null) ?? { title: "", description: "", site: new URL(first).hostname, image: null };
  return <a className="link-preview link-preview--site" href={first} target="_blank" rel="noopener noreferrer ugc nofollow">
    {preview.image && <img src={preview.image} alt="" loading="lazy" />}
    <span className="link-preview__text"><small>{preview.site}</small><strong>{preview.title || preview.site}</strong>{preview.description && <span>{preview.description}</span>}</span>
  </a>;
}
