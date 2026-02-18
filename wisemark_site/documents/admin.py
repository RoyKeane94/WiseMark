from django.contrib import admin
from .models import Project, Document, Color, DocumentColor, Highlight, Note


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'user', 'color', 'created_at', 'updated_at')
    list_filter = ('created_at',)
    search_fields = ('name', 'user__email')
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('filename', 'project', 'pdf_hash', 'storage_location', 'file_size', 'created_at')
    list_filter = ('project', 'storage_location', 'created_at')
    search_fields = ('filename', 'pdf_hash')
    readonly_fields = ('pdf_hash', 'created_at', 'updated_at')
    # Exclude pdf_file so the change form doesn't load large binary data and time out
    exclude = ('pdf_file',)


@admin.register(Color)
class ColorAdmin(admin.ModelAdmin):
    list_display = ('key', 'default_name')
    search_fields = ('key', 'default_name')


@admin.register(DocumentColor)
class DocumentColorAdmin(admin.ModelAdmin):
    list_display = ('document', 'color', 'custom_name')
    list_filter = ('color',)
    search_fields = ('document__filename', 'custom_name')


@admin.register(Highlight)
class HighlightAdmin(admin.ModelAdmin):
    list_display = ('document', 'page_number', 'color', 'highlighted_text_preview', 'created_at')
    list_filter = ('document__project', 'color', 'page_number')
    search_fields = ('highlighted_text',)
    readonly_fields = ('created_at', 'updated_at')

    def highlighted_text_preview(self, obj):
        return (obj.highlighted_text[:60] + '…') if obj.highlighted_text and len(obj.highlighted_text) > 60 else (obj.highlighted_text or '')
    highlighted_text_preview.short_description = 'Highlight'


@admin.register(Note)
class NoteAdmin(admin.ModelAdmin):
    list_display = ('highlight', 'content_preview', 'created_at')
    search_fields = ('content',)
    readonly_fields = ('created_at', 'updated_at')

    def content_preview(self, obj):
        return (obj.content[:60] + '…') if obj.content and len(obj.content) > 60 else (obj.content or '')
    content_preview.short_description = 'Note'
