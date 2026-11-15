# Step inside — walking through a moment

What happens after **step inside** on `../create-a-moment/m7-moment-ready`.

## How navigation works

- **Every photo is a place to stand.** Each photo is anchored where it was taken. Those spots show as glowing footprints on the floor; tap one to move there (Street View-style, but the nodes are where friends actually stood).
- **The camera stays visible.** On landing, the real photo resolves over the 3D reconstruction with its original look intact: iPhone HDR, early-2000s digicam (hard flash, red-eye, orange date stamp), disposable film (grain, light leak), iPhone 0.5x (barrel distortion). A chip says which camera and who.
- **Always oriented.** Mini-map with your position + facing cone; the cutout of whose view you're in stands beside you.
- **Same moment, other angles.** When several people shot the same moment, swipe between their angles.

## Screens

1. `s1-standing-in-the-room` — your own spot (iPhone). Footprints for @theo (digicam), @ines (film), @sol (0.5x), mini-map, time chip, look around.
2. `s2-standing-where-theo-stood` — after hopping: theo's flash photo anchored over the blurred reconstruction, his cutout beside you, prev/next people, "4 angles of this moment".
3. `s3-one-moment-every-angle` — "the ghost arrives", 11:12 pm: swipeable stack of 4 angles with camera + person strip, "stand where ines stood".
4. `s4-who-stood-where` — top-down floor plan: everyone's spot and view cone at 11:12 pm, uncaptured hall marked "no photos yet +", time slider to replay the night.

## Motion

- `motion-storyboard.png` — keyframes for the 1.8s step-inside move (tap → dive → through the cut wall → eye level → photo snaps + footprints pop), plus the footprint hop spec (tap 0–120ms, glide 120–720ms, snap 720–1000ms) and per-camera touches (digicam flash frame, film shutter haptic, Live Photo playback, 0.5x warp settle). Reduce motion falls back to a 300ms crossfade.
- `motion-study-loop.mp4` — generated animated loop of the dive, for feel and pacing (not the exact app render).

All photos are AI-generated placeholders of one room in four camera styles; people are fictional.

## Street View walkthrough animation

![step in → walk forward](streetview-step-in-preview.gif)

`streetview-step-in.mp4` (17s, 780×1688). You stand *inside* the room and the photos are the room around you, Street View-style:

1. **0–1.5s** ready screen; tap **step in**.
2. **1.5–3s** the camera dives into the floating house.
3. **3–9s** inside the living room. The 3D room underneath is a rough, dim reconstruction with dark gaps where nobody shot. Over it, ~19 photos are cut in all the way around you, mostly people **posing** (group squeezes, couples, friends on the stairs, a mirror selfie, the sofa squad) plus a few candids, at their own size, height and tilt. Some are white-bordered prints, some hard cuts, some feather into the room; most don't line up with their neighbours. Any direction shows 3–5 at once. A chip names whose photo is in front of you.
4. **9–10.4s** turn to the kitchen doorway, tap the floor arrow, and get pushed forward through it.
5. **10.4–17s** inside the kitchen: a whole new set of ~18 cut-up photos (candy toasts, the punch bowl, the fridge line-up, the skeleton chef, a dance dip), plus an arrow back to the living room.

### How the photos were made (all AI-generated placeholders)

1. One seamless 360° panorama per room (`streetview/assets/pano-*.jpg`), shown blurred and dimmed as the reconstruction.
2. For every photo, `streetview/crop_spot.py` cuts a reference from the panorama at the spot and shape it was taken (square, strip, landscape, portrait).
3. The image model makes a new photo there: mostly posed shots (`pose-*.jpg`), plus candids (`cand-*.jpg`), each in a camera style (iPhone, flash digicam with date stamp, disposable film, 0.5x, selfie).
4. `streetview/index.html` wraps the panorama on a 3D cylinder and scatters the photos around it, each marked `cut`, `print` or `blend`.

### Re-render

```bash
node design/rebrand/step-inside/streetview/capture.mjs /tmp/frames 30 17000
swift design/rebrand/step-inside/streetview/encode-mp4.swift /tmp/frames design/rebrand/step-inside/streetview-step-in.mp4
```
