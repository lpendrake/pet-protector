# Pet Protector 🐾

A beautiful, atmospheric web-based pet care adventure. You play as a **Spirit**, tethered to and protecting a magical **Pet** named Buddy, as you explore a world filled with ancient ruins, dense forests, and mysterious creatures.

The game is built with **PixiJS** and features a minimalist, diegetic UI that prioritizes atmosphere and environmental storytelling over traditional menus.

## 🌟 Key Features

- **Diegetic UI**: No health bars or numbers. Your pet communicates its needs (Nutrition, Energy, Hydration) through visual cues and thought bubbles.
- **Atmospheric World**: Explore a tile-based map with a dynamic Fog of War system.
- **Interactive Environment**:
  - 💧 **Water (W)**: Replenishes hydration completely.
  - 💤 **Caves (V)**: Allows Buddy to rest and restore energy.
  - 🍎 **Apples (A)**: Sate hunger; apples regrow dynamically over time.
- **Resilient Persistence**: Your progress is saved to `localStorage`. The game is tab-aware—it pauses when in the background and automatically re-syncs state when you return to the tab.
- **Modern Web Architecture**: Built with vanilla JavaScript modules and PixiJS, optimized for browser play with zero build steps required for local development.

## 🚀 Quick Start

### Play Online
The game is hosted on GitHub Pages:
[**Play Pet Protector Now**](https://lpendrake.github.io/pet-protector/)

### Run Locally
1. Clone the repository.
2. Navigate to the `pet-protector/` folder.
3. Start a local server (e.g., using `npx serve`):
   ```bash
   npx serve web/
   ```
4. Open the provided local URL in your browser.

## 🎮 Controls

- **Arrow Keys / WASD**: Move the Spirit.
- **Space**: Call Buddy to your location.
- **Esc**: Open menus (Settings/Log) or close murals.
- **Any Key**: Start the game from the splash screen.

*Note: The Spirit is leashed to Buddy—you can only move a few tiles away before needing to wait or call him to you.*

## 🛠️ Project Structure

- `web/index.html`: Main entry point.
- `web/app.js`: Core Application logic and screen management.
- `web/game.js`: Stat decay and interaction logic.
- `web/state.js`: Persistence, versioning, and tab-syncing.
- `web/world.js`: Tile-based map loading and rendering.
- `web/screens/`: Individual game screens (Startup, Game, Settings, Log).
- `web/maps/`: Map data in JSON format.

## 📜 Development Lore

This project is a modern web reconstruction of an older terminal-based game. It focuses on a "cartoonish celebration of nature" aesthetic, drawing inspiration from retro pixel-art and environmental exploration games.
