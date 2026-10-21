"""Reproducible, entirely procedural painted-wood material. No image inputs.

Optional authoring dependencies: Pillow and NumPy. The site uses the checked-in
WebP outputs and does not need Python at runtime.
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

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
grain = np.zeros((H, W), np.float32)
seams = np.zeros_like(grain)
board_tint = np.zeros_like(grain)

# Different sawn growth patterns per board, with elongated, irregular cathedrals.
bounds = [0, .205, .425, .655, .84, 1]
for i, (low, high) in enumerate(zip(bounds[:-1], bounds[1:])):
    mask = (y >= low) & (y <= high)
    yy = (y - low) / (high - low)
    center_x = [.21, .76, .39, .87, .13][i]
    center_y = [.46, .7, .32, .4, .72][i]
    warp = .012 * np.sin(x * 15 + i * 4) + .013 * (long - .5)
    ellipse = np.sqrt(((x - center_x) * .29) ** 2 + ((yy - center_y) * .18) ** 2 + .00018)
    phase = (yy + warp + ellipse * .65 + (cloud - .5) * .025) * (32 + i * 5)
    annual = np.maximum(0, np.sin(phase * 6.283 + long * 3)) ** 8
    fibers = np.maximum(0, np.sin((yy + warp * .08) * 1900 + fine * 5)) ** 18
    grain += mask * (annual * .55 + fibers * .25 + long * .15)
    board_tint += mask * [1.8, -2.4, .7, -3, .5][i]
    if i:
        seam_center = low + .00015 * np.sin(x * 35 + i) + .00011 * (cloud - .5)
        seams += np.exp(-((y - seam_center) / .00032) ** 2) * .7

# Fine brush drag over the wood, rubbed edges and a little dirt in the joints.
brush = field(9, 1600)
distance = np.minimum(np.minimum(x, 1 - x) * W, np.minimum(y, 1 - y) * H)
edge_field = field(230, 170) * .7 + field(650, 430) * .3
wear = np.clip((3 + edge_field * 11 - distance) / 7, 0, 1)
chips = wear * np.clip((edge_field - .58) * 6, 0, 1)
tone = (cloud - .5) * 9 + (paint - .5) * 2.8 + (brush - .5) * 2.4
tone += board_tint - grain * 49 - seams * 34 + micro * .7
base = np.stack([235 + tone, 232 + tone, 222 + tone], axis=-1)
wood = np.stack([163 + long * 16, 140 + long * 16, 108 + long * 13], axis=-1)
base = base * (1 - chips[..., None] * .78) + wood * chips[..., None] * .78
albedo = Image.fromarray(np.uint8(np.clip(base, 0, 255)))
height = Image.fromarray(np.uint8(np.clip(164 - grain * 82 - seams * 100 + (brush - .5) * 19 + micro * 2 - chips * 38, 0, 255)))
rough = Image.fromarray(np.uint8(np.clip(193 + (cloud - .5) * 24 + grain * 25 - wear * 20 + micro * 2, 0, 255)))

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
height.resize((2048, 1280), Image.Resampling.LANCZOS).save(OUT / 'ivory-height.webp', quality=92, method=6)
rough.resize((1024, 640), Image.Resampling.LANCZOS).save(OUT / 'ivory-roughness.webp', quality=85, method=6)
albedo.resize((1600, 1000), Image.Resampling.LANCZOS).save(OUT / 'ivory-fallback.webp', quality=88, method=6)
for file in sorted(OUT.glob('*.webp')):
    print(f'{file.name}: {file.stat().st_size / 1024:.0f} KB')
