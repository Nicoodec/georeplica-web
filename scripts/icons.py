# Genera favicons e iconos de app a partir del logo oficial (brand/georeplica-logo.png).
# Se extrae solo la cabeza azul, se reescala con suavizado y se monta en cada tamaño.
# Ejecutar: python scripts/icons.py
from pathlib import Path
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'brand' / 'georeplica-logo.png'
OUT = ROOT / 'public'
BLUE = (0, 123, 245)   # azul oficial del logo
INK = (6, 7, 8)        # fondo de la web

logo = Image.open(SRC).convert('RGB')
w, h = logo.size
px = logo.load()

# máscara de "lo azul": cuanto más azul y menos rojo, más opaco (respeta el antialias original)
mask = Image.new('L', (w, h), 0)
mp = mask.load()
for y in range(h):
    for x in range(w):
        r, g, b = px[x, y]
        a = max(0, min(255, int((b - r - 40) * 255 / 165)))
        if b > 90 and r < 120:
            mp[x, y] = a
bbox = mask.getbbox()
mark = mask.crop(bbox)

# alta resolución: ampliar ×6 y volver a afilar el borde
big = mark.resize((mark.width * 6, mark.height * 6), Image.LANCZOS).filter(ImageFilter.GaussianBlur(2))
big = big.point(lambda v: 0 if v < 70 else 255 if v > 185 else int((v - 70) * 255 / 115))


def tile(size, fill=0.86, bg=None):
    """La cabeza centrada en un cuadrado; `fill` = fracción del lado que ocupa."""
    canvas = Image.new('RGBA', (size, size), bg + (255,) if bg else (0, 0, 0, 0))
    s = fill * size / max(big.size)
    mw, mh = max(1, round(big.width * s)), max(1, round(big.height * s))
    if size <= 48:
        # en tamaños de pestaña el trazo original se queda fino: se engrosa antes de reducir
        k = 5 if size <= 16 else 3
        inter = big.resize((mw * 8, mh * 8), Image.LANCZOS).filter(ImageFilter.MaxFilter(k)).filter(ImageFilter.MaxFilter(k))
        alpha = inter.resize((mw, mh), Image.LANCZOS)
    else:
        alpha = big.resize((mw, mh), Image.LANCZOS)
    color = Image.new('RGBA', (mw, mh), BLUE + (255,))
    color.putalpha(alpha)
    canvas.alpha_composite(color, ((size - mw) // 2, (size - mh) // 2))
    return canvas


# favicons (transparente; Google pide múltiplos de 48 px)
for s in (16, 32, 48, 96, 192):
    tile(s, 0.92).save(OUT / f'favicon-{s}.png')
tile(48, 0.92).save(OUT / 'favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])
# iPhone: fondo sólido, sin transparencia
tile(180, 0.62, INK).convert('RGB').save(OUT / 'apple-touch-icon.png')
# Android / PWA
tile(512, 0.7, INK).save(OUT / 'icon-512.png')
tile(192, 0.7, INK).save(OUT / 'icon-192.png')
tile(512, 0.5, INK).save(OUT / 'icon-maskable-512.png')
# logo completo para Google (datos estructurados) y otros usos
logo.save(OUT / 'logo-georeplica.png')
print('iconos generados, cabeza recortada en', bbox)
