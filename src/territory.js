import * as THREE from 'three';
import { GLSL_COMMON, GLYPH_FRAG } from './glyphs.js';

// ---------------------------------------------------------------------------
// El territorio: un mapa de 180 × 180 m hecho de los mismos dígitos que la
// figura, con la figura de pie en el centro de una ciudad. Relieve, río,
// parcelas, monte, polígono industrial, sensores e incendio comparten un único
// sistema de coordenadas, igual que en un gemelo real.
// ---------------------------------------------------------------------------

export const ZONES = {
  city: new THREE.Vector2(0, 0),
  industry: new THREE.Vector2(46, -30),
  rural: new THREE.Vector2(-8, -54),
  fire: new THREE.Vector2(-58, 18),
};

const ZONE_GLSL = /* glsl */ `
  const vec2 CITY = vec2(0.0, 0.0);
  const vec2 IND = vec2(46.0, -30.0);
  const vec2 RURAL = vec2(-8.0, -54.0);
  const vec2 FIRE = vec2(-58.0, 18.0);
  float sdBox(vec2 p, vec2 b) { vec2 d = abs(p) - b; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
  float riverX(float z) { return -32.0 + sin(z * 0.06) * 7.0 + sin(z * 0.021 + 1.3) * 5.0; }
  float cityMask(vec2 p) { return 1.0 - smoothstep(20.0, 30.0, length(p - CITY)); }
  float indMask(vec2 p) { return 1.0 - smoothstep(0.0, 9.0, sdBox(p - IND, vec2(17.0, 12.0))); }
  float ruralMask(vec2 p) { return 1.0 - smoothstep(18.0, 30.0, length((p - RURAL) * vec2(0.8, 1.0))); }
`;

