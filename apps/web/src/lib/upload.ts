import type { UploadResponse } from "@commune/shared";
import { api } from "./api";

/**
 * Uploads one prepared image through the API.
 * Resolves with the reference to store on a post, profile or wallpaper.
 */
export async function uploadImage(
  file: File,
  onProgress?: (percent: number) => void,

): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);

  onProgress?.(0);

  const result = await api<UploadResponse>("/uploads", {
    method: "POST",
    body: form,
  });

  onProgress?.(100);

  return result;
}
