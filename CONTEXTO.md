# Contexto completo — web de GeoReplica

Última actualización: 11 de octubre de 2026.

## 1. Qué es

Web de una sola página (con scroll guiado) para **Georeplica Technologies, S.L.**, startup de
**gemelos digitales** («Internet of Twins»). El eje es una **figura humana 3D hecha de 0 y 1** que
cambian sin parar y que «dirige» la página: se ensambla al cargar, mira el cursor, señala los
titulares, camina, se vuelve radiografía, entra en una clínica y acaba diminuta sobre un territorio.

Antonio pidió orientarla **sobre todo a salud privada** (clínicas, hospitales privados,
aseguradoras, prevención, medicina personalizada) sin quitar la parte de territorio.

## 2. Recorrido (secciones del `index.html`, en orden)

| id | Qué pasa |
|---|---|
| `inicio` | Figura de dígitos; un **doble** intenta arrancarse del cuerpo y vuelve de golpe (glitch). |
| `forma` (01) | Escaneo: por debajo de la línea, nube en bruto; por encima, réplica en dígitos. |
| `pulso` (02) | La figura **señala el titular**; etiquetas con medidas reales del esqueleto. |
| `futuro` (03) | Camina; 4 «fantasmas» azules del futuro (cronofotografía de Marey). |
| `respuesta` (04) | Señala el cursor con el brazo. |
| `salud` (05) | Mira su **reloj** (IK de codo real) y se vuelve **radiografía**: corazón, pulmones, cerebro, columna, arterias, venas, nervios. |
| `corazon` (05.1) | Primer plano; **anillo de electro** alrededor del pecho y otro de respiración; scroll rápido = sube el pulso. |
| `cerebro` (05.2) | Cerebro con chispas y señales nerviosas. |
| `ensayo` (05.3) | 3 gemelos, 3 tratamientos; pasan 90 días y cada nódulo evoluciona distinto. |
| `clinica` (05.4) | Clínica de dígitos que se levanta y se despliega planta a planta: ambulancia, personas, camas que cambian de estado, quirófanos; termina en la **habitación 604** con el paciente en la cama. |
| `territorio` (06) | El suelo de dígitos aparece; la figura queda diminuta. |
| `ciudades` `industria` `rural` `incendios` | Ciudad, planta con depósito que va a fallar, sensores, incendio que frena en el río. |
| `red` (07) | Arcos entre nodos (Internet of Twins). |
| `plataforma` (08) | Capturar, replicar, simular, operar. |
| `contacto` (09) | La figura señala el correo y **asiente** al pasar el ratón. Pie con enlaces legales. |

## 3. Cómo está montado

- **Vite + Three.js** (sin frameworks). `npm run dev` / `npm run build`. Base relativa (`./`).
- `src/main.js`: arranque, bucle, estado, cámara, gestos, fantasmas, doble de la portada.
- `src/script.js`: **el guion**. `KEYS[id](p)` devuelve el plano de cada sección (p de 0 a 1);
  `DEFAULTS` lista todas las variables; `mobileAdjust()` adapta para pantallas < 820 px.
- `src/figure.js`: carga el maniquí (Xbot.glb de three.js/Mixamo), muestrea su piel en puntos con
  pesos de hueso y los deforma en la GPU. Mirar (`look`), señalar (`point`), IK de codo (`reach`),
  copiar pose (`copyPose`), doble (`setTear`).
- `src/anatomy.js`: órganos colocados **midiendo la malla** (no a ojo).
- `src/vitals.js`: anillos de electro y respiración.
- `src/clinic.js`: la clínica (edificio, ambulancia, personas, ciclo de camas, habitación 604).
- `src/territory.js`: terreno (relieve precalculado en CPU), edificios, sensores, arcos.
- `src/labels.js`: etiquetas HTML ancladas al 3D + líneas guía en un canvas 2D. Textos con `tr(es, en)`.
- `src/i18n.js`: inglés de los textos de página (`data-i18n` en el HTML). Selector ES | EN; recuerda
  el idioma en `localStorage` (`gr-lang`); `?lang=en` fuerza inglés.
- `src/text.js`: palabras que suben y rótulos que se «decodifican».
- Legales: `aviso-legal.html`, `privacidad.html`, `cookies.html` generados por
  `scripts/legal-pages.py`; datos en `legal.config.json` (se incrustan al compilar; lo que diga
  «PENDIENTE» sale resaltado y avisa en consola).
