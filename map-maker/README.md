# Pet Protector Map Maker

A high-performance web tool for building massive, chunked maps for the Pet Protector game.

## Prerequisites

- Node.js installed.
- Dependencies installed (`npm install` in this directory).

## Running the tool

You can start both the server and the editor with a single command:

```bash
npm run dev:all
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

Alternatively, you can run them in separate terminals:

### 1. Start the File System Manager (Local Server)
```bash
npm run server
```

### 2. Start the Web UI
```bash
npm run dev
```
Then open [http://localhost:5173](http://localhost:5173) in your browser.

## Features

- **Infinite Exploration**: Chunked map storage (32x32) allows for god-damned massive worlds.
- **Robust Saves**:
  - Background auto-save to `_tmp` directories every 5 seconds.
  - **Atomic Promotion**: Manual save rotates `old_del` <- `old` <- `master` <- `tmp` to ensure zero data loss.
- **Action History**: Support for `Ctrl+Z` (Undo) and `Ctrl+Y` (Redo).
- **Navigation**:
  - **Middle-Click Drag** / **Alt+Left Click Drag** to pan.
  - **Scroll** to zoom.
  - **Search & Snap**: Sidebar tool to quickly center the camera on named Spawners, Zones, or Warps.
- **Map Deployment**: Sync maps to the main game folder with a single checkbox.

## Development

### Running Tests
To verify the safety of the save logic:
```bash
node src/server/server.test.js
```
