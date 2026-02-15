#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/wisemark_site"

# Install deps if not already (e.g. when Railpack doesn't detect Python due to monorepo)
if ! python -c "import django" 2>/dev/null; then
  python -m pip install -r wisemark_site/requirements.txt
fi

python manage.py migrate --noinput
python manage.py collectstatic --noinput --clear 2>/dev/null || true

PORT="${PORT:-8000}"
exec gunicorn wisemark_site.wsgi:application --bind "0.0.0.0:$PORT" --workers 3
