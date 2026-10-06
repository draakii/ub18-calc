"use strict";

/* ------------------------------------------------------------------ *
 *  UP1B Calculator — logic ported from "UP1B Calculator.xlsx"
 * ------------------------------------------------------------------ */

// Volume per metre of pipe (m³/m), from the spreadsheet lookup tables
const PIPES = {
  copper: {
    label: "Copper",
    sizes: [
      { id: "cu15", label: "15 mm", vol: 0.00014 },
      { id: "cu22", label: "22 mm", vol: 0.00032 },
      { id: "cu28", label: "28 mm", vol: 0.00054 },
      { id: "cu35", label: "35 mm", vol: 0.00084 },
    ],
  },
  steel: {
    label: "Steel / stainless / corrugated S/S",
    sizes: [
      { id: "st15", label: "15 mm", vol: 0.00024 },
      { id: "st20", label: "20 mm", vol: 0.00046 },
      { id: "st25", label: "25 mm", vol: 0.00064 },
      { id: "st32", label: "32 mm", vol: 0.0011 },
    ],
  },
  pe: {
    label: "PE SDR 11",
    sizes: [
      { id: "pe20", label: "20 mm", vol: 0.00019 },
      { id: "pe25", label: "25 mm", vol: 0.00033 },
      { id: "pe32", label: "32 mm", vol: 0.00053 },
    ],
  },
};

// Meter installation volumes (m³)
const METERS = {
  e6g4: { label: "E6 / G4", vol: 0.0024 },
  u6g4: { label: "U6 / G4", vol: 0.008 },
  u16g10: { label: "U16 / G10", vol: 0.025 },
};

// Table 3 — NG: bands and max permissible drop (mbar)
const NG_BANDS = [
  { max: 0.005, drop: 8, label: "≤ 0.005 m³" },
  { max: 0.010, drop: 4, label: "> 0.005 – ≤ 0.010 m³" },
  { max: 0.015, drop: 2.5, label: "> 0.010 – ≤ 0.015 m³" },
  { max: 0.035, drop: 1, label: "> 0.015 – ≤ 0.035 m³" },
];

// Table 5 — LPG: bands and max permissible drop (mbar)
const LPG_BANDS = [
  { max: 0.0025, drop: 2, label: "≤ 0.0025 m³" },
  { max: 0.005, drop: 1, label: "> 0.0025 – ≤ 0.005 m³" },
  { max: 0.01, drop: 0.5, label: "> 0.005 – ≤ 0.01 m³" },
  { max: 0.035, drop: 0, label: "> 0.01 – ≤ 0.035 m³" }, // no perceptible movement
];

// LPG / Air bands
const LPGAIR_BANDS = [
  { max: 0.025, drop: 1.5, label: "≤ 0.025 m³" },
  { max: 0.035, drop: 0.5, label: "> 0.025 – ≤ 0.035 m³" },
];

const IV_LIMIT = 0.035; // m³ — max installation volume for a UP1B tightness test

const NOTES = {
  ng: `Where a drop within limits is observed, the occupier needs to be questioned as to whether there has been any smell of gas.
Appliance manufacture standards, for practical reasons, permit a very small leakage which may cause the pressure drop that is observed during the tightness test, particularly if the IV is small. However in all circumstances a smell of gas is not acceptable.
For new installations incorporating existing appliances, the new part(s) of the installation need to be gas tight to the tolerance of no perceptible movement of the gauge and no smell of gas; a permissible pressure drop may be allowed on an existing appliance(s). See Table 3.`,
  lpg: `Where a drop within limits is observed, the occupier needs to be questioned as to whether there has been any smell of gas.
Appliance manufacture standards, for practical reasons, permit a very small leakage which may cause the pressure drop that is observed during the tightness test, particularly if the IV is small. However in all circumstances a smell of gas is not acceptable.
For new installations incorporating existing appliances, the new part(s) of the installation need to be gas tight to the tolerance of no perceptible movement of the gauge and no smell of gas; a permissible pressure drop may be allowed on an existing appliance(s). See Table 5.`,
  lpgair: `Where a drop within limits is observed, the occupier needs to be questioned as to whether there has been any smell of gas.
Appliance manufacture standards, for practical reasons, permit a very small leakage which may cause the pressure drop that is observed during the tightness test, particularly if the IV is small. However in all circumstances a smell of gas is not acceptable.
For new installations incorporating existing appliances, the new part(s) of the installation need to be gas tight to the tolerance of no perceptible movement of the gauge and no smell of gas; a permissible pressure drop may be allowed on an existing appliance(s).`,
};

/* ----------------------------- compute ---------------------------- */

function bandDrop(bands, ivt) {
  for (const b of bands) {
    if (ivt <= b.max) return b;
  }
  return null;
}

// NG purge rounding, mirroring the spreadsheet steps exactly:
// 0.029268 -> "0.029" (first 5 chars) -> "268" (last 3 digits) ->
// first digit "2" > 1 -> add 0.001 -> 0.030
function ngPurgeVolume(ivt) {
  if (ivt <= 0.02) return ivt;
  const s = ivt.toFixed(6);                    // "0.029268"
  const base = parseFloat(s.slice(0, 5));      // "0.029" -> 0.029
  const head = parseInt(s.slice(-3)[0], 10);   // "2"
  return head > 1 ? base + 0.001 : base;       // 0.030
}

