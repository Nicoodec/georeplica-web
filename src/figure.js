import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { GLSL_COMMON, GLYPH_FRAG } from './glyphs.js';

// ---------------------------------------------------------------------------
// La figura: la malla del maniquí nunca se dibuja. Solo presta su esqueleto.
// Lo que se ve son decenas de miles de puntos muestreados sobre su piel,
// cada uno con sus pesos de hueso, deformados en la GPU y pintados como 0 ó 1.
// ---------------------------------------------------------------------------

const VERT = /* glsl */ `
  precision highp float;
  precision highp sampler2D;
  ${GLSL_COMMON}
  uniform sampler2D boneTexture;
  uniform mat4 bindMatrix;
  uniform mat4 bindMatrixInverse;
  uniform float uTime, uSize, uProj, uOpacity, uAssemble, uScanY, uScanOn, uPulse, uGlitch,
                uFlick, uTintMix, uPart, uFloorY, uSpark, uHeight;
  attribute vec4 skinIndex;
  attribute vec4 skinWeight;
  attribute vec4 aRand; // semilla, ritmo, capa (0 glifo legible / 1 polvo), libre
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
    float seed = aRand.x;
    float rate = aRand.y;
    float tier = aRand.z;

    mat4 bx = getBoneMatrix(skinIndex.x);
    mat4 by = getBoneMatrix(skinIndex.y);
    mat4 bz = getBoneMatrix(skinIndex.z);
    mat4 bw = getBoneMatrix(skinIndex.w);
    vec4 sv = bindMatrix * vec4(position, 1.0);
    vec4 sk = bx * sv * skinWeight.x + by * sv * skinWeight.y + bz * sv * skinWeight.z + bw * sv * skinWeight.w;
    vec3 p = (bindMatrixInverse * sk).xyz;
    mat4 sm = bx * skinWeight.x + by * skinWeight.y + bz * skinWeight.z + bw * skinWeight.w;
    sm = bindMatrixInverse * sm * bindMatrix;
    vec3 n = (sm * vec4(normal, 0.0)).xyz;

    vec4 wp = modelMatrix * vec4(p, 1.0);
    vec3 wn = normalize(mat3(modelMatrix) * n);
    vec3 origin = modelMatrix[3].xyz;

    // --- ensamblado: los dígitos llegan girando desde una nube, de los pies a la cabeza
    float h01 = clamp((wp.y - uFloorY) / uHeight, 0.0, 1.0);
    float d = h01 * 0.6 + hash11(seed * 31.0) * 0.4;
    float a = clamp((uAssemble * 1.4 - d) / 0.4, 0.0, 1.0);
    a = a * a * (3.0 - 2.0 * a);
    float ia = 1.0 - a;
    vec3 dir = normalize(hash31(seed * 113.0) - 0.5);
    vec3 scatter = dir * (0.5 + 2.6 * hash11(seed * 57.0)) + vec3(0.0, 1.2 * hash11(seed * 7.0), 0.0);
    vec2 rel = wp.xz - origin.xz;
    float ang = ia * ia * (2.4 + 1.6 * hash11(seed * 3.0));
    float cs = cos(ang), sn = sin(ang);
    rel = mat2(cs, -sn, sn, cs) * rel;
    wp.xz = origin.xz + rel;
    wp.xyz += scatter * ia * ia;

    // --- fallo de señal: franjas horizontales que se desplazan un instante
    float tq = floor(uTime * 24.0);
    float slice = floor(wp.y * 26.0);
    float gsel = step(0.84, hash21(vec2(slice, tq))) * uGlitch;
    wp.x += (hash21(vec2(slice + 7.3, tq)) - 0.5) * 0.16 * gsel;

    vec4 mv = viewMatrix * wp;
    gl_Position = projectionMatrix * mv;

    // --- luz: frente brillante, espalda tenue (se intuye a través, como en rayos X), contorno
    vec3 V = normalize(cameraPosition - wp.xyz);
    float ndv = dot(wn, V);
    float facing = smoothstep(-0.3, 0.4, ndv);
    float rim = pow(1.0 - abs(ndv), 3.0);
    float lam = max(dot(wn, normalize(vec3(-0.45, 0.85, 0.55))), 0.0);
    float bright = mix(0.08, 1.0, facing) * (0.22 + 0.78 * lam) + rim * 0.55 * facing;

    // capa 0: dígitos legibles; capa 1: punteado fino que da la forma y titila
    float glyph = mix(flipGlyph(seed, rate * uFlick, uTime), 2.0, tier);
    float size = uSize * mix(1.0, 0.36, tier) * (0.78 + 0.44 * hash11(seed * 3.3));
    float twinkle = 0.55 + 0.45 * hash11(seed * 13.0 + floor(uTime * rate * 0.5 * uFlick));
    float alpha = mix(0.9, 0.13 * twinkle, tier);

    vec3 bone = vec3(0.925, 0.91, 0.88);
    vec3 blue = vec3(0.22, 0.56, 1.0);
    vec3 col = mix(bone, blue, uPart * 0.4);
    alpha *= mix(1.0, 0.8, uPart);

    // destellos azules sueltos: el gemelo nunca está quieto
    float spark = step(0.988, hash11(seed * 19.0 + floor(uTime * (2.0 + rate * 0.2)))) * uSpark;
    col = mix(col, blue, spark);
    bright += spark * 0.8;

    // --- escaneo: por debajo de la línea aún es nube en bruto
    if (uScanOn > 0.001) {
      float below = step(wp.y, uScanY);
      float band = 1.0 - smoothstep(0.0, 0.035, abs(wp.y - uScanY));
      float halo = 1.0 - smoothstep(0.0, 0.22, abs(wp.y - uScanY));
      float raw = below * uScanOn;
      glyph = mix(glyph, 2.0, step(0.5, raw));
      size *= mix(1.0, 0.5, raw);
      bright *= mix(1.0, 0.45, raw);
      col = mix(col, blue, (band + halo * 0.35 * (1.0 - below)) * uScanOn);
      size *= 1.0 + band * uScanOn * 0.8;
      bright += band * uScanOn * 1.6 + halo * uScanOn * 0.25;
    }

    // --- pulso: paquetes de datos que suben por el cuerpo
    float sel = step(0.74, hash11(seed * 41.0));
    float lane = floor(hash11(seed * 5.0) * 4.0);
    float pk = fract((wp.y - uFloorY) * 0.75 - uTime * (0.32 + lane * 0.09) + lane * 0.29);
    float packet = smoothstep(0.88, 0.985, pk) * sel * uPulse;
    col = mix(col, blue, packet);
    size *= 1.0 + packet * 0.7;
    bright += packet * 1.8;

    col = mix(col, blue, uTintMix);

    vColor = col;
    vAlpha = clamp(bright, 0.0, 2.2) * alpha * uOpacity * mix(0.0, 1.0, a) * (0.35 + 0.65 * a);
    vGlyph = glyph;
    gl_PointSize = size * uProj / -mv.z;
  }
`;

