/**
 * ~100 curated educational process packages for the recipe hub.
 *
 * These are NOT GMP packages, batch records, or validated procedures.
 * Each entry is a structured scaffold: identity + modality + parameter set +
 * live PubChem path when available + optional Tier-A deep dossier link.
 */

import type {
  ContentTier,
  EntityRole,
  ProcessModality,
  ScaleClass,
} from "@/lib/types/process";
import { getExampleById } from "@/lib/data/examples";
import { routes } from "@/lib/routes";

export const PACKAGE_CATALOG_DISCLAIMER =
  "Curated educational process packages (scaffolds). Not GMP, not validated plant packages, " +
  "not regulatory filings. Literature-typical parameters are teaching envelopes only. " +
  "Validate under your site QMS before any manufacturing use.";

export type PackageDepth = "deep" | "standard" | "pointer";

export interface CuratedPackage {
  id: string;
  name: string;
  /** Educational tier — A deep curated dossier, B structured scaffold, C identity pointer */
  tier: ContentTier;
  depth: PackageDepth;
  modality: ProcessModality;
  entityRole: EntityRole;
  cas?: string;
  unii?: string;
  formula?: string;
  pubchemCid?: number;
  /** Link to /examples/[id] when deep dossier exists */
  exampleId?: string;
  summary: string;
  tags: string[];
  scaleHints?: ScaleClass[];
  /** Key into PARAMETER_SETS */
  parameterSetId: string;
  related?: Array<{ role: EntityRole; name: string; cas?: string; pubchemCid?: number }>;
}

type Seed = Omit<CuratedPackage, "id" | "parameterSetId" | "depth" | "tier"> & {
  id?: string;
  tier?: ContentTier;
  depth?: PackageDepth;
  parameterSetId?: string;
};

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function pack(s: Seed): CuratedPackage {
  const modality = s.modality;
  const parameterSetId = s.parameterSetId || modality;
  const id = s.id || `pkg-${slug(s.name)}`;
  const depth: PackageDepth =
    s.depth || (s.exampleId ? "deep" : s.pubchemCid ? "standard" : "pointer");
  const tier: ContentTier = s.tier || (s.exampleId ? "A" : s.pubchemCid ? "B" : "C");
  return {
    id,
    name: s.name,
    tier,
    depth,
    modality,
    entityRole: s.entityRole,
    cas: s.cas,
    unii: s.unii,
    formula: s.formula,
    pubchemCid: s.pubchemCid,
    exampleId: s.exampleId,
    summary: s.summary,
    tags: s.tags,
    scaleHints: s.scaleHints,
    parameterSetId,
    related: s.related,
  };
}

/**
 * Master seed list (~100). CIDs are public PubChem identifiers for live linkage.
 */
