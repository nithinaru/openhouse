# Create a moment — end-to-end flow

How a moment gets made, from the home screen to walking through the finished house. Same rebrand style as `../onboarding` and `../app`.

1. `m1-create-a-moment` — splash with **create a moment**; invitees use "join a moment".
2. `m2-pick-a-location` — stylized toy map. Drop a pin on the building; the sheet confirms address + time window (oct 31 · 8pm–3am).
3. `m3-invite-friends` — share a link or pick contacts (suggested by how often they appear in your photos).
4. `m4-invites-out-photos-coming-in` — your roll is matched by location + time ("38 matched", within 40 m, 8pm–3am, review). Each friend shows live status: added, pulling, or nudge.
5. `m5-building-the-house` — partial build: rooms with photos are solid, the rest are wireframes with photos dropping in. Per-room progress, "ping me when it's done", peek at finished rooms.
6. `m6-fast-forward` — "2 days later" title card: everyone's cutouts, totals, oct 31 → nov 2 timeline.
7. `m7-moment-ready` — full house with every cutout placed; **step inside** leads to `../app/a2-room-cutouts`.

## Open decisions

- **Photo matching** assumes GPS distance + a time window, with each person reviewing before sharing. Location alone would pull every photo ever taken at the address.
- **Invite reach**: 4 contacts invited, 41 people in the final moment — this assumes the link can be shared onward. If it can't, the counts change.
