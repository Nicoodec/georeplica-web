// Palabras que suben tras una máscara, y rótulos que se "decodifican":
// cada letra pasa por 0 y 1 antes de quedarse quieta.

export function splitEl(el) {
  const text = el.textContent.trim();
  const words = text.split(/\s+/);
  el.setAttribute('aria-label', text);
  el.innerHTML = words
    .map((w, i) => `<span class="w" aria-hidden="true"><span style="--i:${i}">${w}</span></span>`)
    .join(' ');
}

export function prepScramble(el) {
  const nodes = [];
  const walk = (n) => {
    for (const c of n.childNodes) {
      if (c.nodeType === 3 && c.textContent.trim()) nodes.push({ node: c, text: c.textContent });
      else if (c.nodeType === 1 && !c.id) walk(c);
    }
  };
  walk(el);
  el._scr = nodes;
}

export function initText() {
  document.querySelectorAll('[data-split]').forEach(splitEl);
  document.querySelectorAll('[data-scramble]').forEach(prepScramble);
}

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export function scramble(el) {
  if (!el._scr || reduced) return;
  const start = performance.now();
  const total = el._scr.reduce((s, n) => s + n.text.length, 0);
  const dur = Math.min(260 + total * 18, 900);
  cancelAnimationFrame(el._raf);
  const step = (now) => {
    const t = (now - start) / dur;
    let offset = 0;
    for (const n of el._scr) {
      let out = '';
      for (let i = 0; i < n.text.length; i++) {
        const ch = n.text[i];
        const at = (offset + i) / total;
        if (ch === ' ' || ch === ' ' || t > at * 0.85 + 0.15) out += ch;
        else out += Math.random() < 0.5 ? '0' : '1';
      }
      offset += n.text.length;
      n.node.textContent = out;
    }
    if (t < 1) el._raf = requestAnimationFrame(step);
    else for (const n of el._scr) n.node.textContent = n.text;
  };
  el._raf = requestAnimationFrame(step);
}
