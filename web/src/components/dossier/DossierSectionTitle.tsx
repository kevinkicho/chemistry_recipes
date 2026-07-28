import { ContentProvenance } from "@/components/ContentProvenance";
import type { AiProvenanceRecord } from "@/lib/dossier/types";
import type { ApiFetchTrace } from "@/lib/api/trace";
import type { SourceRef } from "@/lib/types/process";

export function DossierSectionTitle({
  children,
  ai,
  field,
  pubchemCid,
  traces,
  sourceRefs,
  onRegenerate,
  showAi = true,
}: {
  children: React.ReactNode;
  ai?: AiProvenanceRecord | null;
  field?: string;
  pubchemCid?: number;
  traces?: ApiFetchTrace[];
  sourceRefs?: SourceRef[];
  onRegenerate?: () => void;
  /** When false, hide AI chip even if `ai` is set (API-only sections) */
  showAi?: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <h2 className="text-lg font-semibold text-slate-100">{children}</h2>
      <ContentProvenance
        title={typeof children === "string" ? children : field}
        field={field}
        ai={ai}
        showAi={showAi && Boolean(ai)}
        pubchemCid={pubchemCid}
        traces={traces}
        sourceRefs={sourceRefs}
        onRegenerate={onRegenerate}
      />
    </div>
  );
}
