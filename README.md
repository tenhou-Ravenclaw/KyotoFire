# 🔥 KyotoFire

**炎上都市 - 延焼対戦シミュレーター**

A real-time online multiplayer simulation game where players compete to spread or control fire across a 3D city model based on PLATEAU data.

## 🎮 Game Concept

Up to 4 players can compete online in real-time battles:
- Players take turns spreading fire or defending the city
- Win by burning the highest percentage of buildings within the time limit

**Win Condition:**
- The player who burns the most buildings (by percentage) wins
- Fire spreads automatically to adjacent buildings
- Battle ends after the time limit

## 🛠️ Tech Stack

- **Frontend**: Next.js 15 + React 19
- **3D Engine**: Three.js
- **Realtime Database**: Firebase Realtime Database
- **Language**: JavaScript (ES6)
- **Styling**: CSS3
- **3D Models**: GLB/GLTF (PLATEAU Kyoto City Data)

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Realtime Database** in your Firebase project
3. Set database rules to allow read/write (for development):
   ```json
   {
     "rules": {
       "rooms": {
         ".read": true,
         ".write": true
       }
     }
   }
   ```
   ⚠️ **Note**: These rules are for development only. Update them for production!

4. Get your Firebase configuration from Project Settings > General > Your apps
5. Create a `.env.local` file in the project root:
   ```bash
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

### 3. Run Development Server

```bash
npm run dev

# Open browser at http://localhost:3000
```

## 🌐 How to Play Online Multiplayer

1. **Create a Room**: Click "ルームを作成" (Create Room) on the main menu
2. **Share Room ID**: Copy the generated room ID and share it with other players
3. **Join Room**: Other players click "ルームに参加" (Join Room) and enter the room ID
4. **Wait in Lobby**: All players wait in the lobby until the host starts the game
5. **Host Starts Game**: When ready (minimum 2 players), the host clicks "GAME START"
6. **Play**: Each player is assigned a unique ID and plays on their own device
7. **Results**: After the time limit, results are synchronized and the winner is announced

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
│   ├── page.jsx      # Main menu
│   ├── layout.jsx    # Root layout
│   ├── globals.css   # Global styles
│   └── battle/       # Battle mode
│       ├── page.jsx       # Battle page & lobby
│       ├── create/        # Create room
│       │   └── page.jsx
│       └── join/          # Join room
│           └── page.jsx
├── components/       # React components
│   ├── ThreeCanvas.jsx  # 3D scene & game logic
│   └── GameUI.jsx       # UI overlay
└── lib/              # Game logic modules
    ├── config.js          # Game configuration
    ├── state.js           # Game state management
    ├── audio.js           # Sound effects
    ├── particles.js       # Fire particle system
    ├── firebase.js        # Firebase initialization
    └── firebaseHelpers.js # Firebase CRUD helpers
```

## 🏙️ About PLATEAU

This game uses 3D city models from [PLATEAU](https://www.mlit.go.jp/plateau/) (国土交通省 Project PLATEAU), Japan's initiative to create nationwide 3D urban models for disaster prevention and urban planning.

## 📝 License

MIT

## 🙏 Acknowledgments

- PLATEAU (Ministry of Land, Infrastructure, Transport and Tourism)
- Three.js Community
- Next.js Team