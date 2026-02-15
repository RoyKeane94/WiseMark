# Backend + frontend (use when project root = repo root)
# Stage 1: build frontend
FROM node:20-alpine AS frontend
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY frontend/ .
ENV NODE_ENV=production
RUN npm run build

# Stage 2: Django serves API + SPA
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

COPY wisemark_site/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY wisemark_site/ .
COPY --from=frontend /app/dist ./static/frontend

RUN chmod +x docker-entrypoint.sh

RUN python manage.py collectstatic --noinput --clear 2>/dev/null || true

EXPOSE 8000

CMD ["./docker-entrypoint.sh"]
