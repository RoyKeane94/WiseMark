from django.urls import path
from . import views

urlpatterns = [
    path('request-code/', views.request_code),
    path('verify-code/', views.verify_code),
    path('logout/', views.logout),
    path('me/', views.me),
    path('me/delete/', views.delete_account),
    path('report-error/', views.report_error),
    path('create-checkout-session/', views.create_checkout_session),
    path('billing/create-upgrade-session/', views.create_upgrade_checkout_session),
    path('billing/verify-upgrade/', views.verify_upgrade_session),
    path('billing/cancel-subscription/', views.cancel_subscription),
    path('verify-checkout/', views.verify_checkout),
    path('stripe-webhook/', views.stripe_webhook),
]
