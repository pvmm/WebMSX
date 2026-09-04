# NOTES.md — Probing WebMSX for YM2413 / wasm2413 sound testing

Technical notes recorded while validating the **wasm2413** (emu2413 WASM) YM2413
driver against real software. Read this before relying on any WebMSX introspection
from the headless browser; a lot of the "obvious" access paths are wrong.

## Environment / branch

- Repo: `webmsx.git`, branch `wasm2413`
- Driver: `src/main/msx/audio/YM2413WasmAudio.js` (replaces the old JS YM2413)
- WASM bundle built from the sibling project `wasm2413` (`dist/wasm2413.mjs` + `.wasm`)
- Deployed site: `pvmm.github.io/webmsx` (commit/status tracked in the memory project)

## Hardware / sound devices supported

From the README (`readme.md`, lines 27-51): WebMSX emulates **12 generic machines**
(MSX1 / MSX2 / MSX2+ / MSX tR, each × Auto / American-NTSC / European-PAL / Japanese-NTSC).
Video: V9918, V9938, V9958, V9990 (Superimpose/Mixed/Dual). **Sound: PSG, SCC, SCC-I
(SCCI), FM-PAC, PCM, MSX-MUSIC, OPL4-Wave**, plus PSG/SCC/OPLL stereo simulation.

The **opll**-family devices and their presets (`README.md` Presets Reference ~line 231):
- **MSX-MUSIC** (YM2413) → preset `MSXMUSIC` / `NOMSXMUSIC`
- **FM-PAC** (YM2413 inside FM-PAC cartridge) → a distinct cartridge format (`FMPAC`), also OPLL
- **OPL4-Wave** → preset `OPL4` (MoonSound; YM2413-less, YMF278B-based)
- OPLL stereo simulation → presets `OPLLSTEREO`, `OPLLSTEREO2`
- OPLL volume/pan → `WMSX.OPLL_VOL` / `WMSX.OPLL_PAN` (hex strings)

Additional extensions togglable via preset or UI: HardDisk (Nextor), Floppy/disk,
RAM Mapper, Kanji(+MSX-JE), V9990, DoublePSG, SCC / SCC-I / PAC / MegaRAM cartridges.
ROM formats (available as `CARTRIDGE1_FORMAT`, see README ~line 150): `Normal`,
`ASCII8`, `ASCII16`, `Konami`, `KonamiSCC`, `KonamiSCCI`, `FMPAC`, `FMPAK`, `MSXDOS2`,
`Manbow2`, `Dooly`, `MegaRAM`, `Majutsushi`, `RType`, `CrossBlaim` ... etc.

## MSX-MUSIC presence & toggling

`README.md` (line 185) says MSX-MUSIC is **"Default in Machine: MSX2 or higher"** — the
YM2413 is normally present on MSX2+ machines. That is **confirmed empirically**: the
default MSX2+ base config auto-includes it (`src/main/WMSXCBios.js` line 273:
`_INCLUDE: "_BASE, RAMMAPPER, MSXMUSIC"`), so on the default MSX2+ machine the OPLL IS
instantiated with no preset at all. (An earlier note claiming "zero instances without
`PRESETS=MSXMUSIC`" was from a test on a different/default machine config and is **wrong** —
the default MSX2+ does include it.)

To toggle it explicitly from the URL:
- `PRESETS=MSXMUSIC`   → force-enable (no-op if already default-present)
- `PRESETS=NOMSXMUSIC` → **disable** (defined `WMSXCBios.js` line 176:
  `NOMSXMUSIC: { "EXTENSIONS.MSXMUSIC": 0 }`)

This is the cleanest way to compare OPLL vs PSG fallback for the same game: with
`NOMSXMUSIC` the machine has no OPLL cartridge, so a game that supports it (e.g. Undeadline)
falls back to the PSG.

