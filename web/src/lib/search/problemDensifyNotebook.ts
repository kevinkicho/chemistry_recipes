/**
 * Persist problem densify run drafts for Markdown notebook export,
 * including campaign agent answer after Workspace handoff return.
 */

import type { ProblemCampaignDensifyResult } from "@/lib/search/problemCampaign";
import type { ProblemSearchHit } from "@/lib/search/problemFirst";
import type { LiteratureHit } from "@/lib/api/europePmc";
import {
  downloadMarkdown,
  formatProblemDensifyRunMarkdown,
} from "@/lib/frontier/exportMarkdown";

const KEY = "cr-problem-densify-notebook-v1";

export interface ProblemDensifyNotebookDraft {
  schema: "chemistry-recipes.problem-densify-notebook.v1";
  problemQuery: string;
  campaignId: string;
  campaignName: string;
  result: ProblemCampaignDensifyResult;
  problemHits: ProblemSearchHit[];
  literatureHits: LiteratureHit[];
  agentQuestion?: string;
  agentAnswer?: string;
  agentInsufficient?: boolean;
  at: string;
  updatedAt: string;
}

function canUse(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function saveProblemDensifyNotebookDraft(
  draft: Omit<ProblemDensifyNotebookDraft, "schema" | "at" | "updatedAt"> & {
    at?: string;
  }
): ProblemDensifyNotebookDraft {
  const now = new Date().toISOString();
  const row: ProblemDensifyNotebookDraft = {
    schema: "chemistry-recipes.problem-densify-notebook.v1",
    problemQuery: draft.problemQuery,
    campaignId: draft.campaignId,
    campaignName: draft.campaignName,
    result: draft.result,
    problemHits: draft.problemHits.slice(0, 24),
    literatureHits: draft.literatureHits.slice(0, 20),
    agentQuestion: draft.agentQuestion,
    agentAnswer: draft.agentAnswer,
    agentInsufficient: draft.agentInsufficient,
    at: draft.at || now,
    updatedAt: now,
  };
  if (canUse()) {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(row));
    } catch {
      /* quota */
    }
  }
  return row;
}

export function loadProblemDensifyNotebookDraft(): ProblemDensifyNotebookDraft | null {
  if (!canUse()) return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as ProblemDensifyNotebookDraft;
    if (!p?.campaignId || !p?.result) return null;
    return p;
  } catch {
    return null;
  }
}

export function appendAgentAnswerToNotebookDraft(opts: {
  campaignId: string;
  question: string;
  answer: string;
  insufficientEvidence?: boolean;
}): ProblemDensifyNotebookDraft | null {
  const prev = loadProblemDensifyNotebookDraft();
  if (!prev || prev.campaignId !== opts.campaignId) return null;
  return saveProblemDensifyNotebookDraft({
    ...prev,
    agentQuestion: opts.question,
    agentAnswer: opts.answer,
    agentInsufficient: opts.insufficientEvidence,
  });
}

export function exportProblemDensifyNotebookFromDraft(
  draft?: ProblemDensifyNotebookDraft | null
): boolean {
  const d = draft || loadProblemDensifyNotebookDraft();
  if (!d) return false;
  const md = formatProblemDensifyRunMarkdown({
    problemQuery: d.problemQuery,
    result: d.result,
    problemHits: d.problemHits,
    literatureHits: d.literatureHits,
    agentAnswer: d.agentAnswer
      ? [
          d.agentQuestion ? `**Q:** ${d.agentQuestion}` : null,
          d.agentInsufficient
            ? "_Insufficient free-public evidence flagged._"
            : null,
          d.agentAnswer,
        ]
          .filter(Boolean)
          .join("\n\n")
      : undefined,
  });
  const slug = d.problemQuery
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40);
  downloadMarkdown(`problem-densify-${slug || d.campaignId}.md`, md);
  return true;
}
