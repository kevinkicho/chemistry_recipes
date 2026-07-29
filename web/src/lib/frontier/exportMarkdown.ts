/**
 * Notebook-ready Markdown export for process-knowledge, campaign brief, atlas.
 * Free-public research notes only — not GMP batch records.
 */

import type { LiveDossier } from "@/lib/dossier/types";
import type { ProcessKnowledgePackage } from "@/lib/frontier/types";
import type { CampaignScientificBrief } from "@/lib/frontier/campaignBrief";
import type { CampaignKnowledgeExport } from "@/lib/frontier/campaignExport";
import type { CampaignRouteHypothesesPackage } from "@/lib/frontier/campaignRouteHypotheses";
import type { LiteratureDepthReport } from "@/lib/frontier/literatureDepth";
import { buildLiteratureDepthReport } from "@/lib/frontier/literatureDepth";
import { buildProcessKnowledgePackage } from "@/lib/frontier/buildKnowledge";
import type { CampaignIdealRollup } from "@/lib/frontier/campaignIdealRollup";
import type { ProblemCampaignDensifyResult } from "@/lib/search/problemCampaign";
import type { ProblemSearchHit } from "@/lib/search/problemFirst";
import type { LiteratureHit } from "@/lib/api/europePmc";

function h(level: number, text: string): string {
  return `${"#".repeat(level)} ${text}\n`;
}

function bullets(lines: string[]): string {
  if (!lines.length) return "_None._\n";
  return lines.map((l) => `- ${l}`).join("\n") + "\n";
}

/**
 * Markdown for a single-CID process-knowledge package (+ optional lit depth).
 */
export function formatProcessKnowledgeMarkdown(
  pack: ProcessKnowledgePackage,
  opts?: { literatureDepth?: LiteratureDepthReport }
): string {
  const atlas = pack.conditionAtlas;
  const parts: string[] = [];
  parts.push(h(1, `Process knowledge · ${pack.moleculeName || `CID ${pack.cid}`}`));
  parts.push(`> ${pack.disclaimer}\n`);
  parts.push(
    `**Generated:** ${pack.generatedAt} · **Schema:** \`${pack.schema}\` · **CID:** ${pack.cid}\n`
  );
  parts.push(h(2, "Metrics"));
  parts.push(
    bullets([
      `Condition observations: ${pack.metrics.observationCount}`,
      `Route hypotheses: ${pack.metrics.hypothesisCount}`,
      `Conflicts: ${pack.metrics.conflictCount}`,
      `Next experiments: ${pack.metrics.experimentCount}`,
      `Procedure chars: ${pack.metrics.procedureChars}`,
      `Network: ${pack.metrics.networkNodes ?? 0} nodes / ${pack.metrics.networkEdges ?? 0} edges`,
    ])
  );

  if (opts?.literatureDepth) {
    const ld = opts.literatureDepth;
    parts.push(h(2, "Literature densify depth"));
    parts.push(`${ld.summary}\n`);
    parts.push(
      bullets(
        ld.topWindows.slice(0, 8).map(
          (w) =>
            `**${w.kind}** score ${w.score} · ${w.chars} chars · ${w.label}${
              w.url ? ` · [source](${w.url})` : ""
            }`
        )
      )
    );
  }

  parts.push(h(2, "Condition atlas"));
  parts.push(`${atlas.summary}\n`);
  for (const d of atlas.distributions) {
    parts.push(h(3, d.kind));
    parts.push(`${d.summary}\n`);
    if (d.conflict) {
      parts.push(`**Conflict:** ${d.conflictNote || "non-overlapping ranges"}\n`);
    }
    for (const o of d.observations.slice(0, 5)) {
      parts.push(
        `- \`${o.raw}\` — “${o.quote.slice(0, 160)}” — *${o.sourceLabel}*`
      );
    }
    parts.push("");
  }

  if (atlas.solvents.length) {
    parts.push(h(3, "Solvents (observed)"));
    parts.push(
      bullets(atlas.solvents.slice(0, 10).map((s) => `${s.name} (n=${s.n})`))
    );
  }

  parts.push(h(2, "Route hypotheses"));
  for (const rh of pack.routeHypotheses.slice(0, 8)) {
    parts.push(
      h(3, `${rh.name} · ${rh.status} · score ${rh.evidenceScore}`)
    );
    parts.push(`${rh.summary}\n`);
    for (const st of rh.steps.slice(0, 8)) {
      parts.push(`1. **${st.title}** — ${st.summary.slice(0, 200)}`);
    }
    parts.push("");
    if (rh.killCriteria.length) {
      parts.push("**Kill criteria**");
      parts.push(bullets(rh.killCriteria));
    }
  }

  parts.push(h(2, "Scientific conflicts"));
  parts.push(
    bullets(
      pack.conflicts.slice(0, 10).map(
        (c) => `**${c.topic}** (${c.kind}): ${c.sideA} vs ${c.sideB}`
      )
    )
  );

  parts.push(h(2, "Next experiments"));
  parts.push(
    bullets(
      pack.nextExperiments
        .slice(0, 10)
        .map((e) => `**[${e.priority}]** ${e.question} — _${e.gap}_`)
    )
  );

  parts.push(h(2, "Seed Q&A"));
  for (const a of pack.seedAnswers.slice(0, 6)) {
    parts.push(h(3, a.question));
    parts.push(
      a.insufficientEvidence
        ? `⚠ Insufficient evidence\n\n${a.answer}\n`
        : `${a.answer}\n`
    );
  }

  return parts.join("\n");
}

