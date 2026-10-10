// ---------------------------------------------------------------------------
// Idioma. El castellano se lee del propio HTML al arrancar; aquí solo vive el
// inglés. Los elementos traducibles llevan data-i18n="clave". Las etiquetas
// que flotan sobre la figura usan tr(es, en) y se traducen solas.
// ---------------------------------------------------------------------------

export let lang = 'es';
export const tr = (es, en) => (lang === 'en' ? en : es);

const EN = {
  boot: 'Loading replica',
  coord: '42.3439° N&nbsp;&nbsp;3.6969° W',
  navTwin: 'Twin', navHealth: 'Health', navTerritory: 'Territory', navPlatform: 'Platform', navContact: 'Contact',
  heroTag: 'Subject 001 &mdash; live replica &mdash; <span id="ptsCount">0</span> points',
  heroTitle: 'Everything that exists can have a twin.',
  heroText: 'Digital twins connected in real time to people, clinics, cities and territories. An exact copy of the physical world that doesn’t just show it: it understands it, anticipates it and improves it.',
  heroScroll: 'Scroll. It will show you.',

  formaK: '<b>01</b> Capture',
  formaH: 'First, the shape.',
  formaP: 'Every physical object leaves a measurable trace: geometry, position, materials, temperature. We capture it with LiDAR, photogrammetry, sensors and GIS mapping, and rebuild it point by point in the same coordinate system as the original.',
  formaSpec: '<div><dt>Sources</dt><dd>LiDAR · GIS · IoT · satellite</dd></div><div><dt>Reference</dt><dd>ETRS89 / UTM 30N</dd></div><div><dt>This figure</dt><dd><span data-pts>0</span> points, recomputed every frame</dd></div>',

  pulsoK: '<b>02</b> Real time',
  pulsoH: 'Then, the pulse.',
  pulsoP: 'A twin without live data is just a scale model. Ours is continuously connected to the physical asset: when the original moves, heats up or fails, the replica knows that very instant.',
  pulsoN: 'The figures floating over the body aren’t decoration. They’re computed every frame from its skeleton.',

  futuroK: '<b>03</b> Simulation',
  futuroH: 'Next, what hasn’t happened yet.',
  futuroP: 'With the real state of the asset we rehearse scenarios before they happen: how a power grid will cope with a heatwave, when a machine will fail, where a wildfire will spread. Prediction and prescription, not just visualisation.',
  futuroN: 'Like Marey’s chronophotography in 1882, but forwards: each blue silhouette is a moment that hasn’t happened yet.',

  respK: '<b>04</b> Two-way feedback',
  respH: 'And finally, the response.',
  respP: 'The replica doesn’t just watch. It decides, and sends that decision back to the physical world: it adjusts a traffic light, regulates a valve, reschedules a shift. The loop between the real and the digital closes.',
  respCue: '<span class="cue__dot"></span><span class="cue--fine">Move your cursor. It’s following you.</span><span class="cue--touch">Touch the screen. It’s following you.</span>',

  saludK: '<b>05</b> Health',
  saludH: 'The most important twin is yours.',
  saludP: 'A digital health twin brings vital signs, tests, medical history and data from the devices we already wear into a single model. It stops being a file and becomes a body that can be observed, measured and tested.',
  saludSpec: '<div><dt>For</dt><dd>Clinics · private hospitals · insurers</dd></div><div><dt>Sources</dt><dd>Wearables · lab tests · imaging · medical records</dd></div><div><dt>Focus</dt><dd>Prevention and personalised medicine</dd></div>',

  corK: '<b>05.1</b> Cardiovascular prevention',
  corH: 'Every heartbeat, recorded. Every anomaly, before the symptom.',
  corP: 'Connected to the patient’s watch, the twin follows their heart around the clock and learns what normal looks like for them. When something drifts, the clinic knows before the patient notices — and calls them first.',
  corN: 'Scroll fast: the twin’s pulse rises with activity. The ECG is drawn by the same heartbeat that moves the heart.',

  cerK: '<b>05.2</b> Precision diagnosis',
  cerH: 'A living map of the nervous system.',
  cerP: 'From the brain to the fingertips, signals travel through the body at more than a hundred metres per second. Bringing imaging, lab tests and follow-up into one model shows how each patient evolves, not just a snapshot of their last appointment.',

  ensK: '<b>05.3</b> Personalised medicine',
  ensH: 'Test the treatment on the twin, not on the patient.',
  ensP: 'Before deciding, we simulate several options on that person’s replica and compare how they would respond to each one. The doctor decides with data, and the patient is spared the trial and error.',
  ensN: 'Illustrative simulation: the percentages and the nodule are examples.',

  cliK: '<b>05.4</b> Clinical operations',
  cliH: 'From the patient to the whole clinic.',
  cliP: 'The same replica that follows a patient follows the entire centre: operating theatres, beds, A&amp;E and each person’s journey from the moment they walk in. Shorter waits, better-used theatres and an experience worthy of private healthcare.',
  cliL: 'Layers &nbsp;theatres · wards · A&amp;E · patient flow',

  terK: '<b>06</b> Scale',
  terH: 'From a body to a territory.',
  terP: 'The same logic that replicates a person replicates an entire city. Terrain, vegetation, buildings, traffic and sensors share a single coordinate system, and update together.',

  ciuK: '<b>06.1</b> Smart cities',
  ciuH: 'A city rehearsed before it’s built.',
  ciuP: 'We simulate how the city behaves to optimise traffic, energy distribution and public services.',
  ciuL: 'Layers &nbsp;buildings · roads · mobility · energy',

  indK: '<b>06.2</b> Industry 4.0',
  indH: 'The breakdown, seen before it happens.',
  indP: 'Virtual replicas of production plants to monitor processes, predict machinery failures and fine-tune the supply chain.',
  indL: 'Layers &nbsp;processes · machinery · logistics',

  rurK: '<b>06.3</b> Rural land',
  rurH: 'The land that needs data the most has the least.',
  rurP: 'Crops, rivers, woodland and tracks, monitored from the same model with a network of low-cost environmental sensors.',
  rurL: 'Layers &nbsp;terrain · water · plots · sensors',

  fireK: '<b>06.4</b> Emergencies',
  fireH: 'Where the fire will go, and how to get out.',
  fireP: 'During an active wildfire, the twin combines wind, slope and fuel to estimate how the front will advance hour by hour, and recalculates evacuation routes every time it changes.',
  fireL: 'Simulation &nbsp;<span id="fireClock">T+00:00</span>',

  redK: '<b>07</b> Internet of Twins',
  redH: 'One twin is useful. A thousand, connected, are a system.',
  redP: 'Every replica shares data with the others: the patient with their clinic, the plant with the power grid, the grid with the city, the city with the land around it. A decision at one point spreads, measured, to everything else.',

  platK: '<b>08</b> Platform',
  platH: 'Digital twins as a service. For anyone.',
  platSteps: '<li style="--i:0"><span class="mono">01</span><h4>Capture</h4><p>We start from what already exists: plans, sensors, maps, operating history.</p></li><li style="--i:1"><span class="mono">02</span><h4>Replicate</h4><p>We build the twin and connect it to the asset’s data in real time.</p></li><li style="--i:2"><span class="mono">03</span><h4>Simulate</h4><p>We rehearse scenarios with mathematical optimisation and stochastic processes.</p></li><li style="--i:3"><span class="mono">04</span><h4>Operate</h4><p>The twin acts: alerts, recommendations and control over the physical asset.</p></li>',
  platCreds: 'Over five years building digital twins · Experience in telco, mobility, construction, energy and software · Operations, cybersecurity, UI/UX and geospatial data',

  conK: '<b>09</b> Contact',
  conH: 'What do you want to replicate?',
  conP: 'Tell us which asset, city or territory you have in mind. We’ll get back to you with a first idea for its twin.',
  footCoord: '42.3439° N 3.6969° W',
};

