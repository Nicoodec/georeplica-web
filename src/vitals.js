import * as THREE from 'three';
import { GLSL_COMMON, GLYPH_FRAG } from './glyphs.js';

// ---------------------------------------------------------------------------
// Constantes alrededor del cuerpo: el electrocardiograma es un anillo de
// dígitos que rodea el pecho a la altura del corazón. La "pluma" está delante
// y la traza antigua gira hacia la espalda y se apaga. Debajo, otro anillo
// más tenue con la respiración. Van colgados de la figura: si se gira, se
// tumba o camina, el monitor va con ella.
// ---------------------------------------------------------------------------

const VERT = /* glsl */ `
  precision highp float;
  ${GLSL_COMMON}
  uniform float uTime, uSize, uProj, uEcg, uResp, uPhase, uBreathPh, uFlick, uOpacity;
  uniform vec3 uCenter;
  attribute vec4 aR; // ángulo 0..1 desde la pluma, anillo (0 electro, 1 respiración), semilla, capa
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlyph;
  float g(float x, float m, float w) { return exp(-pow((x - m) / w, 2.0)); }
  float ecg(float ph) {
    ph = fract(ph);
    return 0.1 * g(ph, 0.13, 0.025) - 0.12 * g(ph, 0.235, 0.008) + g(ph, 0.255, 0.009)
         - 0.28 * g(ph, 0.275, 0.01) + 0.28 * g(ph, 0.47, 0.04);
  }
  void main() {
    float age = aR.x;
    bool isEcg = aR.y < 0.5;
    float ang = age * 6.28318;
    float R = isEcg ? 0.37 : 0.33;
    float y = uCenter.y;
    float a;
    if (isEcg) {
      float v = ecg(uPhase - age * 3.2);
      y += v * 0.085;
      a = pow(1.0 - age, 1.4) * (0.55 + abs(v) * 1.4) * uEcg;
    } else {
      y -= 0.24;
      y += sin((uBreathPh - age * 1.6) * 6.28318) * 0.028;
      a = (1.0 - age) * 0.32 * uResp;
    }
    float pen = 1.0 - smoothstep(0.0, 0.02, age);
    a += pen * 1.6 * (isEcg ? uEcg : uResp * 0.6);
    vec3 p = vec3(uCenter.x + sin(ang) * R, y, uCenter.z + cos(ang) * R);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vColor = mix(vec3(0.22, 0.56, 1.0), vec3(0.75, 0.88, 1.0), pen);
    vGlyph = mix(2.0, flipGlyph(aR.z, 10.0 * uFlick, uTime), step(0.55, aR.w));
    vAlpha = a * step(age, 0.9) * uOpacity;
    gl_PointSize = uSize * (1.0 + pen * 0.8) * uProj / -mv.z;
  }
`;

export class VitalRings {
  constructor(holder, shared, center) {
    const P = [], A = [];
    let seed = 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const [ring, n] of [[0, 1400], [1, 800]]) {
      for (let i = 0; i < n; i++) { P.push(0, 0, 0); A.push(i / n, ring, rnd(), rnd()); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    geo.setAttribute('aR', new THREE.Float32BufferAttribute(A, 4));
    this.u = {
      uEcg: { value: 0 }, uResp: { value: 0 }, uPhase: { value: 0 }, uBreathPh: { value: 0 },
      uOpacity: { value: 1 }, uCenter: { value: center.clone() }, uSize: { value: 0.016 },
    };
    this.points = new THREE.Points(geo, new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: GLYPH_FRAG,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: shared.uTime, uProj: shared.uProj, uFlick: shared.uFlick, uAtlas: shared.uAtlas, ...this.u },
    }));
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    holder.add(this.points);
    this.center = center;
  }

  // la pluma, en coordenadas de mundo (para anclar el monitor)
  pen(out) {
    return out.set(this.center.x, this.center.y + 0.02, this.center.z + 0.37).applyMatrix4(this.points.matrixWorld);
  }

  update(ecg, resp, vitals, opacity) {
    this.u.uEcg.value = ecg;
    this.u.uResp.value = resp;
    this.u.uPhase.value = vitals.phase;
    this.u.uBreathPh.value = vitals.breathPh;
    this.u.uOpacity.value = opacity;
    this.points.visible = (ecg > 0.002 || resp > 0.002) && opacity > 0.002;
  }
}
