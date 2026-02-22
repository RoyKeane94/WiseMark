from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register(r'projects', views.ProjectViewSet, basename='project')
router.register(r'lenses', views.HighlightPresetViewSet, basename='lens')
router.register(r'documents', views.DocumentViewSet, basename='document')

urlpatterns = [
    path('library/', views.LibraryView.as_view(), name='library'),
    path('', include(router.urls)),
]
