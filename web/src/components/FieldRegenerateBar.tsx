"use client";

/**
 * Field-level regenerate affordance — full refresh today; labels which field
 * the worker cares about. Future: partial AI fields when server supports them.
 */

export function FieldRegenerateBar({
  field,
  onRegenerate,
  denseNote,
}: {
  field: string;
  onRegenerate?: () => void;
  denseNote?: string;
}) {
  if (!onRegenerate) return null;
  return (
    <div className="print:hidden mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-violet-500/25 bg-violet-500/5 px-2.5 py-1.5 text-[11px] text-slate-500">
      <span>
        Regenerate focus: <strong className="font-medium text-violet-200/90">{field}</strong>
        {denseNote ? ` · ${denseNote}` : " · re-runs free APIs + full Ollama package"}
      </span>
      <button
        type="button"
        onClick={onRegenerate}
        className="rounded border border-violet-500/40 bg-violet-950/50 px-2 py-0.5 font-medium text-violet-100 hover:bg-violet-900/40"
      >
        Regenerate
      </button>
    </div>
  );
}
