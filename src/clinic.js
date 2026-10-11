import * as THREE from 'three';
import { GLSL_COMMON, GLYPH_FRAG } from './glyphs.js';

// ---------------------------------------------------------------------------
// La clínica: un hospital privado hecho de dígitos, detrás de la figura.
// Se levanta planta a planta, se "explota" en vertical para enseñar por dentro
// quirófanos, habitaciones y el recorrido de los pacientes, y tiene vida:
// una ambulancia que llega a urgencias, personas que caminan por los pasillos
// y habitaciones que pasan solas por ocupada → alta → limpieza → libre.
// Las cifras de ocupación se calculan de ese mismo ciclo, en directo.
// ---------------------------------------------------------------------------

export const FH = 3.6; // altura de planta
export const CLINIC = { z0: -6, explodeStep: 1.7 };
const ROOM_CYCLE = 46; // segundos que dura el ciclo de una habitación en la simulación
const ST = { busy: 0.62, discharge: 0.68, cleaning: 0.8 };

// tipos de punto
const K = { slab: 0, edge: 1, or: 2, bed: 3, cross: 4, heli: 5, facade: 6, amb: 7, ground: 8, room604: 9 };

const CLINIC_VERT = /* glsl */ `
  precision highp float;
  ${GLSL_COMMON}
  uniform float uTime, uSize, uProj, uOpacity, uFlick, uBuild, uExplode, uFocus;
  uniform vec3 uCam;
  uniform vec2 uFog;
  uniform vec3 uAmb;   // posición de la ambulancia
  uniform float uAmbYaw;
  attribute vec4 aH;   // planta, tipo, semilla, estado
  attribute vec2 aRand;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlyph;
  void main() {
    float fl = aH.x;
    float kind = aH.y;
    float state = aH.w;
    float rise = clamp((uBuild * 1.7 - max(fl, 0.0) * 0.1) / 0.5, 0.0, 1.0);
    rise = 1.0 - pow(1.0 - rise, 3.0);
    vec3 wp = position;
    bool ground = abs(kind - ${K.ground.toFixed(1)}) < 0.5;
    bool amb = abs(kind - ${K.amb.toFixed(1)}) < 0.5;
    if (amb) {
      float c = cos(uAmbYaw), s = sin(uAmbYaw);
      wp = vec3(c * position.x + s * position.z, position.y, -s * position.x + c * position.z) + uAmb;
    } else if (!ground) {
      wp.y = (wp.y + fl * uExplode * ${CLINIC.explodeStep.toFixed(2)}) * rise;
    }

    vec3 bone = vec3(0.925, 0.91, 0.88);
    vec3 blue = vec3(0.22, 0.56, 1.0);
    vec3 col = bone;
    float a = 0.1;
    float glyph = mix(flipGlyph(aRand.x, aRand.y * uFlick * 0.6, uTime), 2.0, step(hash11(aRand.x * 3.1), 0.6));
    float size = uSize;

    if (kind < 0.5) {                 // forjado: retícula, más viva en los ejes
      a = 0.06 + state * 0.2;
    } else if (kind < 1.5) {          // pilares y aristas
      a = 0.45;
      glyph = flipGlyph(aRand.x, aRand.y * uFlick * 0.6, uTime);
    } else if (kind < 2.5) {          // quirófanos: el 2 en uso, el 4 preparándose
      float inUse = 1.0 - step(0.5, abs(state - 1.0));
      float prep = 1.0 - step(0.5, abs(state - 3.0));
      float beat = 0.5 + 0.5 * sin(uTime * 3.2);
      float blink = step(0.5, fract(uTime * 0.9));
      col = mix(bone, blue, 0.5 + (inUse + prep) * 0.5);
      a = 0.28 + inUse * (0.5 + beat * 0.7) + prep * blink * 0.45;
      glyph = flipGlyph(aRand.x, aRand.y * uFlick, uTime);
    } else if (kind < 3.5) {          // camas: ocupada, alta, limpieza, libre
      float ph = fract(uTime / ${ROOM_CYCLE.toFixed(1)} + state);
      float busy = step(ph, ${ST.busy});
      float dis = step(${ST.busy}, ph) * step(ph, ${ST.discharge});
      float cln = step(${ST.discharge}, ph) * step(ph, ${ST.cleaning});
      float fre = step(${ST.cleaning}, ph);
      col = bone * busy + blue * dis + bone * 0.8 * cln + blue * fre;
      a = busy * 0.75 + dis * (0.9 + 0.6 * sin(uTime * 8.0)) + cln * 0.18 * step(0.5, fract(uTime * 1.5)) + fre * 0.2;
      glyph = flipGlyph(aRand.x, aRand.y * uFlick * 0.5, uTime);
    } else if (kind < 4.5) {          // la cruz de la fachada
      col = blue;
      a = 1.0 + 0.25 * sin(uTime * 2.0);
      glyph = flipGlyph(aRand.x, aRand.y * uFlick, uTime);
      size *= 1.25;
    } else if (kind < 5.5) {          // helipuerto
      a = 0.6;
      col = mix(bone, blue, 0.4);
    } else if (kind < 6.5) {          // fachada: lamas y franjas de ventanas
      a = 0.13 + state * 0.1;
    } else if (kind < 7.5) {          // ambulancia; las luces destellan
      float flash = step(0.5, fract(uTime * 3.0 + state * 0.5));
      col = state > 0.5 ? mix(blue, vec3(1.0), flash) : bone;
      a = state > 0.5 ? 0.6 + flash * 1.4 : 0.55;
      size *= state > 0.5 ? 1.3 : 0.9;
      glyph = flipGlyph(aRand.x, aRand.y * uFlick, uTime);
    } else if (kind < 8.5) {          // suelo: plaza, calle y aparcamiento
      float dash = state * step(0.5, fract(position.x * 0.25 - uTime * 0.6));
      a = 0.05 + state * 0.12 + dash * 0.25;
      glyph = mix(2.0, glyph, state);
    } else {                          // la habitación 604, la del paciente
      col = blue;
      a = 0.5 + 0.25 * sin(uTime * 2.2);
      glyph = flipGlyph(aRand.x, aRand.y * uFlick, uTime);
    }

    vec4 mv = viewMatrix * vec4(wp, 1.0);
    gl_Position = projectionMatrix * mv;
    float camD = length(wp - uCam);
    float fog = (1.0 - smoothstep(uFog.x, uFog.y, camD)) * smoothstep(2.5, 9.0, camD);
    float shown = (ground || amb) ? step(0.02, uBuild) : step(0.001, rise);
    // al entrar en la 604, el edificio se disuelve y solo queda su planta
    float keep = abs(fl - 6.0) < 0.5 ? 1.0 : 0.0;
    float room = abs(kind - ${K.room604.toFixed(1)}) < 0.5 ? 1.0 : 0.0;
    a *= mix(1.0, mix(0.03, 0.2 + room * 0.45, keep), uFocus);
    vColor = col;
    vGlyph = glyph;
    vAlpha = a * shown * fog * uOpacity;
    gl_PointSize = max(size * (0.8 + 0.4 * hash11(aRand.x * 9.0)) * mix(1.0, 0.6, step(1.5, glyph)) * uProj / -mv.z, 1.6);
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
    vAlpha = (0.2 + packet * 1.3) * reveal * step(0.99, uBuild) * uOpacity;
    gl_PointSize = max(uSize * (0.5 + packet * 1.0) * uProj / -mv.z, 1.6);
  }
`;

