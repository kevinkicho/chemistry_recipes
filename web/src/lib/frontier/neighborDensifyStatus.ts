/**
 * Honest science-agent neighbor densify copy.
 * warmLiveDossier / buildLiveDossier returns null on stream/HTTP failure —
 * the UI must not say "none needed" when the live call failed.
 */

export function formatNeighborDensifyStatus(opts: {
  requested: boolean;
  okCids: number[];
  failCids: number[];
}): string {
  if (!opts.requested) return "Neighbor densify: off";
  const ok = opts.okCids.filter((c) => Number.isFinite(c) && c > 0);
  const fail = opts.failCids.filter((c) => Number.isFinite(c) && c > 0);
  if (!ok.length && !fail.length) {
    return "Neighbor densify: none needed or none available";
  }
  if (ok.length && !fail.length) {
    return `Neighbors densified: ${ok.join(", ")}`;
  }
  const failBits = fail.map((c) => `CID ${c}`).join(", ");
  if (!ok.length) {
    return `Neighbor densify failed — ${failBits}. Stream did not return a dossier.`;
  }
  return `Neighbor densify partial — ${ok.length} ok (${ok.join(", ")}), ${fail.length} fail (${failBits}).`;
}
