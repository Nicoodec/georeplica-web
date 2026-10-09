import * as THREE from 'three';
import { GLSL_COMMON } from './glyphs.js';

// ---------------------------------------------------------------------------
// El interior del gemelo: corazón, pulmones, cerebro, columna, arterias, venas
// y nervios, hechos con los mismos dígitos que la piel.
// Nada se coloca a ojo: el tórax y el cráneo se MIDEN sobre la malla del
// maniquí y cada órgano se ancla a sus huesos, así late, respira y se mueve
// con el cuerpo en cualquier pose.
// ---------------------------------------------------------------------------

export const ORGAN = { heart: 0, lungs: 1, brain: 2, spine: 3, artery: 4, vein: 5, lesion: 6, nerve: 7, watch: 8 };

export const ORGAN_VERT = /* glsl */ `
  precision highp float;
  precision highp sampler2D;
  ${GLSL_COMMON}
  uniform sampler2D boneTexture;
  uniform mat4 bindMatrix;
  uniform mat4 bindMatrixInverse;
  uniform float uTime, uSize, uProj, uOpacity, uFlick, uInterior, uBeat, uBeatPhase, uBreath,
                uFocusHeart, uFocusBrain, uFocusLesion, uNerves, uLesion, uVessels, uWatch;
  attribute vec4 skinIndex;
  attribute vec4 skinWeight;
  attribute vec4 aOrgan;  // órgano, distancia (al corazón o al cerebro), semilla, capa
  attribute vec3 aCenter; // centro del órgano, para latir o respirar a su alrededor
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlyph;

  mat4 getBoneMatrix(const in float i) {
    int size = textureSize(boneTexture, 0).x;
    int j = int(i) * 4;
    int x = j % size;
    int y = j / size;
    return mat4(
      texelFetch(boneTexture, ivec2(x, y), 0),
      texelFetch(boneTexture, ivec2(x + 1, y), 0),
      texelFetch(boneTexture, ivec2(x + 2, y), 0),
      texelFetch(boneTexture, ivec2(x + 3, y), 0));
  }

  void main() {
    float id = aOrgan.x;
    float dist = aOrgan.y;
    float seed = aOrgan.z;
    bool isHeart = id < 0.5;
    bool isLung = id > 0.5 && id < 1.5;
    bool isBrain = id > 1.5 && id < 2.5;
    bool isSpine = id > 2.5 && id < 3.5;
    bool isArtery = id > 3.5 && id < 4.5;
    bool isVein = id > 4.5 && id < 5.5;
    bool isLesion = id > 5.5 && id < 6.5;
    bool isNerve = id > 6.5 && id < 7.5;
    bool isWatch = id > 7.5;

    // latido, respiración y tamaño de la lesión, en espacio de reposo
    vec3 pos = position;
    float sc = 1.0;
    if (isHeart) sc = 1.0 + uBeat * 0.17;
    else if (isLung) sc = 1.0 + uBreath * 0.07;
    else if (isLesion) sc = max(uLesion, 0.0001);
    pos = aCenter + (pos - aCenter) * sc;

    mat4 bx = getBoneMatrix(skinIndex.x);
    mat4 by = getBoneMatrix(skinIndex.y);
    mat4 bz = getBoneMatrix(skinIndex.z);
    mat4 bw = getBoneMatrix(skinIndex.w);
    vec4 sv = bindMatrix * vec4(pos, 1.0);
    vec4 sk = bx * sv * skinWeight.x + by * sv * skinWeight.y + bz * sv * skinWeight.z + bw * sv * skinWeight.w;
    vec3 p = (bindMatrixInverse * sk).xyz;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    vec4 mv = viewMatrix * wp;
    gl_Position = projectionMatrix * mv;

    vec3 bone = vec3(0.925, 0.91, 0.88);
    vec3 blue = vec3(0.22, 0.56, 1.0);
    vec3 heat = vec3(1.0, 0.4, 0.14);
    float glyph = mix(flipGlyph(seed, (5.0 + seed * 16.0) * uFlick, uTime), 2.0, step(aOrgan.w, 0.42));
    vec3 col = bone;
    float a = 0.4;
    float size = uSize * (0.75 + 0.5 * hash11(seed * 7.7));
    float mine = 0.0;

    if (isHeart) {
      col = mix(bone, blue, 0.6 + 0.4 * uBeat);
      a = 0.14 + uBeat * 0.75;
      size *= 0.78 + uBeat * 0.3;
      mine = uFocusHeart;
    } else if (isLung) {
      col = bone;
      a = 0.13 + 0.08 * (uBreath * 0.5 + 0.5);
    } else if (isBrain) {
      float spark = step(0.94, hash11(seed * 31.0 + floor(uTime * (6.0 + seed * 10.0))));
      col = mix(bone, blue, spark);
      a = 0.055 + spark * 0.85;
      size *= 0.8 + spark * 0.5;
      mine = uFocusBrain;
    } else if (isSpine) {
      a = 0.42;
    } else if (isArtery) {
      // la onda sale del corazón con cada latido
      float flow = smoothstep(0.8, 1.0, fract(dist * 1.5 - uBeatPhase));
      col = mix(blue * 0.8, vec3(0.6, 0.82, 1.0), flow);
      a = (0.16 + flow * 1.4) * uVessels;
      size *= 1.0 + flow * 0.7;
      mine = uFocusHeart;
    } else if (isVein) {
      float back = smoothstep(0.86, 1.0, fract(-dist * 1.1 + uTime * 0.35 + seed * 0.05));
      col = mix(bone * 0.7, blue, back * 0.6);
      a = (0.1 + back * 0.55) * uVessels;
    } else if (isLesion) {
      col = heat;
      a = 1.3 * (0.65 + 0.35 * sin(uTime * 4.0)) * uFocusLesion;
      glyph = flipGlyph(seed, 18.0, uTime);
      mine = uFocusLesion;
    } else if (isWatch) {
      // el reloj: la esfera late con el corazón, la correa titila
      float face = step(0.8, aOrgan.w);
      col = mix(vec3(0.6, 0.8, 1.0), blue, face);
      a = (0.22 + face * (0.3 + uBeat * 0.6)) * uWatch;
      glyph = flipGlyph(seed, 14.0 * uFlick, uTime);
      size *= 0.85;
      // el reloj se ve aunque el interior esté apagado
      vColor = col; vGlyph = glyph;
      vAlpha = a * uOpacity;
      gl_PointSize = size * uProj / -mv.z;
      return;
    } else if (isNerve) {
      float sig = smoothstep(0.9, 1.0, fract(dist * 0.9 - uTime * 1.25 + floor(seed * 3.0) * 0.33));
      col = mix(bone, vec3(0.75, 0.88, 1.0), sig);
      a = (0.06 + sig * 1.6) * uNerves;
      size *= 1.0 + sig * 0.8;
      mine = uFocusBrain;
    }

    // al enfocar un órgano, el resto se apaga un poco
    float focus = max(max(uFocusHeart, uFocusBrain), uFocusLesion);
    a *= mix(1.0, mix(0.3, 1.15, mine), focus);

    vColor = col;
    vGlyph = glyph;
    vAlpha = a * uInterior * uOpacity;
    gl_PointSize = size * uProj / -mv.z;
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

const bn = (n) => 'mixamorig' + n;

export function buildInterior(src, scale = 1) {
  let surf = null;
  src.traverse((o) => { if (o.isSkinnedMesh && o.name.includes('Surface')) surf = o; });
  src.updateMatrixWorld(true);
  surf.skeleton.update();
  const bones = surf.skeleton.bones;
  const B = (n) => src.getObjectByName(bn(n));
  const idx = (n) => bones.indexOf(B(n));
  const W = (n) => B(n).getWorldPosition(new THREE.Vector3());
  const rng = mulberry32(7331);
  const N = (n) => Math.max(8, Math.round(n * scale));

  // --- medir el cuerpo: piel en coordenadas de mundo
  const P = surf.geometry.attributes.position;
  const verts = [];
  const v = new THREE.Vector3();
  for (let i = 0; i < P.count; i += 2) {
    surf.getVertexPosition(i, v); // en SkinnedMesh ya incluye el esqueleto
    v.applyMatrix4(surf.matrixWorld);
    verts.push(v.clone());
  }
  // las medidas se memorizan por centímetro de altura: arterias y nervios piden miles
  const slabCache = new Map();
  const slab = (y, h, maxAbsX = 1) => {
    const key = `${Math.round(y * 100)}|${h}|${maxAbsX}`;
    let r = slabCache.get(key);
    if (!r) { r = slabRaw(Math.round(y * 100) / 100, h, maxAbsX); slabCache.set(key, r); }
    return r;
  };
  const slabRaw = (y, h, maxAbsX) => {
    let n = 0, cx = 0, cz = 0, x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const q of verts) {
      if (Math.abs(q.y - y) > h || Math.abs(q.x - src.position.x) > maxAbsX) continue;
      n++; cx += q.x; cz += q.z;
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z);
    }
    if (!n) return null;
    return { cx: cx / n, cz: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, front: z1, back: z0 };
  };

  const s1 = W('Spine1'), s2 = W('Spine2'), neck = W('Neck'), head = W('Head'), top = W('HeadTop_End');
  const leftSign = Math.sign(W('LeftArm').x - W('RightArm').x) || 1;
  const L = new THREE.Vector3(leftSign, 0, 0);
  const chestY = THREE.MathUtils.lerp(s1.y, s2.y, 0.55);
  // el tórax se mide sin los brazos (están en T): solo lo que queda cerca del eje
  const chest = slab(chestY, 0.025, 0.2);
  const headH = top.y - head.y;
  const skull = slab(head.y + headH * 0.55, 0.02, 0.15);

  // --- conversión mundo -> espacio de reposo de la malla.
  // El modelo se carga en su pose de reposo, y en este maniquí el espacio de
  // reposo de la piel es el de la escena antes de normalizarla: basta deshacer
  // la escala y el desplazamiento de la escena (comprobado con los vértices).
  const srcInv = src.matrixWorld.clone().invert();
  const toRest = (X) => X.clone().applyMatrix4(srcInv);

  const POS = [], CEN = [], SI = [], SW = [], ORG = [];
  const add = (X, C, si, sw, organ, dist = 0) => {
    const p = toRest(X, si, sw);
    const c = toRest(C, si, sw);
    POS.push(p.x, p.y, p.z);
    CEN.push(c.x, c.y, c.z);
    SI.push(si[0], si[1] || 0, si[2] || 0, si[3] || 0);
    SW.push(sw[0], sw[1] || 0, sw[2] || 0, sw[3] || 0);
    ORG.push(organ, dist, rng(), rng());
  };
  const torsoW = (y) => {
    // el pecho se mueve entre Spine1 y Spine2
    const t = THREE.MathUtils.clamp((y - s1.y) / Math.max(s2.y - s1.y, 1e-3), 0, 1);
    return [[idx('Spine1'), idx('Spine2'), 0, 0], [1 - t, t, 0, 0]];
  };
  const randDir = () => {
    const u = rng() * 2 - 1, th = rng() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    return new THREE.Vector3(r * Math.cos(th), u, r * Math.sin(th));
  };

  // --- corazón: superficie implícita clásica (x² + 9/4 y² + z² − 1)³ − x² z³ − 9/80 y² z³ = 0
  const heartC = new THREE.Vector3(chest.cx, chestY - 0.012, chest.cz + chest.d * 0.16).addScaledVector(L, 0.022);
  const hs = chest.w * 0.16;
  const tilt = 0.42 * leftSign;
  let made = 0;
  for (let tries = 0; made < N(2600) && tries < 600000; tries++) {
    const x = rng() * 2.6 - 1.3, y = rng() * 2 - 1, z = rng() * 2.6 - 1.2;
    const a = x * x + 2.25 * y * y + z * z - 1;
    const F = a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z;
    if (F > 0 || (F < -0.05 && rng() > 0.05)) continue;
    // z del corazón = arriba; se inclina con la punta hacia la izquierda del cuerpo
    const ux = x * Math.cos(tilt) + z * Math.sin(tilt);
    const uz = -x * Math.sin(tilt) + z * Math.cos(tilt);
    const X = heartC.clone().add(new THREE.Vector3(ux * hs, uz * hs, y * hs * 0.85));
    const [si, sw] = torsoW(X.y);
    add(X, heartC, si, sw, ORGAN.heart);
    made++;
  }

  // --- pulmones: dos volúmenes, la tráquea y los bronquios
  const lungR = { x: chest.w * 0.135, y: (s2.y - s1.y) * 0.75 + 0.05, z: chest.d * 0.3 };
  const lungs = [-1, 1].map((sd) => new THREE.Vector3(chest.cx + sd * chest.w * 0.21, chestY + 0.02, chest.cz - chest.d * 0.02));
  for (const c of lungs) {
    for (let i = 0; i < N(2300); i++) {
      const d = randDir();
      const r = rng() < 0.72 ? 1 : Math.cbrt(rng());
      const X = c.clone().add(new THREE.Vector3(d.x * lungR.x * r, d.y * lungR.y * r, d.z * lungR.z * r));
      if (X.distanceTo(heartC) < hs * 1.05) continue;
      const [si, sw] = torsoW(X.y);
      add(X, c, si, sw, ORGAN.lungs);
    }
  }
  const tracheaTop = new THREE.Vector3(neck.x, neck.y + 0.02, chest.cz + chest.d * 0.12);
  const carina = new THREE.Vector3(chest.cx, chestY + lungR.y * 0.55, chest.cz + chest.d * 0.05);
  const line = (A, Bp, n, organ, wf, jitter = 0.004) => {
    for (let i = 0; i <= n; i++) {
      const X = A.clone().lerp(Bp, i / n).add(randDir().multiplyScalar(jitter));
      const [si, sw] = wf(X);
      add(X, X, si, sw, organ);
    }
  };
  line(tracheaTop, carina, N(90), ORGAN.lungs, (X) => torsoW(X.y));
  for (const c of lungs) line(carina, c.clone().lerp(carina, 0.35), N(60), ORGAN.lungs, (X) => torsoW(X.y));

  // lesión: un nódulo pequeño en el pulmón derecho, para la sección del tratamiento
  const rightLung = leftSign > 0 ? lungs[0] : lungs[1];
  const lesionC = rightLung.clone().add(new THREE.Vector3(0, -lungR.y * 0.35, lungR.z * 0.45));
  for (let i = 0; i < N(320); i++) {
    const X = lesionC.clone().add(randDir().multiplyScalar(0.016 * Math.cbrt(rng())));
    const [si, sw] = torsoW(X.y);
    add(X, lesionC, si, sw, ORGAN.lesion);
  }

  // --- cerebro: elipsoide con circunvoluciones, cisura central y cerebelo
  const brainC = new THREE.Vector3(skull.cx, head.y + headH * 0.6, skull.cz + skull.d * 0.04);
  const br = { x: skull.w * 0.36, y: headH * 0.27, z: skull.d * 0.4 };
  const headI = idx('Head');
  for (let i = 0; i < N(3400); i++) {
    const d = randDir();
    if (Math.abs(d.x) < 0.035) continue;
    const fold = 1 + 0.07 * Math.sin(d.x * 17 + 3) * Math.sin(d.y * 13) * Math.sin(d.z * 11 + 1);
    const r = (rng() < 0.8 ? 1 : Math.cbrt(rng())) * fold;
    const X = brainC.clone().add(new THREE.Vector3(d.x * br.x * r, d.y * br.y * r, d.z * br.z * r));
    add(X, brainC, [headI, 0, 0, 0], [1, 0, 0, 0], ORGAN.brain);
  }
  const cereb = brainC.clone().add(new THREE.Vector3(0, -br.y * 0.7, -br.z * 0.55));
  for (let i = 0; i < N(600); i++) {
    const d = randDir();
    const X = cereb.clone().add(new THREE.Vector3(d.x * br.x * 0.5, d.y * br.y * 0.36, d.z * br.z * 0.38));
    add(X, brainC, [headI, 0, 0, 0], [1, 0, 0, 0], ORGAN.brain);
  }

  // --- cadenas de huesos: columna, arterias, venas y nervios siguen el esqueleto
  const chain = (names) => names.map((n) => ({ p: W(n), i: idx(n) }));
  const polyline = (nodes, organ, step, { offset = null, jitter = 0.003, dist0 = 0 } = {}) => {
    let dist = dist0;
    for (let k = 0; k < nodes.length - 1; k++) {
      const A = nodes[k], Bn = nodes[k + 1];
      const len = A.p.distanceTo(Bn.p);
      const n = Math.max(2, Math.round(len / step));
      for (let s = 0; s < n; s++) {
        const t = s / n;
        const X = A.p.clone().lerp(Bn.p, t);
        if (offset) X.add(offset(X));
        X.add(randDir().multiplyScalar(jitter));
        add(X, X, [A.i, Bn.i, 0, 0], [1 - t, t, 0, 0], organ, dist + len * t);
      }
      dist += len;
    }
    return dist;
  };
  const st = 0.0045 / Math.max(scale, 0.5);

  // columna: discos a lo largo de la espalda
  const spineNodes = chain(['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head']);
  for (let k = 0; k < spineNodes.length - 1; k++) {
    const A = spineNodes[k], Bn = spineNodes[k + 1];
    for (let s = 0; s < 5; s++) {
      const t = s / 5;
      const c = A.p.clone().lerp(Bn.p, t);
      const sl = slab(c.y, 0.02, 0.18);
      if (sl) c.z = sl.back + sl.d * 0.22;
      for (let j = 0; j < 16; j++) {
        const an = (j / 16) * Math.PI * 2;
        const X = c.clone().add(new THREE.Vector3(Math.cos(an) * 0.017, 0, Math.sin(an) * 0.012));
        add(X, X, [A.i, Bn.i, 0, 0], [1 - t, t, 0, 0], ORGAN.spine);
      }
    }
  }

  // arterias desde el corazón: brazos, piernas y carótidas
  const H = { p: heartC, i: idx('Spine2') };
  const vessel = (names, extra = []) => [H, ...chain(names), ...extra];
  const routes = [
    vessel(['LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'LeftHandMiddle1']),
    vessel(['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand', 'RightHandMiddle1']),
    vessel(['Spine1', 'Spine', 'Hips', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase']),
    vessel(['Spine1', 'Spine', 'Hips', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase']),
    vessel(['Neck', 'Head'], [{ p: W('Head').add(new THREE.Vector3(0, headH * 0.35, 0)), i: headI }]),
  ];
  const fwdBias = (amt) => (X) => {
    const sl = slab(X.y, 0.03, 0.18);
    if (!sl) return new THREE.Vector3();
    // en el tronco, la aorta va por delante de la columna; en brazos y piernas, por el centro del hueso
    return Math.abs(X.x - chest.cx) < 0.12 ? new THREE.Vector3(0, 0, sl.cz + sl.d * amt - X.z) : new THREE.Vector3();
  };
  for (const r of routes) polyline(r, ORGAN.artery, st, { offset: fwdBias(0.05), jitter: 0.0025 });
  for (const r of routes) polyline(r, ORGAN.vein, st * 1.4, { offset: (X) => fwdBias(-0.05)(X).add(new THREE.Vector3(0.008, 0, -0.006)), jitter: 0.004 });

  // nervios desde el cerebro: médula por la espalda y ramas a brazos y piernas
  const Bc = { p: brainC, i: headI };
  const back = (X) => {
    const sl = slab(X.y, 0.03, 0.18);
    if (!sl) return new THREE.Vector3();
    return Math.abs(X.x - chest.cx) < 0.12 ? new THREE.Vector3(0, 0, sl.back + sl.d * 0.24 - X.z) : new THREE.Vector3();
  };
  const cordNodes = [Bc, ...chain(['Neck', 'Spine2', 'Spine1', 'Spine', 'Hips'])];
  polyline(cordNodes, ORGAN.nerve, st, { offset: back, jitter: 0.002 });
  const dNeck = brainC.distanceTo(W('Neck'));
  const dS2 = dNeck + W('Neck').distanceTo(W('Spine2'));
  const dHips = dS2 + W('Spine2').distanceTo(W('Spine1')) + W('Spine1').distanceTo(W('Spine')) + W('Spine').distanceTo(W('Hips'));
  for (const sd of ['Left', 'Right']) {
    polyline(chain(['Spine2', sd + 'Shoulder', sd + 'Arm', sd + 'ForeArm', sd + 'Hand', sd + 'HandIndex1', sd + 'HandIndex3']), ORGAN.nerve, st, { jitter: 0.002, dist0: dS2 });
    polyline(chain(['Hips', sd + 'UpLeg', sd + 'Leg', sd + 'Foot', sd + 'ToeBase']), ORGAN.nerve, st, { jitter: 0.002, dist0: dHips });
  }

  // reloj en la muñeca izquierda: correa y esfera, de donde salen los datos
  const wristC = W('LeftHand').lerp(W('LeftForeArm'), 0.14);
  const fdir = W('LeftHand').sub(W('LeftForeArm')).normalize();
  const wu = new THREE.Vector3(0, 1, 0).cross(fdir).normalize();
  const wv = fdir.clone().cross(wu).normalize();
  const wristI = [idx('LeftForeArm'), idx('LeftHand'), 0, 0];
  for (let i = 0; i < N(300); i++) {
    const an = rng() * Math.PI * 2;
    const r = 0.03 + rng() * 0.004;
    const X = wristC.clone().addScaledVector(wu, Math.cos(an) * r).addScaledVector(wv, Math.sin(an) * r).addScaledVector(fdir, (rng() - 0.5) * 0.022);
    add(X, wristC, wristI, [0.25, 0.75, 0, 0], ORGAN.watch);
    ORG[ORG.length - 1] = 0.3 * rng(); // correa
  }
  for (let i = 0; i < N(160); i++) {
    const X = wristC.clone().addScaledVector(wv, 0.036).addScaledVector(wu, (rng() - 0.5) * 0.03).addScaledVector(fdir, (rng() - 0.5) * 0.034);
    add(X, wristC, wristI, [0.25, 0.75, 0, 0], ORGAN.watch);
    ORG[ORG.length - 1] = 0.85 + 0.15 * rng(); // esfera
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(POS, 3));
  geo.setAttribute('aCenter', new THREE.Float32BufferAttribute(CEN, 3));
  geo.setAttribute('skinIndex', new THREE.Float32BufferAttribute(SI, 4));
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  geo.setAttribute('aOrgan', new THREE.Float32BufferAttribute(ORG, 4));

  // anclas para las etiquetas, en el espacio local de cada hueso
  const anchor = (bone, X) => ({ bone, local: B(bone).worldToLocal(X.clone()) });
  const anchors = {
    heart: anchor('Spine2', heartC),
    lung: anchor('Spine2', leftSign > 0 ? lungs[1] : lungs[0]),
    brain: anchor('Head', brainC),
    lesion: anchor('Spine2', lesionC),
    spine: anchor('Spine1', new THREE.Vector3(chest.cx, s1.y, chest.back + chest.d * 0.22)),
    vessel: anchor('LeftForeArm', W('LeftForeArm').lerp(W('LeftHand'), 0.5)),
    watch: anchor('LeftHand', wristC),
  };
  return { geo, anchors, surf, count: POS.length / 3 };
}
