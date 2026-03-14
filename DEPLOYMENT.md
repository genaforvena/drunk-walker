# 🚀 Drunk Walker Deployment Guide

Complete guide for deploying the Drunk Walker backend server to free hosting platforms.

---

## Quick Start (Railway - Recommended)

**Fastest option - deploy in under 5 minutes:**

1. **Install Railway CLI:**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Initialize & Deploy:**
   ```bash
   cd drunk-walker
   railway init
   railway up
   ```

4. **Get your URL:**
   ```bash
   railway open
   ```

5. **Configure frontend:**
   ```javascript
   // In browser console before running bookmarklet:
   window.DRUNK_WALKER_BACKEND_URL = 'https://your-project.railway.app';
   ```

---

## Platform Comparison

| Platform | Free Tier | Persistent Storage | Setup Time | Notes |
|----------|-----------|-------------------|------------|-------|
| **Railway** | $5 credit/month | ✅ Via volumes | 5 min | Recommended |
| **Render** | 750 hrs/month | ✅ Via disks | 10 min | Good alternative |
| **Fly.io** | 3 shared VMs | ✅ Via volumes | 15 min | More config needed |
| **Vercel** | ✅ Generous | ❌ Serverless only | 10 min | SQLite not ideal |

---

## Detailed Deployment Steps

### Railway

**Step 1: Create Account**
- Visit [railway.app](https://railway.app)
- Sign up with GitHub

**Step 2: Deploy from GitHub**
```bash
# Option A: CLI (recommended)
railway init
railway up

# Option B: Web UI
# 1. Click "New Project"
# 2. Select "Deploy from GitHub repo"
# 3. Choose drunk-walker repository
# 4. Set Root Directory to "server"
```

**Step 3: Configure**
- Railway auto-detects Node.js
- PORT is set automatically
- No additional config needed

**Step 4: Add Persistent Storage (Optional)**
```bash
# Create a volume for SQLite persistence
railway volume add --mount /app/server/walks.db --size 1GB
```

**Step 5: Get Your URL**
```bash
railway domain
# Output: https://your-project.railway.app
```

---

### Render

**Step 1: Create Web Service**
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository

**Step 2: Configure Service**
| Setting | Value |
|---------|-------|
| Name | drunk-walker-server |
| Environment | Node |
| Build Command | `cd server && npm install` |
| Start Command | `cd server && npm start` |
| Instance Type | Free |

**Step 3: Add Persistent Disk**
1. Go to your service → "Disks" tab
2. Click "Add Disk"
3. Configure:
   - **Mount Path:** `/opt/render/project/src/server/walks.db`
   - **Size:** 1 GB

**Step 4: Deploy**
- Click "Create Web Service"
- Wait for deployment (~2-3 minutes)
- Note your URL: `https://your-service.onrender.com`

---

### Fly.io

**Step 1: Install Fly CLI**
```bash
curl -L https://fly.io/install.sh | sh
```

**Step 2: Login**
```bash
fly auth login
```

**Step 3: Create App**
```bash
cd drunk-walker/server
fly launch --no-deploy
```

**Step 4: Configure fly.toml**
Edit `fly.toml`:
```toml
[build]
  working_directory = "/app/server"

[[mounts]]
  source = "walks_data"
  destination = "/app/server"
```

**Step 5: Create Volume & Deploy**
```bash
fly volumes create walks_data --region lhr --size 1
fly deploy
```

---

## Frontend Configuration

After deploying, configure the bookmarklet to send data to your server.

### Option 1: Console Configuration (Easiest)

Before running the bookmarklet on Google Maps:

```javascript
window.DRUNK_WALKER_BACKEND_URL = 'https://your-server.railway.app';
```

Then paste and run the bookmarklet code.

### Option 2: Custom Loader Page

Create a custom landing page:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Drunk Walker</title>
</head>
<body>
  <script>
    // Set your deployed server URL
    window.DRUNK_WALKER_BACKEND_URL = 'https://your-server.railway.app';
  </script>
  
  <!-- Load the bookmarklet loader -->
  <script src="bookmarklet-loader.js"></script>
  
  <button onclick="loadBookmarklet()">
    Copy Drunk Walker to Clipboard
  </button>
  
  <script>
    function loadBookmarklet() {
      fetch('bookmarklet.js')
        .then(r => r.text())
        .then(code => {
          navigator.clipboard.writeText(code);
          alert('Copied! Paste into browser console on Google Maps Street View.');
        });
    }
  </script>
</body>
</html>
```

### Option 3: Rebuild Bookmarklet

Modify `src/main.js`:

```javascript
const DEFAULT_BACKEND_URL = 'https://your-server.railway.app';
const getBackendUrl = () => window.DRUNK_WALKER_BACKEND_URL || DEFAULT_BACKEND_URL;
```

Then rebuild:
```bash
npm run build
```

---

## Testing Your Deployment

**1. Test Stats Endpoint:**
```bash
curl https://your-server.railway.app/api/stats
# Expected: {"totalWalks":0,"totalSteps":0}
```

**2. Test Dashboard:**
```bash
curl https://your-server.railway.app/dashboard
# Should return HTML
```

**3. Test Walk Submission:**
```bash
curl -X POST https://your-server.railway.app/api/submit-walk \
  -H "Content-Type: application/json" \
  -d '{"timestamp":"2026-03-15T00:00:00Z","steps":[{"url":"https://maps.google.com/test","rotation":60}]}'
# Expected: {"success":true,"id":1,"stepCount":1}
```

---

## Troubleshooting

### Server won't start

**Check logs:**
```bash
# Railway
railway logs

# Render
# Dashboard → Logs tab

# Fly.io
fly logs
```

**Common issues:**
- Missing `server/package.json` → Ensure working directory is set correctly
- PORT not set → Platform should set this automatically
- SQLite permission errors → Check volume mount path

### Data not persisting

**Railway:** Ensure volume is mounted at `/app/server/walks.db`

**Render:** Verify disk mount path is `/opt/render/project/src/server/walks.db`

**Fly.io:** Check volume is mounted to `/app/server`

### Frontend can't submit data

1. **Check CORS:** Server should allow requests from google.com
2. **Verify URL:** Ensure `DRUNK_WALKER_BACKEND_URL` is correct
3. **Check console:** Look for errors in browser dev tools

---

## Security Considerations

**Current implementation:**
- ✅ No authentication (public API)
- ✅ No rate limiting
- ✅ No IP logging
- ✅ Minimal data collection (URL + rotation only)

**For production use, consider:**
- Adding rate limiting (express-rate-limit)
- Implementing API key authentication
- Adding CORS restrictions
- Setting up monitoring/alerts

---

## Cost Estimates

| Platform | Free Tier | Paid (if needed) |
|----------|-----------|------------------|
| Railway | $5 credit/month | $5/month for 2GB RAM |
| Render | 750 hrs/month | $7/month for web service |
| Fly.io | 3 shared VMs | ~$2/month for small VM |

**Expected costs for low-traffic deployment:** $0 (within free tiers)

---

## Support

- **Issues:** [GitHub Issues](https://github.com/genaforvena/drunk-walker/issues)
- **Discussions:** [GitHub Discussions](https://github.com/genaforvena/drunk-walker/discussions)
- **Documentation:** See README.md and PROJECT_MEMORY.md
