import { useId } from "react";
import type { CSSProperties } from "react";

const COLORS = [
  ["Бирюзовый", "#1abc9c"],
  ["Зелёный", "#2ecc71"],
  ["Голубой", "#3498db"],
  ["Сиреневый", "#9b59b6"],
  ["Розовый", "#e91e63"],
  ["Жёлтый", "#f1c40f"],
  ["Оранжевый", "#e67e22"],
  ["Красный", "#e74c3c"],
  ["Серый", "#95a5a6"],
  ["Серо-синий", "#607d8b"],
  ["Тёмно-бирюзовый", "#11806a"],
  ["Тёмно-зелёный", "#1f8b4c"],
  ["Тёмно-синий", "#206694"],
  ["Фиолетовый", "#71368a"],
  ["Малиновый", "#ad1457"],
  ["Янтарный", "#c27c0e"],
  ["Медный", "#a84300"],
  ["Бордовый", "#992d22"],
  ["Графитовый", "#979c9f"],
  ["Стальной", "#546e7a"],
] as const;

interface Props {
  label: string;
  value: string | null;
  defaultColor: string;
  onChange: (color: string | null) => void;
}

export default function ColorPalette({ label, value, defaultColor, onChange }: Props) {
  const group = useId();
  const swatch = (name: string, color: string | null) => (
    <label
      key={name}
      className="appearance-swatch"
      title={name}
      style={{ "--swatch": color ?? defaultColor } as CSSProperties}
    >
      <input
        type="radio"
        name={group}
        aria-label={name}
        checked={value === color}
        onChange={() => onChange(color)}
      />
      <span aria-hidden="true" />
    </label>
  );
  return (
    <fieldset className="appearance-palette">
      <legend>{label}</legend>
      <div className="appearance-palette-controls">
        <label className="appearance-custom-color">
          <input
            type="color"
            value={value ?? defaultColor}
            onChange={(event) => onChange(event.target.value)}
          />
          Свой цвет
        </label>
        {swatch("По умолчанию", null)}
        <div className="appearance-swatches">
          {COLORS.map(([name, color]) => swatch(name, color))}
        </div>
      </div>
    </fieldset>
  );
}
