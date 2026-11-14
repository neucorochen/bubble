import { describe, expect, it } from "vitest";
import { musicUploadCompleteSchema } from "@commune/shared";

describe("music upload duration", () => {
  const uploadId = "0123456789abcdef01234567";

  it("accepts measured durations and remains compatible with older clients", () => {
    expect(musicUploadCompleteSchema.parse({ uploadId, duration: 213.42 }).duration).toBe(213.42);
    expect(musicUploadCompleteSchema.parse({ uploadId }).duration).toBeUndefined();
  });

  it("rejects invalid duration values", () => {
    for (const duration of [0, -1, Infinity, 604801, "123"]) {
      expect(musicUploadCompleteSchema.safeParse({ uploadId, duration }).success).toBe(false);
    }
  });
});
