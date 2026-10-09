import * as THREE from 'three';

// Atlas de 4 celdas: "0", "1", punto (nube en bruto) y "+" (marcadores).
// Cada glifo lleva un halo suave pintado debajo: es el "bloom" de la página,
// sin pasar por postproceso, y así el lienzo puede seguir siendo transparente.
export function makeGlyphAtlas() {
  const cell = 128;
  const c = document.createElement('canvas');
  c.width = cell * 4;
  c.height = cell;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#fff';

  const drawText = (ch, i) => {
    const x = cell * i + cell / 2;
    const y = cell / 2 + 6;
    g.font = '500 100px "IBM Plex Mono", monospace';
    g.save();
    g.shadowColor = 'rgba(255,255,255,1)';
    g.shadowBlur = 16;
    g.globalAlpha = 0.3;
    g.fillText(ch, x, y);
    g.restore();
    g.globalAlpha = 1;
    g.fillText(ch, x, y);
  };
  drawText('0', 0);
  drawText('1', 1);

  // punto
  const grd = g.createRadialGradient(cell * 2.5, cell / 2, 0, cell * 2.5, cell / 2, 30);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.28, 'rgba(255,255,255,0.9)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(cell * 2, 0, cell, cell);
  g.fillStyle = '#fff';

  drawText('+', 3);

  const tex = new THREE.CanvasTexture(c);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
}

export const GLSL_COMMON = /* glsl */ `
  float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
  float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
  vec3 hash31(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.xxy + p3.yzz) * p3.zyx);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
    return v;
  }
  // 0 ó 1, cambiando a su propio ritmo
  float flipGlyph(float seed, float rate, float t) {
    return step(0.5, hash11(seed * 911.7 + floor(t * rate + seed * 7.0)));
  }
`;

export const GLYPH_FRAG = /* glsl */ `
  uniform sampler2D uAtlas;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vGlyph;
  void main() {
    vec2 uv = gl_PointCoord;
    uv.y = 1.0 - uv.y;
    uv.x = (uv.x + floor(vGlyph + 0.5)) * 0.25;
    float a = texture2D(uAtlas, uv).a * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;
