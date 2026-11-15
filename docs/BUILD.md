# Openhouse — build brief (working name)

> **One line:** Your camera roll already remembers the trip — where you stood, which way you faced, who was there, what it sounded like. Openhouse plays it back as a narrated, walk-through memory you never had to journal, and lets you frame it.

Hackathon: YC Consumer Mobile Hackathon, Sun Nov 15. **Code freeze 4:00 PM. Demo video + submission done by 4:45 PM. Hard deadline 6:00 PM.**

---

## 0. Ground rules (read first)

- All code written today, after 10:00 AM.
- **Must use Capy, Revyl and Convex** or we are not eligible. Capy writes most of the app (see §8).
- Stack is fixed: **Expo (React Native) + Expo Router + TypeScript**, **Convex** backend, **Revyl** cloud iPhone checks.
- Git: commit titles are short, direct, human ("add trip clustering", "fix replay audio sync"). **Never** add Co-Authored-By trailers, session links or "Generated with" lines to commits or PRs.
- Server-only SDKs (`supermemory`, `openai`, `@whop/sdk`, World Labs, Keiki) live in **Convex actions only**. Never import them in the Expo app.
- Secrets are already set as Capy project env vars / Convex env. The app only needs `EXPO_PUBLIC_CONVEX_URL`.
- The designer owns all visual decisions. Engineers build with the tokens in `src/theme/` and plain placeholder components; don't invent styling.
- Every feature needs a **demo-mode fallback** (cached result) so the live demo never waits on a network call.

---

## 1. What the user experiences

1. **Open → grant Photos.** No typing, ever.
2. App reads recent photos + their EXIF, clusters them into **moments** (stops) and **trips**, and enriches each stop (place name, weather then, golden hour, a nearby fact, ambient sound from any video there).
3. Notification: *"Your SF hackathon day is ready."*
4. **Replay** (the hero screen): the map camera flies stop to stop at a low pitch, photos fan out, a narrator voice tells the story, real ambient audio plays under it, haptics tick as pins drop, the UI tints to the light of the moment, and each stop draws a **view cone** showing which way you were facing.
5. **People:** friends you scanned (QR) appear as small round face pins at the spot you met. At shared stops you can **swipe to their photos** — the same moment from their angle.
6. **Step inside:** for a stop with enough photos of one space, tap **"Walk in"** → a navigable 3D world generated from those photos (World Labs).
7. **Frame it:** generate a minimal poster of the trip (route line, stops, face pins, typography, trip palette), pick a frame style, buy the print through Whop (sandbox).

---

## 2. Scope tiers

**P0 — must ship by 4:00 (this is the demo)**
- Photo ingest + EXIF parse + clustering into moments/trip
- Trip screen + **Replay** (map flyover, photo fan-out, narration audio, haptics, light tint)
- QR scan pairing → face pin at location (realtime on both phones)
- Swipe to friend's photo at a shared stop
- **Walk in**: SHARP splat per stop from its hero photo (pre-generated + cached for demo)
- Poster render + **Whop** sandbox checkout
- Revyl check passing on the cloud iPhone (with seeded/demo data)

**P1 — if on time by ~2:45**
- Ambient audio from videos at a stop
- View cones from compass heading
- Weather-then + golden hour + one Wikipedia fact in narration
- Keiki text: "Your trip is ready" (fallback: local push via `expo-notifications`)

**P2 — cut first**
- Supermemory "on this day" / "last time you saw X"
- Screenshot parsing (tickets, boarding passes)
- Retroactive "were you with X here?" matching
- Multiple frame styles (ship one)

Cut order if behind: P2 → Keiki → Wikipedia/weather → view cones. **Never cut:** Replay, people pins, Walk in, Whop frame.

---

## 3. Architecture