const SEEDS: Seed[] = [
  // ── Deep Tier-A (linked to full example dossiers) ─────────────
  {
    name: "Aspirin",
    exampleId: "aspirin",
    pubchemCid: 2244,
    cas: "50-78-2",
    formula: "C9H8O4",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["api", "analgesic", "acetylation"],
    summary: "Industrial acetylation of salicylic acid — dual-view Tier-A dossier.",
    scaleHints: ["kilo", "pilot", "commercial"],
    related: [
      { role: "starting-material", name: "Salicylic acid", cas: "69-72-7", pubchemCid: 338 },
      { role: "reagent", name: "Acetic anhydride", cas: "108-24-7", pubchemCid: 7918 },
    ],
  },
  {
    name: "Ibuprofen",
    exampleId: "ibuprofen",
    pubchemCid: 3672,
    cas: "15687-27-1",
    formula: "C13H18O2",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["api", "nsaid", "bhc"],
    summary: "High-volume NSAID API — industrial route themes.",
  },
  {
    name: "Paracetamol",
    exampleId: "paracetamol",
    pubchemCid: 1983,
    cas: "103-90-2",
    formula: "C8H9NO2",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["api", "analgesic"],
    summary: "4-Aminophenol acetylation — impurity control teaching case.",
  },
  {
    name: "Menthol",
    exampleId: "menthol",
    pubchemCid: 16666,
    cas: "2216-51-5",
    formula: "C10H20O",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["api", "terpene"],
    summary: "Natural isolation vs synthetic routes.",
  },
  {
    name: "Metformin",
    exampleId: "metformin",
    pubchemCid: 4091,
    cas: "657-24-9",
    formula: "C4H11N5",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["api", "biguanide"],
    summary: "Biguanide API with oral solid DP linkage.",
  },
  {
    name: "Caffeine",
    exampleId: "caffeine",
    pubchemCid: 2519,
    cas: "58-08-2",
    formula: "C8H10N4O2",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["api", "extraction", "synthetic"],
    summary: "Extraction vs synthetic methylation themes.",
  },
  {
    name: "Ethanol",
    exampleId: "ethanol",
    pubchemCid: 702,
    cas: "64-17-5",
    formula: "C2H6O",
    modality: "fermentation",
    entityRole: "solvent",
    tags: ["solvent", "fermentation", "utility"],
    summary: "Fermentation + distillation solvent package.",
  },
  {
    name: "Amoxicillin",
    exampleId: "amoxicillin",
    pubchemCid: 33613,
    cas: "26787-78-0",
    formula: "C16H19N3O5S",
    modality: "fermentation",
    entityRole: "api",
    tags: ["beta-lactam", "biocatalytic", "api"],
    summary: "Enzymatic acylation of 6-APA — β-lactam suite teaching.",
  },
  {
    name: "Sitagliptin",
    exampleId: "sitagliptin",
    pubchemCid: 4369359,
    cas: "486460-32-6",
    formula: "C16H15F6N5O",
    modality: "small-molecule",
    entityRole: "api",
    tags: ["api", "biocatalytic", "dpp-4"],
    summary: "Biocatalytic vs chemical asymmetric route comparison.",
  },
  {
    name: "Penicillin G",
    exampleId: "penicillin-g",
    pubchemCid: 5904,
    cas: "61-33-6",
    formula: "C16H18N2O4S",
    modality: "fermentation",
    entityRole: "api",
    tags: ["beta-lactam", "fermentation"],
    summary: "Aerobic fermentation + extraction; gateway to 6-APA.",
  },

  // ── Small-molecule APIs (standard scaffolds) ──────────────────
  { name: "Atorvastatin", pubchemCid: 60823, cas: "134523-00-5", formula: "C33H35FN2O5", modality: "small-molecule", entityRole: "api", tags: ["statin", "api"], summary: "HMG-CoA reductase inhibitor API process scout." },
  { name: "Rosuvastatin", pubchemCid: 446157, cas: "287714-41-4", formula: "C22H28FN3O6S", modality: "small-molecule", entityRole: "api", tags: ["statin", "api"], summary: "Statin API with complex stereochemistry themes." },
  { name: "Simvastatin", pubchemCid: 54454, cas: "79902-63-9", formula: "C25H38O5", modality: "small-molecule", entityRole: "api", tags: ["statin", "semi-synthetic"], summary: "Semi-synthetic statin from fermentation-derived precursor themes." },
  { name: "Oseltamivir", pubchemCid: 65028, cas: "196618-13-0", formula: "C16H28N2O4", modality: "small-molecule", entityRole: "api", tags: ["antiviral", "api"], summary: "Neuraminidase inhibitor; shikimate / process chemistry case." },
  { name: "Remdesivir", pubchemCid: 121304016, cas: "1809249-37-3", formula: "C27H35N6O8P", modality: "small-molecule", entityRole: "api", tags: ["antiviral", "prodrug", "nucleotide"], summary: "Nucleotide prodrug API — multi-step process literature." },
  { name: "Apixaban", pubchemCid: 10182969, cas: "503612-47-3", formula: "C25H25N5O4", modality: "small-molecule", entityRole: "api", tags: ["anticoagulant", "api"], summary: "Factor Xa inhibitor API route scouting." },
  { name: "Rivaroxaban", pubchemCid: 9875401, cas: "366789-02-8", formula: "C19H18ClN3O5S", modality: "small-molecule", entityRole: "api", tags: ["anticoagulant", "api"], summary: "Oral anticoagulant API process scaffold." },
  { name: "Sertraline", pubchemCid: 68617, cas: "79617-96-2", formula: "C17H17Cl2N", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "SSRI API industrial chemistry literature." },
  { name: "Fluoxetine", pubchemCid: 3386, cas: "54910-89-3", formula: "C17H18F3NO", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "SSRI API process package scaffold." },
  { name: "Venlafaxine", pubchemCid: 5656, cas: "93413-69-5", formula: "C17H27NO2", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "SNRI API manufacturing literature pointer." },
  { name: "Omeprazole", pubchemCid: 4594, cas: "73590-58-6", formula: "C17H19N3O3S", modality: "small-molecule", entityRole: "api", tags: ["ppi", "api"], summary: "Proton pump inhibitor; sulfoxide stereochemistry themes." },
  { name: "Pantoprazole", pubchemCid: 4679, cas: "102625-70-7", formula: "C16H15F2N3O4S", modality: "small-molecule", entityRole: "api", tags: ["ppi", "api"], summary: "PPI API process scaffold." },
  { name: "Losartan", pubchemCid: 3961, cas: "114798-26-4", formula: "C22H23ClN6O", modality: "small-molecule", entityRole: "api", tags: ["arb", "api"], summary: "ARB antihypertensive API." },
  { name: "Valsartan", pubchemCid: 60846, cas: "137862-53-4", formula: "C24H29N5O3", modality: "small-molecule", entityRole: "api", tags: ["arb", "api", "nitrosa-theme"], summary: "ARB API — impurity control teaching relevance." },
  { name: "Amlodipine", pubchemCid: 2162, cas: "88150-42-9", formula: "C20H25ClN2O5", modality: "small-molecule", entityRole: "api", tags: ["ccb", "api"], summary: "Dihydropyridine CCB API." },
  { name: "Lisinopril", pubchemCid: 5362119, cas: "83915-83-7", formula: "C21H31N3O5", modality: "small-molecule", entityRole: "api", tags: ["acei", "api"], summary: "ACE inhibitor peptide-like small molecule." },
  { name: "Enalapril", pubchemCid: 5388962, cas: "75847-73-3", formula: "C20H28N2O5", modality: "small-molecule", entityRole: "api", tags: ["acei", "api"], summary: "ACE inhibitor prodrug API." },
  { name: "Clopidogrel", pubchemCid: 60606, cas: "113665-84-2", formula: "C16H16ClNO2S", modality: "small-molecule", entityRole: "api", tags: ["antiplatelet", "api"], summary: "Thienopyridine prodrug API." },
  { name: "Warfarin", pubchemCid: 54678486, cas: "81-81-2", formula: "C19H16O4", modality: "small-molecule", entityRole: "api", tags: ["anticoagulant", "api"], summary: "Coumarin anticoagulant API." },
  { name: "Dexamethasone", pubchemCid: 5743, cas: "50-02-2", formula: "C22H29FO5", modality: "small-molecule", entityRole: "api", tags: ["steroid", "api"], summary: "Corticosteroid API / semi-synthetic themes." },
  { name: "Prednisone", pubchemCid: 5865, cas: "53-03-2", formula: "C21H26O5", modality: "small-molecule", entityRole: "api", tags: ["steroid", "api"], summary: "Corticosteroid API process scaffold." },
  { name: "Hydrocortisone", pubchemCid: 5754, cas: "50-23-7", formula: "C21H30O5", modality: "small-molecule", entityRole: "api", tags: ["steroid", "api"], summary: "Corticosteroid from fermentation/semi-synthesis themes." },
  { name: "Paclitaxel", pubchemCid: 36314, cas: "33069-62-4", formula: "C47H51NO14", modality: "small-molecule", entityRole: "api", tags: ["oncology", "semi-synthesis", "api"], summary: "Complex natural product / semi-synthetic oncology API." },
  { name: "Docetaxel", pubchemCid: 148124, cas: "114977-28-5", formula: "C43H53NO14", modality: "small-molecule", entityRole: "api", tags: ["oncology", "api"], summary: "Taxane oncology API scaffold." },
  { name: "Imatinib", pubchemCid: 5291, cas: "152459-95-5", formula: "C29H31N7O", modality: "small-molecule", entityRole: "api", tags: ["oncology", "tki", "api"], summary: "BCR-ABL TKI API process literature." },
  { name: "Erlotinib", pubchemCid: 176870, cas: "183321-74-6", formula: "C22H23N3O4", modality: "small-molecule", entityRole: "api", tags: ["oncology", "tki", "api"], summary: "EGFR TKI API." },
  { name: "Gefitinib", pubchemCid: 123631, cas: "184475-35-2", formula: "C22H24ClFN4O3", modality: "small-molecule", entityRole: "api", tags: ["oncology", "tki", "api"], summary: "EGFR TKI API process scaffold." },
  { name: "Sildenafil", pubchemCid: 5212, cas: "139755-83-2", formula: "C22H30N6O4S", modality: "small-molecule", entityRole: "api", tags: ["api", "pde5"], summary: "PDE5 inhibitor API multi-step synthesis themes." },
  { name: "Tadalafil", pubchemCid: 110635, cas: "171596-29-5", formula: "C22H19N3O4", modality: "small-molecule", entityRole: "api", tags: ["api", "pde5"], summary: "PDE5 inhibitor API." },
  { name: "Montelukast", pubchemCid: 5281040, cas: "158966-92-8", formula: "C35H36ClNO3S", modality: "small-molecule", entityRole: "api", tags: ["api", "respiratory"], summary: "Leukotriene receptor antagonist API." },
  { name: "Cetirizine", pubchemCid: 2678, cas: "83881-51-0", formula: "C21H25ClN2O3", modality: "small-molecule", entityRole: "api", tags: ["api", "antihistamine"], summary: "Second-generation antihistamine API." },
  { name: "Loratadine", pubchemCid: 3957, cas: "79794-75-5", formula: "C22H23ClN2O2", modality: "small-molecule", entityRole: "api", tags: ["api", "antihistamine"], summary: "Antihistamine API process scaffold." },
  { name: "Fexofenadine", pubchemCid: 3348, cas: "83799-24-0", formula: "C32H39NO4", modality: "small-molecule", entityRole: "api", tags: ["api", "antihistamine"], summary: "Antihistamine API." },
  { name: "Acyclovir", pubchemCid: 2022, cas: "59277-89-3", formula: "C8H11N5O3", modality: "small-molecule", entityRole: "api", tags: ["antiviral", "api"], summary: "Nucleoside antiviral API." },
  { name: "Lamivudine", pubchemCid: 60825, cas: "134678-17-4", formula: "C8H11N3O3S", modality: "small-molecule", entityRole: "api", tags: ["antiviral", "api"], summary: "NRTI antiviral API." },
  { name: "Tenofovir", pubchemCid: 464205, cas: "147127-20-6", formula: "C9H14N5O4P", modality: "small-molecule", entityRole: "api", tags: ["antiviral", "api", "nucleotide"], summary: "Nucleotide reverse transcriptase inhibitor scaffold." },
  { name: "Ciprofloxacin", pubchemCid: 2764, cas: "85721-33-1", formula: "C17H18FN3O3", modality: "small-molecule", entityRole: "api", tags: ["antibiotic", "api", "quinolone"], summary: "Fluoroquinolone antibiotic API." },
  { name: "Levofloxacin", pubchemCid: 149096, cas: "100986-85-4", formula: "C18H20FN3O4", modality: "small-molecule", entityRole: "api", tags: ["antibiotic", "api"], summary: "Fluoroquinolone API (chiral)." },
  { name: "Azithromycin", pubchemCid: 447043, cas: "83905-01-5", formula: "C38H72N2O12", modality: "fermentation", entityRole: "api", tags: ["antibiotic", "macrolide", "semi-synthetic"], summary: "Macrolide from erythromycin semi-synthesis themes." },
  { name: "Clarithromycin", pubchemCid: 84029, cas: "81103-11-9", formula: "C38H69NO13", modality: "fermentation", entityRole: "api", tags: ["antibiotic", "macrolide"], summary: "Macrolide semi-synthetic antibiotic." },
  { name: "Doxycycline", pubchemCid: 54671203, cas: "564-25-0", formula: "C22H24N2O8", modality: "fermentation", entityRole: "api", tags: ["antibiotic", "tetracycline"], summary: "Tetracycline-class antibiotic API." },
  { name: "Vancomycin", pubchemCid: 14969, cas: "1404-90-6", formula: "C66H75Cl2N9O24", modality: "fermentation", entityRole: "api", tags: ["antibiotic", "glycopeptide", "fermentation"], summary: "Glycopeptide antibiotic fermentation product." },
  { name: "Morphine", pubchemCid: 5288826, cas: "57-27-2", formula: "C17H19NO3", modality: "small-molecule", entityRole: "api", tags: ["opioid", "api", "natural-product"], summary: "Opioid alkaloid — high-control manufacturing context." },
  { name: "Codeine", pubchemCid: 5284371, cas: "76-57-3", formula: "C18H21NO3", modality: "small-molecule", entityRole: "api", tags: ["opioid", "api"], summary: "Opioid alkaloid API / semi-synthesis from morphine themes." },
  { name: "Oxycodone", pubchemCid: 5284603, cas: "76-42-6", formula: "C18H21NO4", modality: "small-molecule", entityRole: "api", tags: ["opioid", "api"], summary: "Semi-synthetic opioid API — controlled substance context." },
  { name: "Fentanyl", pubchemCid: 3345, cas: "437-38-7", formula: "C22H28N2O", modality: "small-molecule", entityRole: "api", tags: ["opioid", "api", "potent"], summary: "High-potency opioid — OEL / containment teaching focus." },
  { name: "Lidocaine", pubchemCid: 3676, cas: "137-58-6", formula: "C14H22N2O", modality: "small-molecule", entityRole: "api", tags: ["anesthetic", "api"], summary: "Local anesthetic API." },
  { name: "Propofol", pubchemCid: 4943, cas: "2078-54-8", formula: "C12H18O", modality: "small-molecule", entityRole: "api", tags: ["anesthetic", "api"], summary: "IV anesthetic API; emulsion DP often separate." },
  { name: "Midazolam", pubchemCid: 4192, cas: "59467-70-8", formula: "C18H13ClFN3", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "Benzodiazepine API." },
  { name: "Diazepam", pubchemCid: 3016, cas: "439-14-5", formula: "C16H13ClN2O", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "Benzodiazepine API classic synthesis teaching." },
  { name: "Carbamazepine", pubchemCid: 2554, cas: "298-46-4", formula: "C15H12N2O", modality: "small-molecule", entityRole: "api", tags: ["cns", "api", "polymorph"], summary: "Anticonvulsant with polymorphism teaching relevance." },
  { name: "Levetiracetam", pubchemCid: 5284583, cas: "102767-28-2", formula: "C8H14N2O2", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "Anticonvulsant API." },
  { name: "Gabapentin", pubchemCid: 3446, cas: "60142-96-3", formula: "C9H17NO2", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "Gabapentinoid API process scaffold." },
  { name: "Pregabalin", pubchemCid: 5486971, cas: "148553-50-8", formula: "C8H17NO2", modality: "small-molecule", entityRole: "api", tags: ["cns", "api", "chiral"], summary: "Chiral gabapentinoid API." },
  { name: "Methylphenidate", pubchemCid: 4158, cas: "113-45-1", formula: "C14H19NO2", modality: "small-molecule", entityRole: "api", tags: ["cns", "api", "controlled"], summary: "CNS stimulant API — controlled substance context." },
  { name: "Bupropion", pubchemCid: 444, cas: "34911-55-2", formula: "C13H18ClNO", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "Atypical antidepressant API." },
  { name: "Trazodone", pubchemCid: 5533, cas: "19794-93-5", formula: "C19H22ClN5O", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "SARI antidepressant API." },
  { name: "Quetiapine", pubchemCid: 5002, cas: "111974-69-7", formula: "C21H25N3O2S", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "Atypical antipsychotic API." },
  { name: "Olanzapine", pubchemCid: 4585, cas: "132539-06-1", formula: "C17H20N4S", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "Atypical antipsychotic API." },
  { name: "Risperidone", pubchemCid: 5073, cas: "106266-06-2", formula: "C23H27FN4O2", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "Atypical antipsychotic API." },
  { name: "Aripiprazole", pubchemCid: 60795, cas: "129722-12-9", formula: "C23H27Cl2N3O2", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "Atypical antipsychotic API." },
  { name: "Donepezil", pubchemCid: 3152, cas: "120014-06-4", formula: "C24H29NO3", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "AChE inhibitor API." },
  { name: "Memantine", pubchemCid: 4054, cas: "19982-08-2", formula: "C12H21N", modality: "small-molecule", entityRole: "api", tags: ["cns", "api"], summary: "NMDA antagonist API." },
  { name: "Sildenafil citrate context", pubchemCid: 5212, modality: "formulation", entityRole: "drug-product", tags: ["dp", "oral-solid"], summary: "Salt/DP formulation context for sildenafil (process, not clinical)." },
  { name: "Tamoxifen", pubchemCid: 2733526, cas: "10540-29-1", formula: "C26H29NO", modality: "small-molecule", entityRole: "api", tags: ["oncology", "api"], summary: "SERM oncology API." },
  { name: "Anastrozole", pubchemCid: 2187, cas: "120511-73-1", formula: "C17H19N5", modality: "small-molecule", entityRole: "api", tags: ["oncology", "api"], summary: "Aromatase inhibitor API." },
  { name: "Letrozole", pubchemCid: 3902, cas: "112809-51-5", formula: "C17H11N5", modality: "small-molecule", entityRole: "api", tags: ["oncology", "api"], summary: "Aromatase inhibitor API." },
  { name: "Methotrexate", pubchemCid: 126941, cas: "59-05-2", formula: "C20H22N8O5", modality: "small-molecule", entityRole: "api", tags: ["oncology", "api", "potent"], summary: "Antifolate — potent compound handling themes." },
  { name: "Cyclophosphamide", pubchemCid: 2907, cas: "50-18-0", formula: "C7H15Cl2N2O2P", modality: "small-molecule", entityRole: "api", tags: ["oncology", "api", "alkylator"], summary: "Alkylating agent API — high-hazard handling." },
  { name: "Cisplatin", pubchemCid: 441203, cas: "15663-27-1", formula: "Cl2H6N2Pt", modality: "small-molecule", entityRole: "api", tags: ["oncology", "api", "metal"], summary: "Platinum complex API — specialized containment." },
  { name: "5-Fluorouracil", pubchemCid: 3385, cas: "51-21-8", formula: "C4H3FN2O2", modality: "small-molecule", entityRole: "api", tags: ["oncology", "api"], summary: "Antimetabolite API." },
  { name: "Capecitabine", pubchemCid: 60953, cas: "154361-50-9", formula: "C15H22FN3O6", modality: "small-molecule", entityRole: "api", tags: ["oncology", "api", "prodrug"], summary: "Oral fluoropyrimidine prodrug API." },

  // ── Intermediates / reagents ──────────────────────────────────
  { name: "6-APA", pubchemCid: 8745, cas: "551-16-6", formula: "C8H12N2O3S", modality: "fermentation", entityRole: "intermediate", tags: ["beta-lactam", "intermediate"], summary: "6-Aminopenicillanic acid — semi-synthetic penicillin nucleus." },
  { name: "7-ACA", pubchemCid: 441328, cas: "957-68-6", formula: "C10H12N2O5S", modality: "fermentation", entityRole: "intermediate", tags: ["beta-lactam", "cephalosporin", "intermediate"], summary: "7-Aminocephalosporanic acid intermediate." },
  { name: "Salicylic acid", pubchemCid: 338, cas: "69-72-7", formula: "C7H6O3", modality: "small-molecule", entityRole: "starting-material", tags: ["aspirin", "starting-material"], summary: "Aspirin acetylation substrate." },
  { name: "4-Aminophenol", pubchemCid: 403, cas: "123-30-8", formula: "C6H7NO", modality: "small-molecule", entityRole: "intermediate", tags: ["paracetamol", "intermediate", "impurity-theme"], summary: "Paracetamol intermediate / residual impurity theme." },
  { name: "Acetic anhydride", pubchemCid: 7918, cas: "108-24-7", formula: "C4H6O3", modality: "small-molecule", entityRole: "reagent", tags: ["reagent", "acetylation"], summary: "Common plant acetylation reagent." },
  { name: "Acetic acid", pubchemCid: 176, cas: "64-19-7", formula: "C2H4O2", modality: "small-molecule", entityRole: "solvent", tags: ["solvent", "utility"], summary: "Process solvent / co-product recovery." },
  { name: "Acetonitrile", pubchemCid: 6342, cas: "75-05-8", formula: "C2H3N", modality: "small-molecule", entityRole: "solvent", tags: ["solvent", "hplc"], summary: "Aprotic solvent — synthesis and peptide workup." },
  { name: "Dichloromethane", pubchemCid: 6344, cas: "75-09-2", formula: "CH2Cl2", modality: "small-molecule", entityRole: "solvent", tags: ["solvent", "ehs"], summary: "Chlorinated solvent — substitution / residual solvent themes." },
  { name: "Toluene", pubchemCid: 1140, cas: "108-88-3", formula: "C7H8", modality: "small-molecule", entityRole: "solvent", tags: ["solvent"], summary: "Aromatic process solvent." },
  { name: "Isopropanol", pubchemCid: 3776, cas: "67-63-0", formula: "C3H8O", modality: "small-molecule", entityRole: "solvent", tags: ["solvent"], summary: "IPA process / crystallization solvent." },
  { name: "Methanol", pubchemCid: 887, cas: "67-56-1", formula: "CH4O", modality: "small-molecule", entityRole: "solvent", tags: ["solvent", "ehs"], summary: "Process solvent — toxicity and residual limits." },
  { name: "THF", pubchemCid: 8028, cas: "109-99-9", formula: "C4H8O", modality: "small-molecule", entityRole: "solvent", tags: ["solvent", "peroxide"], summary: "Ether solvent — peroxide management teaching." },
  { name: "DMF", pubchemCid: 6228, cas: "68-12-2", formula: "C3H7NO", modality: "small-molecule", entityRole: "solvent", tags: ["solvent", "ich-q3c"], summary: "Aprotic amide solvent — residual solvent class themes." },
  { name: "DMSO", pubchemCid: 679, cas: "67-68-5", formula: "C2H6OS", modality: "small-molecule", entityRole: "solvent", tags: ["solvent"], summary: "Polar aprotic solvent / cryoprotectant contexts." },
  { name: "Hydrogen", pubchemCid: 783, cas: "1333-74-0", formula: "H2", modality: "small-molecule", entityRole: "reagent", tags: ["utility", "hydrogenation"], summary: "Hydrogenation utility — safety zoning critical." },
  { name: "Palladium on carbon", pubchemCid: 23936, modality: "small-molecule", entityRole: "catalyst", tags: ["catalyst", "hydrogenation"], summary: "Heterogeneous hydrogenation catalyst class." },

  // ── Formulation / excipients ──────────────────────────────────
  { name: "Lactose", pubchemCid: 440995, cas: "63-42-3", formula: "C12H22O11", modality: "formulation", entityRole: "excipient", tags: ["excipient", "oral-solid"], summary: "Oral solid-dose diluent." },
  { name: "Microcrystalline cellulose", pubchemCid: 14055602, cas: "9004-34-6", modality: "formulation", entityRole: "excipient", tags: ["excipient", "diluent"], summary: "Tablet diluent / binder class." },
  { name: "Magnesium stearate", pubchemCid: 11177, cas: "557-04-0", modality: "formulation", entityRole: "excipient", tags: ["excipient", "lubricant"], summary: "Tablet lubricant." },
  { name: "Croscarmellose sodium", pubchemCid: 24748, modality: "formulation", entityRole: "excipient", tags: ["excipient", "disintegrant"], summary: "Superdisintegrant class." },
  { name: "PVP / Povidone", pubchemCid: 6917, cas: "9003-39-8", modality: "formulation", entityRole: "excipient", tags: ["excipient", "binder"], summary: "Binder / solubilizer polymer class." },
  { name: "Polysorbate 80", pubchemCid: 5284448, cas: "9005-65-6", modality: "formulation", entityRole: "excipient", tags: ["excipient", "surfactant", "biologic-formulation"], summary: "Surfactant for biologic and small-molecule DP." },
  { name: "Mannitol", pubchemCid: 6251, cas: "69-65-8", formula: "C6H14O6", modality: "formulation", entityRole: "excipient", tags: ["excipient", "lyophilization"], summary: "Lyophilization bulking agent." },
  { name: "Sucrose", pubchemCid: 5988, cas: "57-50-1", formula: "C12H22O11", modality: "formulation", entityRole: "excipient", tags: ["excipient", "lyophilization"], summary: "Stabilizer / bulking agent." },
  { name: "Trehalose", pubchemCid: 7427, cas: "99-20-7", formula: "C12H22O11", modality: "formulation", entityRole: "excipient", tags: ["excipient", "biologic-formulation"], summary: "Biologic stabilizer / lyoprotectant." },
  { name: "Sodium chloride", pubchemCid: 5234, cas: "7647-14-5", formula: "ClNa", modality: "media", entityRole: "media-component", tags: ["buffer", "isotonicity"], summary: "Isotonicity / media component." },
  { name: "Histidine", pubchemCid: 6274, cas: "71-00-1", formula: "C6H9N3O2", modality: "media", entityRole: "media-component", tags: ["buffer", "biologic-formulation"], summary: "Common biologic formulation buffer." },
  { name: "Phosphate buffered saline context", pubchemCid: 24978514, modality: "media", entityRole: "media-component", tags: ["buffer", "media"], summary: "PBS-class buffer system scaffold." },
  { name: "Citric acid", pubchemCid: 311, cas: "77-92-9", formula: "C6H8O7", modality: "media", entityRole: "media-component", tags: ["buffer", "excipient"], summary: "Buffer / acidulant component." },
  { name: "Sodium citrate", pubchemCid: 6224, cas: "68-04-2", modality: "media", entityRole: "media-component", tags: ["buffer"], summary: "Citrate buffer component." },
  { name: "WFI / water for injection context", modality: "media", entityRole: "raw-material", tags: ["utility", "water"], summary: "Water system quality class — site utility package (no CID)." },

  // ── Biologic / modality packages (parameter-rich scaffolds) ───
  { name: "Trastuzumab (mAb DS scaffold)", modality: "mab", entityRole: "api", tags: ["mab", "oncology", "biologic"], summary: "HER2 mAb — educational upstream/downstream parameter scaffold.", parameterSetId: "mab", scaleHints: ["pilot", "commercial"] },
  { name: "Rituximab (mAb DS scaffold)", modality: "mab", entityRole: "api", tags: ["mab", "biologic"], summary: "CD20 mAb process template with mAb parameter set.", parameterSetId: "mab" },
  { name: "Adalimumab (mAb DS scaffold)", modality: "mab", entityRole: "api", tags: ["mab", "biologic"], summary: "Anti-TNF mAb educational DS package.", parameterSetId: "mab" },
  { name: "Bevacizumab (mAb DS scaffold)", modality: "mab", entityRole: "api", tags: ["mab", "oncology", "biologic"], summary: "Anti-VEGF mAb DS parameter scaffold.", parameterSetId: "mab" },
  { name: "Nivolumab (mAb DS scaffold)", modality: "mab", entityRole: "api", tags: ["mab", "immuno-oncology"], summary: "PD-1 mAb educational process package.", parameterSetId: "mab" },
  { name: "Pembrolizumab (mAb DS scaffold)", modality: "mab", entityRole: "api", tags: ["mab", "immuno-oncology"], summary: "PD-1 mAb DS scaffold.", parameterSetId: "mab" },
  { name: "Infliximab (mAb DS scaffold)", modality: "mab", entityRole: "api", tags: ["mab", "biologic"], summary: "Chimeric anti-TNF mAb process template.", parameterSetId: "mab" },
  { name: "mAb platform (fed-batch CHO)", modality: "mab", entityRole: "api", tags: ["mab", "platform", "cho"], summary: "Generic CHO fed-batch + Protein A train educational package.", parameterSetId: "mab", depth: "standard", tier: "B" },
  { name: "ADC platform (conjugation)", modality: "adc", entityRole: "api", tags: ["adc", "platform", "potent"], summary: "Generic ADC conjugation/DAR control educational package.", parameterSetId: "adc" },
  { name: "Trastuzumab emtansine (ADC theme)", modality: "adc", entityRole: "api", tags: ["adc", "oncology"], summary: "ADC theme package — DAR and free payload parameters.", parameterSetId: "adc" },
  { name: "Insulin (human) process theme", pubchemCid: 16129672, modality: "fermentation", entityRole: "api", tags: ["peptide", "biologic", "recombinant"], summary: "Recombinant peptide hormone — fermentation/DS themes.", parameterSetId: "fermentation" },
  { name: "Insulin glargine DP theme", modality: "formulation", entityRole: "drug-product", tags: ["biologic", "injectable", "dp"], summary: "Long-acting insulin formulation process awareness.", parameterSetId: "formulation" },
  { name: "SPPS peptide platform", modality: "peptide", entityRole: "api", tags: ["peptide", "spps", "platform"], summary: "Solid-phase peptide synthesis educational parameter package.", parameterSetId: "peptide" },
  { name: "GLP-1 peptide class (process theme)", modality: "peptide", entityRole: "api", tags: ["peptide", "metabolic"], summary: "Peptide API class — SPPS/LPPS parameter scaffold.", parameterSetId: "peptide" },
  { name: "Oligonucleotide ASO platform", modality: "oligonucleotide", entityRole: "api", tags: ["oligo", "aso", "platform"], summary: "Phosphoramidite synthesis + purify educational package.", parameterSetId: "oligonucleotide" },
  { name: "siRNA / RNAi process theme", modality: "oligonucleotide", entityRole: "api", tags: ["oligo", "sirna"], summary: "Oligo therapeutic process parameter scaffold.", parameterSetId: "oligonucleotide" },
  { name: "AAV vector platform", modality: "gene-therapy", entityRole: "api", tags: ["gene-therapy", "aav", "platform"], summary: "AAV production/purification educational parameter package.", parameterSetId: "gene-therapy" },
  { name: "Lentiviral vector platform", modality: "gene-therapy", entityRole: "api", tags: ["gene-therapy", "lentivirus"], summary: "LVV process awareness + biosafety parameters.", parameterSetId: "gene-therapy" },
  { name: "CAR-T process theme", modality: "cell-therapy", entityRole: "api", tags: ["cell-therapy", "car-t"], summary: "Autologous cell therapy unit-op + identity chain parameters.", parameterSetId: "cell-therapy" },
  { name: "NK cell therapy theme", modality: "cell-therapy", entityRole: "api", tags: ["cell-therapy"], summary: "Allogeneic/autologous cell expansion educational scaffold.", parameterSetId: "cell-therapy" },
  { name: "mRNA DS process theme", modality: "gene-therapy", entityRole: "api", tags: ["mrna", "gene-therapy"], summary: "IVT mRNA production/purification educational themes.", parameterSetId: "gene-therapy" },
  { name: "LNP formulation theme", modality: "formulation", entityRole: "drug-product", tags: ["lnp", "formulation", "mrna"], summary: "Lipid nanoparticle formulation process awareness.", parameterSetId: "formulation" },
  { name: "Vaccine antigen fermentation theme", modality: "vaccine", entityRole: "api", tags: ["vaccine", "fermentation"], summary: "Antigen production + inactivation educational package.", parameterSetId: "vaccine" },
  { name: "Viral vaccine platform", modality: "vaccine", entityRole: "api", tags: ["vaccine", "viral"], summary: "Viral vaccine DS parameter awareness scaffold.", parameterSetId: "vaccine" },
  { name: "CHO cell culture media prep", modality: "media", entityRole: "media-component", tags: ["media", "cho", "biologic"], summary: "Basal/feed media preparation parameter package.", parameterSetId: "media" },
  { name: "Buffer prep (biologic suite)", modality: "media", entityRole: "media-component", tags: ["buffer", "media"], summary: "Process buffer compounding educational package.", parameterSetId: "media" },
  { name: "Oral solid dose platform", modality: "formulation", entityRole: "drug-product", tags: ["dp", "tablet", "platform"], summary: "Blend–compress–coat educational DP package.", parameterSetId: "formulation" },
  { name: "Sterile fill-finish platform", modality: "formulation", entityRole: "drug-product", tags: ["dp", "sterile", "fill-finish"], summary: "Aseptic fill educational package — not a compounding worksheet.", parameterSetId: "formulation" },
  { name: "Lyophilized vial platform", modality: "formulation", entityRole: "drug-product", tags: ["dp", "lyophilization"], summary: "Freeze-dry cycle educational parameter awareness.", parameterSetId: "formulation" },
  { name: "Sterile compounding awareness", modality: "sterile-compounding", entityRole: "other", tags: ["compounding", "usp-797"], summary: "USP-style process awareness only — no patient protocols.", parameterSetId: "sterile-compounding" },
];

