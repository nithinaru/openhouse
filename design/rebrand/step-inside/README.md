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

`streetview-step-in.mp4` (13s, 780×1688) — one clean pass through the finished moment:

1. **0–1.5s** ready screen; tap **step in**.
2. **1.5–3s** camera dives into the floating house, through the living room.
3. **3–6.5s** standing in the living room (Street View-style): the room is built from the iPhone photo, and other people's photos hang in space where they were taken (@theo digicam, @ines film, @sol 0.5x). A floor chevron points to the kitchen; the view sways as you look around.
4. **6.5–7.6s** tap the chevron → push forward: the room stretches past you, the photos fly by, the mini-map dot slides into the kitchen.
5. **7.6–13s** standing in the kitchen with a whole new set of photos around you (@jules digicam, @maya film, @sol 0.5x) and a new chevron toward the stairs.

Source lives in `streetview/`: `index.html` is the scene (one `render(t)` function, autoplays when opened in a browser), `capture.mjs` renders frames with headless Chrome, `encode-mp4.swift` turns them into the MP4.

```bash
node design/rebrand/step-inside/streetview/capture.mjs /tmp/frames 30 13000
swift design/rebrand/step-inside/streetview/encode-mp4.swift /tmp/frames design/rebrand/step-inside/streetview-step-in.mp4
```