const TERRAIN_VERT = /* glsl */ `
  precision highp float;
  ${GLSL_COMMON}
  ${ZONE_GLSL}
  uniform float uTime, uSize, uProj, uOpacity, uFlick, uReveal, uCity, uIndustry, uRural, uFire, uFireT, uSensors, uNet;
  uniform vec3 uCam;
  uniform vec2 uFog;
  uniform vec2 uSens[8];
  attribute vec2 aRand;
  attribute vec3 aTer; // luz, monte, copa: el relieve no cambia, se calcula una vez al cargar
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlyph;

  void main() {
    vec2 p = position.xz;
    float seed = aRand.x;
    vec3 wp = position;

    vec3 bone = vec3(0.925, 0.91, 0.88);
    vec3 blue = vec3(0.22, 0.56, 1.0);
    vec3 heat = vec3(1.0, 0.4, 0.14);
    vec3 col = bone;
    float lam = aTer.x;
    float bright = 0.05 + 0.34 * lam;
    float size = uSize * (0.75 + 0.5 * hash11(seed * 9.1));
    // dos de cada tres puntos son solo punto: se lee como mapa; el resto, dígitos
    float glyph = mix(flipGlyph(seed, aRand.y * uFlick * 0.6, uTime), 2.0, step(hash11(seed * 3.7), 0.64));
    size *= mix(1.0, 0.55, step(1.5, glyph));

    float cM = cityMask(p), iM = indMask(p), rM = ruralMask(p), fM = aTer.y;

    // monte: copas más vivas
    bright += fM * 0.18 * aTer.z;

    // río
    float rd = abs(p.x - riverX(p.y));
    float river = 1.0 - smoothstep(1.8, 4.2, rd);
    float flow = smoothstep(0.75, 1.0, fract(p.y * 0.08 + uTime * 0.25 + hash11(floor(p.x)) * 0.3));
    col = mix(col, blue, river);
    bright += river * (0.35 + flow * 1.3);
    glyph = mix(glyph, flipGlyph(seed, 9.0, uTime), step(0.5, river));

    // ciudad: calles con tráfico
    vec2 q = abs(fract((p - 2.0) / 4.0 + 0.5) - 0.5) * 4.0;
    float street = (1.0 - step(0.45, min(q.x, q.y))) * step(length(p), 24.0) * step(5.0, length(p));
    float along = q.x < q.y ? p.y : p.x;
    float lineId = q.x < q.y ? floor((p.x - 2.0) / 4.0 + 0.5) : floor((p.y - 2.0) / 4.0 + 0.5) + 50.0;
    float dirS = mod(lineId, 2.0) * 2.0 - 1.0;
    float car = step(0.86, fract(along * 0.09 + uTime * 0.55 * dirS + hash11(lineId) * 7.0));
    col = mix(col, blue, street * car * uCity);
    bright += street * (car * 1.4 + 0.1) * uCity;
    bright *= mix(1.0, 0.22, cM * (1.0 - street) * uCity);

    // polígono: losa con retícula
    vec2 gq = abs(fract((p - IND) / 3.0) - 0.5);
    float slab = step(0.46, max(gq.x, gq.y)) * (1.0 - step(0.5, sdBox(p - IND, vec2(17.0, 12.0))));
    bright += slab * 0.35 * uIndustry;

    // parcelas: surcos orientados por parcela
    vec2 cell = floor((p - RURAL) / 9.0);
    float ang = hash21(cell) * 3.1416;
    float fur = sin(dot(p, vec2(cos(ang), sin(ang))) * 3.2) * 0.5 + 0.5;
    float crop = step(0.25, hash21(cell + 4.0));
    float parcelEdge = step(0.94, max(abs(fract((p.x - RURAL.x) / 9.0) - 0.5), abs(fract((p.y - RURAL.y) / 9.0) - 0.5)) * 2.0);
    bright += rM * uRural * (crop * fur * 0.55 + parcelEdge * 0.5);
    glyph = mix(glyph, 2.0, step(0.5, rM * crop * (1.0 - fur)));

    // incendio: el frente avanza con el viento del oeste y se detiene en el río
    vec2 rel = p - FIRE;
    float dist = length(rel);
    float th = atan(rel.y, rel.x);
    float R = uFireT * 40.0 * (0.62 + 0.38 * cos(th)) * (0.78 + 0.44 * vnoise(vec2(th * 2.6, 3.0) + uFireT * 0.6));
    float blocked = step(riverX(p.y) - 2.5, p.x);
    float burned = (1.0 - smoothstep(R - 2.0, R - 0.5, dist)) * (1.0 - blocked) * step(0.001, uFireT);
    float front = (1.0 - smoothstep(0.0, 1.9, abs(dist - R))) * (1.0 - blocked) * step(0.01, uFireT);
    float ember = step(0.93, hash11(seed * 7.0 + floor(uTime * 6.0)));
    burned *= uFire;
    front *= uFire;
    col = mix(col, heat * 0.55, burned);
    bright = mix(bright, 0.08 + ember * 0.6, burned);
    glyph = mix(glyph, 2.0, burned * (1.0 - ember));
    col = mix(col, heat, front);
    bright += front * 1.9;
    size *= 1.0 + front * 0.6;
    glyph = mix(glyph, flipGlyph(seed, 30.0, uTime), front);

    // aparición: un anillo que se abre desde la figura
    float rr = uReveal * 135.0;
    float lp = length(p);
    float shown = 1.0 - smoothstep(rr - 3.0, rr, lp);
    float edge = (1.0 - smoothstep(0.0, 4.0, abs(lp - rr))) * step(0.01, uReveal) * step(uReveal, 0.99);
    col = mix(col, blue, edge);
    bright += edge * 1.5;
    wp.y -= (1.0 - shown) * 2.0;

    vec4 mv = viewMatrix * vec4(wp, 1.0);
    gl_Position = projectionMatrix * mv;

    float camD = length(wp - uCam);
    float fog = (1.0 - smoothstep(uFog.x, uFog.y, camD)) * smoothstep(2.5, 14.0, camD);
    float edgeFade = 1.0 - smoothstep(72.0, 90.0, max(abs(p.x), abs(p.y)));
    vColor = col;
    vGlyph = glyph;
    float far = 1.0 + clamp((camD - 60.0) / 120.0, 0.0, 1.0) * 1.1; // de lejos los puntos son menudos: se compensa
    vAlpha = clamp(bright * far, 0.0, 2.2) * shown * fog * edgeFade * uOpacity;
    gl_PointSize = max(size * uProj / -mv.z, 1.6);
  }
`;

