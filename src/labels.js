import * as THREE from 'three';
import { tr, lang } from './i18n.js';

// ---------------------------------------------------------------------------
// Etiquetas ancladas al mundo 3D. El texto va en HTML (nítido a cualquier
// tamaño); las líneas guía se dibujan en un lienzo 2D por encima del WebGL.
// Los valores del cuerpo se MIDEN del esqueleto en cada fotograma.
// ---------------------------------------------------------------------------

const num = (v, d = 2) => (lang === 'en' ? v.toFixed(d) : v.toFixed(d).replace('.', ','));
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _p = new THREE.Vector3();

export class Labels {
  constructor(layer, hud) {
    this.layer = layer;
    this.hud = hud;
    this.ctx = hud.getContext('2d');
    this.items = [];
    this.w = innerWidth;
    this.h = innerHeight;
    this.dpr = 1;
  }

  resize(w, h, dpr) {
    this.w = w; this.h = h; this.dpr = dpr;
    this.hud.width = Math.round(w * dpr);
    this.hud.height = Math.round(h * dpr);
  }

  add(def) {
    const el = document.createElement('div');
    el.className = 'lbl' + (def.side < 0 ? ' lbl--r' : '') + (def.cls ? ' ' + def.cls : '');
    this.layer.appendChild(el);
    this.items.push({ ...def, el, html: '', lastText: -1 });
  }

