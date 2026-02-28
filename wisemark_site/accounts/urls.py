from django.urls import path
from . import views

urlpatterns = [
    path('request-code/', views.request_code),
    path('verify-code/', views.verify_code),
    path('logout/', views.logout),
    path('me/', views.me),
    path('me/delete/', views.delete_account),
]
