# Pet Protector 🐾

A persistent terminal-based pet care game. Your pet lives on your computer and continues to exist (and get hungry!) even when you aren't playing.

## Features

- **Persistent State**: Your pet's stats are saved automatically.
- **Offline Simulation**: Opening the game after a long break will calculate how much time has passed and update your pet's condition accordingly.
- **Retro Interface**: Simple, colorful terminal UI.

## Setup

1.  Make sure you have [Node.js](https://nodejs.org/) installed.
2.  Install dependencies:
    ```bash
    npm install
    ```

## How to Play

Start the game with:
```bash
node index.js
```

### Controls
The game uses keyboard shortcuts:

- **`F`**: Feed (Reduces hunger)
- **`P`**: Play (Increases happiness, reduces energy)
- **`S`**: Sleep (Restores energy)
- **`C`**: Clean (Increases hygiene)
- **`O`**: Options / Settings (Change game speed)
- **`Q`**: Quit (Save and exit)

### Tips
- Check on your pet at least once a day!
- If you leave your pet alone for too long, they might be very unhappy when you return.

## Project Structure

- `index.js`: Main entry point and UI loop.
- `game.js`: Core game logic and simulation rules.
- `state.js`: Handles loading and saving to `state.json`.
