import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seg = path.join(
  process.env.USERPROFILE || "",
  ".grok/sessions/C%3A%5CUsers%5Ckevin%5Cworkspace%5Cchemistry_recipes/019f8b18-9ea8-7bf1-81b5-18d7250ed1d9/compaction/segment_000.md"
);
const text = fs.readFileSync(seg, "utf8");
const names = ["aspirin", "ibuprofen", "paracetamol", "menthol", "metformin"];
const outDir = path.join(__dirname, "../src/data/molecules");
fs.mkdirSync(outDir, { recursive: true });

for (const name of names) {
  const needle = `molecules\\${name}.json`;
  const needle2 = `molecules/${name}.json`;
  let idx = text.indexOf(needle);
  if (idx < 0) idx = text.indexOf(needle2);
  if (idx < 0) {
    console.log("not found", name);
    continue;
  }
  const contentIdx = text.indexOf("- content:", idx);
  if (contentIdx < 0) {
    console.log("no content", name);
    continue;
  }
  let i = contentIdx + "- content:".length;
  while (i < text.length && text[i] !== "{") i++;
  let depth = 0;
  let end = -1;
  for (let j = i; j < text.length; j++) {
    if (text[j] === "{") depth++;
    else if (text[j] === "}") {
      depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
  if (end < 0) {
    console.log("unclosed", name);
    continue;
  }
  const json = text.slice(i, end);
  try {
    const obj = JSON.parse(json);
    fs.writeFileSync(path.join(outDir, `${name}.json`), JSON.stringify(obj, null, 2));
    console.log("ok", name, "routes", obj.routes?.length, "steps", obj.routes?.[0]?.steps?.length);
  } catch (e) {
    console.log("parse fail", name, e.message);
  }
}
