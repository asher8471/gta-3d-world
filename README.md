# Neo Block City

Neo Block City is a lightweight 3D sandbox inspired by classic open-world games. It is built entirely with [Three.js](https://threejs.org/) and Vite, runs directly in the browser, and now features a living city complete with traffic, NPCs, waterfront boardwalks, and an expanded mission list to guide your exploration.

## Features

- 🌆 **Cinematic atmosphere** with an animated sky dome, dynamic day-night cycle, volumetric fog, and flickering neon to keep the skyline alive.
- ⛈️ **Reactive weather** that shifts between calm nights, misty drizzles, full rainstorms, and lightning-laced ion squalls.
- 🏙️ **District-based skyline** featuring rooftop gardens, holographic signage, and detailed collision volumes to keep navigation grounded.
- 🚗 **Reactive traffic** with neon hover cars cruising the cross streets and casting dynamic headlights across the asphalt.
- 🧍 **Stylized citizens** who patrol the districts, complete with a synthwave busker that anchors one of the new missions.
- 🌊 **Waterfront boardwalk** lined with lanterns, benches, and shimmering water so you can sprint the strip like a GTA getaway.
- 💎 **Collectible data shards** that shimmer with a holographic aura, hover above hotspots, and contribute to mission progress when captured.
- 🧭 **Mission board HUD** covering six mini objectives including the returning drone chase, neon shard hunt, and a stealthy wanted-level escape.
- 🛰️ **Citywide response system** with a dynamic wanted level and an elite security drone that will track you down if you raise too much heat.
- 🗺️ **Interactive minimap and radio** that surface mission hotspots, traffic, collectibles, and a rotating synthwave playlist.

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Launch the development server**

   ```bash
   npm run dev
   ```

   Vite will print a local URL (typically `http://localhost:5173`). Open it in a modern browser.

3. **Explore the world**

   - Click the **Enter City** button to capture the mouse via pointer-lock controls.
   - Use **WASD** to move, **Space** to jump, and **Shift** to sprint.
   - Track mission progress and energy from the heads-up display. Esc will release the pointer and show the resume overlay.
   - Glance at the minimap for mission hotspots, roaming traffic, and remaining shards.
   - Watch the wanted stars—stirring up trouble or sprinting through restricted districts will trigger the security drone.
   - Weather status updates in the HUD hint at incoming rain, fog, or ion storms that affect visibility and lighting.

## Building for production

To create an optimized build that outputs a single self-contained HTML file in `dist/index.html`:

```bash
npm run build
```

All JavaScript, CSS, and shader code is inlined so you can distribute or embed the game without additional assets. You can
preview the output locally with:

```bash
npm run preview
```

## Project structure

```
├── index.html          # Entry point served by Vite
├── package.json        # Scripts and dependencies
├── src
│   ├── styles.css      # Overlay, HUD, and general styling
│   ├── main.js         # App bootstrap and HUD wiring
│   └── game
│       ├── World.js    # Scene composition, missions, collectibles, drone logic
│       └── PlayerController.js  # Pointer lock controls, movement, stamina
└── vite.config.js      # Development server configuration
```

Enjoy the skyline!
