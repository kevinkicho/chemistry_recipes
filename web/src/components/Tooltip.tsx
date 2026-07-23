"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type TooltipSide = "top" | "bottom" | "left" | "right";

/** Highest practical CSS z-index — above every app modal/overlay. */
export const TOOLTIP_Z_INDEX = 2_147_483_647;

/**
 * App-wide styled tooltip. Never uses the native `title` attribute.
 * Rendered in a portal on `document.body` with fixed positioning so
 * z-index is not trapped by parent stacking contexts (header, cards, etc.).
 */
export function Tooltip({
  content,
  children,
  side = "top",
  className = "",
  contentClassName = "",
  multiline = false,
}: {
  /** Tooltip body — string or nodes. Empty/null disables the tip. */
  content?: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  /** Extra classes on the wrapper */
  className?: string;
  contentClassName?: string;
  /** Prefer multi-line layout for longer copy */
  multiline?: boolean;
}) {
  const tipId = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const tip = tipRef.current;
    if (!trigger) return;

    const r = trigger.getBoundingClientRect();
    const gap = 8;
    const tipW = tip?.offsetWidth ?? 200;
    const tipH = tip?.offsetHeight ?? 40;

    let top = 0;
    let left = 0;

    if (side === "top") {
      top = r.top - tipH - gap;
      left = r.left + r.width / 2 - tipW / 2;
    } else if (side === "bottom") {
      top = r.bottom + gap;
      left = r.left + r.width / 2 - tipW / 2;
    } else if (side === "left") {
      top = r.top + r.height / 2 - tipH / 2;
      left = r.left - tipW - gap;
    } else {
      top = r.top + r.height / 2 - tipH / 2;
      left = r.right + gap;
    }

    // Keep inside viewport
    const pad = 6;
    left = Math.min(Math.max(pad, left), window.innerWidth - tipW - pad);
    top = Math.min(Math.max(pad, top), window.innerHeight - tipH - pad);

    setCoords({ top, left });
  }, [side]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    // Second pass after tip measures itself
    const id = requestAnimationFrame(() => updatePosition());
    return () => cancelAnimationFrame(id);
  }, [open, content, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onMove = () => updatePosition();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, updatePosition]);

  if (content == null || content === "") {
    return <>{children}</>;
  }

  const portal =
    open && mounted
      ? createPortal(
          <span
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className={`app-tooltip pointer-events-none fixed w-max max-w-[16rem] rounded-md border border-slate-600 bg-slate-900 px-2.5 py-2 text-left text-[10px] font-normal normal-case tracking-normal text-slate-200 shadow-xl shadow-black/60 ${
              multiline ? "whitespace-pre-line" : "whitespace-normal"
            } ${contentClassName}`}
            style={{
              zIndex: TOOLTIP_Z_INDEX,
              top: coords?.top ?? -9999,
              left: coords?.left ?? -9999,
              visibility: coords ? "visible" : "hidden",
            }}
          >
            {content}
          </span>,
          document.body
        )
      : null;

  return (
    <span
      ref={triggerRef}
      className={`inline-flex max-w-full ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => {
        // Keep open if focus moves inside trigger
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setOpen(false);
        }
      }}
      aria-describedby={open ? tipId : undefined}
    >
      {children}
      {portal}
    </span>
  );
}
