import './style.css';
import * as THREE from 'three';
import Lenis from 'lenis';
import { makeGlyphAtlas } from './glyphs.js';
import { Figure, makeFloor } from './figure.js';
import { Territory, ZONES, terrainH, riverX } from './territory.js';
import { Clinic } from './clinic.js';
import { KEYS, DEFAULTS, mobileAdjust } from './script.js';
import { Labels } from './labels.js';
import { initText, scramble } from './text.js';

const $ = (s, el = document) => el.querySelector(s);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isNarrow = () => innerWidth < 820;
const lowPower = isNarrow() || (navigator.hardwareConcurrency || 8) <= 4;
const QUALITY = lowPower
  ? { glyph: 1900, dust: 30000, terrain: 200, structStep: 0.62, arcDensity: 2, organs: 0.6, clinicStep: 0.7 }
  : { glyph: 2800, dust: 56000, terrain: 300, structStep: 0.44, arcDensity: 3, organs: 1, clinicStep: 0.55 };

// ---------------------------------------------------------------- render
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
renderer.setClearColor(0x000000, 0);
const DPR = Math.min(devicePixelRatio || 1, lowPower ? 1.6 : 2);
renderer.setPixelRatio(DPR);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 600);
camera.position.set(0, 1.15, 5.2);

const shared = {
  uTime: { value: 0 },
  uSize: { value: 0.036 },
  uProj: { value: 1 },
  uAssemble: { value: reduced ? 1 : 0 },
  uScanY: { value: 2 },
  uScanOn: { value: 0 },
  uPulse: { value: 0 },
  uGlitch: { value: 0 },
  uFlick: { value: reduced ? 0.12 : 1 },
  uFloorY: { value: 0 },
  uSpark: { value: 1 },
  uHeight: { value: 1.8 },
  uSkin: { value: 1 },
  uAtlas: { value: null },
};

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  shared.uProj.value = (h * DPR) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
  labels.resize(w, h, DPR);
  measure();
}

// ---------------------------------------------------------------- escenas DOM
const sections = [...document.querySelectorAll('.scene')];
let layout = [];
function measure() {
  let top = 0;
  layout = sections.map((el) => {
    const r = { el, top: el.offsetTop, h: el.offsetHeight };
    top += r.h;
    return r;
  });
}

const railTicks = $('#railTicks');
sections.forEach(() => railTicks.appendChild(document.createElement('i')));

// ---------------------------------------------------------------- estado
const state = { ...DEFAULTS };
const target = { ...DEFAULTS };
let blendBell = 0; // 1 a mitad de una transición
let activeIdx = 0;
let pick = { look: 'cursor', point: null };

function evalKey(i, p) {
  const k = KEYS[sections[i].id];
  return k ? k(p) : {};
}

function computeTarget(y) {
  const vh = innerHeight;
  y = Math.ceil(y) + 1; // el límite de scroll puede quedarse a medio píxel de la última sección
  let i = layout.length - 1;
  for (let k = 0; k < layout.length; k++) {
    if (y < layout[k].top + layout[k].h) { i = k; break; }
  }
  const L = layout[i];
  const hold = Math.max(L.h - vh, 0);
  const local = y - L.top;
  let A, B = null, t = 0, p;
  if (local <= hold || i === layout.length - 1) {
    p = hold > 0 ? clamp(local / hold, 0, 1) : 1;
    A = evalKey(i, p);
  } else {
    t = clamp((local - hold) / vh, 0, 1);
    A = evalKey(i, 1);
    B = evalKey(i + 1, 0);
  }
  const e = easeIO(t);
  for (const key in DEFAULTS) {
    const a = A[key] ?? DEFAULTS[key];
    if (typeof a !== 'number') continue;
    const b = B ? (B[key] ?? DEFAULTS[key]) : a;
    target[key] = lerp(a, b, e);
  }
  const dom = B && e > 0.5 ? B : A;
  pick = { look: dom.look ?? 'cursor', point: dom.point ?? null, pointEl: dom.point };
  blendBell = B ? Math.sin(Math.PI * t) : 0;

  // visibilidad de los paneles
  layout.forEach((s, k) => {
    let vis = 0;
    if (k === i) vis = B ? 1 - ss(0, 0.5, t) : 1;
    else if (k === i + 1 && B) vis = ss(0.35, 0.9, t);
    s.el.style.setProperty('--vis', vis.toFixed(3));
    const on = vis > 0.5;
    if (on !== s.el.classList.contains('is-in') && s.el.id !== 'inicio') {
      s.el.classList.toggle('is-in', on);
      if (on) s.el.querySelectorAll('[data-scramble]').forEach(scramble);
    }
  });
  if (i === 0 && !B) layout[0].el.style.setProperty('--vis', '1');
  const now = B && t > 0.5 ? i + 1 : i;
  if (now !== activeIdx) {
    activeIdx = now;
    railTicks.querySelectorAll('i').forEach((el, k) => el.classList.toggle('is-on', k === now));
    $('#railIdx').textContent = String(now).padStart(2, '0');
    $('#railName').textContent = sections[now].dataset.name;
  }
  if (isNarrow()) mobileAdjust(target);
}

