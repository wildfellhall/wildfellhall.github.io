"""Reproducible woven linen for the control frame, without image inputs."""
from pathlib import Path
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'public' / 'materials'
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(1860)
W, H = 512, 256
x, y = np.meshgrid(np.arange(W), np.arange(H))
warp = np.cos(x * np.pi / 2) * (2.2 + .45 * np.cos(y * np.pi / 8))
weft = np.cos(y * np.pi / 2) * (2.2 - .45 * np.cos(x * np.pi / 8))
cloud = 1.9 * np.cos(x * np.pi * 2 / W) * np.sin(y * np.pi * 2 / H)
fibres = rng.normal(0, .65, (H, W)) + rng.normal(0, .65, (H, 1)) + rng.normal(0, .45, (1, W))
tone = warp + weft + cloud + fibres
linen = np.stack([235 + tone, 222 + tone, 195 + tone], axis=-1)
Image.fromarray(np.uint8(np.clip(linen, 0, 255))).save(OUT / 'control-linen.webp', quality=94, method=6)
print('Created control-linen.webp')
