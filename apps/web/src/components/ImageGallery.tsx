import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent, TouchEvent } from "react";
import { assetUrl } from "../lib/api";

export default function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const [index, setIndex] = useState<number | null>(null);
  const [slide, setSlide] = useState(0);
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 600px)").matches);
  const [showArrows, setShowArrows] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const touch = useRef<{ x: number; y: number } | null>(null);
  const mouseDrag = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null);
  const suppressClick = useRef(false);
  const clickTimer = useRef<ReturnType<typeof setTimeout>>();
  const showTemporarily = (isTouch = window.matchMedia("(pointer: coarse)").matches) => {
    setShowArrows(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowArrows(false), isTouch ? 500 : 2200);
  };
  useEffect(() => {
    const media = window.matchMedia("(max-width: 600px)");
    const update = () => setMobile(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => () => { clearTimeout(hideTimer.current); clearTimeout(clickTimer.current); }, []);
  useEffect(() => {
    if (index !== null && !dialog.current?.open) { dialog.current?.showModal(); showTemporarily(); }
  }, [index]);
  if (!images.length) return null;
  const move = (offset: number) => setIndex((current) => current === null ? null : (current + offset + images.length) % images.length);
  const activeSlide = slide % images.length;
  const moveSlide = (offset: number) => setSlide((activeSlide + offset + images.length) % images.length);
  const startSwipe = (event: TouchEvent) => {
    if (event.touches.length !== 1) { touch.current = null; return; }
    touch.current = { x: event.touches[0]!.clientX, y: event.touches[0]!.clientY };
  };
  const endSwipe = (event: TouchEvent, action: (offset: number) => void) => {
    const start = touch.current;
    touch.current = null;
    const end = event.changedTouches[0];
    if (!start || !end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) < 45 || Math.abs(dx) <= Math.abs(dy) * 1.2) return;
    suppressClick.current = true;
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { suppressClick.current = false; }, 500);
    action(dx < 0 ? 1 : -1);
  };
  const preventSwipeClick = (event: MouseEvent) => {
    if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; }
  };
  const mouseDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !event.isPrimary) return;
    mouseDrag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, dragging: false };
  };
  const mouseMove = (event: PointerEvent<HTMLElement>) => {
    const start = mouseDrag.current;
    if (!start || start.id !== event.pointerId || !(event.buttons & 1)) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.dragging && Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      start.dragging = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };
  const mouseUp = (event: PointerEvent<HTMLElement>, action: (offset: number) => void) => {
    const start = mouseDrag.current;
    if (!start || start.id !== event.pointerId) return;
    mouseDrag.current = null;
    if (!start.dragging) return;
    suppressClick.current = true;
    clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => { suppressClick.current = false; }, 500);
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.2) action(dx < 0 ? 1 : -1);
  };
  const src = (url: string | undefined) => url?.startsWith("https://") || url?.startsWith("http://") || url?.startsWith("blob:") ? url : assetUrl(url);
  return <>
    {images.length > (mobile ? 2 : 4) ? <div className="image-gallery image-gallery--carousel" onPointerDown={mouseDown} onPointerMove={mouseMove} onPointerUp={(event) => mouseUp(event, moveSlide)} onPointerCancel={() => { mouseDrag.current = null; }} onDragStart={(event) => event.preventDefault()} onTouchStart={startSwipe} onTouchEnd={(event) => endSwipe(event, moveSlide)} onTouchCancel={() => { touch.current = null; }} onClickCapture={preventSwipeClick}>
      <button type="button" className="image-gallery__item" onClick={() => setIndex(activeSlide)} aria-label={`Открыть изображение ${activeSlide + 1} из ${images.length}`}><img src={src(images[activeSlide])} alt={alt} draggable={false} loading="lazy" decoding="async" /></button>
      <span className="image-gallery__count" aria-live="polite">{activeSlide + 1} / {images.length}</span>
      <button type="button" className="image-gallery__zone image-gallery__zone--previous" aria-label="Предыдущее фото" onClick={() => moveSlide(-1)}><span className="image-gallery__arrow" aria-hidden="true">‹</span></button>
      <button type="button" className="image-gallery__zone image-gallery__zone--next" aria-label="Следующее фото" onClick={() => moveSlide(1)}><span className="image-gallery__arrow" aria-hidden="true">›</span></button>
    </div> : <div className={`image-gallery image-gallery--${images.length}`}>
      {images.map((url, i) => <button type="button" className="image-gallery__item" key={`${url}-${i}`} onClick={() => setIndex(i)} aria-label={`Открыть изображение ${i + 1} из ${images.length}`}><img src={src(url)} alt={alt} loading="lazy" decoding="async" /></button>)}
    </div>}
    <dialog ref={dialog} className={`image-viewer${showArrows ? "" : " image-viewer--idle"}`} aria-label="Просмотр изображения" onClose={() => { clearTimeout(hideTimer.current); setIndex(null); }} onPointerMove={(event) => showTemporarily(event.pointerType === "touch")} onPointerDown={(event) => showTemporarily(event.pointerType === "touch")} onKeyDown={(event) => {
      showTemporarily(false);
      if (images.length < 2) return;
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
    }}>
      <div className="image-viewer__header"><span>{index === null ? "" : `${index + 1} / ${images.length}`}</span><span className="aero-window-controls"><span className="aero-window-close"><button type="button" aria-label="Закрыть просмотр" title="Закрыть" onClick={() => dialog.current?.close()}><i className="aero-control-close" aria-hidden="true" /></button></span></span></div>
      <div className="image-viewer__content" onPointerDown={images.length > 1 ? mouseDown : undefined} onPointerMove={images.length > 1 ? mouseMove : undefined} onPointerUp={images.length > 1 ? (event) => mouseUp(event, move) : undefined} onPointerCancel={() => { mouseDrag.current = null; }} onDragStart={(event) => event.preventDefault()} onTouchStart={(event) => { showTemporarily(true); startSwipe(event); }} onTouchEnd={(event) => { showTemporarily(true); if (images.length > 1) endSwipe(event, move); }} onTouchCancel={() => { touch.current = null; }} onClickCapture={preventSwipeClick}>
        {index !== null && <img src={src(images[index])} alt={`${alt}, ${index + 1} из ${images.length}`} draggable={false} />}
        {images.length > 1 && <><button type="button" className="image-viewer__zone image-viewer__zone--previous" aria-label="Предыдущее изображение" onClick={() => move(-1)}><span className="image-viewer__arrow" aria-hidden="true">‹</span></button><button type="button" className="image-viewer__zone image-viewer__zone--next" aria-label="Следующее изображение" onClick={() => move(1)}><span className="image-viewer__arrow" aria-hidden="true">›</span></button></>}
      </div>
    </dialog>
  </>;
}
