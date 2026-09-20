
import React, { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const KEY = "powercare_theme";

export function readThemeDark() {
  if (typeof window === "undefined") return false;
  const saved = localStorage.getItem(KEY);
  if (saved === "dark" || saved === "light") return saved === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyTheme(dark) {
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  localStorage.setItem(KEY, dark ? "dark" : "light");
}

export default function ThemeToggle() {
  const { t } = useI18n();
  const [dark, setDark] = useState(readThemeDark);

  useEffect(() => {
    applyTheme(dark);
  }, [dark]);

  const label = dark ? t("lightMode") : t("darkMode");

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-label={label}
      title={label}
      aria-pressed={dark}
      style={{
        width: 34,
        height: 34,
        borderRadius: 10,
        border: "1px solid var(--nv-line, #E2E8F0)",
        background: "var(--nv-card, #fff)",
        color: "var(--nv-ink, #14284B)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {dark
        ? <Sun style={{ width: 15, height: 15 }} strokeWidth={1.75} />
        : <Moon style={{ width: 15, height: 15 }} strokeWidth={1.75} />}
    </button>
  );
}
