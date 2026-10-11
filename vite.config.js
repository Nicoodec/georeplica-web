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
      server.watcher.add(file);
      server.watcher.on('change', (f) => { if (f === file) server.ws.send({ type: 'full-reload' }); });
    },
    transformIndexHtml(html) {
      const data = read();
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
