# Wilder.io (https://bobbrine.github.io/Wilder.io/)

## Overview
Wilder.io is a browser-based survival and crafting game inspired by classic .io-style games. The project was developed to explore real-time game systems, multiplayer networking, and performance-conscious world simulation in both online and offline environments.

The game supports two modes:
- **Multiplayer**, using a Node.js server with socket.io
- **Offline singleplayer**, with fully local world simulation

The primary goal of this project was to learn how client-server systems work in real-time applications, and how game logic can be shared or adapted across different execution models.

## Key Features
- Real-time 2D world rendering in the browser
- Resource gathering, crafting, and player statistics
- Multiplayer mode with server-authoritative state updates
- Offline singleplayer mode with local simulation
- Chunk-based world streaming for performance
- Deterministic world generation using seeded randomness

## Technologies Used
- JavaScript (browser-based client)
- HTML / CSS
- Node.js
- socket.io

## Technical Challenges & Learnings
- Designing a shared game logic model for both multiplayer and offline modes
- Implementing client-server synchronization using delta updates
- Managing performance through chunk-based world streaming
- Structuring a larger JavaScript codebase with multiple subsystems
- Handling player state, world state, and AI-driven entities

## Project Structure
- `docs/` — Browser-based multiplayer client and shared UI assets
- `docs/singleplayer/` — Offline singleplayer build with local simulation
- `server/` — Node.js multiplayer server using socket.io
- `Backup/` — Older development snapshots

## What I Learned
- Fundamentals of real-time multiplayer networking
- Server-authoritative game state design
- Performance-aware simulation techniques
- Modular JavaScript architecture for complex projects
- Debugging synchronization and timing issues in interactive systems

## Future Development
Planned improvements include:
- Unified configuration for server and world settings
- Improved tooling for client-side builds
- Further experimentation with AI-controlled entities
- Codebase cleanup and documentation improvements

## How to Run

### Multiplayer Server
1. Navigate to the `server/` directory.
2. Install dependencies:
   ```bash
   npm install
3. Start the server: node server.js
   The server runs on http://localhost:3000 by default.

### Client
- Open docs/index.html using a local web server for multiplayer.
- Open docs/singleplayer/index.html using a local web server for offline singleplayer.

## Notes
This project was developed as a personal learning exercise to better understand interactive systems, networking, and game architecture.
