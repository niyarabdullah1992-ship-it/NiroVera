import React from "react";
import { useNavigate } from "react-router-dom";
import PublicSignFlow from "@/components/files/PublicSignFlow";
import { useAuth } from "@/lib/PowerCareAuth";

function backToSigningList(navigate) {
  try {
    const from = document.referrer ? new URL(document.referrer) : null;
    if (from && from.origin === window.location.origin && from.pathname.startsWith("/app/signing") && window.history.length > 1) {
      navigate(-1);
      return;
    }
  } catch { /* ignore bad referrer */ }
  navigate("/app/signing?tab=mine");
}

export default function PublicSign() {
  const navigate = useNavigate();
  const { session } = useAuth();
  return (
    <PublicSignFlow
      variant="public"
      onBack={session ? () => backToSigningList(navigate) : undefined}
    />
  );
}
