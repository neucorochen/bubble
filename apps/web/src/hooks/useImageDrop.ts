import { useRef, useState } from "react";
import type { DragEvent } from "react";

export function useImageDrop(onFiles: (files: File[]) => void, disabled = false) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const isFileDrag = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");
  const reset = () => { depth.current = 0; setDragging(false); };
  return {
    dragging,
    handlers: {
      onDragEnter: (event: DragEvent<HTMLElement>) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        if (!disabled) { depth.current++; setDragging(true); }
      },
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = disabled ? "none" : "copy";
        if (!disabled) setDragging(true);
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        reset();
        if (!disabled && event.dataTransfer.files.length) onFiles(Array.from(event.dataTransfer.files));
      },
    },
  };
}
