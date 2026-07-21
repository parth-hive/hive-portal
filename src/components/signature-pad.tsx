"use client";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  /** PNG data URL of the drawing, or null while empty. */
  toDataUrl: () => string | null;
  clear: () => void;
};

// 4:1 export canvas — the PDF renders signatures into a 48×12mm box, so
// keeping capture and render at the same aspect ratio avoids distortion.
export const SIGNATURE_WIDTH = 960;
export const SIGNATURE_HEIGHT = 240;

/** Freehand signature canvas (mouse/touch/stylus). Transparent background. */
export function SignaturePad({
  ref,
  onChange,
  className = "",
}: {
  ref?: Ref<SignaturePadHandle>;
  /** Fires when the pad goes from empty to inked or is cleared. */
  onChange?: (hasInk: boolean) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const inked = useRef(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1a1a18";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * SIGNATURE_WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * SIGNATURE_HEIGHT,
    };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // A tap with no movement should still leave a dot.
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
    if (!inked.current) {
      inked.current = true;
      onChange?.(true);
    }
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    drawing.current = false;
  };

  useImperativeHandle(ref, () => ({
    isEmpty: () => !inked.current,
    toDataUrl: () =>
      inked.current ? (canvasRef.current?.toDataURL("image/png") ?? null) : null,
    clear: () => {
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
      inked.current = false;
      onChange?.(false);
    },
  }));

  return (
    <canvas
      ref={canvasRef}
      width={SIGNATURE_WIDTH}
      height={SIGNATURE_HEIGHT}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      // touch-action:none so signing doesn't scroll the page on mobile.
      className={`w-full touch-none rounded-xl border border-stone bg-white ${className}`}
      style={{ aspectRatio: "4 / 1" }}
    />
  );
}
