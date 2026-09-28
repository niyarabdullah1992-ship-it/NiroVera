import React, { useMemo, useState } from "react";
import { OrgWorkforceCol, OrgWorkforceNodeCard, ORG_NODE_W, ORG_TREE_LINE } from "@/components/hr/orgUi";

function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  return parts.slice(0, 2).map((part) => part.slice(0, 1)).join("");
}

/** Management skeleton stays open. A pile of leaf cards stays behind the count. */
function skeletonOpen(node) {
  const kids = node?.children || [];
  if (!kids.length) return false;
  const allLeaves = kids.every((child) => !(child.children || []).length);
  if (allLeaves && kids.length > 4) return false;
  return true;
}

function pathMap(roots, focusId) {
  const map = new Map();
  const key = String(focusId || "");
  const walk = (nodes, trail) => {
    for (const node of nodes || []) {
      const next = [...trail, node];
      if (String(node.id) === key || String(node.employeeId || "") === key) {
        next.forEach((item, index) => {
          const child = next[index + 1];
          if (child) map.set(item.id, child.id);
        });
        return true;
      }
      if (walk(node.children || [], next)) return true;
    }
    return false;
  };
  walk(roots, []);
  return map;
}

/**
 * Horizontal seat tree — HTML workforce card row, stem, and sibling connectors.
 * `full` draws every seat. `spine` draws only the path to focusId.
 * Otherwise the management skeleton is open and large leaf groups stay folded.
 */
export default function OrgWorkforceChart({
  roots = [],
  full = false,
  spine = false,
  focusId = "",
  selectedId = "",
  ar = true,
  canHire = false,
  onSelect,
  onOpenDetails,
  byGrade = false,
  dense = false,
}) {
  const [opened, setOpened] = useState(() => new Set());
  const [closed, setClosed] = useState(() => new Set());
  const spineNext = useMemo(() => (spine && !full ? pathMap(roots, focusId) : new Map()), [spine, full, roots, focusId]);

  const shownKids = (node) => {
    const kids = node?.children || [];
    if (!kids.length) return [];
    if (closed.has(node.id) && !full) return [];
    if (full || opened.has(node.id)) return kids;
    if (spine) {
      const next = spineNext.get(node.id);
      return next ? kids.filter((child) => child.id === next) : [];
    }
    if (skeletonOpen(node)) return kids;
    return [];
  };

  const toggle = (node) => {
    const kids = node?.children || [];
    if (!kids.length) return;
    const visible = shownKids(node).length > 0;
    setOpened((current) => {
      const next = new Set(current);
      if (visible) next.delete(node.id);
      else next.add(node.id);
      return next;
    });
    setClosed((current) => {
      const next = new Set(current);
      if (visible) next.add(node.id);
      else next.delete(node.id);
      return next;
    });
  };

  const Seat = ({ node, index = null, total = 0, flatParent = false, depth = 0 }) => {
    if (!node || depth > 12) return null;
    const kids = shownKids(node);
    const flat = kids.length >= 3 && kids.every((child) => !(child.children || []).length);
    const single = total <= 1;
    const showBar = index != null && !single && !flatParent;
    const selected = String(selectedId || "") === String(node.id) || String(selectedId || "") === String(node.employeeId || "");
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}>
        {index != null ? (
          <>
            <div
              aria-hidden
              style={{
                height: 2,
                background: ORG_TREE_LINE,
                alignSelf: "stretch",
                display: showBar ? "block" : "none",
                marginInlineStart: index === 0 ? "50%" : 0,
                marginInlineEnd: index === total - 1 ? "50%" : 0,
              }}
            />
            <div
              aria-hidden
              style={{
                width: 2,
                height: 22,
                background: ORG_TREE_LINE,
                display: flatParent ? "none" : "block",
              }}
            />
          </>
        ) : null}
        <OrgWorkforceCol>
          <OrgWorkforceNodeCard
            name={node.name}
            title={node.title}
            kind={node.kind}
            kindTag={node.kindTag}
            empLine={node.empLine}
            grade={node.grade}
            gradeTip={node.gradeTip}
            gradeIndex={node.gradeIndex}
            unit={node.unit}
            unitTip={node.unitTip}
            branchFace={node.branchFace || ""}
            unitNavy={node.unitNavy}
            byGrade={byGrade}
            count={node.direct > 0 ? `${node.direct} / ${node.total}` : ""}
            countOpen={kids.length > 0}
            onCountClick={node.direct > 0 ? (event) => {
              event.stopPropagation();
              toggle(node);
            } : undefined}
            onNameClick={() => {
              onSelect?.(node);
              if (node?.employeeId) onOpenDetails?.(node);
            }}
            onDetails={() => onOpenDetails?.(node)}
            onClick={() => {
              onSelect?.(node);
              onOpenDetails?.(node);
            }}
            onDoubleClick={() => onOpenDetails?.(node)}
            selected={selected}
            isMe={Boolean(node.isMe)}
            acting={Boolean(node.acting)}
            actingText={node.actingText}
            servesText={node.servesText || ""}
            hrLine={node.hrLine || ""}
            tone={node.tone}
            vacant={Boolean(node.vacant)}
            kindLock={Boolean(node.kindLock)}
            bandLabel={node.bandLabel || ""}
            hireStamp={node.hireStamp || ""}
            hireTip={node.hireTip || ""}
            vacantTag={node.vacant ? (canHire ? (ar ? "وظّف من هنا" : "Hire here") : (ar ? "شاغرة" : "Vacant")) : ""}
            coordinate={node.coordinate || ""}
            dense={dense}
            avatarUrl={node.avatarUrl}
            initials={node.vacant ? "＋" : initialsOf(node.name)}
            meLabel={ar ? "أنت هنا" : "You are here"}
            detailsTitle={ar ? "ملف الموظف" : "Employee file"}
            countTitle={ar ? "مباشرون / إجمالي — انقر للتفرّع" : "Direct / total — click to expand"}
          />
        </OrgWorkforceCol>
        {kids.length ? (
          <>
            <div aria-hidden style={{ width: 2, height: 22, background: ORG_TREE_LINE }} />
            <div
              style={flat
                ? {
                    display: "grid",
                    gridTemplateColumns: "repeat(2, max-content)",
                    gap: 12,
                    justifyContent: "center",
                    alignItems: "start",
                    padding: 12,
                    border: "1px dashed #C9D6CE",
                    borderRadius: 8,
                    background: "color-mix(in srgb, var(--nv-card, #fff) 60%, transparent)",
                  }
                : { display: "flex", alignItems: "flex-start", justifyContent: "center" }}
            >
              {kids.map((child, childIndex) => (
                <Seat
                  key={child.id}
                  node={child}
                  index={childIndex}
                  total={kids.length}
                  flatParent={flat}
                  depth={depth + 1}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    );
  };

  if (!roots.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "max-content", padding: "6px 10px 10px" }}>
      {roots.length === 1 ? (
        <Seat node={roots[0]} />
      ) : (
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
          {roots.map((node, index) => (
            <Seat key={node.id} node={node} index={index} total={roots.length} />
          ))}
        </div>
      )}
    </div>
  );
}