const META = {
  es: { title: 'GeoReplica Technologies — Internet of Twins', desc: 'Gemelos digitales conectados en tiempo real a personas, clínicas, ciudades y territorios.' },
  en: { title: 'GeoReplica Technologies — Internet of Twins', desc: 'Digital twins connected in real time to people, clinics, cities and territories.' },
};

const ES = {};
let els = [];

// guarda el castellano tal como viene en el HTML y aplica el idioma guardado
export function initLang() {
  els = [...document.querySelectorAll('[data-i18n]')];
  for (const el of els) ES[el.dataset.i18n] = el.innerHTML;
  let saved = null;
  try { saved = localStorage.getItem('gr-lang'); } catch (e) { /* sin almacenamiento */ }
  const q = new URLSearchParams(location.search).get('lang');
  const want = q === 'en' || q === 'es' ? q : saved;
  if (want === 'en') apply('en');
  paintButton();
}

function apply(l) {
  lang = l;
  document.documentElement.lang = l;
  document.title = META[l].title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', META[l].desc);
  for (const el of els) {
    const html = l === 'en' ? EN[el.dataset.i18n] : ES[el.dataset.i18n];
    if (html !== undefined) el.innerHTML = html;
  }
}

function paintButton() {
  const b = document.getElementById('langBtn');
  if (!b) return;
  b.classList.toggle('is-en', lang === 'en');
  b.setAttribute('aria-label', lang === 'en' ? 'Ver en español' : 'View in English');
  b.querySelector('.lang__code').textContent = lang === 'en' ? 'ES' : 'EN';
}

// cambia de idioma; `after` vuelve a montar lo que depende del texto (palabras partidas, etc.)
export function setLang(l, after) {
  if (l === lang) return;
  apply(l);
  try { localStorage.setItem('gr-lang', l); } catch (e) { /* sin almacenamiento */ }
  paintButton();
  after?.(els);
}
