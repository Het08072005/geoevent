# 🚀 GeoEvents — Complete Deployment Guide
## Stack: React (Vite) + FastAPI + Caddy (HTTPS auto)
### Server: AWS EC2 Ubuntu 22.04 | IP: `34.235.32.139`

---

## 🏗️ Architecture Overview

```
Internet (HTTPS 443)
       │
   [Caddy]  ← single entry point, auto HTTPS via nip.io
     ├── app.34.235.32.139.nip.io     → React dev server (127.0.0.1:5174)
     └── newapi.34.235.32.139.nip.io  → FastAPI backend  (127.0.0.1:8010)
```

**Key design decisions:**
- `app.` subdomain = frontend | `newapi.` subdomain = backend API
- Caddy handles HTTPS automatically (no certbot needed!)
- `VITE_API_URL=https://newapi.34.235.32.139.nip.io` — NO trailing `/api`
- `App.jsx` already appends `/api/search`, `/api/nearby-venues` etc. itself

> ⚠️ **CRITICAL:** Never put `/api` at the end of `VITE_API_URL`.
> App.jsx calls `${API_BASE_URL}/api/search` — adding `/api` = double path `/api/api/search` = 404!

---

## 🔒 STEP 0 — Local Development (Windows)

```bash
cd OneDrive\Desktop\vikara\location_based
```

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt

# Run (local dev — auto-reload on save):
python -m uvicorn app.main:app --reload --port 8000
# → API running at http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → App running at http://localhost:5173
# Vite proxy forwards /api/* → http://localhost:8000 (no CORS issues!)
```

> Local dev uses port 8000. Production uses port 8010. No code changes needed — controlled by .env

---

## 🖥️ STEP 1 — SSH Into Server

```bash
ssh -i ai_avatar.pem ubuntu@34.235.32.139
```

---

## 🧹 STEP 2 — Server Environment Setup (First Time Only)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv git -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy -y

# Verify
node --version   # v20.x
python3 --version
caddy version
```

---

## 📂 STEP 3 — Clone / Pull Project

```bash
# First time:
mkdir ~/geoevents_secure
cd ~/geoevents_secure
git clone <your-repo-url> .

# Re-deploy (update only):
cd ~/geoevents_secure
git pull
```

---

## 🐍 STEP 4 — Backend Setup

```bash
cd ~/geoevents_secure/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Create / Update Production `.env` on Server

```bash
nano ~/geoevents_secure/backend/.env
```

Paste **exactly** (replace keys if needed):

```env
GEOAPIFY_API_KEY=66dd1c0d3fb542ef9d255dedfd3b2a5a
GEMINI_API_KEY=AIzaSyD16wX5b7Udt6EmQO9Y-0S1gVNdwToX7p0
ALLOWED_ORIGINS=https://app.34.235.32.139.nip.io
PORT=8010
ENV=production
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

### Quick Test (optional)

```bash
source venv/bin/activate
python -m uvicorn app.main:app --host 0.0.0.0 --port 8010
# Should print: INFO: Started server process
# Ctrl+C to stop — systemd manages it permanently
```

---

## ⚙️ STEP 5 — Systemd Service (Auto-Start Backend)

```bash
sudo nano /etc/systemd/system/geoevents-backend.service
```

Paste:

```ini
[Unit]
Description=GeoEvents FastAPI Backend
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/geoevents_secure/backend
ExecStart=/home/ubuntu/geoevents_secure/backend/venv/bin/python -m uvicorn app.main:app --host 0.0.0.0 --port 8010
Restart=always
RestartSec=5
EnvironmentFile=/home/ubuntu/geoevents_secure/backend/.env

[Install]
WantedBy=multi-user.target
```

Save and enable:

```bash
sudo systemctl daemon-reload
sudo systemctl enable geoevents-backend
sudo systemctl restart geoevents-backend
```

### Verify Backend is Running

```bash
sudo systemctl status geoevents-backend
# Should show: Active: active (running)

# Quick API health check
curl http://localhost:8010/
# Should return: {"status":"online","api":"Business Analytics Active","env":"production"}

# Test the search endpoint directly
curl "http://localhost:8010/api/search?text=london"
# Should return: {"status":"success","results":[...]}
```

> ✅ Backend now **auto-starts on every reboot**.

---

## 🎨 STEP 6 — Frontend Build (Production)

```bash
cd ~/geoevents_secure/frontend
npm install
npm run build
# Vite reads .env.production → bakes VITE_API_URL=https://newapi.34.235.32.139.nip.io into the bundle
# Creates: ~/geoevents_secure/frontend/dist/
```

### Verify Build

```bash
ls dist/
# Should show: index.html  assets/

# Confirm the correct API URL is baked in (should NOT contain /api at end):
grep -o '"https://newapi[^"]*"' dist/assets/*.js | head -5
```

---

## 🌐 STEP 7 — Caddy Configuration

```bash
sudo nano /etc/caddy/Caddyfile
```