// Suelo: anillos de puntos bajo los pies, como la base de un escáner
const FLOOR_VERT = /* glsl */ `
  precision highp float;
  ${GLSL_COMMON}
  uniform float uTime, uSize, uProj, uOpacity, uFlick;
  attribute vec4 aRand; // semilla, ritmo, radio, anillo
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlyph;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vec4 mv = viewMatrix * wp;
    gl_Position = projectionMatrix * mv;
    float r = aRand.z;
    float ring = aRand.w;
    float sweep = fract(atan(position.z, position.x) / 6.28318 - uTime * 0.08);
    float sw = smoothstep(0.86, 1.0, sweep);
    float g = mix(2.0, flipGlyph(aRand.x, aRand.y * uFlick, uTime), step(0.5, ring));
    vGlyph = g;
    vColor = mix(vec3(0.92, 0.9, 0.87), vec3(0.22, 0.56, 1.0), sw * 0.9 + ring * 0.25);
    float fade = 1.0 - smoothstep(0.6, 1.6, r);
    vAlpha = (0.22 + sw * 0.8) * fade * uOpacity;
    gl_PointSize = uSize * mix(0.5, 0.9, ring) * uProj / -mv.z;
  }
`;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Reparte puntos sobre la piel en proporción al área de cada triángulo
function sampleSkin(mesh, nGlyph, nDust, rng) {
  const geo = mesh.geometry;
  const P = geo.attributes.position;
  const N = geo.attributes.normal;
  const SI = geo.attributes.skinIndex;
  const SW = geo.attributes.skinWeight;
  const I = geo.index;
  const triCount = I.count / 3;
  const cum = new Float64Array(triCount);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3();
  let total = 0;
  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(P, I.getX(t * 3));
    b.fromBufferAttribute(P, I.getX(t * 3 + 1));
    c.fromBufferAttribute(P, I.getX(t * 3 + 2));
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    total += ab.cross(ac).length() * 0.5;
    cum[t] = total;
  }

  const count = nGlyph + nDust;
  const pos = new Float32Array(count * 3);
  const nor = new Float32Array(count * 3);
  const sIdx = new Float32Array(count * 4);
  const sWgt = new Float32Array(count * 4);
  const rnd = new Float32Array(count * 4);
  const na = new THREE.Vector3(), nb = new THREE.Vector3(), nc = new THREE.Vector3();
  const acc = new Map();

  for (let k = 0; k < count; k++) {
    const r = rng() * total;
    let lo = 0, hi = triCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < r) lo = mid + 1; else hi = mid;
    }
    const i0 = I.getX(lo * 3), i1 = I.getX(lo * 3 + 1), i2 = I.getX(lo * 3 + 2);
    let u = rng(), v = rng();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    a.fromBufferAttribute(P, i0); b.fromBufferAttribute(P, i1); c.fromBufferAttribute(P, i2);
    na.fromBufferAttribute(N, i0); nb.fromBufferAttribute(N, i1); nc.fromBufferAttribute(N, i2);
    pos[k * 3] = a.x * w + b.x * u + c.x * v;
    pos[k * 3 + 1] = a.y * w + b.y * u + c.y * v;
    pos[k * 3 + 2] = a.z * w + b.z * u + c.z * v;
    const nx = na.x * w + nb.x * u + nc.x * v;
    const ny = na.y * w + nb.y * u + nc.y * v;
    const nz = na.z * w + nb.z * u + nc.z * v;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nor[k * 3] = nx / nl; nor[k * 3 + 1] = ny / nl; nor[k * 3 + 2] = nz / nl;

    // mezcla los pesos de los tres vértices y se queda con los cuatro huesos que más tiran
    acc.clear();
    const verts = [[i0, w], [i1, u], [i2, v]];
    for (const [vi, bw] of verts) {
      for (let cc = 0; cc < 4; cc++) {
        const bi = SI.getComponent(vi, cc);
        const ww = SW.getComponent(vi, cc) * bw;
        if (ww > 0) acc.set(bi, (acc.get(bi) || 0) + ww);
      }
    }
    const top = [...acc.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4);
    const sum = top.reduce((s, e) => s + e[1], 0) || 1;
    for (let cc = 0; cc < 4; cc++) {
      sIdx[k * 4 + cc] = top[cc] ? top[cc][0] : 0;
      sWgt[k * 4 + cc] = top[cc] ? top[cc][1] / sum : 0;
    }

    rnd[k * 4] = rng();
    rnd[k * 4 + 1] = 2.5 + Math.pow(rng(), 1.7) * 22;
    rnd[k * 4 + 2] = k < nGlyph ? 0 : 1;
    rnd[k * 4 + 3] = rng();
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('skinIndex', new THREE.BufferAttribute(sIdx, 4));
  g.setAttribute('skinWeight', new THREE.BufferAttribute(sWgt, 4));
  g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
  // las glifos legibles primero: así recortar con drawRange quita polvo, no forma
  return g;
}

