# PUBLIC/SRC — Isometric Bar Frontend

Vanilla JS Canvas 2D game. No framework, no build step. ES modules loaded directly by browser. Served as static files by Express (`server.js`).

## STRUCTURE

```
public/
  index.html                # Single HTML: canvas + HUD DOM + chat panel + ALL CSS inline
  src/
    main.js                 # ENTRY: init sequence + requestAnimationFrame game loop
    state.js                # GameState singleton — all systems read/write this one object
    api/
      client.js             # fetch() wrappers for /api/* + SSE EventSource connection
    engine/
      renderer.js           # Isometric renderer: tile↔screen math, painter's-order draw
      input.js              # Click pathfind, WASD, E interact, ESC close, scroll zoom
      tilemap.js            # 15x10 bar layout + PERSONA_POSITIONS (3 NPCs) + CATEGORY_COLORS
      tiles.js              # Tile type enum + isWalkable()
      pathfinding.js        # A* on 4-dir grid, Manhattan heuristic, max 30 tiles
    entities/
      index.js              # Entity manager: spawns avatar + personas + furniture, proximity detect
      avatar.js             # Player: smooth tile-to-tile interpolation, trapezoid sprite
      persona.js            # NPC: idle bob, drift trembling, trust glow, name tag
      furniture.js          # Jukebox (BPM pulse) + neon "O FIM" sign (entropy flicker)
    fx/
      index.js              # FX pipeline: [rain, neon, glitch, crt] — ordered, crt always last
      rain.js               # Tropical rain particles + splash ripples
      neon.js               # Radial gradient lighting from 3 tile-space sources
      glitch.js             # 5-tier entropy effects: RGB shift → tear → noise → shake
      crt.js                # Scanlines + vignette, intensity scales with entropy
    ui/
      chat.js               # Chat panel: per-persona sessions, /api/invoke, trust/drift updates
      hud.js                # DOM HUD: entropy bar, paranoia eye, ambient text, arc phase
      proximity.js          # Floating "[E] Conversar com {Name}" prompt
```

## GAME LOOP

```
init()
  → fetch /api/personas → populate GameState.personas Map
  → fetch /api/state → load entropy/ambient/paranoia
  → initEntities, initInput, initChat, initHUD, initProximity, initFX
  → connectSSE (real-time updates)
  → requestAnimationFrame(gameLoop)

gameLoop(timestamp)
  → updateEntities(dt) → updateFX(dt) → updateProximity → updateHUD
  → render(ctx, GameState, map, entities)
  → drawFX(ctx)  // overlay after main render
```

## BACKEND CONNECTION

| Endpoint | Direction | Used By | Purpose |
|----------|-----------|---------|---------|
| `GET /api/personas` | Boot | `main.js` | List all personas for NPC spawning |
| `GET /api/state` | Boot | `main.js` | Initial entropy/ambient/paranoia |
| `POST /api/invoke` | Chat | `ui/chat.js` | Send query → get persona response |
| `POST /api/complete` | Chat close | `ui/chat.js` | End session → persist memories |
| `SSE /api/events` | Continuous | `api/client.js` | entropy, ambient, paranoia, bleed ticks |

User identity: `crypto.randomUUID()` in localStorage (`aeon-user-id`), sent as `X-User-Id` header.

## CONVENTIONS

- **Single mutable GameState** — no events, no pub/sub, no immutability. All systems read/write one object
- **Factory functions, not classes** — `createAvatar()`, `createPersona()` return `{ update(dt), draw(ctx) }` objects
- **Canvas for world, DOM for UI** — isometric scene on `<canvas>`, HUD/chat as HTML in `#ui-layer`
- **Entropy drives visuals** — level 0-1 controls: glitch tier, CRT opacity, neon dimming, jukebox BPM, sign flicker
- **Isometric coords** — `TILE_W=32, TILE_H=16`. `tileToScreen()` / `screenToTile()` with camera zoom (1x-4x)
- **Graceful degradation** — every API call has try/catch with fallback defaults. Backend down → hardcoded positions
- **All CSS inline in index.html** — no external stylesheets. "Tropicalia Noir" palette (amber/neon, VT323 + Cormorant Garamond)
- **All rendering is procedural** — trapezoids, circles, gradients. `assets/` dirs exist but are empty (prepared for sprites)

## NOTES

- Only 3 personas positioned: `pessoa` (4,2), `crowley` (7,2), `tesla` (11,2). 22 others exist in DB but have no tile position
- Depth sorting: entities sorted by `tileY` then `tileX` (painter's algorithm)
- Proximity interaction radius: 2.5 tiles
- SSE auto-reconnects after 5 seconds on disconnect
- FX pipeline order matters: rain → neon → glitch → crt (crt always last)
- Entropy tiers: stable < 0.3 < unsettled < 0.5 < decaying < 0.7 < fragmenting < 0.9 < dissolving
