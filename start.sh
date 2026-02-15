#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/wisemark_site"

# Use Python from PATH or common install locations (Railpack/mise may not be on PATH in start)
export PATH="/usr/local/bin:/root/.local/bin:$PATH"
PYTHON=$(command -v python3 2>/dev/null || command -v python 2>/dev/null || true)
if [ -z "$PYTHON" ]; then
  for p in /root/.local/share/mise/installs/python/*/bin/python3 /opt/python/*/bin/python3; do
    [ -x "$p" ] && PYTHON=$p && break
  done
fi
if [ -z "$PYTHON" ]; then
  echo "start.sh: Python not found. PATH=$PATH" >&2
  exit 1
fi

"$PYTHON" manage.py migrate --noinput
"$PYTHON" manage.py collectstatic --noinput --clear 2>/dev/null || true

PORT="${PORT:-8000}"
exec "$PYTHON" -m gunicorn wisemark_site.wsgi:application --bind "0.0.0.0:$PORT" --workers 3
