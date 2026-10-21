"""Draw a small gilt frame and woven linen inset from geometry and seeded noise.

Authoring only: Pillow and NumPy. The static site uses the checked-in assets.
"""
from pathlib import Path
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'public' / 'materials'
OUT.mkdir(parents=True, exist_ok=True)

svg = ['''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 308 86" fill="none">
<defs>
  <linearGradient id="gilt" x1="0" y1="0" x2=".3" y2="1" gradientUnits="objectBoundingBox">
    <stop stop-color="#fff0bb"/><stop offset=".17" stop-color="#d9b66b"/>
    <stop offset=".38" stop-color="#a57732"/><stop offset=".56" stop-color="#edcf83"/>
    <stop offset=".77" stop-color="#bc9149"/><stop offset="1" stop-color="#715020"/>
  </linearGradient>
  <linearGradient id="leaf" x1="0" y1="0" x2=".2" y2="1">
    <stop stop-color="#fff2bf"/><stop offset=".32" stop-color="#e3bf70"/>
    <stop offset=".55" stop-color="#c49a49"/><stop offset="1" stop-color="#8c6028"/>
  </linearGradient>
  <linearGradient id="lip" x2="0" y2="1">
    <stop stop-color="#76501f"/><stop offset=".25" stop-color="#bc8d3b"/>
    <stop offset=".62" stop-color="#f5dfa0"/><stop offset="1" stop-color="#e7c67c"/>
  </linearGradient>
  <radialGradient id="pearl" cx=".32" cy=".24" r=".75">
    <stop stop-color="#fff2c4"/><stop offset=".38" stop-color="#dfba66"/><stop offset="1" stop-color="#8b642c"/>
  </radialGradient>
  <g id="acanthus">
    <path d="M0 0C2-5 5-7 8-7L6-10C11-10 13-8 16-9L15-12C20-11 23-6 27 0C21-2 17 3 13 2L14-1C9 1 6 2 3 0Z" fill="url(#leaf)" stroke="#8d622c" stroke-width=".5"/>
    <path d="M1-.5Q13-5 25-.2M7-2L7-6M12-3L15-7M16-3L20-6" stroke="#ffe6a2" stroke-width=".65"/>
    <path d="M3 .2Q13-3 24-.2M9-2L12 .6M16-2L18 .1" stroke="#98692b" stroke-width=".5"/>
  </g>
  <g id="corner">
    <path d="M-6 17C-9 7-6-5 5-7C13-9 18-5 17 1C16 6 9 7 7 2C6-1 9-3 11-1M0 15C-4 6 1-2 7 0" stroke="#69471f" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M-6 16C-9 6-6-6 5-8C13-10 18-6 17 0C16 5 9 6 7 1C6-2 9-4 11-2M0 14C-4 5 1-3 7-1" stroke="url(#gilt)" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M-6 13C-8 3-4-5 5-6C11-8 16-5 15-1" stroke="#ffedb2" stroke-width=".55" stroke-linecap="round"/>
    <use href="#acanthus" transform="translate(-1 0) rotate(-12) scale(.9)"/>
    <use href="#acanthus" transform="translate(-3 3) rotate(75) scale(.72)"/>
    <ellipse cx="-3" cy="-3" rx="3.3" ry="3.7" fill="url(#pearl)" stroke="#a77b36" stroke-width=".5"/>
  </g>
  <g id="scroll">
    <path d="M0 0C8-6 12-6 17-2C22 2 28 2 33-1C39-5 42-5 45-2C49 3 42 5 40 1M17-2C18-7 24-8 26-4C28 0 23 1 22-2" stroke="#785124" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M0-.7C8-6.7 12-6.7 17-2.7C22 1.3 28 1.3 33-1.7C39-5.7 42-5.7 45-2.7C49 2.3 42 4.3 40 .3M17-2.7C18-7.7 24-8.7 26-4.7C28-.7 23 .3 22-2.7" stroke="#f0d48d" stroke-width=".8" stroke-linecap="round"/>
    <path d="M4-2C6-7 10-8 14-7C12-3 8-2 4-2ZM29-1C31 3 35 4 38 2C36 0 33-1 29-1Z" fill="url(#leaf)" stroke="#a57834" stroke-width=".35"/>
  </g>
  <g id="crest">
    <use href="#acanthus" transform="translate(-3 3) rotate(172) scale(.67)"/>
    <use href="#acanthus" transform="translate(3 3) rotate(8) scale(.67)"/>
    <path d="M0 8C-2 3-12 2-10-4C-8-7-5-5-4-6C-3-10 3-10 4-6C5-5 8-7 10-4C12 2 2 3 0 8Z" fill="url(#leaf)" stroke="#8b6129" stroke-width=".65"/>
    <path d="M0 6L0-7M-1 5L-4-5M1 5L4-5M-2 4L-8-3M2 4L8-3" stroke="#8c632d" stroke-width=".55"/>
    <path d="M-1 4L-1-6M-2 3L-5-4M1 3L3-4" stroke="#ffe9a6" stroke-width=".65"/>
    <ellipse cy="7" rx="2.5" ry="1.4" fill="url(#pearl)"/>
  </g>
</defs>
<!-- Stepped ogee, hollow, bead and inner sight edge, with a transparent centre. -->
<path d="M18 9H290Q304 9 304 23V65Q304 79 290 79H18Q4 79 4 65V23Q4 9 18 9ZM24 24Q19 24 19 29V59Q19 64 24 64H284Q289 64 289 59V29Q289 24 284 24Z" fill="url(#gilt)" fill-rule="evenodd" stroke="#795423" stroke-width="1"/>
<rect x="5.5" y="10.5" width="297" height="67" rx="12.5" stroke="#f8e1a0" stroke-width="1"/>
<rect x="8" y="13" width="292" height="62" rx="10" stroke="#8c642b" stroke-width="1.4"/>
<rect x="10" y="15" width="288" height="58" rx="8.5" stroke="#ebcb7e" stroke-width="1.2"/>
<rect x="14" y="19" width="280" height="50" rx="6.5" stroke="#8d672f" stroke-width="2.5"/>
<rect x="16" y="21" width="276" height="46" rx="5.5" stroke="url(#lip)" stroke-width="3"/>
<rect x="18.5" y="23.5" width="271" height="41" rx="4" stroke="#f3d997" stroke-width=".75"/>
''']

