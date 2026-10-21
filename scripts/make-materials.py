"""Reproducible, entirely procedural painted-wood material. No image inputs.

Optional authoring dependencies: Pillow and NumPy. The site uses the checked-in
WebP outputs and does not need Python at runtime.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parents[1] / 'public' / 'materials'
OUT.mkdir(parents=True, exist_ok=True)
W, H = 4096, 2560
rng = np.random.default_rng(1847)


def field(w, h):
    values = rng.random((h, w), dtype=np.float32)
    return np.asarray(Image.fromarray(values).resize((W, H), Image.Resampling.BICUBIC)).copy()


x = np.linspace(0, 1, W, dtype=np.float32)[None, :]
y = np.linspace(0, 1, H, dtype=np.float32)[:, None]
cloud = field(12, 9)
long = field(11, 180)
fine = field(40, 900)
paint = field(120, 85)
micro = rng.normal(0, 1, (H, W)).astype(np.float32)
# One continuous grain field, with slowly changing growth patterns rather
# than separate plank textures, painted seams or abrupt colour bands.
warp = .010 * np.sin(x * 12 + y * 8) + .007 * (long - .5)
cathedral = np.sqrt(((x - .43) * .26) ** 2 + ((y - .57) * .65) ** 2 + .0002)
phase = (y + warp + cathedral * .20 + (cloud - .5) * .020) * 170
annual = np.maximum(0, np.sin(phase * np.pi * 2 + long * 2)) ** 10
annual *= .45 + .55 * field(18, 125)
fibers = np.maximum(0, np.sin((y + warp * .10) * 7200 + fine * 5)) ** 18
grain = annual * .65 + fibers * .22 + long * .12
# Broad growth-ring shoulders surround narrow, interrupted vessel grooves.
# Their relief shares the colour field, so the highlights belong to the wood.
shoulders = np.maximum(0, np.sin(phase * np.pi * 2 + long * 2)) ** 3
pores = np.clip((fine - .59) * 4, 0, 1) * np.clip((long - .35) * 2.8, 0, 1)
relief = shoulders * .25 + annual * .61 + pores * .24 + fibers * .12

# Fine brush drag and mild variations in the thickness of the ivory paint.
brush = field(9, 1600)
tone = (cloud - .5) * 7 + (paint - .5) * 2.8 + (brush - .5) * 2.4
tone += -grain * 24 - pores * 3 + micro * .35
base = np.stack([237 + tone, 234 + tone, 226 + tone], axis=-1)
albedo = Image.fromarray(np.uint8(np.clip(base, 0, 255)))
height = Image.fromarray(np.uint8(np.clip(181 - relief * 119 + (brush - .5) * 14 + (cloud - .5) * 9 + micro, 0, 255)))
rough = Image.fromarray(np.uint8(np.clip(179 + (cloud - .5) * 20 + shoulders * 19 + annual * 39 + pores * 24 + micro, 0, 255)))

# Quiet, nonuniform traces of use. Never a repeating grunge overlay.
draw = ImageDraw.Draw(albedo, 'RGBA')
hd = ImageDraw.Draw(height)
for _ in range(145):
    sx, sy = int(rng.integers(35, W - 35)), int(rng.integers(20, H - 20))
    length = int(rng.integers(4, 100))
    draw.line([(sx, sy), (sx + length, sy + int(rng.integers(-2, 3)))], fill=(124, 110, 88, int(rng.integers(8, 30))), width=1)
    hd.line([(sx, sy), (sx + length, sy)], fill=124, width=1)
for _ in range(700):
    sx, sy = int(rng.integers(0, W)), int(rng.integers(0, H))
    draw.ellipse((sx, sy, sx + 1, sy + 1), fill=(100, 87, 63, int(rng.integers(5, 28))))

albedo.save(OUT / 'ivory-color.webp', quality=94, method=6)
height.resize((3072, 1920), Image.Resampling.LANCZOS).save(OUT / 'ivory-height.webp', quality=96, method=6)
rough.resize((1536, 960), Image.Resampling.LANCZOS).save(OUT / 'ivory-roughness.webp', quality=92, method=6)
albedo.resize((1600, 1000), Image.Resampling.LANCZOS).save(OUT / 'ivory-fallback.webp', quality=88, method=6)
for file in sorted(OUT.glob('*.webp')):
    print(f'{file.name}: {file.stat().st_size / 1024:.0f} KB')