// ---------------------------------------------------------------- puntero
const mouse = new THREE.Vector2(0, 0);
let pointerSeen = false;
addEventListener('pointermove', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerSeen = true;
}, { passive: true });
addEventListener('pointerdown', (e) => {
  mouse.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerSeen = true;
}, { passive: true });

const ray = new THREE.Raycaster();
const plane = new THREE.Plane();
const _hit = new THREE.Vector3();
function worldFromNdc(nx, ny, planeZ) {
  ray.setFromCamera({ x: nx, y: ny }, camera);
  plane.set(new THREE.Vector3(0, 0, 1), -planeZ);
  return ray.ray.intersectPlane(plane, _hit) ? _hit.clone() : null;
}
function worldFromEl(sel, planeZ) {
  const el = typeof sel === 'string' ? $(sel) : sel;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const nx = ((r.left + Math.min(r.width, 340) * 0.5) / innerWidth) * 2 - 1;
  const ny = -((r.top + r.height * 0.5) / innerHeight) * 2 + 1;
  return worldFromNdc(nx, ny, planeZ);
}

// ---------------------------------------------------------------- arranque
const labels = new Labels($('#labels'), $('#hud'));
let figure, main, ghosts = [], floor, territory, clinic;
let lenis;
const boot = $('#boot');

function setLoad(p) {
  boot.style.setProperty('--load', p.toFixed(3));
  const pct = Math.round(p * 100);
  $('#bootPct').textContent = String(pct).padStart(3, '0') + ' %';
  $('#bootBits').textContent = Math.round(p * 255).toString(2).padStart(8, '0');
}