const PACKAGES: CuratedPackage[] = SEEDS.map(pack);

export function getAllCuratedPackages(): CuratedPackage[] {
  return PACKAGES;
}

export function getCuratedPackageById(id: string): CuratedPackage | undefined {
  const key = id.trim().toLowerCase();
  return PACKAGES.find((p) => p.id.toLowerCase() === key || p.exampleId === key);
}

export function filterCuratedPackages(
  opts: {
    q?: string;
    modality?: string;
    role?: string;
    tier?: string;
    depth?: string;
  } = {}
): CuratedPackage[] {
  const q = opts.q?.trim().toLowerCase() || "";
  return PACKAGES.filter((p) => {
    if (opts.modality && p.modality !== opts.modality) return false;
    if (opts.role && p.entityRole !== opts.role) return false;
    if (opts.tier && p.tier !== opts.tier) return false;
    if (opts.depth && p.depth !== opts.depth) return false;
    if (!q) return true;
    const hay = [
      p.name,
      p.cas,
      p.summary,
      p.formula,
      p.modality,
      p.entityRole,
      ...(p.tags || []),
      p.pubchemCid != null ? String(p.pubchemCid) : "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function packageHref(p: CuratedPackage): string {
  if (p.exampleId && getExampleById(p.exampleId)) return routes.example(p.exampleId);
  if (p.pubchemCid) return routes.pubchem(p.pubchemCid);
  return routes.catalog() + `?q=${encodeURIComponent(p.name)}`;
}

export function curatedPackageCount(): number {
  return PACKAGES.length;
}
