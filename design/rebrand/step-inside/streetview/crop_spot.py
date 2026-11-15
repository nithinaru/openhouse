"""Crop a reference for a candid shot from a 360° panorama.

usage: python3 -I crop_spot.py <pano.jpg> <out.jpg> <centerDeg> <spanDeg> <aspectW:aspectH> [vOffset=0]
centerDeg: where in the room the photo was taken toward (0 = left edge of the panorama)
spanDeg:   horizontal field of view to keep
vOffset:   shift the crop up (-) or down (+) as a fraction of panorama height
"""
import sys
from PIL import Image

pano_path, out_path = sys.argv[1], sys.argv[2]
center, span = float(sys.argv[3]), float(sys.argv[4])
aw, ah = (float(v) for v in sys.argv[5].split(":"))
voff = float(sys.argv[6]) if len(sys.argv) > 6 else 0.0

pano = Image.open(pano_path).convert("RGB")
W, H = pano.size
wide = Image.new("RGB", (W * 3, H))
for i in range(3):
    wide.paste(pano, (i * W, 0))
cw = round(W * span / 360)
ch = min(H, round(cw * ah / aw))
cx = W + W * center / 360
cy = H / 2 + voff * H
top = int(min(max(0, cy - ch / 2), H - ch))
wide.crop((round(cx - cw / 2), top, round(cx - cw / 2) + cw, top + ch)).save(out_path, quality=92)
print(out_path, cw, ch)
