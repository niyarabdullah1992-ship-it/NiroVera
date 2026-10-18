import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Bring a section into view when the address names it (`…#nv-ministry-offboarding`). ScrollToTop
 * tries once right after navigation; a panel that renders after its data loads asks again on mount.
 */
export default function useHashScroll(id) {
  const { hash } = useLocation();
  useEffect(() => {
    if (!id || hash !== `#${id}`) return undefined;
    const timer = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [id, hash]);
}
