from django.conf import settings
from django.db import models


class StorageLocation(models.TextChoices):
    """Where the PDF file bytes are stored. postgres = DB BLOB; s3 = object storage (future)."""
    POSTGRES = 'postgres', 'Postgres'
    S3 = 's3', 'S3'


class Project(models.Model):
    """A project (deal) that can contain multiple PDFs."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='projects',
    )
    name = models.CharField(max_length=255)
    color = models.CharField(max_length=7, default='#f59e0b', help_text='Hex colour for the project card accent')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']


class Color(models.Model):
    """Legacy global list of highlight colours. Being replaced by HighlightPreset + PresetColor."""
    key = models.CharField(max_length=20, unique=True)
    default_name = models.CharField(max_length=255)

    class Meta:
        ordering = ['key']

    def __str__(self):
        return self.key


class HighlightPreset(models.Model):
    """A named set of highlight colours. user=null for system presets (e.g. Private Equity, Public Markets)."""
    name = models.CharField(max_length=255)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='highlight_presets',
        null=True,
        blank=True,
        help_text='Null for system presets; set for user-created presets.',
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'name'],
                name='unique_preset_name_per_user',
            ),
        ]

    def __str__(self):
        return self.name


class PresetColor(models.Model):
    """One colour in a highlight preset. Presets can have 5 defaults or user-added colours."""
    preset = models.ForeignKey(
        HighlightPreset,
        on_delete=models.CASCADE,
        related_name='colors',
    )
    key = models.CharField(max_length=30, help_text='Identifier, e.g. yellow, green, or custom_1')
    display_name = models.CharField(max_length=255)
    hex = models.CharField(max_length=7, help_text='Hex colour, e.g. #FBBF24')
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'key']
        unique_together = [('preset', 'key')]

    def __str__(self):
        return f'{self.preset.name}: {self.display_name}'


class Document(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='documents',
    )
    pdf_hash = models.CharField(max_length=64, help_text='SHA-256 hash of the PDF file')
    filename = models.CharField(max_length=500, help_text='Display name (editable)')
    color = models.CharField(
        max_length=7, null=True, blank=True,
        help_text='Hex colour for the document card accent. Falls back to project colour if unset.',
    )
    file_size = models.BigIntegerField(help_text='File size in bytes')
    storage_location = models.CharField(
        max_length=20,
        choices=StorageLocation.choices,
        default=StorageLocation.POSTGRES,
        help_text='Where the PDF bytes are stored: postgres (DB) or s3 (future).',
    )
    # Used when storage_location == postgres
    pdf_file = models.BinaryField(null=True, blank=True, help_text='PDF bytes when stored in Postgres')
    # Used when storage_location == s3 (future)
    s3_key = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        help_text='Object key in S3 when storage_location is s3',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    highlight_preset = models.ForeignKey(
        HighlightPreset,
        on_delete=models.PROTECT,
        related_name='documents',
        null=True,
        blank=True,
        help_text='Which colour preset this document uses. Null falls back to first system preset.',
    )

    class Meta:
        ordering = ['-updated_at']
        unique_together = [('project', 'pdf_hash')]

    def get_effective_preset(self):
        """Return the highlight preset for this document, or the first system preset if unset."""
        if self.highlight_preset_id:
            return self.highlight_preset
        return HighlightPreset.objects.filter(user__isnull=True).order_by('name').first()

    def get_pdf_bytes(self):
        """Return PDF bytes from current storage. For postgres: from pdf_file; for s3: fetch from S3 (not implemented)."""
        if self.storage_location == StorageLocation.POSTGRES and self.pdf_file:
            return bytes(self.pdf_file)
        if self.storage_location == StorageLocation.S3 and self.s3_key:
            return None
        return None


class DocumentColor(models.Model):
    """Per-document custom label for a colour. No row = use Color.default_name. X in UI deletes this row."""
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='document_colors')
    color = models.ForeignKey(Color, on_delete=models.CASCADE, related_name='document_colors')
    custom_name = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = [('document', 'color')]
        ordering = ['color__key']


class Highlight(models.Model):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='highlights',
    )
    page_number = models.PositiveIntegerField()
    position_data = models.JSONField(
        help_text='JSON containing selection range data for re-rendering',
    )
    color = models.ForeignKey(
        Color,
        on_delete=models.PROTECT,
        related_name='highlights',
        null=True, blank=True,
    )
    color_key = models.CharField(
        max_length=60,
        default='yellow',
        help_text='Raw colour key, supports both legacy and custom preset keys.',
    )
    highlighted_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['page_number', 'created_at']


class Note(models.Model):
    highlight = models.OneToOneField(
        Highlight,
        on_delete=models.CASCADE,
        related_name='note',
    )
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
