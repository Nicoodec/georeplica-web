// ---------------------------------------------------------------------------
// El guion. Cada sección de la página es un plano: dónde está la figura,
// dónde está la cámara, qué hace y a qué mira. `p` va de 0 a 1 mientras la
// sección está fija en pantalla; entre secciones, todo se interpola solo.
// ---------------------------------------------------------------------------

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const bell = (p, a, b) => {
  const t = Math.min(Math.max((p - a) / (b - a), 0), 1);
  return Math.sin(Math.PI * t);
};

export const DEFAULTS = {
  figX: 0, figZ: 0, figRot: 0, figOpacity: 1,
  camX: 0, camY: 1.08, camZ: 5.0, tgtX: 0, tgtY: 0.98, tgtZ: 0, shift: 0, parallax: 1,
  scanOn: 0, scanY: 2.1, pulse: 0, ghosts: 0, walk: 0, lookW: 0.9, pointW: 0,
  floor: 1, terrain: 0, reveal: 0, city: 0, industry: 0, rural: 0, sensors: 0, fire: 0, fireT: 0, net: 0,
  spark: 1, glyphSize: 0.036,
  lblBody: 0, lblGhost: 0, lblScan: 0, lblCursor: 0,
  lblCity: 0, lblInd: 0, lblRural: 0, lblFire: 0, lblRiver: 0, lblFig: 0,
  shade: 0, shadeRight: 0, mHero: 0, tear: 0,
  // salud
  interior: 0, skin: 1, fHeart: 0, fBrain: 0, fLesion: 0, nerves: 0, lesion: 1, vessels: 1,
  trial: 0, ecg: 0, resp: 0, hrReact: 0, clinic: 0, build: 0, explode: 0, flows: 0,
  figY: 0, figTilt: 0, focus604: 0, reachW: 0, watch: 0, trialT: 0, lesionA: 1, lesionC: 1,
  lblOrgans: 0, lblHeart: 0, lblBrain: 0, lblTrial: 0, lblClinic: 0, lblWatch: 0, lblVitals: 0, lblPatient: 0,
};

// Vista aérea común a todo el territorio
const terrainBase = { floor: 0, terrain: 1, reveal: 1, parallax: 0, lookW: 0, shade: 1, glyphSize: 0.04 };

