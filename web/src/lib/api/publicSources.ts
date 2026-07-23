/**
 * Free public data policy: governmental, inter-governmental, educational,
 * and research-organization sources only. No paid / commercial DB APIs.
 */

/** Host suffixes allowed for deep links and API endpoints in provenance. */
export const FREE_PUBLIC_HOST_SUFFIXES = [
  // U.S. government / NIH / FDA / EPA
  "nih.gov",
  "nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "pubchem.ncbi.nlm.nih.gov",
  "fda.gov",
  "open.fda.gov",
  "epa.gov",
  "data.gov",
  "cms.gov",
  "medicaid.gov",
  "clinicaltrials.gov",
  "uspto.gov",
  "patentsview.org",
  "nsf.gov",
  "sec.gov",
  // EMBL-EBI / Europe research
  "ebi.ac.uk",
  "ebi.ac.uk",
  "europepmc.org",
  "uniprot.org",
  "rhea-db.org",
  "reactome.org",
  "chembl.ebi.ac.uk",
  // Kyoto / pathway
  "kegg.jp",
  "genome.jp",
  // Scholarly open infrastructure
  "openalex.org",
  "api.openalex.org",
  "crossref.org",
  "doi.org",
  "orcid.org",
  "wikidata.org",
  "wikipedia.org",
  "arxiv.org",
  // EU / other public
  "ema.europa.eu",
  "europa.eu",
] as const;

export function isFreePublicUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return FREE_PUBLIC_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`)
    );
  } catch {
    return false;
  }
}

export function assertFreePublicUrl(url: string): string | null {
  return isFreePublicUrl(url) ? url : null;
}
