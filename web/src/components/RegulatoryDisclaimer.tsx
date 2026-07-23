import { REGULATORY_DISCLAIMER } from "@/lib/export/techTransfer";

/** Persistent non-regulatory banner for dossier / export surfaces. */
export function RegulatoryDisclaimer({
  compact = false,
  className = "",
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      role="note"
      className={
        compact
          ? `rounded-md border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-snug text-amber-100/90 ${className}`
          : `rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-100/95 ${className}`
      }
    >
      <span className="font-semibold text-amber-200">Not regulatory decision support. </span>
      {compact
        ? "Not a GMP batch record or filing. Validate under your site QMS."
        : REGULATORY_DISCLAIMER}
    </div>
  );
}