async function start() {
  initText();
  document.body.classList.add('is-booting');
  setLoad(0);
  try { await document.fonts.load('500 78px "IBM Plex Mono"'); } catch (e) { /* sigue con la de sistema */ }
  shared.uAtlas.value = makeGlyphAtlas();

  figure = new Figure(scene, shared.uAtlas.value, shared);
  await figure.load(import.meta.env.BASE_URL + 'models/Xbot.glb', setLoad, QUALITY);
  main = figure.makeInstance({ main: true });
  for (let k = 1; k <= 4; k++) {
    const g = figure.makeInstance({ tint: 0.88, drawFraction: 0.38 });
    g.k = k;
    g.actions.idle.setEffectiveWeight(0);
    g.actions.walk.setEffectiveWeight(1);
    g.actions.idle.time = g.k * 0.9;
    figure.setOpacity(g, 0);
    ghosts.push(g);
  }
  floor = makeFloor(scene, shared, lowPower ? 1600 : 2600);
  territory = new Territory(scene, shared, QUALITY);
  clinic = new Clinic(scene, shared, QUALITY);

  const n = figure.pointCount.toLocaleString('es-ES');
  $('#ptsCount').textContent = n;
  document.querySelectorAll('[data-pts]').forEach((el) => (el.textContent = n));

  labels.build({ figure, main, ghosts, territory, clinic, ZONES, terrainH, riverX, vitals });

  resize();
  boot.style.setProperty('--load-eye', '1');
  await new Promise((r) => setTimeout(r, 450));

  lenis = new Lenis({ lerp: reduced ? 1 : 0.09, smoothWheel: !reduced, wheelMultiplier: 0.9 });
  document.querySelectorAll('[data-goto]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const el = document.getElementById(a.dataset.goto);
      const L = layout.find((l) => l.el === el);
      const y = el.id === 'inicio' ? 0 : L.top + Math.max(L.h - innerHeight, 0) * 0.35;
      lenis.scrollTo(y, { duration: 2.4 });
    });
  });

  const mail = $('#mail');
  const nod = () => { if (shared.uTime.value > nodUntil) nodUntil = shared.uTime.value + main.actions.agree.getClip().duration * 0.95; };
  mail.addEventListener('pointerenter', nod);
  mail.addEventListener('mouseenter', nod);
  mail.addEventListener('focus', nod);

  scrollTo(0, 0);
  computeTarget(0);
  Object.assign(state, target);

  boot.classList.add('is-done');
  document.body.classList.remove('is-booting');
  document.body.classList.add('is-live');
  assembleT0 = 0; // arranca en el primer fotograma visible, no antes
  setTimeout(() => {
    layout[0].el.classList.add('is-in');
    layout[0].el.querySelectorAll('[data-scramble]').forEach(scramble);
  }, reduced ? 0 : 1500);

  if (import.meta.env.DEV) window.go = (id, p) => { lenis.resize(); const L = layout.find((l) => l.el.id === id); lenis.scrollTo(L.top + Math.max(L.h - innerHeight, 0) * p, { immediate: true }); };
  if (import.meta.env.DEV) window.__dbg = { lenis, layout: () => layout, clinic, vitals, figure, main, ghosts, camera, state, target, territory, scene, renderer, shared };
  if (import.meta.env.DEV) window.__replay = () => { assembleT0 = performance.now(); };
  if (import.meta.env.DEV) {
    const q = new URLSearchParams(location.search);
    if (q.get('s')) setTimeout(() => window.go(q.get('s'), +(q.get('p') || 0.5)), 60);
    if (q.get('cam')) window.__cam = JSON.parse(q.get('cam'));
  }
  requestAnimationFrame(loop);
}

