"use client";

import { useRouter } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { fetchPubChemAutocomplete } from "@/lib/api/pubchemAutocomplete";
import type { SuggestItem } from "@/lib/data/suggestions";
import { pushSearchQuery, readHistory } from "@/lib/search-history";
import { routes } from "@/lib/routes";

const DEBOUNCE_MS = 280;
const MAX_PUBCHEM = 8;
const MAX_HISTORY = 4;
const MAX_TOTAL = 16;

function recentHistorySuggestions(query: string): SuggestItem[] {
  const qLower = query.trim().toLowerCase();
  const recent = readHistory().filter((h) => h.kind === "search" && h.query);
  const out: SuggestItem[] = [];
  const seen = new Set<string>();

  for (const h of recent) {
    const value = h.query!.trim();
    const key = value.toLowerCase();
    if (!key || seen.has(key)) continue;
    if (qLower && !key.startsWith(qLower) && !key.includes(qLower)) continue;
    seen.add(key);
    out.push({ value, detail: "Recent search", kind: "history" });
    if (out.length >= MAX_HISTORY) break;
  }
  return out;
}

function mergeSuggestionLists(
  ...lists: SuggestItem[][]
): SuggestItem[] {
  const seen = new Set<string>();
  const out: SuggestItem[] = [];
  for (const list of lists) {
    for (const item of list) {
      const key = item.value.toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= MAX_TOTAL) return out;
    }
  }
  return out;
}

export function SearchForm({
  initialQuery = "",
  inputId,
}: {
  initialQuery?: string;
  inputId?: string;
}) {
  const router = useRouter();
  const listId = useId();
  const autoId = useId();
  const fieldId = inputId ?? autoId;
  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [q, setQ] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [suggestions, setSuggestions] = useState<SuggestItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestSources, setSuggestSources] = useState<string[]>([]);

  useEffect(() => {
    setQ(initialQuery);
  }, [initialQuery]);

  // Debounced multi-source autocomplete: history + PubChem + server fan-out
  useEffect(() => {
    const qTrim = q.trim();
    const history = recentHistorySuggestions(qTrim);

    // Empty field: history only
    if (qTrim.length < 2) {
      abortRef.current?.abort();
      setLoading(false);
      setSuggestError(null);
      setSuggestSources([]);
      setSuggestions(history);
      return;
    }

    // Numeric CID: direct open hint + history
    if (/^\d+$/.test(qTrim)) {
      abortRef.current?.abort();
      setLoading(false);
      setSuggestError(null);
      setSuggestSources(["cid"]);
      const cidItem: SuggestItem = {
        value: qTrim,
        detail: "PubChem CID · open compound",
        kind: "cid",
        href: routes.pubchem(qTrim),
      };
      const rest = history.filter((h) => h.value !== qTrim);
      setSuggestions([cidItem, ...rest].slice(0, MAX_HISTORY + 4));
      return;
    }

    setLoading(true);
    setSuggestError(null);
    // Show history immediately while free-public APIs load
    setSuggestions(mergeSuggestionLists(history));
    setSuggestSources(history.length ? ["history"] : []);

    const timer = window.setTimeout(() => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      void (async () => {
        // Parallel: browser PubChem autocomplete + server multi-suggest
        const [pc, multiRes] = await Promise.all([
          fetchPubChemAutocomplete(qTrim, MAX_PUBCHEM, ac.signal),
          fetch(
            `/api/search/suggest?q=${encodeURIComponent(qTrim)}&limit=14`,
            { signal: ac.signal, cache: "no-store" }
          )
            .then(async (r) => {
              if (!r.ok) return null;
              return (await r.json()) as {
                suggestions?: SuggestItem[];
                sourcesUsed?: string[];
              };
            })
            .catch(() => null),
        ]);

        if (ac.signal.aborted) return;
        setLoading(false);

        const pcItems: SuggestItem[] = (pc.terms || []).map((t) => ({
          value: t,
          detail: "PubChem · NIH",
          kind: "pubchem" as const,
        }));
        const multiItems = multiRes?.suggestions || [];
        const sources = new Set<string>([
          ...(history.length ? ["history"] : []),
          ...(pc.ok && pc.terms.length ? ["pubchem"] : []),
          ...(multiRes?.sourcesUsed || []),
        ]);
        setSuggestSources([...sources]);
        if (!pc.ok && pc.error && !multiItems.length) {
          setSuggestError(pc.error);
        } else {
          setSuggestError(null);
        }
        setSuggestions(mergeSuggestionLists(history, multiItems, pcItems));
      })();
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [q]);

  useEffect(() => {
    setHighlight(0);
  }, [suggestions]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = useCallback(
    (value: string, href?: string) => {
      const trimmed = value.trim();
      if (!trimmed && !href) return;
      setOpen(false);
      if (href) {
        if (trimmed) {
          setQ(trimmed);
          pushSearchQuery(trimmed);
        }
        router.push(href);
        return;
      }
      setQ(trimmed);
      pushSearchQuery(trimmed);
      router.push(routes.search(trimmed));
    },
    [router]
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const pick = open && suggestions[highlight] ? suggestions[highlight] : null;
    if (pick) {
      go(pick.value, pick.href);
      return;
    }
    go(q);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp") && suggestions.length) {
      setOpen(true);
      return;
    }
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown =
    open && (suggestions.length > 0 || loading || Boolean(suggestError));

  return (
    <div ref={rootRef} className="relative w-full">
      <form
        onSubmit={onSubmit}
        className="flex w-full flex-col gap-2 sm:flex-row"
        autoComplete="off"
      >
        <label className="sr-only" htmlFor={fieldId}>
          Search molecules
        </label>
        <div className="relative w-full flex-1">
          <input
            id={fieldId}
            type="search"
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={
              open && suggestions[highlight]
                ? `${listId}-opt-${highlight}`
                : undefined
            }
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="Name, CAS, SMILES, or PubChem CID…"
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-slate-100 placeholder:text-slate-500 focus:border-teal-500/60 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />

          {showDropdown && (
            <ul
              id={listId}
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 py-1 shadow-xl shadow-black/40"
            >
              {loading && (
                <li className="px-3 py-2 text-xs text-slate-500">
                  Multi-source suggestions
                  {suggestSources.length
                    ? ` (${suggestSources.slice(0, 4).join(", ")})`
                    : ""}
                  …
                </li>
              )}
              {suggestError && !loading && suggestions.length === 0 && (
                <li className="px-3 py-2 text-xs text-rose-400/90">
                  Autocomplete unavailable ({suggestError})
                </li>
              )}
              {suggestions.map((s, i) => {
                const active = i === highlight;
                return (
                  <li key={`${s.kind}-${s.value}-${i}`} role="presentation">
                    <button
                      type="button"
                      id={`${listId}-opt-${i}`}
                      role="option"
                      aria-selected={active}
                      className={`flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
                        active
                          ? "bg-teal-600/25 text-teal-50"
                          : "text-slate-200 hover:bg-slate-900"
                      }`}
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => go(s.value, s.href)}
                    >
                      <span className="font-medium break-words [overflow-wrap:anywhere]">
                        {s.value}
                      </span>
                      {s.detail && (
                        <span
                          className={`text-[11px] ${
                            active ? "text-teal-100/80" : "text-slate-500"
                          }`}
                        >
                          {s.detail}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <button
          type="submit"
          className="rounded-lg bg-teal-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-500"
        >
          Search
        </button>
      </form>
    </div>
  );
}
