"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  clearAiConfig,
  DEFAULT_AI_CONFIG,
  DEFAULT_OLLAMA_CLOUD_FAST_MODEL,
  DEFAULT_OLLAMA_CLOUD_MODEL,
  maskApiKey,
  OLLAMA_CLOUD_HOST,
  type AiConfig,
} from "@/lib/ai/config";
import { listAiModels, testAiConnection } from "@/lib/ai/client";
import { useAiConfig } from "@/hooks/useAiConfig";
import type { ServerAiStatus } from "@/lib/ai/client";
import { EnvChecklist } from "@/components/EnvChecklist";

/**
 * Shared Ollama Cloud settings form (modal or full page).
 * Model lists come from Ollama Cloud GET /api/tags via /api/ai/models.
 */
export function AiSettingsPanel({
  initialServerEnv,
  compact = false,
}: {
  initialServerEnv?: ServerAiStatus | null;
  /** Tighter spacing for modal body */
  compact?: boolean;
}) {
  const uid = useId();
  const { config, save, configured, localConfigured, serverEnv, hydrated } =
    useAiConfig(initialServerEnv);
  const [draft, setDraft] = useState<AiConfig>({ ...DEFAULT_AI_CONFIG });
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [customPrimary, setCustomPrimary] = useState(false);
  const [customFast, setCustomFast] = useState(false);

  useEffect(() => {
    if (!hydrated && !serverEnv) return;
    const model =
      config.model || serverEnv?.model || DEFAULT_OLLAMA_CLOUD_MODEL;
    const fastModel =
      config.fastModel ||
      serverEnv?.fastModel ||
      config.model ||
      serverEnv?.model ||
      DEFAULT_OLLAMA_CLOUD_FAST_MODEL;
    setDraft({
      ...config,
      model,
      fastModel,
      host: config.host || serverEnv?.host || OLLAMA_CLOUD_HOST,
      apiKey: config.apiKey,
      enabled: config.enabled || Boolean(serverEnv?.envKeyConfigured),
    });
  }, [config, serverEnv, hydrated]);

  const canCallWithoutBrowserKey =
    Boolean(draft.apiKey.trim()) || Boolean(serverEnv?.envKeyConfigured);

  const update = useCallback((patch: Partial<AiConfig>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setStatus(null);
    setError(null);
  }, []);

  const loadModels = useCallback(
    async (opts?: { silent?: boolean; cfg?: AiConfig }) => {
      const cfg = opts?.cfg ?? draft;
      const canCall =
        Boolean(cfg.apiKey.trim()) || Boolean(serverEnv?.envKeyConfigured);
      if (!canCall) return;
      setLoadingModels(true);
      if (!opts?.silent) setError(null);
      const result = await listAiModels(cfg);
      setLoadingModels(false);
      setModelsLoaded(true);
      if (!result.ok) {
        if (!opts?.silent) {
          setError(result.error || "Could not list models");
        }
        return;
      }
      setModels(result.models);
      if (!opts?.silent) {
        setStatus(
          result.models.length
            ? `Loaded ${result.models.length} model(s) from Ollama Cloud`
            : "Connected, but tags list was empty"
        );
      }
    },
    [draft, serverEnv?.envKeyConfigured]
  );

  // Auto-fetch model list once when key is available (browser or .env)
  useEffect(() => {
    if (!hydrated) return;
    if (!canCallWithoutBrowserKey) return;
    if (modelsLoaded) return;
    void loadModels({ silent: true });
    // Intentionally only re-run when key availability flips or models reset
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid re-fetch on every draft keystroke
  }, [hydrated, canCallWithoutBrowserKey, modelsLoaded]);

  // Options for selects: API list + current draft/server defaults
  const modelOptions = useMemo(() => {
    const extras = [
      draft.model,
      draft.fastModel,
      serverEnv?.model,
      serverEnv?.fastModel,
      DEFAULT_OLLAMA_CLOUD_MODEL,
      DEFAULT_OLLAMA_CLOUD_FAST_MODEL,
    ].filter(Boolean) as string[];
    return [...new Set([...models, ...extras])].sort((a, b) =>
      a.localeCompare(b)
    );
  }, [models, draft.model, draft.fastModel, serverEnv?.model, serverEnv?.fastModel]);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    const model = draft.model.trim() || DEFAULT_OLLAMA_CLOUD_MODEL;
    save({
      ...draft,
      provider: "ollama-cloud",
      host: draft.host.trim() || OLLAMA_CLOUD_HOST,
      model,
      fastModel: draft.fastModel.trim() || model,
      apiKey: draft.apiKey.trim(),
    });
    setStatus(
      "Saved. Primary & fast models apply on the next dossier build (Refresh live data)."
    );
    setError(null);
  }

  async function onTest() {
    setTesting(true);
    setError(null);
    setStatus(null);
    const result = await testAiConnection(draft);
    setTesting(false);
    if (result.ok) setStatus(result.message);
    else setError(result.message);
  }

  function onClear() {
    if (!confirm("Remove AI settings from this browser?")) return;
    clearAiConfig();
    setDraft({ ...DEFAULT_AI_CONFIG });
    setModels([]);
    setModelsLoaded(false);
    setCustomPrimary(false);
    setCustomFast(false);
    setStatus("AI settings cleared.");
    setError(null);
  }

  const selectClass =
    "mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 focus:border-teal-500/60 focus:outline-none focus:ring-2 focus:ring-teal-500/30";

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <EnvChecklist />
      <p className="text-sm leading-relaxed text-slate-400">
        AI uses{" "}
        <a
          href="https://docs.ollama.com/cloud"
          target="_blank"
          rel="noreferrer"
          className="text-teal-400 hover:underline"
        >
          Ollama Cloud
        </a>
        . Dev:{" "}
        <code className="text-slate-300">OLLAMA_CLOUD_API_KEY</code> in repo{" "}
        <code className="text-slate-300">.env</code>
        {"; optional "}
        <code className="text-slate-300">OLLAMA_CLOUD_MODEL</code> /{" "}
        <code className="text-slate-300">OLLAMA_CLOUD_FAST_MODEL</code>. Browser
        overrides below (localStorage only).
      </p>

      {serverEnv?.envKeyConfigured ? (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-200">
          Server has{" "}
          <code className="text-sky-100">{serverEnv.envKeySource || "OLLAMA_CLOUD_API_KEY"}</code>
          {serverEnv.model ? (
            <>
              {" "}
              · model <code className="text-sky-100">{serverEnv.model}</code>
            </>
          ) : null}
          {serverEnv.fastModel && serverEnv.fastModel !== serverEnv.model ? (
            <>
              {" "}
              · fast <code className="text-sky-100">{serverEnv.fastModel}</code>
            </>
          ) : null}
          . Browser key is optional.
        </div>
      ) : null}

      <div
        className={`rounded-lg border px-3 py-2 text-sm ${
          configured
            ? "border-teal-500/30 bg-teal-500/10 text-teal-200"
            : "border-slate-700 bg-slate-900/50 text-slate-400"
        }`}
      >
        {configured ? (
          <>
            AI ready
            {localConfigured ? (
              <>
                {" "}
                · browser key {maskApiKey(config.apiKey)} · model{" "}
                <code className="text-teal-100">{config.model}</code>
                {config.fastModel && config.fastModel !== config.model ? (
                  <>
                    {" "}
                    · fast <code className="text-teal-100">{config.fastModel}</code>
                  </>
                ) : null}
              </>
            ) : (
              <>
                {" "}
                · using <code className="text-teal-100">.env</code> key · model{" "}
                <code className="text-teal-100">{serverEnv?.model || config.model}</code>
              </>
            )}
          </>
        ) : !hydrated ? (
          <>Checking configuration…</>
        ) : (
          <>
            AI not ready — set <code className="text-slate-300">OLLAMA_CLOUD_API_KEY</code> in{" "}
            <code className="text-slate-300">.env</code> or paste a key below.
          </>
        )}
      </div>

      <form onSubmit={onSave} className="space-y-5">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-teal-600 focus:ring-teal-500/40"
          />
          <span className="text-sm text-slate-200">
            Enable AI features (uses your Ollama Cloud key when needed)
          </span>
        </label>

        <div>
          <label
            htmlFor={`${uid}-host`}
            className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            Host
          </label>
          <input
            id={`${uid}-host`}
            type="url"
            value={draft.host}
            onChange={(e) => update({ host: e.target.value })}
            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-teal-500/60 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            placeholder={OLLAMA_CLOUD_HOST}
          />
        </div>

        <div>
          <label
            htmlFor={`${uid}-key`}
            className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
          >
            API key
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id={`${uid}-key`}
              type={showKey ? "text" : "password"}
              value={draft.apiKey}
              onChange={(e) => {
                update({ apiKey: e.target.value });
                // Re-fetch models when key changes
                setModelsLoaded(false);
              }}
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 focus:border-teal-500/60 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              placeholder="ollama_…"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="shrink-0 rounded-lg border border-slate-700 px-3 text-xs text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            >
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
          <p className="mt-1 text-[11px] text-slate-600">
            Optional override. Keys:{" "}
            <a
              href="https://ollama.com/settings/keys"
              target="_blank"
              rel="noreferrer"
              className="text-teal-500/90 hover:underline"
            >
              ollama.com/settings/keys
            </a>
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={`${uid}-model`}
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Primary model
              </label>
              <button
                type="button"
                onClick={() => setCustomPrimary((v) => !v)}
                className="text-[10px] text-slate-500 hover:text-teal-400"
              >
                {customPrimary ? "Use list" : "Custom…"}
              </button>
            </div>
            {customPrimary ? (
              <input
                id={`${uid}-model`}
                type="text"
                value={draft.model}
                onChange={(e) => update({ model: e.target.value })}
                className={selectClass}
                placeholder={DEFAULT_OLLAMA_CLOUD_MODEL}
                spellCheck={false}
              />
            ) : (
              <select
                id={`${uid}-model`}
                value={
                  modelOptions.includes(draft.model)
                    ? draft.model
                    : draft.model || DEFAULT_OLLAMA_CLOUD_MODEL
                }
                onChange={(e) => update({ model: e.target.value })}
                className={selectClass}
                disabled={loadingModels && modelOptions.length === 0}
              >
                {loadingModels && modelOptions.length === 0 ? (
                  <option value={draft.model || DEFAULT_OLLAMA_CLOUD_MODEL}>
                    Loading models…
                  </option>
                ) : null}
                {!modelOptions.includes(draft.model) && draft.model ? (
                  <option value={draft.model}>{draft.model}</option>
                ) : null}
                {modelOptions.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-[11px] text-slate-600">
              Full synthesis when evidence score is strong
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor={`${uid}-fast`}
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Fast / draft model
              </label>
              <button
                type="button"
                onClick={() => setCustomFast((v) => !v)}
                className="text-[10px] text-slate-500 hover:text-teal-400"
              >
                {customFast ? "Use list" : "Custom…"}
              </button>
            </div>
            {customFast ? (
              <input
                id={`${uid}-fast`}
                type="text"
                value={draft.fastModel}
                onChange={(e) => update({ fastModel: e.target.value })}
                className={selectClass}
                placeholder={DEFAULT_OLLAMA_CLOUD_FAST_MODEL}
                spellCheck={false}
              />
            ) : (
              <select
                id={`${uid}-fast`}
                value={
                  modelOptions.includes(draft.fastModel)
                    ? draft.fastModel
                    : draft.fastModel || draft.model || DEFAULT_OLLAMA_CLOUD_FAST_MODEL
                }
                onChange={(e) => update({ fastModel: e.target.value })}
                className={selectClass}
                disabled={loadingModels && modelOptions.length === 0}
              >
                {loadingModels && modelOptions.length === 0 ? (
                  <option
                    value={
                      draft.fastModel || draft.model || DEFAULT_OLLAMA_CLOUD_FAST_MODEL
                    }
                  >
                    Loading models…
                  </option>
                ) : null}
                {!modelOptions.includes(draft.fastModel) && draft.fastModel ? (
                  <option value={draft.fastModel}>{draft.fastModel}</option>
                ) : null}
                {modelOptions.map((m) => (
                  <option key={`fast-${m}`} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-1 text-[11px] text-slate-600">
              Thin-evidence drafts (score gate)
            </p>
          </div>
        </div>

        {canCallWithoutBrowserKey ? (
          <p className="text-[11px] text-slate-500">
            {loadingModels
              ? "Fetching models from Ollama Cloud…"
              : models.length > 0
                ? `${models.length} model(s) from API · choose above or enter custom`
                : modelsLoaded
                  ? "No models returned — use Custom or check your key"
                  : "Models load automatically when a key is available"}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-500"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => void onTest()}
            disabled={testing || !canCallWithoutBrowserKey}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900 disabled:opacity-40"
          >
            {testing ? "Testing…" : "Test connection"}
          </button>
          <button
            type="button"
            onClick={() => {
              setModelsLoaded(false);
              void loadModels();
            }}
            disabled={loadingModels || !canCallWithoutBrowserKey}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-900 disabled:opacity-40"
          >
            {loadingModels ? "Loading…" : "Refresh models"}
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-500 hover:border-rose-500/40 hover:text-rose-300"
          >
            Clear
          </button>
        </div>

        {status ? (
          <p className="text-sm text-teal-300/90" role="status">
            {status}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-rose-400" role="alert">
            {error}
          </p>
        ) : null}
      </form>

      {!compact ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/30 p-4 text-sm leading-relaxed text-slate-500">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            How it is used
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1">
            <li>
              Dossier synthesis uses <code className="text-slate-400">OLLAMA_CLOUD_API_KEY</code>{" "}
              from <code className="text-slate-400">.env</code> on the server, plus the model you
              pick here (passed on the build stream).
            </li>
            <li>
              Primary model for full dual-view synthesis; fast model when evidence is thin.
            </li>
            <li>
              Browser chat/test uses this form key or falls back to the server key.
            </li>
          </ul>
        </div>
      ) : null}
    </div>
  );
}
