"use strict";
// Verification suite for the UP1B calculation engine.
// Pins the reference tables, the spreadsheet's worked example, band
// boundaries for all three fuels, and the NG purge rounding rules.
// Run: node test.js

const fs = require("fs");
const path = require("path");
const Module = require("module");

/* ---------- minimal DOM stub so app.js can boot and render ---------- */
function makeEl(id) {
  return {
    id, textContent: "", innerHTML: "", value: "", placeholder: "",
    className: "", children: [], dataset: {}, type: "",
    hidden: false,
    classList: { add() {}, remove() {} },
    addEventListener(type, fn) { (this._h = this._h || {})[type] = fn; },
    append(...c) { this.children.push(...c); },
    appendChild(c) { this.children.push(c); },
    querySelectorAll() { return []; },
    closest() { return this; },
    showModal() { this._opened = true; },
    close() { this._opened = false; },
  };
}
const els = {};
const getEl = (id) => (els[id] = els[id] || makeEl(id));
global.document = { getElementById: getEl, createElement: (t) => makeEl(t) };
const winHandlers = {};
global.window = { addEventListener(type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); } };
global.self = global;
global.matchMedia = () => ({ matches: false });

/* ---------- load the real app.js and grab its internals ---------- */
const appPath = path.join(__dirname, "app.js");
const src = fs.readFileSync(appPath, "utf8") +
  "\nmodule.exports = { compute, ngPurgeVolume, PIPES, METERS };";
const mod = new Module("up1b-app");
mod._compile(src, appPath);
const { compute, ngPurgeVolume, PIPES, METERS } = mod.exports;

/* ---------- tiny checkers ---------- */
let pass = 0;
const failures = [];
const eq = (actual, expected, label) => {
  if (actual === expected) pass++;
  else failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};
const approx = (actual, expected, tol, label) => {
  if (Math.abs(actual - expected) <= tol) pass++;
  else failures.push(`${label}: expected ~${expected}, got ${actual}`);
};

/* 1) Pipe volume table — 10 m of every size must give 10 x vol/m */
for (const group of Object.values(PIPES)) {
  for (const s of group.sizes) {
    const r = compute("ng", "e6g4", { [s.id]: 10 });
    approx(r.ivp, 10 * s.vol, 1e-15, `pipe table ${group.label} ${s.label}`);
  }
}

/* 2) Meter volumes (sheet rows 26/32/33) */
eq(METERS.e6g4.vol, 0.0024, "meter E6/G4 volume");
eq(METERS.u6g4.vol, 0.008, "meter U6/G4 volume");
eq(METERS.u16g10.vol, 0.025, "meter U16/G10 volume");

/* 3) The spreadsheet's own worked example (rows 17-41):
      U16/G10 + 15mm cu 8m + 28mm cu 2m + 35mm cu 2m
      sheet: IVp 0.00388, IVf 0.00039, IVt 0.02927, 1 mbar, purge 0.045 */
const ex = compute("ng", "u16g10", { cu15: 8, cu28: 2, cu35: 2 });
approx(ex.ivp, 0.00388, 1e-9, "example IVp");
approx(ex.ivf, 0.000388, 1e-9, "example IVf");
approx(ex.ivt, 0.029268, 1e-9, "example IVt");
eq(ex.dropLabel, "1 mbar", "example drop (Table 3 NG)");
eq(ex.purgeLabel, "0.04500", "example purge (NG rounding)");
eq(ex.canTightness, true, "example tightness allowed");

/* 4) NG bands (Table 3): 8 / 4 / 2.5 / 1 mbar, E6/G4 base 0.0024 */
const ng = (len) => compute("ng", "e6g4", len);
eq(ng({}).ivt.toFixed(5), "0.00240", "NG base IVt");
eq(ng({}).dropLabel, "8 mbar", "NG band <=0.005");
eq(ng({ cu15: 30 }).ivt.toFixed(5), "0.00702", "NG 4-band IVt");
eq(ng({ cu15: 30 }).dropLabel, "4 mbar", "NG band 0.005-0.010");
eq(ng({ cu15: 60 }).ivt.toFixed(5), "0.01164", "NG 2.5-band IVt");
eq(ng({ cu15: 60 }).dropLabel, "2.5 mbar", "NG band 0.010-0.015");
eq(ng({ cu15: 120 }).ivt.toFixed(5), "0.02088", "NG 1-band IVt");
eq(ng({ cu15: 120 }).dropLabel, "1 mbar", "NG band 0.015-0.035");

/* 5) LPG bands (Table 5): 2 / 1 / 0.5 / no perceptible movement */
const lpg = (len) => compute("lpg", "e6g4", len);
eq(lpg({}).dropLabel, "2 mbar", "LPG band <=0.0025");
eq(lpg({ cu15: 10 }).ivt.toFixed(5), "0.00394", "LPG 1-band IVt");
eq(lpg({ cu15: 10 }).dropLabel, "1 mbar", "LPG band 0.0025-0.005");
eq(lpg({ cu15: 30 }).dropLabel, "0.5 mbar", "LPG band 0.005-0.01");
eq(lpg({ cu15: 60 }).dropLabel, "No perceptible movement", "LPG band 0.01-0.035");

