import React from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, BadgeCheck, UserRound } from "lucide-react";
import { useRailSide } from "@/lib/railSide";

const TILES = [
  {
    id: "tasks",
    to: "/app/tasks",
    manageAr: "المهام والعمليات",
    empAr: "مهامي",
    en: "Tasks",
    subAr: "أوامر العمل والإسناد",
    subEn: "Work orders and assignment",
    Icon: ClipboardList,
  },
  {
    id: "work-proof",
    to: "/app/work-proof",
    manageAr: "إثبات العمل",
    empAr: "إثبات العمل",
    en: "Work proof",
    subAr: "صور وموقع ووقت الإنجاز",
    subEn: "Photos, place, and time",
    Icon: BadgeCheck,
  },
  {
    id: "visitor-proof",
    to: "/app/visitor-proof",
    manageAr: "إثبات زائر",
    empAr: "إثبات زائر",
    en: "Visitor proof",
    subAr: "تسجيل دخول الزوّار وخروجهم",
    subEn: "Visitor check-in and check-out",
    Icon: UserRound,
  },
];

/** v7 daily switch: work order, outside-party proof, station guest. */
export default function OpsLaneTiles({ ar, current }) {
  const navigate = useNavigate();
  const employee = useRailSide() === "employee";
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
      {TILES.map((tile) => {
        const on = tile.id === current;
        const Icon = tile.Icon;
        const label = ar ? (employee && tile.id === "tasks" ? tile.empAr : tile.manageAr) : tile.en;
        const sub = ar ? tile.subAr : tile.subEn;
        return (
          <button
            key={tile.id}
            type="button"
            onClick={() => {
              if (!on) navigate(tile.to);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 12px",
              minWidth: 0,
              borderRadius: 10,
              boxSizing: "border-box",
              cursor: on ? "default" : "pointer",
              textAlign: "start",
              fontFamily: "inherit",
              ...(on
                ? { background: "#0B3D27", color: "#fff", border: "1px solid #0B3D27", boxShadow: "0 4px 12px rgba(6,61,38,.18)" }
                : { background: "#fff", color: "#111418", border: "1px solid #E4E9E6" }),
            }}
          >
            <Icon size={18} strokeWidth={1.75} color={on ? "#fff" : "#0B3D27"} />
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.35, minWidth: 0 }}>
              <strong style={{ fontSize: 13 }}>{label}</strong>
              <span style={{ fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: on ? "#C5DBCD" : "#555C66" }}>{sub}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