const STRUCT_VERT = /* glsl */ `
  precision highp float;
  ${GLSL_COMMON}
  uniform float uTime, uSize, uProj, uOpacity, uFlick, uCity, uIndustry;
  uniform vec3 uCam;
  uniform vec2 uFog;
  attribute vec4 aInfo; // semilla del edificio, zona (0 ciudad / 1 industria), altura total, tipo (0 muro, 1 cubierta, 2 alarma)
  attribute vec2 aRand;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlyph;
  void main() {
    float bseed = aInfo.x;
    float zone = aInfo.y;
    float H = aInfo.z;
    float kind = aInfo.w;
    float grow = zone < 0.5 ? uCity : uIndustry;
    float rise = clamp((grow * 1.5 - bseed * 0.5) / 1.0, 0.0, 1.0);
    rise = 1.0 - pow(1.0 - rise, 3.0);
    vec3 wp = position;
    wp.y *= rise;

    vec3 bone = vec3(0.925, 0.91, 0.88);
    vec3 blue = vec3(0.22, 0.56, 1.0);
    vec3 heat = vec3(1.0, 0.4, 0.14);
    float edge = step(2.5, kind);
    float roof = step(0.5, kind) * step(kind, 1.5);
    float bright = 0.06 + 0.08 * hash11(bseed * 77.0) + roof * 0.16 + edge * 0.62;
    vec3 col = bone;

    // ventanas encendidas: dígitos azules al azar, cambiando despacio
    float win = step(0.965, hash11(aRand.x * 51.0 + floor(uTime * 0.7 + bseed * 9.0)));
    col = mix(col, blue, win);
    bright += win * 0.9;

    // la máquina que va a fallar
    float alarm = step(1.5, kind) * step(kind, 2.5);
    float beat = 0.5 + 0.5 * sin(uTime * 5.0);
    col = mix(col, heat, alarm);
    bright += alarm * (0.4 + beat * 0.9) * uIndustry;

    // sube un barrido de escaneo por cada edificio mientras crece
    float sweep = 1.0 - smoothstep(0.0, 0.6, abs(wp.y - H * rise));
    bright += sweep * (1.0 - rise) * 1.4;

    vec4 mv = viewMatrix * vec4(wp, 1.0);
    gl_Position = projectionMatrix * mv;
    float fog = 1.0 - smoothstep(uFog.x, uFog.y, length(wp - uCam));
    vColor = col;
    float dotty = step(hash11(aRand.x * 5.3), 0.55) * (1.0 - win) * (1.0 - alarm) * (1.0 - edge);
    vGlyph = mix(flipGlyph(aRand.x, aRand.y * uFlick * 0.6, uTime), 2.0, dotty);
    vAlpha = bright * step(0.002, rise) * fog * uOpacity;
    gl_PointSize = max(uSize * (0.8 + 0.4 * hash11(aRand.x * 3.0)) * mix(1.0, 0.6, dotty) * uProj / -mv.z, 1.6);
  }
`;

const ARC_VERT = /* glsl */ `
  precision highp float;
  ${GLSL_COMMON}
  uniform float uTime, uSize, uProj, uOpacity, uNet;
  uniform vec3 uCam;
  uniform vec2 uFog;
  attribute vec4 aArc; // s (0..1), índice de arco, semilla, longitud
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlyph;
  void main() {
    float s = aArc.x;
    float idx = aArc.y;
    float len = aArc.w;
    float reveal = smoothstep(s, s + 0.08, uNet * 1.8 - idx * 0.06);
    float ph = fract(s * len / 16.0 - uTime * 0.55 + idx * 0.37);
    float packet = smoothstep(0.86, 0.98, ph);
    vec4 mv = viewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float fog = 1.0 - smoothstep(uFog.x * 1.2, uFog.y * 1.3, length(position - uCam));
    vColor = mix(vec3(0.62, 0.78, 1.0), vec3(0.22, 0.56, 1.0), packet);
    vGlyph = mix(2.0, flipGlyph(aArc.z, 14.0, uTime), packet);
    vAlpha = (0.32 + packet * 1.9) * reveal * fog * uOpacity;
    gl_PointSize = max(uSize * (0.45 + packet * 1.1) * uProj / -mv.z, 1.6);
  }
`;


