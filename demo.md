# 🚀 GeoEvents — Complete Deployment Guide
## Stack: React (Vite) + FastAPI + Nginx + Let's Encrypt SSL
### Server: AWS EC2 Ubuntu 22.04 | Domain: `geoevents.34.235.32.139.nip.io`

---

## 🏗️ Architecture Overview

```
Internet (HTTPS 443)
       │
  [Nginx]  ← single entry point, handles SSL
    ├── /          → serves /home/ubuntu/geoevents_secure/frontend/dist (React static)
    └── /api/*     → proxy_pass http://127.0.0.1:8010 (FastAPI, internal only)
                                          │
                              [systemd: geoevents-backend]
                              auto-starts on reboot, never exposed publicly
```

**Key design decisions:**
- Port `8010` is **internal only** — never exposed in AWS Security Group
- Old project/Nginx config is **untouched** — new isolated site file
- `npm run build` bakes `VITE_API_URL` into the JS bundle at build time
- `ENV=production` disables uvicorn `--reload` (production-safe)

---

## 🔒 STEP 0 — Local Development (Windows)

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
# .env is already configured for local dev (PORT defaults to 8000)
python main.py
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

> **Local dev uses port 8000. Production uses port 8010. No code changes needed — controlled by .env**

---

## 🖥️ STEP 1 — SSH Into Server

```bash
ssh -i ai_avatar.pem ubuntu@34.235.32.139
```

---

## 🧹 STEP 2 — Server Environment Setup (First Time Only)

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install python3-pip python3-venv nginx git -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node --version   # should be v20.x
python3 --version
nginx -v
```

---

## 📂 STEP 3 — Clone Project (Isolated Folder)

```bash
mkdir ~/geoevents_secure
cd ~/geoevents_secure
git clone <your-repo-url> .
```

> ⚠️ The old project remains **completely untouched** in its original folder.

---

## 🐍 STEP 4 — Backend Setup

```bash
cd ~/geoevents_secure/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Create Production `.env`

```bash
nano .env
```

Paste exactly:

```env
GEOAPIFY_API_KEY=66dd1c0d3fb542ef9d255dedfd3b2a5a
GEMINI_API_KEY=AIzaSyD16wX5b7Udt6EmQO9Y-0S1gVNdwToX7p0
ALLOWED_ORIGINS=https://geoevents.34.235.32.139.nip.io
PORT=8010
ENV=production
```

Save: `Ctrl+O` → `Enter` → `Ctrl+X`

### Quick Test (optional)

```bash
source venv/bin/activate
python main.py
# Should print: Starting GeoEvents Business Analytics API on 0.0.0.0:8010 (debug=False)
# Ctrl+C to stop — systemd will manage it permanently
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
ExecStart=/home/ubuntu/geoevents_secure/backend/venv/bin/python main.py
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
sudo systemctl start geoevents-backend
```

### Verify Backend is Running

```bash
sudo systemctl status geoevents-backend
# Should show: Active: active (running)

# Quick API health check
curl http://localhost:8010/
# Should return: {"status":"online","api":"Business Analytics Active","env":"production"}
```

> ✅ Backend now **auto-starts on every reboot**. Terminal can be closed safely.

---

## 🎨 STEP 6 — Frontend Build (Production)

```bash
cd ~/geoevents_secure/frontend
npm install
```

The `.env.production` file is already in the repo with the correct production URL.
Vite automatically uses `.env.production` during `npm run build`.

```bash
npm run build
# Creates: ~/geoevents_secure/frontend/dist/
```

### Verify Build

```bash
ls dist/
# Should show: index.html  assets/
```

---

## 🌐 STEP 7 — Nginx Configuration (New Isolated File)

```bash
sudo nano /etc/nginx/sites-available/geoevents_secure
```

Paste:

```nginx
server {
    listen 80;
    server_name geoevents.34.235.32.139.nip.io;

    root /home/ubuntu/geoevents_secure/frontend/dist;
    index index.html;

    # React SPA — all routes fall back to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy — internal only, port 8010 never exposed publicly
    location /api/ {
        proxy_pass http://127.0.0.1:8010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }
}
```

### Enable the New Site

