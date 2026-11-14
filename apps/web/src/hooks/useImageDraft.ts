import { useEffect, useRef, useState } from "react";
import { useUploadImage } from "./useUpload";
import { validateImage } from "../lib/images";
import { POST_PHOTO, prepareImage } from "../lib/images";
import { api } from "../lib/api";

type DraftImage = { id: string; file: File; preview: string; url?: string; error?: string; pending: boolean };

export function useImageDraft(privateMessage = false) {
  const [images, setImages] = useState<DraftImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<DraftImage[]>([]);
  const upload = useUploadImage("post");
  const update = (fn: (previous: DraftImage[]) => DraftImage[]) => {
    const next = fn(ref.current);
    ref.current = next;
    setImages(next);
  };
  useEffect(() => () => { ref.current.forEach((image) => URL.revokeObjectURL(image.preview)); ref.current = []; }, []);
  const run = (image: DraftImage) => {
    update((items) => items.map((item) => item.id === image.id ? { ...item, pending: true, error: undefined } : item));
    const uploadFile = privateMessage ? (async () => { const file = await prepareImage(image.file, POST_PHOTO); const body = new FormData(); body.append("file", file); return api<{ url: string }>("/messages/images", { method: "POST", body }); })() : upload.mutateAsync(image.file);
    void uploadFile.then(({ url }) => update((items) => items.map((item) => item.id === image.id ? { ...item, pending: false, url } : item)))
      .catch((err: Error) => update((items) => items.map((item) => item.id === image.id ? { ...item, pending: false, error: err.message } : item)));
  };
  const add = (files: File[]) => {
    if (ref.current.length + files.length > 10) { setError("Можно прикрепить не более 10 изображений."); return; }
    const invalid = files.map(validateImage).find(Boolean);
    if (invalid) { setError(invalid); return; }
    setError(null);
    const next = files.map((file) => ({ id: crypto.randomUUID(), file, preview: URL.createObjectURL(file), pending: true }));
    update((items) => [...items, ...next]);
    next.forEach(run);
  };
  const remove = (id: string) => { const image = ref.current.find((item) => item.id === id); if (image) URL.revokeObjectURL(image.preview); update((items) => items.filter((item) => item.id !== id)); };
  const clear = () => { ref.current.forEach((item) => URL.revokeObjectURL(item.preview)); update(() => []); setError(null); };
  return { images, error, add, remove, clear, retry: run, busy: images.some((item) => item.pending), ready: images.every((item) => Boolean(item.url)) };
}