```
?CARTRIDGE1_URL=/path/to/game.rom&PRESETS=MSXMUSIC     # OPLL music
?CARTRIDGE1_URL=/path/to/game.rom&PRESETS=NOMSXMUSIC   # PSG fallback music
```

(`PRESETS` is also aliased as `P` / `PRESET`; `PRESETS` accepts a comma-separated list,
e.g. `?P=MSXMUSIC,RAM128`. `CARTRIDGE1_URL` is aliased `ROM`/`CART`/`CART1`; see
`src/main/Configurator.js` `abbreviations` map, ~line 443.)

**To confirm which sound device is actually driving music**, sample the live instances:
- MSX-MUSIC present → `machine.bus.devicesOutputPorts[0x7c]` is the YM2413 output handler
  and a `YM2413WasmAudio` instance exists
- `NOMSXMUSIC` → no `YM2413WasmAudio`, `0x7c` is the DeviceMissing handler, and the PSG
  (`machine.psg.getAudioChannel()`) produces the music's `nextSample()` values

Always confirm which device is present before testing — a "silent" OPLL is usually just
`NOMSXMUSIC` being active, not a driver bug.

## Browser globals (easy to get wrong)

There are **two** globals with confusingly similar names:

- `window.wmsx` — the class/namespace: `wmsx.YM2413WasmAudio`, `wmsx.Machine`,
  `wmsx.CartridgeMSXMUSIC`, `wmsx.AudioSignal`, `wmsx.Util`, ...
- `window.WMSX` — the config + live-room holder: `WMSX.room.machine`,
  `WMSX.CARTRIDGE1_URL`, `WMSX.PRESETS`, `WMSX.OPLL_VOL`, ...

The machine is reached at **`window.WMSX.room.machine`** — NOT `wmsx.WMSX.room` and
not `window.wmsx.room`. (`WMSX.room` is assigned in `src/main/Launcher.js`:
`WMSX.room = new wmsx.Room(...)`.)

## Reaching the live YM2413 instance

The MSX-MUSIC cartridge (`src/main/msx/slots/cartridges/special/msx-music/CartridgeMSXMUSIC.js`)
constructs `var opll = new wmsx.YM2413WasmAudio("MSX-MUSIC")` **immediately** and
exposes it as `this.opll`. To grab the live one from the running machine, walk the
bus slots looking for any object that has an `opll` and an MSX-MUSIC format:

```js
const bus = window.WMSX.room.machine.bus;
const seen = new Set();
function findOpll(obj, depth) {
  if (depth > 6 || !obj || typeof obj !== 'object') return null;
  if (obj.opll && obj.format && /MSXMUSIC/i.test((obj.format.name || ''))) return obj.opll;
  for (const k in obj) {
    try {
      if (seen.has(obj[k])) continue;
      seen.add(obj[k]);
      const r = findOpll(obj[k], depth + 1);
      if (r) return r;
    } catch (e) {}
  }
  return null;
}
const opll = findOpll(bus, 0);   // the real YM2413WasmAudio the game drives
```

## Quick hardware-presence check

```js
const bus = window.WMSX.room.machine.bus;
const hasMusic = !!bus.devicesOutputPorts[0x7c];   // true when MSX-MUSIC installed
```

(`devicesOutputPorts` is a 256-entry array indexed by I/O port; `0x7c` latches the
address, `0x7d` writes data. Defined in `src/main/msx/machine/BUS.js`.)

## Sampling actual audio

`YM2413WasmAudio.nextSample()` returns the **raw** wasm OPLL output (no volume applied —
volume is applied once by the `AudioSignal`, matching the WebMSX convention used by the
PSG/SCC). The raw OPLL per-channel peak is ~±2048 (`lookup_exp_table` peaks ±4095, halved
by `_MO`), though real music mixes well below that. Sample rate is **49780 Hz**.

