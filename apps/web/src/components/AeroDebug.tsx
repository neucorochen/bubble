import { useEffect, useState } from "react";

const options = [
  ["filters", "Отключить backdrop-filter и filter"],
  ["gradients", "Отключить градиенты окна"],
  ["decorations", "Отключить тени и псевдоэлементы"],
  ["box-shadows", "Отключить только box-shadow"],
  ["frame-shadows", "Тени: только фиксированная рамка"],
  ["header-shadows", "Тени: шапка и кнопки окна"],
  ["rail-shadows", "Тени: боковые панели, вкладки и нижнее меню"],
  ["overlay-shadows", "Тени: бургер-меню и PWA-панель"],
  ["restore-frame-shadow", "Firefox: вернуть размытую тень рамки"],
  ["text-shadows", "Отключить только text-shadow"],
  ["before", "Скрыть только ::before (кроме рамки)"],
  ["after", "Скрыть только ::after (кроме рамки)"],
  ["restore-page-shadow", "Firefox: вернуть тень всей страницы (сравнение)"],
  ["frame", "Скрыть фиксированную рамку"],
] as const;

export default function AeroDebug() {
  const [enabled, setEnabled] = useState<string[]>([]);
  useEffect(() => {
    document.documentElement.dataset.aeroDebug = enabled.join(" ");
    return () => { delete document.documentElement.dataset.aeroDebug; };
  }, [enabled]);
  return <aside className="aero-debug" aria-label="Диагностика Aero"><strong>Диагностика Aero</strong>{options.map(([id, label]) => <label key={id}><input type="checkbox" checked={enabled.includes(id)} onChange={(e) => setEnabled((current) => e.target.checked ? [...current, id] : current.filter((item) => item !== id))} /> {label}</label>)}</aside>;
}
