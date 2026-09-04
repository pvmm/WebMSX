# AGENTS.md — WebMSX YM2413 (wasm2413) testing

Quick orientation for working on the wasm2413 driver / its WebMSX integration.
Full detail and the exact probing snippets live in **`./NOTES.md` — read it first.**

## Repo & source

- Repo: `webmsx.git`, branch `wasm2413`
- YM2413 WASM driver: `src/main/msx/audio/YM2413WasmAudio.js`
- MSX-MUSIC cartridge (owns the `opll`): `src/main/msx/slots/cartridges/special/msx-music/CartridgeMSXMUSIC.js`
- Machine/bus: `src/main/msx/machine/Machine.js`, `src/main/msx/machine/BUS.js`
- URL params / aliases: `src/main/Configurator.js`
- WASM bundle comes from sibling project `wasm2413` (`dist/wasm2413.mjs` + `.wasm`)

## One-line test URLs

MSX-MUSIC IS present by default on the MSX2+ machine. Two useful modes:

```
https://webmsx.org?ROM=/path/to/game.rom&PRESETS=MSXMUSIC     # OPLL music
https://webmsx.org?ROM=/path/to/game.rom&PRESETS=NOMSXMUSIC   # same game, PSG fallback
```

`NOMSXMUSIC` disables MSX-MUSIC (defined in `WMSXCBios.js`), great for comparing OPLL vs
PSG on the same game.

Aliases: `ROM`=`CARTRIDGE1_URL`, `P`=`PRESETS`, `DISK`=`DISKA_URL`, `M`=`MACHINE`.
`PRESETS` takes a comma-separated list. See NOTES.md / README.md for the full set.

## Correct browser globals

- `window.wmsx` → class namespace (`wmsx.YM2413WasmAudio`, `wmsx.Machine`, ...)
- `window.WMSX` → config + live room (**`WMSX.room.machine`** is the running machine)

Reach the machine via `window.WMSX.room.machine`, NOT `wmsx.room` / `wmsx.WMSX.room`.

## Key facts (each took a while to learn — don't re-derive)

1. **MSX-MUSIC is auto-enabled on the default MSX2+ machine** (base config
   `_BASE, RAMMAPPER, MSXMUSIC`). `PRESETS=MSXMUSIC` force-enables; `PRESETS=NOMSXMUSIC`
   disables. If the OPLL looks "silent", check whether the game actually uses it (some
   fall back to PSG) — likely a test-setup issue, not a driver bug.
2. Presence check: `window.WMSX.room.machine.bus.devicesOutputPorts[0x7c]` non-missing ⇒ MSX-MUSIC installed.
3. Grab the live YM2413 by walking `bus.slots` for an object with `opll` + MSXMUSIC
   format (see `findOpll` snippet in NOTES.md).
4. `opll.nextSample()` returns the **raw** wasm OPLL value (peak ~1300-1600 for Undeadline
   music). Volume is applied once by `AudioSignal` (`volume = VOLUME * 1.2 * WMSX.VOL`,
   `VOLUME = 0.68*(1.58/9/2048)`). **Never** scale inside `nextSample()` — that doubly
   applies the volume and makes it ~silent. Final mix peak ≈ rawPeak * VOLUME * 1.2 * WMSX.VOL,
   keep `<< 1.0` (no clipping).
5. **Do not** patch the YM2413 prototype from `addInitScript`/`setTimeout` to count
   activity — the whole JS is one synchronous blob, so the patch lands after the
   machine/cartridge are already built. Locate and sample the live instance instead.
6. Boot beep ≈ single one-shot blip — wait ~40s for a game to actually drive MSX-MUSIC.

## Testing workflow (headless)

1. Copy a built standalone release + the game ROM to a temp dir.
2. **Start the HTTP server fully detached so it survives the console closing** — this is
   the one gotcha that burned us repeatedly. Use exactly:
   ```bash
   cd "$T" && setsid nohup python3 -m http.server 8766 >/tmp/opencode/serve.log 2>&1 < /dev/null & disown
   ```
   (`setsid`+`nohup`+`< /dev/null`+`& disown`). The shell command may still block/times-out
   — that's expected; the server keeps running. Verify it's alive in a separate command with
   `curl`; kill with `pkill -f "http.server 8766"`.
3. Playwright chromium, context `serviceWorkers:'block'` (avoids WebMSX cache.manifest).
   `require('playwright')` by absolute path from the `~/.npm/_npx/<hash>/node_modules` cache
   (not in project node_modules).
4. `page.goto('http://127.0.0.1:8766/index.html?CARTRIDGE1_URL=/game.rom&PRESETS=MSXMUSIC')`
   — quote the URL (it contains `&`).
5. Wait the boot/music lead time (~40s), run the `findOpll` + `nextSample()` sampling via `page.evaluate`.

See NOTES.md "Test harness (headless) — the one way that works" for the full detail.

## Reference numbers (Undeadline, T&E Soft)

Same game, both paths (~40s in, `WMSX.VOL=1`):

| Mode | device | raw `nextSample()` peak | final mix peak |
|------|--------|------------------------:|---------------:|
| `MSXMUSIC`   | OPLL | ~1300-1626 | **~0.09-0.11** |
| `NOMSXMUSIC` | PSG  | 0.013      | **~0.010** |

OPLL is clearly audible, ~10x above the same game's PSG fallback, no clipping.

## Deploy

The standalone release lives in `release/stable/6.0/standalone/{index.html,wasm2413.*,images/}`.
Regenerate via `npx grunt` (project uses the `wasm2413` sources + wasm2113 bundle).
Deployed target: `pvmm.github.io/webmsx` (GH Pages; remember the WebMSX cache.manifest —
hard-refresh clients).
