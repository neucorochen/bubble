import { useEffect, useState } from "react";
import { fontUploadUrlSchema, SITE_FONTS, type SiteFont } from "@commune/shared";
import { assetUrl } from "./api";

export const FONT_OPTIONS: Record<(typeof SITE_FONTS)[number], { label: string; family: string }> =
  {
    arial: { label: "Arial", family: 'Arial, "Liberation Sans", sans-serif' },
    verdana: { label: "Verdana", family: "Verdana, Geneva, sans-serif" },
    georgia: { label: "Georgia", family: "Georgia, serif" },
    times: { label: "Times New Roman", family: '"Times New Roman", "Liberation Serif", serif' },
    consolas: { label: "Consolas", family: 'Consolas, "Courier New", monospace' },
  };

export function standardFontFamily(font?: SiteFont | null) {
  return font && Object.hasOwn(FONT_OPTIONS, font)
    ? FONT_OPTIONS[font as keyof typeof FONT_OPTIONS].family
    : undefined;
}

export function useStoredFont(font?: SiteFont | null, family = "BubbleCustomFont") {
  const path = fontUploadUrlSchema.safeParse(font).data;
  const [loaded, setLoaded] = useState<string>();
  useEffect(() => {
    if (!path) return;
    const face = new FontFace(family, `url(${JSON.stringify(assetUrl(path))})`);
    let active = true;
    void face.load().then(
      () => {
        if (!active) return;
        document.fonts.add(face);
        setLoaded(path);
      },
      () => undefined,
    );
    return () => {
      active = false;
      document.fonts.delete(face);
      setLoaded(undefined);
    };
  }, [path, family]);
  return (
    standardFontFamily(font) ??
    (path && loaded === path ? `${family}, "Segoe UI", system-ui, sans-serif` : undefined)
  );
}
