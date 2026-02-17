"""
URL configuration for wisemark_site project.
"""
from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.shortcuts import render
from django.urls import path, include


def landing_page(request):
    """Serve the marketing landing page at /."""
    return render(request, 'landing.html')


def serve_spa(request, path=''):
    """Serve the frontend SPA (app, login, register, etc.) for client-side routes."""
    index_path = settings.BASE_DIR / 'static' / 'frontend' / 'index.html'
    if not index_path.exists():
        return HttpResponse(
            '<p>Frontend not built. Run <code>cd frontend && npm run build</code> and copy <code>dist/</code> to <code>wisemark_site/static/frontend/</code>.</p>',
            content_type='text/html',
            status=503,
        )
    with open(index_path, encoding='utf-8') as f:
        return HttpResponse(f.read(), content_type='text/html')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/', include('documents.urls')),
    path('', landing_page),
    path('<path:path>', serve_spa),
]
