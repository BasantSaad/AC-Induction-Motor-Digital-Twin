<<<<<<< HEAD
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
=======
# SEW-Eurodrive DRE100L4 — Predictive Maintenance Dashboard

An interactive 3D cutaway motor viewer with live sensor streams, fault detection, and predictive-action alerts built with **React**, **Three.js**, and **Recharts**.

---

## Preview

The dashboard shows a real-time cutaway view of a SEW-Eurodrive DRE100L4 induction motor. Click any component card to highlight it on the 3D model. Numbered labels (1–10) on the model map to a legend overlay at the bottom-left of the viewport.

---

## 3D Model Labels

| # | Part |
|---|------|
| 1 | Shaft & Keyway |
| 2 | Drive-Side Bearing |
| 3 | Rotor / Laminations |
| 4 | Stator Coils (slot bundles) |
| 5 | Coil End-turns (copper + red insulation) |
| 6 | Fan-Side Bearing |
| 7 | Fan & Guard |
| 8 | Housing (blue barrel) |
| 9 | Cooling Fins |
| 10 | Junction Box |

---

## Monitored Components

| Component | Health | Status | Temp | Vibration | Known Faults |
|-----------|--------|--------|------|-----------|--------------|
| Shaft & Keyway | 91 % | ✅ Good | 55 °C | 0.9 mm/s | — |
| Drive-Side Bearing | 78 % | ⚠️ Warning | 62 °C | 4.2 mm/s | Outer Race Wear, Misalignment Risk |
| Rotor / Bars | 65 % | 🔴 Critical | 84 °C | 5.8 mm/s | Broken Bar Signature, Eccentricity Detected |
| Stator Winding | 88 % | ✅ Good | 71 °C | 0.4 mm/s | — |
| Fan-Side Bearing | 94 % | ✅ Good | 48 °C | 1.1 mm/s | — |
| Housing / Fins | 85 % | ✅ Good | 58 °C | 1.3 mm/s | — |
| Fan & Guard | 72 % | ⚠️ Warning | 46 °C | 2.9 mm/s | Fan Blade Imbalance |
| Junction Box | 97 % | ✅ Good | 42 °C | 0.2 mm/s | — |

---

## Tech Stack

| Library | What it does |
|---------|--------------|
| React 18 | UI state, component tree |
| Three.js | 3D scene — cutaway motor geometry, materials, lighting, orbit controls |
| Recharts | Vibration / temperature / phase-current line charts |

---

## Quick Start

### Option A — CodeSandbox (no install, runs in browser)

1. Go to [codesandbox.io](https://codesandbox.io) → **Create Sandbox** → **React**.
2. Replace `App.js` with the contents of `sew_predictive.jsx`.
3. Open `package.json` and set the dependencies to:

```json
"dependencies": {
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "three": "^0.150.0",
  "recharts": "^2.1.0"
}
```

4. Save — the preview updates automatically.

---

### Option B — Vite (recommended for local development)

```bash
# 1. Create the project
npm create vite@latest sew-motor -- --template react

# 2. Move into it
cd sew-motor

# 3. Install dependencies
npm install three recharts

# 4. Copy sew_predictive.jsx → src/App.jsx
#    (replace the default App.jsx entirely)

# 5. Empty src/App.css  (delete all content)

# 6. Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### Option C — Next.js (if you already have a Next project)

1. Install dependencies:

```bash
npm install three recharts
```

2. Copy `sew_predictive.jsx` into your `app/` or `pages/` folder.
3. Add `"use client";` as the very first line of the file (required for hooks + browser APIs).
4. Import and render the default-exported `App` component wherever you need it.

---

## Project Structure

```
sew_predictive.jsx          ← Single-file source (all components + 3D scene)
README.md                   ← This file
```

Everything lives in one file for portability. The internal organisation is:

```
Theme constants (T)
Sensor-data generators
COMPONENTS array (health / faults / etc.)
LABEL_LEGEND array (1-10 map)

MotorViewer          – Three.js cutaway 3D scene
  ├─ partialCylinder – custom BufferGeometry for the sliced housing shell
  ├─ Housing barrel + fins (back arc only)
  ├─ End caps (solid drive-side / transparent fan-side)
  ├─ Stator slot coils + copper end-turn loops
  ├─ Bearings (outer race / inner race / ball cage)
  ├─ Laminated rotor + bars + end rings
  ├─ Stepped shaft + keyway
  ├─ Fan + guard with spokes
  ├─ Junction box
  ├─ Numbered label sprites (1-10)
  └─ Orbit + zoom (mouse / touch)

LabelLegend          – Bottom-left legend overlay (maps numbers → names)
HealthBar            – Thin gradient progress bar
CompCard             – Clickable component card with pulsing fault dot
FaultBadge           – Red inline badge for each detected fault
StatBox              – Top-row summary tile
CustomTooltip        – Recharts hover tooltip

App (default export) – Layout grid, sensor chart tabs, detail panel,
                       fault log, predictive-action list
```

---

## How the 3D Cutaway Works

The housing is **not** a full cylinder. A helper function `partialCylinder(radius, height, arcStart, arcEnd, segments)` builds a `BufferGeometry` that only covers a specific arc range. The visible (solid blue) shell spans roughly **140 → 310°**, leaving the top-front quadrant open so the camera can see straight into the stator bore. Bright edge-lines highlight the two cut boundaries.

The fan-side end cap uses a semi-transparent material (`opacity: 0.25`) so the rotor and bearings behind it remain visible.

---

## Animations

| What | Detail |
|------|--------|
| Rotor + fan | Spin at 1 740 RPM (continuous `rotation.z`) |
| Bearing balls | Orbit at ~44 % of shaft speed (realistic cage ratio) |
| Stator coil pulse | 3-phase travelling-wave emissive glow on every copper mesh |
| Fault-dot pulse | CSS `opacity` keyframe on warning / critical component cards |

---

## Sensor Charts

Three live-style line charts are available via the tab switcher inside the *Sensor Streams* panel:

| Tab | Y-axis | Threshold / limit line |
|-----|--------|------------------------|
| Vibration | mm/s | 4.5 mm/s (red dashed) |
| Temperature | °C | 90 °C (red dashed) |
| Current | A | — (shows Phase A / B / C) |

Data is generated once on mount using a sine + noise function so the charts look realistic but require no backend.

---

## Interaction

| Action | Effect |
|--------|--------|
| Click a **Component Card** | Highlights that part cyan on the 3D model |
| Click the same card again | Removes the highlight |
| **Drag** on the 3D viewport | Orbit the camera around the motor |
| **Scroll** on the 3D viewport | Zoom in / out |
| Touch-drag (mobile) | Same as mouse drag |

---

## Browser Requirements

Any modern desktop or mobile browser that supports **WebGL** (Chrome, Firefox, Safari, Edge). No server-side rendering is needed — everything runs client-side.
>>>>>>> 91857345c0444b299d31b1349102896a3ffc2668
