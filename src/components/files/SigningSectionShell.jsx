import React from "react";
import SigningSectionFrame from "@/components/files/SigningSectionFrame";

/** Signing uses the institutional flush frame applied today — not the rounded stamp well. */
export default function SigningSectionShell(props) {
  return <SigningSectionFrame {...props} />;
}
