#!/usr/bin/env python3
"""Genera los íconos de la PWA y la imagen para compartir (og.jpg).

Uso:  python3 tools/make-assets.py [ruta/a/fuente-serif.ttf]

Requiere Pillow (pip install pillow). La fuente es opcional: si no se pasa, se usa
la tipografía por defecto de Pillow. Podés reemplazar las imágenes por las tuyas
(mismos nombres y tamaños) sin tocar nada más.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BG = (16, 21, 28)
ACCENT = (224, 165, 58)
TOP = (240, 214, 150)
LEFT = (205, 150, 52)
RIGHT = (160, 112, 38)
S = 4  # supersampling


def font(path, size):
    if path and os.path.exists(path):
        return ImageFont.truetype(path, size)
    try:
        return ImageFont.load_default(size)
    except TypeError:
        return ImageFont.load_default()


def iso_block(d, cx, cy, w, h, depth, scale=1.0):
    """Bloque isométrico (la 'maqueta') centrado en cx, cy."""
    w, h, depth = w * scale, h * scale, depth * scale
    top = [(cx, cy - depth - h), (cx + w, cy - depth - h / 2 * 0 + 0), (cx, cy - depth + h), (cx - w, cy - depth)]
    # caras
    t = [(cx, cy - depth - h / 2), (cx + w, cy - depth), (cx, cy - depth + h / 2), (cx - w, cy - depth)]
    l = [(cx - w, cy - depth), (cx, cy - depth + h / 2), (cx, cy + h / 2), (cx - w, cy)]
    r = [(cx + w, cy - depth), (cx, cy - depth + h / 2), (cx, cy + h / 2), (cx + w, cy)]
    d.polygon(l, fill=LEFT)
    d.polygon(r, fill=RIGHT)
    d.polygon(t, fill=TOP)


def logo_blocks(d, cx, cy, sc):
    """Base y tres edificios de distinta altura (el logo)."""
    iso_block(d, cx, cy + 14 * sc, 38 * sc, 22 * sc, 6 * sc)
    iso_block(d, cx - 14 * sc, cy + 2 * sc, 14 * sc, 8 * sc, 22 * sc)
    iso_block(d, cx + 12 * sc, cy + 4 * sc, 14 * sc, 8 * sc, 14 * sc)
    iso_block(d, cx + 0 * sc, cy - 6 * sc, 12 * sc, 7 * sc, 30 * sc)


def draw_logo(size, padding):
    img = Image.new("RGB", (size * S, size * S), BG)
    d = ImageDraw.Draw(img)
    u = size * S
    inner = 1 - 2 * padding
    logo_blocks(d, u / 2, u * (0.5 + 0.1 * inner), inner * u / 100)
    return img.resize((size, size), Image.LANCZOS)


def main():
    fpath = sys.argv[1] if len(sys.argv) > 1 else None
    out = os.path.join(ROOT, "icons")
    os.makedirs(out, exist_ok=True)

    draw_logo(192, 0.10).save(os.path.join(out, "icon-192.png"))
    draw_logo(512, 0.10).save(os.path.join(out, "icon-512.png"))
    draw_logo(512, 0.24).save(os.path.join(out, "icon-maskable-512.png"))  # zona segura

    # Imagen para compartir 1200x630
    W, H = 1200, 630
    img = Image.new("RGB", (W * 2, H * 2), BG)
    d = ImageDraw.Draw(img)
    # degradé suave
    for y in range(H * 2):
        t = y / (H * 2)
        c = tuple(int(BG[i] + (v - BG[i]) * (1 - t) * 0.9) for i, v in enumerate((30, 42, 56)))
        d.line([(0, y), (W * 2, y)], fill=c)
    # el logo, grande, a la derecha
    logo_blocks(d, 1780, 700, 12.5)
    d.text((110, 150), "PROVINCIA DE BUENOS AIRES", font=font(fpath, 40), fill=ACCENT)
    d.text((110, 250), "Capitán", font=font(fpath, 210), fill=(238, 240, 242))
    d.text((110, 470), "Sarmiento", font=font(fpath, 210), fill=ACCENT)
    d.text((115, 810), "Guía local en 3D · dónde comer, dormir y qué ver", font=font(fpath, 46), fill=(167, 176, 186))
    img = img.resize((W, H), Image.LANCZOS)
    img.save(os.path.join(ROOT, "og.jpg"), quality=88, optimize=True)
    print("assets generados: icons/*.png y og.jpg")


if __name__ == "__main__":
    main()
