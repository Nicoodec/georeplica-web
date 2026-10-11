import './legal.css';

// Mismo idioma que la web principal: lo comparten por localStorage y por ?lang=
const html = document.documentElement;
const TITLES = JSON.parse(document.getElementById('titles').textContent);

function apply(l) {
  html.lang = l;
  document.title = TITLES[l];
  document.querySelectorAll('.lang__opt').forEach((b) => {
    const on = b.dataset.l === l;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  // los enlaces internos llevan el idioma, para quien llega sin localStorage
  document.querySelectorAll('a[data-keep-lang]').forEach((a) => {
    const base = a.getAttribute('href').split('?')[0];
    a.setAttribute('href', l === 'en' ? `${base}?lang=en` : base);
  });
}

let saved = null;
try { saved = localStorage.getItem('gr-lang'); } catch (e) { /* sin almacenamiento */ }
const q = new URLSearchParams(location.search).get('lang');
apply(q === 'en' || q === 'es' ? q : saved === 'en' ? 'en' : 'es');

document.querySelector('.lang').addEventListener('click', (e) => {
  const opt = e.target.closest('[data-l]');
  if (!opt) return;
  apply(opt.dataset.l);
  try { localStorage.setItem('gr-lang', opt.dataset.l); } catch (err) { /* sin almacenamiento */ }
});
