# Hackathon log

- **Project:** Openhouse
- **Event:** YC Consumer Mobile Hackathon
- **What it does:** Turns your camera roll into a narrated, walk-through replay of your day: where you stood, which way you faced, and who was there.
- **Live app:** not deployed
- **Repo:** private
- **Frontend:** not deployed
- **Convex deployment:** https://trustworthy-anteater-9.convex.cloud
- **Components:** none
- **Convex features:** schema
- **Auth:** none
- **AI models:** none
- **Started:** 2026-11-15T19:38:19Z
- **Last updated:** 2026-11-15T20:35:48Z

## Log

### 2026-11-15 - 9bf42d2
Scaffolded the Expo Router app with the route skeleton (trips, onboarding, trip, stop, walk in, people, frame), client types for trips, moments, photos, people and pairings, and a cached demo trip (`src/lib/types.ts`, `src/lib/demo/demoTrip.ts`).

### 2026-11-15 - 083677b
Built the trip poster and frame screen, QR pairing on the people screen, and the replay map film with stop markers, photo fan-out, person pins and the stop detail sheet (`src/features/poster/`, `src/features/people/`, `src/features/replay/`).

### 2026-11-15 - 178d48a
Added on-device photo ingest from the media library, EXIF parsing and clustering of photos into moments, with unit tests (`src/lib/ingest/`, `src/lib/cluster/`).

### 2026-11-15 - 83daa00
Added the walk-in viewer that renders a SHARP Gaussian splat in a WebView with a dreamy low-res look, plus ESLint and expo-speech (`src/features/walkin/`).

### 2026-11-15 - working tree
Connected the app to Convex: installed `convex`, provisioned the dev deployment, added an empty schema, and wrapped the root layout in `ConvexProvider` reading `EXPO_PUBLIC_CONVEX_URL` (`convex/schema.ts`, `src/app/_layout.tsx`). Convex features: schema.
