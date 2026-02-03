import { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

// ─── THEME ────────────────────────────────────────────
const T = {
  bg: "#030810",
  surface: "#070e1a",
  card: "#0a1628",
  cardBorder: "#0f2a4a",
  accent: "#00b4d8",
  accentDim: "#0077a8",
  accentGlow: "rgba(0,180,216,0.18)",
  warn: "#f5a623",
  danger: "#ff4757",
  good: "#2ed573",
  text: "#c5dce8",
  textDim: "#5a7a8e",
  textMuted: "#2e4a5e",
};

// ─── SIMULATED SENSOR DATA ───────────────────────────
const generateSeries = (base, noise, count = 60) =>
  Array.from({ length: count }, (_, i) => base + (Math.random() - 0.5) * noise + Math.sin(i * 0.3) * (noise * 0.4));

const COMPONENTS = [
  {
    id: "bearing_drive",
    label: "Drive-Side Bearing",
    icon: "⚙️",
    health: 78,
    status: "warning",
    temp: 62,
    vibration: 4.2,
    faults: ["Outer Race Wear", "Misalignment Risk"],
    rrh: "12 days",
    color: "#f5a623",
  },
  {
    id: "bearing_fan",
    label: "Fan-Side Bearing",
    icon: "⚙️",
    health: 94,
    status: "good",
    temp: 48,
    vibration: 1.1,
    faults: [],
    rrh: "—",
    color: "#2ed573",
  },
  {
    id: "stator_winding",
    label: "Stator Winding",
    icon: "🔌",
    health: 88,
    status: "good",
    temp: 71,
    vibration: 0.4,
    faults: [],
    rrh: "—",
    color: "#2ed573",
  },
  {
    id: "rotor_bars",
    label: "Rotor / Bars",
    icon: "🔄",
    health: 65,
    status: "critical",
    temp: 84,
    vibration: 5.8,
    faults: ["Broken Bar Signature", "Eccentricity Detected"],
    rrh: "3 days",
    color: "#ff4757",
  },
  {
    id: "shaft",
    label: "Shaft & Keyway",
    icon: "📐",
    health: 91,
    status: "good",
    temp: 55,
    vibration: 0.9,
    faults: [],
    rrh: "—",
    color: "#2ed573",
  },
  {
    id: "junction_box",
    label: "Junction Box",
    icon: "📦",
    health: 97,
    status: "good",
    temp: 42,
    vibration: 0.2,
    faults: [],
    rrh: "—",
    color: "#2ed573",
  },
  {
    id: "housing",
    label: "Housing / Fins",
    icon: "🏗️",
    health: 85,
    status: "good",
    temp: 58,
    vibration: 1.3,
    faults: [],
    rrh: "—",
    color: "#2ed573",
  },
  {
    id: "fan_guard",
    label: "Fan & Guard",
    icon: "💨",
    health: 72,
    status: "warning",
    temp: 46,
    vibration: 2.9,
    faults: ["Fan Blade Imbalance"],
    rrh: "8 days",
    color: "#f5a623",
  },
];

// ─── CHART DATA ────────────────────────────────────────
const vibData = generateSeries(2.8, 3.2, 60).map((v, i) => ({
  t: i,
  vibration: +v.toFixed(2),
  threshold: 4.5,
}));
const tempData = generateSeries(58, 14, 60).map((v, i) => ({
  t: i,
  temperature: +v.toFixed(1),
  limit: 90,
}));
const currentData = generateSeries(4.2, 0.8, 60).map((v, i) => ({
  t: i,
  phaseA: +v.toFixed(2),
  phaseB: +(v + (Math.random() - 0.5) * 0.6).toFixed(2),
  phaseC: +(v - (Math.random() - 0.5) * 0.6).toFixed(2),
}));

// ─── 3D MOTOR SCENE ──────────────────────────────────
function MotorViewer({ highlightId }) {
  const mountRef = useRef(null);
  const sceneRef = useRef({});
  const animRef = useRef(null);
  const timeRef = useRef(0);
  const highlightRef = useRef(highlightId);
  useEffect(() => { highlightRef.current = highlightId; }, [highlightId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;
    const W = container.clientWidth, H = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(T.bg);

    const camera = new THREE.PerspectiveCamera(40, W / H, 0.005, 50);
    camera.position.set(0.38, 0.16, 0.34);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Lights
    scene.add(new THREE.AmbientLight(0x1a3050, 0.7));
    const kl = new THREE.DirectionalLight(0x6ab4d8, 1.1);
    kl.position.set(0.4, 0.5, 0.35);
    scene.add(kl);
    const rl = new THREE.DirectionalLight(0x1a4060, 0.6);
    rl.position.set(-0.3, -0.2, -0.3);
    scene.add(rl);

    // Materials — full blue palette
    const housing = new THREE.MeshStandardMaterial({ color: 0x0d2137, metalness: 0.72, roughness: 0.4 });
    const endcap = new THREE.MeshStandardMaterial({ color: 0x112840, metalness: 0.75, roughness: 0.35 });
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0x14375c, metalness: 0.6, roughness: 0.42, emissive: 0x0a1f3a, emissiveIntensity: 0.35 });
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x3a7ca5, metalness: 0.9, roughness: 0.2 });
    const coilMat = new THREE.MeshStandardMaterial({ color: 0x00b4d8, metalness: 0.55, roughness: 0.5, emissive: 0x005a6e, emissiveIntensity: 0.2 });
    const barMat = new THREE.MeshStandardMaterial({ color: 0x5ba3c9, metalness: 0.88, roughness: 0.22 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x6cb8d6, metalness: 0.85, roughness: 0.25 });
    const fanBlkMat = new THREE.MeshStandardMaterial({ color: 0x091a2e, metalness: 0.5, roughness: 0.55 });
    const guardMat = new THREE.MeshStandardMaterial({ color: 0x0f2540, metalness: 0.6, roughness: 0.45 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x082030, metalness: 0.7, roughness: 0.4 });
    const footMat = new THREE.MeshStandardMaterial({ color: 0x0a1a30, metalness: 0.68, roughness: 0.42 });

    const highlightMat = new THREE.MeshStandardMaterial({ color: 0x00b4d8, metalness: 0.6, roughness: 0.35, emissive: 0x00b4d8, emissiveIntensity: 0.5 });

    const motor = new THREE.Group();
    scene.add(motor);
    const statorG = new THREE.Group();
    motor.add(statorG);
    const rotorG = new THREE.Group();
    motor.add(rotorG);

    // Dimensions
    const hR = 0.090, hL = 0.240, rR = 0.074, rL = 0.200;
    const ecT = 0.022, shR = 0.014, shExtD = 0.065, shExtF = 0.030;

    // ── HOUSING ──
    const housingMesh = new THREE.Mesh(new THREE.CylinderGeometry(hR, hR, hL, 56), housing);
    housingMesh.rotation.x = Math.PI / 2;
    housingMesh.userData = { compId: "housing" };
    statorG.add(housingMesh);

    // Fins
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(hL * 0.92, 0.006, 0.003), housing);
      fin.position.set(0, Math.cos(a) * (hR + 0.003), Math.sin(a) * (hR + 0.003));
      fin.rotation.x = a;
      fin.userData = { compId: "housing" };
      statorG.add(fin);
    }

    // End caps
    [-(hL / 2 + ecT / 2), hL / 2 + ecT / 2].forEach((z, idx) => {
      const ec = new THREE.Mesh(new THREE.CylinderGeometry(hR, hR, ecT, 56), endcap);
      ec.rotation.x = Math.PI / 2;
      ec.position.z = z;
      ec.userData = { compId: idx === 0 ? "bearing_drive" : "bearing_fan" };
      statorG.add(ec);
    });

    // Stator coils
    const stInR = hR - 0.008;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.0045, 0.0024, 8, 14), coilMat);
      coil.position.set(0, Math.cos(a) * stInR, Math.sin(a) * stInR);
      coil.rotation.x = Math.PI / 2;
      coil.rotation.z = a;
      coil.userData = { compId: "stator_winding" };
      statorG.add(coil);
    }

    // Bearings
    [-(hL / 2 + ecT + 0.001), hL / 2 + ecT + 0.001].forEach((z, idx) => {
      const br = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.006, 12, 28), barMat);
      br.rotation.x = Math.PI / 2;
      br.position.z = z;
      br.userData = { compId: idx === 0 ? "bearing_drive" : "bearing_fan" };
      statorG.add(br);
    });

    // ── ROTOR ──
    const rotorMesh = new THREE.Mesh(new THREE.CylinderGeometry(rR, rR, rL, 44), rotorMat);
    rotorMesh.rotation.x = Math.PI / 2;
    rotorMesh.userData = { compId: "rotor_bars" };
    rotorG.add(rotorMesh);

    // Rotor bars
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, rL, 8), barMat);
      bar.rotation.x = Math.PI / 2;
      bar.position.set(0, Math.cos(a) * (rR - 0.004), Math.sin(a) * (rR - 0.004));
      bar.userData = { compId: "rotor_bars" };
      rotorG.add(bar);
    }

    // End rings
    [-(rL / 2), rL / 2].forEach((z) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rR - 0.004, 0.0035, 12, 40), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.z = z;
      ring.userData = { compId: "rotor_bars" };
      rotorG.add(ring);
    });

    // ── SHAFT ──
    const totalSh = rL + shExtD + shExtF;
    const shOff = (shExtF - shExtD) / 2;
    const shaftMesh = new THREE.Mesh(new THREE.CylinderGeometry(shR, shR, totalSh, 18), shaftMat);
    shaftMesh.rotation.x = Math.PI / 2;
    shaftMesh.position.z = shOff;
    shaftMesh.userData = { compId: "shaft" };
    rotorG.add(shaftMesh);

    // Keyway
    const keyL = shExtD * 0.7;
    const keyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.004, keyL), new THREE.MeshStandardMaterial({ color: 0x2a6080, metalness: 0.85, roughness: 0.25 }));
    keyMesh.position.set(0, shR - 0.002, -(rL / 2 + shExtD / 2 - keyL / 2 - shOff));
    keyMesh.userData = { compId: "shaft" };
    rotorG.add(keyMesh);

    // ── FAN ──
    const fanZ = rL / 2 + shExtF + ecT + 0.005 + shOff;
    const fanG = new THREE.Group();
    fanG.position.z = fanZ - shOff;
    rotorG.add(fanG);
    // Hub
    fanG.add((() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.018, 22), fanBlkMat); m.rotation.x = Math.PI / 2; m.userData = { compId: "fan_guard" }; return m; })());
    // Blades
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.012, 0.004), fanBlkMat);
      blade.position.set(0, Math.cos(a) * 0.034, Math.sin(a) * 0.034);
      blade.rotation.x = a + 0.3;
      blade.userData = { compId: "fan_guard" };
      fanG.add(blade);
    }

    // ── FAN GUARD ──
    const guardZ = fanZ + 0.012;
    [guardZ, guardZ - 0.02].forEach((z) => {
      const gr = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.003, 10, 36), guardMat);
      gr.rotation.x = Math.PI / 2;
      gr.position.z = z;
      gr.userData = { compId: "fan_guard" };
      statorG.add(gr);
    });
    const guardSide = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.018, 34, 1, true), guardMat);
    guardSide.rotation.x = Math.PI / 2;
    guardSide.position.z = guardZ - 0.009;
    guardSide.userData = { compId: "fan_guard" };
    statorG.add(guardSide);

    // ── JUNCTION BOX ──
    const jbY = hR + 0.006 + 0.017;
    const jbox = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.035, 0.040), boxMat);
    jbox.position.set(0, jbY, -0.02);
    jbox.userData = { compId: "junction_box" };
    statorG.add(jbox);
    const jlid = new THREE.Mesh(new THREE.BoxGeometry(0.064, 0.003, 0.044), boxMat);
    jlid.position.set(0, jbY + 0.0185, -0.02);
    jlid.userData = { compId: "junction_box" };
    statorG.add(jlid);

    // ── FOOT ──
    const footY = -(hR + 0.006);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.220, 0.012, 0.100), footMat);
    foot.position.y = footY;
    foot.userData = { compId: "housing" };
    statorG.add(foot);

    // Grid
    const grid = new THREE.GridHelper(0.8, 24, 0x0a1e35, 0x0a1e35);
    grid.position.y = footY - 0.01;
    scene.add(grid);

    // Store original materials map
    const origMats = new Map();
    motor.traverse((c) => { if (c.isMesh) origMats.set(c, c.material); });
    sceneRef.current = { scene, camera, renderer, rotorG, motor, origMats, highlightMat };

    // ── ORBIT ──
    let isDrag = false, prev = { x: 0, y: 0 };
    const sph = new THREE.Spherical().setFromVector3(camera.position);
    const onDown = (x, y) => { isDrag = true; prev = { x, y }; };
    const onUp = () => { isDrag = false; };
    const onMove = (x, y) => {
      if (!isDrag) return;
      sph.theta -= (x - prev.x) * 0.005;
      sph.phi -= (y - prev.y) * 0.005;
      sph.phi = Math.max(0.15, Math.min(Math.PI - 0.15, sph.phi));
      camera.position.setFromSpherical(sph);
      camera.lookAt(0, 0, 0);
      prev = { x, y };
    };
    const onWheel = (e) => {
      e.preventDefault();
      sph.radius = Math.max(0.2, Math.min(1.0, sph.radius + e.deltaY * 0.0004));
      camera.position.setFromSpherical(sph);
      camera.lookAt(0, 0, 0);
    };
    renderer.domElement.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
    window.addEventListener("mouseup", onUp);
    renderer.domElement.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    renderer.domElement.addEventListener("touchstart", (e) => { if (e.touches.length === 1) onDown(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
    renderer.domElement.addEventListener("touchmove", (e) => { e.preventDefault(); if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
    renderer.domElement.addEventListener("touchend", onUp);

    // ── ANIMATE ──
    const animate = () => {
      animRef.current = requestAnimationFrame(animate);
      timeRef.current += 0.016;
      rotorG.rotation.z = timeRef.current * ((1740 / 60) * Math.PI * 2);

      // Highlight
      const hid = highlightRef.current;
      motor.traverse((c) => {
        if (c.isMesh) {
          if (hid && c.userData.compId === hid) {
            c.material = highlightMat;
          } else {
            c.material = origMats.get(c) || c.material;
          }
        }
      });

      // Coil pulse
      motor.traverse((c) => {
        if (c.isMesh && c.userData.compId === "stator_winding" && origMats.get(c)) {
          const ph = (c.position.y + c.position.z) * 25;
          origMats.get(c).emissiveIntensity = 0.2 + Math.sin(timeRef.current * 25 + ph) * 0.25;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const w = container.clientWidth, h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
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

  return <div ref={mountRef} style={{ width: "100%", height: "100%", cursor: "grab" }} />;
}

// ─── HEALTH BAR ────────────────────────────────────────
function HealthBar({ value, color }) {
  return (
    <div style={{ width: "100%", height: 6, background: "#0a1e35", borderRadius: 3, overflow: "hidden" }}>
      <div style={{
        width: `${value}%`, height: "100%", borderRadius: 3,
        background: `linear-gradient(90deg, ${color}88, ${color})`,
        boxShadow: `0 0 6px ${color}55`,
        transition: "width 0.6s ease"
      }} />
    </div>
  );
}

// ─── COMPONENT CARD ──────────────────────────────────
function CompCard({ comp, isSelected, onClick }) {
  const borderColor = isSelected ? T.accent : comp.status === "critical" ? T.danger : comp.status === "warning" ? T.warn : T.cardBorder;
  return (
    <div onClick={onClick} style={{
      background: isSelected ? "rgba(0,180,216,0.07)" : T.card,
      border: `1px solid ${borderColor}`,
      borderRadius: 8,
      padding: "10px 12px",
      cursor: "pointer",
      transition: "all 0.2s",
      position: "relative",
      boxShadow: isSelected ? `0 0 12px ${T.accent}30` : "none",
    }}>
      {comp.status !== "good" && (
        <div style={{
          position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: "50%",
          background: comp.status === "critical" ? T.danger : T.warn,
          boxShadow: `0 0 6px ${comp.status === "critical" ? T.danger : T.warn}`,
          animation: "pulse 1.8s infinite"
        }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16 }}>{comp.icon}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: T.text, letterSpacing: 0.5 }}>{comp.label}</span>
      </div>
      <HealthBar value={comp.health} color={comp.color} />
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        <span style={{ fontSize: 10, color: comp.color, fontWeight: 700 }}>{comp.health}%</span>
        <span style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>{comp.status}</span>
      </div>
    </div>
  );
}

// ─── FAULT BADGE ──────────────────────────────────────
function FaultBadge({ text }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      background: "rgba(255,71,87,0.12)", border: "1px solid rgba(255,71,87,0.3)",
      borderRadius: 20, padding: "3px 10px", fontSize: 10, color: T.danger, fontWeight: 600
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.danger, display: "inline-block" }} />
      {text}
    </div>
  );
}

// ─── STAT BOX ────────────────────────────────────────
function StatBox({ label, value, unit, color, icon }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
      <div style={{ fontSize: 18, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || T.accent }}>{value}<span style={{ fontSize: 11, color: T.textMuted, fontWeight: 400 }}> {unit}</span></div>
      <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ─── CUSTOM TOOLTIP ──────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0d1f35", border: `1px solid ${T.cardBorder}`, borderRadius: 6, padding: "8px 12px", boxShadow: "0 4px 14px #00000055" }}>
      <div style={{ fontSize: 9, color: T.textMuted, marginBottom: 4 }}>t = {label}s</div>
      {payload.map((p, i) => (
        <div key={i} style={{ fontSize: 11, color: p.color, fontWeight: 600 }}>{p.name}: <span style={{ color: T.text }}>{p.value}</span></div>
      ))}
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────
export default function App() {
  const [selectedComp, setSelectedComp] = useState(null);
  const [activeTab, setActiveTab] = useState("vibration");
  const [time, setTime] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTime((t) => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const selComp = COMPONENTS.find((c) => c.id === selectedComp);
  const critCount = COMPONENTS.filter((c) => c.status === "critical").length;
  const warnCount = COMPONENTS.filter((c) => c.status === "warning").length;
  const allFaults = COMPONENTS.flatMap((c) => c.faults.map((f) => ({ fault: f, comp: c.label, status: c.status })));

  const charts = {
    vibration: (
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={vibData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0f2a4a" />
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: T.textMuted }} axisLine={{ stroke: T.cardBorder }} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: T.textMuted }} axisLine={{ stroke: T.cardBorder }} tickLine={false} domain={[0, 8]} unit=" mm/s" />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="vibration" stroke={T.accent} strokeWidth={2} dot={false} name="Vibration" />
          <Line type="monotone" dataKey="threshold" stroke={T.danger} strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="Threshold" />
        </LineChart>
      </ResponsiveContainer>
    ),
    temperature: (
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={tempData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0f2a4a" />
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: T.textMuted }} axisLine={{ stroke: T.cardBorder }} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: T.textMuted }} axisLine={{ stroke: T.cardBorder }} tickLine={false} domain={[30, 100]} unit="°C" />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="temperature" stroke={T.warn} strokeWidth={2} dot={false} name="Temperature" />
          <Line type="monotone" dataKey="limit" stroke={T.danger} strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="Limit" />
        </LineChart>
      </ResponsiveContainer>
    ),
    current: (
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={currentData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#0f2a4a" />
          <XAxis dataKey="t" tick={{ fontSize: 9, fill: T.textMuted }} axisLine={{ stroke: T.cardBorder }} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: T.textMuted }} axisLine={{ stroke: T.cardBorder }} tickLine={false} unit=" A" />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="phaseA" stroke="#00b4d8" strokeWidth={1.8} dot={false} name="Phase A" />
          <Line type="monotone" dataKey="phaseB" stroke="#f5a623" strokeWidth={1.8} dot={false} name="Phase B" />
          <Line type="monotone" dataKey="phaseC" stroke="#2ed573" strokeWidth={1.8} dot={false} name="Phase C" />
        </LineChart>
      </ResponsiveContainer>
    ),
  };

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'Courier New', monospace", fontSize: 12 }}>
      <style>{`
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes scanline { 0% { top: -2px; } 100% { top: 100%; } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.cardBorder}; border-radius: 3px; }
      `}</style>

      {/* ── TOP NAV ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 22px", background: T.surface, borderBottom: `1px solid ${T.cardBorder}`, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 9, height: 9, borderRadius: "50%", background: T.good, boxShadow: `0 0 8px ${T.good}` }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: 2.5 }}>SEW-EURODRIVE</span>
          <span style={{ fontSize: 10, color: T.textMuted, letterSpacing: 1 }}>DRE100L4 · PREDICTIVE MAINTENANCE</span>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 10, color: T.textMuted }}>
          <span>⏱ Uptime: <span style={{ color: T.accent }}>847h</span></span>
          <span>📡 Sync: <span style={{ color: T.good }}>LIVE</span></span>
          <span style={{ color: T.textMuted }}>t+{time}s</span>
        </div>
      </div>

      {/* ── SUMMARY STATS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10, padding: "14px 22px" }}>
        <StatBox label="Overall Health" value="84" unit="%" color={T.accent} icon="💚" />
        <StatBox label="Alerts" value={critCount + warnCount} unit="" color={T.warn} icon="⚠️" />
        <StatBox label="Critical" value={critCount} unit="" color={T.danger} icon="🔴" />
        <StatBox label="Vibration" value="4.2" unit="mm/s" color={T.warn} icon="📈" />
        <StatBox label="Max Temp" value="84" unit="°C" color={T.danger} icon="🌡️" />
        <StatBox label="RPM" value="1740" unit="" color={T.accent} icon="🔄" />
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 14, padding: "0 22px 22px", minHeight: "calc(100vh - 160px)" }}>

        {/* LEFT COL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* 3D + Components row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14 }}>

            {/* 3D Motor */}
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: `1px solid ${T.cardBorder}` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 1.5 }}>3D Motor View</span>
                {selectedComp && <span style={{ fontSize: 9, color: T.accent, background: `${T.accent}18`, padding: "2px 8px", borderRadius: 10, border: `1px solid ${T.accent}44` }}>Highlighting: {selComp?.label}</span>}
              </div>
              <div style={{ height: 320 }}>
                <MotorViewer highlightId={selectedComp} />
              </div>
            </div>

            {/* Component Grid */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, padding: "8px 14px" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 1.5 }}>Components — Click to Highlight</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, flex: 1 }}>
                {COMPONENTS.map((c) => (
                  <CompCard key={c.id} comp={c} isSelected={selectedComp === c.id} onClick={() => setSelectedComp(selectedComp === c.id ? null : c.id)} />
                ))}
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

            {/* Sensor Chart */}
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderBottom: `1px solid ${T.cardBorder}` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 1.5 }}>Sensor Streams</span>
                <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                  {["vibration", "temperature", "current"].map((tab) => (
                    <button key={tab} onClick={() => setActiveTab(tab)} style={{
                      padding: "2px 8px", fontSize: 9, background: activeTab === tab ? T.accent : "transparent",
                      color: activeTab === tab ? "#fff" : T.textMuted, border: `1px solid ${activeTab === tab ? T.accent : T.cardBorder}`,
                      borderRadius: 4, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.8, fontFamily: "inherit", fontWeight: 600
                    }}>{tab}</button>
                  ))}
                </div>
              </div>
              <div style={{ padding: "12px 10px 6px" }}>{charts[activeTab]}</div>
            </div>

            {/* Selected Component Detail */}
            <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.cardBorder}` }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 1.5 }}>Component Detail</span>
              </div>
              <div style={{ padding: 14 }}>
                {selComp ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 24 }}>{selComp.icon}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{selComp.label}</div>
                        <div style={{ fontSize: 10, color: selComp.color, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>{selComp.status}</div>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                      {[
                        ["Health", `${selComp.health}%`, selComp.color],
                        ["Temp", `${selComp.temp}°C`, selComp.temp > 75 ? T.danger : T.warn],
                        ["Vibration", `${selComp.vibration} mm/s`, selComp.vibration > 4 ? T.danger : T.accent],
                        ["Maint. In", selComp.rrh, selComp.rrh !== "—" ? T.warn : T.good],
                      ].map(([k, v, c]) => (
                        <div key={k} style={{ background: "#0a1e35", borderRadius: 6, padding: "8px 10px" }}>
                          <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: 0.8 }}>{k}</div>
                          <div style={{ fontSize: 15, fontWeight: 700, color: c, marginTop: 2 }}>{v}</div>
                        </div>
                      ))}
                    </div>
                    <HealthBar value={selComp.health} color={selComp.color} />
                    {selComp.faults.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 9, color: T.textMuted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Detected Faults</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          {selComp.faults.map((f) => <FaultBadge key={f} text={f} />)}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: "center", color: T.textMuted, fontSize: 11, padding: "40px 0", fontStyle: "italic" }}>
                    ← Select a component to inspect
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COL — FAULT LOG ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Active Faults */}
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, overflow: "hidden", flex: 1 }}>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 1.5 }}>Active Faults</span>
              <span style={{ fontSize: 9, background: `${T.danger}20`, color: T.danger, padding: "1px 7px", borderRadius: 8, border: `1px solid ${T.danger}44` }}>{allFaults.length}</span>
            </div>
            <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
              {allFaults.map((f, i) => (
                <div key={i} style={{
                  background: f.status === "critical" ? "rgba(255,71,87,0.08)" : "rgba(245,166,35,0.08)",
                  border: `1px solid ${f.status === "critical" ? "rgba(255,71,87,0.25)" : "rgba(245,166,35,0.25)"}`,
                  borderRadius: 7, padding: "9px 11px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: f.status === "critical" ? T.danger : T.warn }}>{f.fault}</span>
                    <span style={{ fontSize: 8, background: f.status === "critical" ? `${T.danger}25` : `${T.warn}25`, color: f.status === "critical" ? T.danger : T.warn, padding: "1px 6px", borderRadius: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>{f.status}</span>
                  </div>
                  <div style={{ fontSize: 10, color: T.textDim }}>📍 {f.comp}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Predictive Actions */}
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.cardBorder}` }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 1.5 }}>Predictive Actions</span>
            </div>
            <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 7 }}>
              {[
                { priority: "HIGH", action: "Replace drive-side bearing — outer race degradation", eta: "12 days" },
                { priority: "URGENT", action: "Inspect rotor bars — broken bar signature in current spectrum", eta: "3 days" },
                { priority: "MED", action: "Balance fan assembly — blade wear imbalance detected", eta: "8 days" },
                { priority: "LOW", action: "Verify shaft alignment at next scheduled stop", eta: "—" },
              ].map((item, i) => {
                const pColor = item.priority === "URGENT" ? T.danger : item.priority === "HIGH" ? T.warn : item.priority === "MED" ? T.accent : T.textMuted;
                return (
                  <div key={i} style={{ background: "#0a1e35", borderRadius: 6, padding: "8px 10px", display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: pColor, background: `${pColor}18`, border: `1px solid ${pColor}44`, borderRadius: 4, padding: "2px 5px", whiteSpace: "nowrap", letterSpacing: 0.8 }}>{item.priority}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10.5, color: T.text, lineHeight: 1.4 }}>{item.action}</div>
                      {item.eta !== "—" && <div style={{ fontSize: 9, color: T.textMuted, marginTop: 2 }}>⏳ Act within {item.eta}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fault Types Reference */}
          <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 10, overflow: "hidden" }}>
            <div style={{ padding: "8px 14px", borderBottom: `1px solid ${T.cardBorder}` }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: 1.5 }}>Monitored Fault Types</span>
            </div>
            <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 5 }}>
              {[
                ["Bearing Wear", "Vibration spectrum + temp"],
                ["Broken Rotor Bar", "Stator current signature"],
                ["Eccentricity", "Vibration + current harmonics"],
                ["Stator Winding", "Insulation resistance + temp"],
                ["Shaft Misalignment", "Vibration pattern analysis"],
                ["Fan Imbalance", "Vibration amplitude + phase"],
              ].map(([name, method]) => (
                <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: "1px solid #0f2030" }}>
                  <span style={{ fontSize: 10, color: T.text, fontWeight: 600 }}>{name}</span>
                  <span style={{ fontSize: 9, color: T.textMuted }}>{method}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
