"""Cut a 360° equirectangular panorama into overlapping portrait views.

usage: python3 -I slice_pano.py <pano.jpg> <outDir> <prefix> [count=6] [spanDeg=70]
Writes <prefix>-a<deg>.jpg crops centred every 360/count degrees, wrapping across the seam.
"""
import sys
from pathlib import Path
from PIL import Image

pano_path, out_dir, prefix = sys.argv[1], Path(sys.argv[2]), sys.argv[3]
count = int(sys.argv[4]) if len(sys.argv) > 4 else 6
span = float(sys.argv[5]) if len(sys.argv) > 5 else 70.0

pano = Image.open(pano_path).convert("RGB")
W, H = pano.size
# tile the panorama 3x wide so crops can wrap past either edge
wide = Image.new("RGB", (W * 3, H))
for i in range(3):
    wide.paste(pano, (i * W, 0))

tw = round(W * span / 360)          # crop width in px
th = round(tw * 4 / 3)              # portrait 3:4, like a phone photo
top = max(0, (H - th) // 2)         # centred on the horizon
out_dir.mkdir(parents=True, exist_ok=True)
for k in range(count):
    deg = round(k * 360 / count)
    cx = W + W * deg / 360          # centre in the middle copy
    box = (round(cx - tw / 2), top, round(cx - tw / 2) + tw, top + th)
    wide.crop(box).save(out_dir / f"{prefix}-a{deg:03d}.jpg", quality=92)
print(f"{count} crops of {tw}x{th} from {W}x{H}")
