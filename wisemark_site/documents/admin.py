from django.contrib import admin
from .models import Project, Document


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'user__email')


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('filename', 'project', 'pdf_hash', 'created_at')
    list_filter = ('project', 'created_at')
    search_fields = ('filename', 'pdf_hash')
