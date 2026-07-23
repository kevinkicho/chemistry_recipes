"use client";

import { useEffect } from "react";

/**
 * Measures #app-header and sets --app-header-height for sticky sidebars / scroll-margin.
 */
export function HeaderHeightSync() {
  useEffect(() => {
    const el = document.getElementById("app-header");
    if (!el) return;

    const apply = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      document.documentElement.style.setProperty("--app-header-height", `${h}px`);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    window.addEventListener("resize", apply);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", apply);
    };
  }, []);

  return null;
}
