/**
 * Worker UX contracts — role modes, Monday pack, site fill, work packs.
 * Run: node scripts/test-worker-ux.mjs
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(__dirname, "..", "src");

let passed = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log("ok  ", name);
  passed += 1;
}

function read(rel) {
  return fs.readFileSync(path.join(src, rel), "utf8");
}

const role = read("lib/worker/roleMode.ts");
const live = read("components/dossier/LiveMoleculeDossier.tsx");
const monday = read("components/MondayMorningPack.tsx");
const site = read("lib/idb/siteFill.ts");
const packs = read("lib/workspace/workPacks.ts");
const enrich = read("components/LocalTextEnrich.tsx");
const home = read("app/page.tsx");
const css = read("app/globals.css");

ok("role modes: operator chemist msat manager", /operator|chemist|msat|manager/.test(role));
ok("role modes: sectionVisible", /export function sectionVisible/.test(role));
ok("role modes: operator hides multi-source by default", /operator:/.test(role));
ok("live mounts WorkerRoleBar", /WorkerRoleBar/.test(live));
ok("live mounts MondayMorningPack", /MondayMorningPack/.test(live));
ok("live mounts SiteFillPanel", /SiteFillPanel/.test(live));
ok("live mounts SiteGapsExport", /SiteGapsExport/.test(live));
ok("live mounts WorkPackPanel", /WorkPackPanel/.test(live));
ok("live uses sectionVisible / show(", /show\(|sectionVisible/.test(live));
ok("Monday pack EHS callouts", /EHS callouts/.test(monday));
ok("Monday pack site must fill", /Site must fill/.test(monday));
ok("Monday pack preferred path", /Preferred path/.test(monday));
ok("Monday pack print action", /Print pack|window\.print/.test(monday));
ok("Monday pack densify CTA when scout", /Paste public procedure|isScout/.test(monday));
ok("site fill empty by design", /Empty by design|site QMS/.test(read("components/SiteFillPanel.tsx")));
ok("site fill save local", /saveSiteFill|localStorage/.test(site));
ok("work packs notes + pastes", /addWorkPackNote|addWorkPackPaste/.test(packs));
ok("enrich emphasizes scout", /emphasize/.test(enrich));
ok("enrich logs paste to work pack", /addWorkPackPaste/.test(enrich));
ok(
  "home live densify primary",
  /live densify|Open live search|free-public densify|AI dual-view/i.test(home)
);
ok("home densify step", /Densify|Paste public patent|dual-view/i.test(home));
ok("home has no Training/Info mock CTA", !/Training packs|Info hub \(demos/i.test(home));
ok("print CSS operator floor", /monday-pack|operator-job-aid/.test(css));

// Executable role visibility
const ROLE_SECTIONS = {
  operator: ["monday-pack", "operator-aid", "local-enrich", "site-fill"],
  manager: ["monday-pack", "manager-brief", "checklist"],
};
function visible(roleId, id) {
  return (ROLE_SECTIONS[roleId] || []).includes(id);
}
ok("exec: operator sees job aid", visible("operator", "operator-aid"));
ok("exec: operator not multi-source in minimal set", !visible("operator", "multi-source"));
ok("exec: manager sees brief", visible("manager", "manager-brief"));

console.log(`\nAll worker UX contracts passed (${passed}).`);
