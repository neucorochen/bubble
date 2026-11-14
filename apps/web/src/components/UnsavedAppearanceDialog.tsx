import { useEffect, useRef } from "react";
import AeroTitlebar from "./AeroTitlebar";

export default function UnsavedAppearanceDialog({
  busy,
  error,
  canSave,
  onStay,
  onDiscard,
  onSave,
}: {
  busy: boolean;
  error?: string;
  canSave: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSave: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stay = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current!;
    const trigger = document.activeElement;
    element.showModal();
    stay.current?.focus();
    return () => {
      element.close();
      if (trigger instanceof HTMLElement) trigger.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      className="wallpaper-workshop wallpaper-upload"
      aria-labelledby="unsaved-appearance-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onStay();
      }}
    >
      <div className="wallpaper-workshop-window">
        <AeroTitlebar
          closeLabel="Остаться в настройках"
          onClose={() => {
            if (!busy) onStay();
          }}
        >
          <h2 id="unsaved-appearance-title">Несохранённые настройки</h2>
        </AeroTitlebar>
        <div className="wallpaper-workshop-body">
          <p>Сохранить изменения перед переходом?</p>
          {error && <p role="alert">{error}</p>}
          <div className="unsaved-appearance-actions">
            <button ref={stay} type="button" className="btn" disabled={busy} onClick={onStay}>
              Остаться
            </button>
            <button type="button" className="btn" disabled={busy} onClick={onDiscard}>
              Уйти без сохранения
            </button>
            <button type="button" className="btn" disabled={busy || !canSave} onClick={onSave}>
              {busy ? "Сохранение…" : "Сохранить и перейти"}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