Paste **exactly**:

```caddy
########################################
# Frontend (React dev server on port 5174)
########################################
app.34.235.32.139.nip.io {
    reverse_proxy 127.0.0.1:5174
}

########################################
# Backend API (FastAPI on port 8010)
########################################
newapi.34.235.32.139.nip.io {
    reverse_proxy 127.0.0.1:8010 {
        header_up Host {host}
        header_up X-Real-IP {remote_host}
    }
}
```

Reload Caddy:

```bash
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo systemctl reload caddy
sudo systemctl status caddy
# Should show: Active: active (running)
```

> ✅ Caddy auto-handles HTTPS! No certbot needed.

---

## 🎯 STEP 8 (Alternative) — Serve Built Frontend via Caddy

If you want to serve the **production build** (faster, no dev server needed):

```bash
sudo nano /etc/caddy/Caddyfile
```

Replace the `app.` block with:

```caddy
app.34.235.32.139.nip.io {
    root * /home/ubuntu/geoevents_secure/frontend/dist
    file_server
    try_files {path} /index.html
}
```

Then reload:
```bash
sudo systemctl reload caddy
```

---

## 🔥 STEP 9 — AWS Security Group Check

In AWS Console → EC2 → Security Groups, ensure **only** these ports are open:

| Port | Protocol | Source    | Purpose          |
|------|----------|-----------|------------------|
| 22   | TCP      | Your IP   | SSH              |
| 80   | TCP      | 0.0.0.0/0 | HTTP (→ HTTPS)  |
| 443  | TCP      | 0.0.0.0/0 | HTTPS            |

> ⛔ **Port 8010 must NOT be public.** Backend is internal only — Caddy proxies it.

---

## ✅ STEP 10 — Final Verification

```bash
# 1. Backend health (direct)
curl http://localhost:8010/
# → {"status":"online","api":"Business Analytics Active","env":"production"}

# 2. Backend via Caddy HTTPS
curl https://newapi.34.235.32.139.nip.io/api/search?text=london
# → {"status":"success","results":[...]}

# 3. Frontend
# Open in browser: https://app.34.235.32.139.nip.io
# → React app loads, search works, map shows

# 4. Service status
sudo systemctl status geoevents-backend
sudo systemctl status caddy
```

---

## 🔄 Re-Deployment (After Code Changes)

```bash
ssh -i ai_avatar.pem ubuntu@34.235.32.139

cd ~/geoevents_secure

# Pull latest code
git pull

# Rebuild frontend (picks up new .env.production automatically)
cd frontend
npm install
npm run build

# Restart backend (if backend code changed)
sudo systemctl restart geoevents-backend

# Reload Caddy (only if Caddyfile changed)
sudo systemctl reload caddy
```

---

## 🛡️ Troubleshooting

| Problem | Solution |
|---------|----------|
| `/api/api/search` double path | `VITE_API_URL` has trailing `/api` — remove it, rebuild frontend |
| `404 Not Found` on API | Check `curl http://localhost:8010/api/search?text=test` — backend down? |
| `CORS Error` | Check `ALLOWED_ORIGINS` in backend `.env` = `https://app.34.235.32.139.nip.io` |
| `502 Bad Gateway` | Backend not running → `sudo systemctl restart geoevents-backend` |
| `Caddy not routing` | `sudo systemctl status caddy` → `sudo journalctl -u caddy -n 50` |
| `Map not loading` | `VITE_GEOAPIFY_KEY` not set in `.env.production` before build |
| `Gemini Error` | Check `GEMINI_API_KEY` is valid and quota not exceeded |
| `Backend not starting` | `journalctl -u geoevents-backend -n 50` to see logs |
| `SSL cert issues` | Caddy handles SSL automatically — just ensure ports 80/443 are open |

---

## 📁 Final File Structure on Server

```
/home/ubuntu/geoevents_secure/
├── backend/
│   ├── app/
│   │   ├── main.py              ← FastAPI app (routes: /api/search etc.)
│   │   └── services/
│   │       └── gemini_service.py
│   ├── main.py                  ← uvicorn entry point (port 8010)
│   ├── requirements.txt
│   ├── dummy_events.json
│   ├── .env                     ← PORT=8010, ALLOWED_ORIGINS=https://app.34.235.32.139.nip.io
│   └── venv/
└── frontend/
    ├── src/
    │   └── App.jsx              ← Uses VITE_API_URL + /api/search (no double /api!)
    ├── .env.production          ← VITE_API_URL=https://newapi.34.235.32.139.nip.io
    ├── package.json
    ├── vite.config.js
    └── dist/                    ← Built React app

/etc/caddy/Caddyfile             ← Routes app.→5174, newapi.→8010
/etc/systemd/system/
└── geoevents-backend.service    ← Auto-start backend
```

---

📊 **System is Production Ready.**
🤖 Gemini AI | 🗺️ GeoApify Maps | ⚡ FastAPI + React | 🔒 Caddy Auto-HTTPS