// Sensores: una estaca de datos que sube y tres ondas que se abren a ras de suelo
const BEACON_VERT = /* glsl */ `
  precision highp float;
  ${GLSL_COMMON}
  uniform float uTime, uSize, uProj, uOpacity, uSensors;
  uniform vec3 uCam;
  uniform vec2 uFog;
  attribute vec4 aB; // tipo (0 onda / 1 estaca), ángulo o altura, nº de onda, semilla
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlyph;
  void main() {
    vec3 base = position;
    vec3 wp;
    float alpha;
    float glyph;
    float size = uSize;
    vec3 blue = vec3(0.22, 0.56, 1.0);
    if (aB.x < 0.5) {
      float ph = fract(uTime * 0.26 + aB.w + aB.z / 3.0);
      float r = 0.6 + ph * 15.0;
      wp = base + vec3(cos(aB.y) * r, 0.3, sin(aB.y) * r);
      alpha = pow(1.0 - ph, 1.6) * 0.9;
      glyph = 2.0;
      size *= 0.75;
    } else {
      float h = aB.y;
      wp = base + vec3(0.0, h, 0.0);
      float pk = smoothstep(0.75, 1.0, fract(h / 7.0 - uTime * 0.7 + aB.w));
      alpha = 0.35 + pk * 1.4;
      glyph = mix(2.0, flipGlyph(aB.w + h, 12.0, uTime), step(0.4, pk));
      if (h > 7.4) { glyph = 3.0; alpha = 1.6; size *= 1.6; }
    }
    vec4 mv = viewMatrix * vec4(wp, 1.0);
    gl_Position = projectionMatrix * mv;
    float fog = 1.0 - smoothstep(uFog.x * 1.2, uFog.y * 1.2, length(wp - uCam));
    vColor = blue;
    vGlyph = glyph;
    vAlpha = alpha * fog * uOpacity * uSensors;
    gl_PointSize = max(size * uProj / -mv.z, 1.6);
  }
`;

