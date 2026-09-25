import React from "react";
import { useI18n } from "@/lib/i18n";

export default function SuggestedQuestions({ onPick, disabled }) {
  const { t } = useI18n();
  const suggestions = [t("aiSuggest1"), t("aiSuggest2"), t("aiSuggest3"), t("aiSuggest4")];
  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((q) => (
        <button
          key={q}
          onClick={() => onPick(q)}
          disabled={disabled}
          className="px-3 py-1.5 rounded-full border border-[var(--nv-line)] bg-[var(--nv-card)] text-xs font-body text-[var(--nv-ink)] hover:bg-[var(--nv-soft)] hover:border-[var(--nv-ink)] disabled:opacity-50"
          dir="auto"
        >
          {q}
        </button>
      ))}
    </div>
  );
}