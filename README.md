# UP1B Calculator

A fast, mobile-first web app (PWA) that does the gas **UP1B tightness-test**
calculations a pipework installer does by hand: installation volume,
maximum permissible pressure drop, and purge volume — for natural gas, LPG,
and LPG/air.

No build step. No dependencies. Open the page, enter the pipe lengths, get the
answer.

**Live app:** https://draakii.github.io/ub18-calc/

---

## What it calculates

Given a **fuel type**, a **meter type**, and the **lengths of each pipe size**
run in the installation, the app computes:

| Output | Meaning |
| --- | --- |
| **IVm** | Installation volume of the gas meter |
| **IVp** | Installation volume of the pipework (`Σ length × volume-per-metre`) |
| **IVf** | Fittings allowance — 10% of pipework |
| **IVt** | Total installation volume — `IVm + IVp + IVf` |
| **Tightness test** | Yes/No — only permitted where `IVt ≤ 0.035 m³` |
| **Max permissible pressure drop** | From the applicable Table 3 / Table 5 band |
| **Purge volume** | 1.5 × total volume (with the natural-gas rounding rule for `IVt > 0.020 m³`) |

### Reference tables baked in

**Pipe volume per metre (m³/m)**

| Material | 15 | 20 | 22 | 25 | 28 | 32 | 35 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Copper | 0.00014 | – | 0.00032 | – | 0.00054 | – | 0.00084 |
| Steel / stainless / corrugated S/S | 0.00024 | 0.00046 | – | 0.00064 | – | 0.0011 | – |
| PE SDR 11 | – | 0.00019 | – | 0.00033 | – | 0.00053 | – |

**Meter volumes (m³):** E6 / G4 = 0.0024 · U6 / G4 = 0.008 · U16 / G10 = 0.025

**Maximum permissible pressure drop**

| IVt band | Nat Gas (Table 3) | LPG (Table 5) | LPG / Air |
| --- | --- | --- | --- |
| ≤ 0.0025 m³ | 8 mbar | 2 mbar | – |
| 0.0025 – 0.005 m³ | 8 mbar | 1 mbar | – |
| 0.005 – 0.010 m³ | 4 mbar | 0.5 mbar | – |
| 0.010 – 0.015 m³ | 2.5 mbar | No perceptible movement | – |
| 0.015 – 0.035 m³ | 1 mbar | No perceptible movement | – |
| ≤ 0.025 m³ | – | – | 1.5 mbar |
| 0.025 – 0.035 m³ | – | – | 0.5 mbar |

Above **0.035 m³** a UP1B tightness test is not permitted, so the drop and
purge are reported as *not applicable*.

## Using the app

1. **Fuel type** — Nat Gas, LPG, or LPG / Air.
2. **Meter type** — E6/G4, U6/G4, or U16/G10.
3. **Pipe lengths** — enter the metres run in each size (blank = 0).
4. Read the **installation volumes** and the **results** card.
5. **Copy Results** (under the results) puts a summary on the clipboard.
6. **Install App** (footer) installs it to the home screen — the native
   prompt on Android/desktop, or a short how-to on iPhone.

The app works offline once loaded.

---

## Running locally

There is no build. Either open `index.html` directly, or serve the folder:

```bash
cd ub18-calc
python3 -m http.server 8080
# open http://localhost:8080
```

---

## Testing

The calculation engine is covered by a dependency-free test suite that pins
the reference tables, every band boundary, the over-limit case, and the
natural-gas purge rounding:

```bash
node test.js
# 64 checks passed, 0 failed
```

Run it with any Node.js runtime — nothing else is required.

---

## Project structure

```
ub18-calc/
├── index.html            # Markup
├── style.css             # Mobile-first styling
├── app.js                # Calculation engine + UI wiring + PWA registration
├── manifest.webmanifest  # PWA manifest (installable app)
├── sw.js                 # Service worker (offline cache)
├── icons/                # 192 / 512 / maskable icons
├── test.js               # Dependency-free test suite
├── .gitignore
└── README.md
```

---

## Notes & disclaimer

This tool is an aid for installation engineers and is not a substitute for
the relevant standards (Table 3 / Table 5) or professional judgement. Where a
pressure drop within limits is observed, the occupier must still be asked about
any smell of gas — a smell is never acceptable.

---

*Created with <img src="docs/coffee.svg" alt="Tea" title="Tea" width="17"> &amp; <img src="docs/heart.svg" alt="Love" title="Love" width="15"> by Ricky Gibson for Simon Lansdell*
