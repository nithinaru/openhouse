# Context for Capy

Paste the **Project context** block into Capy's project instructions (or at the top of the first thread). Then run the threads below, one task per thread, in order. Each thread ends in a small PR into `main`.

## Project context

```
Project: Openhouse (repo nithinaru/openhouse). YC Consumer Mobile Hackathon, Nov 15.
Openhouse turns your camera roll into a narrated, walk-through replay of your day:
where you stood, which way you faced, who was there. Full brief: docs/BUILD.md.

Stack (fixed): Expo SDK 58 + Expo Router + TypeScript (routes in src/app/), Convex backend, Revyl cloud iPhone checks.
The Expo app is ALREADY scaffolded at the repo root. Do not re-create it or move files.

Ownership, to avoid merge conflicts with a teammate working in Claude Code at the same time:
- Capy owns: convex/**, Convex wiring in src/app/_layout.tsx (ConvexProvider only), .revyl/**, integration code, builds.
- Claude Code owns: src/lib/** and src/features/** and the screens in src/app/* other than _layout.tsx.
- Designer owns: src/theme/** and assets/.
Never edit files you don't own. If you need a client change, describe it in the PR body instead.

Client shapes live in src/lib/types.ts (Trip, Moment, Photo, Person, Pairing). Keep Convex
documents compatible with those field names. A cached demo trip is in src/lib/demo/demoTrip.ts.

Rules:
- Server SDKs (Anthropic, OpenAI, Replicate, Whop, Keiki, Supermemory) are called ONLY from
  Convex actions ("use node"). Never import them in the Expo app.
- Read secrets with process.env in Convex actions. Set each one in Convex with
  npx convex env set NAME "$NAME" before using it.
- Text and vision: use Anthropic (ANTHROPIC_API_KEY), model claude-sonnet-5-5
  (claude-haiku-5-5 for cheap calls). Text-to-speech: OpenAI TTS (OPENAI_API_KEY) if set,
  otherwise skip audio and return text only.
- Whop runs in sandbox: WHOP_ENVIRONMENT=sandbox. Unlock from the Convex record the webhook writes.
- Every feature needs a demo fallback: if DEMO_MODE is true or a call fails, return cached data.
- Commit titles: short, lowercase, imperative ("add trip schema"). No Co-Authored-By trailers,
  no "Generated with" lines, no session links in commits or PRs.
- Small PRs. Pull main before every task.
```

## Env vars to add in Capy before the first message

Capy: + > Environment variables > Project. Values are in your local `hackathon/keys.env`.

| Name | Status |
|---|---|
| `CONVEX_DEPLOY_KEY` | required first |
| `EXPO_PUBLIC_CONVEX_URL` | `https://trustworthy-anteater-9.convex.cloud` |
| `ANTHROPIC_API_KEY` | needed for captions and narration |
| `WHOP_API_KEY`, `WHOP_WEBHOOK_SECRET`, `WHOP_ENVIRONMENT=sandbox` | ready |
| `SUPERMEMORY_API_KEY` | ready (P2) |
| `REPLICATE_API_TOKEN` | **still needed** from replicate.com, gates "Walk in" (SHARP) |
| `OPENAI_API_KEY` | optional, only for narration audio |
| `KEIKI_API_KEY` | waiting on Keiki access |

## Threads (one per task, in this order)

**Thread 1: Convex + Revyl setup**
```
Read docs/CAPY.md and docs/BUILD.md. The Expo app is already scaffolded at the repo root, so do
not create a new one. Get it Convex-ready by following https://www.convex.dev/agent-setup.md:
install convex, run npx convex dev --once, and wrap the root layout in src/app/_layout.tsx
with ConvexProvider using EXPO_PUBLIC_CONVEX_URL (change nothing else in that file).
Then add the Convex hackathon skill: download SKILL.md and references/log-format.md from
https://github.com/convex/convex-hackathon-skill into .agents/skills/convex-hackathon-skill/
and create hackathon.md. Then build iOS and run one Revyl check that the Trips screen opens.
Open one PR.
```

**Thread 2: schema and core functions**
```
Implement convex/schema.ts from docs/BUILD.md §4 (users, trips, moments, photos, pairings,
worlds, posters, orders) with indexes by tripId, momentId and userId. Add queries
trips.list, trips.get (returns the trip with its moments, photos, people, pairings in the
shape of Trip in src/lib/types.ts), mutations trips.create, moments.upsertMany,
photos.addMany, users.ensure (creates a shareCode), pairings.pair(code, lat, lng), and a
file upload flow (generateUploadUrl + storage ids on photos). Seed the demo trip from
src/lib/demo/demoTrip.ts with an internal mutation seed.demo. One PR.
```

**Thread 3: SHARP splats for "Walk in" (start early, it gates the demo)**
```
Read docs/BUILD.md §5.7. Add a Convex action splats.buildForPhoto(photoId) that runs Apple SHARP
on Replicate (model kfarr/sharp-ml, REPLICATE_API_TOKEN) on the photo's stored thumbnail or
full image. Check the model's page on replicate.com for the exact input and output fields
before writing it. Download the resulting .ply, store it in Convex file storage, and save
splatUrl on the photo. Add splats.buildForMoment(momentId) that runs it on the hero photo
first (saving splatUrl on the moment as worldSplatUrl), then on the rest of the moment's
photos in takenAt order for walk mode, with a few running at once. Add query
splats.forMoment(momentId) returning the ordered nodes { photoId, uri, takenAt, headingDeg,
splatUrl }. Demo fallback: if DEMO_MODE, return cached splat URLs. One PR.
```

**Thread 4: enrichment**
```
Add a Convex action enrichStop(momentId) per docs/BUILD.md §5.3: Open-Meteo weather for the
time and place, suncalc golden hour, one Wikipedia geosearch fact (radius 500 m, one
sentence), and Claude vision (claude-sonnet-5-5, ANTHROPIC_API_KEY) on 1-2 thumbnails
returning JSON { caption, sceneTags, signText, dominantColors }. Merge dominant colors into
a 5-swatch trip palette. Write the results onto the moment. One PR.
```

**Thread 5: narration**
```
Add a Convex action narrateTrip(tripId) per docs/BUILD.md §5.4. Use Claude
(claude-sonnet-5-5) to write 20-40 words per stop: warm, specific, second person, uses
times, places, weather, facts and people, no cliches, no exclamation marks. Save the text on
each moment as narration. If OPENAI_API_KEY is set, make one TTS clip per stop, store it in
file storage, and save its URL as narrationUri. One PR.
```

**Thread 6: Whop frame checkout**
```
Add the Whop sandbox paywall per the hackathon guide: a Convex action orders.checkout(posterId)
that creates a Whop checkout for a $39 framed print and returns purchase_url, and an HTTP action
at /whop that verifies payment.succeeded with WHOP_WEBHOOK_SECRET and marks the order paid.
Add query orders.forPoster. WHOP_ENVIRONMENT must be sandbox. One PR.
```

**Thread 7: Revyl proof and validation**
```
Turn on Revyl proof of changes for this repo following https://docs.revyl.com/agents/proof.md,
and add a validation check: open the demo trip, the replay starts, the poster screen opens.
One PR.
```

**Thread 8 (P1): Keiki notify** once `KEIKI_API_KEY` exists. Use the hackathon guide's Keiki prompt: when a trip becomes ready, text "Your <title> is ready".

After each merge: ask Capy for an iOS build on the cloud phone.
