# 🎨 Collab Whiteboard

A real-time collaborative whiteboard application built with React, Node.js, Socket.io, and PostgreSQL. Multiple users can draw, annotate, and collaborate together on a shared canvas in real time.

---

## 🚀 Features

### ✏️ Drawing Tools
- **Pen** — freehand drawing with smooth curves
- **Highlighter** — semi-transparent highlighting
- **Eraser** — erase parts of the canvas
- **Rectangle, Circle, Triangle, Diamond** — shape tools
- **Arrow & Straight Line** — directional and line tools
- **Text** — place text anywhere with font/size/bold/italic options
- **Sticky Notes** — coloured sticky notes, double-click to edit
- **Image Upload** — upload images directly onto the canvas

### 🎨 Drawing Controls
- 10-colour palette + custom colour picker
- Stroke size slider (1–20)
- Opacity slider (10–100%)
- Line style: solid / dashed / dotted

### 🔁 Canvas Actions
- **Undo / Redo** — full history stack (Ctrl+Z / Ctrl+Y)
- **Clear** — clears current page (host/allowed users only)
- **Save** — persists all pages to the database (Ctrl+S)
- **Download PNG** — exports canvas as high-resolution image

### 🔍 Zoom
- Zoom In / Out buttons (Ctrl + = / Ctrl + −)
- Click % label to reset to 100% (Ctrl+0)
- **Fit to Screen** button
- Scroll wheel zoom toward cursor (Figma-style)
- Range: 5% to 1000%

### 📄 Multi-Page Support
- Add unlimited pages
- Rename pages (double-click tab)
- Delete pages
- All pages saved together

### 👑 Host / Viewer Permission System
- Board **creator** is automatically the **👑 Host**
- Anyone opening the shared link is a **👁️ Viewer** (read-only by default)
- Host can grant **✏️ draw access** to specific viewers
- Host can revoke access at any time
- Role badge shown in top bar for all users

### 👥 Real-Time Collaboration
- Live cursors with user names and colours
- Presence list (who is currently in the board)
- **Follow mode** — follow another user's cursor
- All drawing updates broadcast instantly

### 💬 Chat
- Real-time chat in the right sidebar
- Typing indicators
- Collapsible panel

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Canvas | React-Konva (HTML5 Canvas) |
| Styling | Tailwind CSS |
| Real-time | Socket.io |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Auth | Google OAuth 2.0 (Passport.js) |
| Deployment | Docker + docker-compose |

---

## ⚡ Quick Start

### Prerequisites
- Docker Desktop installed and running
- Git

### 1. Clone the repository
```bash
git clone https://github.com/riyaz7799/whiteboard-bloom.git
cd whiteboard-bloom
```

### 2. Set up environment variables
```bash
cp .env.example .env
```

Edit `.env` with your values:
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
SESSION_SECRET=any_random_string
DATABASE_URL=postgresql://postgres:password@db:5432/whiteboard
FRONTEND_URL=http://localhost:3000
```

### 3. Start with Docker
```bash
docker-compose up --build
```

### 4. Open in browser
```
http://localhost:3000
```

---

## 🔑 Environment Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `SESSION_SECRET` | Secret key for session encryption |
| `DATABASE_URL` | PostgreSQL connection string |
| `FRONTEND_URL` | Frontend URL for CORS and OAuth redirect |
| `PORT` | Backend port (default: 3001) |

**Getting Google OAuth credentials:**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project → APIs & Services → Credentials
3. Create OAuth 2.0 Client ID (Web Application)
4. Add `http://localhost:3001/api/auth/google/callback` as Authorized redirect URI

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/api/auth/google` | Start Google OAuth login |
| GET | `/api/auth/google/callback` | OAuth callback |
| GET | `/api/auth/session` | Get current user session |
| GET | `/api/auth/logout` | Logout |
| GET | `/api/boards` | List all boards for current user |
| POST | `/api/boards` | Create a new board |
| GET | `/api/boards/:boardId` | Load a board (returns objects + pages + ownerId) |
| POST | `/api/boards/:boardId` | Save a board (accepts objects array) |
| DELETE | `/api/boards/:boardId` | Delete a board |

---

## 🔌 WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `joinRoom` | Client → Server | Join a board room |
| `draw` | Client → Server | Broadcast a freehand stroke |
| `addObject` | Client → Server | Add a shape / text / sticky |
| `cursorMove` | Client → Server | Broadcast cursor position |
| `chatMessage` | Client → Server | Send a chat message |
| `setDrawPermission` | Host → Server | Grant or revoke draw access |
| `drawPermission` | Server → Viewer | Receive draw permission update |
| `roomUsers` | Server → Client | Updated user list |
| `cursorUpdate` | Server → Client | Remote cursor moved |
| `drawUpdate` | Server → Client | New stroke received |
| `objectAdded` | Server → Client | New shape received |

---

## 🧪 Automated Test IDs

| Element | `data-testid` |
|---------|--------------|
| Pen tool button | `tool-pen` |
| Eraser tool button | `tool-eraser` |
| Rectangle tool button | `tool-rectangle` |
| Circle tool button | `tool-circle` |
| Triangle tool button | `tool-triangle` |
| Diamond tool button | `tool-diamond` |
| Arrow tool button | `tool-arrow` |
| Line tool button | `tool-line` |
| Text tool button | `tool-text` |
| Sticky note tool | `tool-sticky` |
| Image tool button | `tool-image` |
| Undo button | `undo-button` |
| Redo button | `redo-button` |
| User presence list | `user-list` |
| Remote cursors | `remote-cursor` |

**Canvas JSON (for automated tests):**
```javascript
// Returns current canvas state as a JSON array of all objects
const state = window.getCanvasAsJSON();
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `Ctrl + S` | Save |
| `Ctrl + =` | Zoom In |
| `Ctrl + -` | Zoom Out |
| `Ctrl + 0` | Reset Zoom |
| `Escape` | Cancel current action |
| `P` | Pen tool |
| `E` | Eraser |
| `H` | Highlighter |
| `R` | Rectangle |
| `C` | Circle |
| `T` | Triangle |
| `D` | Diamond |
| `A` | Arrow |
| `Q` | Straight Line |
| `X` | Text |
| `N` | Sticky Note |

---

## 📁 Project Structure

```
whiteboard-bloom/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Board.tsx         # Main whiteboard canvas
│   │   │   ├── Dashboard.tsx     # Board management
│   │   │   ├── Auth.tsx          # Login page
│   │   │   └── Index.tsx         # Landing page
│   │   ├── stores/
│   │   │   └── authStore.ts      # Auth state (Zustand)
│   │   └── App.tsx
│   ├── Dockerfile
│   └── nginx.conf
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── boards.js         # Board CRUD API
│   │   │   └── auth.js           # Google OAuth routes
│   │   ├── socket.js             # WebSocket event handlers
│   │   ├── db.js                 # PostgreSQL connection
│   │   └── index.js              # Express server entry point
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
├── submission.json
└── README.md
```

---

## 🐳 Docker Services

| Service | Port | Description |
|---------|------|-------------|
| `frontend` | 3000 | React app served via Nginx |
| `backend` | 3001 | Node.js REST API + Socket.io |
| `db` | 5432 | PostgreSQL database |

---

## 👨‍💻 Author

**Mohammad Riyaz**
GitHub: [@riyaz7799](https://github.com/riyaz7799)