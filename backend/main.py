# Entry point — run from the backend/ directory:
#
#   Local dev:   python -m uvicorn app.main:app --reload --port 8000
#   Production:  python -m uvicorn app.main:app --host 0.0.0.0 --port 8010
#
# All application code lives in app/main.py

import subprocess, sys, os

if __name__ == "__main__":
    port  = os.getenv("PORT", "8000")
    debug = os.getenv("ENV", "development") != "production"
    args  = [
        sys.executable, "-m", "uvicorn", "app.main:app",
        "--host", "0.0.0.0", "--port", port
    ]
    if debug:
        args.append("--reload")
    subprocess.run(args)
