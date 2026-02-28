# Security notes (WiseMark)

## HTTP → HTTPS redirect (Mozilla “Redirection” test)

**Issue:** “Initial redirection from HTTP to HTTPS is to a different host, preventing HSTS.”

This means a request to `http://www.wisemarkhq.com` is being redirected to a **different** host (e.g. `https://wisemark-production.up.railway.app`) instead of `https://www.wisemarkhq.com`. HSTS only applies when the first redirect stays on the same host.

**Fix (Railway / hosting):** Ensure the first redirect is **same-host**:

- `http://www.wisemarkhq.com` → `https://www.wisemarkhq.com` (correct)
- Not: `http://www.wisemarkhq.com` → `https://wisemark-production.up.railway.app`

In Railway: use the custom domain as the public host and avoid redirecting HTTP traffic to the `.railway.app` domain. If you use a reverse proxy or CDN in front (e.g. Cloudflare), set “HTTP to HTTPS” redirect there and keep the host as `www.wisemarkhq.com`.

## HSTS preload

The app sends `Strict-Transport-Security` with `max-age=31536000`, `includeSubDomains`, and `preload`. To get into browsers’ HSTS preload list:

1. Keep these settings (already in `settings.py` when `DEBUG=False`).
2. Submit the domain at [https://hstspreload.org](https://hstspreload.org).

## Content Security Policy (CSP)

A CSP header is set in production via `SecurityHeadersMiddleware` (see `wisemark_site/middleware.py`). It allows same-origin assets and Google Fonts. If you add new external scripts or styles, you may need to extend the CSP in that middleware.
