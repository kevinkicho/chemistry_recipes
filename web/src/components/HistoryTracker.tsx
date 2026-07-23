"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { pushHistory, pushSearchQuery } from "@/lib/search-history";
import { isSearchPath, matchPubchemCid, routes } from "@/lib/routes";

function HistoryTrackerInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryKey = searchParams.toString();
  const lastRecorded = useRef<string>("");

  useEffect(() => {
    if (!pathname) return;

    const recordKey = `${pathname}?${queryKey}`;
    if (lastRecorded.current === recordKey) return;

    if (isSearchPath(pathname)) {
      const q = new URLSearchParams(queryKey).get("q")?.trim();
      if (q) {
        pushSearchQuery(q);
        lastRecorded.current = recordKey;
      }
      return;
    }

    const cid = matchPubchemCid(pathname);
    if (cid) {
      pushHistory({
        kind: "cid",
        label: `CID ${cid}`,
        href: routes.pubchem(cid),
      });
      lastRecorded.current = recordKey;
    }
  }, [pathname, queryKey]);

  return null;
}

export function HistoryTracker() {
  return (
    <Suspense fallback={null}>
      <HistoryTrackerInner />
    </Suspense>
  );
}
