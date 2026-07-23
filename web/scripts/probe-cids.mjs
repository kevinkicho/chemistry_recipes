/** Compare free-public evidence richness for two PubChem CIDs. */
async function fetchJson(url) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    const text = await r.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      /* ignore */
    }
    return { ok: r.ok, status: r.status, ms: Date.now() - t0, len: text.length, data };
  } catch (e) {
    return { ok: false, error: String(e), ms: Date.now() - t0, len: 0, data: null };
  }
}

function walkText(sections, out = []) {
  if (!sections) return out;
  for (const sec of sections) {
    if (sec.Description) out.push(sec.Description);
    for (const info of sec.Information || []) {
      for (const s of info.Value?.StringWithMarkup || []) {
        if (s.String) out.push(s.String);
      }
    }
    walkText(sec.Section, out);
  }
  return out;
}

async function probe(cid) {
  console.log("\n==== CID", cid, "====");
  const props = await fetchJson(
    `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,InChIKey,Title/JSON`
  );
  const p = props.data?.PropertyTable?.Properties?.[0];
  console.log("identity ok:", props.ok, "status:", props.status);
  console.log("  title:", p?.Title, "formula:", p?.MolecularFormula, "mw:", p?.MolecularWeight);

  let totalMfg = 0;
  let totalHaz = 0;
  let totalProp = 0;
  for (const h of [
    "GHS Classification",
    "Use and Manufacturing",
    "Chemical and Physical Properties",
    "Safety and Hazards",
  ]) {
    const u = `https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=${encodeURIComponent(h)}`;
    const r = await fetchJson(u);
    const texts = walkText(r.data?.Record?.Section);
    const joined = texts.join("\n");
    if (h.includes("Manufacturing") || h.includes("Use")) totalMfg += joined.length;
    if (h.includes("GHS") || h.includes("Safety")) totalHaz += joined.length;
    if (h.includes("Physical")) totalProp += joined.length;
    console.log(
      `  pug_view "${h}": ok=${r.ok} status=${r.status} textChunks=${texts.length} chars=${joined.length}`
    );
    if (texts[0]) console.log("    sample:", texts[0].slice(0, 120).replace(/\s+/g, " "));
  }

  const name = p?.Title || `CID ${cid}`;
  const processQ = `(TITLE_ABS:"${name}") AND (synthesis OR manufacture OR manufacturing OR process chemistry OR preparation OR industrial production)`;
  const epmc = await fetchJson(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(processQ)}&resultType=core&pageSize=5&format=json`
  );
  console.log("europepmc process-filtered hitCount:", epmc.data?.hitCount, "returned:", epmc.data?.resultList?.result?.length || 0);
  for (const hit of (epmc.data?.resultList?.result || []).slice(0, 3)) {
    console.log("  lit:", (hit.title || "").slice(0, 100));
  }

  const nameQ = `TITLE_ABS:"${name}"`;
  const epmc2 = await fetchJson(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(nameQ)}&resultType=core&pageSize=5&format=json`
  );
  console.log("europepmc name-only hitCount:", epmc2.data?.hitCount);

  console.log("evidence score proxy: mfgChars=", totalMfg, "hazChars=", totalHaz, "propChars=", totalProp);
  return { cid, name, totalMfg, totalHaz, lit: epmc.data?.hitCount || 0 };
}

const a = await probe(4091);
const b = await probe(3478);
console.log("\n==== SUMMARY ====");
console.log(JSON.stringify({ a, b }, null, 2));
