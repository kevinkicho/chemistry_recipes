"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AiSettingsPanel } from "@/components/AiSettingsPanel";
import { Tooltip } from "@/components/Tooltip";
import { useAiConfig } from "@/hooks/useAiConfig";
import type { ServerAiStatus } from "@/lib/ai/client";

/** Compact header control: AI status + settings modal (not a separate page). */
export function AiStatusBadge({
  initialServerEnv,
}: {
  /** From Server Component so .env readiness matches first paint */
  initialServerEnv?: ServerAiStatus | null;
}) {
  const { configured, config, localConfigured, serverEnv, hydrated } =
    useAiConfig(initialServerEnv);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Deep link from /settings/ai → /?ai=1 opens the modal once
  useEffect(() => {
    if (searchParams.get("ai") === "1") {
      setOpen(true);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("ai");
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname || "/", { scroll: false });
    }
  }, [searchParams, pathname, router]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const title =
    !hydrated && !serverEnv?.envKeyConfigured
      ? "Checking AI configuration…"
      : configured
        ? localConfigured
          ? `AI ready · ${config.model} (browser key). Click to configure.`
          : `AI ready · ${serverEnv?.model || config.model} (.env ${serverEnv?.envKeySource || "key"}). Click to configure.`
        : "Configure Ollama Cloud AI (OLLAMA_CLOUD_API_KEY in .env or paste a key)";

  const modal =
    open && mounted
      ? createPortal(
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px]" aria-hidden />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="relative z-[121] flex max-h-[min(92vh,40rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950 shadow-2xl shadow-black/60"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <h2
                    id={titleId}
                    className="text-base font-semibold tracking-tight text-slate-50"
                  >
                    AI configuration
                  </h2>
                  <p className="mt-0.5 text-xs text-slate-500">Ollama Cloud · this browser</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-700 px-2.5 py-1 text-sm text-slate-300 hover:bg-slate-900 hover:text-white"
                >
                  Close
                </button>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
                <AiSettingsPanel initialServerEnv={initialServerEnv} compact />
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <Tooltip content={title} multiline>
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={title}
          onClick={() => setOpen(true)}
          className={`rounded-md px-2.5 py-1.5 text-sm transition-colors ${
            configured
              ? "text-teal-300 hover:bg-teal-500/10"
              : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          } ${open ? "bg-teal-500/10 text-teal-200" : ""}`}
        >
          AI
          <span
            className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
              configured ? "bg-teal-400" : "bg-slate-600"
            }`}
            aria-hidden
          />
        </button>
      </Tooltip>
      {modal}
    </>
  );
}
