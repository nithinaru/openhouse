# Openhouse — 2-minute stage script

Follows BUILD.md §7. One presenter talks, one drives the phone (or the same person, phone mirrored).
Every beat has a fallback that keeps the clock running. Total: 2:00, with ~10 s of slack.

Hidden switches (rehearse these, never show them):
- **Demo panel:** long-press the **Openhouse** wordmark on Home. Load demo trip, reset onboarding, simulate friend pair, simulate order paid, simulate Keiki text, narrator on/off, backend status.
- **People:** long-press the "People" title to play the pairing celebration.
- **Frame:** long-press the title to show the order-confirmed state.
- **Ask:** works offline. With no backend, answers come from the phone ("Answered on this phone" under the answer).

---

## Pre-demo checklist (T-10 min)

- [ ] Silent switch **off** (orange not showing). Narration is speech; it is silent with the switch on.
- [ ] Volume **up** to ~80%. Play one Replay stop to check.
- [ ] Do Not Disturb **on**, but allow notifications from Expo Go (Settings › Focus › Do Not Disturb › Apps › Expo Go) so the Keiki beat still lands.
- [ ] Brightness **up**, auto-lock **Never**, True Tone off if the projector looks yellow.
- [ ] Phone on **cellular**, or the dev tunnel is up (`npx expo start --tunnel`) and Expo Go shows the app, not the red screen.
- [ ] Expo Go **loaded**, app on Home, all other apps closed.
- [ ] Demo panel: status block says **Convex responding**. If it says not responding, that's fine: everything below runs from the cached demo trip.
- [ ] Demo panel: **Reset all switches**, narrator **on**.
- [ ] Teammate's phone is unlocked with the People QR open (for the live scan, if you do it).
- [ ] Notifications permission granted to Expo Go (tap "Simulate Keiki text" once in rehearsal and wait for it).

---

## The script

| # | Time | Beat | Sponsor |
|---|------|------|---------|
| 1 | 0:00–0:15 | Hook + "your day is ready" | Keiki / Convex |
| 2 | 0:15–0:45 | Replay, sound on | Convex, Claude |
| 3 | 0:45–0:58 | Their angle | Convex |
| 4 | 0:58–1:15 | Walk in | (World Labs) |
| 5 | 1:15–1:30 | Ask your day | Claude, Supermemory |
| 6 | 1:30–1:45 | Frame it, pay | Whop |
| 7 | 1:45–1:52 | Phone buzzes | Keiki |
| 8 | 1:52–2:00 | Close | Capy, Revyl |

### 1. Hook (0:00–0:15)

**Say:** "Nobody journals. But your phone already remembers the day: where you stood, which way you faced, who was with you."

**Tap:** Home is already open. Tap the hero trip card **YC hackathon day**.

**Shows:** the trip came from photos with zero typing; trip data lives in **Convex**. If you have time, mention "it texted me when it was ready" (pays off in beat 7).

**Fallback:** card missing or Home stuck → long-press the wordmark → **Load demo trip**.

### 2. Replay (0:15–0:45)

**Say (then stop talking for ~15 s and let it play):** "This is the day, played back."
Over the golden-hour stop: "Every caption and line of narration was written from the photos alone."

**Tap:** nothing. Let the title card, flyover, pins and narration run. Tap the map once if you need to pause for a line.

**Shows:** **Convex** realtime trip + enrichment; narration written by **Claude**.

**Fallback:** no sound → check silent switch, keep talking over captions (the kinetic captions carry it). Narration stalls → demo panel › narrator **off**, Replay keeps going with captions. Map blank (no network) → the photos, captions and timeline still play; say "the map tiles are on conference wifi" and move on.

### 3. Their angle (0:45–0:58)

**Say:** "Rohan and I were at lunch together. Here's the same moment from his phone."

**Tap:** tap the **Lunch on 3rd St** stop pin (or its caption) → stop sheet opens → swipe the hero photos to **Their angle**.

**Shows:** shared stops across two users (pairings in **Convex**).

**Fallback:** didn't land on the lunch stop → tap the timeline segment for stop 3, then the caption. If the stop sheet won't open, skip straight to beat 4 from the end card.

### 4. Walk in (0:58–1:15)

**Say:** "And for a place I took enough photos of, I can step back inside it."

**Tap:** **Walk in** on the stop sheet → drag to look around, pinch to move.

**Shows:** a 3D memory built from ~8 phone photos.

**Fallback:** world doesn't load in 3 s → close it, say "it builds in the background, here's one from earlier", and move on. Don't wait on a spinner.

### 5. Ask your day (1:15–1:30)

**Say:** "I can also just ask it about my day."

**Tap:** close Walk in and the stop sheet. If Replay hasn't reached the end card yet, tap the last timeline segment and let the last stop finish (~5 s; rehearse whether you need this). On the end card → **Ask about this day** → chip **"When did I meet Rohan?"** → answer streams in → tap the cited **Lunch on 3rd St** card if there's time, or **Read aloud** to hear it.

**Shows:** **Claude** answers over the trip, with **Supermemory** recall across days ("Answered by Claude from your memories" under the answer).

**Fallback:** backend down → the same chip still answers on the phone in under a second; nobody can tell. If the keyboard is up, use a chip instead of typing.

### 6. Frame it (1:30–1:45)

**Say:** "When a day is worth keeping, I frame it."

**Tap:** **Frame it** on the end card → **Frame this · $39** → Whop checkout → card **4242 4242 4242 4242**, any future date, any CVC → pay → order confirmed.

**Shows:** **Whop** checkout; the order unlocks from the Convex record via the webhook.

**Fallback:** checkout slow or the sheet won't load → close it, long-press the Frame title (confirmed state), or demo panel › **Simulate order paid**. Say "and it's on its way."

### 7. Phone buzzes (1:45–1:52)

**Say:** (as it buzzes) "And that's my phone texting me about tomorrow's walk." Or simply hold it up: "It texts me when a day is ready."

**Tap:** before beat 6 ends, if Keiki isn't wired live, open demo panel › **Simulate Keiki text** and go back; it lands 3 s later: *"Openhouse: Your YC hackathon day is ready — 4 stops, 1 person"*.

**Shows:** **Keiki** agent on the shared line.

**Fallback:** no banner → skip the beat, it's P1. Don't fish for it.

### 8. Close (1:52–2:00)

**Say:** "Every photo already knows where you stood, which way you faced and who was there. We just play it back. Built today with Capy, tested on real iPhones with Revyl, running on Convex."

**Shows:** **Capy** wrote most of the app; **Revyl** cloud iPhone checks.

---

## If everything breaks

1. Long-press the wordmark → **Load demo trip**. The cached trip, narration and Ask answers all run on the phone.
2. Skip Walk in and Frame; Replay + Ask carry the story in 60 s.
3. Last resort: play the recorded demo video.

## Sponsor map

| Sponsor | Where it shows |
|---------|----------------|
| Capy | Close line; wrote most of the app |
| Revyl | Close line; cloud iPhone checks before the demo |
| Convex | Trip data, enrichment, pairings, realtime (beats 1–3), backend status in the demo panel |
| Whop | Frame checkout (beat 6) |
| Keiki | "Your day is ready" text (beat 7) |
| Claude | Narration (beat 2), Ask your day answers (beat 5) |
| Supermemory | Ask your day recall across days (beat 5) |