function compute(fuel, meterId, lengths) {
  const meter = METERS[meterId];
  const ivm = meter.vol;

  let ivp = 0;
  for (const group of Object.values(PIPES)) {
    for (const size of group.sizes) {
      const len = lengths[size.id] || 0;
      ivp += len * size.vol;
    }
  }
  const ivf = ivp * 0.1;
  const ivt = ivm + ivp + ivf;

  const bands = fuel === "lpg" ? LPG_BANDS : fuel === "lpgair" ? LPGAIR_BANDS : NG_BANDS;

  const canTightness = ivt <= IV_LIMIT;
  const band = canTightness ? bandDrop(bands, ivt) : null;

  let purge;
  if (canTightness) {
    purge = fuel === "ng" ? ngPurgeVolume(ivt) : ivt;
  } else {
    purge = null;
  }

  return {
    fuel,
    meterLabel: meter.label,
    ivm, ivp, ivf, ivt,
    canTightness,
    dropMbar: band ? band.drop : null,
    dropLabel: band
      ? band.drop === 0 ? "No perceptible movement" : band.drop + " mbar"
      : null,
    purge,
    purgeLabel: purge === null
      ? null
      : (purge * 1.5).toFixed(5),
  };
}

/* ----------------------------- render ----------------------------- */

const $ = (id) => document.getElementById(id);
const state = { fuel: "ng", meter: "u16g10", lengths: {} };

function fmtVol(v) { return v.toFixed(5) + " m³"; }

function buildPipes() {
  const wrap = $("pipes");
  for (const [gid, group] of Object.entries(PIPES)) {
    const g = document.createElement("div");
    g.className = "pipe-group";
    g.innerHTML = `<h3>${group.label}</h3>`;
    for (const size of group.sizes) {
      const row = document.createElement("div");
      row.className = "pipe-row";
      const label = document.createElement("label");
      label.textContent = size.label;
      label.htmlFor = size.id;
      const input = document.createElement("input");
      input.id = size.id;
      input.type = "number";
      input.min = "0";
      input.step = "0.5";
      input.inputMode = "decimal";
      input.placeholder = "0";
      input.addEventListener("input", () => {
        const v = parseFloat(input.value);
        state.lengths[size.id] = isNaN(v) || v < 0 ? 0 : v;
        update();
      });
      row.append(label, input);
      g.appendChild(row);
    }
    wrap.appendChild(g);
  }
}

function setResult(id, detailId, kind, text, detail) {
  const el = $(id);
  const result = el.closest(".result");
  result.classList.remove("ok", "warn", "bad");
  if (kind) result.classList.add(kind);
  el.textContent = text;
  if (detailId) $(detailId).textContent = detail || "";
}

function update() {
  const r = compute(state.fuel, state.meter, state.lengths);

  $("ivm").textContent = fmtVol(r.ivm);
  $("ivp").textContent = fmtVol(r.ivp);
  $("ivf").textContent = fmtVol(r.ivf);
  $("ivt").textContent = fmtVol(r.ivt);

  if (r.canTightness) {
    setResult("r-tight", "r-tight-detail", "ok", "Yes",
      "IV is less than 0.035 m³");
  } else {
    setResult("r-tight", "r-tight-detail", "bad", "No",
      "IV is greater than 0.035 m³");
  }

  if (r.canTightness) {
    setResult("r-drop", null, "ok", r.dropLabel);
  } else {
    setResult("r-drop", null, "bad", "Not applicable");
  }

  if (r.canTightness) {
    const detail =
      state.fuel === "ng" && r.ivt > 0.02
        ? "Rounded up for IV > 0.020 m³"
        : state.fuel === "ng"
          ? "Light burner after purge"
          : "Light burner as soon as possible";
    setResult("r-purge", "r-purge-detail", "ok",
      r.purgeLabel + " m³", detail);
  } else {
    setResult("r-purge", "r-purge-detail", "bad", "Not applicable",
      "Tightness test not possible above 0.035 m³");
  }

  $("note").textContent = NOTES[state.fuel];
}

function summary() {
  const r = compute(state.fuel, state.meter, state.lengths);
  const fuelName = { ng: "Nat Gas", lpg: "LPG", lpgair: "LPG / Air" }[state.fuel];
  return [
    `UP1B — ${fuelName} · Meter ${r.meterLabel}`,
    `IVm ${fmtVol(r.ivm)}  IVp ${fmtVol(r.ivp)}  IVf ${fmtVol(r.ivf)}  IVt ${fmtVol(r.ivt)}`,
    `Tightness test: ${r.canTightness ? "Yes (IV ≤ 0.035 m³)" : "No (IV > 0.035 m³)"}`,
    r.canTightness
      ? `Max permissible drop: ${r.dropLabel}`
      : "",
    r.purge !== null
      ? `Purge volume: ${r.purgeLabel} m³ (1.5 × ${fmtVol(r.purge)})`
      : "",
  ].filter(Boolean).join("\n");
}

/* ----------------------------- events ----------------------------- */

function wire() {
  $("fuel").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    for (const b of $("fuel").children) b.classList.remove("active");
    btn.classList.add("active");
    state.fuel = btn.dataset.value;
    update();
  });

  $("meter").addEventListener("change", (e) => {
    state.meter = e.target.value;
    update();
  });

  $("reset").addEventListener("click", () => {
    for (const id of Object.keys(state.lengths)) state.lengths[id] = 0;
    for (const el of $("pipes").querySelectorAll("input")) el.value = "";
    update();
  });

  $("copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(summary());
      $("copy").textContent = "Copied!";
    } catch {
      $("copy").textContent = "Copy failed";
    }
    setTimeout(() => ($("copy").textContent = "Copy Results"), 1500);
  });
}

/* ----------------------------- PWA -------------------------------- */

function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    });
  }
}

buildPipes();
wire();
update();
registerSW();