export function formatCampaignBriefMarkdown(
  brief: CampaignScientificBrief
): string {
  const parts: string[] = [];
  parts.push(
    h(1, `Campaign scientific brief · ${brief.campaignName || "campaign"}`)
  );
  parts.push(`> ${brief.disclaimer}\n`);
  parts.push(`${brief.summary}\n`);
  parts.push(h(2, "Metrics"));
  parts.push(
    bullets([
      `Depth score: **${brief.depthScore}/100**`,
      `Densified: ${brief.metrics.cachedCount}/${brief.metrics.requestedCount}`,
      `Observations: ${brief.metrics.totalObservations}`,
      `Condition kinds: ${brief.metrics.conditionKinds}`,
      `Cross-CID conflicts: ${brief.metrics.crossCidConflicts}`,
      `Network edges: ${brief.metrics.networkEdges}`,
      `Thin CIDs: ${brief.metrics.thinCidCount}`,
    ])
  );

  parts.push(h(2, "Condition landscape"));
  parts.push(bullets(brief.conditionLandscape));

  parts.push(h(2, "Per-CID condition spans"));
  parts.push(
    bullets(
      brief.crossCidSpans.map(
        (s) =>
          `CID **${s.cid}** ${s.name || ""} · **${s.kind}** · ${
            s.min != null && s.max != null
              ? `${s.min}–${s.max}${s.unit ? ` ${s.unit}` : ""}`
              : "—"
          } (n=${s.n})`
      )
    )
  );

  parts.push(h(2, "Cross-CID range conflicts"));
  if (!brief.crossCidConflicts.length) {
    parts.push("_No non-overlapping numeric conflicts detected._\n");
  } else {
    for (const c of brief.crossCidConflicts) {
      parts.push(
        `- **${c.kind}**: CID ${c.cidA} \`${c.rangeA}\` vs CID ${c.cidB} \`${c.rangeB}\` — ${c.note}`
      );
    }
    parts.push("");
  }

  parts.push(h(2, "Research experiments"));
  parts.push(
    bullets(
      brief.topExperiments.map(
        (e) => `**[${e.priority}]** ${e.question} — _${e.gap}_`
      )
    )
  );

  parts.push(h(2, "Open gaps"));
  parts.push(bullets(brief.openGaps));

  return parts.join("\n");
}

