import nextEnv from "@next/env";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const { loadEnvConfig } = nextEnv;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.join(__dirname, "..");
const monorepoRoot = path.join(webRoot, "..");
loadEnvConfig(monorepoRoot);
loadEnvConfig(webRoot);

function readKey() {
  let key = (process.env.OLLAMA_CLOUD_API_KEY || process.env.OLLAMA_API_KEY || "").trim();
  if (key) return key;
  for (const p of [path.join(monorepoRoot, ".env"), path.join(webRoot, ".env")]) {
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, "utf8").match(/^OLLAMA_CLOUD_API_KEY=(.+)$/m);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const key = readKey();
const model = process.env.OLLAMA_CLOUD_MODEL || "gpt-oss:120b";
console.log("keyLen", key.length, "model", model);

async function tryChat(label, body, timeoutMs) {
  const t0 = Date.now();
  try {
    const res = await fetch("https://ollama.com/api/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    console.log(label, "status", res.status, "ms", Date.now() - t0, "len", text.length);
    console.log(label, "body", text.slice(0, 500));
    return { ok: res.ok, text, ms: Date.now() - t0 };
  } catch (e) {
    console.log(label, "ERR", e.name, e.message, "ms", Date.now() - t0);
    return { ok: false, error: e.message, ms: Date.now() - t0 };
  }
}

// 1) tiny ping with format json
await tryChat(
  "ping-json",
  {
    model,
    stream: false,
    format: "json",
    messages: [
      { role: "system", content: 'Reply only with JSON: {"ok":true}' },
      { role: "user", content: "ping" },
    ],
  },
  60000
);

// 2) tiny ping without format
await tryChat(
  "ping-plain",
  {
    model,
    stream: false,
    messages: [{ role: "user", content: 'Reply with exactly: {"ok":true}' }],
  },
  60000
);

// 3) list tags
{
  const t0 = Date.now();
  try {
    const res = await fetch("https://ollama.com/api/tags", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(15000),
    });
    const text = await res.text();
    console.log("tags", res.status, "ms", Date.now() - t0, text.slice(0, 600));
  } catch (e) {
    console.log("tags ERR", e.message);
  }
}
