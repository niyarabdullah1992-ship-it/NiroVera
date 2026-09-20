import React, { useRef, useState } from "react";
import PublicSignDocumentPanel from "@/components/files/PublicSignDocumentPanel";
import PublicSignSignaturePanel from "@/components/files/PublicSignSignaturePanel";
import { BORDER, CARD, STAGE } from "@/lib/platformStyles";

export default function PublicSignWorkspace({ signing, onOpenStudio }) {
  const signatureRef = useRef(null);
  const { ar, info, textValues, setTextValue } = signing;
  const [focusPage, setFocusPage] = useState(null);
  const railCol = "clamp(280px, 32%, 360px)";
  const docCol = "minmax(0, 1fr)";

  return (
    <section
      className="nv-public-sign-work"
      style={{
        flex: 1,
        minWidth: 0,
        maxWidth: "100%",
        minHeight: 0,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: ar ? `${railCol} ${docCol}` : `${docCol} ${railCol}`,
        gridTemplateAreas: ar ? `"rail doc"` : `"doc rail"`,
        background: STAGE,
      }}
    >
      <PublicSignDocumentPanel
        ar={ar}
        info={info}
        textValues={textValues}
        onTextChange={setTextValue}
        interactive
        focusPage={focusPage}
        stampPreview={signing.stampPreview}
        stampConfig={signing.stampConfig}
        onSignatureClick={() => signatureRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
      />
      <aside
        dir={ar ? "rtl" : "ltr"}
        style={{
          gridArea: "rail",
          minHeight: 0,
          minWidth: 0,
          overflow: "auto",
          background: CARD,
          borderLeft: `1px solid ${BORDER}`,
        }}
      >
        <div ref={signatureRef}>
          <PublicSignSignaturePanel
            {...signing}
            onFieldFocus={setFocusPage}
            onOpenStudio={onOpenStudio}
          />
        </div>
      </aside>
    </section>
  );
}