```
iPhone (Expo)                                  Convex
─────────────                                  ──────
expo-media-library ─┐                          tables: users, trips, moments,
  assets + EXIF     │  on-device:              photos, people, pairings,
expo-location       ├─ parse → cluster ─────▶  worlds, posters, orders
  reverse geocode   │  (upload summary +       │
expo-sensors        ┘   ~3 thumbs/stop)        ├─ actions (Node):
                                               │   enrichStop  → Open-Meteo, suncalc, Wikipedia,
Replay screen ◀──── useQuery(trip) ────────────│                 OpenAI vision (caption, scene, palette)
react-native-maps (camera anim)                │   narrateTrip → OpenAI text + TTS → audio file in storage
expo-av / expo-audio (narration + ambient)     │   buildStopSplat → Replicate SHARP → .ply in storage
expo-haptics                                   │   checkout    → Whop sandbox → purchase_url
react-native-webview (3D splat viewer)         │   notify      → Keiki (or skip)
react-native-svg + view-shot (poster)          ├─ http: /whop (webhook → mark order paid)
expo-camera (QR scan)                          │         /t/:shareId (web view of trip, optional)
                                               └─ file storage: thumbs, audio, posters
```

---

## 4. Data model (Convex `convex/schema.ts`)

```ts
users:    { name, avatarStorageId?, shareCode }            // shareCode encoded in QR
trips:    { userId, title, startAt, endAt, palette: string[],
            story?: string, narrationStorageId?, narrationCues?: {momentId, atMs}[],
            status: "ingesting"|"enriching"|"ready" }
moments:  { tripId, userId, startAt, endAt, lat, lng, placeName?,
            headingDeg?, altitudeM?, avgIso?, isGoldenHour?, weather?: {tempF, summary},
            fact?: string, caption?: string, sceneTags?: string[],
            heroPhotoId?, ambientVideoStorageId?, order: number }
photos:   { momentId, userId, takenAt, lat?, lng?, headingDeg?, altitudeM?,
            lens?: "front"|"wide"|"ultrawide"|"tele", subtypes: string[],
            isFavorite: boolean, thumbStorageId, w, h }
pairings: { userA, userB, at, lat, lng, momentA?, momentB? } // a scan = a face pin
worlds:   { momentId, operationId, status: "pending"|"ready"|"failed",
            splatUrl?, viewerUrl? }
posters:  { tripId, style, storageId }
orders:   { posterId, userId, whopCheckoutId, status: "pending"|"paid" }
```

---

## 5. Pipelines (implementation notes)

### 5.1 Ingest + EXIF (client)
- `MediaLibrary.getAssetsAsync({ first: 400, sortBy: creationTime, mediaType: [photo, video] })`, then `getAssetInfoAsync` per asset (batch with concurrency ~8; this is the slow part).
- iOS EXIF arrives as nested dicts. **Log one real asset first and confirm key names**, expected roughly:
  - `exif["{GPS}"]`: `Latitude/LatitudeRef`, `Longitude/LongitudeRef`, `Altitude`, `ImgDirection` (compass heading), `Speed`
  - `exif["{Exif}"]`: `ISOSpeedRatings`, `ExposureTime`, `BrightnessValue`, `LensModel`, `FocalLenIn35mmFilm`
  - `asset.mediaSubtypes`: `livePhoto`, `panorama`, `depthEffect` (portrait), `hdr`, `screenshot`, `highFrameRate`
- Lens: `LensModel` containing "front" → front camera (likely people present).
- Upload only: per-photo metadata + a ~512px thumbnail (`expo-image-manipulator`) for ≤3 hero candidates per moment. Never upload full-res.
- Handle iOS **limited photo access** gracefully.

### 5.2 Clustering (client, pure TS, unit-testable)
- Sort by `takenAt`. New moment when gap > 90 min **or** distance > 1 km (haversine).
- Moment center = median lat/lng; heading = circular mean of `ImgDirection`.
- Trip = contiguous moments within a day window (for the demo: "today" is one trip).
- Hero photo = favorite > panorama > most-photographed burst > highest brightness.
- Reverse geocode once per moment (`Location.reverseGeocodeAsync`).

