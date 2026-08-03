/**
 * Live cold dual-view smoke: force densify+AI stream for non-curated CIDs.
 * Usage: node scripts/smoke-cold-dual-view.mjs
 * Env: SMOKE_BASE (default App Hosting URL)
 */
const BASE =
  process.env.SMOKE_BASE ||
  "https://chemrecipe--chemistryrecipes.us-central1.hosted.app";

const CIDS = [
  { name: "Baricitinib", cid: 44205240 },
  { name: "Filgotinib", cid: 49831257 },
  { name: "Larotrectinib", cid: 46188928 },
];

function parseSseBlocks(text) {
  const events = [];
  const blocks = text.split(/\n\n+/);
  for (const block of blocks) {
    const lines = block.split(/\n/).filter(Boolean);
    let data = "";
    for (const line of lines) {
      if (line.startsWith("data:")) data += line.slice(5).trimStart();
      else if (line.startsWith("data: ")) data += line.slice(6);
    }
    if (!data) continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      /* ignore keepalives / partial */
    }
  }
  return events;
}

async function streamCid({ name, cid }) {
  const url = `${BASE}/api/dossier/${cid}/stream?force=1`;
  const t0 = Date.now();
  const res = await fetch(url, {
    headers: { Accept: "text/event-stream" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return {
      name,
      cid,
      ok: false,
      error: `HTTP ${res.status} ${body.slice(0, 120)}`,
      ms: Date.now() - t0,
    };
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let buildMode = null;
  let overview = "";
  let mfg = "";
  let routes = 0;
  let score = null;
  let identity = null;
  let aiError = null;
  let complete = false;
  let partial = false;
  let preferFast = null;
  let procN = 0;
  let eventTypes = [];
  let lastLabel = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    // Keep incomplete trailing block
    const cut = buf.lastIndexOf("\n\n");
    if (cut < 0) continue;
    const chunk = buf.slice(0, cut + 2);
    buf = buf.slice(cut + 2);
    for (const ev of parseSseBlocks(chunk)) {
      eventTypes.push(ev.type || "?");
      if (ev.label) lastLabel = ev.label;
      if (ev.type === "partial" && ev.dossier) {
        partial = true;
        score = ev.dossier.evidenceScore?.score ?? score;
        identity = ev.dossier.identity?.name || identity;
        preferFast = ev.dossier.evidenceScore?.preferFastModel ?? preferFast;
      }
      if (ev.type === "complete" && ev.dossier) {
        complete = true;
        const d = ev.dossier;
        buildMode = d.buildMode;
        overview = (
          d.synthesis?.overview ||
          d.overview ||
          d.descriptionTexts?.[0] ||
          ""
        ).slice(0, 400);
        mfg = (d.synthesis?.manufacturingSummary || "").slice(0, 280);
        routes = (d.processRoutes || d.routes || []).length;
        score = d.evidenceScore?.score ?? score;
        identity = d.identity?.name || identity;
        aiError = d.synthesis?.rawError || null;
        preferFast = d.evidenceScore?.preferFastModel ?? preferFast;
        procN =
          d.procedureExcerpts?.length ||
          d.processFacts?.facts?.filter((f) => f.kind !== "open-gap").length ||
          0;
      }
      if (ev.type === "error") {
        aiError = ev.detail || ev.error || aiError;
      }
      if (ev.type === "step_error" && ev.stepId === "ollama") {
        aiError = ev.detail || ev.error || aiError;
      }
    }
  }
  // flush remainder
  for (const ev of parseSseBlocks(buf + "\n\n")) {
    if (ev.type === "complete" && ev.dossier) {
      complete = true;
      const d = ev.dossier;
      buildMode = d.buildMode;
      overview = (
        d.synthesis?.overview ||
        d.overview ||
        d.descriptionTexts?.[0] ||
        ""
      ).slice(0, 400);
      mfg = (d.synthesis?.manufacturingSummary || "").slice(0, 280);
      routes = (d.processRoutes || d.routes || []).length;
      score = d.evidenceScore?.score ?? score;
      identity = d.identity?.name || identity;
      aiError = d.synthesis?.rawError || null;
      preferFast = d.evidenceScore?.preferFastModel ?? preferFast;
      procN =
        d.procedureExcerpts?.length ||
        d.processFacts?.facts?.filter((f) => f.kind !== "open-gap").length ||
        0;
    }
  }

  const ms = Date.now() - t0;
  const ovHead = overview.trim().slice(0, 160);
  const clinicalLead =
    /^(is a |is an )/i.test(ovHead) ||
    /\bis a (drug|medication|selective|potent)\b/i.test(ovHead) ||
    /used (primarily )?to treat|treats |patients with|clinical trial|placebo|indication/i.test(
      overview.slice(0, 120)
    );
  const processCue =
    /synthes|manufactur|process|patent|prepar|route|unit.?op|crystal|hydrogen|ferment|scale|chemistr|intermediate|procedure/i.test(
      overview + " " + mfg
    );

  return {
    name,
    cid,
    ok: complete && Boolean(identity),
    ms,
    buildMode,
    identity,
    score,
    routes,
    procN,
    preferFast,
    partial,
    overview: overview.slice(0, 240),
    mfgLead: mfg.slice(0, 180),
    clinicalLead,
    processCue,
    aiError: aiError ? String(aiError).slice(0, 180) : null,
    eventSample: eventTypes.slice(0, 12),
    lastLabel,
  };
}

async function main() {
  console.log("Live cold dual-view smoke ·", BASE);
  try {
    const st = await fetch(`${BASE}/api/ai/status`).then((r) => r.json());
    console.log(
      "AI status:",
      JSON.stringify({
        canCall: st.canCall,
        provider: st.provider,
        model: st.model || st.primaryModel,
      })
    );
  } catch (e) {
    console.log("AI status fail", e.message);
  }

  const results = [];
  for (const c of CIDS) {
    console.log(`\n→ ${c.name} CID ${c.cid} …`);
    try {
      const r = await streamCid(c);
      results.push(r);
      console.log(JSON.stringify(r, null, 2));
    } catch (e) {
      const r = { name: c.name, cid: c.cid, ok: false, error: String(e) };
      results.push(r);
      console.log(JSON.stringify(r, null, 2));
    }
  }

  console.log("\n=== SUMMARY ===");
  for (const r of results) {
    const dual = r.buildMode === "ai" ? "AI dual-view" : r.buildMode || "fail";
    console.log(
      [
        r.ok ? "PASS" : "FAIL",
        r.name,
        "·",
        dual,
        "· score",
        r.score,
        "· routes",
        r.routes,
        "·",
        Math.round((r.ms || 0) / 1000) + "s",
        r.processCue ? "· process-led" : "· weak-process",
        r.clinicalLead ? "· CLINICAL-LEAD" : "· not-clinical-lead",
        r.aiError ? "· AI: " + r.aiError : "",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
  const allOk = results.every((r) => r.ok);
  const aiCount = results.filter((r) => r.buildMode === "ai").length;
  console.log(`\nallOk=${allOk} aiDualView=${aiCount}/${results.length}`);
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
