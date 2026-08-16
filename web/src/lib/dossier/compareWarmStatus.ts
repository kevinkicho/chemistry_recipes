/**
 * Honest compare warm summary. warmLiveDossier returns null on stream/HTTP
 * failure without throwing — callers must not claim complete.
 */

export type CompareWarmOutcome = {
  side: string;
  cid: number;
  ok: boolean;
  lastStatus?: string;
};

export function formatCompareWarmStatus(
  outcomes: CompareWarmOutcome[]
): string {
  const ok = outcomes.filter((o) => o.ok);
  const fail = outcomes.filter((o) => !o.ok);
  if (!fail.length) {
    if (ok.length >= 2) {
      return "Warm complete — both sides loaded, dual export ready.";
    }
    if (ok.length === 1) {
      return `Warm complete — CID ${ok[0].cid} loaded. Other side needs a PubChem CID to warm.`;
    }
    return "Warm failed — no CID dossiers returned.";
  }
  const failBits = fail
    .map((o) => {
      const detail = (o.lastStatus || "").trim();
      return detail
        ? `${o.side} CID ${o.cid} (${detail})`
        : `${o.side} CID ${o.cid}`;
    })
    .join("; ");
  if (!ok.length) {
    return `Warm failed — ${failBits}. Stream did not return a dossier.`;
  }
  return `Warm partial — ${ok.length} ok, ${fail.length} fail (${failBits}). Dual export needs both sides.`;
}
