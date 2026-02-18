import uvicorn
import os
import sys

# Ensure the app directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

if __name__ == "__main__":
    host = os.getenv("HOST", "0.0.0.0")
    # Local dev: 8000 | Production (systemd): set PORT=8010 in .env
    port = int(os.getenv("PORT", 8000))
    # In production set ENV=production in .env → disables reload
    debug = os.getenv("ENV", "development") != "production"

    print(f"Starting GeoEvents Business Analytics API on {host}:{port} (debug={debug})...")
    uvicorn.run("app.main:app", host=host, port=port, reload=debug)