### 5.3 Enrichment (Convex action `enrichStop`)
- Weather then: Open-Meteo archive/forecast API by lat/lng/time (no key).
- Golden/blue hour: `suncalc` with time + lat/lng.
- One fact: Wikipedia geosearch (`list=geosearch`, radius 500 m) → summary of top hit → 1 sentence.
- OpenAI vision on 1–2 thumbs: `{ caption, sceneTags, signText, dominantColors }` as JSON.
- Trip palette = merged dominant colors across stops (5 swatches).

### 5.4 Narration (Convex action `narrateTrip`)
- OpenAI text: warm, specific, second person, ~20–40 words per stop, uses times/places/weather/fact/people. No clichés, no exclamation marks.
- OpenAI TTS → one audio file, plus per-stop cue timestamps (generate per-stop clips and concatenate, or one clip per stop played sequentially — **sequential clips is simpler, do that**).

### 5.5 Replay engine (client)
- Timeline: for each stop → `mapRef.animateCamera({ center, pitch: 55, heading: stop.headingDeg ?? 0, zoom }, { duration: 2500 })` → pin drop + `Haptics.impactAsync(Light)` → photos fan in → play stop's narration clip (+ ambient audio at 20% volume if present) → next.
- Background tint from `isGoldenHour` / `avgIso` / hour of day (designer supplies the color ramp).
- View cone: small SVG wedge rotated to `headingDeg` on the stop marker.
- Person pins: avatar circle with ring + `Haptics.impactAsync(Medium)`.

### 5.6 People (QR pairing)
- Each user has a `shareCode`; QR encodes `openhouse://pair/<code>` (and/or a web URL).
- Scan with `expo-camera` → mutation `pair(code, lat, lng)` → both users get a pairing row → realtime pin appears on both phones.
- Shared stop = pairing within 2 h / 1 km of a moment for both users → "their angle" swipe shows the friend's thumbs for that moment.

### 5.7 Walk in — every stop becomes a memory you can step into (Convex action `buildStopSplat`)
- **Model:** Apple SHARP (github.com/apple/ml-sharp): single photo → 3D Gaussian splat (.ply). Hosted on Replicate (`kfarr/sharp-ml`, ~18 s on a T4). Needs `REPLICATE_API_TOKEN` in Convex env.
- Run it on each moment's hero photo during enrichment, store the .ply in Convex file storage, and save `splatUrl` on the moment. Pre-run all demo stops by 3:00 PM.
- **Imperfection is the aesthetic.** Keep the splat smear, blur and missing edges on purpose. It should look like a memory, not a scan: retro game, dream simulation.
- Viewer: `react-native-webview` loading one self-contained HTML page (three.js plus a Gaussian-splat loader for .ply) with:
  - low internal render resolution upscaled with nearest-neighbor (soft PS1-style pixelation)
  - ordered dithering and a limited palette tinted by the trip palette
  - a heavy radial vignette, with edges dissolving into fog or black (no hard borders; the memory fades out)
  - film grain and slight chromatic aberration
  - a slow automatic camera drift (small dolly and sway, never far enough to expose holes), with gyroscope tilt nudging the camera
  - a fade from the 2D photo into 3D, so the photo "opens up"
- The narration for that stop keeps playing over the scene.
- **Walk mode (Street View for memories):** consecutive photos in a moment become a walkable path.
  - Order the moment's photos by `takenAt`. Each photo is one node with its own SHARP splat.
  - Show soft, glowing arrows or footprints on the floor pointing to the next node(s). Turn left or right from the change in EXIF `headingDeg`; forward follows time order.
  - Tap or swipe forward: the camera dollies into the current splat (~1.2 s) while it dissolves into fog, and the next splat fades up from the fog, roughly aligned to its heading. The fog hides misalignment, so nodes don't need real 3D registration.
  - Swipe back to return. Long-press to drop back to the flat photo.
  - Preload the next 2 splats.
  - Stretch only: estimate real relative camera poses for a room's photos with VGGT and place the splats in one shared space.
