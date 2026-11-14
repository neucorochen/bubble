import { useEffect, useRef } from "react";
import type { WallpaperDTO } from "@commune/shared";
import AeroTitlebar from "./AeroTitlebar";
import WallpaperReport from "./WallpaperReport";

export default function WallpaperReportDialog({
  item,
  trigger,
  onClose,
}: {
  item: WallpaperDTO;
  trigger: HTMLButtonElement;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    element.querySelector("select")?.focus();
    return () => {
      element.close();
      trigger.focus({ preventScroll: true });
    };
  }, [trigger]);

  return (
    <dialog
      ref={dialog}
      className="wallpaper-workshop wallpaper-upload"
      aria-labelledby="favorite-report-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="wallpaper-workshop-window">
        <AeroTitlebar onClose={onClose} closeLabel="Закрыть жалобу">
          <h2 id="favorite-report-title">Жалоба на фон</h2>
        </AeroTitlebar>
        <div className="wallpaper-workshop-body">
          <WallpaperReport item={item} onClose={onClose} />
        </div>
      </div>
    </dialog>
  );
}
