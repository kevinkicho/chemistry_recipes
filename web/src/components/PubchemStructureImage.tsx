"use client";

/**
 * PubChem structure image via same-origin proxy.
 * Browser never calls NIH PNG endpoints (no console 503 spam).
 * Proxy retries + returns SVG placeholder on upstream failure.
 */

import { memo, useCallback, useEffect, useState } from "react";
import { pubchemStructureUrl } from "@/lib/api/pubchem";

function PubchemStructureImageInner({
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
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [cid, size]);

  const onError = useCallback(() => {
    // Proxy normally always returns 200 (PNG or SVG). This is a last resort
    // for network blips to our own origin.
    setFailed(true);
  }, []);

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
      src={pubchemStructureUrl(cid, size)}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={onError}
    />
  );
}

export const PubchemStructureImage = memo(PubchemStructureImageInner);
