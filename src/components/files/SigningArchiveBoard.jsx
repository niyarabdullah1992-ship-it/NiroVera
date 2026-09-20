import React from "react";
import SigningStatusBoard from "@/components/files/SigningStatusBoard";

// Archive uses the same compact list + bounded detail as Status.
export default function SigningArchiveBoard({
  requests,
  loading,
  currentUser,
  companyId,
  ar,
  lang,
  onReload,
  focusRequestId = "",
  sentLinks = [],
}) {
  return (
    <SigningStatusBoard
      requests={requests}
      loading={loading}
      currentUser={currentUser}
      companyId={companyId}
      ar={ar ?? lang === "ar"}
      onReload={onReload}
      focusRequestId={focusRequestId}
      sentLinks={sentLinks}
      variant="archive"
    />
  );
}