- Stretch only: a World Labs multi-image world for one room ($5 minimum API credit, ~5 min generation). Not required.
  - **Status (built):** `convex/worlds.ts` has `worlds:build` (action, `{ momentId, imageUrls }` → `{ worldId, mode: 'live'|'demo', reused }`), `worlds:forMoment` (query) and internal `worlds:poll` (every 10 s, gives up after 10 min, saves the 500k SPZ + `world_marble_url`). Client: the stop's Walk in button reads "build this room in 3d" when there's no splat yet and opens `src/app/world/[id].tsx` (photos tile in, real stage line, polls every 3 s, then auto-opens Walk in with the splat). The viewer keeps flipX (180° about X) for Marble's OpenCV frame and shows a "built with world labs" chip. With no `WORLDLABS_API_KEY` it runs in **demo mode**: no API call, `operationId` = `demo:<ts>`, ready after 25 s with the sample splat, labeled in the UI. Enable with `npx convex env set WORLDLABS_API_KEY <key>`.

### 5.8 Poster + Whop
- Poster = `react-native-svg`: project stop coords to the canvas, single-weight route line, stop dots, face circles, title, dates, footer stats ("14.2 mi · 6 stops · 3 people"), trip palette. Capture with `react-native-view-shot`, upload to storage.
- Whop (sandbox, per hackathon guide): action creates checkout → returns `purchase_url` → open with `expo-web-browser`. HTTP action `/whop` handles `payment.succeeded` → marks order paid. **Unlock from the Convex record, not on browser close.** Test card 4242 4242 4242 4242.

### 5.9 Keiki (P1) and Supermemory (P2)
- Keiki: when trip status → `ready`, send "Your <title> is ready" via the Telegram/shared iMessage channel. Fallback: `expo-notifications` local push.
- Supermemory: `add` each moment as a memory namespaced by user id; `search` for "on this day" / "last time with <name>". Convex actions only; v5 calls only.

---

## 6. Screens (designer owns visuals)

1. Onboarding — one screen, one button: "Let Openhouse read your photos"
2. Ingesting — progress as stops appear on a map one by one (this *is* the loading state)
3. Trips — list/stack of trip cards
4. **Replay** — full-screen map film; tap to pause; stop drawer with photos + "their angle"
5. Stop detail — photos, caption, weather, fact, people, **Walk in** button
6. Walk in — full-screen 3D viewer
7. People — your QR + scanner
8. Frame — poster preview, style picker (1 style is fine), "Frame this · $39" → Whop

---

## 7. Demo plan (2 minutes, two real phones)

