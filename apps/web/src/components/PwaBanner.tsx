import { useState } from "react";
import { applyUpdate, promptInstall, useOnline, usePwa } from "../lib/pwa";

const DISMISS_KEY = "commune-install-dismissed";

function wasDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Offline notice, "new version" prompt and "install app" prompt, stacked at the bottom. */
export default function PwaBanner() {
  const { updateReady, canInstall } = usePwa();
  const online = useOnline();
  const [installHidden, setInstallHidden] = useState(wasDismissed);

  const dismissInstall = () => {
    setInstallHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode: just hide it for this visit */
    }
  };

  const showInstall = canInstall && !installHidden;
  if (online && !updateReady && !showInstall) return null;

  return (
    <div className="pwa-bars" role="region" aria-label="Состояние приложения">
      {!online && (
        <div className="pwa-bar pwa-offline" role="status">

          Нет подключения к интернету. Некоторые данные загрузятся после восстановления связи.
        </div>
      )}
      {updateReady && (
        <div className="pwa-bar" role="status">
          <span>Доступна новая версия Bubble.</span>
          <button className="btn" onClick={applyUpdate}>

            Обновить
          </button>
        </div>
      )}
      {showInstall && (
        <div className="pwa-bar">
          <span>Установите Bubble для быстрого доступа с главного экрана.</span>
          <span className="row">
            <button className="btn" onClick={() => void promptInstall()}>

              Установить
            </button>
            <button className="btn btn-ghost" onClick={dismissInstall} aria-label="Отклонить">

              Не сейчас
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
