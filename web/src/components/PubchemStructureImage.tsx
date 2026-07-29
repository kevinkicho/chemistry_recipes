"use client";

/**
 * PubChem structure PNG with soft failure (503-safe).
 * Avoids broken-image spam: placeholder on error, one delayed retry.
 */

import { useCallback, useState } from "react";
import { pubchemStructureUrl } from "@/lib/api/pubchem";

export function PubchemStructureImage({
  cid,
  size = "large",
  alt,
  className,
}: {
  cid: number;
  size?: "small" | "large";
  alt: string;
  className?: string;
}) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  const src =
    pubchemStructureUrl(cid, size) +
    (attempt > 0 ? `&_retry=${attempt}` : "");

  const onError = useCallback(() => {
    if (attempt < 1) {
      // One polite retry after PubChem cool-down
      window.setTimeout(() => setAttempt((a) => a + 1), 1200 + Math.random() * 800);
      return;
    }
    setFailed(true);
  }, [attempt]);

  if (failed || !Number.isFinite(cid) || cid <= 0) {
    return (
      <div
        className={
          className ||
          "flex items-center justify-center rounded-lg bg-slate-900/80 text-[10px] text-slate-500"
        }
        role="img"
        aria-label={alt}
        title="Structure image unavailable (PubChem busy or offline)"
      >
        <span className="px-2 text-center leading-snug">
          Structure
          <br />
          unavailable
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={onError}
      referrerPolicy="no-referrer"
    />
  );
}
