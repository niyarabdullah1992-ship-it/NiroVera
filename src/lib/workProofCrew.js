export const EMPTY_PERSON = {
  name: "",
  phone: "",
  id: "",
  idType: "",
  nationality: "",
  gender: "",
  title: "",
  employeeId: "",
  homeStationId: "",
  visitor: false,
};

export const EMPTY_VEHICLE = {
  maker: "", model: "", type: "", year: "", plateLetters: "", plateNumbers: "",
  plate: "",
  assetId: "",
};

const CREW_LIMIT = 12;

export function normalizePerson(raw = {}, executeStationId) {
  const employeeId = String(raw.employeeId || "").trim();
  const homeStationId = String(raw.homeStationId || "").trim();
  const execute = String(executeStationId || "").trim();
  const visitor = raw.visitor === true
    || !!(employeeId && homeStationId && execute && homeStationId !== execute);
  const id = String(raw.id || raw.personId || raw.nationalId || "").trim();
  const nationality = String(raw.nationality || "").trim();
  let idType = String(raw.idType || "").trim();
  if (!idType && id.startsWith("1")) idType = "national_id";
  if (!idType && id.startsWith("2")) idType = "iqama";
  if (!idType && /سعود|saudi/i.test(nationality)) idType = "national_id";
  return {
    name: String(raw.name || raw.personName || "").trim(),
    phone: String(raw.phone || raw.personPhone || "").trim(),
    id,
    idType,
    nationality,
    gender: String(raw.gender || "").trim(),
    title: String(raw.title || raw.personTitle || "").trim(),
    employeeId,
    homeStationId,
    visitor,
  };
}

export function normalizeVehicle(raw = {}) {
  const plate = String(raw.plate || "").trim();
  return {
    maker: String(raw.maker || raw.make || "").trim(),
    model: String(raw.model || "").trim(),
    type: String(raw.type || "").trim(),
    year: String(raw.year || "").trim(),
    plateLetters: String(raw.plateLetters || "").trim(),
    plateNumbers: String(raw.plateNumbers || "").trim(),
    plate,
    assetId: String(raw.assetId || "").trim(),
  };
}

export function isVehicleFilled(vehicle) {
  const item = normalizeVehicle(vehicle);
  return Boolean(item.maker || item.model || item.type || item.year || item.plateLetters || item.plateNumbers || item.plate || item.assetId);
}

export function cleanedPeople(list, executeStationId) {
  return (Array.isArray(list) ? list : [])
    .map((person) => normalizePerson(person, executeStationId))
    .filter((person) => person.name)
    .slice(0, CREW_LIMIT);
}

export function cleanedVehicles(list) {
  return (Array.isArray(list) ? list : []).map(normalizeVehicle).filter(isVehicleFilled).slice(0, CREW_LIMIT);
}

export function personFromEmployee(employee, executeStationId) {
  const homeStationId = String(employee?.stationId || employee?.station_id || employee?.homeStationId || "").trim();
  const profile = employee?.profile && typeof employee.profile === "object" ? employee.profile : {};
  return normalizePerson({
    name: employee?.name,
    phone: employee?.phone || profile.phone,
    id: employee?.nationalId || profile.nationalId || employee?.idNumber || profile.idNumber,
    idType: profile.idType || employee?.idType,
    nationality: employee?.nationality || profile.nationality,
    gender: employee?.gender || profile.gender,
    title: employee?.position || employee?.title || employee?.jobTitle || profile.jobTitle || profile.position,
    employeeId: employee?.employeeId || employee?.id,
    homeStationId,
  }, executeStationId);
}

export function isVisitorPerson(person, executeStationId) {
  const item = normalizePerson(person, executeStationId);
  return item.visitor === true;
}

export function proofVisitorPeople(proof) {
  const execute = proof?.stationId;
  return cleanedPeople(proof?.people, execute).filter((person) => person.visitor);
}

export function isProofCrewMember(proof, actorUserId) {
  const id = String(actorUserId || "").trim();
  if (!id || !proof) return false;
  return (Array.isArray(proof.people) ? proof.people : []).some(
    (person) => String(person?.employeeId || "").trim() === id,
  );
}

