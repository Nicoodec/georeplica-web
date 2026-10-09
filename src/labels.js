import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Etiquetas ancladas al mundo 3D. El texto va en HTML (nítido a cualquier
// tamaño); las líneas guía se dibujan en un lienzo 2D por encima del WebGL.
// Los valores del cuerpo se MIDEN del esqueleto en cada fotograma.
// ---------------------------------------------------------------------------

const num = (v, d = 2) => v.toFixed(d).replace('.', ',');
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

  build({ figure, main, ghosts, territory, clinic, ZONES, terrainH, riverX, vitals }) {
    this.vitals = vitals;
    this.ecg = [];
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
        return `Cabeza <b>${num(y)} m</b><small>altura sobre el suelo</small>`;
      },
    });
    this.add({
      key: 'lblBody', side: -1, dx: 90, dy: -10,
      anchor: (o) => wp(B.Spine1, o),
      text: () => {
        wp(B.Hips, _a); wp(B.Neck, _b);
        const v = _b.sub(_a).normalize();
        const deg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(v.y, -1, 1)));
        return `Torso <b>${num(deg, 1)}°</b><small>inclinación</small>`;
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
        return `Mano D. <b>${num(handSpeed * 100, 1)} cm/s</b><small>velocidad</small>`;
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
        return `Rodilla I. <b>${num(deg, 1)}°</b><small>flexión</small>`;
      },
    });
    this.add({
      key: 'lblBody', side: -1, dx: 46, dy: 22,
      anchor: (o) => wp(B.RightFoot, o),
      text: () => {
        wp(B.Hips, _a); wp(B.LeftFoot, _b); wp(B.RightFoot, _c);
        const seg = _c.clone().sub(_b);
        const t = THREE.MathUtils.clamp(_a.sub(_b).dot(seg) / Math.max(seg.lengthSq(), 1e-6), 0, 1);
        return `Apoyo <b>${Math.round(t * 100)} % D</b><small>reparto de carga</small>`;
      },
    });

    // --- simulación (sección 03): cada fantasma, su instante
    this.add({
      key: 'lblGhost', side: 0, dy: -30, cls: 'lbl--lc',
      anchor: (o) => { wp(B.HeadTop_End, o); o.y += 0.08; return o; },
      text: () => `t<sub>0</sub> <b>ahora</b>`,
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
      text: (dt, S) => `z = <b>${num(Math.max(S.scanY, 0), 3)} m</b><small>${S.scanY > 0.02 ? 'capturando' : 'réplica completa'}</small>`,
      live: true,
    };
    this.add(this.scanItem);

    // --- territorio
    const H = (x, z, lift) => terrainH(x, z) + lift;
    this.add({
      key: 'lblFig', side: 1, dx: 40, dy: -46,
      anchor: (o) => o.set(0, 1.9, 0),
      text: () => `Sujeto 001<small>la misma réplica, a escala</small>`,
    });
    this.add({
      key: 'lblCity', side: 1, dx: 50, dy: -60,
      anchor: (o) => o.set(-6, 15, -10),
      text: () => `Ciudad<small>edificación · viario · movilidad</small>`,
      cls: 'lbl--zone',
    });
    this.add({
      key: 'lblInd', side: 1, dx: 40, dy: -90, cls: 'lbl--heat lbl--zone',
      anchor: (o) => o.copy(territory.alarmTop),
      text: () => `Depósito 05 <b>fallo previsto</b><small>vibración fuera de rango · margen 72 h</small>`,
    });
    this.add({
      key: 'lblRural', side: 1, dx: 46, dy: -50, cls: 'lbl--zone',
      anchor: (o) => o.set(territory.sensors[0].x, H(territory.sensors[0].x, territory.sensors[0].y, 0.5), territory.sensors[0].y),
      text: () => `Red de sensores <b>8 nodos</b><small>humedad · caudal · temperatura</small>`,
    });
    this.add({
      key: 'lblFire', side: 1, dx: 50, dy: -56, cls: 'lbl--heat lbl--zone',
      anchor: (o) => o.set(ZONES.fire.x, H(ZONES.fire.x, ZONES.fire.y, 1), ZONES.fire.y),
      text: () => `Foco <b>activo</b><small>viento del oeste · 18 km/h</small>`,
    });
    this.add({
      key: 'lblRiver', side: -1, dx: 46, dy: -40, cls: 'lbl--zone',
      anchor: (o) => o.set(riverX(30), H(riverX(30), 30, 0.5), 30),
      text: () => `Río<small>cortafuegos natural</small>`,
    });

    // --- salud: órganos anclados a sus huesos
    const org = (name) => (o) => {
      const a = figure.anchors[name];
      return o.copy(a.local).applyMatrix4(main.bones[a.bone].matrixWorld);
    };
    this.heartAnchor = org('heart');
    this.add({
      key: 'lblOrgans', side: 1, dx: 64, dy: -56, anchor: org('heart'),
      text: () => `Corazón <b>${Math.round(vitals.bpm)} lpm</b><small>≈ 100.000 latidos al día</small>`,
    });
    this.add({
      key: 'lblOrgans', side: -1, dx: 70, dy: -30, anchor: org('lung'),
      text: () => `Pulmones <b>${Math.round(vitals.rpm)} rpm</b><small>respiraciones por minuto</small>`,
    });
    this.add({
      key: 'lblOrgans', side: 1, dx: 54, dy: -34, anchor: org('brain'),
      text: () => `Cerebro<small>actividad en tiempo real</small>`,
    });
    this.add({
      key: 'lblOrgans', side: 1, dx: 60, dy: 30, anchor: org('spine'),
      text: () => `Columna<small>24 vértebras</small>`,
    });
    this.add({
      key: 'lblOrgans', side: -1, dx: 40, dy: 34, anchor: org('vessel'),
      text: () => `Sistema circulatorio<small>la onda sale con cada latido</small>`,
    });
    this.add({
      key: 'lblHeart', side: 1, dx: 90, dy: -110, anchor: org('heart'),
      text: () => `Ritmo cardiaco <b>${Math.round(vitals.bpm)} lpm</b><small>ritmo sinusal · datos simulados</small>`,
    });
    this.add({
      key: 'lblBrain', side: 1, dx: 90, dy: -80, anchor: org('brain'),
      text: () => `Cerebro <b>86.000 M</b><small>neuronas · señales a más de 100 m/s</small>`,
    });
    this.add({
      key: 'lblTrial', side: 1, dx: 50, dy: 40, anchor: org('lesion'), cls: 'lbl--heat',
      text: (dt, S) => `Nódulo <b>${num(16 * S.lesion, 1)} mm</b><small>${S.lesion < 0.5 ? 'remite con el tratamiento B' : 'evolución simulada'}</small>`,
    });
    const trialTag = [
      { k: 0, html: 'Tratamiento B <b>83 %</b><small>respuesta prevista · elegido</small>' },
      { k: 1, html: 'Tratamiento A <b>41 %</b><small>respuesta prevista</small>' },
      { k: 2, html: 'Tratamiento C <b>62 %</b><small>respuesta prevista</small>' },
    ];
    for (const tg of trialTag) {
      const inst = tg.k === 0 ? main : ghosts[tg.k - 1];
      this.add({
        key: 'lblTrial', side: 0, dy: -30, cls: 'lbl--lc',
        weight: tg.k === 0 ? undefined : () => inst.opacity / 0.62,
        anchor: (o) => { inst.bones.HeadTop_End.getWorldPosition(o); o.y += 0.1; return o; },
        text: () => tg.html,
      });
    }

    // --- la clínica
    this.add({
      key: 'lblClinic', side: -1, dx: 40, dy: -60,
      anchor: (o) => clinic.at(clinic.orPos[1], 1, o),
      text: () => `Quirófano 2 <b>en uso</b><small>libre en 18 min · previsión</small>`,
    });
    this.add({
      key: 'lblClinic', side: 1, dx: 50, dy: -50,
      anchor: (o) => clinic.at(clinic.roomPos, 6, o),
      text: () => {
        const b = clinic.beds;
        return `Hospitalización <b>${Math.round((b.busy / b.total) * 100)} %</b><small>${b.total} camas · ${b.total - b.busy} libres</small>`;
      },
    });
    this.add({
      key: 'lblClinic', side: -1, dx: 46, dy: 40,
      anchor: (o) => clinic.at(clinic.erPos, 0, o),
      text: () => `Urgencias <b>espera 12 min</b><small>pico previsto a las 19:00</small>`,
    });
    this.add({
      key: 'lblClinic', side: 1, dx: 40, dy: -40,
      anchor: (o) => clinic.at(clinic.heliPos, 8, o),
      text: () => `Helipuerto<small>traslado en curso · 6 min</small>`,
    });

    // --- cursor (sección 04)
    this.cursorItem = {
      key: 'lblCursor', side: 1, dx: 18, dy: -18, screen: true,
      text: (dt, S, x) => `objetivo<small>x ${num(x.target.x)} · y ${num(x.target.y)} m</small>`,
      live: true,
    };
    this.add(this.cursorItem);
  }

  update(S, camera, dt, extra) {
    const { ctx, w, h, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const tick = extra.now;

    // electrocardiograma: se dibuja con el mismo latido que mueve el corazón
    if (this.vitals) {
      const ph = this.vitals.phase % 1;
      const g = (x, m, w) => Math.exp(-(((x - m) / w) ** 2));
      const v = 0.1 * g(ph, 0.13, 0.025) - 0.12 * g(ph, 0.235, 0.008) + g(ph, 0.255, 0.009) - 0.28 * g(ph, 0.275, 0.01) + 0.28 * g(ph, 0.47, 0.04);
      this.ecg.push([tick, v]);
      while (this.ecg.length && tick - this.ecg[0][0] > 2.8) this.ecg.shift();
    }
    if (S.ecg > 0.01 && this.heartAnchor) {
      const hp = this.heartAnchor(_a).project(camera);
      const hx = (hp.x + 1) * 0.5 * w, hy = (1 - hp.y) * 0.5 * h;
      const bw = Math.min(300, w * 0.26), bh = 70;
      const x0 = Math.min(hx + 60, w - bw - 24), y0 = Math.min(hy + 50, h - bh - 60);
      ctx.globalAlpha = S.ecg * 0.35;
      ctx.strokeStyle = 'rgba(233,231,226,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) { const xx = x0 + (bw * i) / 10; ctx.beginPath(); ctx.moveTo(xx, y0); ctx.lineTo(xx, y0 + bh); ctx.stroke(); }
      for (let i = 0; i <= 4; i++) { const yy = y0 + (bh * i) / 4; ctx.beginPath(); ctx.moveTo(x0, yy); ctx.lineTo(x0 + bw, yy); ctx.stroke(); }
      ctx.globalAlpha = S.ecg;
      ctx.strokeStyle = '#3b93ec';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      this.ecg.forEach(([tt, vv], i) => {
        const xx = x0 + bw - ((tick - tt) / 2.8) * bw;
        const yy = y0 + bh * 0.68 - vv * bh * 0.6;
        if (i === 0) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy);
      });
      ctx.stroke();
      const lastV = this.ecg.length ? this.ecg[this.ecg.length - 1][1] : 0;
      ctx.fillStyle = '#9fcbff';
      ctx.beginPath(); ctx.arc(x0 + bw, y0 + bh * 0.68 - lastV * bh * 0.6, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }

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
        const html = it.text(dt, S, { target: extra.pointTarget || _c.set(0, 0, 0) });
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
        const ey = y + it.dy;
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
