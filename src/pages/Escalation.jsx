import React from "react";
import { Navigate } from "react-router-dom";

/** التصعيد lives inside المهام now: the side list, the «صُعّدت» filter, each order's chain, and the branch ladders. */
export default function Escalation() {
  return <Navigate to="/app/tasks?lane=manage&filter=escalated" replace />;
}