export const KEYS = {
  inicio: () => ({ look: 'cursor', mHero: 1, tear: 1 }),

  forma: (p) => ({
    figX: 1.15, figRot: -0.42,
    camX: 0.4, camY: 1.18, camZ: 4.8, tgtX: 0.4, tgtY: 1.0,
    scanOn: 1, scanY: lerp(1.98, -0.06, ease(p * 1.1)),
    look: '#forma h2', lookW: 0.75, lblScan: 1,
  }),

  pulso: (p) => ({
    figX: -0.92, figRot: 0.38,
    camX: -0.45, camY: 1.0, camZ: 4.5, tgtX: -0.5, tgtY: 1.04,
    pulse: 1, lblBody: 1,
    look: '#pulso h2', lookW: 0.85,
    point: '#pulso h2', pointW: bell(p, 0.02, 0.62) * 0.95,
  }),

  futuro: () => ({
    figX: -1.95, figRot: Math.PI / 2,
    camX: -0.3, camY: 1.02, camZ: 6.9, tgtX: -0.3, tgtY: 0.95,
    walk: 1, ghosts: 1, lblGhost: 1, lookW: 0, parallax: 0.5,
  }),

  respuesta: () => ({
    figX: 0.88, figRot: -0.22,
    camX: 0.42, camY: 1.18, camZ: 4.5, tgtX: 0.6, tgtY: 1.06,
    look: 'cursor', lookW: 1, point: 'cursor', pointW: 1, lblCursor: 1, pulse: 0.25,
  }),

  // ---- salud: la misma figura, por dentro
  // primero mira su reloj (de ahí salen los datos); después se vuelve transparente
  salud: (p) => {
    const gesture = bell(p, 0.0, 0.62);
    const inside = ease((p - 0.32) * 2.2);
    return {
      figX: 0.95, figRot: -0.3,
      camX: lerp(0.5, 0.55, ease(p)), camY: lerp(1.3, 1.24, ease(p)), camZ: lerp(3.3, 3.4, ease(p)), tgtX: 0.62, tgtY: lerp(1.2, 1.18, ease(p)),
      reachW: gesture, watch: 1, lblWatch: bell(p, 0.06, 0.5),
      look: 'wrist', lookW: 0.25 + gesture * 0.7,
      interior: inside, skin: lerp(1, 0.32, inside), spark: 0.4,
      lblOrgans: ease((p - 0.62) * 3), parallax: 0.4,
    };
  },

  corazon: (p) => ({
    figX: 0.78, figRot: -0.22,
    camX: lerp(0.62, 0.5, p), camY: lerp(1.78, 1.7, p), camZ: lerp(1.95, 1.75, p), tgtX: 0.6, tgtY: 1.2,
    interior: 1, skin: 0.1, fHeart: 1, ecg: 1, resp: 1, lblVitals: 1, hrReact: 1, spark: 0, watch: 0.7,
    look: 'cam', lookW: 0.15, parallax: 0.3,
  }),

  cerebro: (p) => ({
    figX: 0.78, figRot: -0.22,
    camX: lerp(0.5, 0.45, ease(p)), camY: lerp(1.68, 1.25, ease(p)), camZ: lerp(1.25, 3.9, ease(p)),
    tgtX: 0.62, tgtY: lerp(1.64, 1.02, ease(p)),
    interior: 1, skin: 0.1, fBrain: 1, nerves: 1, vessels: 0.25, lblBrain: 1 - ease((p - 0.55) * 4), spark: 0,
    lookW: 0, parallax: 0.3, watch: 0.4,
  }),

  // tres gemelos, tres tratamientos; pasan los días y cada nódulo evoluciona distinto
  ensayo: (p) => {
    const tt = ease(p * 1.2);
    return {
      figX: 1.35, figRot: -0.12,
      camX: 1.35, camY: 1.2, camZ: 6.3, tgtX: 1.25, tgtY: 1.0, shift: 0.19,
      trial: 1, trialT: tt, interior: 1, skin: 0.4, fLesion: 1, vessels: 0.45,
      lesion: lerp(1, 0.22, tt), lesionA: lerp(1, 1.28, tt), lesionC: lerp(1, 0.62, tt),
      lblTrial: 1, lookW: 0, spark: 0.3,
    };
  },

  // la figura entra en la clínica, el edificio se despliega... y al final está en su cama
  clinica: (p) => {
    const walkP = Math.min(p / 0.55, 1);
    const toWide = ease(p / 0.55);
    const dive = ease((p - 0.66) / 0.26);
    const inBed = p > 0.65;
    const k = {
      clinic: 1, build: ease(p / 0.3), explode: ease((p - 0.3) / 0.25), flows: ease((p - 0.3) / 0.2) * (1 - dive * 0.7),
      lblClinic: ease((p - 0.4) * 4) * (1 - ease((p - 0.6) * 10)),
      lookW: 0, parallax: 0, shade: 0.6, glyphSize: 0.042, shift: 0.18,
    };
    if (!inBed) {
      Object.assign(k, {
        camX: lerp(24, 46, toWide), camY: lerp(10, 38, toWide), camZ: lerp(26, 62, toWide),
        tgtX: lerp(1, 2, toWide), tgtY: lerp(3, 19, toWide), tgtZ: -12,
        figX: 0, figY: 0, figZ: lerp(3.2, -0.4, walkP), figRot: Math.PI, figTilt: 0, walk: 1,
        figOpacity: 1 - ease((p - 0.56) / 0.06), floor: 0.4,
      });
    } else {
      // cama de la 604: (9,9 · 32,4 · −17,4); la figura se tumba con los pies hacia el pasillo
      Object.assign(k, {
        camX: lerp(46, 14.1, dive), camY: lerp(38, 35.3, dive), camZ: lerp(62, -16.3, dive),
        tgtX: lerp(2, 9.9, dive), tgtY: lerp(19, 32.5, dive), tgtZ: lerp(-12, -17.5, dive), focus604: dive,
        figX: 9.9, figY: 32.56, figZ: -16.5, figRot: 0, figTilt: 1, walk: 0,
        figOpacity: ease((p - 0.7) / 0.1), floor: 0,
        interior: ease((p - 0.72) / 0.12) * 0.9, skin: 0.9, ecg: ease((p - 0.78) / 0.1) * 0.8, resp: ease((p - 0.78) / 0.1) * 0.6,
        lblPatient: ease((p - 0.82) * 6), glyphSize: 0.036,
      });
    }
    return k;
  },

  territorio: (p) => ({
    ...terrainBase,
    reveal: ease(p * 1.15), floor: 1 - ease(p * 3),
    camX: lerp(2.2, 14, ease(p)), camY: lerp(2.4, 15, ease(p)), camZ: lerp(7.5, 26, ease(p)),
    tgtX: 0, tgtY: lerp(1.0, 1.5, p), tgtZ: 0, shift: 0.16 * ease(p), lblFig: ease(p * 2),
    glyphSize: lerp(0.036, 0.04, p),
  }),

  ciudades: (p) => ({
    ...terrainBase, city: 1, lblCity: 1, lblFig: 1,
    camX: lerp(52, 30, p), camY: lerp(52, 46, p), camZ: lerp(52, 66, p),
    tgtX: 0, tgtY: 3, tgtZ: -4, shift: 0.18,
  }),

  industria: (p) => ({
    ...terrainBase, city: 1, industry: 1, lblInd: 1,
    camX: lerp(70, 58, p), camY: lerp(34, 28, p), camZ: lerp(6, 14, p),
    tgtX: 50, tgtY: 3, tgtZ: -28, shift: 0.1,
  }),

  rural: (p) => ({
    ...terrainBase, city: 1, industry: 1, rural: 1, sensors: 1, lblRural: 1,
    camX: lerp(30, 22, p), camY: lerp(40, 34, p), camZ: lerp(-14, -4, p),
    tgtX: -20, tgtY: 0, tgtZ: -54, shift: 0.18,
  }),

  incendios: (p) => ({
    ...terrainBase, city: 1, industry: 1, rural: 1, sensors: 0.6, fire: 1, fireT: ease(p * 1.05), lblFire: 1, lblRiver: 1,
    camX: lerp(-14, -2, p), camY: lerp(62, 74, p), camZ: lerp(84, 96, p),
    tgtX: -54, tgtY: 0, tgtZ: 14, shift: 0.18,
  }),

  red: (p) => ({
    ...terrainBase, city: 1, industry: 1, rural: 1, sensors: 1, fire: 1, fireT: 1, net: ease(p * 1.3),
    camX: lerp(60, 30, p), camY: lerp(150, 165, p), camZ: lerp(120, 110, p),
    tgtX: -2, tgtY: 0, tgtZ: -14, shift: -0.22, shadeRight: 1, lblFig: 1,
  }),

  plataforma: () => ({
    figX: 2.5, figRot: -0.62,
    camX: 1.0, camY: 1.25, camZ: 6.6, tgtX: 0.6, tgtY: 0.98,
    look: '.steps', lookW: 0.8, spark: 1.4,
  }),

  contacto: () => ({
    figX: 1.45, figRot: -0.38,
    camX: 0.45, camY: 1.15, camZ: 4.6, tgtX: 0.45, tgtY: 1.04,
    look: '#mail', lookW: 0.7, point: '#mail', pointW: 1, pulse: 0.35,
  }),
};