/* 6) LPG / Air bands: 1.5 / 0.5 mbar */
const air = (len) => compute("lpgair", "e6g4", len);
eq(air({}).dropLabel, "1.5 mbar", "LPG/Air band <=0.025");
eq(air({ cu15: 150 }).ivt.toFixed(5), "0.02550", "LPG/Air 0.5-band IVt");
eq(air({ cu15: 150 }).dropLabel, "0.5 mbar", "LPG/Air band >0.025-0.035");

/* 7) Over 0.035 m³: no tightness test, no drop, no purge */
const over = compute("ng", "u16g10", { cu35: 12 });
approx(over.ivt, 0.036088, 1e-9, "over-limit IVt");
eq(over.canTightness, false, "over-limit tightness No");
eq(over.dropLabel, null, "over-limit drop N/A");
eq(over.purge, null, "over-limit purge N/A");

/* 8) NG purge rounding (sheet rows 49-55) — pure function */
approx(ngPurgeVolume(0.02), 0.02, 1e-12, "purge at exactly 0.020 (no round)");
approx(ngPurgeVolume(0.019999), 0.019999, 1e-12, "purge below 0.020 passthrough");
approx(ngPurgeVolume(0.029268), 0.030, 1e-9, "purge 0.029268 -> 0.030 (head 2 > 1)");
approx(ngPurgeVolume(0.023145), 0.023, 1e-9, "purge 0.023145 -> 0.023 (head 1, no +)");
approx(ngPurgeVolume(0.021234), 0.022, 1e-9, "purge 0.021234 -> 0.022 (head 2)");
approx(ngPurgeVolume(0.021000), 0.021, 1e-9, "purge 0.021000 -> 0.021 (head 0)");

/* 9) Non-NG purge is plain 1.5 x IVt, no rounding */
const lpgP = lpg({ cu15: 30 });
approx(lpgP.purge, lpgP.ivt, 1e-12, "LPG purge basis = IVt");
eq(lpgP.purgeLabel, (1.5 * lpgP.ivt).toFixed(5), "LPG purge label 1.5x");
eq(ng({}).purgeLabel, (1.5 * 0.0024).toFixed(5), "NG small purge 1.5x (no round)");

/* 10) Fittings 10% and total = meter + pipework + fittings */
const r10 = ng({ cu15: 30 });
approx(r10.ivf, r10.ivp * 0.1, 1e-15, "fittings = 10% of pipework");
approx(r10.ivt, 0.0024 + r10.ivp + r10.ivf, 1e-15, "IVt = IVm + IVp + IVf");

/* 11) Full UI pipeline: drive the real inputs, read the displayed text */
const pipeWrap = getEl("pipes");
const inputs = [];
(function collect(n) {
  for (const c of n.children) { if (c.type === "number") inputs.push(c); collect(c); }
})(pipeWrap);
for (const i of inputs) { i.value = "0"; i._h.input(); }
const setIn = (id, v) => { const el = inputs.find((x) => x.id === id); el.value = v; el._h.input(); };
setIn("cu15", "8"); setIn("cu28", "2"); setIn("cu35", "2");
eq(getEl("ivt").textContent, "0.02927 m³", "UI IVt display");
eq(getEl("r-tight").textContent, "Yes", "UI tightness display");
eq(getEl("r-drop").textContent, "1 mbar", "UI drop display");
eq(getEl("r-purge").textContent, "0.04500 m³", "UI purge display");

/* 12) Display precision — no silent truncation of exact values */
const prec = compute("ng", "u16g10", { cu15: 8, cu28: 2, cu35: 2 });
eq(prec.purgeLabel, "0.04500", "purge label shows 5 decimals");
const prec2 = compute("lpgair", "u16g10", { cu15: 4 }); // IVt 0.025616 -> purge 0.038424
eq(prec2.purgeLabel, "0.03842", "LPG/Air purge not truncated (0.038424 -> 0.03842)");

/* 13) Install button flow */
const installBtn = getEl("install");
const helpDlg = getEl("install-help");

// iOS-style: no beforeinstallprompt fired -> clicking opens the help dialog
installBtn._h.click();
eq(helpDlg._opened, true, "without install prompt: click opens help dialog");
getEl("install-help-close")._h.click();
eq(helpDlg._opened, false, "close button closes help dialog");

// Android/Chrome-style: beforeinstallprompt fires -> button shown, click calls prompt()
let promptCalled = 0;
let promptPrevented = false;
const deferred = {
  prompt() { promptCalled++; },
  userChoice: Promise.resolve({ outcome: "accepted" }),
};
const bip = { preventDefault() { promptPrevented = true; }, ...deferred };
for (const fn of winHandlers.beforeinstallprompt || []) fn(bip);
eq(installBtn.hidden, false, "beforeinstallprompt: button unhidden");
installBtn._h.click();
eq(promptCalled, 1, "click with deferred prompt: native prompt() called");
eq(promptPrevented, true, "beforeinstallprompt: default prevented (no browser popup)");

// After the user accepts, the button hides once the choice settles
deferred.userChoice.then(() => {
  eq(installBtn.hidden, true, "after acceptance: button hidden");

  // appinstalled (e.g. iOS manual install) also hides the button
  installBtn.hidden = false;
  for (const fn of winHandlers.appinstalled || []) fn();
  eq(installBtn.hidden, true, "appinstalled: button hidden");

  report();
});

/* ---------- report ---------- */
function report() {
  console.log(`${pass} checks passed, ${failures.length} failed`);
  for (const f of failures) console.log("FAIL:", f);
  process.exit(failures.length ? 1 : 0);
}
