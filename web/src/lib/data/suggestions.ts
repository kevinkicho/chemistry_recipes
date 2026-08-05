/** Search suggestion row for the combobox dropdown. */

export type SuggestKind =
  | "history"
  | "pubchem"
  | "cid"
  | "rxnorm"
  | "openfda"
  | "chembl"
  | "multi";

export interface SuggestItem {
  value: string;
  detail?: string;
  kind: SuggestKind;
  /** Optional deep link (e.g. compound card) */
  href?: string;
}
