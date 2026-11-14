import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { WALLPAPER_NAME_MAX_LENGTH } from "@commune/shared";
import { api } from "../lib/api";
import { prepareImage, WALLPAPER_PHOTO } from "../lib/images";
import AeroTitlebar from "./AeroTitlebar";

export default function WallpaperUploadDialog({
  onClose,
  onPublish,
}: {
  onClose: () => void;
  onPublish: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File>();
  const upload = useMutation({
    mutationFn: async ({ image, name }: { image: File; name: string }) => {
      const form = new FormData();
      form.append("name", name);
      form.append("file", await prepareImage(image, WALLPAPER_PHOTO));
      await api("/wallpapers", { method: "POST", body: form });
    },
    onSuccess: onPublish,
  });

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    element.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    return () => element.close();
  }, []);

  function close() {
    if (!upload.isPending) onClose();
  }

  return (
    <dialog
      ref={dialog}
      className="wallpaper-workshop wallpaper-upload"
      aria-labelledby="wallpaper-upload-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      <div className="wallpaper-workshop-window">
        <AeroTitlebar onClose={close} closeLabel="Закрыть загрузку">
          <h2 id="wallpaper-upload-title">Загрузить фон</h2>
        </AeroTitlebar>
        <form
          className="wallpaper-workshop-body"
          onSubmit={(event) => {
            event.preventDefault();
            if (file && name.trim() && !upload.isPending)
              upload.mutate({ image: file, name: name.trim() });
          }}
        >
          <fieldset disabled={upload.isPending}>
            <label>
              Название фона
              <input
                name="name"
                value={name}
                required
                maxLength={WALLPAPER_NAME_MAX_LENGTH}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              Изображение
              <input
                type="file"
                required
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={(event) => setFile(event.target.files?.[0])}
              />
            </label>
          </fieldset>
          {upload.error && (
            <p role="alert" className="error">
              {upload.error.message}
            </p>
          )}
          <div className="row">
            <button type="button" className="btn" disabled={upload.isPending} onClick={close}>
              Отмена
            </button>
            <button className="btn" disabled={!name.trim() || !file || upload.isPending}>
              {upload.isPending ? "Загрузка…" : "Загрузить в каталог"}
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
