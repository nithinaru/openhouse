# Hackathon log

- **Project:** Openhouse
- **Event:** YC Consumer Mobile Hackathon
- **What it does:** Turns your camera roll into a narrated, walk-through replay of your day: where you stood, which way you faced, and who was there.
- **Live app:** not deployed
- **Repo:** private
- **Frontend:** not deployed
- **Convex deployment:** https://trustworthy-anteater-9.convex.cloud
- **Components:** none
- **Convex features:** schema, indexes, queries, mutations, file storage
- **Auth:** none
- **AI models:** none
- **Started:** 2026-11-15T19:38:19Z
- **Last updated:** 2026-11-15T20:45:51Z

## Log

### 2026-11-15 - 9bf42d2
Scaffolded the Expo Router app with the route skeleton (trips, onboarding, trip, stop, walk in, people, frame), client types for trips, moments, photos, people and pairings, and a cached demo trip (`src/lib/types.ts`, `src/lib/demo/demoTrip.ts`).

### 2026-11-15 - 083677b
Built the trip poster and frame screen, QR pairing on the people screen, and the replay map film with stop markers, photo fan-out, person pins and the stop detail sheet (`src/features/poster/`, `src/features/people/`, `src/features/replay/`).

### 2026-11-15 - 178d48a
Added on-device photo ingest from the media library, EXIF parsing and clustering of photos into moments, with unit tests (`src/lib/ingest/`, `src/lib/cluster/`).

### 2026-11-15 - 83daa00
Added the walk-in viewer that renders a SHARP Gaussian splat in a WebView with a dreamy low-res look, plus ESLint and expo-speech (`src/features/walkin/`).

### 2026-11-15 - 229c415
Reworked the home screen with a live ingest map and trip naming, turned replay into a narrated film, and polished the stop pager, framed posters and pairing (`src/app/`, `src/features/replay/`).

### 2026-11-15 - 18f6148
Added the Convex schema for users, trips, moments, photos, pairings, worlds, posters and orders with indexes, trip queries, moment, photo, pairing and user mutations, an upload URL flow on file storage, and a demo trip seed (`convex/schema.ts`, `convex/trips.ts`, `convex/files.ts`, `convex/seed.ts`). Convex features: schema, indexes, queries, mutations, file storage.

### 2026-11-15 - cb8e9fe
Added the Ask your day screen and a demo panel, and loaded trips from Convex through an HTTP client with an offline fallback to the cached demo trip (`src/app/ask/[id].tsx`, `src/app/demo.tsx`, `src/lib/data/trips.ts`).

### 2026-11-15 - working tree
Wrapped the root layout in `ConvexProvider` reading `EXPO_PUBLIC_CONVEX_URL` so screens can use realtime queries, and verified an iOS Release build on a Revyl cloud iPhone opens the home screen (`src/app/_layout.tsx`).
