import type { ReactNode } from "react";

export default function AeroTitlebar({
  children,
  onClose,
  closeLabel = "Закрыть мастерскую",
}: {
  children?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <div className="aero-titlebar" aria-hidden={onClose ? undefined : true}>
      {children}
      <span className="aero-window-controls">
        {onClose ? (
          <button
            type="button"
            className="aero-window-control aero-window-close"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <i className="aero-control-close" aria-hidden="true" />
          </button>
        ) : (
          <>
            <span className="aero-window-control">
              <i className="aero-control-minimize" />
            </span>
            <span className="aero-window-control">
              <i className="aero-control-maximize" />
            </span>
            <span className="aero-window-control aero-window-close">
              <i className="aero-control-close" />
            </span>
          </>
        )}
      </span>
    </div>
  );
}
