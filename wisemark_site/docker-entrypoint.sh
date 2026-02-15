#!/bin/sh
set -e
echo "[entrypoint] Starting..."
echo "[entrypoint] Running migrations..."
python manage.py migrate --noinput
echo "[entrypoint] Starting gunicorn on 0.0.0.0:${PORT:-8000}"
exec gunicorn wisemark_site.wsgi:application --bind "0.0.0.0:${PORT:-8000}" --workers 3
