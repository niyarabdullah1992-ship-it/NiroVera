function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function cleanProofAttachments(list) {
  return (Array.isArray(list) ? list : [])
    .filter((item) => item && (item.url || item.name))
    .slice(0, 20)
    .map((item, index) => ({
      id: item.id || `att_${index}`,
      url: item.url || "",
      name: item.name || "file",
      type: item.type || "",
      localOnly: !!item.localOnly || (!item.url && !!item.name),
      createdAt: item.createdAt || item.addedAt || null,
      updatedAt: item.updatedAt || item.createdAt || item.addedAt || null,
    }));
}

export function makeProofAttachment({ id, url = "", name = "file", type = "", localOnly = false, createdAt, updatedAt } = {}) {
  const at = new Date().toISOString();
  return {
    id: id || uid("att"),
    url,
    name: name || "file",
    type: type || "",
    localOnly: !!localOnly || !url,
    createdAt: createdAt || at,
    updatedAt: updatedAt || at,
  };
}

export function readProofFile(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const fallback = () => resolve(makeProofAttachment({
      url: typeof URL !== "undefined" && file instanceof File ? URL.createObjectURL(file) : "",
      name: file.name || "file",
      type: file.type || "",
      localOnly: true,
    }));
    if (typeof FileReader === "undefined" || !(file instanceof File)) {
      fallback();
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(makeProofAttachment({
      url: reader.result || "",
      name: file.name || "file",
      type: file.type || "",
      localOnly: !reader.result,
    }));
    reader.onerror = fallback;
    reader.readAsDataURL(file);
  });
}

export function readProofFiles(files) {
  return Promise.all((Array.isArray(files) ? files : []).map(readProofFile)).then((rows) => rows.filter(Boolean));
}
