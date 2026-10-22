# Performances

Each folder here is one piece, and its number is what the conductor picks on the Conductor page.

```
performances/
  1/
    score.json   <- the score (download it from the Form page, it's already named score.json)
    pad.wav      <- every audio file the score uses
    Bell1.wav
  2/
    score.json
    ...
```

Rules:

- Name folders with plain numbers: `1`, `2`, `3`, ... Keep them in order. The Conductor page stops looking after 3 missing numbers in a row.
- Each folder needs exactly one `score.json`.
- In `score.json`, write each sound as just its file name, e.g. `"pad": "pad.wav"`. File names are case-sensitive: `Bell1.wav` is not `bell1.wav`.
- Once a folder is pushed to GitHub, it shows up on the Conductor page within a minute or two, after GitHub Pages updates. Press Refresh on the Conductor page.
