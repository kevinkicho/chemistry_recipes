"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_AI_CONFIG,
  isAiConfigured,
  readAiConfig,
  subscribeAiConfig,
  writeAiConfig,
  type AiConfig,
} from "@/lib/ai/config";
import { fetchServerAiStatus, type ServerAiStatus } from "@/lib/ai/client";

/**
 * AI config hook — hydration-safe.
 * Never reads localStorage during the initial render (server and client must match).
 * Optional initialServerEnv from a Server Component avoids a flash when .env has a key.
 */
export function useAiConfig(initialServerEnv?: ServerAiStatus | null) {
  // Always default first paint — localStorage only after mount
  const [config, setConfig] = useState<AiConfig>(() => ({ ...DEFAULT_AI_CONFIG }));
  const [server, setServer] = useState<ServerAiStatus | null>(
    () => initialServerEnv ?? null
  );
  const [hydrated, setHydrated] = useState(false);

  const reloadServer = useCallback(async () => {
    const s = await fetchServerAiStatus();
    if (s) setServer(s);
  }, []);

  useEffect(() => {
    setConfig(readAiConfig());
    setHydrated(true);
    void reloadServer();
    return subscribeAiConfig(() => setConfig(readAiConfig()));
  }, [reloadServer]);

  const save = useCallback((next: AiConfig) => {
    writeAiConfig(next);
    setConfig(readAiConfig());
  }, []);

  // Browser key only counts after hydration (localStorage available)
  const localConfigured = hydrated && isAiConfigured(config);
  /** Ready if browser key is set, or server .env has OLLAMA_CLOUD_API_KEY */
  const configured = localConfigured || Boolean(server?.envKeyConfigured);

  return {
    config,
    save,
    configured,
    localConfigured,
    serverEnv: server,
    /** False until client has applied localStorage */
    hydrated,
    reload: () => {
      setConfig(readAiConfig());
      void reloadServer();
    },
  };
}