async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  const total = Number(res.headers.get('content-length')) || 2930032;
  if (!res.body || !res.body.getReader) {
    const buf = await res.arrayBuffer();
    onProgress(1);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    onProgress(Math.min(got / total, 1));
  }
  const out = new Uint8Array(got);
  let off = 0;
  for (const ch of chunks) { out.set(ch, off); off += ch.length; }
  onProgress(1);
  return out.buffer;
}

const bn = (n) => 'mixamorig' + n;

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _qi = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();

// Rota un hueso en espacio mundo (premultiplica) y lo devuelve a su espacio local
function rotateBoneWorld(bone, deltaWorld) {
  bone.getWorldQuaternion(_q);
  _q.premultiply(deltaWorld);
  bone.parent.getWorldQuaternion(_qp).invert();
  bone.quaternion.copy(_qp.multiply(_q));
  bone.updateMatrixWorld(true);
}

export class Figure {
  constructor(scene, atlas, shared) {
    this.scene = scene;
    this.atlas = atlas;
    this.shared = shared; // uniforms compartidos
    this.instances = [];
    this.height = 1.8;
  }

  async load(url, onProgress, quality) {
    const buf = await fetchWithProgress(url, onProgress);
    const gltf = await new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej));
    this.gltf = gltf;
    const src = gltf.scene;

    // normaliza la altura a 1,80 m con los pies en el suelo
    src.updateMatrixWorld(true);
    const box = new THREE.Box3();
    src.traverse((o) => {
      if (o.isSkinnedMesh && o.name.includes('Surface')) {
        o.computeBoundingBox(); // con el esqueleto aplicado, no la malla cruda
        box.copy(o.boundingBox).applyMatrix4(o.matrixWorld);
      }
    });
    const h = box.max.y - box.min.y;
    const s = this.height / h;
    src.scale.multiplyScalar(s);
    src.position.y = -box.min.y * s;
    src.updateMatrixWorld(true);

    // muestreo de la piel (una vez; todos los gemelos comparten geometría)
    const rng = mulberry32(20261008);
    this.geos = {};
    src.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      const surf = o.name.includes('Surface');
      const ng = Math.round((surf ? quality.glyph : quality.glyph * 0.16));
      const nd = Math.round((surf ? quality.dust : quality.dust * 0.12));
      this.geos[o.name] = sampleSkin(o, ng, nd, rng);
    });
    this.pointCount = Object.values(this.geos).reduce((s, g) => s + g.attributes.position.count, 0);

    // eje "hacia delante" de la cabeza, en su espacio local, medido en la pose de reposo
    const head = src.getObjectByName(bn('Head'));
    head.getWorldQuaternion(_q);
    this.headFwdLocal = new THREE.Vector3(0, 0, 1).applyQuaternion(_q.clone().invert()).normalize();

    this.clips = Object.fromEntries(gltf.animations.map((c) => [c.name, c]));
  }

  makeInstance({ main = false, tint = 0, drawFraction = 1 } = {}) {
    const root = main ? this.gltf.scene : cloneSkinned(this.gltf.scene);
    const holder = new THREE.Group();
    holder.add(root);
    this.scene.add(holder);

    const inst = {
      holder, root, main,
      mixer: new THREE.AnimationMixer(root),
      points: [], skeletons: new Set(), meshes: [],
      opacity: 1, visible: true,
      bones: {}, rest: {},
    };

    root.traverse((o) => {
      if (!o.isSkinnedMesh) return;
      o.frustumCulled = false;
      o.visible = false; // la malla presta su esqueleto; no se pinta
      const skel = o.skeleton;
      if (!skel.boneTexture) skel.computeBoneTexture();
      inst.skeletons.add(skel);
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: GLYPH_FRAG,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          ...this.shared,
          boneTexture: { value: skel.boneTexture },
          bindMatrix: { value: o.bindMatrix },
          bindMatrixInverse: { value: o.bindMatrixInverse },
          uOpacity: { value: 1 },
          uTintMix: { value: tint },
          uPart: { value: o.name.includes('Joints') ? 1 : 0 },
        },
      });
      const geo = this.geos[o.name];
      const pts = new THREE.Points(geo, mat);
      if (drawFraction < 1) {
        const n = geo.attributes.position.count;
        pts.geometry = geo.clone();
        pts.geometry.setDrawRange(0, Math.floor(n * drawFraction));
      }
      pts.frustumCulled = false;
      pts.matrixAutoUpdate = false;
      pts.matrixWorldAutoUpdate = false;
      pts.renderOrder = 2;
      this.scene.add(pts);
      inst.points.push({ pts, mesh: o });
    });

    for (const n of ['Hips', 'Spine', 'Spine1', 'Spine2', 'Neck', 'Head', 'HeadTop_End',
      'RightArm', 'RightForeArm', 'RightHand', 'LeftArm', 'LeftForeArm', 'LeftHand',
      'RightUpLeg', 'RightLeg', 'RightFoot', 'LeftUpLeg', 'LeftLeg', 'LeftFoot',
      'RightHandIndex1', 'RightHandIndex2', 'RightHandIndex3',
      'LeftHandIndex1', 'LeftHandIndex2', 'LeftHandIndex3']) {
      const b = root.getObjectByName(bn(n));
      inst.bones[n] = b;
      inst.rest[n] = b.quaternion.clone(); // pose de reposo (brazos en T, rectos)
    }

    const idle = inst.mixer.clipAction(this.clips.idle);
    const walk = inst.mixer.clipAction(this.clips.walk);
    const agree = inst.mixer.clipAction(this.clips.agree);
    idle.play();
    walk.play();
    agree.play();
    walk.setEffectiveWeight(0);
    agree.setEffectiveWeight(0);
    inst.actions = { idle, walk, agree };
    this.instances.push(inst);
    return inst;
  }

  setOpacity(inst, o) {
    inst.opacity = o;
    const vis = o > 0.002;
    for (const { pts } of inst.points) {
      pts.material.uniforms.uOpacity.value = o;
      pts.visible = vis;
    }
    inst.visible = vis;
  }

  // Gira columna, cuello y cabeza para mirar hacia un punto
  look(inst, target, weight) {
    if (weight <= 0.001) return;
    const { bones } = inst;
    const head = bones.Head;
    head.getWorldPosition(_v);
    const want = _v2.subVectors(target, _v).normalize();

    // limita el giro respecto al cuerpo: nadie gira el cuello 180°
    inst.holder.getWorldQuaternion(_q2);
    const local = want.clone().applyQuaternion(_q2.clone().invert());
    let yaw = Math.atan2(local.x, local.z);
    let pitch = Math.asin(THREE.MathUtils.clamp(local.y, -1, 1));
    yaw = THREE.MathUtils.clamp(yaw, -1.15, 1.15);
    pitch = THREE.MathUtils.clamp(pitch, -0.55, 0.45);
    local.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    local.applyQuaternion(_q2);

    head.getWorldQuaternion(_q);
    const cur = this.headFwdLocal.clone().applyQuaternion(_q);
    const goal = cur.clone().lerp(local, weight).normalize();

    for (const [name, amt] of [['Spine2', 0.22], ['Neck', 0.4], ['Head', 1]]) {
      head.getWorldQuaternion(_q);
      const c = this.headFwdLocal.clone().applyQuaternion(_q);
      _q2.setFromUnitVectors(c, goal);
      _qi.identity().slerp(_q2, amt);
      rotateBoneWorld(bones[name], _qi);
    }
  }

  // Estira un brazo y apunta con el índice hacia un punto del mundo
  point(inst, target, weight, side) {
    if (weight <= 0.001) return;
    const { bones, rest } = inst;
    const S = side; // 'Right' | 'Left'
    const arm = bones[S + 'Arm'];
    const fore = bones[S + 'ForeArm'];
    const hand = bones[S + 'Hand'];

    fore.quaternion.slerp(rest[S + 'ForeArm'], weight * 0.9);
    hand.quaternion.slerp(rest[S + 'Hand'], weight * 0.7);
    for (const k of ['Index1', 'Index2', 'Index3']) {
      bones[S + 'Hand' + k].quaternion.slerp(rest[S + 'Hand' + k], weight);
    }
    arm.updateMatrixWorld(true);

    arm.getWorldPosition(_v);
    hand.getWorldPosition(_v2);
    const curDir = _v2.sub(_v).normalize();
    const wantDir = _v3.subVectors(target, _v).normalize();
    _q2.setFromUnitVectors(curDir, wantDir);
    _qi.identity().slerp(_q2, weight);
    rotateBoneWorld(arm, _qi);
  }

  // qué brazo queda más cerca del objetivo
  armFor(inst, target) {
    inst.bones.RightArm.getWorldPosition(_v);
    inst.bones.LeftArm.getWorldPosition(_v2);
    return _v.distanceToSquared(target) < _v2.distanceToSquared(target) ? 'Right' : 'Left';
  }

  // tras modificar huesos: sube el esqueleto a la GPU y sincroniza los puntos
  commit(inst) {
    inst.root.updateMatrixWorld(true);
    for (const s of inst.skeletons) s.update();
    for (const { pts, mesh } of inst.points) pts.matrixWorld.copy(mesh.matrixWorld);
  }
}

export function makeFloor(scene, shared, n = 2600) {
  const rng = mulberry32(77);
  const pos = new Float32Array(n * 3);
  const rnd = new Float32Array(n * 4);
  const rings = [0.34, 0.62, 0.92, 1.26];
  for (let i = 0; i < n; i++) {
    let r, ring = 0;
    if (rng() < 0.55) {
      r = rings[Math.floor(rng() * rings.length)] + (rng() - 0.5) * 0.012;
      ring = 1;
    } else {
      r = Math.sqrt(rng()) * 1.6;
    }
    const a = rng() * Math.PI * 2;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = 0.002;
    pos[i * 3 + 2] = Math.sin(a) * r;
    rnd[i * 4] = rng();
    rnd[i * 4 + 1] = 2 + rng() * 10;
    rnd[i * 4 + 2] = r;
    rnd[i * 4 + 3] = ring;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
  const mat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT,
    fragmentShader: GLYPH_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: shared.uTime,
      uProj: shared.uProj,
      uFlick: shared.uFlick,
      uAtlas: shared.uAtlas,
      uSize: { value: 0.03 },
      uOpacity: { value: 0 },
    },
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  return pts;
}