// En móvil el texto va abajo: la figura se centra y sube, el territorio no se desplaza
export function mobileAdjust(s) {
  const onFigure = s.terrain < 0.5 && s.clinic < 0.5; // en la clínica la figura no se recoloca
  s.shift = 0;
  if (onFigure) {
    const keepX = s.ghosts > 0.5 ? 0.5 : 0;
    s.figX *= keepX;
    s.tgtX = s.tgtX * keepX;
    s.camX *= 0.25;
    s.camZ += 1.7 + s.ghosts * 2.6 + s.mHero * 1.1;
    s.tgtY += -0.5 + s.mHero * 0.42;
  } else if (s.terrain >= 0.5) {
    s.tgtY -= 6;
    s.camZ *= 1.15;
  }
  // escenas anchas (clínica, tres gemelos): en vertical hay que alejarse más
  const inBed = s.figTilt;
  const m = 1 + 0.95 * s.clinic * (1 - inBed * 0.55) + 1.2 * s.trial;
  if (m > 1.001) {
    s.camX = s.tgtX + (s.camX - s.tgtX) * m;
    s.camY = s.tgtY + (s.camY - s.tgtY) * m;
    s.camZ = s.tgtZ + (s.camZ - s.tgtZ) * m;
    s.tgtY -= 9 * s.clinic * (1 - inBed) + 0.35 * s.trial + 0.95 * inBed;
  }
}
