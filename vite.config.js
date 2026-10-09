import { defineConfig } from 'vite';

// base relativa: la carpeta dist/ funciona colgada en cualquier ruta o subcarpeta
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 900 },
});