let assembleT0 = 0;
let last = performance.now();
let nextGlitch = 3;
let glitchUntil = 0;
const lookTarget = new THREE.Vector3(0, 1.6, 5);
const pointTarget = new THREE.Vector3(0, 1.2, 2);
const camTgt = new THREE.Vector3();
const camPos = new THREE.Vector3();
let wR = 0, wL = 0, side = 'Right';
let nodW = 0, nodUntil = 0;
// constantes del gemelo: el corazón late de verdad a este ritmo y el electro lo dibuja
const vitals = { bpm: 66, phase: 0, beat: 0, breath: 0, rpm: 14 };
const beatShape = (ph) => Math.exp(-(((ph - 0.26) / 0.045) ** 2)) + 0.45 * Math.exp(-(((ph - 0.44) / 0.06) ** 2));
let fps = 60;

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  fps = lerp(fps, 1 / Math.max(dt, 1e-3), 0.05);
  const t = now / 1000;
  shared.uTime.value = t;

  lenis.raf(now);
  computeTarget(lenis.scroll);

  // suaviza todo el estado hacia el objetivo
  for (const key in target) {
    if (typeof target[key] === 'number') state[key] = damp(state[key], target[key], 5.5, dt);
  }
  const S = state;

  // ensamblado inicial
  if (!reduced) {
    if (!assembleT0) assembleT0 = now;
    const a = clamp((now - assembleT0) / 3600, 0, 1);
    shared.uAssemble.value = a < 1 ? 1 - Math.pow(1 - a, 2.6) : 1;
  }

  // fallos de señal: raros en reposo, más fuertes al cambiar de escena
  if (t > nextGlitch) { glitchUntil = t + 0.09 + Math.random() * 0.12; nextGlitch = t + 3.5 + Math.random() * 5; }
  const assembling = 1 - shared.uAssemble.value;
  shared.uGlitch.value = (t < glitchUntil ? 1 : 0) + blendBell * 0.35 + assembling * 0.6;

  shared.uScanOn.value = S.scanOn;
  shared.uScanY.value = S.scanY;
  shared.uPulse.value = S.pulse;
  shared.uSpark.value = S.spark;
  shared.uSize.value = S.glyphSize;
  shared.uSkin.value = S.skin;

  // latido y respiración; en la sección del corazón, el pulso sube si se desplaza deprisa
  const effort = Math.min(Math.abs(lenis.velocity || 0) * 0.9, 70) * S.hrReact;
  vitals.bpm = damp(vitals.bpm, 66 + effort, effort > vitals.bpm - 66 ? 2.2 : 0.35, dt);
  vitals.rpm = 14 + (vitals.bpm - 66) * 0.12;
  vitals.phase += dt * vitals.bpm / 60;
  vitals.beat = beatShape(vitals.phase % 1);
  vitals.breath = Math.sin(t * Math.PI * 2 * vitals.rpm / 60);
  const O = figure.organU;
  O.uInterior.value = S.interior;
  O.uBeat.value = vitals.beat;
  O.uBeatPhase.value = vitals.phase;
  O.uBreath.value = vitals.breath;
  O.uFocusHeart.value = S.fHeart;
  O.uFocusBrain.value = S.fBrain;
  O.uFocusLesion.value = S.fLesion;
  O.uNerves.value = S.nerves;
  O.uLesion.value = S.lesion;
  O.uVessels.value = S.vessels;

  // cámara
  camPos.set(S.camX, S.camY, S.camZ);
  camTgt.set(S.tgtX, S.tgtY, S.tgtZ);
  if (pointerSeen && S.parallax > 0.01) {
    camPos.x += mouse.x * 0.18 * S.parallax;
    camPos.y += mouse.y * 0.1 * S.parallax;
  }
  if (window.__cam) { camPos.fromArray(window.__cam[0]); camTgt.fromArray(window.__cam[1]); }
  camera.position.copy(camPos);
  camera.lookAt(camTgt);
  const w = innerWidth, h = innerHeight;
  if (Math.abs(S.shift) > 0.001) camera.setViewOffset(w, h, -S.shift * w, 0, w, h);
  else camera.clearViewOffset();
  camera.updateMatrixWorld();

  // figura principal
  main.holder.position.set(S.figX, 0, S.figZ);
  main.holder.rotation.y = S.figRot;
  figure.setOpacity(main, S.figOpacity);
  main.interior.visible = main.visible && S.interior > 0.002;
  // asiente cuando alguien se acerca al correo
  nodW = damp(nodW, t < nodUntil ? 1 : 0, 6, dt);
  if (nodW < 0.01 && t >= nodUntil) main.actions.agree.time = 0;
  main.actions.agree.setEffectiveWeight(nodW);
  main.actions.walk.setEffectiveWeight(S.walk * (1 - nodW));
  main.actions.idle.setEffectiveWeight((1 - S.walk) * (1 - nodW));
  main.mixer.update(dt);
  main.root.updateMatrixWorld(true);

  // ¿a dónde mira?
  let lt = null;
  if (pick.look === 'cursor') {
    lt = pointerSeen ? worldFromNdc(mouse.x, mouse.y, S.figZ + 1.4) : camera.position.clone();
  } else if (pick.look === 'cam') {
    lt = camera.position.clone();
  } else if (pick.look) {
    lt = worldFromEl(pick.look, S.figZ + 0.4);
  }
  if (lt) lookTarget.lerp(lt, 1 - Math.exp(-6 * dt));
  figure.look(main, lookTarget, S.lookW * (1 - nodW * 0.85));

  // ¿a dónde señala?
  let pt = null;
  if (pick.point === 'cursor') pt = pointerSeen ? worldFromNdc(mouse.x, mouse.y, S.figZ + 0.9) : null;
  else if (pick.point) pt = worldFromEl(pick.point, S.figZ + 0.5);
  if (pt) pointTarget.lerp(pt, 1 - Math.exp(-8 * dt));
  const want = pt ? S.pointW : 0;
  const sideNow = figure.armFor(main, pointTarget);
  if (sideNow !== side && (side === 'Right' ? wR : wL) < 0.05) side = sideNow;
  else if (sideNow !== side) { /* baja primero el brazo actual */ }
  const goR = side === 'Right' && sideNow === side ? want : 0;
  const goL = side === 'Left' && sideNow === side ? want : 0;
  wR = damp(wR, goR, 4, dt);
  wL = damp(wL, goL, 4, dt);
  figure.point(main, pointTarget, wR, 'Right');
  figure.point(main, pointTarget, wL, 'Left');
  figure.commit(main);

  // fantasmas del futuro
  const fwd = new THREE.Vector3(Math.sin(S.figRot), 0, Math.cos(S.figRot));
  const dur = main.actions.walk.getClip().duration;
  // ...o, en la sección del tratamiento, las alternativas que no se eligen
  const trialMode = S.trial > S.ghosts;
  ghosts.forEach((g) => {
    const op = trialMode ? (g.k <= 2 ? S.trial * 0.62 : 0) : S.ghosts * (0.78 - (g.k - 1) * 0.17);
    figure.setOpacity(g, op);
    if (!g.visible) return;
    if (trialMode) {
      const sd = g.k === 1 ? -1 : 1;
      g.holder.position.set(S.figX + sd * 1.2, 0, S.figZ - 0.35);
      g.holder.rotation.y = S.figRot - sd * 0.22;
      g.actions.walk.setEffectiveWeight(0);
      g.actions.idle.setEffectiveWeight(1);
      g.mixer.update(dt);
    } else {
      g.holder.position.set(S.figX, 0, S.figZ).addScaledVector(fwd, g.k * 0.44);
      g.holder.rotation.y = S.figRot;
      g.actions.idle.setEffectiveWeight(0);
      g.actions.walk.setEffectiveWeight(1);
      g.actions.walk.time = (main.actions.walk.time + g.k * 0.3) % dur;
      g.mixer.update(0);
    }
    figure.commit(g);
  });

  floor.position.set(S.figX, 0, S.figZ);
  floor.material.uniforms.uOpacity.value = S.floor;
  floor.visible = S.floor > 0.002;

  territory.update(S, camera.position, camTgt);
  clinic.update(S, camera.position);

  renderer.render(scene, camera);
  labels.update(S, camera, dt, { pick, mouse, pointerSeen, now: t, pointTarget });
  hudChrome(t);
}

// ---------------------------------------------------------------- cabecera
const clockEl = $('#clock');
const depthEl = $('#depthVal');
const fireEl = $('#fireClock');
const shadeEl = $('#shade');
const topEl = $('.top');
function hudChrome() {
  const d = new Date();
  const pad = (n, l = 2) => String(n).padStart(l, '0');
  clockEl.textContent = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(Math.floor(d.getUTCMilliseconds() / 10))} UTC`;
  depthEl.textContent = camera.position.distanceTo(camTgt).toFixed(2);
  shadeEl.style.setProperty('--shade', state.shade.toFixed(3));
  topEl.style.setProperty('--shade', state.shade.toFixed(3));
  shadeEl.classList.toggle('shade--right', state.shadeRight > 0.5);
  const mins = Math.round(state.fireT * 6 * 60);
  fireEl.textContent = `T+${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

addEventListener('resize', () => { resize(); lenis?.resize(); });
addEventListener('load', measure);

start();
