# wish you were here — clickable prototype

A controlled, browser-only demo of the create-a-moment flow. Nothing is sent anywhere; every step is scripted.

```bash
python3 -m http.server 4320 --bind 127.0.0.1   # from the repo root
open http://localhost:4320/prototype/
```

Serve from the **repo root**: the step-in video is loaded from `../design/rebrand/step-inside/streetview-step-in.mp4`.

## Flow
1. **Splash.** "wish you were here" in liquid metal with pink balloons → **get started**.
2. **Photo access.** "let us see the night" → **allow photos** → iOS-style permission alert → **Allow Full Access** → camera roll scan.
3. **Map.** City map with photo clusters and a pulsing "event detected here" pin. Tap the pin for a GTA-style dive: pull back, then zoom in with speed lines and a flash.
4. **The delancey house.** The house drops in from the zoom → **next** opens "who else was there?". Tap people, then **send link**.
5. **Live build (~40 s).** Links go out and each friend moves from link sent → opened → adding photos → added ✓. Photos fly into the house, which builds from an empty sky: a wireframe rises from the floor, then each room fills in (living room, then kitchen, then upstairs).
6. **Step inside.** Plays the 17 s 360° walkthrough inside the phone.

## Controls
- **→ / ←** next or previous screen. On the build screen, → jumps to the end.
- **F** toggles 4× build speed. `?fast=1` starts at 4×.
- Narrower than 500 px (a real phone), it fills the screen with no device frame.

## Assets (`assets/`)
- `splash.jpg`, `map.jpg`, `house.jpg`, `av-*.jpg`: from the Paper file *Wish You Were Here — Mobile UI* (splash art, M2 toy map, A1/M7 diorama, M3 friends collage).
- `build-empty.jpg` (the sky with the house painted out) and `build-wire.png` (an edge-traced wireframe) are derived from `house.jpg`, so every build stage lines up pixel for pixel.
- `photos/`: thumbnails of the step-in walkthrough photos.
