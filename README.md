# Stochastic Shore

A small, drifting beach you can visit. → **[shore.brezgis.com](https://shore.brezgis.com)**

The shore breathes with your real local clock — sunrise around 6am, dusk around 6pm — and the tide leaves things behind. Shells, sea glass, coral, the odd message in a bottle wash up along the wrack line and drift out again. Photoreal creatures wander the sand over a pixel-animated sea: sandpipers dart, hermit crabs trundle, a sea turtle is rare, and a dolphin is rarer still.

Almost everything is clickable.

- **Shells** are radios. Pick one up and hold it to your ear to hear a live FM stream from somewhere in the world — freeform WFMU, college radio, classical, old-time sci-fi, a station in Mexico City. A different shell, a different signal.
- **Crabs** quote ancient philosophy and poetry — Plato, Confucius, Laozi, Du Fu.
- **Other wash-ups** offer small facts and stranger messages.
- **Seagulls** do not appreciate being clicked.

You can also **drag** shells, kelp, crabs, and the rest around the sand (drop them in the sea and they're gone), **draw in the sand** with a click-drag, and **go fishing**: click a ripple-ring on the water to reel up a fish — or, rarely, an octopus.

Turn the sound on in the corner for ambient gulls and surf (independent of the radio).

## Running it

It's a static site — no build step. Serve the folder with anything:

```
python3 -m http.server 8000
```

Then open the printed URL. Everything is plain HTML, Canvas 2D, and ES modules.

## Credits & licensing

- **Code** is free to read and reuse.
- **Texts** are public-domain translations: Plato (Jowett), Confucius (Legge), Laozi (Legge), Marcus Aurelius (Long), and Du Fu (Witter Bynner, *The Jade Mountain*, 1929), via Project Gutenberg and Wikisource.
- **Radio** is streamed live from public internet stations; all broadcasts belong to their respective stations.
- **Sound effects** are from the [Freesound](https://freesound.org) community.
- **Imagery** consists of third-party cut-out photographs used as placeholders.

If you are a rights-holder and would like a credit corrected or an asset removed, please open an issue.
