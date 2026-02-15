# Backend Dockerfile (use when project root = repo root)
# Railway uses this if Root Directory is unset or repo root.
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Copy and install backend deps
COPY wisemark_site/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend app
COPY wisemark_site/ .

RUN chmod +x docker-entrypoint.sh

RUN python manage.py collectstatic --noinput --clear 2>/dev/null || true

EXPOSE 8000

CMD ["./docker-entrypoint.sh"]