// --- versión JS del relieve, para colocar nodos y etiquetas encima del terreno
const fract = (x) => x - Math.floor(x);
function hash21(x, y) {
  let a = fract(x * 0.1031), b = fract(y * 0.1031), c = fract(x * 0.1031);
  const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33);
  a += d; b += d; c += d;
  return fract((a + b) * c);
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash21(ix, iy), b = hash21(ix + 1, iy), c = hash21(ix, iy + 1), d = hash21(ix + 1, iy + 1);
  return (a + (b - a) * ux) * (1 - uy) + (c + (d - c) * ux) * uy;
}
function fbm(x, y) {
  let v = 0, a = 0.5;
  for (let i = 0; i < 4; i++) { v += a * vnoise(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 17.1; a *= 0.5; }
  return v;
}
const ss = (a, b, x) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };
export function riverX(z) { return -32 + Math.sin(z * 0.06) * 7 + Math.sin(z * 0.021 + 1.3) * 5; }
const cityM = (x, z) => 1 - ss(20, 30, Math.hypot(x, z));
const indM = (x, z) => {
  const dx = Math.abs(x - 46) - 17, dz = Math.abs(z + 30) - 12;
  const out = Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0);
  return 1 - ss(0, 9, out);
};
const ruralM = (x, z) => 1 - ss(18, 30, Math.hypot((x + 8) * 0.8, z + 54));
export function forestM(x, z) {
  let f = ss(0.47, 0.6, fbm(x * 0.028 + 41, z * 0.028 + 41));
  f = Math.max(f, 1 - ss(16, 34, Math.hypot(x + 58, z - 18)));
  return f * (1 - cityM(x, z)) * (1 - indM(x, z)) * (1 - ruralM(x, z) * 0.9);
}
export function terrainH(x, z) {
  let h = (fbm(x * 0.017 + 3, z * 0.017 + 3) - 0.45) * 15 + (fbm(x * 0.07 + 11, z * 0.07 + 11) - 0.5) * 2.4;
  const rv = 1 - ss(0, 10, Math.abs(x - riverX(z)));
  h -= rv * rv * 5;
  h = h + (h * 0.35 - h) * ruralM(x, z);
  h += forestM(x, z) * vnoise(x * 0.85, z * 0.85) * 1.7;
  return h * (1 - Math.max(cityM(x, z), indM(x, z)));
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildStructures(step) {
  const rng = mulberry32(4242);
  const P = [], INFO = [], RND = [];
  let alarmTop = null;
  const push = (x, y, z, seed, zone, H, kind) => {
    P.push(x, y, z); INFO.push(seed, zone, H, kind); RND.push(rng(), 1.5 + rng() * 10);
  };
  const box = (cx, cz, hx, hz, H, zone, seed, kind = 0) => {
    const nx = Math.max(2, Math.round((hx * 2) / step)), nz = Math.max(2, Math.round((hz * 2) / step));
    const ny = Math.max(2, Math.round(H / step));
    for (let iy = 0; iy <= ny; iy++) {
      const y = (iy / ny) * H;
      const rowEdge = iy === ny;
      for (let i = 0; i < nx; i++) {
        const x = cx - hx + (i / nx) * hx * 2;
        const kk = kind || (rowEdge || i === 0 ? 3 : 0);
        push(x, y, cz - hz, seed, zone, H, kk); push(x + (hx * 2) / nx, y, cz + hz, seed, zone, H, kind || (rowEdge || i === nx - 1 ? 3 : 0));
      }
      for (let k = 0; k < nz; k++) {
        const z = cz - hz + (k / nz) * hz * 2;
        push(cx + hx, y, z, seed, zone, H, kind || (rowEdge || k === 0 ? 3 : 0)); push(cx - hx, y, z + (hz * 2) / nz, seed, zone, H, kind || (rowEdge || k === nz - 1 ? 3 : 0));
      }
    }
    for (let i = 1; i < nx; i++) for (let k = 1; k < nz; k++) {
      if (rng() < 0.55) push(cx - hx + (i / nx) * hx * 2, H, cz - hz + (k / nz) * hz * 2, seed, zone, H, 1);
    }
  };
  const cyl = (cx, cz, r, H, zone, seed, kind = 0) => {
    const nc = Math.max(8, Math.round((Math.PI * 2 * r) / step));
    const ny = Math.max(2, Math.round(H / step));
    for (let iy = 0; iy <= ny; iy++) {
      const y = (iy / ny) * H;
      for (let i = 0; i < nc; i++) {
        const a = (i / nc) * Math.PI * 2 + (iy % 2) * (Math.PI / nc);
        push(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, seed, zone, H, kind || (iy === ny || iy === 0 || i % 6 === 0 ? 3 : 0));
      }
    }
    for (let rr = step; rr < r; rr += step) {
      const n = Math.round((Math.PI * 2 * rr) / step);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; push(cx + Math.cos(a) * rr, H, cz + Math.sin(a) * rr, seed, zone, H, 1); }
    }
  };

  // ciudad: manzanas de 4 m con calles; más alta en el centro, plaza libre alrededor de la figura
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
    const cx = i * 4, cz = j * 4;
    const d = Math.hypot(cx, cz);
    if (d < 5 || d > 21 + rng() * 4) continue;
    const seed = rng();
    const tall = Math.pow(rng(), 2.4) * 15 * Math.max(0, 1 - d / 30) + 1.4 + rng() * 2.2;
    if (rng() < 0.3) {
      box(cx - 0.75, cz, 0.6, 1.4, tall, 0, seed);
      box(cx + 0.75, cz, 0.6, 1.4, tall * (0.5 + rng() * 0.5), 0, seed * 0.9);
    } else {
      box(cx, cz, 1.2 + rng() * 0.25, 1.2 + rng() * 0.25, tall, 0, seed);
    }
  }

  // polígono industrial: naves, depósitos y una chimenea
  const I = ZONES.industry;
  box(I.x - 8, I.y - 6, 7, 2.6, 4.2, 1, 0.1);
  box(I.x - 8, I.y + 1, 7, 2.6, 4.2, 1, 0.2);
  box(I.x - 8, I.y + 8, 7, 2.2, 3.4, 1, 0.3);
  for (let k = 0; k < 6; k++) {
    const tx = I.x + 5 + (k % 3) * 4.6, tz = I.y - 5 + Math.floor(k / 3) * 5;
    const alarm = k === 4;
    cyl(tx, tz, 1.7, 5.5 + (k % 2), 1, 0.4 + k * 0.05, alarm ? 2 : 0);
    if (alarm) alarmTop = new THREE.Vector3(tx, 6.5, tz);
  }
  cyl(I.x + 12, I.y + 8, 0.55, 17, 1, 0.75);
  box(I.x + 6, I.y + 9, 3.5, 2, 2.6, 1, 0.8);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  g.setAttribute('aInfo', new THREE.Float32BufferAttribute(INFO, 4));
  g.setAttribute('aRand', new THREE.Float32BufferAttribute(RND, 2));
  return { geo: g, alarmTop };
}

