# 🤪 Drunk Walker: Street View Chaos

**[👉 Launch Drunk Walker Instantly (Any Device)](https://genaforvena.github.io/drunk-walker/)**

## 🌀 What is Drunk Walker?

**Drunk Walker** is a chaotic, "blind" automation engine for Google Street View. It transforms the world's most famous mapping service into an unpredictable travelogue by simulating human-like clicks to move through the streets.

Unlike traditional navigators, Drunk Walker has no destination and no sense of direction. It simply "walks" by clicking around the center of the screen, leading to mesmerizing, often futile, and occasionally beautiful journeys.

---

## 🚀 Instant Launch (No Install)

For the fastest experience on any browser (Desktop or Mobile), use the **Developer Console** method:

1.  **[Click here for the One-Click Copy Page](https://genaforvena.github.io/drunk-walker/)**
2.  Click **COPY JS TO CLIPBOARD**.
3.  Open [Google Maps Street View](https://www.google.com/maps).
4.  Press `F12` (or `Right-Click > Inspect`) and go to the **Console** tab.
5.  Paste the code and press **Enter**.
6.  Use the on-screen control panel to **START** the walk!

---

## 🌟 Key Features (v3.4-EXP)

- **🔄 Auto-Unstuck Algorithm**: When stuck, automatically turns left 60° and moves forward to recover navigation (always on).
- **📍 Optional Path Collection**: Opt-in to contribute your walk data to the global dashboard (completely optional, privacy-focused).
- **👀 Smart Observation**: Automatically pauses clicking whenever you manually drag the mouse to look around, then resumes when you release.
- **🎯 Optimized Forward-Targeting:** Default clicks at 70% height—the "sweet spot" for Street View movement.
- **⌨️ Keyboard Mode (Default):** Simulates Arrow Up key press for smoother, more reliable navigation.
- **📊 Control Panel:** Minimalist UI with **START/STOP** toggle, **Pace Slider**, path collection toggle, and live step counter.
- **🎚️ Adjustable Pace:** Speed control from 0.5 to 5.0 seconds per step.
- **💾 Session-Aware:** Recalculates screen dimensions every time you hit START.
- **🌐 Cross-Browser:** Works on Chrome, Firefox, Safari, and Edge.

---

## 📍 Path Collection (Opt-In)

**Completely optional.** Enable the "Collect Walk Path" checkbox in the control panel to contribute your walk data to the global dashboard.

**What is collected:**
- URL after each step
- Fixed rotation angle (60°)
- Timestamp when you stop walking

**What is NOT collected:**
- No IP addresses
- No personal identifiers
- No browser fingerprints
- No location data beyond Street View URLs

**Privacy:** Data is stored anonymously and used only for the global walk dashboard.

---

## 🌍 Global Walk Dashboard

View collected walks from users worldwide:

- **Total walks** collected
- **Total steps** recorded
- **Expandable walk details** showing each step's URL and rotation

**[📊 View Dashboard](/dashboard)** | **[📈 Stats API](/api/stats)**

### Backend Server Setup

To enable path collection and the dashboard:

```bash
cd server
npm install
npm start
```

Server runs on `http://localhost:3000` with:
- `POST /api/submit-walk` - Submit walk data
- `GET /api/stats` - Get aggregate statistics
- `GET /api/walks` - List recent walks
- `GET /api/walk/:id` - Get walk details
- `/dashboard` - Public dashboard page

### 🚀 Deployment (Free Hosting)

Deploy the server to any Node.js hosting platform. Here are recommended free options:

#### Option 1: Railway (Recommended)

**One-Click Deploy:**

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/new?template=https://github.com/genaforvena/drunk-walker)

**Manual Deploy:**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project in this repo
railway init

# Deploy
railway up
```

Railway automatically:
- Detects Node.js from `server/package.json`
- Sets the `PORT` environment variable
- Deploys from the `server` directory (configured in `railway.toml`)

**Your deployed URL:** `https://your-project.railway.app`

#### Option 2: Render

**Manual Deploy:**

1. Create a new **Web Service** on [Render](https://render.com)
2. Connect your GitHub repository
3. Configure:
   - **Build Command:** `cd server && npm install`
   - **Start Command:** `cd server && npm start`
   - **Environment:** `Node`
4. Add a **Disk** for persistent storage:
   - **Mount Path:** `/opt/render/project/src/server/walks.db`
   - **Size:** 1GB (free tier)

**Your deployed URL:** `https://your-service.onrender.com`

#### Option 3: Fly.io

```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Login
fly auth login

# Launch (creates fly.toml)
fly launch --no-deploy

# Edit fly.toml to set working directory to server
# Then deploy
fly deploy
```

---

### 🔧 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port (set by hosting platform) | `3000` |

Copy `.env.example` to `.env` for local development.

---

### 📊 Dashboard Access

Once deployed, access the dashboard at:

- **Dashboard:** `https://your-deployed-url.com/dashboard`
- **Stats API:** `https://your-deployed-url.com/api/stats`
- **Walks API:** `https://your-deployed-url.com/api/walks`

---

### 🔧 Frontend Configuration (Important!)

The bookmarklet needs to know where to send path data. By default, it uses a relative path (works for local development).

**For deployed servers, configure the backend URL:**

#### Method 1: Console Command (Before Starting)

Before running the bookmarklet, paste this in the console:

```javascript
window.DRUNK_WALKER_BACKEND_URL = 'https://your-server.railway.app';
```

Then paste the bookmarklet code.

#### Method 2: Modify the Bookmarklet

Edit `src/main.js` and set the default:

```javascript
const DEFAULT_BACKEND_URL = 'https://your-server.railway.app';
```

Then rebuild: `npm run build`

#### Method 3: Custom Loader Page

Host your own `index.html` with the backend URL pre-configured:

```html
<script>
  window.DRUNK_WALKER_BACKEND_URL = 'https://your-server.railway.app';
</script>
<script src="bookmarklet-loader.js"></script>
```

---

## 🔄 Auto-Unstuck Algorithm

When Drunk Walker detects it's stuck (URL unchanged for 3 consecutive steps), it automatically:

1. **Turns Left 60°** - Holds ArrowLeft for 600ms
2. **Moves Forward** - Presses ArrowUp in the new direction
3. **Verifies Success** - Checks if URL changed, resets on success

The turn angle is fixed at 60° for reliable recovery.

---

## 🛠️ Extension Installation (Optional)

For a permanent browser extension instead of the console method:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/genaforvena/drunk-walker.git
    ```
2.  **Firefox (Temporary):**
    - Go to `about:debugging` > "This Firefox" > "Load Temporary Add-on...".
    - Select `manifest.json`.
3.  **Chrome/Chromium:**
    - Go to `chrome://extensions`.
    - Enable "Developer mode" and click "Load unpacked".
    - Select the project folder.

> **Note:** The console method (above) is recommended for quick access on any device.

---

## 📚 Documentation

- **[🚀 DEPLOYMENT.md](DEPLOYMENT.md)** - Complete deployment guide (Railway, Render, Fly.io)
- **[UNSTUCK_ALGORITHM.md](UNSTUCK_ALGORITHM.md)** - Detailed documentation of the auto-recovery system
- **[Spec.md](Spec.md)** - Full technical specification
- **[PROJECT_MEMORY.md](PROJECT_MEMORY.md)** - Architecture and project knowledge base

---

## ⚠️ Ethical Note
This is a technical experiment and art project. It includes rate-limiting (min 0.5s interval) to avoid appearing as an automated attack on Google services. Use responsibly.

---
*Created with ❤️ and a lot of confusion.*