export function peopleFromProof(proof) {
  const execute = proof?.stationId;
  const fromList = cleanedPeople(proof?.people, execute);
  if (fromList.length) return fromList;
  const legacy = normalizePerson({
    name: proof?.personName,
    phone: proof?.personPhone,
    id: proof?.personId,
    title: proof?.personTitle,
  }, execute);
  return [legacy.name ? legacy : { ...EMPTY_PERSON }];
}

export function vehiclesFromProof(proof) {
  const fromList = cleanedVehicles(proof?.vehicles);
  if (fromList.length) return fromList;
  if (proof?.vehicle && isVehicleFilled(proof.vehicle)) return [normalizeVehicle(proof.vehicle)];
  return [{ ...EMPTY_VEHICLE }];
}

export function formPeople(form) {
  if (Array.isArray(form?.people) && form.people.length) {
    return form.people.map((person) => ({ ...EMPTY_PERSON, ...normalizePerson(person, form?.stationId) }));
  }
  return [{
    ...EMPTY_PERSON,
    name: form?.personName || "",
    phone: form?.personPhone || "",
    id: form?.personId || "",
    title: form?.personTitle || "",
  }];
}

export function formVehicles(form) {
  if (Array.isArray(form?.vehicles) && form.vehicles.length) {
    return form.vehicles.map((vehicle) => ({ ...EMPTY_VEHICLE, ...normalizeVehicle(vehicle) }));
  }
  return [{ ...EMPTY_VEHICLE, ...normalizeVehicle(form?.vehicle || {}) }];
}

export function workProofCrewFields(form) {
  const people = cleanedPeople(formPeople(form), form?.stationId);
  const vehicles = cleanedVehicles(formVehicles(form));
  const first = people[0] || { ...EMPTY_PERSON };
  if (!first.name) {
    return {
      ok: false,
      errorAr: "أدخل اسم عامل واحد على الأقل.",
      errorEn: "Enter at least one worker name.",
    };
  }
  if (!first.id) {
    return {
      ok: false,
      errorAr: "أدخل رقم هوية عامل واحد على الأقل.",
      errorEn: "Enter at least one worker ID number.",
    };
  }
  return {
    ok: true,
    fields: {
      people,
      vehicles,
      personName: first.name,
      personPhone: first.phone,
      personId: first.id,
      personTitle: first.title,
      vehicle: vehicles[0] || { ...EMPTY_VEHICLE },
    },
  };
}

export function canAddCrewItem(list) {
  return (Array.isArray(list) ? list.length : 0) < CREW_LIMIT;
}

export function isVehicleAsset(asset) {
  const hay = `${asset?.category || ""} ${asset?.name || ""} ${asset?.type || ""}`.toLowerCase();
  return /vehicle|car|van|truck|bus|سيارة|مركبة|شاحنة|حافلة/.test(hay);
}

export function vehicleFromAsset(asset) {
  const code = String(asset?.assetCode || asset?.serial || "").trim();
  const letters = code.replace(/[0-9\s]/g, "").trim();
  const numbers = code.replace(/\D/g, "").trim();
  return normalizeVehicle({
    assetId: asset?.id,
    maker: asset?.maker || asset?.make,
    model: asset?.model || asset?.name,
    type: asset?.type || asset?.category,
    plate: code,
    plateLetters: letters,
    plateNumbers: numbers,
  });
}

export function workProofVehicleAssets(assets, { stationId, holderIds } = {}) {
  const holders = new Set((holderIds || []).map(String).filter(Boolean));
  const station = String(stationId || "");
  return (assets || []).filter((asset) => {
    if (!isVehicleAsset(asset)) return false;
    if (station && String(asset.stationId || "") === station) return true;
    if (holders.has(String(asset.holderId || ""))) return true;
    return false;
  });
}

export function checkProofPunchStation(attendance, proofStationId) {
  const punch = String(attendance?.station_id || attendance?.stationId || "").trim();
  const execute = String(proofStationId || "").trim();
  if (!punch || !execute) return { ok: true };
  if (punch !== execute) {
    return {
      ok: false,
      error: "VISIT_STATION_MISMATCH",
      reason: "بصمة اليوم ليست على فرع التنفيذ — سجّل حضورك في الفرع الذي يُنفَّذ فيه العمل.",
      reasonEn: "Today's check-in is not at the executing branch — punch at the workplace of this proof.",
    };
  }
  return { ok: true };
}
