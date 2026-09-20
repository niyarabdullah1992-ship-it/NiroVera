import React from "react";
import { NAVY } from "@/lib/platformStyles";

/** Download (or open) a consent attachment stored as a data URL or public path. */
export default function ConsentFileLink({ file, ar, children, style }) {
  if (!file?.url) return null;
  const remote = /^https?:/i.test(file.url) || file.url.startsWith("/");
  return (
    <a
      href={file.url}
      download={file.name || (ar ? "مرفق-الموافقة" : "consent-file")}
      target={remote ? "_blank" : undefined}
      rel={remote ? "noreferrer" : undefined}
      style={{ fontSize: 11, fontWeight: 600, color: NAVY, textDecoration: "none", ...style }}
    >
      {children || (ar ? `نزّل ${file.name || "الملف"}` : `Download ${file.name || "file"}`)}
    </a>
  );
}
