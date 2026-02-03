import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ─── THEME ────────────────────────────────────────────
const T = {
  bg: "#030810", surface: "#070e1a", card: "#0a1628", cardBorder: "#0f2a4a",
  accent: "#00b4d8", accentDim: "#0077a8", warn: "#f5a623", danger: "#ff4757",
  good: "#2ed573", text: "#c5dce8", textDim: "#5a7a8e", textMuted: "#2e4a5e",
};

// ─── DATA ─────────────────────────────────────────────
const gen = (base, noise, n = 60) =>
  Array.from({ length: n }, (_, i) => base + (Math.random() - 0.5) * noise + Math.sin(i * 0.3) * noise * 0.4);

const COMPONENTS = [
  { id: "shaft",          label: "Shaft & Keyway",     icon: "📐", health: 91, status: "good",     temp: 55, vibration: 0.9, faults: [],                                            rrh: "—",      color: "#2ed573" },
  { id: "bearing_drive", label: "Drive-Side Bearing", icon: "⚙️", health: 78, status: "warning",  temp: 62, vibration: 4.2, faults: ["Outer Race Wear","Misalignment Risk"],     rrh: "12 days", color: "#f5a623" },
  { id: "rotor_bars",    label: "Rotor / Bars",       icon: "🔄", health: 65, status: "critical", temp: 84, vibration: 5.8, faults: ["Broken Bar Signature","Eccentricity Detected"], rrh: "3 days", color: "#ff4757" },
  { id: "stator_winding",label: "Stator Winding",     icon: "🔌", health: 88, status: "good",     temp: 71, vibration: 0.4, faults: [],                                            rrh: "—",      color: "#2ed573" },
  { id: "bearing_fan",   label: "Fan-Side Bearing",   icon: "⚙️", health: 94, status: "good",     temp: 48, vibration: 1.1, faults: [],                                            rrh: "—",      color: "#2ed573" },
  { id: "housing",       label: "Housing / Fins",     icon: "🏗️", health: 85, status: "good",     temp: 58, vibration: 1.3, faults: [],                                            rrh: "—",      color: "#2ed573" },
  { id: "fan_guard",     label: "Fan & Guard",        icon: "💨", health: 72, status: "warning",  temp: 46, vibration: 2.9, faults: ["Fan Blade Imbalance"],                       rrh: "8 days", color: "#f5a623" },
  { id: "junction_box",  label: "Junction Box",       icon: "📦", health: 97, status: "good",     temp: 42, vibration: 0.2, faults: [],                                            rrh: "—",      color: "#2ed573" },
];

// label legend: 1=Shaft  2=Drive Bearing  3=Rotor  4=Stator Coils  5=Coil End-turns  6=Fan Bearing  7=Fan  8=Housing  9=Fins  10=Junction Box
const LABEL_LEGEND = [
  { num: 1,  label: "Shaft" },
  { num: 2,  label: "Drive Bearing" },
  { num: 3,  label: "Rotor" },
  { num: 4,  label: "Stator Coils" },
  { num: 5,  label: "End-turns" },
  { num: 6,  label: "Fan Bearing" },
  { num: 7,  label: "Fan" },
  { num: 8,  label: "Housing" },
  { num: 9,  label: "Fins" },
  { num: 10, label: "Junction Box" },
];

const vibData  = gen(2.8, 3.2).map((v, i) => ({ t: i, vibration: +v.toFixed(2), threshold: 4.5 }));
const tempData = gen(58, 14).map((v, i) => ({ t: i, temperature: +v.toFixed(1), limit: 90 }));
const curData  = gen(4.2, 0.8).map((v, i) => ({
  t: i, phaseA: +v.toFixed(2),
  phaseB: +(v + (Math.random()-0.5)*0.6).toFixed(2),
  phaseC: +(v - (Math.random()-0.5)*0.6).toFixed(2),
}));