- Iconos: `scripts/icons.py` (desde `brand/georeplica-logo.png`, azul oficial #007BF5).
- Imagen para compartir: `scripts/og-image.py` → `public/og-image.jpg` (usa `brand/og-figure.png`,
  capturada del lienzo con el endpoint de desarrollo `/__save-capture`).
- `servidor.mjs` + `ABRIR PAGINA.bat` / `PARAR PAGINA.bat`: servir `dist/` sin internet (puerto 5190).

Atajos de desarrollo (solo en `npm run dev`): `?s=clinica&p=0.9` salta a un plano;
`await __shot('clinica', 0.6, 'nombre')` guarda una captura del 3D en `node_modules/.captures/`
(funciona aunque el panel del navegador esté en segundo plano; sirve para revisar móvil a 375×812);
`window.__tear()` fuerza el glitch; `window.__tearHold = 1` lo congela; `window.__dbg` expone todo.

## 4. Datos de la empresa (públicos en el aviso legal)

- Razón social: **Georeplica Technologies, S.L.** — CIF **B19731199**.
- Domicilio (fiscal y social, según Nico): **Calle Eraso, 36, planta 1, 28028 Madrid**.
  (El certificado de Hacienda aún muestra el social en General Álvarez de Castro 41; Antonio debe
  asegurarse de que el traslado está inscrito.)
- Registro Mercantil de Madrid, hoja **M-824879**, inscripción 1.ª (folio electrónico). En el
  Registro figura con el nombre original «Replica Tecnologies SL».
- Correo: info@georeplica.com. Marca: logo blanco + cabeza azul #007BF5.

## 5. Publicación (pendiente)

Antonio quiere sustituir lo actual y usar **georeplica.ai** como dominio principal:
- georeplica.ai → web; www.georeplica.ai → redirige a georeplica.ai;
- georeplica.com y www.georeplica.com → **301** a https://georeplica.ai.
- Dominios en **GoDaddy**. Mantener intactos los registros del **correo** (MX, SPF, DKIM).
- **Recomendación dada: Cloudflare Pages + DNS en Cloudflare**, cuenta **a nombre de GeoReplica**
  (Nico como miembro). Gratis, rápido, HTTPS y redirecciones incluidas.
- Hoy georeplica.ai es una **página de aparcamiento de GoDaddy**, no una landing suya.
- Antonio mandó la contraseña de GoDaddy por mensaje: **no usarla**; se le pidió cambiarla y dar
  **acceso delegado**.
- Tras publicar: Google Search Console + enviar `sitemap.xml`.

## 6. SEO hecho

Título y descripción con «gemelos digitales» (ES/EN), canonical y hreflang que cambian con el
idioma, `robots.txt`, `sitemap.xml`, Open Graph con `og-image.jpg`, datos estructurados
(Organization + WebSite, se completan solos desde `legal.config.json`), favicons y manifest.
Todo apunta a https://georeplica.ai (la imagen y la ficha solo funcionan del todo ahí).

## 7. Trampas ya pisadas

- **Altura del modelo**: medir con la malla ya deformada (`computeBoundingBox` de SkinnedMesh),
  no con la geometría cruda (salía ×100).
- **`getVertexPosition` ya aplica el esqueleto** en SkinnedMesh: no volver a aplicar
  `applyBoneTransform` (salían cabezas a 179 m).
- **Espacio de reposo**: en este maniquí, reposo = escena antes de normalizar; para pasar puntos del
  mundo a reposo basta `src.matrixWorld` invertida (las matrices de huesos daban ×10.000).
- **Medidas del cuerpo en bucles**: memorizar por altura (`slab`), si no la carga se congela.
- **El panel del navegador congela el bucle cuando está oculto**: medir y capturar con el panel
  visible; repetir capturas.
- **Móvil (`mobileAdjust` en `script.js`)**: no se ajusta a ojo. Planos de figura: la cámara se pone
  a la distancia justa para que la figura ocupe el 40 % del alto en la mitad de arriba (el texto va
  abajo) y se sube con `shiftY` (desplazamiento de vista). Territorio ×2,1 y clínica ×1,75 (más al
  desplegarse) porque el hueco útil del móvil es ~2 veces más pequeño que el de ordenador. Las dos
  reglas se mezclan en las transiciones para no dar saltos.
- **La niebla de la clínica y del territorio depende de la distancia de la cámara**; si es fija, al
  alejar en móvil todo desaparece.
- **Capturas del lienzo**: exportar con fondo opaco (`setClearColor(0x060708, 1)`); con fondo
  transparente los puntos que se suman salen mucho más oscuros de lo real.
- **Recarga en caliente**: tras cambiar `script.js` la página se recarga sola; esperar antes de
  saltar de sección.
- Puertos: dev 5180, presentación 5190. Si se queda algo colgado: `PARAR PAGINA.bat`.

## 8. Pendiente / ideas

- Revisión móvil hecha el 11/10 (encuadres calculados). Falta probar en un teléfono real.
- Publicación en georeplica.ai (hosting + DNS) cuando Antonio dé acceso.
- Que el asesor revise los textos legales.
- Versión inglesa como página propia (`/en/`) si se quiere más SEO en inglés.
