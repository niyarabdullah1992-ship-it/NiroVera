import React, { useId, useMemo, useState } from "react";
import { COUNTRIES, DEFAULT_COUNTRY, countryOf, findSaCity, saRegionOf, searchSaCities } from "@/lib/geoPlaces";
import "./orgDesign.css";

/**
 * «الدولة» then «المدينة» — the branch location picker. Saudi Arabia: a searchable list grouped by
 * the 13 administrative regions (Arabic and English names, «جده» finds جدة, «القصيم» lists its
 * cities). Other countries: the city is free text. `value` / `onChange`: { countryCode, city, cityRegion }.
 */
export default function LocationPicker({ ar = true, value = {}, onChange, required = true }) {
  const code = String(value.countryCode || DEFAULT_COUNTRY).toUpperCase();
  const saudi = code === "SA";
  const chosen = saudi ? findSaCity(value.city) : null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(!chosen);
  const listId = useId();
  const hits = useMemo(() => (saudi ? searchSaCities(query, query.trim() ? 60 : 400) : []), [saudi, query]);
  const groups = useMemo(() => {
    const out = [];
    hits.forEach((city) => {
      let g = out.find((x) => x.id === city.regionId);
      if (!g) { g = { id: city.regionId, ar: city.regionAr, en: city.regionEn, cities: [] }; out.push(g); }
      g.cities.push(city);
    });
    return out;
  }, [hits]);
  const set = (patch) => onChange?.({ countryCode: code, city: value.city || "", cityRegion: value.cityRegion || "", ...patch });
  const pick = (city) => { set({ city: city.ar, cityRegion: city.regionId }); setOpen(false); setQuery(""); };

  return (
    <div className="nv-loc">
      <label className="nv-loc__field">
        <span>{ar ? "الدولة" : "Country"}</span>
        <select
          className="nv-od-select"
          value={code}
          onChange={(e) => { onChange?.({ countryCode: e.target.value, city: "", cityRegion: "" }); setOpen(true); setQuery(""); }}
        >
          {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{ar ? c.ar : c.en}</option>)}
        </select>
      </label>
      <div className="nv-loc__field">
        <span id={`${listId}-label`}>
          {ar ? "المدينة" : "City"}
          {saudi && required ? <b aria-hidden> *</b> : null}
        </span>
        {saudi ? (
          chosen && !open ? (
            <div className="nv-loc__chosen">
              <span>
                <b>{ar ? chosen.ar : chosen.en}</b>
                <small>{ar ? chosen.regionAr : chosen.regionEn}</small>
              </span>
              <button type="button" className="nv-loc__change" onClick={() => setOpen(true)}>{ar ? "تغيير" : "Change"}</button>
            </div>
          ) : (
            <div className="nv-loc__picker">
              <input
                className="nv-od-input nv-search-field nv-loc__search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={ar ? "ابحث عن مدينة أو منطقة" : "Search a city or region"}
                aria-labelledby={`${listId}-label`}
                aria-controls={listId}
              />
              <div className="nv-loc__list" id={listId} role="listbox" aria-labelledby={`${listId}-label`}>
                {groups.length ? groups.map((g) => (
                  <div key={g.id} role="group" aria-label={ar ? g.ar : g.en} className="nv-loc__group">
                    <p className="nv-loc__region">{ar ? g.ar : g.en}</p>
                    <div className="nv-loc__cities">
                      {g.cities.map((city) => (
                        <button
                          key={city.ar}
                          type="button"
                          role="option"
                          aria-selected={chosen?.ar === city.ar}
                          onClick={() => pick(city)}
                        >
                          {ar ? city.ar : city.en}
                        </button>
                      ))}
                    </div>
                  </div>
                )) : <p className="nv-loc__none">{ar ? "لا مدينة بهذا الاسم في القائمة." : "No city by that name on the list."}</p>}
              </div>
            </div>
          )
        ) : (
          <input
            className="nv-od-input"
            value={value.city || ""}
            onChange={(e) => set({ city: e.target.value, cityRegion: "" })}
            placeholder={ar ? `المدينة في ${countryOf(code)?.ar || code}` : `City in ${countryOf(code)?.en || code}`}
            aria-labelledby={`${listId}-label`}
          />
        )}
      </div>
    </div>
  );
}

/** «الرياض · منطقة الرياض» — one line for a stored or derived place. */
export function placeLine(place, ar = true) {
  if (!place?.city) return "";
  const region = saRegionOf(place.cityRegion);
  const country = place.countryCode && place.countryCode !== "SA" ? countryOf(place.countryCode) : null;
  return [place.city, region ? (ar ? region.ar : region.en) : "", country ? (ar ? country.ar : country.en) : ""].filter(Boolean).join(" · ");
}
