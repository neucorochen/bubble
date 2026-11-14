import type { SiteFont } from "@commune/shared";
import { SITE_FONTS } from "@commune/shared";
import { FONT_OPTIONS, standardFontFamily, useStoredFont } from "../lib/siteFont";

export default function FontSettings({
  font,
  file,
  error,
  onChange,
  onFile,
}: {
  font?: SiteFont | null;
  file: File | null;
  error?: string;
  onChange: (font: SiteFont | null) => void;
  onFile: (file: File) => void;
}) {
  const storedFamily = useStoredFont(font, "BubbleSavedFontPreview");
  const selection = file || (font && !standardFontFamily(font)) ? "custom" : (font ?? "");
  return (
    <section className="card appearance-section" aria-labelledby="font-title">
      <h2 id="font-title">Шрифт сайта</h2>
      <div className="appearance-font-controls">
        <label>
          Основной шрифт
          <select
            value={selection}
            onChange={(event) => {
              const next = SITE_FONTS.find((option) => option === event.target.value);
              onChange(next ?? null);
            }}
          >
            <option value="">Стандартный</option>
            {SITE_FONTS.map((key) => (
              <option key={key} value={key}>
                {FONT_OPTIONS[key].label}
              </option>
            ))}
            {selection === "custom" && <option value="custom">Загруженный шрифт</option>}
          </select>
        </label>
        <label>
          Загрузить свой шрифт
          <input
            type="file"
            accept=".woff2,.woff,.ttf,.otf"
            onChange={(event) => {
              const next = event.target.files?.[0];
              event.target.value = "";
              if (next) onFile(next);
            }}
          />
        </label>
      </div>
      <p className="muted">WOFF2, WOFF, TTF или OTF, до 2 МБ.</p>
      {error && <p role="alert">{error}</p>}
      <div
        className="appearance-font-preview"
        style={{ fontFamily: file ? 'BubbleFontPreview, "Segoe UI", sans-serif' : storedFamily }}
      >
        <strong>Пример шрифта</strong>
        <span>Съешь ещё этих мягких французских булок. Bubble 123</span>
      </div>
    </section>
  );
}
