import { AiProvenance } from "@/components/AiProvenance";
import type { LiveDossier } from "@/lib/dossier/types";

export function DossierSectionTitle({
  children,
  ai,
  field,
}: {
  children: React.ReactNode;
  ai?: LiveDossier["synthesis"]["provenance"];
  field?: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <h2 className="text-lg font-semibold text-slate-100">{children}</h2>
      {ai ? <AiProvenance provenance={ai} field={field} label="AI" /> : null}
    </div>
  );
}
