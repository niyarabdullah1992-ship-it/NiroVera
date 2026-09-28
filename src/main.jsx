import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/App.jsx";
import "@/index.css";

class BootErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("NiroVera boot error:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const err = this.state.error;
    const msg = String(err?.message || err || "Unknown error");
    const stack = String(err?.stack || "");
    return (
      <div dir="rtl" style={{ padding: 24, fontFamily: "'IBM Plex Sans Arabic',sans-serif", color: "var(--nv-ink)", maxWidth: 720, margin: "40px auto" }}>
        <h1 style={{ fontSize: 20, margin: "0 0 8px" }}>تعذر تشغيل نيروفيرا</h1>
        <p style={{ fontSize: 13, color: "var(--nv-muted)", margin: "0 0 12px" }}>انسخ النص أدناه ثم أعد تحميل الصفحة.</p>
        <pre dir="ltr" style={{ whiteSpace: "pre-wrap", background: "var(--nv-soft)", padding: 12, borderRadius: 8, fontSize: 12, lineHeight: 1.5 }}>
          {msg}{stack ? `\n\n${stack}` : ""}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ marginTop: 12, height: 40, padding: "0 16px", border: "1px solid var(--nv-navy)", background: "var(--nv-navy)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}
        >
          إعادة التحميل
        </button>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BootErrorBoundary>
    <App />
  </BootErrorBoundary>,
);