# Small beads catch a highlight; wider reel cuts interrupt the regular rhythm.
for x in range(34, 276, 4):
    for y in [20, 68]:
        svg.append(f'<ellipse cx="{x}" cy="{y}" rx="{1 if x % 12 else .55}" ry=".95" fill="url(#pearl)"/>')
for x in [10, 298]:
    for y in range(33, 59, 4):
        svg.append(f'<circle cx="{x}" cy="{y}" r="1.1" fill="url(#pearl)"/>')
for x, y, sx, sy in [(16, 18, 1, 1), (292, 18, -1, 1), (16, 70, 1, -1), (292, 70, -1, -1)]:
    svg.append(f'<use href="#corner" transform="translate({x} {y}) scale({sx} {sy})"/>')
for y, sy in [(15, 1), (73, -1)]:
    for x, sx in [(49, 1), (103, 1), (259, -1), (205, -1)]:
        svg.append(f'<use href="#scroll" transform="translate({x} {y}) scale({sx} {sy})"/>')
svg.append('<use href="#crest" transform="translate(154 10)"/><use href="#crest" transform="translate(154 78) scale(.8 -.8)"/>')
svg.append('</svg>')
(OUT / 'gilt-control-frame.svg').write_text('\n'.join(svg))

# Fine irregular warp/weft, warm sizing and sparse flax fibres. This is a
# seamless repeat at 2x display density, with no photographic source material.
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
print('Created gilt-control-frame.svg and control-linen.webp')
