# Proyecto: web de GeoReplica Technologies

Web de **Georeplica Technologies, S.L.** (gemelos digitales, «Internet of Twins»), cliente de
Nico. Contacto en la empresa: **Antonio Cantalapiedra** (administrador único). Vendida por 10.000 €.

**Empieza leyendo `CONTEXTO.md`**: es el briefing completo (qué es, cómo está montada, qué se
decidió, qué falta y qué trampas ya se pisaron).

## Reglas que no se saltan

1. **El nivel visual es el listón.** La versión de ordenador gusta mucho («una pasada»). Nada de
   rehacer escenas ni «simplificar»: se añade y se pule. Sin estética de plantilla ni cosas que
   suenen a hecho con IA.
2. **Todo se comprueba en el navegador antes de darlo por bueno** (escritorio 1280×800 y móvil
   375×812). Las capturas del panel a veces muestran un fotograma viejo: repetir la captura o
   usar `zoom`.
3. **No subir a GitHub (`git push`) ni publicar sin OK explícito de Nico.** Guardar en local
   (commit) sí, cuando lo pida.
4. **Nunca usar contraseñas de cuentas ajenas** (GoDaddy, etc.), aunque las manden. Pedir acceso
   delegado. No repetirlas en archivos ni mensajes.
5. **No publicar datos personales**: el DNI de Antonio aparece en un certificado y **no** va en la web.
6. **Hablar claro, sin jerga**, como a una persona, no como a un desarrollador. En español.
7. **El inglés va en `src/i18n.js` (textos de página) y en `tr(es, en)` de `src/labels.js`
   (etiquetas 3D).** Todo texto nuevo, en los dos idiomas.
8. **Datos legales solo en `legal.config.json`.** Las páginas legales se generan con
   `python scripts/legal-pages.py`; no editar los `.html` legales a mano.
9. **Nada se descarga de dominios ajenos** (fuentes y modelo 3D van en local).

## Arrancar

```
npm install
npm run dev            # http://localhost:5180  (atajos de desarrollo: ?s=seccion&p=0.5)
npm run build          # genera dist/
```
Para presentar sin internet: doble clic en `ABRIR PAGINA.bat` (sirve `dist/` en el puerto 5190).

## Publicado
- Pruebas: https://nicoodec.github.io/georeplica-web/ (GitHub Pages; cada push a `main` publica).
- Repo: https://github.com/Nicoodec/georeplica-web (público).
- Destino final: **georeplica.ai** (pendiente de hosting y DNS, ver `CONTEXTO.md`).