export function formatCampaignRoutesMarkdown(
  routes: CampaignRouteHypothesesPackage
): string {
  const parts: string[] = [];
  parts.push(
    h(1, `Campaign route hypotheses · ${routes.campaignName || "campaign"}`)
  );
  parts.push(`> ${routes.disclaimer}\n`);
  parts.push(`${routes.summary}\n`);
  parts.push(h(2, "Shared multi-CID steps"));
  parts.push(
    bullets(
      routes.sharedSteps
        .filter((s) => s.n >= 2)
        .map(
          (s) =>
            `**${s.label}** · ${s.n} CIDs (${s.cids.join(", ")})${
              s.unitOp ? ` · unit-op \`${s.unitOp}\`` : ""
            }`
        )
    )
  );
  for (const h0 of routes.hypotheses) {
    parts.push(h(2, h0.name));
    parts.push(
      `Status: \`${h0.status}\` · coverage ${h0.coverageCids} · score ${h0.evidenceScore}\n`
    );
    parts.push(`${h0.summary}\n`);
    parts.push(h(3, "Shared steps"));
    parts.push(
      bullets(h0.sharedSteps.map((s) => `${s.label} (CIDs ${s.cids.join(", ")})`))
    );
    parts.push(h(3, "Kill criteria"));
    parts.push(bullets(h0.killCriteria));
    parts.push(h(3, "Open questions"));
    parts.push(bullets(h0.openQuestions));
  }
  return parts.join("\n");
}

export function formatCampaignKnowledgeMarkdown(
  data: CampaignKnowledgeExport
): string {
  const parts: string[] = [];
  parts.push(h(1, `Campaign knowledge · ${data.campaign.name}`));
  parts.push(`> ${data.disclaimer}\n`);
  parts.push(
    `**Exported:** ${data.exportedAt} · **Schema:** \`${data.schema}\`\n`
  );
  parts.push(`${data.summary}\n`);
  parts.push(h(2, "CIDs"));
  parts.push(
    bullets(
      data.statuses.map(
        (s) =>
          `CID **${s.cid}** ${s.name || ""} · cached=${s.cached} · obs=${
            s.observationCount ?? 0
          } · ideal=${s.idealScore ?? "—"}`
      )
    )
  );

  if (data.scientificBrief) {
    parts.push(formatCampaignBriefMarkdown(data.scientificBrief));
  }

  if (data.routeHypotheses) {
    parts.push(formatCampaignRoutesMarkdown(data.routeHypotheses));
  }

  if (data.idealRollup) {
    parts.push(formatCampaignIdealRollupMarkdown(data.idealRollup));
  }

  if (data.agentRun) {
    parts.push(h(2, "Agent run"));
    parts.push(`**Q:** ${data.agentRun.question}\n`);
    parts.push(`${data.agentRun.answer.answer}\n`);
    if (data.agentRun.answer.insufficientEvidence) {
      parts.push("_Insufficient free-public evidence flagged._\n");
    }
  }

  parts.push(h(2, "Merged condition atlas kinds"));
  parts.push(
    bullets(data.atlasByKind.map((d) => `**${d.kind}** · ${d.summary}`))
  );

  parts.push(h(2, "Network"));
  parts.push(
    bullets([
      `Nodes: ${data.metrics.networkNodes}`,
      `Edges: ${data.metrics.networkEdges}`,
      `Packages: ${data.metrics.packageCount}`,
    ])
  );

  return parts.join("\n");
}

/** Full single-CID notebook markdown from live dossier */
export function formatLiveDossierScienceMarkdown(dossier: LiveDossier): string {
  const pack =
    dossier.processKnowledge || buildProcessKnowledgePackage(dossier);
  const lit = buildLiteratureDepthReport(dossier);
  return formatProcessKnowledgeMarkdown(pack, { literatureDepth: lit });
}