  build({ figure, main, ghosts, territory, clinic, rings, ZONES, terrainH, riverX, vitals }) {
    this.vitals = vitals;
    const B = main.bones;
    const wp = (bone, out = new THREE.Vector3()) => bone.getWorldPosition(out);
    let prevHand = null;
    let handSpeed = 0;
    this.main = main;

    // --- medidas del cuerpo (sección 02)
    this.add({
      key: 'lblBody', side: -1, dx: 44, dy: -26,
      anchor: (o) => wp(B.HeadTop_End, o),
      text: () => {
        const y = B.HeadTop_End.getWorldPosition(_a).y;
        return tr(`Cabeza <b>${num(y)} m</b><small>altura sobre el suelo</small>`, `Head <b>${num(y)} m</b><small>height above ground</small>`);
      },
    });
    this.add({
      key: 'lblBody', side: -1, dx: 90, dy: -10,
      anchor: (o) => wp(B.Spine1, o),
      text: () => {
        wp(B.Hips, _a); wp(B.Neck, _b);
        const v = _b.sub(_a).normalize();
        const deg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(v.y, -1, 1)));
        return tr(`Torso <b>${num(deg, 1)}°</b><small>inclinación</small>`, `Torso <b>${num(deg, 1)}°</b><small>tilt</small>`);
      },
    });
    this.add({
      key: 'lblBody', side: -1, dx: 52, dy: -18,
      anchor: (o) => wp(B.RightHand, o),
      text: (dt) => {
        wp(B.RightHand, _a);
        if (prevHand && dt > 0) {
          const s = _a.distanceTo(prevHand) / dt;
          handSpeed += (s - handSpeed) * 0.08;
        }
        prevHand = (prevHand || new THREE.Vector3()).copy(_a);
        return tr(`Mano D. <b>${num(handSpeed * 100, 1)} cm/s</b><small>velocidad</small>`, `R. hand <b>${num(handSpeed * 100, 1)} cm/s</b><small>speed</small>`);
      },
      live: true,
    });
    this.add({
      key: 'lblBody', side: 1, dx: 56, dy: -12,
      anchor: (o) => wp(B.LeftLeg, o),
      text: () => {
        wp(B.LeftUpLeg, _a); wp(B.LeftLeg, _b); wp(B.LeftFoot, _c);
        const u = _a.sub(_b).normalize();
        const v = _c.sub(_b).normalize();
        const deg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(u.dot(v), -1, 1)));
        return tr(`Rodilla I. <b>${num(deg, 1)}°</b><small>flexión</small>`, `L. knee <b>${num(deg, 1)}°</b><small>flexion</small>`);
      },
    });
    this.add({
      key: 'lblBody', side: -1, dx: 46, dy: 22,
      anchor: (o) => wp(B.RightFoot, o),
      text: () => {
        wp(B.Hips, _a); wp(B.LeftFoot, _b); wp(B.RightFoot, _c);
        const seg = _c.clone().sub(_b);
        const t = THREE.MathUtils.clamp(_a.sub(_b).dot(seg) / Math.max(seg.lengthSq(), 1e-6), 0, 1);
        return tr(`Apoyo <b>${Math.round(t * 100)} % D</b><small>reparto de carga</small>`, `Stance <b>${Math.round(t * 100)}% R</b><small>load split</small>`);
      },
    });

    // --- simulación (sección 03): cada fantasma, su instante
    this.add({
      key: 'lblGhost', side: 0, dy: -30, cls: 'lbl--lc',
      anchor: (o) => { wp(B.HeadTop_End, o); o.y += 0.08; return o; },
      text: () => tr(`t<sub>0</sub> <b>ahora</b>`, `t<sub>0</sub> <b>now</b>`),
    });
    ghosts.forEach((g) => {
      this.add({
        key: 'lblGhost', side: 0, dy: -30, cls: 'lbl--lc',
        weight: () => g.opacity,
        anchor: (o) => { wp(g.bones.HeadTop_End, o); o.y += 0.08; return o; },
        text: () => `t+${num(g.k * 0.3, 1)} s`,
      });
    });

    // --- escaneo (sección 01)
    this.scanItem = {
      key: 'lblScan', side: 1, dx: 30, dy: 0,
      anchor: (o, S) => o.set(S.figX + 0.42, S.scanY, S.figZ),
      text: (dt, S) => `z = <b>${num(Math.max(S.scanY, 0), 3)} m</b><small>${S.scanY > 0.02 ? tr('capturando', 'capturing') : tr('réplica completa', 'replica complete')}</small>`,
      live: true,
    };
    this.add(this.scanItem);

    // --- territorio
    const H = (x, z, lift) => terrainH(x, z) + lift;
    this.add({
      key: 'lblFig', side: 1, dx: 40, dy: -46,
      anchor: (o) => o.set(0, 1.9, 0),
      text: () => tr(`Sujeto 001<small>la misma réplica, a escala</small>`, `Subject 001<small>the same replica, to scale</small>`),
    });
    this.add({
      key: 'lblCity', side: 1, dx: 50, dy: -60,
      anchor: (o) => o.set(-6, 15, -10),
      text: () => tr(`Ciudad<small>edificación · viario · movilidad</small>`, `City<small>buildings · roads · mobility</small>`),
      cls: 'lbl--zone',
    });
    this.add({
      key: 'lblInd', side: 1, dx: 40, dy: -90, cls: 'lbl--heat lbl--zone',
      anchor: (o) => o.copy(territory.alarmTop),
      text: () => tr(`Depósito 05 <b>fallo previsto</b><small>vibración fuera de rango · margen 72 h</small>`, `Tank 05 <b>failure predicted</b><small>vibration out of range · 72 h margin</small>`),
    });
    this.add({
      key: 'lblRural', side: 1, dx: 46, dy: -50, cls: 'lbl--zone',
      anchor: (o) => o.set(territory.sensors[0].x, H(territory.sensors[0].x, territory.sensors[0].y, 0.5), territory.sensors[0].y),
      text: () => tr(`Red de sensores <b>8 nodos</b><small>humedad · caudal · temperatura</small>`, `Sensor network <b>8 nodes</b><small>humidity · flow · temperature</small>`),
    });
    this.add({
      key: 'lblFire', side: 1, dx: 50, dy: -56, cls: 'lbl--heat lbl--zone',
      anchor: (o) => o.set(ZONES.fire.x, H(ZONES.fire.x, ZONES.fire.y, 1), ZONES.fire.y),
      text: () => tr(`Foco <b>activo</b><small>viento del oeste · 18 km/h</small>`, `Fire <b>active</b><small>westerly wind · 18 km/h</small>`),
    });
    this.add({
      key: 'lblRiver', side: -1, dx: 46, dy: -40, cls: 'lbl--zone',
      anchor: (o) => o.set(riverX(30), H(riverX(30), 30, 0.5), 30),
      text: () => tr(`Río<small>cortafuegos natural</small>`, `River<small>natural firebreak</small>`),
    });

    // --- salud: órganos anclados a sus huesos
    const org = (name) => (o) => {
      const a = figure.anchors[name];
      return o.copy(a.local).applyMatrix4(main.bones[a.bone].matrixWorld);
    };
    this.heartAnchor = org('heart');
    this.add({
      key: 'lblOrgans', side: 1, dx: 64, dy: -56, anchor: org('heart'),
      text: () => tr(`Corazón <b>${Math.round(vitals.bpm)} lpm</b><small>≈ 100.000 latidos al día</small>`, `Heart <b>${Math.round(vitals.bpm)} bpm</b><small>≈ 100,000 beats a day</small>`),
    });
    this.add({
      key: 'lblOrgans', side: -1, dx: 70, dy: -30, anchor: org('lung'),
      text: () => tr(`Pulmones <b>${Math.round(vitals.rpm)} rpm</b><small>respiraciones por minuto</small>`, `Lungs <b>${Math.round(vitals.rpm)}/min</b><small>breaths per minute</small>`),
    });
    this.add({
      key: 'lblOrgans', side: 1, dx: 54, dy: -34, anchor: org('brain'),
      text: () => tr(`Cerebro<small>actividad en tiempo real</small>`, `Brain<small>real-time activity</small>`),
    });
    this.add({
      key: 'lblOrgans', side: 1, dx: 60, dy: 30, anchor: org('spine'),
      text: () => tr(`Columna<small>24 vértebras</small>`, `Spine<small>24 vertebrae</small>`),
    });
    this.add({
      key: 'lblOrgans', side: -1, dx: 40, dy: 34, anchor: org('vessel'),
      text: () => tr(`Sistema circulatorio<small>la onda sale con cada latido</small>`, `Circulatory system<small>a pulse wave leaves with every beat</small>`),
    });
    this.add({
      key: 'lblHeart', side: 1, dx: 90, dy: -110, anchor: org('heart'),
      text: () => tr(`Ritmo cardiaco <b>${Math.round(vitals.bpm)} lpm</b><small>ritmo sinusal · datos simulados</small>`, `Heart rate <b>${Math.round(vitals.bpm)} bpm</b><small>sinus rhythm · simulated data</small>`),
    });
    this.add({
      key: 'lblBrain', side: 1, dx: 90, dy: -80, anchor: org('brain'),
      text: () => tr(`Cerebro <b>86.000 M</b><small>neuronas · señales a más de 100 m/s</small>`, `Brain <b>86 billion</b><small>neurons · signals faster than 100 m/s</small>`),
    });
    this.add({
      key: 'lblTrial', side: 1, dx: 50, dy: 40, anchor: org('lesion'), cls: 'lbl--heat',
      text: (dt, S) => `${tr('Nódulo', 'Nodule')} <b>${num(16 * S.lesion, 1)} mm</b><small>${S.lesion < 0.5 ? tr('remite con el tratamiento B', 'shrinking under treatment B') : tr('evolución simulada', 'simulated course')}</small>`,
    });
    const mm = (v) => num(16 * v, 1);
    const trialTag = [
      { k: 0, html: (S) => tr(`Tratamiento B <b>83 %</b><small>nódulo ${mm(S.lesion)} mm · el elegido</small>`, `Treatment B <b>83%</b><small>nodule ${mm(S.lesion)} mm · the chosen one</small>`) },
      { k: 1, html: (S) => tr(`Tratamiento A <b>41 %</b><small>nódulo ${mm(S.lesionA)} mm</small>`, `Treatment A <b>41%</b><small>nodule ${mm(S.lesionA)} mm</small>`) },
      { k: 2, html: (S) => tr(`Tratamiento C <b>62 %</b><small>nódulo ${mm(S.lesionC)} mm</small>`, `Treatment C <b>62%</b><small>nodule ${mm(S.lesionC)} mm</small>`) },
    ];
    for (const tg of trialTag) {
      const inst = tg.k === 0 ? main : ghosts[tg.k - 1];
      this.add({
        key: 'lblTrial', side: 0, dy: -30, dyM: [-30, -84, -138][tg.k], cls: 'lbl--lc',
        weight: tg.k === 0 ? undefined : () => inst.opacity / 0.62,
        anchor: (o) => { inst.bones.HeadTop_End.getWorldPosition(o); o.y += 0.1; return o; },
        text: (dt, S) => tg.html(S),
      });
    }
    this.add({
      key: 'lblTrial', side: 1, dx: 30, dy: 26, cls: 'lbl--lc',
      anchor: (o) => { main.bones.RightFoot.getWorldPosition(o); o.y = 0.02; return o; },
      text: (dt, S) => tr(`Día <b>${Math.round(S.trialT * 90)}</b> de 90<small>evolución simulada en cada gemelo</small>`, `Day <b>${Math.round(S.trialT * 90)}</b> of 90<small>simulated course in each twin</small>`),
    });

    // --- reloj, monitor de constantes y paciente
    this.add({
      key: 'lblWatch', side: 1, dx: 60, dy: -46, anchor: org('watch'),
      text: () => tr(`Reloj del paciente <b>${Math.round(vitals.bpm)} lpm</b><small>sincronizado con su gemelo</small>`, `Patient’s watch <b>${Math.round(vitals.bpm)} bpm</b><small>synced with their twin</small>`),
    });
    this.add({
      key: 'lblVitals', side: 1, dx: 120, dy: -40,
      anchor: (o) => rings.pen(o),
      text: () => {
        const hrv = Math.round(52 - (vitals.bpm - 66) * 0.5);
        return tr(`Frecuencia <b>${Math.round(vitals.bpm)} lpm</b><small>VFC ${hrv} ms · SpO₂ 98 % · resp. ${Math.round(vitals.rpm)} rpm</small><small>presión 118/76 · datos simulados</small>`, `Heart rate <b>${Math.round(vitals.bpm)} bpm</b><small>HRV ${hrv} ms · SpO₂ 98% · resp. ${Math.round(vitals.rpm)}/min</small><small>BP 118/76 · simulated data</small>`);
      },
    });
    this.add({
      key: 'lblPatient', side: 1, dx: 60, dy: -70,
      anchor: (o) => main.bones.HeadTop_End.getWorldPosition(o),
      text: () => tr(`Paciente 001 · hab. 604 <b>estable</b><small>alta prevista mañana a las 10:00</small><small>después, seguimiento en casa con su gemelo</small>`, `Patient 001 · room 604 <b>stable</b><small>discharge planned tomorrow at 10:00</small><small>then home follow-up with their twin</small>`),
    });

    // --- la clínica: todo lo que dicen sale de la propia simulación
    this.add({
      key: 'lblClinic', side: -1, dx: 40, dy: -60,
      anchor: (o) => clinic.at(clinic.orPos[1], 1, o),
      text: (dt, S, x) => {
        const left = 18 - Math.floor((x.t / 3) % 18);
        return tr(`Quirófano 2 <b>en uso</b><small>libre en ${left} min · el 4 se está preparando</small>`, `Theatre 2 <b>in use</b><small>free in ${left} min · theatre 4 being prepared</small>`);
      },
    });
    this.add({
      key: 'lblClinic', side: 1, dx: 50, dy: -50,
      anchor: (o) => clinic.at(clinic.roomPos, 6, o),
      text: (dt, S, x) => {
        const c = clinic.census(x.t);
        return tr(`Hospitalización <b>${Math.round((c.busy / c.total) * 100)} %</b><small>${c.total} camas · ${c.dis} ${c.dis === 1 ? 'alta' : 'altas'} en curso · ${c.cln} en limpieza</small>`, `Wards <b>${Math.round((c.busy / c.total) * 100)}%</b><small>${c.total} beds · ${c.dis} ${c.dis === 1 ? 'discharge' : 'discharges'} under way · ${c.cln} being cleaned</small>`);
      },
    });
    this.add({
      key: 'lblClinic', side: -1, dx: 46, dy: 40,
      anchor: (o) => clinic.at(clinic.erPos, 0, o),
      text: (dt, S, x) => { const w = 11 + Math.round(Math.sin(x.t * 0.13) * 2 + 2); return tr(`Urgencias <b>espera ${w} min</b><small>pico previsto a las 19:00</small>`, `A&amp;E <b>${w} min wait</b><small>peak expected at 19:00</small>`); },
    });
    this.add({
      key: 'lblClinic', side: -1, dx: 40, dy: -44,
      anchor: (o) => o.copy(clinic.ambPos || clinic.erPos),
      text: () => clinic.amb.parked ? tr(`Ambulancia 2 <b>en urgencias</b><small>paciente en triaje</small>`, `Ambulance 2 <b>at A&amp;E</b><small>patient in triage</small>`) : tr(`Ambulancia 2 <b>llega en ${clinic.amb.eta} s</b><small>box 3 preparado</small>`, `Ambulance 2 <b>arriving in ${clinic.amb.eta} s</b><small>bay 3 ready</small>`),
    });
    this.add({
      key: 'lblClinic', side: 1, dx: 40, dy: -40,
      anchor: (o) => clinic.at(clinic.heliPos, 8, o),
      text: () => tr(`Helipuerto<small>sin operaciones previstas</small>`, `Helipad<small>no operations scheduled</small>`),
    });

    // --- cursor (sección 04)
    this.cursorItem = {
      key: 'lblCursor', side: 1, dx: 18, dy: -18, screen: true,
      text: (dt, S, x) => `${tr('objetivo', 'target')}<small>x ${num(x.target.x)} · y ${num(x.target.y)} m</small>`,
      live: true,
    };
    this.add(this.cursorItem);
  }

  update(S, camera, dt, extra) {
    const { ctx, w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const tick = extra.now;

    // línea de escaneo a lo ancho de la figura
    if (S.lblScan > 0.01 && S.scanOn > 0.05) {
      const a = _a.set(S.figX - 0.55, S.scanY, S.figZ).project(camera);
      const b = _b.set(S.figX + 0.42, S.scanY, S.figZ).project(camera);
      const x0 = (a.x + 1) * 0.5 * w, x1 = (b.x + 1) * 0.5 * w, y = (1 - a.y) * 0.5 * h;
      ctx.globalAlpha = S.lblScan * 0.55;
      ctx.strokeStyle = '#3b93ec';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i <= 10; i++) {
        const xx = x0 + ((x1 - x0) * i) / 10;
        ctx.beginPath(); ctx.moveTo(xx, y - (i % 5 === 0 ? 5 : 2.5)); ctx.lineTo(xx, y + (i % 5 === 0 ? 5 : 2.5)); ctx.stroke();
      }
    }

    for (const it of this.items) {
      let wgt = S[it.key] ?? 0;
      if (it.weight) wgt *= Math.min(1, it.weight() * 1.6);
      if (wgt < 0.01) {
        if (it.shown) { it.el.style.opacity = '0'; it.shown = false; }
        continue;
      }
      let x, y;
      if (it.screen) {
        if (!extra.pointerSeen) { it.el.style.opacity = '0'; it.shown = false; continue; }
        x = (extra.mouse.x + 1) * 0.5 * w;
        y = (1 - extra.mouse.y) * 0.5 * h;
      } else {
        it.anchor(_p, S);
        const pr = _p.clone().project(camera);
        if (pr.z > 1 || pr.z < -1) { it.el.style.opacity = '0'; it.shown = false; continue; }
        x = (pr.x + 1) * 0.5 * w;
        y = (1 - pr.y) * 0.5 * h;
      }
      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) { it.el.style.opacity = '0'; it.shown = false; continue; }

      // texto: los valores se refrescan a 12 Hz para que se puedan leer
      const due = tick - it.lastText > 0.083 || !it.html;
      if (it.live || due) {
        const html = it.text(dt, S, { target: extra.pointTarget || _c.set(0, 0, 0), t: extra.now });
        if (due) {
          if (html !== it.html) { it.el.innerHTML = html; it.html = html; }
          it.lastText = tick;
        }
      }

      const heat = it.cls && it.cls.includes('heat');
      ctx.globalAlpha = wgt * 0.75;
      ctx.strokeStyle = heat ? '#ff6a2b' : 'rgba(233,231,226,0.8)';
      ctx.lineWidth = 1;
      let tx, ty;
      if (it.side === 0) {
        // en pantallas estrechas, los rótulos centrados que estarían juntos se escalonan
        const ey = y + (w < 820 && it.dyM !== undefined ? it.dyM : it.dy);
        ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x, ey); ctx.stroke();
        tx = x; ty = ey - 16;
        it.el.style.transform = `translate3d(${tx}px, ${ty}px, 0) translateX(-50%)`;
      } else {
        // si no cabe por su lado, se da la vuelta
        const lw = it.el.offsetWidth || 120;
        let side = it.side;
        const dxs = it.dx * Math.min(1, w / 1000);
        const reach = dxs + 22 + lw;
        if (side < 0 && x - reach < 10) side = 1;
        else if (side > 0 && x + reach > w - 10) side = -1;
        if (side !== it.curSide) { it.el.classList.toggle('lbl--r', side < 0); it.curSide = side; }
        const ex = x + side * dxs, ey = y + it.dy;
        const hx = ex + side * 16;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.lineTo(hx, ey); ctx.stroke();
        tx = hx + side * 6; ty = ey - 8;
        // nunca fuera de la pantalla
        if (side > 0) tx = Math.min(tx, w - 8 - lw); else tx = Math.max(tx, 8 + lw);
        it.el.style.transform = side > 0
          ? `translate3d(${tx}px, ${ty}px, 0)`
          : `translate3d(${tx}px, ${ty}px, 0) translateX(-100%)`;
      }
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.stroke();
      if (it.screen) {
        ctx.beginPath();
        ctx.moveTo(x - 9, y); ctx.lineTo(x - 5, y); ctx.moveTo(x + 5, y); ctx.lineTo(x + 9, y);
        ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 5); ctx.moveTo(x, y + 5); ctx.lineTo(x, y + 9);
        ctx.stroke();
      }
      it.el.style.opacity = wgt.toFixed(3);
      it.shown = true;
    }
    ctx.globalAlpha = 1;
  }
}
