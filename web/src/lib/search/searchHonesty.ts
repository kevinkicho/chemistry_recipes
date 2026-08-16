/**
 * Search empty vs error vs timeout copy.
 * HTTP 200 + empty hits is not success when upstream failed.
 */

export type SearchSourceChip = {
  source?: string;
  ok: boolean;
  hitCount?: number;
  detail?: string;
};

function isEmptyDetail(detail?: string): boolean {
  const d = (detail || "").trim().toLowerCase();
  return !d || d === "no hit" || d === "empty";
}

/** True when every source failed and at least one failure is not a clean miss. */
export function isFanoutUpstreamFailure(
  status: SearchSourceChip[] | undefined
): boolean {
  if (!status?.length) return false;
  if (status.some((s) => s.ok)) return false;
  return status.some((s) => !isEmptyDetail(s.detail));
}

export function formatFanoutNote(opts: {
  okSources: string[];
  sourceStatus: SearchSourceChip[];
}): string {
  const { okSources, sourceStatus } = opts;
  const errorDetails = sourceStatus.filter(
    (s) => !s.ok && !isEmptyDetail(s.detail)
  );
  if (okSources.length > 1) {
    return `Merged ${okSources.length} free-public sources: ${okSources.join(", ")}`;
  }
  if (okSources.length === 1) {
    return errorDetails.length
      ? `Hits from ${okSources[0]} only — other free sources failed or timed out`
      : `Hits from ${okSources[0]} only — other free sources returned empty`;
  }
  if (errorDetails.length === sourceStatus.length) {
    return "Free-public fan-out failed — not an empty result";
  }
  if (errorDetails.length) {
    return "No free-public hits; some fan-out sources failed";
  }
  return "No free-public hits from fan-out sources";
}

export function formatSearchNoHitsMessage(opts: {
  pubchemFailure?: string | null;
  pubchemOk?: boolean;
  sourceStatus?: SearchSourceChip[];
}): { kind: "empty" | "error"; message: string } {
  const fail = (opts.pubchemFailure || "").trim();
  if (fail || opts.pubchemOk === false) {
    return {
      kind: "error",
      message: fail
        ? `PubChem search failed (${fail}). Not an empty result — retry or try a CID.`
        : "PubChem search failed. Not an empty result — retry or try a CID.",
    };
  }
  if (isFanoutUpstreamFailure(opts.sourceStatus)) {
    const details = (opts.sourceStatus || [])
      .filter((s) => !s.ok && !isEmptyDetail(s.detail))
      .map((s) => s.detail!.trim())
      .slice(0, 3);
    return {
      kind: "error",
      message: details.length
        ? `Free-public fan-out failed (${details.join("; ")}). Not an empty result — retry shortly.`
        : "Free-public fan-out failed. Not an empty result — retry shortly.",
    };
  }
  return {
    kind: "empty",
    message:
      "No free-public hits across identity + process literature sources (PubChem…OpenAlex/Crossref). Try a CID or CAS.",
  };
}

/** HTTP/timeout detail from harvest traces. Clean 404/notFound is not a failure. */
export function failureDetailFromTraces(
  traces?: Array<{
    ok?: boolean;
    notFound?: boolean;
    error?: string;
    httpStatus?: number;
  }>
): string | undefined {
  if (!traces?.length) return undefined;
  const fails = traces.filter((t) => !t.ok && !t.notFound);
  if (!fails.length) return undefined;
  const d = fails[0]!;
  const err = (d.error || "").trim();
  if (err) return err;
  if (d.httpStatus != null) return `HTTP ${d.httpStatus}`;
  return "failed";
}

/** Problem-first status line: count hits, but never call an outage empty. */
export function formatProblemSearchSummary(opts: {
  moleculeCount: number;
  literatureCount: number;
  sourceStatus: SearchSourceChip[];
}): string {
  const counts =
    `${opts.moleculeCount} multi-source molecule${opts.moleculeCount === 1 ? "" : "s"}` +
    ` · ${opts.literatureCount} process paper${opts.literatureCount === 1 ? "" : "s"}`;
  const errorDetails = opts.sourceStatus.filter(
    (s) => !s.ok && !isEmptyDetail(s.detail)
  );
  if (opts.moleculeCount > 0 || opts.literatureCount > 0) {
    return errorDetails.length ? `${counts} · some free sources failed` : counts;
  }
  if (!errorDetails.length) return counts;
  if (errorDetails.length === opts.sourceStatus.length) {
    return "Free-public problem search failed — not an empty result";
  }
  return "No free-public problem hits; some sources failed";
}

