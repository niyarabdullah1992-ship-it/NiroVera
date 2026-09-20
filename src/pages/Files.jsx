import React, { useState, useRef, useEffect } from "react";
import MobileSelect from "@/components/mobile/MobileSelect";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { addFileFolder, addCompanyFile, deleteFileNode, renameFileNode } from "@/lib/store";
import { visibleStations } from "@/lib/permissions";
import { base44 } from "@/api/base44Client";
import { FolderPlus, Upload, Loader2, ChevronRight, ChevronLeft, Home } from "lucide-react";
import FolderCard from "@/components/files/FolderCard";
import FileRow from "@/components/files/FileRow";
import NewFolderDialog from "@/components/files/NewFolderDialog";
import StationFilesCard from "@/components/files/StationFilesCard";
import useStationScope from "@/hooks/useStationScope";
import { stationInHeaderScope } from "@/lib/stationTree";
import PlatformStampShell from "@/components/shared/PlatformStampShell";
import KpiStrip from "@/components/shared/KpiStrip";
import { pageKicker } from "@/lib/moduleMeta";
import { MUTED, NAVY, emptyState, ui } from "@/lib/platformStyles";

function FolderBrowser({
  isIndividual,
  pageTitle,
  canManageFiles,
  path,
  setPath,
  stationFilter,
  setStationFilter,
  isStationScoped,
  headerScope,
  myStations,
  currentUser,
  company,
  t,
  lang,
  activeStationName,
  showStationFolders,
  folders,
  files,
  childrenOf,
  stationName,
  stationItemCount,
  Chevron,
  uploading,
  fileInputRef,
  handleUpload,
  folderDialogOpen,
  setFolderDialogOpen,
}) {
  const crumb = {
    ...ui.btnGhost,
    border: "none",
    background: "transparent",
    padding: "4px 6px",
    height: "auto",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 4, fontSize: 13 }}>
        <button
          type="button"
          onClick={() => { setPath([]); if (!isIndividual && !isStationScoped) setStationFilter("all"); }}
          style={{ ...crumb, color: path.length === 0 && !activeStationName ? NAVY : MUTED, fontWeight: path.length === 0 && !activeStationName ? 600 : 500 }}
        >
          <Home style={{ width: 14, height: 14 }} />
          {pageTitle}
        </button>
        {activeStationName && (
          <>
            <Chevron style={{ width: 14, height: 14, color: MUTED }} />
            <button type="button" onClick={() => setPath([])} style={{ ...crumb, color: path.length === 0 ? NAVY : MUTED, fontWeight: path.length === 0 ? 600 : 500 }} dir="auto">
              {activeStationName}
            </button>
          </>
        )}
        {path.map((folder, i) => (
          <React.Fragment key={folder.id}>
            <Chevron style={{ width: 14, height: 14, color: MUTED }} />
            <button
              type="button"
              onClick={() => setPath(path.slice(0, i + 1))}
              style={{ ...crumb, color: i === path.length - 1 ? NAVY : MUTED, fontWeight: i === path.length - 1 ? 600 : 500 }}
              dir="auto"
            >
              {folder.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {canManageFiles && !showStationFolders && (
          <button type="button" onClick={() => setFolderDialogOpen(true)} style={{ ...ui.btnSecondary, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <FolderPlus style={{ width: 14, height: 14 }} />
            {t("newFolder")}
          </button>
        )}
        {canManageFiles && !showStationFolders && (
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ ...ui.btnPrimary, display: "inline-flex", alignItems: "center", gap: 6, opacity: uploading ? 0.6 : 1 }}>
            {uploading ? <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> : <Upload style={{ width: 14, height: 14 }} />}
            {uploading ? t("uploading") : t("uploadFileBtn")}
          </button>
        )}
        {canManageFiles && <input ref={fileInputRef} type="file" multiple style={{ display: "none" }} onChange={handleUpload} />}
        {!isIndividual && headerScope === "all" && (
          <div style={{ marginInlineStart: "auto", minWidth: 180 }}>
            <MobileSelect
              value={stationFilter}
              onChange={(value) => { setStationFilter(value); setPath([]); }}
              placeholder={t("filesAllStations")}
              searchable
              searchPlaceholder={t("search")}
              options={isStationScoped
                ? [
                    ...(!currentUser?.stationId && myStations.length === 0 ? [{ value: "hq", label: t("hq") }] : []),
                    ...myStations.map((station) => ({ value: station.id, label: station.name })),
                  ]
                : [
                    { value: "all", label: t("filesAllStations") },
                    { value: "hq", label: t("hq") },
                    ...myStations.map((station) => ({ value: station.id, label: station.name })),
                  ]}
            />
          </div>
        )}
      </div>

      {showStationFolders && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: MUTED }}>{lang === "ar" ? "الفروع" : "Stations"}</p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
            {myStations.map((station) => (
              <StationFilesCard key={station.id} station={station} count={stationItemCount(station.id)} onOpen={() => { setStationFilter(station.id); setPath([]); }} />
            ))}
          </div>
        </div>
      )}

      {!showStationFolders && folders.length > 0 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: MUTED }}>{t("foldersLabel")}</p>
          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
            {folders.map((folder) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                count={childrenOf(folder.id).length}
                onOpen={() => setPath([...path, folder])}
                onDelete={canManageFiles ? () => deleteFileNode(company.id, folder.id) : undefined}
                onRename={canManageFiles ? (name) => renameFileNode(company.id, folder.id, name) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {!showStationFolders && files.length > 0 && (
        <div>
          <p style={{ margin: "0 0 8px", fontSize: 11, color: MUTED }}>{t("attachments")}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {files.map((file) => (
              <FileRow key={file.id} file={file} stationName={isIndividual ? null : stationName(file.stationId)} onDelete={canManageFiles ? () => deleteFileNode(company.id, file.id) : undefined} onRename={canManageFiles ? (name) => renameFileNode(company.id, file.id, name) : undefined} />
            ))}
          </div>
        </div>
      )}

      {!showStationFolders && folders.length === 0 && files.length === 0 && (
        <div style={emptyState}>
          {t("emptyFolderNote")}
        </div>
      )}

      {canManageFiles && !showStationFolders && (
        <NewFolderDialog
          open={folderDialogOpen}
          onOpenChange={setFolderDialogOpen}
          onCreate={(name) => addFileFolder(company.id, {
            name,
            parentId: path.length ? path[path.length - 1].id : null,
            stationId: stationFilter !== "all" && stationFilter !== "hq" ? stationFilter : currentUser?.stationId || null,
          })}
        />
      )}
    </div>
  );
}

export default function Files() {
  const { t, dir, lang } = useI18n();
  const { company, data, currentUser } = useAuth();
  const isIndividual = String(data?.plan || company?.plan || "").toLowerCase() === "individual";
  const pageTitle = isIndividual ? (lang === "ar" ? "ملفاتي" : "My Files") : t("companyFiles");
  const canManageFiles = isIndividual || data?.ownerId === currentUser?.id || ["director", "ops_manager"].includes(currentUser?.role);
  const [path, setPath] = useState([]);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const myStations = visibleStations(currentUser, data || { stations: [] });
  const isStationScoped = ["station_manager", "pgm", "employee"].includes(currentUser?.role);
  const headerScope = useStationScope();
  const defaultStation = isStationScoped ? (currentUser.stationId || myStations[0]?.id || "all") : "all";
  const [stationFilter, setStationFilter] = useState(defaultStation);

  useEffect(() => {
    if (!isIndividual && headerScope && headerScope !== "all") {
      setStationFilter(headerScope);
    }
  }, [headerScope, isIndividual]);

  useEffect(() => {
    const onReset = (e) => { if (e.detail === "/app/files") setPath([]); };
    window.addEventListener("powercare:tab-reset", onReset);
    return () => window.removeEventListener("powercare:tab-reset", onReset);
  }, []);

  const nodes = data?.files || [];
  const currentId = path.length ? path[path.length - 1].id : null;
  const childrenOf = (id) => nodes.filter((n) => (n.parentId || null) === id);
  const matchesStation = (node) => {
    if (isIndividual || stationFilter === "all") return true;
    const scopeId = stationFilter === "all" ? null : stationFilter;
    if (!scopeId) return true;
    return stationInHeaderScope(node.stationId, scopeId, data?.stations);
  };
  const folders = childrenOf(currentId).filter((node) => node.type === "folder" && matchesStation(node));
  const files = childrenOf(currentId).filter((node) => node.type === "file" && matchesStation(node));
  const stationName = (id) => data?.stations?.find((s) => s.id === id)?.name || null;
  const showStationFolders = !isIndividual && stationFilter === "all" && path.length === 0;
  const activeStationName = stationFilter !== "all" ? stationName(stationFilter) : null;
  const stationItemCount = (stationId) => nodes.filter((node) => node.stationId === stationId).length;
  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;

  const handleUpload = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setUploading(true);
    try {
      for (const file of selected) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const linkedStation =
          stationFilter !== "all" && stationFilter !== "hq"
            ? stationFilter
            : currentUser?.stationId || null;
        addCompanyFile(company.id, {
          name: file.name, parentId: currentId, url: file_url,
          size: file.size, mimeType: file.type, uploadedBy: currentUser?.name || "",
          stationId: linkedStation,
        });
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const browserProps = {
    isIndividual,
    pageTitle,
    canManageFiles,
    path,
    setPath,
    stationFilter,
    setStationFilter,
    isStationScoped,
    headerScope,
    myStations,
    currentUser,
    company,
    t,
    lang,
    activeStationName,
    showStationFolders,
    folders,
    files,
    childrenOf,
    stationName,
    stationItemCount,
    Chevron,
    uploading,
    fileInputRef,
    handleUpload,
    folderDialogOpen,
    setFolderDialogOpen,
  };

  return (
    <PlatformStampShell
      ar={lang === "ar"}
      kicker={pageKicker("/app/files", lang)}
      title={pageTitle}
      hint={lang === "ar" ? "أرشيف المستندات هنا فقط. التوقيع والإثبات والحضور لكل منها قسمه." : "Document archive only. Signing, proof, and attendance each keep their own section."}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <KpiStrip
        stats={[
          { label: lang === "ar" ? "ملفات" : "Files", value: files.length },
          { label: lang === "ar" ? "مجلدات" : "Folders", value: folders.length },
        ]}
      />
      <FolderBrowser {...browserProps} />
      </div>
    </PlatformStampShell>
  );
}
