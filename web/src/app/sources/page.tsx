import type { Metadata } from "next";
import { CHEMISTRY_API_SOURCES } from "@/lib/sources/registry";

export const metadata: Metadata = {
  title: "API sources",
  description: "Free public chemistry APIs ranked for synthesis and manufacturing intelligence.",
};

const order = ["P0", "P1", "P2"] as const;

export default function SourcesPage() {
  return (
    <div className="w-full p-3 sm:p-4">
      <h1 className="text-3xl font-semibold tracking-tight text-slate-50">API sources</h1>
      <p className="mt-2 max-w-2xl text-slate-400 leading-relaxed">
        Product-ranked free public sources for identity, hazards, reactions, pathways, patents, and
        literature. Full inventory lives in{" "}
        <code className="text-xs text-teal-400">docs/api-sources-manifest.md</code>; enrichment notes
        in <code className="text-xs text-teal-400">docs/chemistry-api-sources.md</code>.
      </p>
      <p className="mt-3 text-sm text-slate-500">
        Free public APIs only. Evidence-first; not regulatory decision support. Manufacturing
        dossiers are curated overlays on top of these sources.
      </p>

      {order.map((priority) => {
        const rows = CHEMISTRY_API_SOURCES.filter((s) => s.priority === priority);
        return (
          <section key={priority} id={`priority-${priority.toLowerCase()}`} className="mt-10">
            <h2 className="text-lg font-semibold text-slate-100 mb-3">
              Priority {priority}
              <span className="ml-2 text-sm font-normal text-slate-500">
                {priority === "P0" && "· Core identity & hazards"}
                {priority === "P1" && "· Reactions, pathways, literature, patents"}
                {priority === "P2" && "· Regulatory & supporting context"}
              </span>
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-900 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-3 py-2">API</th>
                    <th className="px-3 py-2">Org</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Links</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {rows.map((s) => (
                    <tr key={s.id} className="bg-slate-950/40 align-top">
                      <td className="px-3 py-3 font-medium text-slate-200">{s.name}</td>
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{s.organization}</td>
                      <td className="px-3 py-3 text-slate-400 max-w-xs">
                        {s.role}
                        {s.notes && (
                          <div className="mt-1 text-xs text-slate-600">{s.notes}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-teal-400/80 text-xs">{s.category}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs">
                        <a
                          href={s.docsUrl}
                          className="text-teal-400 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Docs
                        </a>
                        <span className="text-slate-700 mx-1">·</span>
                        <a
                          href={s.endpointUrl}
                          className="text-slate-400 hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Endpoint
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <p className="mt-10 text-sm text-slate-500">
        See also the broader BioIntel-style inventory in{" "}
        <code className="text-xs text-slate-400">docs/api-sources-manifest.md</code> (repo root docs).
      </p>
    </div>
  );
}
