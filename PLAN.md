# Pet Protector — Web Port Plan

Port the CLI game to a PixiJS canvas-based web app. The old CLI files stay in place (don't delete them); the web version lives alongside in a `web/` subfolder.

## Architecture

```
pet-protector/
├── web/                        ← NEW — all web files here
│   ├── index.html              ← Entry point, loads PixiJS + modules
│   ├── app.js                  ← App class (replaces index.js)
│   ├── game.js                 ← Port of game.js (pure logic, minimal changes)
│   ├── state.js                ← Port of state.js (localStorage instead of fs)
│   ├── world.js                ← Map loader + renderer
│   ├── maps/
│   │   └── test.json           ← 10×10 test map (grass + forest)
│   └── screens/
│       ├── Screen.js           ← Base class (PIXI.Container + lifecycle)
│       ├── StartupScreen.js    ← Full-screen PiP + "press any key"
│       ├── GameScreen.js       ← Main gameplay (map + stats + menus)
│       ├── SettingsScreen.js
│       └── LogScreen.js
├── index.js                    ← Old CLI entry (keep)
├── game.js                     ← Old CLI logic (keep)
├── state.js                    ← Old CLI state (keep)
├── screens/                    ← Old CLI screens (keep)
└── ...
```

### Key decisions

- **PixiJS via CDN** — no bundler or build step. `<script>` tag in `index.html`.
- **ES modules** — `<script type="module">` for our code, imported normally.
- **No server required** — can open `index.html` directly, or use a simple local server (`npx serve web/`).
- **Single save** — one save slot, auto-loaded on start. No save selection UI. Stored in `localStorage` under a single key. Reset = clear cache (UI for this TBD later).
- **Screen base class** — each screen extends a base `Screen` class that wraps a `PIXI.Container` with `enter()`, `exit()`, `handleInput(e)`, `update(dt)` lifecycle.
- **Hand-designed maps** — maps are fixed, not procedurally generated. Stored as JSON tile arrays. A separate map-maker tool will be built later (see Future below).

---

## Phases

### Phase 1: Foundation

- [x] **1.1** Create `web/index.html` — canvas element, load PixiJS v8 from CDN, load `app.js` as module
- [x] **1.2** Create `web/app.js` — `App` class: init `PIXI.Application`, screen management (`switchScreen`), keyboard listener (`keydown`/`keyup`), game loop via PIXI ticker
- [x] **1.3** Create `web/screens/Screen.js` — base class with `PIXI.Container`, lifecycle methods (`enter`, `exit`, `handleInput`, `update`)
- [x] **1.4** Smoke test — open in browser, see blank canvas, confirm no errors in console

### Phase 2: Core Systems

- [x] **2.1** Port `game.js` → `web/game.js` — copy as-is, remove any Node-isms (there shouldn't be any, it's pure logic). Keep all exports: `tick`, `simulateTimePassed`, `feed`, `play`, `sleep`, `clean`, `addEvent`, `addNotification`
- [x] **2.2** Port `state.js` → `web/state.js` — rewrite persistence for single-save:
  - `loadState()` → `JSON.parse(localStorage.getItem('pet-protector'))`, returns null if no save
  - `saveState(state)` → `localStorage.setItem('pet-protector', JSON.stringify(state))`
  - `createNewState(name, type)` → create default state object with given name/type, save it
  - Keep `defaultState` shape as-is

### Phase 3: Screens

Each screen is a `PIXI.Container` that draws text and handles input. Menus are `PIXI.Text` objects repositioned on selection changes.

- [x] **3.1** `StartupScreen` — the pet PiP fills the entire screen, "press any key to start" overlaid. On key press:
  - If no save exists → create a new default state (hardcoded name for now, name input can come later)
  - If save exists → load it
  - PiP shrinks into the corner as we transition to GameScreen
- [x] **3.2** `GameScreen` — the main screen:
  - Stat bars rendered as colored rectangles (PIXI.Graphics) with text labels
  - Game tick runs via PIXI ticker at configured rate
- [x] **3.3** `SettingsScreen` — option list with left/right to cycle values, ENTER to save, ESC to discard
- [x] **3.4** `LogScreen` — scrollable text list of events, ESC/ENTER to return

### Phase 4: World map (test)

A minimal 10×10 tile map to test movement, camera, and scale before committing to real art.

- [x] **4.1** Create `web/maps/test.json` — 10×10 grid, mostly grassland (`G`) with a clump of forest (`F`) in the centre
- [x] **4.2** Create `web/world.js` — loads map JSON, renders tiles as coloured rectangles with a letter label:
  - Grassland: light green background, "G" text
  - Forest: dark green background, "F" text
- [x] **4.3** Integrate into `GameScreen` — the map renders as the main view
- [x] **4.4** Spirit & pet markers:
  - **Spirit** = small white square on its current tile
  - **Pet** = small black square on its current tile
  - Spirit is controlled by arrow keys
  - Spirit is leashed to the pet — cannot move more than 3 tiles away
  - Pet follows the spirit (pathfinding TBD — for now just steps toward it)
- [x] **4.5** Camera — view is centred on the **pet**
- [x] **4.6** Tune tile size and zoom level — figure out how many tiles should be visible at once, how zoomed in feels right
- [x] **4.7** Fog of War — maps are obscured by fog; vision around the spirit clears it
- [x] **4.8** Inspect Elements — Creature PiP and Scene PiP rendering based on adjacent tiles ('C' and 'R' tiles)

### Phase 5: UI Removal & Diegetic Feedback

- [x] **5.1** Remove Stat Bars — Delete the Pet PiP's explicit stat bars (health, hunger, etc.), embracing a UI-light, atmospheric experience.
- [x] **5.2** Diegetic Needs (v1.1) — Implement a separate pop-out box emerging from the Pet PiP to display the relevant emoji for immediate needs (e.g. 💧 for thirsty, 🍎/🥩 for hungry, 💤 for tired).
- [x] **5.3** Growth Stages (PoC) — Add a "development stage" variable. Certain things will be restricted by its current stage. For now, defaulting to stage 1 is sufficient; no need for physical growth graphics or hibernation sequences yet.
- [x] **5.4** Custom Font & Layout Pass — Responsive sizing, pixel/retro font via CSS `@font-face` for text, and screen transitions (fade in/out).

### Phase 6: Atmosphere & Environmental Storytelling

- [ ] **6.1** Vibrant & Atmospheric Palette — Establish a "cartoonish celebration of nature." Grassy plains are bright and peaceful. The spirit emits light.
- [ ] **6.2** Claustrophobic Forests — When entering dense forests, the canopy fades in a circle around the spirit (revealing roots/trunks), but visibility is heavily reduced to make it feel creepy.
- [ ] **6.3** Ruins & Murals — Make 'R' (Ruins) expand into large "Scene PiPs" (full-screen or prominent murals). These tell the story of what wiped out the ancient civilization.
- [ ] **6.4** Creature Interactions — Encounters trigger the Creature PiP opposite the Pet PiP, creating a split-screen "dialogue" of reactions and emotes to befriend them.
- [x] **6.5** Interactive Environment Tiles (Water, Cave, Apple) and tuned stat logic.
    - [x] Implement Water, Cave, Apple tiles.
    - [x] Refactor stats to Nutrition, Energy, Hydration only.
    - [x] Fix stat decay rates (half-life of ~1 min).
    - [/] Debugging Location Persistence (Added logging and safety checks).
- [ ] **6.6** Deployment — Set up GitHub Pages hosting (via GitHub Actions) so the game can be played online. This will serve as our primary playtesting environment.

### Phase 7: Progression & Abilities

- [ ] **7.1** Befriending Mechanic — Interactions with creatures lead to befriending them, rather than combat.
- [ ] **7.2** Unlock Abilities — Creatures grant unique traversal abilities (Climbing, Swimming, Claws for thickets, Magic Eyes, Super Jump, Shrink, Scent, Courage).
- [ ] **7.3** Movement Gates — Restrict map traversal based on lacking abilities (e.g., needing climbing to scale cliffs, claws to break magic thickets).

### Phase 8: Sound & Audioscapes

- [ ] **8.1** Distance-based Volume — Pet noises (roars, grunts) fade out the further the spirit moves away from the pet.
- [ ] **8.2** Ambient Life — Wind rustling leaves, running water, weather, and birds.
- [ ] **8.3** Creature & Magic Audio — Unique, fantastical sounds for the creatures encountered and the abilities used.

---

## Notes for resuming

- **Phase 1-2 is the minimum viable session** — gets a canvas running with game logic and persistence. Can be done in one sitting.
- **Phase 3 and 4 are the core web systems** — Map rendering, rendering markers, basic inputs.
- **Phase 5-6 is the emotional and atmospheric core** — This replaces the old parity checks since the UI-heavy CLI version is irrelevant. Focus on visuals, environmental cues, and storytelling.
- **Phase 7 and 8 expand the gameplay** — Abilities and rich soundscapes add depth.

Each checkbox can be ticked independently. If you run out of credits mid-session, just note which phase/step you're on and we pick up from there.

## How to test

Open `web/index.html` in a browser (or `npx serve web/` for a local server if modules need it). No build step. Just refresh to see changes.

## Future: Map Maker

Maps are hand-designed, not generated. A separate **map-maker** tool will be built in its own folder alongside `pet-protector/` (e.g. `random-stuff/map-maker/`). It should allow painting tiles with the mouse and export map data as minimal JSON. This is out of scope for the web port but noted here for reference.

## Future: Pet PiP Parallax View

The Pet PiP will eventually evolve from a static status box into a side-scrolling view of the pet. It will feature parallax renditions of the environment the pet is moving through and showcase animations of its current actions.

## Future: Isometric & Fluid Movement

Currently, the game runs on a rigid, top-down coordinate tile system. In the future, the architecture will transition to an isometric view with fluid, free-form movement (rather than discrete tile steps), while keeping the core mechanics the same.
