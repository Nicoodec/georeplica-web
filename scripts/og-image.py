# Compone la imagen para compartir el enlace (1200×630): la figura de dígitos real
# de la web (brand/og-figure.png, capturada del lienzo 3D) y el logo oficial.
# Ejecutar: python scripts/og-image.py
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
W, H = 1200, 630

og = Image.new('RGB', (W, H), (0, 0, 0))

# --- figura: se recorta lo que tiene contenido y se encaja a la derecha
fig = Image.open(ROOT / 'brand' / 'og-figure.png').convert('RGBA')
r, g, b, a = fig.split()
# el color ya viene "desmultiplicado"; la opacidad se usa como máscara al pegarlo
lit = Image.merge('RGB', (r, g, b))
mask = a.point(lambda v: 255 if v > 18 else 0)
box = mask.getbbox()
lit = lit.crop(box)
alpha = a.crop(box)
scale = (H * 0.94) / lit.height
size = (round(lit.width * scale), round(lit.height * scale))
lit = lit.resize(size, Image.LANCZOS)
alpha = alpha.resize(size, Image.LANCZOS).point(lambda v: min(255, int(v * 2.2)))
x = W - size[0] - 70
y = (H - size[1]) // 2 + 6
og.paste(lit, (x, y), alpha)

# --- logo oficial (fondo negro, encaja directamente)
logo = Image.open(ROOT / 'brand' / 'georeplica-logo.png').convert('RGB')
lw = 560
lh = round(logo.height * lw / logo.width)
og.paste(logo.resize((lw, lh), Image.LANCZOS), (48, 92))

# --- textos
d = ImageDraw.Draw(og)
title = ImageFont.truetype('C:/Windows/Fonts/bahnschrift.ttf', 58)
try:
    title.set_variation_by_name('Light Condensed')
except Exception:
    pass
mono = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 19)
d.text((80, 420), 'Internet of Twins', font=title, fill=(233, 231, 226))
d.text((82, 498), 'GEMELOS DIGITALES · DIGITAL TWINS', font=mono, fill=(0, 123, 245))
d.text((82, 528), 'Salud · Ciudades · Industria · Territorio', font=mono, fill=(140, 142, 146))

og.save(ROOT / 'public' / 'og-image.jpg', quality=90, optimize=True, progressive=True)
print('og-image.jpg', og.size)