```bash
sudo ln -s /etc/nginx/sites-available/geoevents_secure /etc/nginx/sites-enabled/
sudo nginx -t
# Must print: configuration file /etc/nginx/nginx.conf test is successful
sudo systemctl reload nginx
```

> ✅ Old nginx config is **untouched**. This is a brand new site file.

---

## 🔐 STEP 8 — HTTPS with Let's Encrypt (Auto SSL)

```bash
sudo apt install certbot python3-certbot-nginx -y

sudo certbot --nginx -d geoevents.34.235.32.139.nip.io
```

When prompted:
- Enter your email
- Agree to terms: `Y`
- **Choose option 2: Redirect HTTP → HTTPS** ← Important!

Certbot will:
1. Obtain a free SSL certificate
2. Automatically update **only** the `geoevents_secure` nginx block
3. Set up auto-renewal via cron

### Verify SSL

```bash
sudo certbot renew --dry-run
# Should succeed without errors
```

---

## 🔥 STEP 9 — AWS Security Group Check

In AWS Console → EC2 → Security Groups, ensure **only** these ports are open:

| Port | Protocol | Source    | Purpose          |
|------|----------|-----------|------------------|
| 22   | TCP      | Your IP   | SSH              |
| 80   | TCP      | 0.0.0.0/0 | HTTP (→ HTTPS)  |
| 443  | TCP      | 0.0.0.0/0 | HTTPS            |

> ⛔ **Port 8010 must NOT be in the security group.** Backend is internal only.

---

## ✅ STEP 10 — Final Verification

```bash
# 1. Backend health
curl https://geoevents.34.235.32.139.nip.io/api/search?text=london
# Should return: {"status":"success","results":[...]}

# 2. Frontend
# Open in browser: https://geoevents.34.235.32.139.nip.io
# Should load the React app with map

# 3. Service status
sudo systemctl status geoevents-backend
sudo systemctl status nginx
```

---

## 🔄 Re-Deployment (After Code Changes)

```bash
cd ~/geoevents_secure

# Pull latest code
git pull

# Rebuild frontend
cd frontend
npm install
npm run build

# Restart backend (if backend changed)
sudo systemctl restart geoevents-backend

# Reload nginx (only if nginx config changed)
sudo nginx -t && sudo systemctl reload nginx
```

---

## 🛡️ Troubleshooting

| Problem | Solution |
|---------|----------|
| `502 Bad Gateway` | Backend not running → `sudo systemctl restart geoevents-backend` |
| `CORS Error` | Check `ALLOWED_ORIGINS` in backend `.env` matches your domain exactly |
| `API 404` | Nginx `/api/` proxy not pointing to port 8010 |
| `Map not loading` | `VITE_GEOAPIFY_KEY` not set in `.env.production` before build |
| `Gemini Error` | Check `GEMINI_API_KEY` is valid and quota not exceeded |
| `SSL cert expired` | `sudo certbot renew` (auto-renewal should handle this) |
| `Backend not starting` | `journalctl -u geoevents-backend -n 50` to see logs |
| `Nginx config error` | `sudo nginx -t` to validate before reloading |

---

## 📁 Final File Structure on Server

```
/home/ubuntu/geoevents_secure/
├── backend/
│   ├── app/
│   │   ├── main.py              ← FastAPI app
│   │   └── services/
│   │       └── gemini_service.py
│   ├── main.py                  ← uvicorn entry point
│   ├── requirements.txt
│   ├── dummy_events.json
│   ├── .env                     ← PORT=8010, ENV=production (NOT in git)
│   └── venv/                    ← Python virtualenv (NOT in git)
└── frontend/
    ├── src/
    ├── .env.production          ← VITE_API_URL=https://... (in git)
    ├── package.json
    ├── vite.config.js
    └── dist/                    ← Built by npm run build (served by Nginx)

/etc/systemd/system/
└── geoevents-backend.service    ← Auto-start service

/etc/nginx/sites-available/
└── geoevents_secure             ← New isolated nginx config (old untouched)
```

---

📊 **System is Production Ready.**  
🤖 Gemini AI | 🗺️ GeoApify Maps | ⚡ FastAPI + React | 🔒 Let's Encrypt SSL
