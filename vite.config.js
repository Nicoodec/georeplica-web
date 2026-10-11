import { defineConfig } from 'vite';
import fs from 'node:fs';
import { resolve } from 'node:path';

// Datos de la empresa para los textos legales: viven en legal.config.json y se
// incrustan en el HTML al compilar. Lo que aún esté "PENDIENTE" se pinta
// resaltado en la página y se avisa en la consola, para que no se publique sin rellenar.
function legalData() {
  const file = resolve(__dirname, 'legal.config.json');
  const read = () => JSON.parse(fs.readFileSync(file, 'utf8'));
  const esc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return {
    name: 'legal-data',
    configureServer(server) {
      // solo en desarrollo: guarda una captura del lienzo 3D (para la imagen de compartir)
      server.middlewares.use('/__save-capture', (req, res) => {
        const chunks = [];
        const name = (new URL(req.url, 'http://x').searchParams.get('name') || 'og-figure').replace(/[^\w-]/g, '');
        const dir = name === 'og-figure' ? resolve(__dirname, 'brand') : resolve(__dirname, 'node_modules', '.captures');
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(resolve(dir, name + '.png'), Buffer.concat(chunks));
          res.end('ok');
        });
      });
      server.watcher.add(file);
      server.watcher.on('change', (f) => { if (f === file) server.ws.send({ type: 'full-reload' }); });
    },
    transformIndexHtml(html) {
      const data = read();
      const ok = (v) => v && !/PENDIENTE/.test(v);
      // ficha de empresa para Google (datos estructurados); lo pendiente simplemente no se incluye
      const org = {
        '@type': 'Organization',
        '@id': 'https://georeplica.ai/#org',
        name: 'GeoReplica Technologies',
        alternateName: 'GeoReplica',
        url: 'https://georeplica.ai/',
        logo: 'https://georeplica.ai/logo-georeplica.png',
        image: 'https://georeplica.ai/og-image.jpg',
        email: data.email,
        slogan: 'Internet of Twins',
        description: 'Gemelos digitales conectados en tiempo real para salud, ciudades inteligentes, Industria 4.0 y territorio.',
        knowsAbout: ['Gemelos digitales', 'Digital twins', 'Salud digital', 'Ciudades inteligentes', 'Industria 4.0', 'GIS', 'LiDAR', 'IoT'],
      };
      if (ok(data.razonSocial)) org.legalName = data.razonSocial;
      if (ok(data.cif)) org.taxID = data.cif;
      if (ok(data.calle)) org.address = { '@type': 'PostalAddress', streetAddress: data.calle, postalCode: data.codigoPostal, addressLocality: data.localidad, addressCountry: 'ES' };
      const ld = {
        '@context': 'https://schema.org',
        '@graph': [org, { '@type': 'WebSite', '@id': 'https://georeplica.ai/#web', url: 'https://georeplica.ai/', name: 'GeoReplica', inLanguage: ['es', 'en'], publisher: { '@id': 'https://georeplica.ai/#org' } }],
      };
      html = html.replace('<!--jsonld-->', `<script type="application/ld+json">${JSON.stringify(ld)}</script>`);
      return html.replace(/\{\{(\w+)\}\}/g, (m, k) => {
        if (!(k in data)) return m;
        const v = esc(data[k]);
        return /PENDIENTE/.test(v) ? `<mark class="pending">${v}</mark>` : v;
      });
    },
    buildStart() {
      const missing = Object.entries(read()).filter(([, v]) => /PENDIENTE/.test(v)).map(([k]) => k);
      if (missing.length) this.warn(`Textos legales: faltan datos en legal.config.json → ${missing.join(', ')}`);
    },
  };
}

// base relativa: la carpeta dist/ funciona colgada en cualquier ruta o subcarpeta
export default defineConfig({
  base: './',
  plugins: [legalData()],
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        aviso: resolve(__dirname, 'aviso-legal.html'),
        privacidad: resolve(__dirname, 'privacidad.html'),
        cookies: resolve(__dirname, 'cookies.html'),
      },
    },
  },
});
