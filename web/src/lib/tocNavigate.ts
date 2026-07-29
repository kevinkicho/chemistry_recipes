/**
 * Shared TOC / in-page section navigation.
 * Keeps CollapsibleSection free of component imports from the TOC chrome.
 */

/** CustomEvent name: collapsibles expand when TOC navigates to them */
export const TOC_NAVIGATE_EVENT = "toc-navigate";

function headerOffsetPx(): number {
  if (typeof document === "undefined") return 64;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--app-header-height")
    .trim();
  if (!raw) return 56;
  if (raw.endsWith("rem")) {
    const rem = parseFloat(raw) || 3.5;
    const root =
      parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return rem * root + 12;
  }
  const n = parseFloat(raw);
  return (Number.isFinite(n) ? n : 56) + 12;
}

/**
 * Assess whether a section id is present and has content.
 * Honors data-toc-empty="1|0" when set by CollapsibleSection / panels.
 */
export function assessTocSection(id: string): {
  present: boolean;
  hasContent: boolean;
} {
  if (typeof document === "undefined") {
    return { present: false, hasContent: false };
  }
  const el = document.getElementById(id);
  if (!el) return { present: false, hasContent: false };

  const flag = el.getAttribute("data-toc-empty");
  if (flag === "1" || flag === "true") {
    return { present: true, hasContent: false };
  }
  if (flag === "0" || flag === "false") {
    return { present: true, hasContent: true };
  }

  const text = (el.innerText || el.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 20) {
    return { present: true, hasContent: false };
  }
  if (
    text.length < 280 &&
    /\bno hits\b|\bno .* yet\b|awaiting\b|not available\b|no free evidence\b|no manufacturing summary\b|no ehs highlights\b|no process routes\b|insufficient public\b/i.test(
      text
    )
  ) {
    return { present: true, hasContent: false };
  }
  return { present: true, hasContent: true };
}

/**
 * Scroll window to a section, expand collapsibles, update hash.
 * Uses explicit offset for sticky header (more reliable than scrollIntoView alone).
 */
export function navigateToSection(id: string): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return false;
  }
  const el = document.getElementById(id);
  if (!el) return false;

  try {
    window.dispatchEvent(
      new CustomEvent(TOC_NAVIGATE_EVENT, { detail: { id } })
    );
  } catch {
    /* ignore */
  }

  const runScroll = () => {
    const target = document.getElementById(id);
    if (!target) return;
    const top =
      target.getBoundingClientRect().top + window.scrollY - headerOffsetPx();
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  runScroll();
  requestAnimationFrame(() => {
    requestAnimationFrame(runScroll);
  });
  window.setTimeout(runScroll, 80);

  try {
    window.history.replaceState(null, "", `#${id}`);
  } catch {
    /* ignore */
  }
  return true;
}