**Capture during the day at YC (do this early):**
- [ ] Walk path: walk a route through the office taking a photo every 3–4 steps facing forward (and 2–3 photos turning at each corner). 8–12 photos = one walkable memory.
- [ ] By 12:30: test SHARP on 3 real photos from the office (good depth: a hallway, people at a table, the YC sign with background behind it). Avoid flat walls and glass.
- [ ] Through lunch: photos at 4–6 distinct spots in and around the office, including at least one **10-second video** per spot (ambient sound), a front-camera selfie with teammates, and one shot of a sign (OCR'd caption).
- [ ] Both teammates shoot the same spot at the same time → guaranteed "their angle" swipe.
- [ ] Scan each other's QR at one spot → face pins.
- [ ] By 3:00: run full ingest on both real phones, verify the trip, cache narration + world.

**On stage:**
1. "You never journal. Your phone already remembers." Open the app → "Your YC hackathon day is ready."
2. Play the Replay ~30 s, **sound on**: flyover, narration, real ambient audio, pins dropping.
3. At a shared stop, swipe to the teammate's photo of the same moment.
4. Tap **Walk in** → move through the 3D YC room built from 8 photos.
5. **Frame it** → pay with the test card → order confirmed.
6. (P1) Phone buzzes: Keiki text.
7. Close: "Every photo already knows where you stood, which way you faced and who was there. We just play it back."

**Demo safety:** a `DEMO_TRIP_ID` env flag loads the cached trip instantly; all generated assets (narration, world, poster) cached in Convex.

---

## 8. Who builds what

**Capy** (required; give it the backend, integrations and device builds — it has the env vars and Revyl phones). One task per thread:
1. Scaffold: the hackathon guide's first prompt (Expo Router + TS + Convex + Revyl check), app idea = this brief §1.
2. Convex schema (§4) + core queries/mutations (trips, moments, photos, pairings) + file upload flow.
3. `enrichStop` action (§5.3).
4. `narrateTrip` action + TTS (§5.4).
5. `buildStopSplat` action via Replicate SHARP (§5.7) — **start this thread first among integrations; it gates the demo.**
6. Whop checkout + `/whop` webhook (§5.8) using the hackathon guide prompt.
7. Keiki notify (§5.9), then Supermemory if time.
8. Revyl: proof of changes on PRs + a validation check: "open the demo trip, replay starts, poster screen opens."
9. iOS builds onto the cloud phone after each merge.

**Claude Code** (local, needs the real phone + Expo Go; owns client logic that must be tested on-device):
- `src/lib/ingest/*` — media library read, EXIF parse (§5.1), thumbnails, upload
- `src/lib/cluster/*` — clustering + hero pick (§5.2), with unit tests on fixture JSON
- `src/features/replay/*` — Replay engine (§5.5)
- `src/features/walkin/*` — WebView splat viewer (§5.7)
- `src/features/poster/*` — SVG poster + view-shot (§5.8)
- `src/features/people/*` — QR show/scan (§5.6)

**Designer:** `src/theme/*` tokens (type, color ramps for light-of-day tint, spacing), screen designs, poster layout, app icon, demo video edit.

**Collision rules:** Capy owns `convex/**` and integration code; Claude Code owns `src/lib/**` and `src/features/**`; designer owns `src/theme/**` and assets. Pull before every task, small PRs, merge often. If Claude Code needs a backend change, write it as a request for a Capy thread instead of editing `convex/`.

---

## 9. Timeline (now → 4:45)

| Time | Capy | Claude Code (Nithin) | Designer |
|---|---|---|---|
| 11:45–12:30 | Scaffold → schema → `buildWorld` | Ingest + EXIF on real phone | Tokens, Replay + Stop screens |
| 12:30–1:30 | `enrichStop`, uploads | Clustering + Trips list | Capture the 8-photo room, start world job |
| 1:30–2:45 | `narrateTrip`, Whop | Replay engine + people/QR | Poster layout, light-tint ramp |
| 2:45–3:30 | Keiki, Revyl check | Walk in viewer + poster | Polish pass on real phone |
| 3:30–4:00 | Builds, fix PRs | Demo mode + full run on both phones | Icon, splash, video shot list |
| **4:00** | **Code freeze** | | |
| 4:00–4:45 | — | Record demo video, write submission | Edit video |
| 4:45–6:00 | Buffer: resubmit, rehearse finalist demo | | |

---

## 10. Submission checklist

- [ ] Repo public, README with one-liner, screenshots, how Capy/Revyl/Convex were used
- [ ] `hackathon.md` build log (Capy hackathon skill) merged
- [ ] Revyl check passing, screenshot of the verdict
- [ ] Demo video (≤2 min): replay with sound, swipe angle, walk in, frame + checkout
- [ ] Sponsor tracks named in the submission: Capy, Revyl, Convex, Whop, Keiki, OpenAI (+ Supermemory if shipped)
- [ ] Submitted well before 6:00 PM
