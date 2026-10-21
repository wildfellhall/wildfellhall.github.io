"""Procedural ivory paint over close-grained drawer timber; no image inputs.

The square maps represent 6.4 units of timber in each direction. The spatial
material blends them continuously around the drawer's coved inner surface.
Requires Pillow and NumPy only when regenerating the checked-in WebP assets.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'public' / 'materials'
OUT.mkdir(parents=True, exist_ok=True)
W = H = 2048
rng = np.random.default_rng(1862)


def field(w, h):
    values = rng.random((h, w), dtype=np.float32)
    return np.asarray(Image.fromarray(values).resize((W, H), Image.Resampling.BICUBIC)).copy()


x = np.linspace(0, 1, W, dtype=np.float32)[None, :]
y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
cloud = field(9, 11)
long = field(14, 160)
fibres = field(35, 900)
paint = field(60, 70)
brush = field(7, 1200)
micro = rng.normal(0, 1, (H, W)).astype(np.float32)

# Uneven growth lines bend around long, shallow cathedral figures. Their
# spacing varies gradually, avoiding uniformly spaced stripes under the paint.
warp = .011 * np.sin(x * 9 + y * 14) + .004 * np.sin(x * 21 - y * 11)
warp += .009 * (long - .5) + .016 * (cloud - .5)
cathedral = np.sqrt(((x - .38) * .34) ** 2 + ((y - .63) * .85) ** 2 + .0003)
phase = (y + warp + cathedral * .13) * 115 + cloud * 1.4
rings = np.maximum(0, np.sin(phase * np.pi * 2)) ** 12
rings *= .35 + .65 * field(18, 95)
fine = np.maximum(0, np.sin((y + warp * .11) * 5600 + fibres * 4)) ** 18
pores = np.clip((fibres - .66) * 4, 0, 1) * np.clip((long - .42) * 3, 0, 1)

# Opaque, softly aged white paint: the grain reads chiefly through relief and
# sheen. No brown stain, exposed raw timber, or dark drawn grain outlines.
tone = (cloud - .5) * 7 + (paint - .5) * 3 + (brush - .5) * 2.4
tone -= rings * 18 + fine * 5 + pores * 6.5
tone += micro * .3
albedo = Image.fromarray(np.uint8(np.clip(np.stack([237 + tone, 234 + tone, 227 + tone], axis=-1), 0, 255)))
shoulders = np.maximum(0, np.sin(phase * np.pi * 2)) ** 3
height = Image.fromarray(np.uint8(np.clip(177 - shoulders * 24 - rings * 80 - fine * 17 - pores * 39 + (brush - .5) * 12 + micro, 0, 255)))
roughness = Image.fromarray(np.uint8(np.clip(195 + (paint - .5) * 17 + rings * 31 + pores * 18 - (brush - .5) * 8, 0, 255)))

# Sparse shallow scuffs disturb the paint's sheen more than its colour.
hd = ImageDraw.Draw(height)
rd = ImageDraw.Draw(roughness)
for _ in range(85):
    sx, sy = int(rng.integers(12, W - 100)), int(rng.integers(12, H - 12))
    end = (sx + int(rng.integers(12, 85)), sy + int(rng.integers(-1, 2)))
    hd.line([(sx, sy), end], fill=140, width=1)
    rd.line([(sx, sy), end], fill=184, width=1)

albedo.save(OUT / 'drawer-ivory-color.webp', quality=94, method=6)
height.save(OUT / 'drawer-ivory-height.webp', quality=96, method=6)
roughness.resize((1024, 1024), Image.Resampling.LANCZOS).save(OUT / 'drawer-ivory-roughness.webp', quality=90, method=6)
for name in ['color', 'height', 'roughness']:
    path = OUT / f'drawer-ivory-{name}.webp'
    print(f'{path.name}: {path.stat().st_size / 1024:.0f} KB')
