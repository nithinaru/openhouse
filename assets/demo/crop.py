"""Cut the standees out of Rohan's a2 design and crop room imagery for stop photos.

The standees have a thick white outline over a dark room photo, so: mark near-white
pixels as outline, flood-fill the dark background in from the crop edges, and keep
everything the fill could not reach (the figure plus its outline).
"""
import sys
from collections import deque
from PIL import Image, ImageFilter

ROOT = sys.argv[1]
OUT = f"{ROOT}/assets/demo"
a2 = Image.open(f"{ROOT}/design/rebrand/app/a2-room-cutouts.png").convert("RGB")


def cut(img, box, name, white=190, close=7, erase=(), seal=()):
    img = img.copy()
    if seal:  # the design clips some heads flat; paint the missing outline back on
        from PIL import ImageDraw
        d = ImageDraw.Draw(img)
        for s_ in seal:
            d.rounded_rectangle(s_, radius=3, fill=(250, 250, 250))
    crop = img.crop(box)
    w, h = crop.size
    # near-white = outline. Dilate it so small gaps in the outline don't let the fill leak in.
    wm = crop.convert("L").point(lambda v: 255 if v >= white else 0)
    sat = crop.convert("HSV").split()[1].point(lambda v: 255 if v < 60 else 0)
    from PIL import ImageChops
    wm = ImageChops.multiply(wm, sat).filter(ImageFilter.MaxFilter(close))
    wp = wm.load()
    isw = [[wp[x, y] > 0 for x in range(w)] for y in range(h)]
    for (ex0, ey0, ex1, ey1) in erase:  # name-tag pills that touch the base: treat as background
        for y in range(max(0, ey0 - box[1]), min(h, ey1 - box[1])):
            for x in range(max(0, ex0 - box[0]), min(w, ex1 - box[0])):
                isw[y][x] = False
    bg = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not isw[y][x]:
                bg[y][x] = True
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not isw[y][x] and not bg[y][x]:
                bg[y][x] = True
                q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx] and not isw[ny][nx]:
                bg[ny][nx] = True
                q.append((nx, ny))
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            if not bg[y][x]:
                mp[x, y] = 255
    # keep only the largest blob: drop candle and string-light specks
    seen = [[False] * w for _ in range(h)]
    best = []
    for sy in range(h):
        for sx in range(w):
            if mp[sx, sy] and not seen[sy][sx]:
                comp = []
                dq = deque([(sx, sy)])
                seen[sy][sx] = True
                while dq:
                    x, y = dq.popleft()
                    comp.append((x, y))
                    for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                        if 0 <= nx < w and 0 <= ny < h and mp[nx, ny] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            dq.append((nx, ny))
                if len(comp) > len(best):
                    best = comp
    mask = Image.new("L", (w, h), 0)
    mp = mask.load()
    for x, y in best:
        mp[x, y] = 255
    # undo the dilation on the outside edge
    mask = mask.filter(ImageFilter.MinFilter(close - 2)).filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.GaussianBlur(0.6))
    out = crop.convert("RGBA")
    out.putalpha(mask)
    bbox = mask.point(lambda v: 255 if v > 128 else 0).getbbox()
    if bbox:
        out = out.crop(bbox)
    out.save(f"{OUT}/people/{name}.png", optimize=True)
    print(name, out.size)


def room(src, box, name, rotate=0.0):
    img = Image.open(f"{ROOT}/design/{src}").convert("RGB")
    if rotate:
        cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
        img = img.rotate(rotate, resample=Image.BICUBIC, center=(cx, cy))
    c = img.crop(box)
    c.save(f"{OUT}/rooms/{name}.jpg", quality=86)
    print(name, c.size)


if __name__ == "__main__":
    import os
    os.makedirs(f"{OUT}/people", exist_ok=True)
    os.makedirs(f"{OUT}/rooms", exist_ok=True)
    # @theo hoodie + laptop -> rohan
    cut(a2, (540, 812, 736, 1262), "rohan", close=11, seal=[(608, 835, 666, 842)], erase=[(560, 1244, 690, 1300)])
    # @sol green sweater -> sol
    cut(a2, (186, 878, 362, 1300), "sol", close=13, erase=[(225, 1288, 330, 1340)])
    # @ines ghost -> ines (tag sits above her, outside the box)
    cut(a2, (370, 628, 520, 975), "ines")
    room("rebrand/app/a3-their-night.png", (340, 606, 690, 742), "kickoff-hall", rotate=-4)
    room("rebrand/onboarding/o4-where-was-it.png", (490, 1002, 712, 1222), "hacking-floor", rotate=-5)
    room("f-interior-only/f2-darkroom-inside-360.png", (380, 1060, 780, 1340), "hacking-desks")
