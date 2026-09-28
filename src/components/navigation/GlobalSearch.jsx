import React, { useEffect, useMemo, useState } from "react";
import { Search, Users, Radio, CornerDownLeft, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SearchResults from "@/components/navigation/SearchResults";
import { visibleEmployees, visibleStations } from "@/lib/permissions";
import { BORDER, MUTED, NAVY, NAVY_FILL, dialogOverlay, CARD } from "@/lib/platformStyles";
import { identityFrame } from "@/components/shared/IdentityCard";
import { openHireDrawer } from "@/lib/orgHire";
import { searchGroupLabel } from "@/lib/suiteNav";
import { employeeMoneyHref, useRailSide } from "@/lib/railSide";

function groupLabel(category, ar) {
  return searchGroupLabel(category, ar ? "ar" : "en");
}

export default function GlobalSearch({ open, onClose, items, data, currentUser, lang }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const railSide = useRailSide();
  const ar = lang === "ar";

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  const results = useMemo(() => {
    const text = query.trim().toLocaleLowerCase();
    const canPeople = items.some((item) => item.to === "/app/hr" || item.to === "/app/org");
    const hireAction = canPeople
      ? [{
          id: "hire-employee",
          type: "action",
          action: "hire",
          label: ar ? "أضف موظف" : "Add employee",
          subtitle: ar ? "من المنصب — خطوتان" : "From the seat — two steps",
          icon: UserPlus,
          to: "/app/org?hire=1",
        }]
      : [];
    const hireHit = !text
      || "أضف موظف".includes(text)
      || "اضف موظف".includes(text)
      || "add employee".includes(text)
      || "hire".includes(text)
      || (ar ? text.includes("موظف") || text.includes("أضف") : text.includes("add") || text.includes("employee"));

    if (!text) return hireAction;

    const pages = items
      .filter((item) => {
        const group = groupLabel(item.category, ar).toLocaleLowerCase();
        return item.label.toLocaleLowerCase().includes(text) || group.includes(text);
      })
      .map((item) => ({
        id: item.to,
        type: "page",
        label: item.label,
        subtitle: groupLabel(item.category, ar),
        icon: item.icon,
        to: railSide === "employee" ? (employeeMoneyHref(item.appId || item.to) || item.to) : item.to,
      }));

    const employeeScope = canPeople ? visibleEmployees(currentUser, data) : [currentUser].filter(Boolean);
    const employees = employeeScope
      .filter((employee) => employee.name?.toLocaleLowerCase().includes(text))
      .map((employee) => ({
        id: employee.id,
        type: "employee",
        label: employee.name,
        subtitle: ar ? "موظف" : "Employee",
        icon: Users,
        to: `/app/employees/${employee.id}`,
      }));

    const canStations = items.some((item) => item.to === "/app/org");
    const stations = canStations
      ? visibleStations(currentUser, data)
          .filter((station) => station.name?.toLocaleLowerCase().includes(text))
          .map((station) => ({
            id: station.id,
            type: "station",
            label: station.name,
            subtitle: ar ? "فرع" : "Station",
            icon: Radio,
            to: "/app/org",
          }))
      : [];

    return [...(hireHit ? hireAction : []), ...pages, ...employees, ...stations].slice(0, 8);
  }, [query, items, data, lang, currentUser, ar, railSide]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  const select = (result) => {
    if (!result) return;
    if (result.action === "hire") {
      navigate("/app/org?hire=1");
      openHireDrawer({});
      onClose();
      return;
    }
    navigate(result.to);
    onClose();
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(Math.max(results.length - 1, 0), i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      select(results[active]);
    }
  };

  const typed = query.trim().length > 0;

  return (
    <div
      style={{ ...dialogOverlay, alignItems: "flex-start", paddingTop: "18vh" }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        style={{
          ...identityFrame,
          width: 380,
          maxWidth: "calc(100vw - 32px)",
          minWidth: 0,
          alignSelf: "center",
          boxShadow: "0 24px 60px rgba(20,40,75,.22)",
        }}
        dir={ar ? "rtl" : "ltr"}
      >
        <div aria-hidden style={{ height: 3, background: NAVY_FILL }} />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderBottom: `1px solid ${BORDER}`,
            background: CARD,
          }}
        >
          <Search style={{ width: 16, height: 16, color: MUTED, flexShrink: 0 }} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={ar ? "ابحث عن قسم أو موظف أو فرع…" : "Search sections, employees or stations…"}
            style={{
              flex: 1,
              height: 32,
              minHeight: 32,
              border: "none",
              background: "transparent",
              color: NAVY,
              fontSize: 13,
              fontFamily: "inherit",
              outline: "none",
              minWidth: 0,
            }}
          />
        </div>
        <SearchResults
          results={results}
          active={active}
          onSelect={select}
          onHover={setActive}
          lang={lang}
          idle={!typed}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderTop: `1px solid ${BORDER}`,
            fontSize: 10,
            color: MUTED,
            background: CARD,
          }}
        >
          <CornerDownLeft style={{ width: 11, height: 11 }} />
          {typed
            ? (ar ? "Enter للانتقال" : "Enter to open")
            : (ar ? "⌘K · أضف موظف أو ابحث" : "⌘K · add an employee or search")}
        </div>
      </div>
    </div>
  );
}
