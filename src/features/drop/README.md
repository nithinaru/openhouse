# the drop — swapping in real product photos

Every piece is drawn as a generated SVG mockup from the trip (`designs/*.tsx`). A real photo
replaces it as soon as you point the catalog at it. No other code changes.

1. Drop files in `assets/merch/` (create the folder), named `<piece>-front.png` and
   `<piece>-back.png`. Pieces: `hoodie`, `tee`, `tote`, `cap`, `stickers`, `pin`.
   Transparent PNG, product only (no background), shot flat-lay from above, ~1200 px on the
   long edge. Roughly match the mockup aspect so it sits right in the grid:
   hoodie 200:220, tee 200:210, tote 200:230, cap 200:160, stickers 200:250, pin 1:1
   (photos are shown `contain`, so a different ratio just gets padding).
2. In `src/features/drop/catalog.ts`, uncomment the `image:` (and `imageBack:`) line under
   that piece. A remote `https://…` url string works too.
3. Save. Metro hot-reloads. A missing back photo falls back to the generated back.

Prices, names and sizes are in the same file.
