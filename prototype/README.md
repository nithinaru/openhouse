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
4. **The delancey house.** Nothing is built yet, so the plot is a bank of drifting clouds tagged "ready to generate ✨". **next** opens "who else was there?". Tap people, then **send link**.
5. **Live build (~40 s).** Links go out and each friend moves from link sent → opened → adding photos → added ✓. The clouds part and the house is generated live, with no outline drawn ahead of time. Each arriving photo lands with a ring and shatters into coloured points that fly to where they belong. That area then resolves from a shimmering, grainy mosaic to a soft blur to sharp. Rooms finish in order: living room, then kitchen, then upstairs.
6. **Step inside.** Plays the 17 s 360° walkthrough inside the phone. When it ends: **proceed to shop 🛍️**, watch again, or start over.
7. **The fomo shop.** Tap ✕ during the video to go back to the ready house, which now has a "the fomo shop is open" card. Either way you reach the drop from `design/rebrand/fomo-shop`:
   - Six generated collectibles orbit the chrome "fomo" wordmark on a tilted 3D ring. It holds on each piece for about 4 s, and you can swipe, use the arrows, or tap a piece to bring it to the front.
   - Tap the front piece to open its detail sheet with options, then add it to the bag.
   - The bag shows each line, the "@ines, @theo + 9 others got the globe" sticker, and the total. **Pay** shows an "order placed" card. It's a demo, so nothing is charged.

## Controls
- **→ / ←** next or previous screen. On the build screen, → jumps to the end.
- **F** toggles 4× build speed. `?fast=1` starts at 4×.
- Narrower than 500 px (a real phone), it fills the screen with no device frame.

## Assets (`assets/`)
- `splash.jpg`, `map.jpg`, `house.jpg`, `av-*.jpg`: from the Paper file *Wish You Were Here — Mobile UI* (splash art, M2 toy map, A1/M7 diorama, M3 friends collage).
- `build-empty.jpg` is the sky with the house painted out, derived from `house.jpg`. The mosaic and blur stages are drawn from `house.jpg` at runtime, so every stage lines up pixel for pixel.
- `photos/`: thumbnails of the step-in walkthrough photos.
- `shop/`: product cutouts and the `fomo` wordmark, resized from `design/rebrand/fomo-shop/site/assets`.

## Backend visualizer (`backend.html`)

A 1440×900 animation of what happens behind the live build, in the Good Company visualizer style. Open `http://localhost:4320/prototype/backend.html`. It has to be served, not opened as a file, because the WebGL world loads the panorama as a texture.

1. **Who was there.** Opens on the hub with the five friends who were there (@maya, @theo, @ines, @jules, @sol), already confirmed.
2. **Camera rolls.** @maya's roll gets the full pass: on-device filters (time, ≤40 m, indoors, in focus, faces ok) cut it to the photos from that night, which lift into a stack beside her. @theo's runs faster, then the other three stacks fill in.
3. **Prepare.** All 25 photos stream into the hub (`photos.prepare`: dedupe, blur/exposure, view coverage), and the best 8 drop into the real World Labs request: `POST /marble/v1/worlds:generate`, `multi-image` + `reconstruct_images`, the same body `convex/worlds.ts` sends. The API returns `op_…`.
4. **Generate.** The API card opens into a live 360° world. The camera turns a full circle, and each photo lands as a print where it sits. From that spot the room materialises as Gaussian splats, from sparse blurry points to the sharp panorama. The HUD shows operation polling, camera poses, splat count (to 500k) and the `.spz` export. It's labelled as a time-lapse of ~5 min.
5. **wish you were here.** The world folds back into a circle, the circle collapses all the way out, and a sky opens from that point onto the black balloon wordmark (`assets/backend/finale-balloons.jpg`, cropped from `design/rebrand/create-a-moment/m1-v2-black-balloons.png`).

Controls: `space` pause, `r` restart, `f` fullscreen, `?speed=2`, `?loop=0`, `?start=world` (jump to generation), `?skip=30000` (fast-forward N ms).
Assets: `assets/backend/` has the living-room panorama and photos from `design/rebrand/step-inside/streetview/assets/`.
