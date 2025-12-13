# 🔥 Inferno City

**炎上都市 - 延焼対戦シミュレーター**

A local PvP simulation game where one player spreads fire and another prevents it, set in a 3D city model based on PLATEAU data.

## 🎮 Game Concept

Two players share one screen and one mouse to battle in real-time:
- **Player 1 (Defense)**: Protect the city by building walls and extinguishing fires
- **Player 2 (Offense)**: Burn the city by igniting buildings strategically

**Win Condition:**
- P1 wins if damage < 50% after 60 seconds
- P2 wins if damage ≥ 50%

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 + React 19
- **3D Engine**: Three.js
- **Language**: JavaScript (ES6)
- **Styling**: CSS3
- **3D Models**: GLB/GLTF (PLATEAU Kyoto City Data)

## 🚀 Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Open browser at http://localhost:3000
```

## 🎯 Controls

- **Left Click**: Player 1 - Build Wall (¥100) / Extinguish (¥300)
- **Right Click / Shift+Click**: Player 2 - Ignite building
- **WASD**: Pan camera
- **Space**: Zoom out
- **Shift**: Zoom in

## 📂 Project Structure

```
src/
├── app/              # Next.js App Router
│   ├── page.jsx      # Main page
│   ├── layout.jsx    # Root layout
│   └── globals.css   # Global styles
├── components/       # React components
│   ├── ThreeCanvas.jsx  # 3D scene & game logic
│   └── GameUI.jsx       # UI overlay
└── lib/              # Game logic modules
    ├── config.js     # Game configuration
    ├── state.js      # Game state management
    ├── audio.js      # Sound effects
    └── particles.js  # Fire particle system
```

## 🏙️ About PLATEAU

This game uses 3D city models from [PLATEAU](https://www.mlit.go.jp/plateau/) (国土交通省 Project PLATEAU), Japan's initiative to create nationwide 3D urban models for disaster prevention and urban planning.

## 📝 License

MIT

## 🙏 Acknowledgments

- PLATEAU (Ministry of Land, Infrastructure, Transport and Tourism)
- Three.js Community
- Next.js Team