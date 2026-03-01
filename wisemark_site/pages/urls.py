from django.urls import path
from . import views

urlpatterns = [
    path('security/', views.security_page),
    path('privacy/', views.privacy_page),
    path('contact/', views.contact_page),
]
