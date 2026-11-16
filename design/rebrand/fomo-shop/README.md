# FOMO shop — merch drop after every moment

Once a moment's house is built, a limited drop opens: physical keepsakes made from that night's photos and 3D house, fulfilled by wop. Example: **halloween at the delancey house** (oct 31 · 41 people · 2,310 photos). Same rebrand style as `../create-a-moment` and `../step-inside`.

Merch direction comes from creator "concept collab" drops: each piece riffs on one inside joke in its own graphic genre (band tee, souvenir tee, door-sign patch). Here every joke is a real moment from the photos, so each piece carries a receipt ("11:12 pm · 4 cameras").

## Screens
1. `f1-shop-opens` — "2 days later", moment-ready screen gains a **the fomo shop is open** card above step inside.
2. `f2-fomo-shop` — the drop: countdown pill, snow globe hero ("the main thing"), photo book row, capsule carousel.
3. `f3-snow-globe` — the hero product. Your living room diorama + standees in glass, bats/confetti instead of snow, brass plate. Pick the room, choose who stands inside. $68.
4. `f4-delancey-capsule` — 4 pieces, each tagged with the moment it came from. Bundle $178.
5. `f5-photo-book` — linen hardcover, 212 of 2,310 photos, one chapter per room. Swap any photo before print. $54.
6. `f6-bag` — globe + book + hoodie, social proof sticker ("@ines, @theo + 9 others got the globe"), made + shipped by wop, $200.

`product-shots.jpg` — all generated product renders (snow globe ×3, photo book, ghost-arrives longsleeve, house hoodie, no-costume hat, i 👻 delancey tee). Source page in Paper: **Rebrand — 5 · FOMO Shop**.

## Shop site (`site/`)
`site/index.html` is the web version of the drop: the chrome balloon **fomo** wordmark sits in the middle, and the six products orbit it on a tilted 3D ring (CSS 3D, no build step). Run it with the `fomo-site` entry in `.claude/launch.json`, or `python3 -m http.server -d design/rebrand/fomo-shop/site`.

- **Structured motion**: the ring holds on each product for about 4 seconds, then glides to the next. Hovering pauses it. Products bob and turn slightly; the whole orbit leans a few degrees toward the cursor.
- **Depth**: items behind the wordmark shrink, blur and fade, and pass behind the letters. A dashed track marks the orbit.
- **Browse**: drag (with fling and snap), ← →, the scroll wheel, the panel arrows, or click any product to bring it to the front. Clicking the front product (or pressing Enter) opens a detail drawer with options and add to bag.
- **Panel**: index, name, the inside joke it came from, price. A pink sticker pops on the front product.
- Mobile: a smaller ring, a bottom-sheet drawer, and the countdown is hidden.
- `assets/` holds transparent cutouts of every product plus `fomo.png`.

## The capsule
| piece | inside joke | genre |
|---|---|---|
| the ghost arrives longsleeve | the 11:12pm entrance, caught by 4 cameras | metal band tour tee, flame sleeves |
| the house hoodie | the diorama with all 41 standees | back print, "i was here" sleeve sticker |
| no costume no entry dad hat | the sign on the door | door-sign patch embroidery |
| i 👻 delancey tee | for whoever missed it | tourist souvenir tee |

## Open decisions
- **Who can buy**: guests only, or anyone with the link (the "missed it" angle)? Screens currently allow both.
- **Globe build**: assumes the 3D house can be exported to a printable miniature with standees per person. Needs a fulfillment check with wop.
- **Pricing and dates** are placeholders.
