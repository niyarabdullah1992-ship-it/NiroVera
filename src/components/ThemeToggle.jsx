
import React, { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";

/** Last applied mode, read before auth so the first paint does not flash. */
export const THEME_BOOT_KEY = "powercare_theme";

/** Per user and company, same shape as powercare_notif_kinds. */
export function themeStorageKey(companyId, userId) {
  return companyId && userId ? `powercare_theme_${companyId}_${userId}` : THEME_BOOT_KEY;
}

export function readThemeDark(companyId, userId) {
  if (typeof window === "undefined") return false;
  try {
    if (companyId && userId) return localStorage.getItem(themeStorageKey(companyId, userId)) === "dark";
    return localStorage.getItem(THEME_BOOT_KEY) === "dark";
  } catch {
    return false;
  }
}

export function applyTheme(dark, companyId, userId) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  const value = dark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_BOOT_KEY, value);
    if (companyId && userId) localStorage.setItem(themeStorageKey(companyId, userId), value);
  } catch {
    /* private mode */
  }
}

export default function ThemeToggle() {
  const { t, lang } = useI18n();
  const { company, currentUser } = useAuth();
  const companyId = company?.id;
  const userId = currentUser?.id;
  const ar = lang === "ar";
  const [dark, setDark] = useState(() => readThemeDark(companyId, userId));

  useEffect(() => {
    setDark(readThemeDark(companyId, userId));
  }, [companyId, userId]);

  useEffect(() => {
    applyTheme(dark, companyId, userId);
  }, [dark, companyId, userId]);

  const name = ar ? "وضعية الليل" : t("darkMode");

  return (
    <button
      type="button"
      onClick={() => setDark((value) => !value)}
      aria-label={name}
      title={dark ? t("lightMode") : name}
      aria-pressed={dark}
      className="nv-frame-iconbtn"
      style={{
        height: 32,
        width: 34,
        padding: 0,
        borderRadius: 9,
        border: "1px solid var(--nv-line, #E4E9E6)",
        background: "var(--nv-card)",
        color: "var(--nv-ink, #111418)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
        fontFamily: "inherit",
      }}
    >
      {dark
        ? <Sun style={{ width: 16, height: 16 }} strokeWidth={1.75} />
        : <Moon style={{ width: 16, height: 16 }} strokeWidth={1.75} />}
    </button>
  );
}
