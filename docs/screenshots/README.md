# Screenshots

This folder holds the PNG / JPG / GIF captures referenced by the root
`README.md`. The filenames below are the ones the README already links to —
upload captures that match each description.

Target format: PNG for static UI shots (crisp text), GIF/MP4 thumbnail for
animated flows.

## Needed

| File | What to capture | Dimensions (target) |
|---|---|---|
| `hero.png` | Landing page hero at `/` — the two cards ("Meet Niya" + "Analyze a token"), nav visible, ticker tape below | 1600×900 |
| `companion.png` | `/companion` — Niya avatar mounted, chat bubble visible, TTS waveform or emotion indicator active | 1600×900 |
| `tools-verdict.png` | `/tools` with CAKE (`0x0e09fabb…`) loaded — verdict card showing score 8, microstructure ledger, Ask Niya panel | 1600×1000 |
| `extension-sidepanel.png` *(optional)* | Chrome side panel on DexScreener BSC — CA auto-detected, verdict loading | 1200×800 |
| `analyst-mode.png` *(optional)* | Analyst Mode overlay on the chart — floors, ceilings, trendlines, Fibonacci entry zones | 1600×900 |

## Tips for good shots

- **Browser window**: 1440×900 viewport minimum, no URL bar visible
- **Theme**: cream/tan Niya Labs palette (the default)
- **No real secrets**: never a real wallet address in chat logs that isn't CAKE / WBNB / public contracts. Blur any personal identifiers in extension captures
- **OS chrome**: on macOS, `Cmd+Shift+4 → Space → click window` gives clean captures with nice shadows. On Windows, use the Snipping Tool "Window" mode
- **File size**: target < 500 KB per screenshot. Run through [tinypng.com](https://tinypng.com) or `pngquant` before committing

## How to add

```bash
# From the repo root:
cp ~/Desktop/hero.png docs/screenshots/hero.png
git add docs/screenshots/hero.png
git commit -m "docs: add hero screenshot for README"
git push origin main
```

The README already has `![alt](docs/screenshots/NAME.png)` references — just
match the filename and the image shows up in the rendered README
automatically.
