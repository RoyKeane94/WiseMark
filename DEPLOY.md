# Deploying WiseMark (Railpack)

Railpack is only seeing `frontend/`, `wisemark_site/`, and a few root files. To fix **"Script start.sh not found"**:

## Option A: Use `wisemark_site` as the service root (recommended)

In your host’s dashboard (e.g. Railway):

1. Set **Root Directory** (or **Service Root**) to **`wisemark_site`**.
2. Redeploy.

Railpack will then build only the Django app (Python + `requirements.txt`) and will see **`wisemark_site/start.sh`** and **`wisemark_site/railpack.json`**, so the start script will be found.

No need to commit root-level `start.sh` or `railpack.json` for this option.

---

## Option B: Deploy from the repo root

If you want the service root to stay at the repo root:

1. **Commit and push** the root-level deploy files:
   - `start.sh`
   - `railpack.json`
   - `Procfile`
   - `nixpacks.toml` (optional)

2. Redeploy so the build includes these files.

Railpack will use `railpack.json` (provider: python, start: `bash start.sh`) and will find `start.sh` at the repo root.

---

## Environment variables (production)

Set in your host’s environment:

- **SECRET_KEY** – Django secret (generate a new one for production).
- **DEBUG** – `False`.
- **ALLOWED_HOSTS** – Your domain(s), comma-separated (e.g. `yourapp.railway.app`).
- **CORS_ORIGINS** – Frontend URL(s) if the app is on a different domain (e.g. `https://your-frontend.vercel.app`).
