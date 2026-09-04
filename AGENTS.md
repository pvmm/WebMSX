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

Enable MSX-MUSIC **explicitly** (do not rely on the MSX2+ default):

```
https://webmsx.org?ROM=/path/to/game.rom&PRESETS=MSXMUSIC
```

Aliases: `ROM`=`CARTRIDGE1_URL`, `P`=`PRESETS`, `DISK`=`DISKA_URL`, `M`=`MACHINE`.
`PRESETS` takes a comma-separated list. See NOTES.md / README.md for the full set.

## Correct browser globals

- `window.wmsx` → class namespace (`wmsx.YM2413WasmAudio`, `wmsx.Machine`, ...)
- `window.WMSX` → config + live room (**`WMSX.room.machine`** is the running machine)

Reach the machine via `window.WMSX.room.machine`, NOT `wmsx.room` / `wmsx.WMSX.room`.

## Key facts (each took a while to learn — don't re-derive)

1. **MSX-MUSIC is not reliably auto-enabled**; pass `PRESETS=MSXMUSIC`. Without it the
   YM2413 is never instantiated → looks "silent/broken" but it's a setup issue.
2. Presence check: `window.WMSX.room.machine.bus.devicesOutputPorts[0x7c]` non-missing ⇒ MSX-MUSIC installed.
3. Grab the live YM2413 by walking `bus.slots` for an object with `opll` + MSXMUSIC
   format (see `findOpll` snippet in NOTES.md).
4. Sample with `opll.nextSample()`; YM2413 sample rate = **49780 Hz**. Peak should be
   `<< 1.0` (no clipping); sustained non-zero samples = real music (not the boot beep).
5. **Do not** patch the YM2413 prototype from `addInitScript`/`setTimeout` to count
   activity — the whole JS is one synchronous blob, so the patch lands after the
   machine/cartridge are already built. Locate and sample the live instance instead.
6. Boot beep ≈ single one-shot blip — wait ~40s for a game to actually drive MSX-MUSIC.

## Testing workflow (headless)

1. Copy a built standalone release + the game ROM to a temp dir; serve with
   `python3 -m http.server <port>`.
2. Playwright chromium, context `serviceWorkers:'block'` (avoids WebMSX cache.manifest).
3. `page.goto('http://127.0.0.1:<port>/index.html?CARTRIDGE1_URL=/game.rom&PRESETS=MSXMUSIC')`.
4. Wait the boot/music lead time, run the `findOpll` + `nextSample()` sampling via `page.evaluate`.

## Reference numbers (Undeadline, T&E Soft, MSX-MUSIC)

After ~40s: `nonzero 49546/49780`, `peak 0.0047`, `avg 0.00059` → active, in-range.

## Deploy

The standalone release lives in `release/stable/6.0/standalone/{index.html,wasm2413.*,images/}`.
Regenerate via `npx grunt` (project uses the `wasm2413` sources + wasm2113 bundle).
Deployed target: `pvmm.github.io/webmsx` (GH Pages; remember the WebMSX cache.manifest —
hard-refresh clients).
