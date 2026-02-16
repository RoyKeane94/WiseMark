#!/bin/sh
set -e
echo "[entrypoint] Starting..."

# Retry migrations until DB is reachable (e.g. Railway starts app and Postgres in parallel)
echo "[entrypoint] Running migrations..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if python manage.py migrate --noinput; then
    break
  fi
  if [ "$i" = 10 ]; then
    echo "[entrypoint] Migrate failed after 10 attempts"
    exit 1
  fi
  echo "[entrypoint] Migrate failed, retrying in 5s..."
  sleep 5
done

echo "[entrypoint] Starting gunicorn on 0.0.0.0:${PORT:-8000}"
exec gunicorn wisemark_site.wsgi:application --bind "0.0.0.0:${PORT:-8000}" --workers 3
