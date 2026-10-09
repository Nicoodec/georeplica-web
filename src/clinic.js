import * as THREE from 'three';
import { GLSL_COMMON, GLYPH_FRAG } from './glyphs.js';

// ---------------------------------------------------------------------------
// La clínica: un hospital privado hecho de dígitos, detrás de la figura.
// Se levanta planta a planta y luego se "explota" en vertical para enseñar
// por dentro quirófanos, habitaciones y el recorrido de los pacientes.
// ---------------------------------------------------------------------------

const FH = 3.6; // altura de planta
export const CLINIC = { z0: -6, explodeStep: 1.7 };

const CLINIC_VERT = /* glsl */ `
  precision highp float;
  ${GLSL_COMMON}
  uniform float uTime, uSize, uProj, uOpacity, uFlick, uBuild, uExplode;
  uniform vec3 uCam;
  attribute vec4 aH;   // planta, tipo, semilla, estado
  attribute vec2 aRand;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlyph;
  void main() {
    float fl = aH.x;
    float kind = aH.y;
    float seed = aH.z;
    float state = aH.w;
    float rise = clamp((uBuild * 1.7 - fl * 0.1) / 0.5, 0.0, 1.0);
    rise = 1.0 - pow(1.0 - rise, 3.0);
    vec3 wp = position;
    wp.y = (wp.y + fl * uExplode * ${CLINIC.explodeStep.toFixed(2)}) * rise;

    vec3 bone = vec3(0.925, 0.91, 0.88);
    vec3 blue = vec3(0.22, 0.56, 1.0);
    vec3 col = bone;
    float a = 0.1;
    float glyph = mix(flipGlyph(aRand.x, aRand.y * uFlick * 0.6, uTime), 2.0, step(hash11(aRand.x * 3.1), 0.6));
    float size = uSize;

    if (kind < 0.5) {            // forjado: retícula, más viva en los ejes
      a = 0.07 + state * 0.22;
    } else if (kind < 1.5) {     // pilares y aristas
      a = 0.5;
      glyph = flipGlyph(aRand.x, aRand.y * uFlick * 0.6, uTime);
    } else if (kind < 2.5) {     // quirófanos; el número 1 está en uso
      float inUse = 1.0 - step(0.5, abs(state - 1.0));
      float beat = 0.5 + 0.5 * sin(uTime * 3.2);
      col = mix(bone, blue, 0.55 + inUse * 0.45);
      a = 0.32 + inUse * (0.5 + beat * 0.7);
      glyph = flipGlyph(aRand.x, aRand.y * uFlick, uTime);
    } else if (kind < 3.5) {     // camas: ocupadas en hueso, libres en azul tenue
      col = mix(blue, bone, state);
      a = mix(0.22, 0.75, state);
      glyph = flipGlyph(aRand.x, aRand.y * uFlick * 0.5, uTime);
    } else if (kind < 4.5) {     // la cruz de la fachada
      col = blue;
      a = 1.1 + 0.25 * sin(uTime * 2.0);
      glyph = flipGlyph(aRand.x, aRand.y * uFlick, uTime);
      size *= 1.25;
    } else {                     // helipuerto
      a = 0.6;
      col = mix(bone, blue, 0.4);
    }

    vec4 mv = viewMatrix * vec4(wp, 1.0);
    gl_Position = projectionMatrix * mv;
    float fog = 1.0 - smoothstep(60.0, 140.0, length(wp - uCam));
    vColor = col;
    vGlyph = glyph;
    vAlpha = a * step(0.001, rise) * fog * uOpacity;
    gl_PointSize = size * (0.8 + 0.4 * hash11(aRand.x * 9.0)) * mix(1.0, 0.6, step(1.5, glyph)) * uProj / -mv.z;
  }
`;

