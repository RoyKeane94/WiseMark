"""
Middleware to capture server errors, assign a reference code, and log them.
Also forces Secure flag on all cookies when behind HTTPS (X-Forwarded-Proto).
"""
import logging
import random
import string

logger = logging.getLogger(__name__)


def _generate_error_code(length=8):
    """Generate a short alphanumeric reference code for the user."""
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))


class ErrorReferenceMiddleware:
    """
    On uncaught exceptions, generate a reference code, log the full error,
    and attach the code to the request so the 500 template can show it.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        return self.get_response(request)

    def process_exception(self, request, exception):
        code = _generate_error_code()
        request.error_reference_code = code
        logger.exception(
            'Error reference %s: %s',
            code,
            str(exception),
            exc_info=True,
            extra={'request': request, 'error_code': code},
        )
        return None  # Let Django continue to 500 handler


class SecureCookieMiddleware:
    """
    When the request is HTTPS (via X-Forwarded-Proto), set Secure on every cookie.
    Fixes Chrome "Not Secure" when any cookie lacks the Secure flag.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.META.get('HTTP_X_FORWARDED_PROTO') == 'https':
            for name in response.cookies:
                response.cookies[name]['secure'] = True
        return response


class SecurityHeadersMiddleware:
    """
    Add Content-Security-Policy and Referrer-Policy for Mozilla/security scans.
    Only adds headers in production (when DEBUG is False) to avoid breaking dev.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        from django.conf import settings
        if not settings.DEBUG:
            # CSP: allow same-origin + Google Fonts; inline styles/scripts for landing & SPA
            csp = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: blob:; "
                "connect-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )
            response['Content-Security-Policy'] = csp
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response