export class Territory {
  constructor(scene, shared, quality) {
    this.shared = shared;
    this.group = new THREE.Group();
    scene.add(this.group);
    const rng = mulberry32(99);

    this.u = {
      uOpacity: { value: 0 },
      uReveal: { value: 0 },
      uCity: { value: 0 },
      uIndustry: { value: 0 },
      uRural: { value: 0 },
      uFire: { value: 0 },
      uFireT: { value: 0 },
      uSensors: { value: 0 },
      uNet: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uFog: { value: new THREE.Vector2(60, 175) },
    };

    // --- suelo
    const N = quality.terrain;
    const span = 180;
    const pos = new Float32Array(N * N * 3);
    const rnd = new Float32Array(N * N * 2);
    let k = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const jx = (rng() - 0.5) * 0.25, jz = (rng() - 0.5) * 0.25;
      pos[k * 3] = -span / 2 + (i / (N - 1)) * span + jx;
      pos[k * 3 + 1] = 0;
      pos[k * 3 + 2] = -span / 2 + (j / (N - 1)) * span + jz;
      rnd[k * 2] = rng();
      rnd[k * 2 + 1] = 1.5 + rng() * 14;
      k++;
    }
    // relieve precalculado: altura, luz (normal por vecinos de la rejilla), monte y copa
    const ter = new Float32Array(N * N * 3);
    const H = new Float32Array(N * N);
    for (let i = 0; i < N * N; i++) H[i] = terrainH(pos[i * 3], pos[i * 3 + 2]);
    const L = new THREE.Vector3(-0.5, 0.75, 0.45).normalize();
    const nv = new THREE.Vector3();
    const step = span / (N - 1);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const id = i * N + j;
      const hx = H[Math.min(i + 1, N - 1) * N + j] - H[Math.max(i - 1, 0) * N + j];
      const hz = H[i * N + Math.min(j + 1, N - 1)] - H[i * N + Math.max(j - 1, 0)];
      nv.set(-hx, 2 * step, -hz).normalize();
      const x = pos[id * 3], z = pos[id * 3 + 2];
      pos[id * 3 + 1] = H[id];
      ter[id * 3] = Math.max(nv.dot(L), 0);
      ter[id * 3 + 1] = forestM(x, z);
      ter[id * 3 + 2] = vnoise(x * 1.7, z * 1.7);
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    tg.setAttribute('aTer', new THREE.BufferAttribute(ter, 3));
    tg.setAttribute('aRand', new THREE.BufferAttribute(rnd, 2));
    const spacing = span / N;

    const sensors = [
      [-12, -60], [4, -46], [-22, -44], [-6, -70], [-40, 4], [-62, 32], [-48, 36], [-30, -22],
    ].map(([x, z]) => new THREE.Vector2(x, z));
    this.sensors = sensors;

    const common = {
      uTime: shared.uTime, uProj: shared.uProj, uFlick: shared.uFlick, uAtlas: shared.uAtlas,
    };
    this.terrain = new THREE.Points(tg, new THREE.ShaderMaterial({
      vertexShader: TERRAIN_VERT,
      fragmentShader: GLYPH_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { ...common, ...this.u, uSize: { value: spacing * 0.78 }, uSens: { value: sensors } },
    }));
    this.terrain.frustumCulled = false;
    this.group.add(this.terrain);

