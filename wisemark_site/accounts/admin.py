from django.contrib import admin
from .models import Account, SignOnCode


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ('user', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('user__email', 'user__username')


@admin.register(SignOnCode)
class SignOnCodeAdmin(admin.ModelAdmin):
    list_display = ('email', 'code', 'created_at', 'expires_at')
    list_filter = ('created_at',)
    search_fields = ('email',)