// ─── 3D MOTOR ─────────────────────────────────────────
function MotorViewer({ highlightId }) {
  const mountRef = useRef(null);
  const animRef  = useRef(null);
  const timeRef  = useRef(0);
  const hlRef    = useRef(highlightId);
  useEffect(() => { hlRef.current = highlightId; }, [highlightId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const W = container.clientWidth, H = container.clientHeight;

    const scene    = new THREE.Scene();
    scene.background = new THREE.Color(T.bg);
    const camera   = new THREE.PerspectiveCamera(36, W / H, 0.01, 10);
    camera.position.set(0.34, 0.18, 0.36);
    camera.lookAt(0, 0, 0);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // ── LIGHTS ──
    scene.add(new THREE.AmbientLight(0x446688, 1.1));
    const kl = new THREE.DirectionalLight(0x88bbdd, 1.4); kl.position.set(0.5, 0.7, 0.4); scene.add(kl);
    const fl = new THREE.DirectionalLight(0x445566, 0.6); fl.position.set(-0.5, 0.1, 0.3); scene.add(fl);
    const rl = new THREE.DirectionalLight(0x334455, 0.5); rl.position.set(0.0, -0.4, -0.5); scene.add(rl);
    const pl = new THREE.PointLight(0x4488aa, 0.6, 0.35); pl.position.set(0, 0, 0); scene.add(pl);

    // ── DIMS ──
    const hR = 0.088, hL = 0.230;   // housing radius, length
    const rR = 0.070, rL = 0.190;   // rotor radius, length
    const ecT = 0.020;              // end-cap thickness
    const shR = 0.012;              // shaft radius

    // ── MATS ──
    const mHousing  = new THREE.MeshStandardMaterial({ color: 0x2e6daa, metalness: 0.62, roughness: 0.44 });
    const mEndSolid = new THREE.MeshStandardMaterial({ color: 0x245d90, metalness: 0.64, roughness: 0.42 });
    const mEndTrans = new THREE.MeshStandardMaterial({ color: 0x3580bb, metalness: 0.58, roughness: 0.44, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    const mLam      = new THREE.MeshStandardMaterial({ color: 0x90a8b8, metalness: 0.70, roughness: 0.40 });
    const mBar      = new THREE.MeshStandardMaterial({ color: 0xb0c8d4, metalness: 0.84, roughness: 0.24 });
    const mRing     = new THREE.MeshStandardMaterial({ color: 0xc4dae4, metalness: 0.86, roughness: 0.20 });
    const mShaft    = new THREE.MeshStandardMaterial({ color: 0xa8ccd8, metalness: 0.92, roughness: 0.14 });
    const mCoil     = new THREE.MeshStandardMaterial({ color: 0xc88535, metalness: 0.70, roughness: 0.36, emissive: 0x483010, emissiveIntensity: 0.28 });
    const mInsul    = new THREE.MeshStandardMaterial({ color: 0xcc2222, metalness: 0.08, roughness: 0.72 });
    const mSlot     = new THREE.MeshStandardMaterial({ color: 0xd0d4d8, metalness: 0.06, roughness: 0.78 });
    const mFan      = new THREE.MeshStandardMaterial({ color: 0x1c2c3c, metalness: 0.18, roughness: 0.70 });
    const mGuard    = new THREE.MeshStandardMaterial({ color: 0x2a4a6a, metalness: 0.58, roughness: 0.46 });
    const mBox      = new THREE.MeshStandardMaterial({ color: 0x1c3850, metalness: 0.52, roughness: 0.54 });
    const mFoot     = new THREE.MeshStandardMaterial({ color: 0x6a7888, metalness: 0.54, roughness: 0.58 });
    const mBolt     = new THREE.MeshStandardMaterial({ color: 0x80a0b0, metalness: 0.84, roughness: 0.28 });
    const mHLIGHT  = new THREE.MeshStandardMaterial({ color: 0x00d4ff, metalness: 0.6,  roughness: 0.28, emissive: 0x00d4ff, emissiveIntensity: 0.55 });

    // ── GROUPS ──
    const motor   = new THREE.Group(); scene.add(motor);
    const statorG = new THREE.Group(); motor.add(statorG);
    const rotorG  = new THREE.Group(); motor.add(rotorG);

    // ────────────────────────────────────
    // CUTAWAY: We slice out the TOP portion of the housing.
    // Camera looks from +Y +Z, so we remove the arc roughly
    // from -45° to +135° (top-front quadrant).
    // We achieve this cleanly: draw the housing as a
    // BACK arc cylinder (solid) + skip the front arc.
    // Use CylinderGeometry with phiStart / phiLength — but
    // THREE CylinderGeometry doesn't support that.
    // Instead: build a partial-cylinder BufferGeometry properly.
    // ────────────────────────────────────

    function partialCylinder(radius, height, arcStart, arcEnd, radSegs) {
      // Builds a partial open-ended cylinder shell (no caps).
      // Axis along Z. arcStart/arcEnd in radians, measured from +Y going CW in YZ.
      const verts = [], norms = [], indices = [];
      const halfH = height * 0.5;
      for (let i = 0; i <= radSegs; i++) {
        const t = i / radSegs;
        const a = arcStart + (arcEnd - arcStart) * t;
        const cx = Math.sin(a), cy = Math.cos(a); // x = sin, y = cos so 0 = top (+Y)
        // bottom ring (z = -halfH)
        verts.push(cx * radius, cy * radius, -halfH);
        norms.push(cx, cy, 0);
        // top ring (z = +halfH)
        verts.push(cx * radius, cy * radius,  halfH);
        norms.push(cx, cy, 0);
      }
      for (let i = 0; i < radSegs; i++) {
        const a = i * 2, b = a + 1, c = a + 2, d = c + 1;
        indices.push(a, c, b);
        indices.push(b, c, d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
      g.setAttribute("normal",   new THREE.Float32BufferAttribute(norms, 3));
      g.setIndex(indices);
      return g;
    }

    // CUT ANGLES: remove from -50° to +140° (the top-front facing the camera)
    const CUT_START = -50 * Math.PI / 180;   // -50°
    const CUT_END   = 140 * Math.PI / 180;   // +140°
    // The SOLID arc is the remainder: from CUT_END to CUT_START + 2π
    const SOLID_START = CUT_END;
    const SOLID_END   = CUT_START + Math.PI * 2;

    // ── HOUSING BARREL (solid back arc) ──
    const housingGeo = partialCylinder(hR, hL, SOLID_START, SOLID_END, 48);
    const housingMesh = new THREE.Mesh(housingGeo, mHousing);
    housingMesh.userData = { compId: "housing" };
    statorG.add(housingMesh);

    // ── HOUSING CUT-FACE EDGES (bright lines at the cut boundaries) ──
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x60b8e4, transparent: true, opacity: 0.8 });
    [CUT_START, CUT_END].forEach((a) => {
      const cx = Math.sin(a) * hR, cy = Math.cos(a) * hR;
      const pts = [new THREE.Vector3(cx, cy, -hL*0.5), new THREE.Vector3(cx, cy, hL*0.5)];
      statorG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat));
    });
    // two arc-end rings (partial)
    [-hL*0.5, hL*0.5].forEach((z) => {
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const a = SOLID_START + (SOLID_END - SOLID_START) * (i/6);
        pts.push(new THREE.Vector3(Math.sin(a)*hR, Math.cos(a)*hR, z));
      }
      statorG.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), edgeMat));
    });

    // ── COOLING FINS (only on the solid back arc) ──
    const FIN_COUNT = 18, finH = 0.008, finT = 0.0024, finLen = hL * 0.84;
    for (let i = 0; i < FIN_COUNT; i++) {
      const a = SOLID_START + (SOLID_END - SOLID_START) * ((i + 0.5) / FIN_COUNT);
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(finT, finH, finLen),
        new THREE.MeshStandardMaterial({ color: 0x245d90, metalness: 0.60, roughness: 0.46 })
      );
      fin.position.set(Math.sin(a) * (hR + finH*0.5), Math.cos(a) * (hR + finH*0.5), 0);
      // Rotate fin so its tall axis points radially
      fin.rotation.z = -a;  // align the fin plate radially
      fin.userData = { compId: "housing" };
      statorG.add(fin);
    }

    // ── END CAPS ──
    // Drive-side (z < 0) — solid
    const ecDrive = new THREE.Mesh(new THREE.CylinderGeometry(hR, hR, ecT, 56), mEndSolid);
    ecDrive.rotation.x = Math.PI / 2;
    ecDrive.position.z = -(hL*0.5 + ecT*0.5);
    ecDrive.userData = { compId: "bearing_drive" };
    statorG.add(ecDrive);
    // Fan-side (z > 0) — semi-transparent
    const ecFan = new THREE.Mesh(new THREE.CylinderGeometry(hR, hR, ecT, 56), mEndTrans);
    ecFan.rotation.x = Math.PI / 2;
    ecFan.position.z = (hL*0.5 + ecT*0.5);
    ecFan.userData = { compId: "bearing_fan" };
    statorG.add(ecFan);

    // Bearing bosses
    [{ z: -(hL*0.5 + ecT + 0.004), id: "bearing_drive", mat: mEndSolid },
     { z:  (hL*0.5 + ecT + 0.004), id: "bearing_fan",   mat: mEndTrans }].forEach(({ z, id, mat }) => {
      const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.008, 32), mat);
      boss.rotation.x = Math.PI / 2; boss.position.z = z;
      boss.userData = { compId: id }; statorG.add(boss);
    });

    // Bolts on drive end-cap
    for (let b = 0; b < 4; b++) {
      const ba = (b / 4) * Math.PI * 2 + Math.PI / 6;
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.005, 10), mBolt);
      bolt.rotation.x = Math.PI / 2;
      bolt.position.set(Math.sin(ba)*0.046, Math.cos(ba)*0.046, -(hL*0.5 + ecT + 0.003));
      bolt.userData = { compId: "bearing_drive" }; statorG.add(bolt);
    }

    // ── STATOR SLOT COILS ──
    const stInR = hR - 0.008;  // inner bore
    const SLOT_N = 24;
    for (let i = 0; i < SLOT_N; i++) {
      const a = (i / SLOT_N) * Math.PI * 2;
      const cx = Math.sin(a), cy = Math.cos(a);
      const slotR = stInR - 0.004;

      // white slot liner — thin radial strip running along Z
      const liner = new THREE.Mesh(
        new THREE.BoxGeometry(0.0018, 0.0060, rL * 0.94),
        mSlot
      );
      liner.position.set(cx * (slotR + 0.001), cy * (slotR + 0.001), 0);
      liner.rotation.z = -a;
      liner.userData = { compId: "stator_winding" };
      statorG.add(liner);

      // copper bundle — a cylinder running along Z (the actual wire bundle in the slot)
      const bundle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0028, 0.0028, rL * 0.90, 8),
        mCoil
      );
      bundle.rotation.x = Math.PI / 2;
      bundle.position.set(cx * (slotR - 0.002), cy * (slotR - 0.002), 0);
      bundle.userData = { compId: "stator_winding" };
      statorG.add(bundle);
    }

    // ── COIL END-TURNS ──
    // Prominent arched copper loops + red insulation at each end.
    // Each "coil" spans two slots. We draw thick torus loops at each end.
    const END_LOOPS = 12;
    [-(rL*0.5 + 0.006), (rL*0.5 + 0.006)].forEach((z) => {
      for (let i = 0; i < END_LOOPS; i++) {
        const a = (i / END_LOOPS) * Math.PI * 2;
        const loopR = stInR - 0.014;  // radius of the loop centre from axis
        const cx = Math.sin(a) * loopR, cy = Math.cos(a) * loopR;

        // Red insulation (bigger torus behind copper)
        const insul = new THREE.Mesh(
          new THREE.TorusGeometry(0.0055, 0.0034, 10, 20),
          mInsul
        );
        insul.position.set(cx, cy, z);
        insul.rotation.x = Math.PI / 2;
        insul.rotation.z = -a;
        insul.userData = { compId: "stator_winding" };
        statorG.add(insul);

        // Copper on top
        const copper = new THREE.Mesh(
          new THREE.TorusGeometry(0.0045, 0.0024, 10, 20),
          mCoil
        );
        copper.position.set(cx, cy, z);
        copper.rotation.x = Math.PI / 2;
        copper.rotation.z = -a;
        copper.userData = { compId: "stator_winding" };
        statorG.add(copper);
      }
    });

    // ── BEARINGS ──
    [{ z: -(hL*0.5 + ecT + 0.002), id: "bearing_drive" },
     { z:  (hL*0.5 + ecT + 0.002), id: "bearing_fan"   }].forEach(({ z, id }) => {
      const oR = 0.027, iR = 0.015, mR = (oR+iR)*0.5, bR = 0.0038;
      // outer race
      const outer = new THREE.Mesh(new THREE.TorusGeometry(oR, (oR-mR)*0.8, 10, 40),
        new THREE.MeshStandardMaterial({ color: 0x78a0b2, metalness: 0.88, roughness: 0.22 }));
      outer.rotation.x = Math.PI/2; outer.position.z = z; outer.userData = { compId: id }; statorG.add(outer);
      // inner race
      const inner = new THREE.Mesh(new THREE.TorusGeometry(iR, (mR-iR)*0.8, 10, 40),
        new THREE.MeshStandardMaterial({ color: 0x78a0b2, metalness: 0.88, roughness: 0.22 }));
      inner.rotation.x = Math.PI/2; inner.position.z = z; inner.userData = { compId: id }; statorG.add(inner);
      // balls
      const ballG = new THREE.Group();
      for (let b = 0; b < 9; b++) {
        const ba = (b/9) * Math.PI * 2;
        const ball = new THREE.Mesh(new THREE.SphereGeometry(bR, 8, 8),
          new THREE.MeshStandardMaterial({ color: 0x90b8c8, metalness: 0.92, roughness: 0.14 }));
        ball.position.set(Math.sin(ba)*mR, Math.cos(ba)*mR, 0);
        ball.userData = { compId: id }; ballG.add(ball);
      }
      ballG.position.z = z; statorG.add(ballG);
    });

    // ── ROTOR ──
    const lamN = 34, lamT = rL / lamN, lamGap = 0.00025;
    const lamGeo = new THREE.CylinderGeometry(rR, rR, lamT - lamGap, 44);
    for (let i = 0; i < lamN; i++) {
      const lam = new THREE.Mesh(lamGeo, mLam);
      lam.rotation.x = Math.PI / 2;
      lam.position.z = -(rL*0.5) + lamT*(i+0.5);
      lam.userData = { compId: "rotor_bars" };
      rotorG.add(lam);
    }
    // bars
    for (let i = 0; i < 28; i++) {
      const a = (i/28) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, rL, 8), mBar);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(Math.sin(a)*(rR-0.0032), Math.cos(a)*(rR-0.0032), 0);
      bar.userData = { compId: "rotor_bars" }; rotorG.add(bar);
    }
    // end rings
    [-(rL*0.5), rL*0.5].forEach((z) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rR-0.003, 0.0048, 12, 44), mRing);
      ring.rotation.x = Math.PI/2; ring.position.z = z;
      ring.userData = { compId: "rotor_bars" }; rotorG.add(ring);
    });

    // ── SHAFT ──
    // core
    const shCore = new THREE.Mesh(new THREE.CylinderGeometry(shR, shR, rL, 20), mShaft);
    shCore.rotation.x = Math.PI/2; shCore.userData = { compId: "shaft" }; rotorG.add(shCore);
    // drive extension (longer, sticks out left)
    const drL = 0.085;
    const shDr = new THREE.Mesh(new THREE.CylinderGeometry(shR, shR, drL, 20), mShaft);
    shDr.rotation.x = Math.PI/2; shDr.position.z = -(rL*0.5 + drL*0.5);
    shDr.userData = { compId: "shaft" }; rotorG.add(shDr);
    // fan extension (shorter)
    const fnL = 0.042;
    const shFn = new THREE.Mesh(new THREE.CylinderGeometry(shR*0.88, shR*0.88, fnL, 20), mShaft);
    shFn.rotation.x = Math.PI/2; shFn.position.z = (rL*0.5 + fnL*0.5);
    shFn.userData = { compId: "shaft" }; rotorG.add(shFn);
    // shoulder ring
    const shl = new THREE.Mesh(new THREE.CylinderGeometry(shR*1.2, shR*1.2, 0.0035, 20), mShaft);
    shl.rotation.x = Math.PI/2; shl.position.z = -(rL*0.5);
    shl.userData = { compId: "shaft" }; rotorG.add(shl);
    // keyway
    const kwL = 0.042;
    const kw = new THREE.Mesh(new THREE.BoxGeometry(0.0032, 0.0032, kwL),
      new THREE.MeshStandardMaterial({ color: 0x6a8a9a, metalness: 0.88, roughness: 0.22 }));
    kw.position.set(0, shR - 0.0016, -(rL*0.5 + 0.035));
    kw.userData = { compId: "shaft" }; rotorG.add(kw);

    // ── FAN ──
    const fanZ = rL*0.5 + fnL + ecT + 0.008;
    const fanG = new THREE.Group(); fanG.position.z = fanZ; rotorG.add(fanG);
    // hub
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.012, 28), mFan);
    hub.rotation.x = Math.PI/2; hub.userData = { compId: "fan_guard" }; fanG.add(hub);
    // blades
    for (let i = 0; i < 7; i++) {
      const a = (i/7) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.009, 0.003), mFan);
      blade.position.set(Math.sin(a)*0.032, Math.cos(a)*0.032, 0);
      blade.rotation.z = -a + 0.28;
      blade.userData = { compId: "fan_guard" }; fanG.add(blade);
    }

    // ── FAN GUARD ──
    const gZ = fanZ + 0.012;
    [gZ, gZ - 0.018].forEach((gz) => {
      const gr = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.002, 10, 40), mGuard);
      gr.rotation.x = Math.PI/2; gr.position.z = gz;
      gr.userData = { compId: "fan_guard" }; statorG.add(gr);
    });
    const gSide = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.018, 40, 1, true), mGuard);
    gSide.rotation.x = Math.PI/2; gSide.position.z = gZ - 0.009;
    gSide.userData = { compId: "fan_guard" }; statorG.add(gSide);
    for (let s = 0; s < 10; s++) {
      const sa = (s/10)*Math.PI*2;
      const spG = new THREE.Group(); spG.position.z = gZ - 0.003;
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.001, 0.060, 6), mGuard);
      sp.rotation.z = Math.PI/2; sp.position.set(0, 0.030, 0);
      sp.userData = { compId: "fan_guard" }; spG.add(sp);
      spG.rotation.x = sa; statorG.add(spG);
    }

    // ── JUNCTION BOX ──
    const jbY = hR + 0.024;
    const jb = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.030, 0.036), mBox);
    jb.position.set(0, jbY, -0.018); jb.userData = { compId: "junction_box" }; statorG.add(jb);
    const jl = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.003, 0.040), mBox);
    jl.position.set(0, jbY + 0.0165, -0.018); jl.userData = { compId: "junction_box" }; statorG.add(jl);

    // ── FOOT ──
    const footY = -(hR + 0.007);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.210, 0.011, 0.096), mFoot);
    foot.position.y = footY; foot.userData = { compId: "housing" }; statorG.add(foot);
    [[-0.078,-0.030],[-0.078,0.030],[0.078,-0.030],[0.078,0.030]].forEach(([x,z]) => {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.012, 12),
        new THREE.MeshStandardMaterial({ color: 0x3a5060, metalness: 0.55, roughness: 0.60 }));
      h.position.set(x, footY, z); h.userData = { compId: "housing" }; statorG.add(h);
    });

    // ── GRID ──
    const grid = new THREE.GridHelper(0.6, 20, 0x0a1e35, 0x0a1e35);
    grid.position.y = footY - 0.007; scene.add(grid);

    // ── LABEL SPRITES ──
    const labelPositions = [
      { num: 1,  pos: new THREE.Vector3(-(rL*0.5+drL*0.5),  0.000,  0.000), id: "shaft"          },
      { num: 2,  pos: new THREE.Vector3(-(hL*0.5+ecT+0.010), 0.015, -0.005), id: "bearing_drive"  },
      { num: 3,  pos: new THREE.Vector3( 0.000,              rR+0.018, 0.000), id: "rotor_bars"    },
      { num: 4,  pos: new THREE.Vector3( 0.000,              stInR+0.010, -0.040), id: "stator_winding" },
      { num: 5,  pos: new THREE.Vector3( 0.000,             -0.040,  rL*0.5+0.014), id: "stator_winding" },
      { num: 6,  pos: new THREE.Vector3( hL*0.5+ecT+0.010,  0.015, -0.005), id: "bearing_fan"    },
      { num: 7,  pos: new THREE.Vector3( fanZ+0.008,         0.000,  0.000), id: "fan_guard"      },
      { num: 8,  pos: new THREE.Vector3( 0.000,              hR+0.020, 0.060), id: "housing"      },
      { num: 9,  pos: new THREE.Vector3(-0.040,             -(hR+finH+0.012), 0.000), id: "housing" },
      { num: 10, pos: new THREE.Vector3( 0.000,              jbY+0.022, -0.018), id: "junction_box" },
    ];
    const finH_val = 0.008; // reuse for label 9
    labelPositions[8].pos.y = -(hR + finH_val + 0.014);

    labelPositions.forEach(({ num, pos, id }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 128; canvas.height = 128;
      const ctx = canvas.getContext("2d");
      // shadow
      ctx.beginPath(); ctx.arc(66, 66, 54, 0, Math.PI*2);
      ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fill();
      // bg circle
      ctx.beginPath(); ctx.arc(64, 64, 54, 0, Math.PI*2);
      ctx.fillStyle = "rgba(15,25,40,0.88)"; ctx.fill();
      ctx.strokeStyle = "rgba(140,200,230,0.80)"; ctx.lineWidth = 5; ctx.stroke();
      // number
      ctx.fillStyle = "#eef4f8";
      ctx.font = "bold 72px Arial";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(num), 64, 66);

      const tex = new THREE.CanvasTexture(canvas);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.95 }));
      sp.position.copy(pos);
      sp.scale.set(0.026, 0.026, 1);
      sp.userData = { compId: id, isLabel: true };
      scene.add(sp);
    });

    // ── STORE ──
    const origMats = new Map();
    motor.traverse((c) => { if (c.isMesh) origMats.set(c, c.material); });

    // bearing ball groups (for orbit anim)
    const bbGroups = [];
    statorG.traverse((c) => {
      if (c.isGroup && c.children.length === 9 && c.children[0].isMesh && c.children[0].geometry.type === "SphereGeometry") {
        bbGroups.push(c);
      }
    });

    // ── ORBIT ──
    let isDrag = false, prev = { x: 0, y: 0 };
    const sph = new THREE.Spherical().setFromVector3(camera.position);
    const onDown = (x,y) => { isDrag = true; prev = {x,y}; };
    const onUp   = () => { isDrag = false; };
    const onMove = (x,y) => {
      if (!isDrag) return;
      sph.theta -= (x - prev.x) * 0.005;
      sph.phi   -= (y - prev.y) * 0.005;
      sph.phi = Math.max(0.15, Math.min(Math.PI-0.15, sph.phi));
      camera.position.setFromSpherical(sph);
      camera.lookAt(0,0,0);
      prev = {x,y};
    };
    const onWheel = (e) => {
      e.preventDefault();
      sph.radius = Math.max(0.22, Math.min(0.9, sph.radius + e.deltaY*0.0004));
      camera.position.setFromSpherical(sph); camera.lookAt(0,0,0);
    };
    renderer.domElement.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
    window.addEventListener("mouseup", onUp);
    renderer.domElement.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("touchstart", (e) => { if(e.touches.length===1) onDown(e.touches[0].clientX, e.touches[0].clientY); }, {passive:true});
    renderer.domElement.addEventListener("touchmove",  (e) => { e.preventDefault(); if(e.touches.length===1) onMove(e.touches[0].clientX, e.touches[0].clientY); }, {passive:false});
    renderer.domElement.addEventListener("touchend", onUp);

    // ── ANIMATE ──
    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      timeRef.current += 0.016;
      const angV = (1740/60)*Math.PI*2;
      rotorG.rotation.z = timeRef.current * angV;
      fanG.rotation.z   = timeRef.current * angV; // fan spins with rotor

      // bearing balls orbit
      bbGroups.forEach((g) => { g.rotation.z = timeRef.current * angV * 0.44; });

      // highlight
      const hid = hlRef.current;
      motor.traverse((c) => {
        if (c.isMesh && !c.userData.isLabel) {
          c.material = (hid && c.userData.compId === hid) ? mHLIGHT : (origMats.get(c) || c.material);
        }
      });

      // coil pulse — 3-phase travelling wave
      motor.traverse((c) => {
        if (c.isMesh && c.userData.compId === "stator_winding" && origMats.get(c) === mCoil) {
          const a = Math.atan2(c.position.x, c.position.y);
          origMats.get(c).emissiveIntensity = 0.14 + Math.sin(timeRef.current*18 + a*3)*0.22;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // ── RESIZE ──
    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mouseup", onUp);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width:"100%", height:"100%", cursor:"grab" }} />;
}

// ─── LABEL LEGEND (HTML overlay) ──────────────────────
function LabelLegend() {
  return (
    <div style={{ position:"absolute", bottom:6, left:6, display:"flex", flexWrap:"wrap", gap:4, pointerEvents:"none", zIndex:2 }}>
      {LABEL_LEGEND.map(({ num, label }) => (
        <div key={num} style={{
          display:"flex", alignItems:"center", gap:4,
          background:"rgba(8,18,32,0.78)", border:"1px solid rgba(100,170,210,0.35)",
          borderRadius:4, padding:"2px 6px"
        }}>
          <div style={{
            width:16, height:16, borderRadius:"50%",
            background:"rgba(15,25,40,0.9)", border:"1.5px solid rgba(140,200,230,0.7)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:9, fontWeight:700, color:"#eef4f8"
          }}>{num}</div>
          <span style={{ fontSize:9, color:"#8ab0c4", fontWeight:600 }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── HEALTH BAR ───────────────────────────────────────
function HealthBar({ value, color }) {
  return (
    <div style={{ width:"100%", height:6, background:"#0a1e35", borderRadius:3, overflow:"hidden" }}>
      <div style={{ width:`${value}%`, height:"100%", borderRadius:3, background:`linear-gradient(90deg,${color}88,${color})`, boxShadow:`0 0 6px ${color}55`, transition:"width .6s ease" }} />
    </div>
  );
}

// ─── COMP CARD ────────────────────────────────────────
function CompCard({ comp, isSelected, onClick }) {
  const bc = isSelected ? T.accent : comp.status==="critical" ? T.danger : comp.status==="warning" ? T.warn : T.cardBorder;
  return (
    <div onClick={onClick} style={{ background: isSelected?"rgba(0,180,216,0.07)":T.card, border:`1px solid ${bc}`, borderRadius:8, padding:"10px 12px", cursor:"pointer", transition:"all .2s", position:"relative", boxShadow: isSelected?`0 0 12px ${T.accent}30`:"none" }}>
      {comp.status!=="good" && <div style={{ position:"absolute", top:8, right:8, width:8, height:8, borderRadius:"50%", background: comp.status==="critical"?T.danger:T.warn, boxShadow:`0 0 6px ${comp.status==="critical"?T.danger:T.warn}`, animation:"pulse 1.8s infinite" }} />}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
        <span style={{ fontSize:16 }}>{comp.icon}</span>
        <span style={{ fontSize:11, fontWeight:700, color:T.text, letterSpacing:0.5 }}>{comp.label}</span>
      </div>
      <HealthBar value={comp.health} color={comp.color} />
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
        <span style={{ fontSize:10, color:comp.color, fontWeight:700 }}>{comp.health}%</span>
        <span style={{ fontSize:9, color:T.textMuted, textTransform:"uppercase", letterSpacing:0.8 }}>{comp.status}</span>
      </div>
    </div>
  );
}

function FaultBadge({ text }) {
  return (
    <div style={{ display:"inline-flex", alignItems:"center", gap:5, background:"rgba(255,71,87,0.12)", border:"1px solid rgba(255,71,87,0.3)", borderRadius:20, padding:"3px 10px", fontSize:10, color:T.danger, fontWeight:600 }}>
      <span style={{ width:5, height:5, borderRadius:"50%", background:T.danger, display:"inline-block" }} />{text}
    </div>
  );
}

function StatBox({ label, value, unit, color, icon }) {
  return (
    <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:8, padding:"10px 14px", textAlign:"center" }}>
      <div style={{ fontSize:18, marginBottom:2 }}>{icon}</div>
      <div style={{ fontSize:20, fontWeight:700, color:color||T.accent }}>{value}<span style={{ fontSize:11, color:T.textMuted, fontWeight:400 }}> {unit}</span></div>
      <div style={{ fontSize:9, color:T.textMuted, textTransform:"uppercase", letterSpacing:1, marginTop:2 }}>{label}</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:"#0d1f35", border:`1px solid ${T.cardBorder}`, borderRadius:6, padding:"8px 12px", boxShadow:"0 4px 14px #00000055" }}>
      <div style={{ fontSize:9, color:T.textMuted, marginBottom:4 }}>t = {label}s</div>
      {payload.map((p,i) => <div key={i} style={{ fontSize:11, color:p.color, fontWeight:600 }}>{p.name}: <span style={{ color:T.text }}>{p.value}</span></div>)}
    </div>
  );
};

// ─── APP ──────────────────────────────────────────────
export default function App() {
  const [selectedComp, setSelectedComp] = useState(null);
  const [activeTab, setActiveTab] = useState("vibration");
  const [time, setTime] = useState(0);
  useEffect(() => { const iv = setInterval(() => setTime(t=>t+1),1000); return ()=>clearInterval(iv); }, []);

  const selComp = COMPONENTS.find(c => c.id === selectedComp);
  const critCount = COMPONENTS.filter(c => c.status==="critical").length;
  const warnCount = COMPONENTS.filter(c => c.status==="warning").length;
  const allFaults = COMPONENTS.flatMap(c => c.faults.map(f => ({ fault:f, comp:c.label, status:c.status })));

  const charts = {
    vibration: (
      <ResponsiveContainer width="100%" height={140}><LineChart data={vibData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#0f2a4a" />
        <XAxis dataKey="t" tick={{fontSize:9,fill:T.textMuted}} axisLine={{stroke:T.cardBorder}} tickLine={false} />
        <YAxis tick={{fontSize:9,fill:T.textMuted}} axisLine={{stroke:T.cardBorder}} tickLine={false} domain={[0,8]} unit=" mm/s" />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="vibration" stroke={T.accent} strokeWidth={2} dot={false} name="Vibration" />
        <Line type="monotone" dataKey="threshold" stroke={T.danger} strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="Threshold" />
      </LineChart></ResponsiveContainer>
    ),
    temperature: (
      <ResponsiveContainer width="100%" height={140}><LineChart data={tempData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#0f2a4a" />
        <XAxis dataKey="t" tick={{fontSize:9,fill:T.textMuted}} axisLine={{stroke:T.cardBorder}} tickLine={false} />
        <YAxis tick={{fontSize:9,fill:T.textMuted}} axisLine={{stroke:T.cardBorder}} tickLine={false} domain={[30,100]} unit="°C" />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="temperature" stroke={T.warn} strokeWidth={2} dot={false} name="Temperature" />
        <Line type="monotone" dataKey="limit" stroke={T.danger} strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="Limit" />
      </LineChart></ResponsiveContainer>
    ),
    current: (
      <ResponsiveContainer width="100%" height={140}><LineChart data={curData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#0f2a4a" />
        <XAxis dataKey="t" tick={{fontSize:9,fill:T.textMuted}} axisLine={{stroke:T.cardBorder}} tickLine={false} />
        <YAxis tick={{fontSize:9,fill:T.textMuted}} axisLine={{stroke:T.cardBorder}} tickLine={false} unit=" A" />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="phaseA" stroke="#00b4d8" strokeWidth={1.8} dot={false} name="Phase A" />
        <Line type="monotone" dataKey="phaseB" stroke="#f5a623" strokeWidth={1.8} dot={false} name="Phase B" />
        <Line type="monotone" dataKey="phaseC" stroke="#2ed573" strokeWidth={1.8} dot={false} name="Phase C" />
      </LineChart></ResponsiveContainer>
    ),
  };

  return (
    <div style={{ width:"100%", minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Courier New',monospace", fontSize:12 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} *{box-sizing:border-box} ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:${T.bg}} ::-webkit-scrollbar-thumb{background:${T.cardBorder};border-radius:3px}`}</style>

      {/* TOP NAV */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 22px", background:T.surface, borderBottom:`1px solid ${T.cardBorder}`, flexWrap:"wrap", gap:8 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ width:9, height:9, borderRadius:"50%", background:T.good, boxShadow:`0 0 8px ${T.good}` }} />
          <span style={{ fontSize:14, fontWeight:700, color:"#fff", letterSpacing:2.5 }}>SEW-EURODRIVE</span>
          <span style={{ fontSize:10, color:T.textMuted, letterSpacing:1 }}>DRE100L4 · PREDICTIVE MAINTENANCE</span>
        </div>
        <div style={{ display:"flex", gap:16, fontSize:10, color:T.textMuted }}>
          <span>⏱ Uptime: <span style={{color:T.accent}}>847h</span></span>
          <span>📡 Sync: <span style={{color:T.good}}>LIVE</span></span>
          <span>t+{time}s</span>
        </div>
      </div>

      {/* STATS */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))", gap:10, padding:"14px 22px" }}>
        <StatBox label="Overall Health" value="84" unit="%" color={T.accent} icon="💚" />
        <StatBox label="Alerts" value={critCount+warnCount} unit="" color={T.warn} icon="⚠️" />
        <StatBox label="Critical" value={critCount} unit="" color={T.danger} icon="🔴" />
        <StatBox label="Vibration" value="4.2" unit="mm/s" color={T.warn} icon="📈" />
        <StatBox label="Max Temp" value="84" unit="°C" color={T.danger} icon="🌡️" />
        <StatBox label="RPM" value="1740" unit="" color={T.accent} icon="🔄" />
      </div>

      {/* MAIN */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:14, padding:"0 22px 22px" }}>
        {/* LEFT */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:14 }}>
            {/* 3D */}
            <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:10, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 14px", borderBottom:`1px solid ${T.cardBorder}` }}>
                <span style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:1.5 }}>3D Motor View — Cutaway</span>
                {selectedComp && <span style={{ fontSize:9, color:T.accent, background:`${T.accent}18`, padding:"2px 8px", borderRadius:10, border:`1px solid ${T.accent}44` }}>▸ {selComp?.label}</span>}
              </div>
              <div style={{ position:"relative", height:320 }}>
                <MotorViewer highlightId={selectedComp} />
                <LabelLegend />
              </div>
            </div>
            {/* COMP GRID */}
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:10, padding:"8px 14px" }}>
                <span style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:1.5 }}>Components — Click to Highlight</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, flex:1 }}>
                {COMPONENTS.map(c => <CompCard key={c.id} comp={c} isSelected={selectedComp===c.id} onClick={()=>setSelectedComp(selectedComp===c.id?null:c.id)} />)}
              </div>
            </div>
          </div>

          {/* CHARTS ROW */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:10, overflow:"hidden" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderBottom:`1px solid ${T.cardBorder}` }}>
                <span style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:1.5 }}>Sensor Streams</span>
                <div style={{ display:"flex", gap:4, marginLeft:"auto" }}>
                  {["vibration","temperature","current"].map(tab => (
                    <button key={tab} onClick={()=>setActiveTab(tab)} style={{ padding:"2px 8px", fontSize:9, background:activeTab===tab?T.accent:"transparent", color:activeTab===tab?"#fff":T.textMuted, border:`1px solid ${activeTab===tab?T.accent:T.cardBorder}`, borderRadius:4, cursor:"pointer", textTransform:"uppercase", letterSpacing:0.8, fontFamily:"inherit", fontWeight:600 }}>{tab}</button>
                  ))}
                </div>
              </div>
              <div style={{ padding:"12px 10px 6px" }}>{charts[activeTab]}</div>
            </div>

            <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:10, overflow:"hidden" }}>
              <div style={{ padding:"8px 14px", borderBottom:`1px solid ${T.cardBorder}` }}>
                <span style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:1.5 }}>Component Detail</span>
              </div>
              <div style={{ padding:14 }}>
                {selComp ? (
                  <>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                      <span style={{ fontSize:24 }}>{selComp.icon}</span>
                      <div><div style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{selComp.label}</div><div style={{ fontSize:10, color:selComp.color, textTransform:"uppercase", letterSpacing:1, fontWeight:700 }}>{selComp.status}</div></div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                      {[["Health",`${selComp.health}%`,selComp.color],["Temp",`${selComp.temp}°C`,selComp.temp>75?T.danger:T.warn],["Vibration",`${selComp.vibration} mm/s`,selComp.vibration>4?T.danger:T.accent],["Maint. In",selComp.rrh,selComp.rrh!=="—"?T.warn:T.good]].map(([k,v,c])=>(
                        <div key={k} style={{ background:"#0a1e35", borderRadius:6, padding:"8px 10px" }}>
                          <div style={{ fontSize:9, color:T.textMuted, textTransform:"uppercase", letterSpacing:0.8 }}>{k}</div>
                          <div style={{ fontSize:15, fontWeight:700, color:c, marginTop:2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <HealthBar value={selComp.health} color={selComp.color} />
                    {selComp.faults.length > 0 && (
                      <div style={{ marginTop:12 }}>
                        <div style={{ fontSize:9, color:T.textMuted, textTransform:"uppercase", letterSpacing:1, marginBottom:6 }}>Detected Faults</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:5 }}>{selComp.faults.map(f=><FaultBadge key={f} text={f} />)}</div>
                      </div>
                    )}
                  </>
                ) : <div style={{ textAlign:"center", color:T.textMuted, fontSize:11, padding:"40px 0", fontStyle:"italic" }}>← Select a component to inspect</div>}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COL */}
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:10, overflow:"hidden", flex:1 }}>
            <div style={{ padding:"8px 14px", borderBottom:`1px solid ${T.cardBorder}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <span style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:1.5 }}>Active Faults</span>
              <span style={{ fontSize:9, background:`${T.danger}20`, color:T.danger, padding:"1px 7px", borderRadius:8, border:`1px solid ${T.danger}44` }}>{allFaults.length}</span>
            </div>
            <div style={{ padding:10, display:"flex", flexDirection:"column", gap:8 }}>
              {allFaults.map((f,i)=>(
                <div key={i} style={{ background:f.status==="critical"?"rgba(255,71,87,0.08)":"rgba(245,166,35,0.08)", border:`1px solid ${f.status==="critical"?"rgba(255,71,87,0.25)":"rgba(245,166,35,0.25)"}`, borderRadius:7, padding:"9px 11px" }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:11, fontWeight:700, color:f.status==="critical"?T.danger:T.warn }}>{f.fault}</span>
                    <span style={{ fontSize:8, background:f.status==="critical"?`${T.danger}25`:`${T.warn}25`, color:f.status==="critical"?T.danger:T.warn, padding:"1px 6px", borderRadius:6, textTransform:"uppercase", letterSpacing:0.8 }}>{f.status}</span>
                  </div>
                  <div style={{ fontSize:10, color:T.textDim }}>📍 {f.comp}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:10, overflow:"hidden" }}>
            <div style={{ padding:"8px 14px", borderBottom:`1px solid ${T.cardBorder}` }}>
              <span style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:1.5 }}>Predictive Actions</span>
            </div>
            <div style={{ padding:10, display:"flex", flexDirection:"column", gap:7 }}>
              {[
                { priority:"HIGH",   action:"Replace drive-side bearing — outer race degradation",             eta:"12 days" },
                { priority:"URGENT", action:"Inspect rotor bars — broken bar signature in current spectrum",    eta:"3 days"  },
                { priority:"MED",    action:"Balance fan assembly — blade wear imbalance detected",             eta:"8 days"  },
                { priority:"LOW",    action:"Verify shaft alignment at next scheduled stop",                    eta:"—"       },
              ].map((item,i)=>{
                const pc = item.priority==="URGENT"?T.danger:item.priority==="HIGH"?T.warn:item.priority==="MED"?T.accent:T.textMuted;
                return (
                  <div key={i} style={{ background:"#0a1e35", borderRadius:6, padding:"8px 10px", display:"flex", gap:10, alignItems:"flex-start" }}>
                    <span style={{ fontSize:8, fontWeight:700, color:pc, background:`${pc}18`, border:`1px solid ${pc}44`, borderRadius:4, padding:"2px 5px", whiteSpace:"nowrap", letterSpacing:0.8 }}>{item.priority}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:10.5, color:T.text, lineHeight:1.4 }}>{item.action}</div>
                      {item.eta!=="—" && <div style={{ fontSize:9, color:T.textMuted, marginTop:2 }}>⏳ Act within {item.eta}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ background:T.card, border:`1px solid ${T.cardBorder}`, borderRadius:10, overflow:"hidden" }}>
            <div style={{ padding:"8px 14px", borderBottom:`1px solid ${T.cardBorder}` }}>
              <span style={{ fontSize:10, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:1.5 }}>Monitored Fault Types</span>
            </div>
            <div style={{ padding:10, display:"flex", flexDirection:"column", gap:5 }}>
              {[["Bearing Wear","Vibration spectrum + temp"],["Broken Rotor Bar","Stator current signature"],["Eccentricity","Vibration + current harmonics"],["Stator Winding","Insulation resistance + temp"],["Shaft Misalignment","Vibration pattern analysis"],["Fan Imbalance","Vibration amplitude + phase"]].map(([name,method])=>(
                <div key={name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 0", borderBottom:"1px solid #0f2030" }}>
                  <span style={{ fontSize:10, color:T.text, fontWeight:600 }}>{name}</span>
                  <span style={{ fontSize:9, color:T.textMuted }}>{method}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