    // --- edificios y planta
    const { geo, alarmTop } = buildStructures(quality.structStep);
    this.alarmTop = alarmTop;
    this.structures = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: STRUCT_VERT,
      fragmentShader: GLYPH_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { ...common, ...this.u, uSize: { value: quality.structStep * 0.95 } },
    }));
    this.structures.frustumCulled = false;
    this.group.add(this.structures);

    // --- red de gemelos: arcos entre nodos
    const y = (x, z, lift = 1) => terrainH(x, z) + lift;
    const nodes = [
      new THREE.Vector3(0, 2.2, 0), // la figura
      new THREE.Vector3(8, 15, -8), // ciudad
      new THREE.Vector3(ZONES.industry.x + 12, 17.5, ZONES.industry.y + 8), // chimenea
      new THREE.Vector3(ZONES.rural.x, y(ZONES.rural.x, ZONES.rural.y, 2), ZONES.rural.y),
      new THREE.Vector3(ZONES.fire.x, y(ZONES.fire.x, ZONES.fire.y, 2), ZONES.fire.y),
      new THREE.Vector3(riverX(-10), y(riverX(-10), -10, 1.5), -10),
      new THREE.Vector3(110, 4, 30),
      new THREE.Vector3(14, 4, -120),
      new THREE.Vector3(-26, 4, 115),
      new THREE.Vector3(-120, 4, -40),
      ...sensors.slice(0, 4).map((s) => new THREE.Vector3(s.x, y(s.x, s.y, 0.8), s.y)),
    ];
    this.nodes = nodes;
    const edges = [[0, 1], [1, 2], [1, 3], [1, 5], [5, 4], [3, 5], [2, 6], [3, 7], [4, 8], [1, 8], [2, 7], [4, 9], [5, 9], [0, 2], [3, 10], [3, 11], [3, 12], [3, 13], [1, 6]];
    const AP = [], AA = [];
    edges.forEach(([a, b], idx) => {
      const A = nodes[a], B = nodes[b];
      const len = A.distanceTo(B);
      const mid = A.clone().add(B).multiplyScalar(0.5);
      mid.y += len * 0.32 + 4;
      const n = Math.max(30, Math.round(len * quality.arcDensity));
      const p = new THREE.Vector3();
      for (let i = 0; i <= n; i++) {
        const s = i / n;
        const u = 1 - s;
        p.set(0, 0, 0).addScaledVector(A, u * u).addScaledVector(mid, 2 * u * s).addScaledVector(B, s * s);
        AP.push(p.x, p.y, p.z);
        AA.push(s, idx, rng(), len);
      }
    });
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.Float32BufferAttribute(AP, 3));
    ag.setAttribute('aArc', new THREE.Float32BufferAttribute(AA, 4));
    this.arcs = new THREE.Points(ag, new THREE.ShaderMaterial({
      vertexShader: ARC_VERT,
      fragmentShader: GLYPH_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { ...common, ...this.u, uSize: { value: 1.5 } },
    }));
    this.arcs.frustumCulled = false;
    this.group.add(this.arcs);

    // --- sensores
    const BP = [], BA = [];
    sensors.forEach((sv, si) => {
      const by = terrainH(sv.x, sv.y);
      const seed = rng();
      for (let ring = 0; ring < 3; ring++) {
        const n = 150;
        for (let i = 0; i < n; i++) { BP.push(sv.x, by, sv.y); BA.push(0, (i / n) * Math.PI * 2, ring, seed); }
      }
      for (let h = 0; h <= 7.5; h += 0.28) { BP.push(sv.x, by, sv.y); BA.push(1, h, 0, seed); }
      BP.push(sv.x, by, sv.y); BA.push(1, 7.8, 0, seed);
    });
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(BP, 3));
    bg.setAttribute('aB', new THREE.Float32BufferAttribute(BA, 4));
    this.beacons = new THREE.Points(bg, new THREE.ShaderMaterial({
      vertexShader: BEACON_VERT,
      fragmentShader: GLYPH_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { ...common, ...this.u, uSize: { value: 0.55 } },
    }));
    this.beacons.frustumCulled = false;
    this.group.add(this.beacons);

    this.pointCount = N * N + geo.attributes.position.count + AP.length / 3;
  }

  update(s, camPos, camTgt) {
    const u = this.u;
    u.uOpacity.value = s.terrain;
    u.uReveal.value = s.reveal;
    u.uCity.value = s.city;
    u.uIndustry.value = s.industry;
    u.uRural.value = s.rural;
    u.uSensors.value = s.sensors;
    u.uFire.value = s.fire;
    u.uFireT.value = s.fireT;
    u.uNet.value = s.net;
    u.uCam.value.copy(camPos);
    const d = camPos.distanceTo(camTgt);
    u.uFog.value.set(Math.max(60, d * 1.05), Math.max(175, d * 2.4));
    const on = s.terrain > 0.002;
    this.group.visible = on;
    this.arcs.visible = on && s.net > 0.002;
    this.structures.visible = on && (s.city > 0.002 || s.industry > 0.002);
    this.beacons.visible = on && s.sensors > 0.002;
  }
}