// personas: puntos que se recolocan en la CPU en cada fotograma
const AGENT_VERT = /* glsl */ `
  precision highp float;
  ${GLSL_COMMON}
  uniform float uTime, uSize, uProj, uOpacity;
  attribute vec3 aA; // tipo (0 paciente / 1 personal), semilla, parte
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlyph;
  void main() {
    vec4 mv = viewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = mix(vec3(0.95, 0.94, 0.9), vec3(0.3, 0.62, 1.0), aA.x);
    vGlyph = flipGlyph(aA.y, 9.0, uTime);
    vAlpha = 0.95 * uOpacity;
    gl_PointSize = max(uSize * (aA.z > 0.5 ? 1.25 : 1.0) * uProj / -mv.z, 1.6);
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

// recorrer una polilínea por distancia
function polyAt(pts, cum, d, out) {
  const L = cum[cum.length - 1];
  d = Math.min(Math.max(d, 0), L);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const t = (d - cum[i - 1]) / Math.max(cum[i] - cum[i - 1], 1e-6);
  return { p: out.copy(pts[i - 1]).lerp(pts[i], t), dir: pts[i].clone().sub(pts[i - 1]).normalize() };
}
function cumul(pts) {
  const c = [0];
  for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + pts[i].distanceTo(pts[i - 1]));
  return c;
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

    // volúmenes: basamento de 3 plantas y torre de hospitalización
    const podium = { x0: -14, x1: 14, z0: z0 - 15, z1: z0, f0: 0, f1: 3 };
    const tower = { x0: 1, x1: 14, z0: z0 - 13, z1: z0 - 3, f0: 3, f1: 8 };
    this.tower = tower;

    const slab = (v, fl) => {
      for (let x = v.x0; x <= v.x1 + 1e-6; x += g) for (let z = v.z0; z <= v.z1 + 1e-6; z += g) {
        const onGrid = Math.abs((x - v.x0) % 4) < g * 0.5 || Math.abs((z - v.z0) % 4) < g * 0.5;
        const edge = x - v.x0 < g * 0.5 || v.x1 - x < g * 0.5 || z - v.z0 < g * 0.5 || v.z1 - z < g * 0.5;
        if (!onGrid && !edge && rng() < 0.6) continue;
        push(x, fl * FH, z, fl, edge ? K.edge : K.slab, onGrid ? 1 : 0);
      }
    };
    const columns = (v, fl, every = 3) => {
      const pts = [];
      for (let x = v.x0; x <= v.x1 + 1e-6; x += every) pts.push([x, v.z0], [x, v.z1]);
      for (let z = v.z0 + every; z < v.z1 - 1e-6; z += every) pts.push([v.x0, z], [v.x1, z]);
      for (const [x, z] of pts) for (let y = 0.3; y < FH - 0.2; y += 0.42) push(x, fl * FH + y, z, fl, K.edge);
    };
    for (let f = podium.f0; f <= podium.f1; f++) slab(podium, f);
    for (let f = podium.f0; f < podium.f1; f++) columns(podium, f);
    for (let f = tower.f0 + 1; f <= tower.f1; f++) slab(tower, f);
    for (let f = tower.f0; f < tower.f1; f++) columns(tower, f, 2.6);

    // fachada: lamas verticales en la torre y franjas de ventanas en cada planta
    for (let f = tower.f0; f < tower.f1; f++) {
      for (const z of [tower.z0, tower.z1]) {
        for (let x = tower.x0 + 0.6; x < tower.x1; x += 1.25) for (let y = 0.35; y < FH - 0.3; y += 0.5) push(x, f * FH + y, z + (z === tower.z1 ? 0.3 : -0.3), f, K.facade, 0);
        for (const sill of [1.0, 2.9]) for (let x = tower.x0; x <= tower.x1; x += 0.45) push(x, f * FH + sill, z, f, K.facade, 1);
      }
    }
    for (let f = 0; f < 3; f++) {
      for (let x = podium.x0; x <= podium.x1; x += 2) for (let y = 0.4; y < FH - 0.3; y += 0.55) push(x, f * FH + y, podium.z1 + 0.05, f, K.facade, 0);
      for (let x = podium.x0; x <= podium.x1; x += 0.5) push(x, f * FH + 3.1, podium.z1 + 0.05, f, K.facade, 1);
    }
    // marquesina de la entrada
    for (let x = -5; x <= 5; x += 0.5) for (let z = z0; z <= z0 + 4; z += 0.5) push(x, 3.4, z, 0, (Math.abs(x) > 4.6 || z > z0 + 3.7) ? K.edge : K.facade, 1);

    // suelo: plaza, calle con su línea discontinua y aparcamiento
    for (let x = -34; x <= 34; x += 1.1) for (let z = z0 + 0.8; z <= z0 + 20; z += 1.1) {
      if (Math.abs(z - (z0 + 13)) < 2.4) continue;
      push(x, 0, z, 0, K.ground, 0);
    }
    for (let x = -44; x <= 44; x += 0.35) {
      push(x, 0, z0 + 10.6, 0, K.ground, 0.6);
      push(x, 0, z0 + 15.4, 0, K.ground, 0.6);
      if (Math.floor(x / 1.4) % 2 === 0) push(x, 0, z0 + 13, 0, K.ground, 1);
    }
    for (let x = -30; x <= -17; x += 2.6) for (let z = z0 + 2; z <= z0 + 7.5; z += 0.35) push(x, 0, z, 0, K.ground, 0.6);
    // bahía de ambulancias, junto a urgencias
    for (let t = 0; t <= 1; t += 0.03) { push(-13 + t * 7, 0, z0 + 1.2, 0, K.ground, 0.6); push(-13 + t * 7, 0, z0 + 4.4, 0, K.ground, 0.6); }

    // quirófanos en la planta 1: cuatro cajas
    this.orPos = [];
    for (let k = 0; k < 4; k++) {
      const cx = -12 + k * 3.3 + 1.4, cz = z0 - 10.5, hw = 1.35, hd = 2.2, fl = 1, h = 2.8;
      this.orPos.push(new THREE.Vector3(cx, fl * FH + h, cz));
      const edges = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
      for (let e = 0; e < 4; e++) {
        const [ax, az] = edges[e], [bx, bz] = edges[(e + 1) % 4];
        for (let t = 0; t <= 1; t += 0.06) {
          const x = cx + ax + (bx - ax) * t, z = cz + az + (bz - az) * t;
          push(x, fl * FH + 0.05, z, fl, K.or, k);
          push(x, fl * FH + h, z, fl, K.or, k);
        }
        for (let y = 0.2; y < h; y += 0.25) push(cx + ax, fl * FH + y, cz + az, fl, K.or, k);
      }
      for (let i = 0; i < 30; i++) push(cx + (rng() - 0.5) * 0.7, fl * FH + 0.9, cz + (rng() - 0.5) * 1.8, fl, K.or, k);
      // la lámpara quirúrgica
      for (let i = 0; i < 16; i++) { const an = (i / 16) * Math.PI * 2; push(cx + Math.cos(an) * 0.45, fl * FH + 2.3, cz + Math.sin(an) * 0.45, fl, K.or, k); }
    }

    // habitaciones de la torre: diez por planta, cada una con su fase del ciclo
    this.rooms = [];
    this.room604 = null;
    for (let f = tower.f0 + 1; f < tower.f1; f++) {
      for (const side of [0, 1]) for (let r = 0; r < 5; r++) {
        const cx = tower.x0 + 1.4 + r * 2.5, cz = side ? tower.z1 - 1.6 : tower.z0 + 1.6;
        if (f === 6 && side === 0 && r === 3) {
          // la 604: el paciente de esta historia. Paredes marcadas, cama vacía: él se tumba en ella
          this.room604 = new THREE.Vector3(cx, f * FH, cz);
          const hw = 1.15, hd = 1.5, h = 2.6;
          for (const [ax, az, bx, bz] of [[-hw, -hd, hw, -hd], [hw, -hd, hw, hd], [hw, hd, -hw, hd], [-hw, hd, -hw, -hd]]) {
            for (let t = 0; t <= 1; t += 0.05) {
              push(cx + ax + (bx - ax) * t, f * FH + 0.05, cz + az + (bz - az) * t, f, K.room604, 0);
              push(cx + ax + (bx - ax) * t, f * FH + h, cz + az + (bz - az) * t, f, K.room604, 0);
            }
            for (let y = 0.2; y < h; y += 0.22) push(cx + ax, f * FH + y, cz + az, f, K.room604, 0);
          }
          for (let t = 0; t <= 1; t += 0.06) {
            push(cx - 0.45, f * FH + 0.55, cz - 1.0 + t * 2.0, f, K.edge, 0);
            push(cx + 0.45, f * FH + 0.55, cz - 1.0 + t * 2.0, f, K.edge, 0);
          }
          continue;
        }
        const off = rng();
        this.rooms.push({ off, f });
        for (let i = 0; i < 14; i++) push(cx + (rng() - 0.5) * 0.9, f * FH + 0.6, cz + (rng() - 0.5) * 1.9, f, K.bed, off);
      }
    }

    // la cruz de la fachada, encima de la entrada
    const crossC = new THREE.Vector3(-7, 2 * FH + 1.8, z0 + 0.06);
    this.crossPos = crossC;
    for (let i = 0; i < 360; i++) {
      const bar = i % 2;
      const u = (rng() - 0.5) * 2.4, v = (rng() - 0.5) * 0.75;
      push(crossC.x + (bar ? u : v), crossC.y + (bar ? v : u), crossC.z, 2, K.cross);
    }

    // helipuerto en la cubierta
    const hc = new THREE.Vector3((tower.x0 + tower.x1) / 2, tower.f1 * FH + 0.05, (tower.z0 + tower.z1) / 2);
    for (let i = 0; i < 120; i++) { const an = (i / 120) * Math.PI * 2; push(hc.x + Math.cos(an) * 3.6, hc.y, hc.z + Math.sin(an) * 3.6, tower.f1, K.heli); }
    for (let t = -1; t <= 1; t += 0.08) {
      push(hc.x - 1, hc.y, hc.z + t * 1.5, tower.f1, K.heli);
      push(hc.x + 1, hc.y, hc.z + t * 1.5, tower.f1, K.heli);
      push(hc.x + t, hc.y, hc.z, tower.f1, K.heli);
    }
    this.heliPos = hc;

    // ambulancia: una caja de dígitos con su puente de luces
    const box = (x0, x1, y0, y1, z0b, z1b, st) => {
      for (let x = x0; x <= x1 + 1e-6; x += 0.3) for (const y of [y0, y1]) for (const z of [z0b, z1b]) push(x, y, z, 0, K.amb, st);
      for (let y = y0; y <= y1 + 1e-6; y += 0.3) for (const x of [x0, x1]) for (const z of [z0b, z1b]) push(x, y, z, 0, K.amb, st);
      for (let z = z0b; z <= z1b + 1e-6; z += 0.3) for (const x of [x0, x1]) for (const y of [y0, y1]) push(x, y, z, 0, K.amb, st);
    };
    box(-2.6, 1.2, 0.4, 2.5, -1.05, 1.05, 0);
    box(1.2, 2.6, 0.4, 1.8, -1.0, 1.0, 0);
    for (let i = 0; i < 14; i++) push(-1.6 + i * 0.16, 2.65, (i % 2 ? 0.5 : -0.5), 0, K.amb, 1 + (i % 2));

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('aH', new THREE.Float32BufferAttribute(A, 4));
    geo.setAttribute('aRand', new THREE.Float32BufferAttribute(R, 2));

    this.u = {
      uOpacity: { value: 0 }, uBuild: { value: 0 }, uExplode: { value: 0 }, uFlows: { value: 0 },
      uFocus: { value: 0 }, uCam: { value: new THREE.Vector3() }, uFog: { value: new THREE.Vector2(70, 150) }, uAmb: { value: new THREE.Vector3(-60, 0, 0) }, uAmbYaw: { value: 0 },
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

    // recorridos de pacientes
    const ent = [0, 0.4, z0 + 5];
    const hall = [0, 0.4, z0 - 2];
    const er = [-9, 0.4, z0 - 3.5];
    const lift = [-1, 0.4, z0 - 8];
    const lift2 = [4, 0.4, z0 - 8];
    const routes = [
      [ent, hall, er, [-9, 0.4, z0 - 8], lift, [-1, FH + 0.4, z0 - 8], [-9.1, FH + 0.4, z0 - 8.2], [-9.1, FH + 0.4, z0 - 10.5]],
      [ent, hall, lift2, [4, 6 * FH + 0.4, z0 - 8], [9, 6 * FH + 0.4, z0 - 8], [9, 6 * FH + 0.4, z0 - 9.8]],
      [[-9.5, 0.4, z0 + 2.8], [-9, 0.4, z0], er],
      [lift, [-1, 2 * FH + 0.4, z0 - 8], [6, 2 * FH + 0.4, z0 - 8], [6, 2 * FH + 0.4, z0 - 12.5]],
      [hall, lift2, [4, 4 * FH + 0.4, z0 - 8], [11, 4 * FH + 0.4, z0 - 8], [11, 4 * FH + 0.4, z0 - 4.6]],
    ].map((rt) => rt.map((q) => new THREE.Vector3(...q)));
    this.routes = routes;
    const FP = [], FA = [], FF = [];
    routes.forEach((pts, idx) => {
      const cum = cumul(pts);
      const len = cum[cum.length - 1];
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const d = a.distanceTo(b);
        const n = Math.max(2, Math.round(d / 0.22));
        for (let k = 0; k < n; k++) {
          const t = k / n;
          const p = a.clone().lerp(b, t);
          FP.push(p.x, p.y, p.z);
          FA.push((cum[i - 1] + d * t) / len, idx, rng(), len);
          FF.push(Math.min(Math.floor(p.y / FH + 0.02), 8));
        }
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

    // personas: cada una es una pequeña silueta de 16 dígitos que recorre una ruta
    const agentRoutes = [
      ...routes,
      [new THREE.Vector3(-12, FH + 0.4, z0 - 7), new THREE.Vector3(-2, FH + 0.4, z0 - 7)], // pasillo de quirófanos
      [new THREE.Vector3(2, 6 * FH + 0.4, z0 - 8), new THREE.Vector3(13, 6 * FH + 0.4, z0 - 8)], // pasillo planta 6
      [new THREE.Vector3(2, 5 * FH + 0.4, z0 - 8), new THREE.Vector3(13, 5 * FH + 0.4, z0 - 8)],
      [new THREE.Vector3(2, 7 * FH + 0.4, z0 - 8), new THREE.Vector3(13, 7 * FH + 0.4, z0 - 8)],
      [new THREE.Vector3(-20, 0.4, z0 + 8), new THREE.Vector3(0, 0.4, z0 + 7), new THREE.Vector3(0, 0.4, z0 - 1)], // plaza
    ].map((pts) => ({ pts, cum: cumul(pts) }));
    this.agentRoutes = agentRoutes;
    const nAgents = quality.clinicStep > 0.6 ? 22 : 38;
    // la silueta: cabeza, tronco y dos piernas (las piernas se balancean al andar)
    const shape = [];
    for (let i = 0; i < 4; i++) shape.push([Math.cos(i * 1.57) * 0.09, 1.62, Math.sin(i * 1.57) * 0.09, 1]);
    for (let y = 0.95; y <= 1.45; y += 0.12) { shape.push([-0.13, y, 0, 0]); shape.push([0.13, y, 0, 0]); }
    for (let y = 0.15; y <= 0.75; y += 0.3) { shape.push([-0.08, y, 0, 2]); shape.push([0.08, y, 0, 3]); }
    this.shape = shape;
    this.agents = [];
    const AP = new Float32Array(nAgents * shape.length * 3);
    const AA = [];
    for (let i = 0; i < nAgents; i++) {
      const route = i % agentRoutes.length;
      const staff = rng() < 0.4 ? 1 : 0;
      this.agents.push({ route, off: rng() * 200, speed: 1.0 + rng() * 0.5, back: rng() < 0.5, staff });
      for (let k = 0; k < shape.length; k++) AA.push(staff, rng(), shape[k][3] === 1 ? 1 : 0);
    }
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.BufferAttribute(AP, 3));
    ag.setAttribute('aA', new THREE.Float32BufferAttribute(AA, 3));
    this.agentPts = new THREE.Points(ag, new THREE.ShaderMaterial({
      vertexShader: AGENT_VERT,
      fragmentShader: GLYPH_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: shared.uTime, uProj: shared.uProj, uAtlas: shared.uAtlas, uSize: { value: 0.16 }, uOpacity: { value: 0 } },
    }));
    this.agentPts.frustumCulled = false;
    scene.add(this.agentPts);

    // ruta de la ambulancia: llega por la calle, gira y entra marcha atrás en la bahía
    this.ambRoute = [new THREE.Vector3(-70, 0, z0 + 12), new THREE.Vector3(-16, 0, z0 + 12), new THREE.Vector3(-11, 0, z0 + 8.5), new THREE.Vector3(-9.5, 0, z0 + 2.8)];
    this.ambCum = cumul(this.ambRoute);
    this.amb = { eta: 0, parked: false };

    this.ent = new THREE.Vector3(...ent);
    this.erPos = new THREE.Vector3(-9, 3.2, z0 - 3.5);
    this.roomPos = new THREE.Vector3(9, 6 * FH + 1.4, z0 - 9.8);
    this.count = P.length / 3 + FP.length / 3;
    this._v = new THREE.Vector3();
  }

  // un punto de la clínica con la explosión aplicada
  at(v, fl, out = new THREE.Vector3()) {
    const rise = THREE.MathUtils.clamp((this.u.uBuild.value * 1.7 - fl * 0.1) / 0.5, 0, 1);
    const r = 1 - Math.pow(1 - rise, 3);
    return out.set(v.x, (v.y + fl * this.u.uExplode.value * CLINIC.explodeStep) * r, v.z);
  }

  // dónde queda la cama de la 604 cuando la clínica está desplegada del todo
  bedOf604(explode = 1) {
    const r = this.room604;
    return new THREE.Vector3(r.x, r.y + 6 * explode * CLINIC.explodeStep + 0.62, r.z);
  }

  // estado de la planta de hospitalización, calculado del mismo ciclo que pinta las camas
  census(t) {
    let busy = 1, dis = 0, cln = 0; // la 604 está ocupada por nuestro paciente
    for (const r of this.rooms) {
      const ph = (t / ROOM_CYCLE + r.off) % 1;
      if (ph < ST.busy) busy++;
      else if (ph < ST.discharge) dis++;
      else if (ph < ST.cleaning) cln++;
    }
    return { total: this.rooms.length + 1, busy, dis, cln };
  }

  update(s, camPos, t, camTgt) {
    this.u.uOpacity.value = s.clinic * s.clinic; // se va antes que la cámara
    this.u.uBuild.value = s.build;
    this.u.uExplode.value = s.explode;
    this.u.uFlows.value = s.flows;
    this.u.uFocus.value = s.focus604;
    this.u.uCam.value.copy(camPos);
    // la niebla acompaña a la cámara: si se aleja (móvil), la clínica no se pierde en ella
    const d = camTgt ? camPos.distanceTo(camTgt) : 60;
    this.u.uFog.value.set(Math.max(70, d * 1.15), Math.max(150, d * 2.3));
    const on = s.clinic > 0.002;
    this.points.visible = on;
    this.flows.visible = on && s.flows > 0.002;
    const agentsOn = on && s.build > 0.98;
    this.agentPts.visible = agentsOn;
    this.agentPts.material.uniforms.uOpacity.value = s.clinic * Math.min(1, (s.build - 0.98) * 50) * (1 - s.focus604 * 0.85);
    if (!on) return;

    // ambulancia: 30 s de ciclo, 22 en marcha y 8 aparcada con las luces encendidas
    const cyc = t % 30;
    const L = this.ambCum[this.ambCum.length - 1];
    const k = Math.min(cyc / 22, 1);
    const eased = 1 - Math.pow(1 - k, 2.2);
    const { p, dir } = polyAt(this.ambRoute, this.ambCum, eased * L, this._v);
    this.u.uAmb.value.copy(p);
    this.u.uAmbYaw.value = Math.atan2(-dir.z, dir.x);
    this.amb.eta = Math.max(0, Math.round(22 - cyc));
    this.amb.parked = cyc >= 22;
    this.ambPos = p.clone().setY(3.2);

    if (!agentsOn) return;
    const arr = this.agentPts.geometry.attributes.position.array;
    const step = CLINIC.explodeStep * this.u.uExplode.value;
    let o = 0;
    for (const a of this.agents) {
      const R = this.agentRoutes[a.route];
      const Lr = R.cum[R.cum.length - 1];
      let d = (t * a.speed + a.off) % (Lr * 2);
      if (d > Lr) d = 2 * Lr - d; // ida y vuelta
      const { p: q, dir: dv } = polyAt(R.pts, R.cum, d, this._v);
      const fl = Math.min(Math.floor((q.y - 0.4) / FH + 0.02), 8);
      const baseY = q.y - 0.4 + fl * step;
      const swing = Math.sin(t * 7 * a.speed + a.off) * 0.18;
      const sx = -dv.z, sz = dv.x; // lateral
      for (const [lx, ly, , part] of this.shape) {
        const leg = part === 2 ? swing : part === 3 ? -swing : 0;
        arr[o++] = q.x + sx * lx + dv.x * leg * (ly < 0.8 ? 1 : 0);
        arr[o++] = baseY + ly;
        arr[o++] = q.z + sz * lx + dv.z * leg * (ly < 0.8 ? 1 : 0);
      }
    }
    this.agentPts.geometry.attributes.position.needsUpdate = true;
  }
}