const FLOW_VERT = /* glsl */ `
  precision highp float;
  ${GLSL_COMMON}
  uniform float uTime, uSize, uProj, uOpacity, uBuild, uExplode, uFlows;
  attribute vec4 aF;  // s (0..1), recorrido, semilla, longitud
  attribute float aFl;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlyph;
  void main() {
    float s = aF.x;
    float idx = aF.y;
    float len = aF.w;
    vec3 wp = position;
    wp.y += aFl * uExplode * ${CLINIC.explodeStep.toFixed(2)};
    float reveal = smoothstep(s, s + 0.05, uFlows * 1.6 - idx * 0.12);
    float ph = fract(s * len / 9.0 - uTime * 0.45 + idx * 0.31);
    float packet = smoothstep(0.8, 0.97, ph);
    vec4 mv = viewMatrix * vec4(wp, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = mix(vec3(0.55, 0.75, 1.0), vec3(0.22, 0.56, 1.0), packet);
    vGlyph = mix(2.0, flipGlyph(aF.z, 14.0, uTime), packet);
    vAlpha = (0.28 + packet * 1.8) * reveal * step(0.99, uBuild) * uOpacity;
    gl_PointSize = uSize * (0.5 + packet * 1.0) * uProj / -mv.z;
  }
`;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Clinic {
  constructor(scene, shared, quality) {
    const rng = mulberry32(2026);
    const P = [], A = [], R = [];
    const g = quality.clinicStep ?? 0.55;
    const z0 = CLINIC.z0; // fachada principal
    const push = (x, y, z, fl, kind, state = 0) => {
      P.push(x, y, z); A.push(fl, kind, rng(), state); R.push(rng(), 1.5 + rng() * 10);
    };

    // volúmenes: un basamento de 3 plantas y una torre de hospitalización encima
    const podium = { x0: -14, x1: 14, z0: z0 - 15, z1: z0, f0: 0, f1: 3 };
    const tower = { x0: 1, x1: 14, z0: z0 - 13, z1: z0 - 3, f0: 3, f1: 8 };

    const slab = (v, fl) => {
      for (let x = v.x0; x <= v.x1 + 1e-6; x += g) for (let z = v.z0; z <= v.z1 + 1e-6; z += g) {
        const onGrid = Math.abs(((x - v.x0) % 4) ) < g * 0.5 || Math.abs(((z - v.z0) % 4)) < g * 0.5;
        const edge = x - v.x0 < g * 0.5 || v.x1 - x < g * 0.5 || z - v.z0 < g * 0.5 || v.z1 - z < g * 0.5;
        if (!onGrid && !edge && rng() < 0.55) continue;
        push(x, fl * FH, z, fl, edge ? 1 : 0, onGrid ? 1 : 0);
      }
    };
    const columns = (v, fl, every = 3) => {
      const pts = [];
      for (let x = v.x0; x <= v.x1 + 1e-6; x += every) { pts.push([x, v.z0], [x, v.z1]); }
      for (let z = v.z0 + every; z < v.z1 - 1e-6; z += every) { pts.push([v.x0, z], [v.x1, z]); }
      for (const [x, z] of pts) for (let y = 0.3; y < FH - 0.2; y += 0.42) push(x, fl * FH + y, z, fl, 1);
    };
    for (let f = podium.f0; f <= podium.f1; f++) slab(podium, f);
    for (let f = podium.f0; f < podium.f1; f++) columns(podium, f);
    for (let f = tower.f0 + 1; f <= tower.f1; f++) slab(tower, f);
    for (let f = tower.f0; f < tower.f1; f++) columns(tower, f, 2.6);

    // quirófanos en la planta 1: cuatro cajas, el 1 en uso
    this.orPos = [];
    for (let k = 0; k < 4; k++) {
      const cx = -12 + k * 3.3 + 1.4, cz = z0 - 10.5, hw = 1.35, hd = 2.2, fl = 1, h = 2.8;
      this.orPos.push(new THREE.Vector3(cx, fl * FH + h, cz));
      const edges = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
      for (let e = 0; e < 4; e++) {
        const [ax, az] = edges[e], [bx, bz] = edges[(e + 1) % 4];
        for (let t = 0; t <= 1; t += 0.06) {
          const x = cx + ax + (bx - ax) * t, z = cz + az + (bz - az) * t;
          push(x, fl * FH + 0.05, z, fl, 2, k);
          push(x, fl * FH + h, z, fl, 2, k);
        }
        for (let y = 0.2; y < h; y += 0.25) push(cx + ax, fl * FH + y, cz + az, fl, 2, k);
      }
      // la mesa de operaciones
      for (let i = 0; i < 26; i++) push(cx + (rng() - 0.5) * 0.7, fl * FH + 0.9, cz + (rng() - 0.5) * 1.8, fl, 2, k);
    }

    // habitaciones de la torre: diez por planta, camas ocupadas o libres
    this.beds = { total: 0, busy: 0 };
    this.roomFloor = 6;
    for (let f = tower.f0 + 1; f < tower.f1; f++) {
      for (const side of [0, 1]) for (let r = 0; r < 5; r++) {
        const cx = tower.x0 + 1.4 + r * 2.5, cz = side ? tower.z1 - 1.6 : tower.z0 + 1.6;
        const busy = rng() > 0.17 ? 1 : 0;
        this.beds.total++; this.beds.busy += busy;
        for (let i = 0; i < 14; i++) push(cx + (rng() - 0.5) * 0.9, f * FH + 0.6, cz + (rng() - 0.5) * 1.9, f, 3, busy);
      }
    }

    // la cruz de la fachada, encima de la entrada
    const crossC = new THREE.Vector3(-7, 2 * FH + 1.8, z0 + 0.05);
    this.crossPos = crossC;
    for (let i = 0; i < 360; i++) {
      const bar = i % 2;
      const u = (rng() - 0.5) * 2.4, v = (rng() - 0.5) * 0.75;
      push(crossC.x + (bar ? u : v), crossC.y + (bar ? v : u), crossC.z, 2, 4);
    }

    // helipuerto en la cubierta de la torre
    const hc = new THREE.Vector3((tower.x0 + tower.x1) / 2, tower.f1 * FH + 0.05, (tower.z0 + tower.z1) / 2);
    for (let i = 0; i < 120; i++) { const an = (i / 120) * Math.PI * 2; push(hc.x + Math.cos(an) * 3.6, hc.y, hc.z + Math.sin(an) * 3.6, tower.f1, 5); }
    for (let t = -1; t <= 1; t += 0.08) {
      push(hc.x - 1, hc.y, hc.z + t * 1.5, tower.f1, 5);
      push(hc.x + 1, hc.y, hc.z + t * 1.5, tower.f1, 5);
      push(hc.x + t, hc.y, hc.z, tower.f1, 5);
    }
    this.heliPos = hc;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('aH', new THREE.Float32BufferAttribute(A, 4));
    geo.setAttribute('aRand', new THREE.Float32BufferAttribute(R, 2));

    this.u = {
      uOpacity: { value: 0 }, uBuild: { value: 0 }, uExplode: { value: 0 }, uFlows: { value: 0 },
      uCam: { value: new THREE.Vector3() },
    };
    const common = { uTime: shared.uTime, uProj: shared.uProj, uFlick: shared.uFlick, uAtlas: shared.uAtlas };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: CLINIC_VERT,
      fragmentShader: GLYPH_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { ...common, ...this.u, uSize: { value: g * 0.58 } },
    }));
    this.points.frustumCulled = false;
    scene.add(this.points);

    // recorridos de pacientes: entrada, urgencias, ascensores, quirófano, habitación, diagnóstico
    const ent = [0, 0.4, z0 + 5];
    const hall = [0, 0.4, z0 - 2];
    const er = [-9, 0.4, z0 - 3.5];
    const lift = [-1, 0.4, z0 - 8];
    const lift2 = [4, 0.4, z0 - 8];
    const routes = [
      [ent, hall, er, [-9, 0.4, z0 - 8], lift, [-1, FH + 0.4, z0 - 8], [-9.1, FH + 0.4, z0 - 8.2], [-9.1, FH + 0.4, z0 - 10.5]],
      [ent, hall, lift2, [4, 6 * FH + 0.4, z0 - 8], [9, 6 * FH + 0.4, z0 - 8], [9, 6 * FH + 0.4, z0 - 9.8]],
      [[-24, 0.4, z0 + 6], [-12, 0.4, z0 + 2], [-9, 0.4, z0], er],
      [lift, [-1, 2 * FH + 0.4, z0 - 8], [6, 2 * FH + 0.4, z0 - 8], [6, 2 * FH + 0.4, z0 - 12.5]],
      [hall, lift2, [4, 4 * FH + 0.4, z0 - 8], [11, 4 * FH + 0.4, z0 - 8], [11, 4 * FH + 0.4, z0 - 4.6]],
    ];
    const FP = [], FA = [], FF = [];
    routes.forEach((rt, idx) => {
      const pts = rt.map((q) => new THREE.Vector3(...q));
      let len = 0;
      for (let i = 1; i < pts.length; i++) len += pts[i].distanceTo(pts[i - 1]);
      let acc = 0;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const d = a.distanceTo(b);
        const n = Math.max(2, Math.round(d / 0.22));
        for (let k = 0; k < n; k++) {
          const t = k / n;
          const p = a.clone().lerp(b, t);
          FP.push(p.x, p.y, p.z);
          FA.push((acc + d * t) / len, idx, rng(), len);
          FF.push(Math.min(Math.floor(p.y / FH + 0.02), 8));
        }
        acc += d;
      }
    });
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(FP, 3));
    fg.setAttribute('aF', new THREE.Float32BufferAttribute(FA, 4));
    fg.setAttribute('aFl', new THREE.Float32BufferAttribute(FF, 1));
    this.flows = new THREE.Points(fg, new THREE.ShaderMaterial({
      vertexShader: FLOW_VERT,
      fragmentShader: GLYPH_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { ...common, ...this.u, uSize: { value: 0.5 } },
    }));
    this.flows.frustumCulled = false;
    scene.add(this.flows);

    this.ent = new THREE.Vector3(...ent);
    this.erPos = new THREE.Vector3(-9, 3.2, z0 - 3.5);
    this.roomPos = new THREE.Vector3(9, 6 * FH + 1.4, z0 - 9.8);
    this.count = P.length / 3 + FP.length / 3;
  }

  // posición en pantalla de un punto de la clínica con la explosión aplicada
  at(v, fl, out = new THREE.Vector3()) {
    const rise = THREE.MathUtils.clamp((this.u.uBuild.value * 1.7 - fl * 0.1) / 0.5, 0, 1);
    const r = 1 - Math.pow(1 - rise, 3);
    return out.set(v.x, (v.y + fl * this.u.uExplode.value * CLINIC.explodeStep) * r, v.z);
  }

  update(s, camPos) {
    this.u.uOpacity.value = s.clinic;
    this.u.uBuild.value = s.build;
    this.u.uExplode.value = s.explode;
    this.u.uFlows.value = s.flows;
    this.u.uCam.value.copy(camPos);
    const on = s.clinic > 0.002;
    this.points.visible = on;
    this.flows.visible = on && s.flows > 0.002;
  }
}
