# Use official Python image so the runtime has Python on PATH
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .
RUN chmod +x docker-entrypoint.sh

# Collect static files at build time (optional; remove if you don't need it)
RUN python manage.py collectstatic --noinput --clear 2>/dev/null || true

EXPOSE 8000

# Entrypoint prints to stdout so deploy logs always show something
CMD ["./docker-entrypoint.sh"]
