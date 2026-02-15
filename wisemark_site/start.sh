#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

python3 manage.py migrate --noinput
python3 manage.py collectstatic --noinput --clear 2>/dev/null || true

PORT="${PORT:-8000}"
exec gunicorn wisemark_site.wsgi:application --bind "0.0.0.0:$PORT"
