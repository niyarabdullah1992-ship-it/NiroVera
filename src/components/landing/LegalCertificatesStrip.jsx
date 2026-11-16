import React from "react";
import { Building2, ExternalLink, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { IP_CERTIFICATE, IP_CERTIFICATE_URL, ipCertificateTranslations } from "@/lib/ipCertificateTranslations";
import { CR_CERTIFICATE, CR_CERTIFICATE_URL, crCertificateTranslations } from "@/lib/crCertificate";

function CertDialog({ lang, title, intro, details, href, view, note, children }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent dir={lang === "ar" ? "rtl" : "ltr"} className="max-h-[90vh] overflow-y-auto border-[var(--nv-line)] bg-[var(--nv-card)] sm:max-w-xl">
        <DialogHeader className="text-start">
          <DialogTitle className="text-2xl text-[var(--nv-ink)]">{title}</DialogTitle>
          <DialogDescription>{intro}</DialogDescription>
        </DialogHeader>
        <dl className="divide-y divide-[var(--nv-line)] rounded-xl border border-[var(--nv-line)] bg-[var(--nv-soft)] px-4">
          {details.map(([label, value]) => (
            <div key={label} className="grid gap-1 py-3 sm:grid-cols-[10rem,1fr]">
              <dt className="text-xs text-[var(--nv-muted)]">{label}</dt>
              <dd className="text-sm font-medium text-[var(--nv-ink)]">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs leading-relaxed text-[var(--nv-muted)]">{note}</p>
        <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-[9px] bg-[var(--nv-accent)] px-4 py-2.5 text-sm font-semibold text-white">
          {view}
          <ExternalLink className="h-4 w-4" />
        </a>
      </DialogContent>
    </Dialog>
  );
}

// forwardRef: CertDialog mounts this via Radix <DialogTrigger asChild>, which
// clones the child and hands it a ref plus the open handler. A plain function
// component drops both (ref warning + dead trigger); forward them to the button.
const Row = React.forwardRef(function Row({ icon, title, caption, value, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...props}
      style={{
        width: "100%",
        height: "100%",
        display: "grid",
        gridTemplateColumns: "36px minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 12,
        padding: "14px 16px",
        background: "transparent",
        border: "none",
        color: "inherit",
        cursor: "pointer",
        textAlign: "start",
        fontFamily: "inherit",
      }}
    >
      <span
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(255,255,255,.08)",
          color: "#6EE7B7",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#fff", lineHeight: 1.35 }}>{title}</span>
        <span style={{ display: "block", marginTop: 3, fontSize: 11, color: "rgba(255,255,255,.5)", lineHeight: 1.4 }}>{caption}</span>
      </span>
      <span dir="ltr" style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.72)", fontFamily: "'IBM Plex Sans',sans-serif", whiteSpace: "nowrap" }}>
        {value}
      </span>
    </button>
  );
});

export default function LegalCertificatesStrip({ lang }) {
  const ip = ipCertificateTranslations[lang] || ipCertificateTranslations.en;
  const cr = crCertificateTranslations[lang] || crCertificateTranslations.en;
  const ar = lang === "ar";

  return (
    <div
      data-nv="cert-grid"
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 12,
        background: "rgba(255,255,255,.04)",
        overflow: "hidden",
      }}
    >
      <div style={{ borderInlineEnd: "1px solid rgba(255,255,255,.1)" }}>
        <CertDialog
          lang={lang}
          title={ip.title}
          intro={ip.intro}
          href={IP_CERTIFICATE_URL}
          view={ip.view}
          note={ip.note}
          details={[
            [ip.registration, IP_CERTIFICATE.registration],
            [ip.work, IP_CERTIFICATE.work],
            [ip.category, ip.categoryValue],
            [ip.author, ar ? IP_CERTIFICATE.authorAr : IP_CERTIFICATE.authorEn],
            [ip.date, ar ? `${IP_CERTIFICATE.date} · ${IP_CERTIFICATE.dateHijri}` : IP_CERTIFICATE.date],
          ]}
        >
          <Row icon={<ShieldCheck size={16} />} title={ip.title} caption={ip.badge} value={IP_CERTIFICATE.registration} />
        </CertDialog>
      </div>
      <CertDialog
        lang={lang}
        title={cr.title}
        intro={cr.intro}
        href={CR_CERTIFICATE_URL}
        view={cr.view}
        note={cr.note}
        details={[
          [cr.number, CR_CERTIFICATE.number],
          [cr.entity, ar ? CR_CERTIFICATE.entityAr : CR_CERTIFICATE.entityEn],
          [cr.type, ar ? CR_CERTIFICATE.typeAr : CR_CERTIFICATE.typeEn],
          [cr.status, ar ? CR_CERTIFICATE.statusAr : CR_CERTIFICATE.statusEn],
          [cr.date, CR_CERTIFICATE.issued],
        ]}
      >
        <Row icon={<Building2 size={16} />} title={cr.title} caption={cr.badge} value={CR_CERTIFICATE.number} />
      </CertDialog>
    </div>
  );
}