```js
const N = 49780;                     // ~1 second
let nz = 0, peak = 0, sum = 0;
for (let i = 0; i < N; i++) {
  const s = opll.nextSample();
  const v = Array.isArray(s) ? Math.max(Math.abs(s[0]), Math.abs(s[1])) : Math.abs(s || 0);
  if (v > 0) nz++;
  sum += v;
  if (v > peak) peak = v;
}
// nz  -> how many non-zero samples (silence if 0)
// peak-> raw OPLL amplitude (a few hundred to ~2000 for music)
// avg -> sum / N
```

To get the level that actually reaches the mix buffer, multiply the raw peak by the
driver's effect voice volume chain: `rawPeak * VOLUME * 1.2 * WMSX.VOL`, where
`VOLUME = 0.68 * (1.58 / 9 / 2048)`. (This mirrors `AudioSignal.init()`: buffer sample =
`nextSample() * volume`, and `volume = VOLUME * 1.2 * WMSX.VOL`.)

**Volume-fix note (critical):** an earlier version applied VOLUME **twice** — inside
`nextSample()` (`s[0]*VOLUME`) *and* in `AudioSignal` (`volume = VOLUME*1.2*WMSX.VOL`),
which squared the volume and made the OPLL ~silent. Fix: `nextSample()` returns raw, and
VOLUME lives only in the `AudioSignal`. Don't re-introduce the multiply inside
`nextSample()`.

Reference result for **Undeadline** (T&E Soft) — same game, both paths, raw `nextSample()`
then final-mix estimate at ~40s of play (`WMSX.VOL=1`):

| Music path | device | raw peak | final mix peak |
|-----------|--------|---------:|---------------:|
| `PRESETS=MSXMUSIC`  | OPLL | ~1300-1626 | **~0.09-0.11** |
| `PRESETS=NOMSXMUSIC`| PSG  | 0.013      | **~0.010** |

So the OPLL is clearly audible and roughly ~10x above the same game's PSG fallback.
Final peaks are well under 1.0 → no clipping, healthy headroom.

## Title-screen / boot beep confusion

The MSX only beeps once at boot. That single beep is **not** the driver being tested.
Wait long enough (user used ~40 s) for the game to actually sequence MSX-MUSIC
registers, then sample. A real game produces a *sustained* run of non-zero samples,
not a one-shot blip.

## Test harness (headless)

1. Copy a built standalone release (`release/stable/6.0/standalone/{index.html,wasm2413.*,images/}`)
   and the game ROM into a temp dir; serve with `python3 -m http.server <port>`.
2. Playwright (chromium, headless):
   `page.goto('http://127.0.0.1:<port>/index.html?CARTRIDGE1_URL=/game.rom&PRESETS=MSXMUSIC')`.
   `serviceWorkers: 'block'` in the context avoids the WebMSX cache.manifest.
3. `await page.waitForTimeout(...)` the desired boot/music lead time, then run the
   `findOpll` + sampling snippet via `page.evaluate`.

### Injectable-counter caveat

Patching `wmsx.YM2413WasmAudio.prototype` from an `addInitScript`/`setTimeout` poll is
**unreliable**: the whole 5 MB JS is one synchronous blob, so by the time any async
code runs the machine (and cartridge) are usually already constructed. Prefer locating
the live instance (walk `bus.slots`) and sampling it, as above.

## Files referenced

- `src/main/msx/audio/YM2413WasmAudio.js` — the driver (`output7C` latch, `output7D`
  write, `registerWrite` → `connectAudio()`, `nextSample()` → `opll.calcStereo()*VOLUME`,
  `VOLUME = 0.68 * (1.58 / 9 / 32768)`).
- `src/main/msx/slots/cartridges/special/msx-music/CartridgeMSXMUSIC.js` — owns `opll`.
- `src/main/msx/machine/Machine.js` — `getAudioSocket()`, `bus`.
- `src/main/msx/machine/BUS.js` — `devicesOutputPorts`, `connectOutputDevice`.
- `src/main/Configurator.js` — URL param parsing + `abbreviations` map.
- `src/main/Launcher.js` — `WMSX.room = new wmsx.Room(...)`.