export function formatCampaignIdealRollupMarkdown(
  rollup: CampaignIdealRollup
): string {
  const parts: string[] = [];
  parts.push(
    h(1, `Campaign ideal rollup · ${rollup.campaignName || "campaign"}`)
  );
  parts.push(`> ${rollup.disclaimer}\n`);
  parts.push(`${rollup.summary}\n`);
  parts.push(h(2, "Scores"));
  parts.push(
    bullets([
      `Mean: **${rollup.meanScore}/100**`,
      `Min / max: ${rollup.minScore} / ${rollup.maxScore}`,
      `Densified: ${rollup.densifiedCount}/${rollup.requestedCount}`,
    ])
  );
  parts.push(h(2, "Per-CID ideal (weak first)"));
  parts.push(
    bullets(
      rollup.rows.map(
        (r) =>
          `CID **${r.cid}** ${r.name || ""} · **${r.score}/100** · filled ${r.filledCount}/${r.totalCount}` +
          (r.weakSections[0]
            ? ` · weak: ${r.weakSections.map((w) => w.label).join(", ")}`
            : "")
      )
    )
  );
  parts.push(h(2, "Section heatmap (weakest mean first)"));
  parts.push(
    bullets(
      rollup.sections.map(
        (s) =>
          `**${s.label}** · mean ${s.meanDepth}/100 · weak CIDs: ${
            s.weakCids.join(", ") || "—"
          }`
      )
    )
  );
  if (rollup.systemicGaps.length) {
    parts.push(h(2, "Systemic gaps"));
    parts.push(bullets(rollup.systemicGaps));
  }
  return parts.join("\n");
}

export function downloadMarkdown(filename: string, markdown: string): void {
  const name = filename.endsWith(".md") ? filename : `${filename}.md`;
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Notebook Markdown for a problem → campaign densify run.
 */
export function formatProblemDensifyRunMarkdown(opts: {
  problemQuery: string;
  result: ProblemCampaignDensifyResult;
  problemHits?: ProblemSearchHit[];
  literatureHits?: LiteratureHit[];
  agentAnswer?: string;
}): string {
  const { problemQuery, result, problemHits, literatureHits, agentAnswer } =
    opts;
  const camp = result.campaign;
  const parts: string[] = [];
  parts.push(h(1, `Problem densify run · ${problemQuery}`));
  parts.push(
    `> Free-public multi-source densify notebook. Not GMP. Not plant setpoints.\n`
  );
  parts.push(`**Exported:** ${new Date().toISOString()}\n`);
  parts.push(h(2, "Campaign"));
  parts.push(
    bullets([
      `Name: **${camp.name}**`,
      `Id: \`${camp.id}\``,
      `CIDs: ${result.queueCids.join(", ")}`,
      `Densify: ${result.densify.ok} ok / ${result.densify.fail} fail · ${Math.round(result.densify.durationMs / 1000)}s`,
      result.literatureAttached
        ? `Literature pastes: ${result.literatureAttached} · ${result.literatureChars.toLocaleString()} chars`
        : "Literature pastes: none",
      result.literatureSummary || "",
    ].filter(Boolean))
  );

  if (problemHits?.length) {
    parts.push(h(2, "Problem hits (unified)"));
    parts.push(
      bullets(
        problemHits.slice(0, 20).map(
          (hit) =>
            `**${hit.title}** · ${hit.kind} · score ${hit.score}` +
            (hit.subtitle ? ` — ${hit.subtitle}` : "") +
            (hit.href ? ` · [link](${hit.href})` : "")
        )
      )
    );
  }

  if (literatureHits?.length) {
    parts.push(h(2, "Process literature attached / considered"));
    parts.push(
      bullets(
        literatureHits.slice(0, 16).map(
          (lit) =>
            `**${lit.title.slice(0, 100)}** · ${lit.source}` +
            (lit.year ? ` · ${lit.year}` : "") +
            (lit.url ? ` · [open](${lit.url})` : "")
        )
      )
    );
  }

  parts.push(h(2, "Densify results"));
  parts.push(
    bullets(
      (result.densify.results || []).map((r) => {
        const sum = r.summary;
        return `CID **${r.cid}** · ${r.ok ? "ok" : r.error || "fail"}` +
          (sum
            ? ` · ideal ${sum.idealScore ?? "—"} · obs ${sum.observationCount ?? "—"} · ${sum.name || ""}`
            : "");
      })
    )
  );

  if (agentAnswer) {
    parts.push(h(2, "Campaign agent answer"));
    parts.push(`${agentAnswer}\n`);
  }

  parts.push(h(2, "Next steps"));
  parts.push(
    bullets([
      "Open Workspace → campaign brief / ideal rollup",
      "Ask campaign agent edge / temperature questions",
      "Paste additional public procedure text on thin CIDs",
    ])
  );

  return parts.join("\n");
}
